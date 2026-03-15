// db.js — 모든 DB/Storage 접근 로직
// Supabase 전환 시 이 파일만 수정하면 됩니다.

import { supabase } from './supabase.js';
import { STORAGE_BUCKET } from './config.js';

// ─── 유틸 ────────────────────────────────────────────────

/** 현재 로그인된 Supabase 세션 반환 */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** 현재 로그인된 user 프로필 (users 테이블) 반환 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();
  if (error) return null;
  return data;
}

// ─── 인증 ────────────────────────────────────────────────

/**
 * 카카오 OAuth 로그인
 * redirectTo: 로그인 후 돌아올 URL
 * 이메일 필요없음 옵션 추가
 */
export async function signInWithKakao(redirectTo = null) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: redirectTo ?? undefined,
      scopes: 'profile_nickname profile_image',
      queryParams: {
        scope: 'profile_nickname profile_image',
      },
    },
  });
  if (error) throw error;
}

/** 로그아웃 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * 회원가입 후 users 테이블에 프로필 upsert
 * Supabase Auth trigger로 자동 생성되지 않을 경우 수동 호출
 */
export async function upsertUserProfile({ id, username, nickname }) {
  const { error } = await supabase.from('users').upsert({
    id,
    username,
    nickname,
  });
  if (error) throw error;
}

// ─── 피드 / 코스 목록 ─────────────────────────────────────

/**
 * 피드 코스 목록 조회 (키워드는 코스명/소개글/장소명/주소 모두 검색)
 * @param {{ keyword?, regionMain?, regionSub?, maxTime?, sort?, page?, pageSize? }} options
 */
export async function fetchCourses({
  keyword = '',
  regionMain = '',
  regionSub = '',
  maxTime = 0,
  sort = 'latest',
  page = 0,
  pageSize = 12,
} = {}) {
  // 키워드 없을 때는 빠른 직접 쿼리 사용
  if (!keyword) {
    let query = supabase
      .from('courses')
      .select(
        `id, name, description, region_main, region_sub, total_time,
         like_count, reference_count, author_nickname, created_at,
         course_places(order_index, name, photo_url)`,
        { count: 'exact' }
      );

    if (regionMain) query = query.eq('region_main', regionMain);
    if (regionSub)  query = query.eq('region_sub', regionSub);
    if (maxTime > 0) query = query.lte('total_time', maxTime);

    switch (sort) {
      case 'popular':    query = query.order('like_count',        { ascending: false }); break;
      case 'referenced': query = query.order('reference_count',   { ascending: false }); break;
      case 'time_asc':   query = query.order('total_time',        { ascending: true  }); break;
      case 'time_desc':  query = query.order('total_time',        { ascending: false }); break;
      default:           query = query.order('created_at',        { ascending: false });
    }

    query = query.range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    return { courses: data || [], total: count || 0 };
  }

  // 키워드 있을 때 → RPC (장소명/주소까지 검색)
  const { data, error } = await supabase.rpc('search_courses', {
    p_keyword:     keyword,
    p_region_main: regionMain,
    p_region_sub:  regionSub,
    p_max_time:    maxTime,
    p_sort:        sort,
    p_offset:      page * pageSize,
    p_limit:       pageSize,
  });
  if (error) throw error;

  const total = data?.[0]?.total_count ?? 0;

  // 각 코스의 places 별도 조회 (RPC 결과에 places 없음)
  const courseIds = (data || []).map(c => c.id);
  let placesMap = {};
  if (courseIds.length > 0) {
    const { data: places } = await supabase
      .from('course_places')
      .select('course_id, order_index, name, photo_url')
      .in('course_id', courseIds);
    (places || []).forEach(p => {
      if (!placesMap[p.course_id]) placesMap[p.course_id] = [];
      placesMap[p.course_id].push(p);
    });
  }

  const courses = (data || []).map(c => ({
    ...c,
    course_places: (placesMap[c.id] || []).sort((a,b) => a.order_index - b.order_index),
  }));

  return { courses, total: Number(total) };
}

// ─── 코스 단건 ────────────────────────────────────────────

/** 코스 상세 + 장소 목록 반환 */
export async function fetchCourseById(courseId) {
  const { data, error } = await supabase
    .from('courses')
    .select(`*, course_places(*)`)
    .eq('id', courseId)
    .single();
  if (error) throw error;
  // 클라이언트 정렬
  if (data?.course_places) {
    data.course_places.sort((a, b) => a.order_index - b.order_index);
  }
  return data;
}

// ─── 코스 생성 / 수정 / 삭제 ──────────────────────────────

/**
 * 코스 저장 (INSERT)
 * @param {object} courseData - courses 테이블 컬럼값
 * @param {Array}  places     - course_places 배열
 * @returns {string} 생성된 courseId
 */
export async function createCourse(courseData, places) {
  const { data: course, error: courseErr } = await supabase
    .from('courses')
    .insert(courseData)
    .select('id')
    .single();
  if (courseErr) throw courseErr;

  if (places && places.length > 0) {
    const placeRows = places.map((p, i) => ({ ...p, course_id: course.id, order_index: i }));
    const { error: placeErr } = await supabase.from('course_places').insert(placeRows);
    if (placeErr) throw placeErr;
  }

  return course.id;
}

/**
 * 코스 수정 (UPDATE)
 * @param {string} courseId
 * @param {object} courseData - 변경할 courses 컬럼값
 * @param {Array}  places     - 전체 course_places 배열 (기존 삭제 후 재삽입)
 */
export async function updateCourse(courseId, courseData, places) {
  const { error: courseErr } = await supabase
    .from('courses')
    .update(courseData)
    .eq('id', courseId);
  if (courseErr) throw courseErr;

  // 기존 장소 전체 삭제 후 재삽입
  const { error: delErr } = await supabase
    .from('course_places')
    .delete()
    .eq('course_id', courseId);
  if (delErr) throw delErr;

  if (places && places.length > 0) {
    const placeRows = places.map((p, i) => ({ ...p, course_id: courseId, order_index: i }));
    const { error: placeErr } = await supabase.from('course_places').insert(placeRows);
    if (placeErr) throw placeErr;
  }
}

/**
 * 코스 삭제
 * RLS: 작성자 본인만 가능
 */
export async function deleteCourse(courseId) {
  // course_places는 ON DELETE CASCADE로 자동 삭제 (SQL 스키마에서 설정)
  const { error } = await supabase.from('courses').delete().eq('id', courseId);
  if (error) throw error;
}

// ─── 좋아요 ───────────────────────────────────────────────

/** 코스 좋아요 여부 확인 */
export async function isCourseLiked(courseId, userId) {
  const { data } = await supabase
    .from('course_likes')
    .select('course_id')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

/** 코스 좋아요 토글 (INSERT / DELETE + like_count 업데이트) */
export async function toggleCourseLike(courseId, userId) {
  const liked = await isCourseLiked(courseId, userId);
  if (liked) {
    await supabase
      .from('course_likes')
      .delete()
      .eq('course_id', courseId)
      .eq('user_id', userId);
    await supabase.rpc('decrement_like_count', { course_id: courseId });
    return false;
  } else {
    await supabase.from('course_likes').insert({ course_id: courseId, user_id: userId });
    await supabase.rpc('increment_like_count', { course_id: courseId });
    return true;
  }
}

// ─── 댓글 ─────────────────────────────────────────────────

/** 코스 댓글 목록 (replies + 좋아요 포함) */
export async function fetchComments(courseId) {
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      comment_likes(user_id),
      replies(*, reply_likes(user_id))
    `)
    .eq('course_id', courseId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  // 클라이언트 정렬
  return (data || []).map(c => ({
    ...c,
    replies: (c.replies || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
  }));
}

/** 댓글 추가 */
export async function addComment({ courseId, authorId, nickname, content }) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ course_id: courseId, author_id: authorId, nickname, content })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** 댓글 삭제 */
export async function deleteComment(commentId) {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw error;
}

/** 댓글 좋아요 토글 */
export async function toggleCommentLike(commentId, userId) {
  const { data: existing } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);
    return false;
  } else {
    await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId });
    return true;
  }
}

// ─── 답글 ─────────────────────────────────────────────────

/** 답글 추가 */
export async function addReply({ commentId, authorId, nickname, content }) {
  const { data, error } = await supabase
    .from('replies')
    .insert({ comment_id: commentId, author_id: authorId, nickname, content })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** 답글 삭제 */
export async function deleteReply(replyId) {
  const { error } = await supabase.from('replies').delete().eq('id', replyId);
  if (error) throw error;
}

/** 답글 좋아요 토글 */
export async function toggleReplyLike(replyId, userId) {
  const { data: existing } = await supabase
    .from('reply_likes')
    .select('reply_id')
    .eq('reply_id', replyId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('reply_likes')
      .delete()
      .eq('reply_id', replyId)
      .eq('user_id', userId);
    return false;
  } else {
    await supabase.from('reply_likes').insert({ reply_id: replyId, user_id: userId });
    return true;
  }
}

// ─── Storage (사진 업로드) ────────────────────────────────

/**
 * Blob → Supabase Storage 업로드, 공개 URL 반환
 * @param {Blob} blob
 * @param {string} path - 버킷 내 경로 (예: "course123/place0.webp")
 * @returns {string} 공개 URL
 */
export async function uploadPhoto(blob, path) {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Storage 파일 삭제 */
export async function deletePhoto(path) {
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}

// ─── 행동 로그 ────────────────────────────────────────────

/**
 * 이벤트 로그 기록
 * @param {string} eventName
 * @param {string} targetType
 * @param {string|null} targetId
 * @param {object} metadata
 */
export async function logEvent(eventName, targetType = 'page', targetId = null, metadata = {}) {
  try {
    const session = await getSession();
    await supabase.from('event_logs').insert({
      user_id: session?.user?.id ?? null,
      event_name: eventName,
      target_type: targetType,
      target_id: targetId,
      metadata,
    });
  } catch (_) {
    // 로그 실패는 무시
  }
}

// ─── 참조 코스 ───────────────────────────────────────────

/** 참조 코스 생성 (parent reference_count +1) */
export async function createReferenceCourse(courseData, places, parentCourseId) {
  const courseId = await createCourse(courseData, places);
  // parent reference_count +1
  if (parentCourseId) {
    await supabase.rpc('increment_reference_count', { course_id: parentCourseId });
  }
  return courseId;
}

/** 코스 삭제 시 parent reference_count -1 */
export async function onCourseDeleted(courseId, parentCourseId) {
  await deleteCourse(courseId);
  if (parentCourseId) {
    // parent가 아직 존재하는지 확인 후 감소
    const { data } = await supabase
      .from('courses')
      .select('id')
      .eq('id', parentCourseId)
      .maybeSingle();
    if (data) {
      await supabase.rpc('decrement_reference_count', { course_id: parentCourseId });
    }
  }
}
