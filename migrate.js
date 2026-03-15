/**
 * migrate.js — Firestore v1 → Supabase v2 마이그레이션 스크립트
 *
 * 실행 환경: Node.js 18+
 * 실행 전 설치:
 *   npm install firebase-admin @supabase/supabase-js node-fetch
 *
 * 실행 방법:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=your_service_role_key \
 *   FIREBASE_CREDENTIAL=./serviceAccountKey.json \
 *   node migrate.js
 *
 * ⚠️  service_role key 사용 (RLS 우회) — 절대 클라이언트에 노출 금지
 */

import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import fetch from 'node-fetch';

// ── 환경 변수 ─────────────────────────────────────────
const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FIREBASE_CREDENTIAL  = process.env.FIREBASE_CREDENTIAL || './serviceAccountKey.json';
const STORAGE_BUCKET       = 'course-photos';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('환경 변수 SUPABASE_URL, SUPABASE_SERVICE_KEY가 필요합니다.');
  process.exit(1);
}

// ── 클라이언트 초기화 ────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const serviceAccount = JSON.parse(readFileSync(FIREBASE_CREDENTIAL, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── 유틸 ─────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function base64ToBuffer(base64str) {
  // data:image/...;base64, 제거
  const b64 = base64str.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(b64, 'base64');
}

async function uploadBase64Photo(base64str, path) {
  const buf = await base64ToBuffer(base64str);
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, buf, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ── 사용자 마이그레이션 ───────────────────────────────
async function migrateUsers() {
  console.log('\n[1/3] 사용자 마이그레이션 시작…');
  const snapshot = await db.collection('users').get();
  let ok = 0, fail = 0;

  for (const doc of snapshot.docs) {
    const u = doc.data();
    try {
      // Supabase Auth 계정 생성 (이메일 = username@daycourse.internal)
      const email = `${u.username}@daycourse.internal`;
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        // 임시 비밀번호 — 사용자에게 재설정 안내 필요
        password: `tmp_${doc.id.slice(0, 8)}`,
        email_confirm: true,
        user_metadata: { username: u.username, nickname: u.nickname },
      });
      if (authErr && !authErr.message.includes('already')) throw authErr;

      const uid = authData?.user?.id || doc.id;

      // users 테이블 upsert
      await supabase.from('users').upsert({
        id:         uid,
        username:   u.username,
        nickname:   u.nickname,
        created_at: u.createdAt
          ? new Date(u.createdAt).toISOString()
          : new Date().toISOString(),
      });

      ok++;
      console.log(`  ✓ ${u.username} (${u.nickname})`);
    } catch (e) {
      fail++;
      console.error(`  ✗ ${u.username}: ${e.message}`);
    }
    await sleep(100); // rate limit 방지
  }
  console.log(`  완료: 성공 ${ok}, 실패 ${fail}`);
}

// ── 코스 마이그레이션 ─────────────────────────────────
async function migrateCourses() {
  console.log('\n[2/3] 코스 마이그레이션 시작…');
  const snapshot = await db.collection('courses').get();
  let ok = 0, fail = 0;

  for (const doc of snapshot.docs) {
    const c = doc.data();
    try {
      // 작성자 users 테이블 ID 조회
      let authorId = null;
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('username', c.authorId)  // Firestore authorId = username
        .maybeSingle();
      authorId = userRow?.id;
      if (!authorId) {
        console.warn(`  ⚠ 코스 "${c.name}" — 작성자(${c.authorId}) 없음, 스킵`);
        fail++;
        continue;
      }

      // 사진 업로드 (최대 4장 base64 → Storage)
      const photos = c.photos || [];
      const photoUrls = [];
      for (let i = 0; i < photos.length; i++) {
        if (!photos[i]) continue;
        try {
          const url = await uploadBase64Photo(photos[i], `migrated/${doc.id}/photo${i}.jpg`);
          photoUrls.push(url);
        } catch (e) {
          console.warn(`    사진 업로드 실패 (${doc.id} #${i}): ${e.message}`);
        }
      }

      // courses INSERT
      const { data: course, error: courseErr } = await supabase
        .from('courses')
        .insert({
          name:            c.name || '제목 없음',
          description:     null,
          region_main:     '',
          region_sub:      '',
          total_time:      0,
          like_count:      c.likes || 0,
          reference_count: 0,
          author_id:       authorId,
          author_nickname: c.authorNickname || '',
          created_at:      c.createdAt
            ? new Date(c.createdAt.replace(/\. /g, '-').replace('.', '')).toISOString()
            : new Date().toISOString(),
        })
        .select('id')
        .single();
      if (courseErr) throw courseErr;

      // course_places INSERT
      const places = c.places || [];
      if (places.length > 0) {
        const placeRows = places.map((p, i) => ({
          course_id:   course.id,
          order_index: i,
          name:        p.name || '',
          lat:         p.lat  || 0,
          lng:         p.lng  || 0,
          photo_url:   photoUrls[i] || null,
        }));
        const { error: placeErr } = await supabase.from('course_places').insert(placeRows);
        if (placeErr) console.warn(`    장소 삽입 경고: ${placeErr.message}`);
      }

      ok++;
      console.log(`  ✓ "${c.name}" (${places.length}곳, 사진 ${photoUrls.length}장)`);
    } catch (e) {
      fail++;
      console.error(`  ✗ "${c.name || doc.id}": ${e.message}`);
    }
    await sleep(150);
  }
  console.log(`  완료: 성공 ${ok}, 실패 ${fail}`);
}

// ── 댓글 마이그레이션 ─────────────────────────────────
async function migrateComments() {
  console.log('\n[3/3] 댓글 마이그레이션 시작…');
  const coursesSnap = await db.collection('courses').get();
  let ok = 0, fail = 0;

  for (const courseDoc of coursesSnap.docs) {
    // Supabase에서 대응 코스 찾기 (name + author_nickname으로 매핑)
    const c = courseDoc.data();
    const { data: courseRow } = await supabase
      .from('courses')
      .select('id')
      .eq('name', c.name || '')
      .eq('author_nickname', c.authorNickname || '')
      .maybeSingle();
    if (!courseRow) continue;

    const commentsSnap = await courseDoc.ref.collection('comments').get();
    for (const commentDoc of commentsSnap.docs) {
      const cm = commentDoc.data();
      try {
        // 작성자 ID 조회
        const { data: userRow } = await supabase
          .from('users')
          .select('id')
          .eq('nickname', cm.nickname || '')
          .maybeSingle();
        const authorId = userRow?.id;
        if (!authorId) continue;

        const { data: comment, error: cmErr } = await supabase
          .from('comments')
          .insert({
            course_id: courseRow.id,
            author_id: authorId,
            nickname:  cm.nickname || '',
            content:   cm.content  || '',
            created_at: cm.createdAt?.toDate
              ? cm.createdAt.toDate().toISOString()
              : new Date().toISOString(),
          })
          .select('id')
          .single();
        if (cmErr) throw cmErr;

        // 답글
        const replies = cm.replies || [];
        for (const r of replies) {
          const { data: rUserRow } = await supabase
            .from('users')
            .select('id')
            .eq('nickname', r.nickname || '')
            .maybeSingle();
          if (!rUserRow) continue;
          await supabase.from('replies').insert({
            comment_id: comment.id,
            author_id:  rUserRow.id,
            nickname:   r.nickname || '',
            content:    r.content  || '',
            created_at: r.createdAt?.toDate
              ? r.createdAt.toDate().toISOString()
              : new Date().toISOString(),
          });
        }
        ok++;
      } catch (e) {
        fail++;
        console.error(`  댓글 오류: ${e.message}`);
      }
      await sleep(80);
    }
  }
  console.log(`  완료: 성공 ${ok}, 실패 ${fail}`);
}

// ── 실행 ─────────────────────────────────────────────
(async () => {
  console.log('=== 데이코스 Firestore → Supabase 마이그레이션 ===');
  await migrateUsers();
  await migrateCourses();
  await migrateComments();
  console.log('\n✅ 마이그레이션 완료');
  process.exit(0);
})();
