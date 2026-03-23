// api/sitemap.js — Vercel Edge Function
// Supabase에서 전체 코스 ID를 조회해 동적 sitemap.xml 반환
// Cache-Control: s-maxage=3600 (1시간 CDN 캐시)

export const config = { runtime: 'edge' };

const BASE_URL = 'https://daycourse.kr';

async function fetchAllCourseIds() {
  const pageSize = 1000;
  let offset = 0;
  const ids = [];

  while (true) {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/courses?select=id,created_at&is_deleted=neq.true&order=created_at.desc&limit=${pageSize}&offset=${offset}`,
      {
        headers: {
          'apikey':        process.env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!res.ok) break;
    const data = await res.json();
    if (!data || data.length === 0) break;

    ids.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return ids;
}

function buildSitemap(courses) {
  const staticUrls = [
    { loc: `${BASE_URL}/`,        changefreq: 'daily',  priority: '1.0' },
    { loc: `${BASE_URL}/privacy`, changefreq: 'yearly', priority: '0.2' },
  ];

  const courseUrls = courses.map(c => ({
    loc:        `${BASE_URL}/course?id=${encodeURIComponent(c.id)}`,
    lastmod:    c.created_at ? c.created_at.slice(0, 10) : undefined,
    changefreq: 'weekly',
    priority:   '0.8',
  }));

  const allUrls = [...staticUrls, ...courseUrls];

  const urlEntries = allUrls.map(u => `
  <url>
    <loc>${u.loc}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

export default async function handler(req) {
  try {
    const courses = await fetchAllCourseIds();
    const xml = buildSitemap(courses);

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type':  'application/xml; charset=utf-8',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (e) {
    console.error('[sitemap.js] error:', e);

    // 실패 시 최소 정적 sitemap 반환
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <priority>1.0</priority>
  </url>
</urlset>`;

    return new Response(fallback, {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
  }
}