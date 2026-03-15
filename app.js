// app.js — 진입점: 비로그인 시 로그인 페이지로 리다이렉트
import { getSession } from './db.js';

(async () => {
  const session = await getSession();
  if (!session) {
    location.replace('login.html');
  }
})();
