// nickname.js — 회원가입 후 프로필 설정
import { supabase } from './supabase.js';

// 로그인 안 된 경우 로그인 페이지로
const { data: { session } } = await supabase.auth.getSession();
if (!session) location.replace('login.html');

const msgEl      = document.getElementById('authMsg');
const input      = document.getElementById('nicknameInput');
const errEl      = document.getElementById('errNickname');
const confirmBtn = document.getElementById('confirmBtn');

// 입력창 포커스
input.focus();

// 성별 버튼 선택
let selectedGender = null;
document.querySelectorAll('.gender-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedGender = btn.dataset.value;
    document.getElementById('errGender').classList.remove('show');
  });
});

// 저장
confirmBtn.addEventListener('click', async () => {
  const nickname  = input.value.trim();
  const birthYear = parseInt(document.getElementById('birthYearInput').value);
  const region    = document.getElementById('regionInput').value;

  // 유효성 검사
  let valid = true;
  function setErr(id, msg) {
    const el = document.getElementById(id);
    if (msg) { el.textContent = msg; el.classList.add('show'); valid = false; }
    else { el.classList.remove('show'); }
  }

  setErr('errNickname',  nickname.length < 2 || nickname.length > 10 ? '2~10자로 입력해주세요' : '');
  setErr('errGender',    !selectedGender ? '성별을 선택해주세요' : '');
  setErr('errBirthYear', !birthYear || birthYear < 1930 || birthYear > 2010 ? '올바른 출생연도를 입력해주세요' : '');
  setErr('errRegion',    !region ? '지역을 선택해주세요' : '');
  setErr('errAgree', !document.getElementById('agreeCheck').checked ? '개인정보 수집에 동의해주세요' : '');
  if (!valid) return;

  confirmBtn.disabled = true;
  confirmBtn.textContent = '저장 중…';

  try {
    const { error } = await supabase
      .from('users')
      .update({
        nickname,
        gender:     selectedGender,
        birth_year: birthYear,
        region,
      })
      .eq('id', session.user.id);

    if (error) throw error;
    location.replace('main.html');
  } catch (e) {
    msgEl.textContent = '저장 중 오류가 발생했습니다: ' + e.message;
    msgEl.className = 'auth-msg error';
    confirmBtn.disabled = false;
    confirmBtn.textContent = '시작하기';
  }
});

input.addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmBtn.click();
});