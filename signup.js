import { db } from './firebase.js';
import { collection, getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 이미 로그인 상태면 피드로 이동
if (localStorage.getItem('userId')) {
  window.location.href = 'feed.html';
}

function hashPassword(password) {
  return CryptoJS.SHA256(password).toString();
}

function showError(message) {
  const el = document.getElementById('signup-error');
  el.textContent = message;
  el.classList.remove('hidden');
}

document.getElementById('signup-submit').addEventListener('click', function () {
  const username = document.getElementById('signup-username').value.trim();
  const nickname = document.getElementById('signup-nickname').value.trim();
  const password = document.getElementById('signup-password').value;
  const passwordConfirm = document.getElementById('signup-password-confirm').value;

  document.getElementById('signup-error').classList.add('hidden');

  if (!username || !nickname || !password || !passwordConfirm) {
    showError('모든 항목을 입력해주세요.');
    return;
  }
  if (!/^[a-zA-Z0-9]{4,20}$/.test(username)) {
    showError('아이디는 영문, 숫자 4~20자로 입력해주세요.');
    return;
  }
  if (nickname.length < 2) {
    showError('닉네임은 2자 이상 입력해주세요.');
    return;
  }
  if (password.length < 6) {
    showError('비밀번호는 6자 이상 입력해주세요.');
    return;
  }
  if (password !== passwordConfirm) {
    showError('비밀번호가 일치하지 않습니다.');
    return;
  }

  const q = query(collection(db, 'users'), where('username', '==', username));
  getDocs(q).then(function (snapshot) {
    if (!snapshot.empty) {
      showError('이미 사용 중인 아이디입니다.');
      return Promise.reject('duplicate');
    }

    return addDoc(collection(db, 'users'), {
      username: username,
      nickname: nickname,
      passwordHash: hashPassword(password),
      createdAt: new Date().toLocaleDateString('ko-KR')
    });

  }).then(function (docRef) {
    if (!docRef) return;

    localStorage.setItem('userId', docRef.id);
    localStorage.setItem('username', username);
    localStorage.setItem('nickname', nickname);

    window.location.href = 'feed.html';

  }).catch(function (error) {
    if (error === 'duplicate') return;
    console.error('회원가입 오류:', error);
    showError('회원가입 중 오류가 발생했습니다.');
  });
});