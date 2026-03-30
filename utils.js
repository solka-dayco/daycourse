// utils.js — 공통 유틸리티 (v4.32)

/**
 * XSS 방어용 sanitize 함수
 * innerHTML에 삽입할 문자열을 안전하게 이스케이프
 */
export function sanitize(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}