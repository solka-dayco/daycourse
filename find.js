// find.js — 아이디/비밀번호 찾기
import { supabase } from './supabase.js';

// ── 탭 전환 ──────────────────────────────────────────────
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    clearAllMsg();
  });
});

// ── 비밀번호 표시 토글 ────────────────────────────────────
document.querySelectorAll('.toggle-password').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.textContent = isText ? '👁' : '🙈';
  });
});

function showMsg(id, text, type = 'error') {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = `auth-msg ${type}`;
}
function clearAllMsg() {
  ['findIdMsg','findPwMsg'].forEach(id => {
    const el = document.getElementById(id);
    el.className = 'auth-msg'; el.textContent = '';
  });
}
function setFieldErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('show', !!msg);
}

// ── 아이디 찾기 ──────────────────────────────────────────
document.getElementById('findIdBtn').addEventListener('click', async () => {
  const nickname = document.getElementById('findNickname').value.trim();
  if (!nickname) { showMsg('findIdMsg', '닉네임을 입력해주세요.'); return; }

  const btn = document.getElementById('findIdBtn');
  btn.disabled = true; btn.textContent = '조회 중…';

  try {
    const { data, error } = await supabase
      .from('users')
      .select('username')
      .eq('nickname', nickname)
      .maybeSingle();

    if (error || !data) {
      showMsg('findIdMsg', '해당 닉네임으로 가입된 계정을 찾을 수 없습니다.');
      document.getElementById('findIdResult').style.display = 'none';
      return;
    }

    // 아이디 일부 마스킹 (보안)
    const username = data.username;
    const masked = username.length <= 3
      ? username[0] + '*'.repeat(username.length - 1)
      : username.slice(0, 2) + '*'.repeat(username.length - 3) + username.slice(-1);

    document.getElementById('foundUsername').textContent = masked;
    document.getElementById('findIdResult').style.display = '';
    document.getElementById('findIdMsg').className = 'auth-msg';
  } finally {
    btn.disabled = false; btn.textContent = '아이디 찾기';
  }
});

document.getElementById('findNickname').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('findIdBtn').click();
});

// ── 비밀번호 재설정 ───────────────────────────────────────
let foundUserId = null;

document.getElementById('verifyUsernameBtn').addEventListener('click', async () => {
  const username = document.getElementById('pwUsername').value.trim();
  if (!username) { showMsg('findPwMsg', '아이디를 입력해주세요.'); return; }

  const btn = document.getElementById('verifyUsernameBtn');
  btn.disabled = true; btn.textContent = '확인 중…';

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (error || !data) {
      showMsg('findPwMsg', '해당 아이디로 가입된 계정을 찾을 수 없습니다.');
      return;
    }

    foundUserId = data.id;
    document.getElementById('stepUsername').style.display = 'none';
    document.getElementById('stepNewPw').style.display = '';
    showMsg('findPwMsg', '아이디 확인 완료! 새 비밀번호를 입력하세요.', 'success');
  } finally {
    btn.disabled = false; btn.textContent = '확인';
  }
});

document.getElementById('pwUsername').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('verifyUsernameBtn').click();
});

document.getElementById('resetPwBtn').addEventListener('click', async () => {
  if (!foundUserId) return;

  const newPw      = document.getElementById('newPassword').value;
  const newPwConf  = document.getElementById('newPasswordConfirm').value;

  let valid = true;
  if (newPw.length < 6) {
    setFieldErr('errNewPw', '비밀번호는 6자 이상이어야 합니다');
    valid = false;
  } else { setFieldErr('errNewPw', ''); }

  if (newPw !== newPwConf) {
    setFieldErr('errNewPwConfirm', '비밀번호가 일치하지 않습니다');
    valid = false;
  } else { setFieldErr('errNewPwConfirm', ''); }

  if (!valid) return;

  const btn = document.getElementById('resetPwBtn');
  btn.disabled = true; btn.textContent = '변경 중…';

  try {
    // Supabase Admin API 없이 직접 비밀번호 변경은
    // 현재 세션(로그인된 사용자)만 가능 → 임시 로그인 후 변경 방식 사용
    const { data: userRow } = await supabase
      .from('users')
      .select('username')
      .eq('id', foundUserId)
      .single();

    if (!userRow) { showMsg('findPwMsg', '계정 정보를 찾을 수 없습니다.'); return; }

    // 임시: 사용자가 현재 로그인된 상태라면 updateUser 사용
    const { data: session } = await supabase.auth.getSession();
    if (session.session?.user?.id === foundUserId) {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) { showMsg('findPwMsg', '비밀번호 변경 실패: ' + error.message); return; }
      showMsg('findPwMsg', '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.', 'success');
      setTimeout(() => { location.href = 'login.html'; }, 2000);
    } else {
      // 비로그인 상태 — 가이드 안내
      showMsg('findPwMsg', '보안상 현재 로그인된 상태에서만 비밀번호를 변경할 수 있습니다. 로그인 후 다시 시도해주세요.', 'error');
    }
  } finally {
    btn.disabled = false; btn.textContent = '비밀번호 변경';
  }
});
