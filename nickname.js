// nickname.js — 프로필 설정 (회원가입 직후)
import { supabase } from './supabase.js';
import { upsertUserProfile } from './db.js';

// ── 로그인 체크 ──────────────────────────────────────────
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) { location.href = 'login.html'; }
const userId = sessionData.session.user.id;

// 이미 닉네임 설정된 경우
const { data: existingUser } = await supabase.from('users').select('id, username, nickname').eq('id', userId).single();
if (existingUser?.nickname && existingUser.nickname !== existingUser.username) {
  // 이미 설정한 경우 스킵 가능하지만 재설정도 허용
}

// 나이 입력 (number input — 1~100)

// ── 성별 칩 ──────────────────────────────────────────────
let selectedGender = null;
document.querySelectorAll('.gender-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.gender-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedGender = chip.dataset.gender;
  });
});

// ── 저장 ─────────────────────────────────────────────────
const saveBtn = document.getElementById('profileSaveBtn');
const msgEl   = document.getElementById('profileMsg');

function showMsg(text, type = 'error') {
  msgEl.textContent = text;
  msgEl.className = `auth-msg ${type}`;
}

async function save(skipNickname = false) {
  const nickname  = document.getElementById('nicknameInput').value.trim();
  const ageInput = document.getElementById('birthYear').value;
  // 나이 입력 → birth_year 변환 (매년 자동으로 나이 계산 가능)
  const birth_year = ageInput ? new Date().getFullYear() - parseInt(ageInput) : undefined;
  const region    = document.getElementById('regionSelect').value;

  // 닉네임 검증 (skip이 아닐 때만)
  if (!skipNickname) {
    const errEl = document.getElementById('errNickname');
    if (!nickname || nickname.length < 2 || nickname.length > 16 || /\s/.test(nickname)) {
      errEl.textContent = '닉네임은 공백 없이 2~16자로 입력해주세요';
      errEl.classList.add('show');
      document.getElementById('nicknameInput').classList.add('error');
      return;
    }
    errEl.classList.remove('show');
    document.getElementById('nicknameInput').classList.remove('error');

    // 닉네임 중복 체크
    const { data: dup } = await supabase
      .from('users')
      .select('id')
      .eq('nickname', nickname)
      .neq('id', userId)
      .maybeSingle();

    if (dup) {
      showMsg('이미 사용 중인 닉네임입니다.');
      return;
    }
  }

  saveBtn.disabled = true;
  saveBtn.textContent = '저장 중…';

  try {
    const payload = {
      id:       userId,
      username: existingUser?.username ?? '',
      nickname: skipNickname ? (existingUser?.nickname ?? '') : nickname,
    };
    if (selectedGender)        payload.gender     = selectedGender;
    if (birth_year !== undefined) payload.birth_year = birth_year;
    if (region)         payload.region = region;

    await upsertUserProfile(payload);
    location.href = 'main.html';
  } catch (e) {
    showMsg('저장 실패: ' + e.message);
  } finally {
    saveBtn.disabled  = false;
    saveBtn.textContent = '저장하고 시작하기';
  }
}

saveBtn.addEventListener('click', () => save(false));

document.getElementById('skipBtn').addEventListener('click', () => save(true));

document.getElementById('nicknameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') save(false);
});