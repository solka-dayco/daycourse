// login.js — 로그인 / 회원가입 (Supabase Auth)
import { supabase } from './supabase.js';
import { upsertUserProfile } from './db.js';
import { initSidebar } from './sidebar.js';

initSidebar();

// ── 탭 전환 ──────────────────────────────────────────
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${target}`).classList.add('active');
    clearMsg();
  });
});

// ── 메시지 ───────────────────────────────────────────
const msgEl = document.getElementById('authMsg');
function showMsg(text, type = 'error') {
  msgEl.textContent = text;
  msgEl.className = `auth-msg ${type}`;
}
function clearMsg() {
  msgEl.className = 'auth-msg';
  msgEl.textContent = '';
}

// ── 카카오 로그인 (추후 구현) ─────────────────────────
// document.getElementById('kakaoLoginBtn').addEventListener('click', async () => {
//   try {
//     await signInWithKakao(`${location.origin}/main.html`);
//   } catch (e) {
//     showMsg('카카오 로그인 실패: ' + e.message);
//   }
// });

// ── 로그인 ────────────────────────────────────────────
document.getElementById('loginBtn').addEventListener('click', async () => {
  clearMsg();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!username || !password) { showMsg('아이디와 비밀번호를 입력해주세요.'); return; }

  const email = `${username}@daycourse.com`;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showMsg('아이디 또는 비밀번호가 틀렸습니다.');
    return;
  }
  location.href = 'main.html';
});

// ── 회원가입 ──────────────────────────────────────────
document.getElementById('signupBtn').addEventListener('click', async () => {
  clearMsg();
  const username = document.getElementById('signupUsername').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm  = document.getElementById('signupPasswordConfirm').value;

  // 유효성 검사
  let valid = true;
  function setErr(id, msg) {
    const el = document.getElementById(id);
    if (msg) { el.textContent = msg; el.classList.add('show'); valid = false; }
    else { el.textContent = ''; el.classList.remove('show'); }
  }

  setErr('errUsername', /^[a-z0-9]{4,20}$/.test(username) ? '' : '영문 소문자/숫자 4~20자');
  setErr('errPassword', password.length >= 6 ? '' : '6자 이상 입력');
  setErr('errPasswordConfirm', password === confirm ? '' : '비밀번호가 일치하지 않습니다');
  if (!valid) return;

  const email = `${username}@daycourse.com`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) {
    showMsg(error.message.includes('already') ? '이미 사용 중인 아이디입니다.' : error.message);
    return;
  }

  // users 테이블에 프로필 저장
  if (data.user) {
    await upsertUserProfile({ id: data.user.id, username, nickname: username });
  }

  // 자동 로그인 후 닉네임 설정 페이지로
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    showMsg('가입 완료! 로그인해주세요.', 'success');
    document.querySelectorAll('.auth-tab')[0].click();
    return;
  }
  location.href = 'nickname.html';
});

// ── Enter 키 지원 ────────────────────────────────────
document.getElementById('loginPassword').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('loginBtn').click();
});
document.getElementById('signupPasswordConfirm').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('signupBtn').click();
});

// ── hash로 탭 선택 (#signup) ──────────────────────────
if (location.hash === '#signup') {
  document.querySelectorAll('.auth-tab')[1]?.click();
}

// ── 이미 로그인된 경우 ────────────────────────────────
(async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session) location.href = 'main.html';
})();