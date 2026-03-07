import { db } from './firebase.js';
import { collection, getDocs, addDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── 탭 전환 ──────────────────────────────────────
document.getElementById('tab-login').addEventListener('click', function () {
  document.getElementById('form-login').classList.remove('hidden');
  document.getElementById('form-signup').classList.add('hidden');
  document.getElementById('tab-login').classList.add('active');
  document.getElementById('tab-signup').classList.remove('active');
});

document.getElementById('tab-signup').addEventListener('click', function () {
  document.getElementById('form-signup').classList.remove('hidden');
  document.getElementById('form-login').classList.add('hidden');
  document.getElementById('tab-signup').classList.add('active');
  document.getElementById('tab-login').classList.remove('active');
});

// ── 비밀번호 해시 ─────────────────────────────────
function hashPassword(password) {
  return CryptoJS.SHA256(password).toString();
}

// ── 에러 표시 ─────────────────────────────────────
function showError(id, message) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.classList.remove('hidden');
}

function hideError(id) {
  document.getElementById(id).classList.add('hidden');
}

// ── 로그인 ───────────────────────────────────────
document.getElementById('login-submit').addEventListener('click', function () {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  hideError('login-error');

  if (!username || !password) {
    showError('login-error', '아이디와 비밀번호를 입력해주세요.');
    return;
  }

  const q = query(collection(db, 'users'), where('username', '==', username));
  getDocs(q).then(function (snapshot) {
    if (snapshot.empty) {
      showError('login-error', '아이디 또는 비밀번호가 올바르지 않습니다.');
      return;
    }

    const user = snapshot.docs[0].data();
    const hashed = hashPassword(password);

    if (user.passwordHash !== hashed) {
      showError('login-error', '아이디 또는 비밀번호가 올바르지 않습니다.');
      return;
    }

    // 로그인 성공 → localStorage 저장
    localStorage.setItem('userId', snapshot.docs[0].id);
    localStorage.setItem('username', user.username);
    localStorage.setItem('nickname', user.nickname);

    window.location.href = 'feed.html';

  }).catch(function (error) {
    console.error('로그인 오류:', error);
    showError('login-error', '로그인 중 오류가 발생했습니다.');
  });
});

// ── 회원가입 ─────────────────────────────────────
document.getElementById('signup-submit').addEventListener('click', function () {
  const username = document.getElementById('signup-username').value.trim();
  const nickname = document.getElementById('signup-nickname').value.trim();
  const password = document.getElementById('signup-password').value;
  const passwordConfirm = document.getElementById('signup-password-confirm').value;

  hideError('signup-error');

  // 유효성 검사
  if (!username || !nickname || !password || !passwordConfirm) {
    showError('signup-error', '모든 항목을 입력해주세요.');
    return;
  }
  if (!/^[a-zA-Z0-9]{4,20}$/.test(username)) {
    showError('signup-error', '아이디는 영문, 숫자 4~20자로 입력해주세요.');
    return;
  }
  if (nickname.length < 2) {
    showError('signup-error', '닉네임은 2자 이상 입력해주세요.');
    return;
  }
  if (password.length < 6) {
    showError('signup-error', '비밀번호는 6자 이상 입력해주세요.');
    return;
  }
  if (password !== passwordConfirm) {
    showError('signup-error', '비밀번호가 일치하지 않습니다.');
    return;
  }

  // 아이디 중복 확인
  const q = query(collection(db, 'users'), where('username', '==', username));
  getDocs(q).then(function (snapshot) {
    if (!snapshot.empty) {
      showError('signup-error', '이미 사용 중인 아이디입니다.');
      return;
    }

    // 회원가입 처리
    return addDoc(collection(db, 'users'), {
      username: username,
      nickname: nickname,
      passwordHash: hashPassword(password),
      createdAt: new Date().toLocaleDateString('ko-KR')
    });

  }).then(function (docRef) {
    if (!docRef) return;

    // 자동 로그인
    localStorage.setItem('userId', docRef.id);
    localStorage.setItem('username', username);
    localStorage.setItem('nickname', nickname);

    window.location.href = 'feed.html';

  }).catch(function (error) {
    console.error('회원가입 오류:', error);
    showError('signup-error', '회원가입 중 오류가 발생했습니다.');
  });
});

// ── 이미 로그인 상태면 피드로 이동 ──────────────
if (localStorage.getItem('userId')) {
  window.location.href = 'feed.html';
}