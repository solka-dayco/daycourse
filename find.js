import { db } from './firebase.js';
import { collection, getDocs, query, where, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function hashPassword(password) {
  return CryptoJS.SHA256(password).toString();
}

// ── 탭 전환 ──────────────────────────────────────
document.getElementById('tab-find-id').addEventListener('click', function () {
  document.getElementById('form-find-id').classList.remove('hidden');
  document.getElementById('form-find-pw').classList.add('hidden');
  document.getElementById('tab-find-id').classList.add('active');
  document.getElementById('tab-find-pw').classList.remove('active');
});

document.getElementById('tab-find-pw').addEventListener('click', function () {
  document.getElementById('form-find-pw').classList.remove('hidden');
  document.getElementById('form-find-id').classList.add('hidden');
  document.getElementById('tab-find-pw').classList.add('active');
  document.getElementById('tab-find-id').classList.remove('active');
});

// ── 아이디 찾기 ───────────────────────────────────
document.getElementById('find-id-submit').addEventListener('click', function () {
  const nickname = document.getElementById('find-id-nickname').value.trim();
  const errorEl = document.getElementById('find-id-error');
  const resultEl = document.getElementById('find-id-result');

  errorEl.classList.add('hidden');
  resultEl.classList.add('hidden');

  if (!nickname) {
    errorEl.textContent = '닉네임을 입력해주세요.';
    errorEl.classList.remove('hidden');
    return;
  }

  const q = query(collection(db, 'users'), where('nickname', '==', nickname));
  getDocs(q).then(function (snapshot) {
    if (snapshot.empty) {
      errorEl.textContent = '해당 닉네임으로 가입된 계정이 없습니다.';
      errorEl.classList.remove('hidden');
      return;
    }

    const user = snapshot.docs[0].data();
    const maskedId = user.username.slice(0, 2) + '***' + user.username.slice(-1);
    resultEl.textContent = '아이디: ' + maskedId;
    resultEl.classList.remove('hidden');

  }).catch(function (error) {
    console.error('아이디 찾기 오류:', error);
    errorEl.textContent = '오류가 발생했습니다.';
    errorEl.classList.remove('hidden');
  });
});

// ── 비밀번호 찾기 - 본인 확인 ────────────────────
let verifiedDocId = null;

document.getElementById('find-pw-submit').addEventListener('click', function () {
  const username = document.getElementById('find-pw-username').value.trim();
  const nickname = document.getElementById('find-pw-nickname').value.trim();
  const errorEl = document.getElementById('find-pw-error');

  errorEl.classList.add('hidden');
  document.getElementById('find-pw-reset').classList.add('hidden');
  verifiedDocId = null;

  if (!username || !nickname) {
    errorEl.textContent = '아이디와 닉네임을 입력해주세요.';
    errorEl.classList.remove('hidden');
    return;
  }

  const q = query(collection(db, 'users'), where('username', '==', username), where('nickname', '==', nickname));
  getDocs(q).then(function (snapshot) {
    if (snapshot.empty) {
      errorEl.textContent = '아이디 또는 닉네임이 일치하지 않습니다.';
      errorEl.classList.remove('hidden');
      return;
    }

    verifiedDocId = snapshot.docs[0].id;
    document.getElementById('find-pw-reset').classList.remove('hidden');

  }).catch(function (error) {
    console.error('비밀번호 찾기 오류:', error);
    errorEl.textContent = '오류가 발생했습니다.';
    errorEl.classList.remove('hidden');
  });
});

// ── 비밀번호 변경 ─────────────────────────────────
document.getElementById('reset-pw-submit').addEventListener('click', function () {
  const newPassword = document.getElementById('new-password').value;
  const newPasswordConfirm = document.getElementById('new-password-confirm').value;
  const errorEl = document.getElementById('reset-pw-error');

  errorEl.classList.add('hidden');

  if (!newPassword || !newPasswordConfirm) {
    errorEl.textContent = '새 비밀번호를 입력해주세요.';
    errorEl.classList.remove('hidden');
    return;
  }
  if (newPassword.length < 6) {
    errorEl.textContent = '비밀번호는 6자 이상 입력해주세요.';
    errorEl.classList.remove('hidden');
    return;
  }
  if (newPassword !== newPasswordConfirm) {
    errorEl.textContent = '비밀번호가 일치하지 않습니다.';
    errorEl.classList.remove('hidden');
    return;
  }
  if (!verifiedDocId) {
    errorEl.textContent = '본인 확인을 먼저 진행해주세요.';
    errorEl.classList.remove('hidden');
    return;
  }

  updateDoc(doc(db, 'users', verifiedDocId), {
    passwordHash: hashPassword(newPassword)
  }).then(function () {
    alert('비밀번호가 변경됐습니다. 다시 로그인해주세요.');
    window.location.href = 'login.html';
  }).catch(function (error) {
    console.error('비밀번호 변경 오류:', error);
    errorEl.textContent = '변경 중 오류가 발생했습니다.';
    errorEl.classList.remove('hidden');
  });
});