-- =====================================================
-- 데이코스 v2 — Supabase PostgreSQL 스키마
-- Supabase 대시보드 > SQL Editor에서 실행
-- =====================================================

-- ── extensions ───────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── users ─────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  nickname    text not null,
  role        text not null default 'user' check (role in ('user','admin')),
  created_at  timestamptz not null default now()
);

-- Supabase Auth 신규 가입 시 users 테이블 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, username, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email,'@',1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── courses ───────────────────────────────────────────
create table if not exists public.courses (
  id                      uuid primary key default uuid_generate_v4(),
  name                    text not null,
  description             text,
  region_main             text not null default '',
  region_sub              text not null default '',
  total_time              integer not null default 0,  -- 분 단위
  like_count              integer not null default 0,
  reference_count         integer not null default 0,
  original_course_id      uuid references public.courses(id) on delete set null,
  original_author_nickname text,
  original_course_name    text,
  parent_course_id        uuid references public.courses(id) on delete set null,
  parent_author_nickname  text,
  parent_course_name      text,
  author_id               uuid not null references public.users(id) on delete cascade,
  author_nickname         text not null,
  created_at              timestamptz not null default now()
);

create index if not exists courses_created_at_idx on public.courses(created_at desc);
create index if not exists courses_like_count_idx on public.courses(like_count desc);
create index if not exists courses_region_idx on public.courses(region_main, region_sub);

-- ── course_places ─────────────────────────────────────
create table if not exists public.course_places (
  id          uuid primary key default uuid_generate_v4(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  order_index integer not null default 0,
  name        text not null,
  lat         double precision not null,
  lng         double precision not null,
  category    text,
  address     text,
  phone       text,
  place_url   text,
  comment     text,         -- 한줄평
  photo_url   text,         -- Storage URL
  stay_time   integer,      -- 분 단위
  travel_time integer       -- 분 단위 (첫 번째 장소는 null)
);

create index if not exists course_places_course_id_idx on public.course_places(course_id, order_index);

-- ── course_likes ──────────────────────────────────────
create table if not exists public.course_likes (
  course_id   uuid not null references public.courses(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  primary key (course_id, user_id)
);

-- ── comments ──────────────────────────────────────────
create table if not exists public.comments (
  id          uuid primary key default uuid_generate_v4(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  author_id   uuid not null references public.users(id) on delete cascade,
  nickname    text not null,
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists comments_course_id_idx on public.comments(course_id, created_at asc);

-- ── comment_likes ─────────────────────────────────────
create table if not exists public.comment_likes (
  comment_id  uuid not null references public.comments(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  primary key (comment_id, user_id)
);

-- ── replies ───────────────────────────────────────────
create table if not exists public.replies (
  id          uuid primary key default uuid_generate_v4(),
  comment_id  uuid not null references public.comments(id) on delete cascade,
  author_id   uuid not null references public.users(id) on delete cascade,
  nickname    text not null,
  content     text not null,
  created_at  timestamptz not null default now()
);

-- ── reply_likes ───────────────────────────────────────
create table if not exists public.reply_likes (
  reply_id    uuid not null references public.replies(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  primary key (reply_id, user_id)
);

-- ── event_logs ────────────────────────────────────────
create table if not exists public.event_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.users(id) on delete set null,
  event_name  text not null,
  target_type text,
  target_id   uuid,
  metadata    jsonb default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists event_logs_event_name_idx on public.event_logs(event_name, created_at desc);

-- ── RPC 함수 ──────────────────────────────────────────

create or replace function public.increment_like_count(course_id uuid)
returns void language sql security definer as $$
  update public.courses set like_count = like_count + 1 where id = course_id;
$$;

create or replace function public.decrement_like_count(course_id uuid)
returns void language sql security definer as $$
  update public.courses set like_count = greatest(like_count - 1, 0) where id = course_id;
$$;

create or replace function public.increment_reference_count(course_id uuid)
returns void language sql security definer as $$
  update public.courses set reference_count = reference_count + 1 where id = course_id;
$$;

create or replace function public.decrement_reference_count(course_id uuid)
returns void language sql security definer as $$
  update public.courses set reference_count = greatest(reference_count - 1, 0) where id = course_id;
$$;

-- 키워드 검색: 코스명 / 소개글 / 장소명 / 장소 주소에서 ILIKE 검색
-- 반환: courses 테이블 컬럼 + like_count
create or replace function public.search_courses(
  p_keyword    text    default '',
  p_region_main text   default '',
  p_region_sub  text   default '',
  p_max_time    integer default 0,
  p_sort        text    default 'latest',
  p_offset      integer default 0,
  p_limit       integer default 12
)
returns table (
  id uuid, name text, description text,
  region_main text, region_sub text, total_time integer,
  like_count integer, reference_count integer,
  author_nickname text, created_at timestamptz,
  total_count bigint
)
language plpgsql security definer as $$
declare
  kw text := '%' || lower(p_keyword) || '%';
begin
  return query
  with matched as (
    select distinct c.id
    from public.courses c
    left join public.course_places cp on cp.course_id = c.id
    where
      (p_keyword = '' or
        lower(c.name) like kw or
        lower(coalesce(c.description,'')) like kw or
        lower(coalesce(cp.name,'')) like kw or
        lower(coalesce(cp.address,'')) like kw or
        lower(coalesce(cp.comment,'')) like kw
      )
      and (p_region_main = '' or c.region_main = p_region_main)
      and (p_region_sub  = '' or c.region_sub  = p_region_sub)
      and (p_max_time = 0 or c.total_time <= p_max_time)
  ),
  total as (select count(*) as cnt from matched),
  ranked as (
    select c.*, t.cnt as total_count
    from public.courses c
    join matched m on m.id = c.id
    cross join total t
    order by
      case p_sort
        when 'popular'    then c.like_count
        when 'referenced' then c.reference_count
        when 'time_asc'   then c.total_time
        when 'time_desc'  then -c.total_time
        else 0
      end desc,
      case when p_sort = 'latest' then c.created_at end desc
  )
  select
    r.id, r.name, r.description,
    r.region_main, r.region_sub, r.total_time,
    r.like_count, r.reference_count,
    r.author_nickname, r.created_at,
    r.total_count
  from ranked r
  limit p_limit offset p_offset;
end;
$$;

-- ── RLS ───────────────────────────────────────────────

alter table public.users enable row level security;
alter table public.courses enable row level security;
alter table public.course_places enable row level security;
alter table public.course_likes enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.replies enable row level security;
alter table public.reply_likes enable row level security;
alter table public.event_logs enable row level security;

-- users
-- 본인 전체 조회
create policy "users_select_own" on public.users for select using (auth.uid() = id);
-- 닉네임으로 아이디 찾기용: username, nickname 컬럼 공개 (보안상 허용 범위 최소화)
create policy "users_select_public_username" on public.users
  for select using (true);  -- 전체 공개 (username/nickname은 민감도 낮음)
create policy "users_update_own" on public.users for update using (auth.uid() = id);

-- courses
create policy "courses_select_all" on public.courses for select using (true);
create policy "courses_insert_user" on public.courses for insert with check (auth.uid() = author_id);
create policy "courses_update_own" on public.courses for update using (auth.uid() = author_id);
create policy "courses_delete_own" on public.courses for delete using (
  auth.uid() = author_id or
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- course_places
create policy "places_select_all" on public.course_places for select using (true);
create policy "places_insert_user" on public.course_places for insert with check (
  exists (select 1 from public.courses where id = course_id and author_id = auth.uid())
);
create policy "places_update_own" on public.course_places for update using (
  exists (select 1 from public.courses where id = course_id and author_id = auth.uid())
);
create policy "places_delete_own" on public.course_places for delete using (
  exists (select 1 from public.courses where id = course_id and author_id = auth.uid())
);

-- course_likes
create policy "likes_select_all" on public.course_likes for select using (true);
create policy "likes_insert_own" on public.course_likes for insert with check (auth.uid() = user_id);
create policy "likes_delete_own" on public.course_likes for delete using (auth.uid() = user_id);

-- comments
create policy "comments_select_all" on public.comments for select using (true);
create policy "comments_insert_user" on public.comments for insert with check (auth.uid() = author_id);
create policy "comments_delete_own" on public.comments for delete using (
  auth.uid() = author_id or
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- comment_likes
create policy "comment_likes_select_all" on public.comment_likes for select using (true);
create policy "comment_likes_insert_own" on public.comment_likes for insert with check (auth.uid() = user_id);
create policy "comment_likes_delete_own" on public.comment_likes for delete using (auth.uid() = user_id);

-- replies
create policy "replies_select_all" on public.replies for select using (true);
create policy "replies_insert_user" on public.replies for insert with check (auth.uid() = author_id);
create policy "replies_delete_own" on public.replies for delete using (
  auth.uid() = author_id or
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- reply_likes
create policy "reply_likes_select_all" on public.reply_likes for select using (true);
create policy "reply_likes_insert_own" on public.reply_likes for insert with check (auth.uid() = user_id);
create policy "reply_likes_delete_own" on public.reply_likes for delete using (auth.uid() = user_id);

-- event_logs (누구나 INSERT, admin만 DELETE)
create policy "event_logs_insert_all" on public.event_logs for insert with check (true);
create policy "event_logs_delete_admin" on public.event_logs for delete using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- ── Storage 버킷 ──────────────────────────────────────
-- Supabase 대시보드에서 "course-photos" 버킷 생성 후 Public 설정
-- Storage 정책은 대시보드 또는 아래 실행

insert into storage.buckets (id, name, public)
values ('course-photos', 'course-photos', true)
on conflict (id) do nothing;

create policy "storage_select_all" on storage.objects for select using (bucket_id = 'course-photos');
create policy "storage_insert_user" on storage.objects for insert with check (
  bucket_id = 'course-photos' and auth.uid() is not null
);
create policy "storage_delete_own" on storage.objects for delete using (
  bucket_id = 'course-photos' and auth.uid() is not null
);
