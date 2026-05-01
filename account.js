// account.js — 계정 관리 페이지
import { supabase } from './supabase.js';
import { initSidebar } from './sidebar.js';
import { initIcons, initSidebarIcons } from './icons.js';

initSidebar();
initIcons();
initSidebarIcons();

// 로그인 체크
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) {
  location.replace('/login?redirect=/account');
}

const session = sessionData.session;
const provider = session?.user?.app_metadata?.provider ?? 'email';

// 제공자 설명
const providerDesc = document.getElementById('accountProviderDesc');
if (providerDesc) {
  providerDesc.textContent = provider === 'google'
    ? '구글 계정으로 로그인 중입니다.'
    : '이메일 계정으로 로그인 중입니다.';
}

// ── 계정 전환 ─────────────────────────────────────────────
document.getElementById('switchAccountBtn')?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.href = '/login';
});

// ── 회원탈퇴 모달 ─────────────────────────────────────────
const deleteModal   = document.getElementById('deleteModal');
const deleteMsg     = document.getElementById('deleteMsg');
const deleteConfirm = document.getElementById('deleteConfirmBtn');

document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
  deleteModal.style.display = 'flex';
});

document.getElementById('deleteCancelBtn')?.addEventListener('click', () => {
  deleteModal.style.display = 'none';
  deleteMsg.style.display = 'none';
});

deleteConfirm?.addEventListener('click', async () => {
  deleteConfirm.disabled = true;
  deleteConfirm.textContent = '처리 중…';
  deleteMsg.style.display = 'none';

  try {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    await supabase.auth.signOut();
    location.href = '/?withdrawn=1';
  } catch (e) {
    deleteMsg.textContent = '탈퇴 처리 중 오류가 발생했습니다: ' + e.message;
    deleteMsg.style.display = 'block';
    deleteConfirm.disabled = false;
    deleteConfirm.textContent = '탈퇴하기';
  }
});
