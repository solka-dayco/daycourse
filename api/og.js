// api/og.js — Vercel Edge Function
// 크롤러 요청 시 코스 데이터를 Supabase에서 조회해 OG 태그가 채워진 HTML 반환
// 일반 유저 요청은 course.html 정적 파일 내용을 직접 반환 (무한루프 방지)

export const config = { runtime: 'edge' };

// ── 크롤러 판별 ───────────────────────────────────────────
// 일반 브라우저는 항상 'Mozilla/5.0'으로 시작 — 크롤러는 대부분 그렇지 않음
// 화이트리스트 방식 대신 브라우저 여부로 판별해 오탐 원천 차단
function isCrawler(userAgent) {
  if (!userAgent) return true;
  const ua = userAgent.toLowerCase();

  // 카카오 공유 크롤러는 Mozilla/5.0으로 시작하지만 명시적으로 크롤러 처리
  if (ua.includes('kakaotalk-scrap')) return true;

  // 구글봇, 빙봇 등 주요 검색엔진 크롤러 명시적 처리
  if (ua.includes('googlebot') || ua.includes('bingbot') || ua.includes('yandexbot') || ua.includes('applebot')) return true;

  // Mozilla/5.0으로 시작하면 일반 브라우저 (Chrome, Safari, Firefox, 인앱 브라우저 전부 포함)
  if (userAgent.startsWith('Mozilla/5.0')) return false;

  // 그 외 (curl, python, bot 류) → 크롤러로 처리
  return true;
}

// ── Supabase 조회 ─────────────────────────────────────────
async function fetchCourse(courseId) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/courses?id=eq.${encodeURIComponent(courseId)}&select=name,description,thumbnail_url,region_main,region_sub&limit=1`,
    {
      headers: {
        'apikey':        process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.[0] ?? null;
}

async function fetchPlaces(courseId) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/course_places?course_id=eq.${encodeURIComponent(courseId)}&select=name,address,comment&order=order_index.asc`,
    {
      headers: {
        'apikey':        process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      },
    }
  );
  if (!res.ok) return [];
  return (await res.json()) ?? [];
}

async function fetchFallbackImage(courseId) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/course_places?course_id=eq.${encodeURIComponent(courseId)}&select=photo_url&order=order_index.asc&limit=1`,
    {
      headers: {
        'apikey':        process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      },
    }
  );
  if (!res.ok) return '';
  const data = await res.json();
  return data?.[0]?.photo_url ?? '';
}

// ── XSS 방지 ─────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── OG HTML 생성 ──────────────────────────────────────────
function buildOgHtml(course, courseId, imageUrl, places = []) {
  const title       = course.name ? `${course.name} — 데이코스` : '데이코스 — 나만의 하루 코스';
  const region      = [course.region_main, course.region_sub].filter(Boolean).join(' ');
  const placeCount  = places.length ? `장소 ${places.length}곳 · ` : '';
  const baseDesc    = course.description ?? '데이코스에서 코스 정보를 확인해보세요.';
  const description = [region, `${placeCount}${baseDesc}`].filter(Boolean).join(' · ');
  const pageUrl     = `https://daycourse.kr/course?id=${encodeURIComponent(courseId)}`;
  const image       = imageUrl || '';

  const placesHtml = places.length
    ? `<ol>${places.map(p =>
        `<li><strong>${esc(p.name)}</strong>${p.address ? ` — ${esc(p.address)}` : ''}${p.comment ? `<br/>${esc(p.comment)}` : ''}</li>`
      ).join('')}</ol>`
    : '';

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
</head>
<body>
  <h1>${esc(course.name ?? '데이코스')}</h1>
  <p>${esc(description)}</p>
  ${placesHtml}
  <p><a href="${esc(pageUrl)}">데이코스에서 전체 코스 보기</a></p>
</body>
</html>`;
}

// ── course.html 정적 콘텐츠 (무한루프 방지용 인라인) ────────
function buildCourseHtml(courseId) {
  const canonical = courseId
    ? `https://daycourse.kr/course?id=${encodeURIComponent(courseId)}`
    : `https://daycourse.kr/`;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>

  <title>데이코스 코스 상세</title>
  <meta name="description" content="데이코스에서 코스 정보를 확인해보세요." />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="${canonical}" />

  <meta property="og:type" content="website" />
  <meta property="og:title" content="데이코스 코스 상세" />
  <meta property="og:description" content="데이코스에서 코스 정보를 확인해보세요." />
  <meta property="og:url" content="https://daycourse.kr/course" />
  <meta property="og:image" content="" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="데이코스 코스 상세" />
  <meta name="twitter:description" content="데이코스에서 코스 정보를 확인해보세요." />
  <meta name="twitter:image" content="" />

  <script type="application/ld+json" id="courseJsonLd">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "데이코스 코스 상세",
    "description": "데이코스에서 코스 정보를 확인해보세요."
  }
  </script>

  <link rel="stylesheet" href="style.css"/>
  <link rel="stylesheet" href="course.css"/>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css">
  <script type="text/javascript"
    src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=725e3b5f43c47c651837511245861cc8&libraries=services&autoload=false">
  </script>
  <script src="https://developers.kakao.com/sdk/js/kakao.min.js" defer></script>
</head>
<body>
  <div class="sidebar-overlay" id="sidebarOverlay"></div>
  <nav class="sidebar" id="sidebar"></nav>

  <header class="header">
    <button class="header-menu" id="sidebarToggle" aria-label="메뉴"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button>
    <a class="header-title" href="/">데이코스</a>
    <div class="header-right">
      <button id="headerCreateBtn" style="display:none" aria-label="코스 만들기"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
    </div>
  </header>

  <div class="page-wrap" id="pageWrap">
    <!-- 로딩 -->
    <div class="spinner-wrap" id="spinner"><div class="spinner"></div></div>

    <div id="courseContent" style="display:none">

      <!-- 캐러셀 -->
      <div class="carousel-wrap">
        <div class="carousel" id="carousel">
          <div class="carousel-track" id="carouselTrack"></div>
          <div class="carousel-counter" id="carouselCounter"></div>
          <button class="carousel-nav prev" id="carouselPrev" aria-label="이전">‹</button>
          <button class="carousel-nav next" id="carouselNext" aria-label="다음">›</button>
        </div>
      </div>

      <!-- 코스 헤더 -->
      <div class="course-header detail-section">
        <div class="course-meta-top">
          <span class="course-region" id="courseRegion"></span>
          <span class="course-time-badge" id="courseTime"></span>
        </div>
        <h1 class="course-name" id="courseName"></h1>
        <p class="course-desc" id="courseDesc"></p>
        <div class="course-ref" id="courseRef" style="display:none"></div>
        <div class="course-meta-bottom">
          <span class="course-author"
            id="courseAuthor"
            style="cursor:pointer"
          ></span>
          <span class="course-date" id="courseDate"></span>
        </div>

        <!-- 액션 바: 좋아요 · 북마크 · 댓글 수 · 참조 · 공유 -->
        <div class="course-actions-row">
          <button class="course-action-btn course-like-btn" id="likeBtn" aria-label="좋아요">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> <span id="likeCount">0</span>
          </button>
          <button class="course-action-btn course-comment-jump-btn" id="commentJumpBtn" aria-label="댓글">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> <span id="commentCountBadge">0</span>
          </button>
          <button class="course-action-btn course-bookmark-btn" id="bookmarkBtn" aria-label="북마크">
            🔖
          </button>
          <button class="course-action-btn course-copy-btn" id="copyBtn" aria-label="참조">
            참조 <span class="ref-count" id="refCount"></span>
          </button>
          <button class="course-action-btn course-share-action-btn" id="shareActionBtn" aria-label="공유">
            공유
          </button>
          <!-- 비본인: 신고 버튼 -->
          <button class="course-action-btn course-report-btn" id="reportBtn" aria-label="신고" style="display:none">
          </button>
        </div>

        <!-- 본인 코스 수정/삭제 -->
        <div class="course-owner-actions" id="ownerActions" style="display:none">
          <button class="btn btn-outline course-edit-btn" id="editBtn">수정</button>
          <button class="btn btn-danger course-delete-btn" id="deleteBtn">삭제</button>
        </div>
      </div>

      <!-- 타임라인 -->
      <div class="detail-section">
        <div class="section-label">장소 타임라인</div>
        <div class="timeline" id="timeline"></div>
        <div class="timeline-summary" id="timelineSummary"></div>
      </div>

      <!-- 동선 지도 -->
      <div class="detail-section">
        <div class="section-label">동선 지도</div>
        <div style="position:relative">
          <div id="detailMap" class="detail-map"></div>
          <button class="map-location-btn" id="detailMyLocationBtn" title="내 위치"><svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg></button>
        </div>
      </div>

      <!-- 이 코스를 참조한 코스 -->
      <div class="detail-section" id="referencedSection" style="display:none">
        <div class="section-label">🔄 이 코스를 참조한 코스</div>
        <div class="feed-grid referenced-grid" id="referencedGrid"></div>
      </div>

      <!-- 댓글 -->
      <div class="detail-section" id="commentSection">
        <div class="comment-header">
          <div class="section-label"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> 댓글 <span class="comment-total" id="commentTotal"></span></div>
          <div class="comment-sort-chips">
            <button class="chip active" data-sort="latest">최신순</button>
            <button class="chip" data-sort="popular">인기순</button>
            <button class="chip" data-sort="likes">좋아요순</button>
          </div>
        </div>
        <div class="comment-list" id="commentList"></div>
        <div class="comment-input-wrap" id="commentInputWrap">
          <input
            type="text"
            id="commentInput"
            class="comment-input"
            placeholder="댓글을 입력하세요…"
            maxlength="200"
            autocomplete="off"
          />
          <button class="comment-submit-btn" id="commentSubmitBtn">등록</button>
        </div>
      </div>

    </div><!-- /courseContent -->
  </div><!-- /page-wrap -->

  <!-- 전체화면 사진 뷰어 -->
  <div class="photo-viewer" id="photoViewer" style="display:none" role="dialog" aria-modal="true">
    <button class="photo-viewer-close" id="viewerClose" aria-label="닫기"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    <span class="photo-viewer-counter" id="viewerCounter"></span>
    <div class="photo-viewer-img-wrap">
      <img class="photo-viewer-img" id="viewerImg" src="" alt=""/>
      <div class="viewer-caption" id="viewerCaption"></div>
    </div>
    <button class="photo-viewer-nav prev" id="viewerPrev" aria-label="이전">‹</button>
    <button class="photo-viewer-nav next" id="viewerNext" aria-label="다음">›</button>
  </div>

  <!-- 공유 바텀시트 -->
  <div class="bottom-sheet-overlay" id="shareOverlay"></div>
  <div class="bottom-sheet" id="shareSheet" role="dialog">
    <div class="bottom-sheet-handle"></div>
    <div class="bottom-sheet-item" id="copyLinkBtn"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> 링크 복사</div>
    <div class="bottom-sheet-item" id="kakaoShareBtn">💬 카카오톡 공유</div>
  </div>

  <!-- 삭제 확인 모달 -->
  <div class="modal-overlay" id="deleteModal">
    <div class="modal-box">
      <div class="modal-title">코스 삭제</div>
      <div class="modal-desc">이 코스를 삭제하면 복구할 수 없습니다. 정말 삭제하시겠어요?</div>
      <div class="modal-actions">
        <button class="modal-btn cancel" id="deleteCancel">취소</button>
        <button class="modal-btn confirm" id="deleteConfirm">삭제</button>
      </div>
    </div>
  </div>

  <!-- 신고 바텀시트 -->
  <div class="bottom-sheet-overlay" id="reportOverlay"></div>
  <div class="bottom-sheet" id="reportSheet" role="dialog">
    <div class="bottom-sheet-handle"></div>
    <div class="bottom-sheet-item" data-reason="spam"> 스팸 / 광고</div>
    <div class="bottom-sheet-item" data-reason="inappropriate"> 부적절한 내용</div>
    <div class="bottom-sheet-item" data-reason="abuse"> 욕설 / 비방</div>
    <div class="bottom-sheet-item" data-reason="other"> 기타</div>
  </div>

  <div class="toast" id="toast"></div>
  <script type="module" src="course.js"></script>
</body>
</html>`;
}

// ── 핸들러 ────────────────────────────────────────────────
export default async function handler(req) {
  const url       = new URL(req.url);
  const courseId  = url.searchParams.get('id');
  const userAgent = req.headers.get('user-agent') || '';

  // id 없으면 피드로 리다이렉트
  if (!courseId) {
    return Response.redirect('https://daycourse.kr/', 301);
  }

  // 일반 유저 → course.html 인라인 반환 (fetch 루프 없음)
  if (!isCrawler(userAgent)) {
    return new Response(buildCourseHtml(courseId), {
      status: 200,
      headers: {
        'Content-Type':  'text/html; charset=utf-8',
        'Cache-Control': 'no-store',   // CDN 캐시 차단 — 크롤러/유저 혼용 방지
      },
    });
  }

  // 크롤러 → OG 태그 채운 HTML 반환
  try {
    const [course, places] = await Promise.all([
      fetchCourse(courseId),
      fetchPlaces(courseId),
    ]);

    if (!course) {
      return new Response(buildCourseHtml(courseId), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    const imageUrl = course.thumbnail_url || await fetchFallbackImage(courseId);
    const html     = buildOgHtml(course, courseId, imageUrl, places);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type':  'text/html; charset=utf-8',
        'Cache-Control': 'no-store',   // OG HTML도 캐시 차단
      },
    });
  } catch (e) {
    console.error('[og.js] error:', e);
    return new Response(buildCourseHtml(courseId), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}