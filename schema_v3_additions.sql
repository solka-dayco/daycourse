-- =====================================================
-- 데이코스 v3 추가 스키마 마이그레이션
-- 기존 schema.sql(v2) 실행 완료 후 이 파일을 실행하세요
-- Supabase 대시보드 > SQL Editor에서 실행
-- 멱등성 보장: 이미 실행해도 오류 없음
-- =====================================================

-- ── 1. users 테이블 컬럼 추가 ────────────────────────────
alter table public.users
  add column if not exists gender              text check (gender in ('male','female','other')),
  add column if not exists birth_year          integer,   -- 출생연도 (나이 입력 시 자동 변환 저장)
  add column if not exists region              text,
  add column if not exists user_score          integer not null default 0,
  add column if not exists unread_notification_count integer not null default 0,
  add column if not exists level               integer not null default 1;

-- ── 2. courses 테이블 컬럼 추가 ──────────────────────────
-- courses 테이블: v3 신규 컬럼만 추가 (author_id 등은 기존 schema.sql에 이미 있음)
alter table public.courses
  add column if not exists comment_count  integer not null default 0,
  add column if not exists thumbnail_url  text;

-- 인덱스
create index if not exists courses_author_id_idx   on public.courses(author_id, created_at desc);
create index if not exists courses_comment_count_idx on public.courses(comment_count desc);

-- ── 3. bookmarks 테이블 ───────────────────────────────────
create table if not exists public.bookmarks (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, course_id)
);

create index if not exists bookmarks_user_id_idx on public.bookmarks(user_id, created_at desc);

-- ── 4. notifications 테이블 ──────────────────────────────
create table if not exists public.notifications (
  id              uuid primary key default uuid_generate_v4(),
  actor_user_id   uuid references public.users(id) on delete cascade,
  actor_nickname  text not null default '',
  target_user_id  uuid not null references public.users(id) on delete cascade,
  type            text not null,
  course_id       uuid references public.courses(id) on delete cascade,
  course_name     text,
  comment_id      uuid references public.comments(id) on delete set null,
  agg_count       integer not null default 1,
  is_read         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists notifications_target_user_idx on public.notifications(target_user_id, created_at desc);
create index if not exists notifications_unread_idx      on public.notifications(target_user_id, is_read) where is_read = false;

-- ── 5. reports 테이블 ────────────────────────────────────
create table if not exists public.reports (
  id                uuid primary key default uuid_generate_v4(),
  reporter_user_id  uuid not null references public.users(id) on delete cascade,
  target_type       text not null check (target_type in ('course','comment')),
  target_id         uuid not null,
  reason            text not null,
  status            text not null default 'pending' check (status in ('pending','resolved')),
  created_at        timestamptz not null default now()
);

-- ── 6. event_logs 컬럼 추가 ──────────────────────────────
alter table public.event_logs
  add column if not exists actor_user_id   uuid references public.users(id) on delete set null,
  add column if not exists target_user_id  uuid references public.users(id) on delete set null,
  add column if not exists is_read         boolean not null default false;

create index if not exists event_logs_actor_idx  on public.event_logs(actor_user_id,  created_at desc);
create index if not exists event_logs_target_idx on public.event_logs(target_user_id, created_at desc);

-- ── 7. RPC 함수 추가 ─────────────────────────────────────

-- comment_count 증감
create or replace function public.increment_comment_count(p_course_id uuid)
returns void language sql security definer as $$
  update public.courses set comment_count = comment_count + 1 where id = p_course_id;
$$;

create or replace function public.decrement_comment_count(p_course_id uuid)
returns void language sql security definer as $$
  update public.courses set comment_count = greatest(comment_count - 1, 0) where id = p_course_id;
$$;

-- 유저 점수
create or replace function public.add_user_score(p_user_id uuid, p_delta integer)
returns void language sql security definer as $$
  update public.users
  set user_score = greatest(user_score + p_delta, 0)
  where id = p_user_id;
$$;

-- 알림 upsert (aggregation 포함)
create or replace function public.upsert_notification(
  p_actor_user_id   uuid,
  p_actor_nickname  text,
  p_target_user_id  uuid,
  p_type            text,
  p_course_id       uuid default null,
  p_course_name     text default null,
  p_comment_id      uuid default null
)
returns void language plpgsql security definer as $$
declare
  existing_id uuid;
begin
  if p_actor_user_id = p_target_user_id then return; end if;

  if p_type in ('course_like', 'course_reference') then
    select id into existing_id
    from public.notifications
    where target_user_id = p_target_user_id
      and type = p_type
      and course_id = p_course_id
      and is_read = false
    order by created_at desc
    limit 1;

    if existing_id is not null then
      update public.notifications
      set agg_count      = agg_count + 1,
          actor_user_id  = p_actor_user_id,
          actor_nickname = p_actor_nickname,
          updated_at     = now()
      where id = existing_id;
    else
      insert into public.notifications
        (actor_user_id, actor_nickname, target_user_id, type, course_id, course_name, comment_id)
      values
        (p_actor_user_id, p_actor_nickname, p_target_user_id, p_type, p_course_id, p_course_name, p_comment_id);

      update public.users
      set unread_notification_count = unread_notification_count + 1
      where id = p_target_user_id;
    end if;
  else
    insert into public.notifications
      (actor_user_id, actor_nickname, target_user_id, type, course_id, course_name, comment_id)
    values
      (p_actor_user_id, p_actor_nickname, p_target_user_id, p_type, p_course_id, p_course_name, p_comment_id);

    update public.users
    set unread_notification_count = unread_notification_count + 1
    where id = p_target_user_id;
  end if;
end;
$$;

-- 알림 일괄 읽음 처리
create or replace function public.mark_notifications_read(p_user_id uuid)
returns void language sql security definer as $$
  update public.notifications set is_read = true
  where target_user_id = p_user_id and is_read = false;

  update public.users set unread_notification_count = 0
  where id = p_user_id;
$$;

-- 유저 통계
drop function if exists public.get_user_stats(uuid);
create or replace function public.get_user_stats(p_user_id uuid)
returns table (course_count bigint, total_likes bigint, total_references bigint)
language sql security definer as $$
  select
    count(*) as course_count,
    coalesce(sum(like_count), 0) as total_likes,
    coalesce(sum(reference_count), 0) as total_references
  from public.courses
  where author_id = p_user_id;
$$;

-- 좋아요한 코스 목록
drop function if exists public.get_liked_courses(uuid,integer,integer);
create or replace function public.get_liked_courses(p_user_id uuid, p_limit integer default 20, p_offset integer default 0)
returns table (
  id uuid, name text, description text,
  region_main text, region_sub text, total_time integer,
  like_count integer, comment_count integer, reference_count integer,
  author_nickname text, author_id uuid, created_at timestamptz,
  thumbnail_url text
)
language sql security definer as $$
  select c.id, c.name, c.description,
    c.region_main, c.region_sub, c.total_time,
    c.like_count, c.comment_count, c.reference_count,
    c.author_nickname, c.author_id, c.created_at,
    c.thumbnail_url
  from public.courses c
  join public.course_likes cl on cl.course_id = c.id
  where cl.user_id = p_user_id
  order by c.created_at desc
  limit p_limit offset p_offset;
$$;

-- 북마크한 코스 목록
drop function if exists public.get_bookmarked_courses(uuid,integer,integer);
create or replace function public.get_bookmarked_courses(p_user_id uuid, p_limit integer default 20, p_offset integer default 0)
returns table (
  id uuid, name text, description text,
  region_main text, region_sub text, total_time integer,
  like_count integer, comment_count integer, reference_count integer,
  author_nickname text, author_id uuid, created_at timestamptz,
  thumbnail_url text
)
language sql security definer as $$
  select c.id, c.name, c.description,
    c.region_main, c.region_sub, c.total_time,
    c.like_count, c.comment_count, c.reference_count,
    c.author_nickname, c.author_id, c.created_at,
    c.thumbnail_url
  from public.courses c
  join public.bookmarks b on b.course_id = c.id
  where b.user_id = p_user_id
  order by b.created_at desc
  limit p_limit offset p_offset;
$$;

-- 참조된 코스 목록
drop function if exists public.get_referenced_courses(uuid,integer);
create or replace function public.get_referenced_courses(p_course_id uuid, p_limit integer default 6)
returns table (
  id uuid, name text, description text,
  region_main text, region_sub text, total_time integer,
  like_count integer, comment_count integer,
  author_nickname text, created_at timestamptz,
  thumbnail_url text
)
language sql security definer as $$
  select c.id, c.name, c.description,
    c.region_main, c.region_sub, c.total_time,
    c.like_count, c.comment_count,
    c.author_nickname, c.created_at, c.thumbnail_url
  from public.courses c
  where c.parent_course_id = p_course_id
  order by c.created_at desc
  limit p_limit;
$$;

-- 검색 자동완성
drop function if exists public.autocomplete_search(text,integer);
create or replace function public.autocomplete_search(p_keyword text, p_limit integer default 5)
returns table (label text, type text)
language sql security definer as $$
  (
    select distinct name as label, 'course' as type
    from public.courses
    where lower(name) like '%' || lower(p_keyword) || '%'
    order by name
    limit p_limit
  )
  union all
  (
    select distinct cp.name as label, 'place' as type
    from public.course_places cp
    where lower(cp.name) like '%' || lower(p_keyword) || '%'
    order by cp.name
    limit p_limit
  )
  limit p_limit;
$$;

-- search_courses: 반환 타입이 변경되므로 기존 함수를 먼저 DROP
drop function if exists public.search_courses(text,text,text,integer,text,integer,integer);

-- search_courses (score 정렬 포함, v3: comment_count/author_id/thumbnail_url 추가)
create or replace function public.search_courses(
  p_keyword     text    default '',
  p_region_main text    default '',
  p_region_sub  text    default '',
  p_max_time    integer default 0,
  p_sort        text    default 'latest',
  p_offset      integer default 0,
  p_limit       integer default 20
)
returns table (
  id uuid, name text, description text,
  region_main text, region_sub text, total_time integer,
  like_count integer, comment_count integer, reference_count integer,
  author_id uuid, author_nickname text, created_at timestamptz,
  thumbnail_url text, total_count bigint
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
    select c.*, t.cnt as total_count,
      (c.like_count * 2 + c.comment_count * 3 + c.reference_count * 4) as score
    from public.courses c
    join matched m on m.id = c.id
    cross join total t
  )
  select
    r.id, r.name, r.description,
    r.region_main, r.region_sub, r.total_time,
    r.like_count, r.comment_count, r.reference_count,
    r.author_id, r.author_nickname, r.created_at,
    r.thumbnail_url, r.total_count
  from ranked r
  order by
    case p_sort
      when 'popular'    then r.score
      when 'referenced' then r.reference_count
      when 'time_asc'   then -r.total_time
      when 'time_desc'  then r.total_time
      else 0
    end desc,
    case when p_sort not in ('time_asc','time_desc') then r.created_at end desc nulls last
  limit p_limit offset p_offset;
end;
$$;

-- ── 8. 레벨 자동 계산 트리거 ─────────────────────────────
create or replace function public.update_user_level()
returns trigger language plpgsql security definer as $$
begin
  new.level := case
    when new.user_score >= 200 then 5
    when new.user_score >= 100 then 4
    when new.user_score >= 40  then 3
    when new.user_score >= 10  then 2
    else 1
  end;
  return new;
end;
$$;

drop trigger if exists on_user_score_update on public.users;
create trigger on_user_score_update
  before update of user_score on public.users
  for each row execute procedure public.update_user_level();

-- ── 9. RLS 추가 ──────────────────────────────────────────
alter table public.bookmarks      enable row level security;
alter table public.notifications  enable row level security;
alter table public.reports        enable row level security;

-- bookmarks (이미 있으면 skip)
do $$ begin
  if not exists (select 1 from pg_policies where tablename='bookmarks' and policyname='bookmarks_select_own') then
    create policy "bookmarks_select_own" on public.bookmarks for select using (auth.uid() = user_id);
    create policy "bookmarks_insert_own" on public.bookmarks for insert with check (auth.uid() = user_id);
    create policy "bookmarks_delete_own" on public.bookmarks for delete using (auth.uid() = user_id);
  end if;
end $$;

-- notifications
do $$ begin
  if not exists (select 1 from pg_policies where tablename='notifications' and policyname='notifications_select_own') then
    create policy "notifications_select_own" on public.notifications for select using (auth.uid() = target_user_id);
    create policy "notifications_update_own" on public.notifications for update using (auth.uid() = target_user_id);
  end if;
end $$;

-- reports
do $$ begin
  if not exists (select 1 from pg_policies where tablename='reports' and policyname='reports_insert_user') then
    create policy "reports_insert_user"  on public.reports for insert with check (auth.uid() = reporter_user_id);
    create policy "reports_select_admin" on public.reports for select using (
      exists (select 1 from public.users where id = auth.uid() and role = 'admin')
    );
  end if;
end $$;

-- ── 완료 ─────────────────────────────────────────────────
-- 실행 완료 후 sidebar.js의 unreadCount 라인을 아래로 변경하세요:
-- const unreadCount = user?.unread_notification_count ?? 0;

-- ── age, gender 비공개 처리 ──────────────────────────────
-- users 테이블 RLS: age, gender는 본인 또는 admin만 볼 수 있도록
-- Supabase RLS는 row 단위이므로, 컬럼 단위 비공개는 별도 view로 처리

-- 공개용 view (age, gender 제외)
create or replace view public.users_public as
  select
    id, username, nickname,
    region, user_score, level,
    unread_notification_count,
    created_at
  from public.users;

-- 본인+admin용 view (birth_year, gender 포함 — 비공개)
create or replace view public.users_private as
  select * from public.users
  where
    id = auth.uid()
    or exists (
      select 1 from public.users u2
      where u2.id = auth.uid() and u2.role = 'admin'
    );

-- ── birth_year 컬럼 제거 (이미 있는 경우) ───────────────
-- 주의: 기존 데이터가 있으면 아래 주석을 해제하고 실행하세요
-- alter table public.users drop column if exists birth_year;

-- ══════════════════════════════════════════════════════════
-- age 컬럼 자동 갱신 설정
-- ══════════════════════════════════════════════════════════

-- 1. age 컬럼 추가 (없으면)
alter table public.users
  add column if not exists age integer;

-- 2. birth_year 기반으로 age 즉시 동기화 (최초 1회)
update public.users
set age = extract(year from now())::integer - birth_year
where birth_year is not null;

-- 3. age 자동 갱신 함수
create or replace function public.refresh_user_ages()
returns void language sql security definer as $$
  update public.users
  set age = extract(year from now())::integer - birth_year
  where birth_year is not null;
$$;

-- 4. birth_year 저장 시 age 자동 동기화 트리거
create or replace function public.sync_age_from_birth_year()
returns trigger language plpgsql security definer as $$
begin
  if new.birth_year is not null then
    new.age := extract(year from now())::integer - new.birth_year;
  end if;
  return new;
end;
$$;

drop trigger if exists on_birth_year_change on public.users;
create trigger on_birth_year_change
  before insert or update of birth_year on public.users
  for each row execute procedure public.sync_age_from_birth_year();

-- 5. pg_cron으로 매년 1월 1일 00:00 자동 갱신
-- 사전 조건: Supabase 대시보드 > Database > Extensions > pg_cron 활성화
-- 활성화 후 아래 실행:
/*
select cron.schedule(
  'refresh-user-ages',       -- job 이름
  '0 0 1 1 *',               -- 매년 1월 1일 00:00 UTC
  'select public.refresh_user_ages()'
);
*/