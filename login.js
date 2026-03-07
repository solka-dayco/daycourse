import { db } from './firebase.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 이미 로그인 상태면 피드로 이동
if (localStorage.getItem('userId')) {
  window.location.href = 'feed.html';
}

function hashPassword(password) {
  return CryptoJS.SHA256(password).toString();
}

function showError(message) {
  const el = document.getElementById('login-error');
  el.textContent = message;
  el.classList.remove('hidden');
}

document.getElementById('login-submit').addEventListener('click', function () {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  document.getElementById('login-error').classList.add('hidden');

  if (!username || !password) {
    showError('아이디와 비밀번호를 입력해주세요.');
    return;
  }

  const q = query(collection(db, 'users'), where('username', '==', username));
  getDocs(q).then(function (snapshot) {
    if (snapshot.empty) {
      showError('아이디 또는 비밀번호가 올바르지 않습니다.');
      return;
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    if (user.passwordHash !== hashPassword(password)) {
      showError('아이디 또는 비밀번호가 올바르지 않습니다.');
      return;
    }

    localStorage.setItem('userId', userDoc.id);
    localStorage.setItem('username', user.username);
    localStorage.setItem('nickname', user.nickname);

    window.location.href = 'feed.html';

  }).catch(function (error) {
    console.error('로그인 오류:', error);
    showError('로그인 중 오류가 발생했습니다.');
  });
});

// 엔터키 로그인
document.getElementById('login-password').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    document.getElementById('login-submit').click();
  }
});