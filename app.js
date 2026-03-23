// app.js — 로그인 필요 페이지 진입 제어
// 로그인 필요 페이지의 <script>에서 import './app.js' 로 사용
import { supabase } from './supabase.js';

const { data } = await supabase.auth.getSession();
if (!data.session) {
  location.replace('/login?redirect=' + encodeURIComponent(location.pathname + location.search));
}
