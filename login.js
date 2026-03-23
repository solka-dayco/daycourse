// login.js — 로그인 / 회원가입 (v3)
import { supabase } from './supabase.js';
import { upsertUserProfile, logEvent } from './db.js';

// ── 이미 로그인된 경우 리다이렉트 ────────────────────────
(async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    const redirectTo = new URLSearchParams(location.search).get('redirect');
    location.href = redirectTo || '/';
  }
})();

// ── 탭 전환 ──────────────────────────────────────────────
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${target}`).classList.add('active');
    clearAllMsg();
  });
});

// hash로 탭 선택
logEvent('page_view', 'page', null, { page: 'login' });

if (location.hash === '#signup') {
  document.querySelectorAll('.auth-tab')[1]?.click();
}

// ── 비밀번호 표시 토글 ────────────────────────────────────
document.querySelectorAll('.toggle-password').forEach(btn => {
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.innerHTML = isText ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>` : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  });
});

// ── 메시지 헬퍼 ──────────────────────────────────────────
function showMsg(id, text, type = 'error') {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = `auth-msg ${type}`;
}
function clearAllMsg() {
  ['loginMsg','signupMsg'].forEach(id => {
    const el = document.getElementById(id);
    el.className = 'auth-msg';
    el.textContent = '';
  });
  ['errUsername','errPassword','errPasswordConfirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.classList.remove('show'); }
  });
}

function setFieldErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('show', !!msg);
  const input = el.previousElementSibling?.querySelector?.('input')
    || el.previousElementSibling;
  input?.classList.toggle('error', !!msg);
}

// ── 로그인 ────────────────────────────────────────────────
const loginBtn = document.getElementById('loginBtn');
loginBtn.addEventListener('click', handleLogin);
document.getElementById('loginPassword').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleLogin();
});
document.getElementById('loginUsername').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('loginPassword').focus();
});

async function handleLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!username || !password) {
    showMsg('loginMsg', '아이디와 비밀번호를 입력해주세요.');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = '로그인 중…';

  try {
    const email = `${username}@daycourse.com`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      showMsg('loginMsg', '아이디 또는 비밀번호가 틀렸습니다.');
      return;
    }

    const redirectTo = new URLSearchParams(location.search).get('redirect');
    location.href = redirectTo || '/';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = '로그인';
  }
}

// ── 회원가입 ──────────────────────────────────────────────
const signupBtn = document.getElementById('signupBtn');
signupBtn.addEventListener('click', handleSignup);
document.getElementById('signupPasswordConfirm').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleSignup();
});

async function handleSignup() {
  clearAllMsg();
  const username = document.getElementById('signupUsername').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm  = document.getElementById('signupPasswordConfirm').value;
  const agreed   = document.getElementById('agreeCheck').checked;

  // 유효성 검사
  let valid = true;

  if (!/^[a-z0-9]{4,20}$/.test(username)) {
    setFieldErr('errUsername', '영문 소문자와 숫자만, 4~20자');
    valid = false;
  } else {
    setFieldErr('errUsername', '');
  }

  if (password.length < 6) {
    setFieldErr('errPassword', '비밀번호는 6자 이상이어야 합니다');
    valid = false;
  } else {
    setFieldErr('errPassword', '');
  }

  if (password !== confirm) {
    setFieldErr('errPasswordConfirm', '비밀번호가 일치하지 않습니다');
    valid = false;
  } else {
    setFieldErr('errPasswordConfirm', '');
  }

  if (!agreed) {
    showMsg('signupMsg', '개인정보처리방침에 동의해주세요.');
    valid = false;
  }

  if (!valid) return;

  signupBtn.disabled = true;
  signupBtn.textContent = '가입 중…';

  try {
    const email = `${username}@daycourse.com`;

    // 중복 아이디 체크
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      showMsg('signupMsg', '이미 사용 중인 아이디입니다.');
      return;
    }

    // 회원가입
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    if (error) {
      const msg = error.message.includes('already') || error.message.includes('User already')
        ? '이미 사용 중인 아이디입니다.'
        : error.message.includes('rate limit')
        ? '잠시 후 다시 시도해주세요.'
        : '회원가입 실패: ' + error.message;
      showMsg('signupMsg', msg);
      return;
    }

    // users 테이블 프로필 저장 (트리거 fallback)
    if (data.user) {
      await upsertUserProfile({ id: data.user.id, username, nickname: username });
    }

    // 자동 로그인
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      showMsg('signupMsg', '가입 완료! 로그인 탭에서 로그인해주세요.', 'success');
      document.querySelectorAll('.auth-tab')[0].click();
      return;
    }

    // 닉네임 설정 페이지로
    location.href = '/nickname';
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = '회원가입';
  }
}

// ── 카카오 로그인 (활성화 시 주석 해제) ──────────────────
// document.getElementById('kakaoLoginBtn')?.addEventListener('click', async () => {
//   const { signInWithKakao } = await import('./db.js');
//   try {
//     await signInWithKakao(`${location.origin}/`);
//   } catch (e) {
//     showMsg('loginMsg', '카카오 로그인 실패: ' + e.message);
//   }
// });