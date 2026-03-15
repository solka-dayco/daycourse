// find.js
import { supabase } from './supabase.js';
import { initSidebar } from './sidebar.js';

initSidebar();

// 탭 전환
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

const msgEl = document.getElementById('authMsg');
function showMsg(text, type = 'error') { msgEl.textContent = text; msgEl.className = `auth-msg ${type}`; }
function clearMsg() { msgEl.className = 'auth-msg'; msgEl.textContent = ''; }

// 아이디 찾기 — nickname으로 users 테이블 조회
document.getElementById('findIdBtn').addEventListener('click', async () => {
  clearMsg();
  const nickname = document.getElementById('findNickname').value.trim();
  if (!nickname) { showMsg('닉네임을 입력해주세요.'); return; }

  const { data, error } = await supabase
    .from('users')
    .select('username')
    .eq('nickname', nickname)
    .maybeSingle();

  if (error || !data) {
    showMsg('해당 닉네임으로 가입된 계정을 찾을 수 없습니다.');
    return;
  }
  const el = document.getElementById('foundId');
  el.textContent = `아이디: ${data.username}`;
  el.style.display = 'block';
});

// 비밀번호 재설정
document.getElementById('resetPwBtn').addEventListener('click', async () => {
  clearMsg();
  const username = document.getElementById('resetUsername').value.trim();
  if (!username) { showMsg('아이디를 입력해주세요.'); return; }

  const email = `${username}@daycourse.internal`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/login.html`,
  });
  if (error) { showMsg('요청 실패: ' + error.message); return; }
  showMsg('재설정 링크를 이메일로 발송했습니다.', 'success');
});
