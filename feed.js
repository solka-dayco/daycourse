// localStorage에서 저장된 코스 불러오기
const saved = JSON.parse(localStorage.getItem('courses') || '[]');
const feedList = document.getElementById('feed-list');

// 저장된 코스가 없을 때
if (saved.length === 0) {
  feedList.innerHTML = '<p style="color:#aaa; font-size:14px;">저장된 코스가 없습니다.</p>';
} else {

  // 저장된 코스를 최신순으로 정렬 (id가 저장 시각 기준이라 역순 정렬)
  saved.reverse().forEach(function(course) {
    const card = document.createElement('div');
    card.className = 'feed-card';

    // 4분할 썸네일 생성
    const photos = course.photos || [];
    let thumbnailHTML = '';
    for (let i = 0; i < 4; i++) {
      if (photos[i]) {
        thumbnailHTML += `<img src="${photos[i]}" alt="코스 사진">`;
      } else {
        thumbnailHTML += `<div class="empty-slot">📍</div>`;
      }
    }

    // 장소 목록 요약 (→ 로 연결)
    const placeSummary = course.places.map(p => p.name).join(' → ');

    card.addEventListener('click', function() {
      window.location.href = 'course.html?id=' + course.id;
    });

    card.innerHTML = `
      <div class="card-thumbnail">${thumbnailHTML}</div>
      <div class="card-info">
        <div class="card-title">${course.name}</div>
        <div class="card-places">${placeSummary}</div>
        <div class="card-actions">
          <button>❤️ <span>${course.likes || 0}</span></button>
          <button>💬 <span>${course.comments || 0}</span></button>
          <button>📤</button>
        </div>
      </div>
    `;

    feedList.appendChild(card);
  });
}