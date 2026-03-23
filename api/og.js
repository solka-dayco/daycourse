// api/og.js — Vercel Edge Function
// 크롤러 요청 시 코스 데이터를 Supabase에서 조회해 OG 태그가 채워진 HTML 반환
// 일반 유저 요청은 course.html 정적 파일 그대로 서빙

export const config = { runtime: 'edge' };

// 크롤러 User-Agent 판별
const CRAWLER_PATTERNS = [
  'Twitterbot',
  'facebookexternalhit',
  'Facebot',
  'Slackbot',
  'Googlebot',
  'bingbot',
  'Discordbot',
  'TelegramBot',
  'WhatsApp',
  'kakaotalk-scrap',
  'Kakao',
  'LinkedInBot',
  'developers.google.com/+/web/snippet',
];

function isCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some(p => ua.includes(p.toLowerCase()));
}

// Supabase REST API로 코스 단건 조회
async function fetchCourse(courseId) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/courses?id=eq.${courseId}&select=name,description,thumbnail_url&limit=1`;

  const res = await fetch(url, {
    headers: {
      'apikey':        process.env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data?.[0] ?? null;
}

// 썸네일 없을 경우 첫 번째 장소 사진 fallback
async function fetchFallbackImage(courseId) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/course_places?course_id=eq.${courseId}&select=photo_url&order=order_index.asc&limit=1`;

  const res = await fetch(url, {
    headers: {
      'apikey':        process.env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
    },
  });

  if (!res.ok) return '';
  const data = await res.json();
  return data?.[0]?.photo_url ?? '';
}

// OG 태그가 채워진 HTML 생성
function buildOgHtml(course, courseId, imageUrl) {
  const title       = course.name        ? `${course.name} — 데이코스`   : '데이코스 — 나만의 하루 코스';
  const description = course.description ?? '데이코스에서 코스 정보를 확인해보세요.';
  const pageUrl     = `https://daycourse.kr/course?id=${courseId}`;
  const image       = imageUrl || '';

  // XSS 방지용 이스케이프
  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>

  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}"/>
  <meta name="robots" content="index,follow"/>
  <link rel="canonical" href="${esc(pageUrl)}"/>

  <meta property="og:type"        content="website"/>
  <meta property="og:title"       content="${esc(title)}"/>
  <meta property="og:description" content="${esc(description)}"/>
  <meta property="og:url"         content="${esc(pageUrl)}"/>
  <meta property="og:image"       content="${esc(image)}"/>

  <meta name="twitter:card"        content="summary_large_image"/>
  <meta name="twitter:title"       content="${esc(title)}"/>
  <meta name="twitter:description" content="${esc(description)}"/>
  <meta name="twitter:image"       content="${esc(image)}"/>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "${esc(title)}",
    "description": "${esc(description)}",
    "url": "${esc(pageUrl)}"
  }
  <\/script>

  <link rel="stylesheet" href="/style.css"/>
  <link rel="stylesheet" href="/course.css"/>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
  <script type="text/javascript"
    src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=725e3b5f43c47c651837511245861cc8&libraries=services&autoload=false">
  <\/script>
  <script src="https://developers.kakao.com/sdk/js/kakao.min.js" defer><\/script>

  <!-- 크롤러용 응답: 즉시 실제 페이지로 리다이렉트 -->
  <meta http-equiv="refresh" content="0; url=${esc(pageUrl)}"/>
</head>
<body>
  <p><a href="${esc(pageUrl)}">${esc(title)}</a></p>
</body>
</html>`;
}

export default async function handler(req) {
  const url    = new URL(req.url);
  const courseId = url.searchParams.get('id');
  const userAgent = req.headers.get('user-agent') || '';

  // id 없으면 피드로 리다이렉트
  if (!courseId) {
    return Response.redirect('https://daycourse.kr/', 302);
  }

  // 일반 유저 → course.html 정적 파일로 rewrite (Vercel이 처리)
  // 크롤러만 OG HTML 생성
  if (!isCrawler(userAgent)) {
    return fetch(`${url.origin}/course.html${url.search}`);
  }

  // 크롤러 경로: Supabase에서 코스 데이터 조회
  try {
    const course = await fetchCourse(courseId);

    if (!course) {
      // 코스 없으면 기본 HTML pass-through
      return fetch(`${url.origin}/course.html${url.search}`);
    }

    const imageUrl = course.thumbnail_url || await fetchFallbackImage(courseId);
    const html     = buildOgHtml(course, courseId, imageUrl);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type':  'text/html; charset=utf-8',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (e) {
    console.error('[og.js] error:', e);
    return fetch(`${url.origin}/course.html${url.search}`);
  }
}