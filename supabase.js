// supabase.js — Supabase 클라이언트 초기화
// supabase-js v2 ESM CDN 사용
// HTML에서 importmap 또는 아래처럼 직접 CDN 로드 가능

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// supabase-js ESM 번들 (top-level await는 모듈 스코프에서만 허용)
// 브라우저 ESM 지원 필요 (Chrome 89+, Safari 15+, Firefox 89+)
const { createClient } = await import(
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
