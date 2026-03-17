// db.js — 모든 DB/Storage 접근 로직 (v4 — session_id 로깅 포함)
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

export async function signInWithKakao(redirectTo = null) {
  const options = redirectTo ? { redirectTo } : {};
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'kakao', options });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function upsertUserProfile({ id, username, nickname, gender, birth_year, region }) {
  const payload = { id, username, nickname };
  // gender, birth_year는 비공개 (RLS로 본인+admin만 조회)
  if (gender !== undefined)     payload.gender     = gender;
  if (birth_year !== undefined) payload.birth_year = birth_year;
  if (region !== undefined)     payload.region     = region;

  const { error } = await supabase.from('users').upsert(payload);
  if (error) throw error;
}

/** 유저 프로필 공개 정보 조회 (user.html 용) */
export async function fetchUserById(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, nickname, user_score, level, created_at')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

/** 유저 통계 (코스 수, 받은 좋아요, 참조 수) */
export async function fetchUserStats(userId) {
  const { data, error } = await supabase.rpc('get_user_stats', { p_user_id: userId });
  if (error) throw error;
  return data?.[0] ?? { course_count: 0, total_likes: 0, total_references: 0 };
}

// ─── 피드 / 코스 목록 ─────────────────────────────────────

/**
 * 피드 코스 목록 조회 (cursor 기반 무한스크롤 지원)
 * @param {{ keyword?, regionMain?, regionSub?, maxTime?, sort?, cursor?, pageSize? }} options
 */
export async function fetchCourses({
  keyword = '',
  regionMain = '',
  regionSub = '',
  maxTime = 0,
  sort = 'latest',
  cursor = null,     // cursor 기반 페이지네이션 (lastId or lastDate)
  page = 0,          // 오프셋 기반 fallback
  pageSize = 20,
} = {}) {
  if (!keyword) {
    let query = supabase
      .from('courses')
      .select(
        `id, name, description, region_main, region_sub, total_time,
         like_count, reference_count, thumbnail_url,
         author_id, author_nickname, created_at,
         course_places(order_index, name, photo_url)`,
        { count: 'exact' }
      )
      .neq('is_deleted', true);

    if (regionMain) query = query.eq('region_main', regionMain);
    if (regionSub)  query = query.eq('region_sub', regionSub);
    if (maxTime > 0) query = query.lte('total_time', maxTime);

    switch (sort) {
      case 'popular':    query = query.order('like_count',      { ascending: false }); break;
      case 'referenced': query = query.order('reference_count', { ascending: false }); break;
      case 'time_asc':   query = query.order('total_time',      { ascending: true  }); break;
      case 'time_desc':  query = query.order('total_time',      { ascending: false }); break;
      default:           query = query.order('created_at',      { ascending: false });
    }

    query = query.range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    return { courses: data || [], total: count || 0 };
  }

  // 키워드 있을 때 → RPC
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
    course_places: (placesMap[c.id] || []).sort((a, b) => a.order_index - b.order_index),
  }));

  return { courses, total: Number(total) };
}

/** 검색 자동완성 */
export async function autocompleteSearch(keyword) {
  if (!keyword || keyword.length < 2) return [];
  const { data, error } = await supabase.rpc('autocomplete_search', {
    p_keyword: keyword,
    p_limit: 5,
  });
  if (error) return [];
  return data || [];
}

// ─── 코스 단건 ────────────────────────────────────────────

export async function fetchCourseById(courseId) {
  const { data, error } = await supabase
    .from('courses')
    .select(`*, course_places(*)`)
    .eq('id', courseId)
    .single();
  if (error) throw error;
  if (data?.course_places) {
    data.course_places.sort((a, b) => a.order_index - b.order_index);
  }
  return data;
}

/** 유저가 만든 코스 목록 */
export async function fetchCoursesByUser(userId, { page = 0, pageSize = 20, onlyReferenced = false } = {}) {
  let query = supabase
    .from('courses')
    .select(
      `id, name, description, region_main, region_sub, total_time,
       like_count, reference_count, thumbnail_url,
       author_id, author_nickname, created_at,
       parent_course_id, course_places(order_index, name, photo_url)`,
      { count: 'exact' }
    )
    .eq('author_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (onlyReferenced) {
    query = query.not('parent_course_id', 'is', null);
  }

  query = query.range(page * pageSize, (page + 1) * pageSize - 1);
  const { data, error, count } = await query;
  if (error) throw error;
  return { courses: data || [], total: count || 0 };
}

/** 참조된 코스 목록 (상세 페이지 하단) */
export async function fetchReferencedCourses(courseId) {
  const { data, error } = await supabase.rpc('get_referenced_courses', { p_course_id: courseId });
  if (error) return [];

  // 각 코스 places 조회
  const ids = (data || []).map(c => c.id);
  if (ids.length === 0) return data || [];

  const { data: places } = await supabase
    .from('course_places')
    .select('course_id, order_index, name, photo_url')
    .in('course_id', ids);

  const placesMap = {};
  (places || []).forEach(p => {
    if (!placesMap[p.course_id]) placesMap[p.course_id] = [];
    placesMap[p.course_id].push(p);
  });

  return (data || []).map(c => ({
    ...c,
    course_places: (placesMap[c.id] || []).sort((a, b) => a.order_index - b.order_index),
  }));
}

// ─── 코스 생성 / 수정 / 삭제 ──────────────────────────────

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

  // 유저 점수 +10 (코스 작성)
  try {
    const session = await getSession();
    if (session) await supabase.rpc('add_user_score', { p_user_id: session.user.id, p_delta: 10 });
  } catch (_) {}

  return course.id;
}

export async function updateCourse(courseId, courseData, places) {
  const { error: courseErr } = await supabase
    .from('courses')
    .update(courseData)
    .eq('id', courseId);
  if (courseErr) throw courseErr;

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

export async function deleteCourse(courseId) {
  const { error } = await supabase.from('courses').delete().eq('id', courseId);
  if (error) throw error;
}

// ─── 좋아요 ───────────────────────────────────────────────

export async function isCourseLiked(courseId, userId) {
  const { data } = await supabase
    .from('course_likes')
    .select('course_id')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

export async function toggleCourseLike(courseId, userId) {
  const liked = await isCourseLiked(courseId, userId);
  if (liked) {
    await supabase.from('course_likes').delete()
      .eq('course_id', courseId).eq('user_id', userId);
    await supabase.rpc('decrement_like_count', { course_id: courseId });
    // 점수 반환
    try {
      const { data: course } = await supabase.from('courses').select('author_id').eq('id', courseId).single();
      if (course) await supabase.rpc('add_user_score', { p_user_id: course.author_id, p_delta: -1 });
    } catch (_) {}
    return false;
  } else {
    await supabase.from('course_likes').insert({ course_id: courseId, user_id: userId });
    await supabase.rpc('increment_like_count', { course_id: courseId });
    // 점수 부여 + 알림
    try {
      const { data: course } = await supabase.from('courses')
        .select('author_id, name').eq('id', courseId).single();
      if (course) {
        await supabase.rpc('add_user_score', { p_user_id: course.author_id, p_delta: 1 });
        const { data: actor } = await supabase.from('users')
          .select('nickname').eq('id', userId).single();
        await supabase.rpc('upsert_notification', {
          p_actor_user_id:  userId,
          p_actor_nickname: actor?.nickname ?? '',
          p_target_user_id: course.author_id,
          p_type:           'course_like',
          p_course_id:      courseId,
          p_course_name:    course.name,
        });
      }
    } catch (_) {}
    return true;
  }
}

// ─── 북마크 ───────────────────────────────────────────────

export async function isBookmarked(courseId, userId) {
  const { data } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

export async function toggleBookmark(courseId, userId) {
  const marked = await isBookmarked(courseId, userId);
  if (marked) {
    await supabase.from('bookmarks').delete()
      .eq('course_id', courseId).eq('user_id', userId);
    return false;
  } else {
    await supabase.from('bookmarks').insert({ course_id: courseId, user_id: userId });
    return true;
  }
}

export async function fetchBookmarkedCourses(userId, { page = 0, pageSize = 20 } = {}) {
  const { data, error } = await supabase.rpc('get_bookmarked_courses', {
    p_user_id: userId,
    p_limit:   pageSize,
    p_offset:  page * pageSize,
  });
  if (error) throw error;

  const ids = (data || []).map(c => c.id);
  if (ids.length === 0) return data || [];
  const { data: places } = await supabase
    .from('course_places')
    .select('course_id, order_index, name, photo_url')
    .in('course_id', ids);
  const map = {};
  (places || []).forEach(p => {
    if (!map[p.course_id]) map[p.course_id] = [];
    map[p.course_id].push(p);
  });
  return (data || []).map(c => ({
    ...c,
    course_places: (map[c.id] || []).sort((a, b) => a.order_index - b.order_index),
  }));
}

// ─── 좋아요한 코스 목록 ───────────────────────────────────

export async function fetchLikedCourses(userId, { page = 0, pageSize = 20 } = {}) {
  const { data, error } = await supabase.rpc('get_liked_courses', {
    p_user_id: userId,
    p_limit:   pageSize,
    p_offset:  page * pageSize,
  });
  if (error) throw error;

  const ids = (data || []).map(c => c.id);
  if (ids.length === 0) return data || [];
  const { data: places } = await supabase
    .from('course_places')
    .select('course_id, order_index, name, photo_url')
    .in('course_id', ids);
  const map = {};
  (places || []).forEach(p => {
    if (!map[p.course_id]) map[p.course_id] = [];
    map[p.course_id].push(p);
  });
  return (data || []).map(c => ({
    ...c,
    course_places: (map[c.id] || []).sort((a, b) => a.order_index - b.order_index),
  }));
}

// ─── 댓글 ─────────────────────────────────────────────────

/** 댓글 목록 + 정렬 */
export async function fetchComments(courseId, sort = 'latest') {
  const { data, error } = await supabase
    .from('comments')
    .select(`*, comment_likes(user_id), replies(*, reply_likes(user_id))`)
    .eq('course_id', courseId)
    .order('created_at', { ascending: sort !== 'latest' });
  if (error) throw error;

  let comments = (data || []).map(c => ({
    ...c,
    like_count: (c.comment_likes || []).length,
    replies: (c.replies || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
  }));

  if (sort === 'popular') {
    comments.sort((a, b) =>
      (b.like_count * 2 + (b.replies?.length || 0) * 3) -
      (a.like_count * 2 + (a.replies?.length || 0) * 3)
    );
  } else if (sort === 'likes') {
    comments.sort((a, b) => b.like_count - a.like_count);
  }

  return comments;
}

export async function addComment({ courseId, authorId, nickname, content }) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ course_id: courseId, author_id: authorId, nickname, content })
    .select('*')
    .single();
  if (error) throw error;

  // comment_count +1 + 알림
  await supabase.rpc('increment_comment_count', { p_course_id: courseId });
  try {
    await supabase.rpc('add_user_score', { p_user_id: authorId, p_delta: 2 });
    const { data: course } = await supabase.from('courses')
      .select('author_id, name').eq('id', courseId).single();
    if (course) {
      await supabase.rpc('upsert_notification', {
        p_actor_user_id:  authorId,
        p_actor_nickname: nickname,
        p_target_user_id: course.author_id,
        p_type:           'course_comment',
        p_course_id:      courseId,
        p_course_name:    course.name,
        p_comment_id:     data.id,
      });
    }
  } catch (_) {}

  return data;
}

export async function deleteComment(commentId, courseId) {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw error;
  if (courseId) await supabase.rpc('decrement_comment_count', { p_course_id: courseId });
}

export async function toggleCommentLike(commentId, userId) {
  const { data: existing } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('comment_likes').delete()
      .eq('comment_id', commentId).eq('user_id', userId);
    return false;
  } else {
    await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId });
    return true;
  }
}

// ─── 답글 ─────────────────────────────────────────────────

export async function addReply({ commentId, authorId, nickname, content }) {
  const { data, error } = await supabase
    .from('replies')
    .insert({ comment_id: commentId, author_id: authorId, nickname, content })
    .select('*')
    .single();
  if (error) throw error;

  // comment_count +1 (답글도 카운트) + 알림
  try {
    await supabase.rpc('add_user_score', { p_user_id: authorId, p_delta: 2 });
    const { data: comment } = await supabase.from('comments')
      .select('course_id, author_id').eq('id', commentId).single();
    if (comment) {
      await supabase.rpc('increment_comment_count', { p_course_id: comment.course_id });

      // 코스명 별도 조회
      const { data: courseRow } = await supabase.from('courses')
        .select('name').eq('id', comment.course_id).single();

      await supabase.rpc('upsert_notification', {
        p_actor_user_id:  authorId,
        p_actor_nickname: nickname,
        p_target_user_id: comment.author_id,
        p_type:           'comment_reply',
        p_course_id:      comment.course_id,
        p_course_name:    courseRow?.name ?? '',
        p_comment_id:     commentId,
      });
    }
  } catch (_) {}

  return data;
}

export async function deleteReply(replyId, commentId) {
  const { error } = await supabase.from('replies').delete().eq('id', replyId);
  if (error) throw error;
  // comment_count -1
  try {
    const { data: comment } = await supabase.from('comments')
      .select('course_id').eq('id', commentId).single();
    if (comment) await supabase.rpc('decrement_comment_count', { p_course_id: comment.course_id });
  } catch (_) {}
}

export async function toggleReplyLike(replyId, userId) {
  const { data: existing } = await supabase
    .from('reply_likes')
    .select('reply_id')
    .eq('reply_id', replyId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('reply_likes').delete()
      .eq('reply_id', replyId).eq('user_id', userId);
    return false;
  } else {
    await supabase.from('reply_likes').insert({ reply_id: replyId, user_id: userId });
    return true;
  }
}

// ─── 알림 ─────────────────────────────────────────────────

export async function fetchNotifications(userId, { page = 0, pageSize = 30 } = {}) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('target_user_id', userId)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);
  if (error) throw error;
  return data || [];
}

export async function markNotificationsRead(userId) {
  try {
    await supabase.rpc('mark_notifications_read', { p_user_id: userId });
  } catch (_) {}
}

// ─── 활동 내역 ────────────────────────────────────────────

export async function fetchActivityLikes(userId, { page = 0, pageSize = 20 } = {}) {
  return fetchLikedCourses(userId, { page, pageSize });
}

export async function fetchActivityBookmarks(userId, { page = 0, pageSize = 20 } = {}) {
  return fetchBookmarkedCourses(userId, { page, pageSize });
}

export async function fetchActivityMyCourses(userId, { page = 0, pageSize = 20 } = {}) {
  const { courses } = await fetchCoursesByUser(userId, { page, pageSize });
  return courses;
}

// ─── 신고 ─────────────────────────────────────────────────

export async function submitReport({ reporterUserId, targetType, targetId, reason }) {
  // 중복 신고 방지
  const { data: existing } = await supabase
    .from('reports')
    .select('id')
    .eq('reporter_user_id', reporterUserId)
    .eq('target_type', targetType)
    .eq('target_id', String(targetId))
    .maybeSingle();
  if (existing) throw new Error('이미 신고한 콘텐츠입니다');

  const { error } = await supabase.from('reports').insert({
    reporter_user_id: reporterUserId,
    target_type: targetType,
    target_id:   String(targetId),
    reason,
  });
  if (error) throw error;
}

// ─── Storage ─────────────────────────────────────────────

export async function uploadPhoto(blob, path) {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deletePhoto(path) {
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}

// ─── 행동 로그 ────────────────────────────────────────────

function getOrCreateSessionId() {
  const KEY = 'dc_session_id';
  let sid = localStorage.getItem(KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(KEY, sid);
  }
  return sid;
}

export async function logEvent(eventName, targetType = 'page', targetId = null, metadata = {}) {
  try {
    const session = await getSession();
    if (session?.user?.id) {
      const { data: u } = await supabase
        .from('users').select('role').eq('id', session.user.id).single();
      if (u?.role === 'admin') return;
    }
    const sessionId = getOrCreateSessionId();
    await supabase.from('event_logs').insert({
      user_id:     session?.user?.id ?? null,
      event_name:  eventName,
      target_type: targetType,
      target_id:   targetId,
      metadata:    { ...metadata, session_id: sessionId },
    });
  } catch (_) {}
}

// ─── 참조 코스 ───────────────────────────────────────────

export async function createReferenceCourse(courseData, places, parentCourseId) {
  const courseId = await createCourse(courseData, places);
  if (parentCourseId) {
    await supabase.rpc('increment_reference_count', { course_id: parentCourseId });
    // 알림
    try {
      const { data: parent } = await supabase.from('courses')
        .select('author_id, name').eq('id', parentCourseId).single();
      if (parent) {
        const session = await getSession();
        const { data: actor } = await supabase.from('users')
          .select('nickname').eq('id', session.user.id).single();
        await supabase.rpc('upsert_notification', {
          p_actor_user_id:  session.user.id,
          p_actor_nickname: actor?.nickname ?? '',
          p_target_user_id: parent.author_id,
          p_type:           'course_reference',
          p_course_id:      parentCourseId,
          p_course_name:    parent.name,
        });
        // 점수 부여 (참조됨)
        await supabase.rpc('add_user_score', { p_user_id: parent.author_id, p_delta: 5 });
      }
    } catch (_) {}
  }
  return courseId;
}

export async function onCourseDeleted(courseId, parentCourseId) {
  await deleteCourse(courseId);
  if (parentCourseId) {
    const { data } = await supabase.from('courses').select('id')
      .eq('id', parentCourseId).maybeSingle();
    if (data) await supabase.rpc('decrement_reference_count', { course_id: parentCourseId });
  }
}