// ── create.js ────────────────────────────────────
// 담당: 코스 목록 관리, 드래그 순서, Firebase 저장/불러오기/삭제

import { db } from './firebase.js';
import { collection, addDoc, getDocs, deleteDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { drawPolyline, renderCourseMarkers } from './map.js';
import { getPhotoData } from './photo.js';

export let coursePlaces = [];

export function initCourse() {
  window.onPlaceAdd = function (place) {
    coursePlaces.push({
      name: place.place_name,
      lat: place.y,
      lng: place.x
    });
    addToCourseList(place);
    drawPolyline(coursePlaces);
  };

  document.getElementById('save-btn').addEventListener('click', saveCourse);

  Sortable.create(document.getElementById('course-list'), {
    animation: 150,
    handle: '.drag-handle',
    onEnd: updateNumbers
  });
}

function addToCourseList(place) {
  const list = document.getElementById('course-list');
  const number = list.children.length + 1;

  const li = document.createElement('li');
  li.dataset.index = number - 1;
  li.innerHTML = `
    <span class="course-number">${number}</span>
    <span>${place.place_name}</span>
    <span class="drag-handle">☰</span>
  `;
  list.appendChild(li);
  updateNumbers();
}

function updateNumbers() {
  const items = document.querySelectorAll('#course-list li');
  const reordered = [];

  items.forEach(function (item, index) {
    item.querySelector('.course-number').textContent = index + 1;
    const originalIndex = parseInt(item.dataset.index);
    reordered.push(coursePlaces[originalIndex]);
    item.dataset.index = index;
  });

  coursePlaces = reordered;
  drawPolyline(coursePlaces);
}

function saveCourse() {
  const courseName = document.getElementById('course-name').value.trim();
  if (!courseName) { alert('코스 이름을 입력해주세요.'); return; }
  if (coursePlaces.length === 0) { alert('장소를 1개 이상 추가해주세요.'); return; }

  const saveBtn = document.getElementById('save-btn');
  saveBtn.textContent = '저장 중...';
  saveBtn.disabled = true;

  const courseData = {
    name: courseName,
    places: coursePlaces,
    photos: getPhotoData(),
    likes: 0,
    comments: 0,
    createdAt: new Date().toLocaleDateString('ko-KR'),
    authorId: localStorage.getItem('userId') || null,
    authorNickname: localStorage.getItem('nickname') || '익명'
  };

  addDoc(collection(db, 'courses'), courseData).then(function () {
    renderSavedList();
    document.getElementById('course-name').value = '';
    saveBtn.textContent = '저장';
    saveBtn.disabled = false;
    alert('코스가 저장됐습니다! 🎉');
  }).catch(function (error) {
    console.error('저장 오류:', error);
    alert('저장 중 오류가 발생했습니다.');
    saveBtn.textContent = '저장';
    saveBtn.disabled = false;
  });
}

export function renderSavedList() {
  const list = document.getElementById('saved-list');
  list.innerHTML = '<li style="color:#aaa; font-size:13px;">불러오는 중...</li>';

  getDocs(collection(db, 'courses')).then(function (snapshot) {
    if (snapshot.empty) {
      list.innerHTML = '<li style="color:#aaa; font-size:13px;">저장된 코스가 없습니다.</li>';
      return;
    }

    list.innerHTML = '';

    snapshot.forEach(function (docSnap) {
      const course = docSnap.data();
      const id = docSnap.id;

      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong style="cursor:pointer; color:#ff4e6a;" class="load-course" data-id="${id}">${course.name}</strong>
          <span style="font-size:12px; color:#aaa; margin-left:8px;">${course.createdAt}</span>
          <div style="font-size:12px; color:#888; margin-top:4px;">
            ${course.places.map(p => p.name).join(' → ')}
          </div>
        </div>
        <button class="delete-btn" data-id="${id}">🗑</button>
      `;
      list.appendChild(li);
    });

    document.querySelectorAll('.delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteCourse(this.dataset.id); });
    });

    document.querySelectorAll('.load-course').forEach(function (btn) {
      btn.addEventListener('click', function () { loadCourse(this.dataset.id); });
    });

  }).catch(function (error) {
    console.error('불러오기 오류:', error);
    list.innerHTML = '<li style="color:#aaa; font-size:13px;">불러오기 실패. 새로고침 해주세요.</li>';
  });
}

function deleteCourse(id) {
  if (!confirm('이 코스를 삭제할까요?')) return;

  deleteDoc(doc(db, 'courses', id)).then(function () {
    renderSavedList();
  }).catch(function (error) {
    console.error('삭제 오류:', error);
    alert('삭제 중 오류가 발생했습니다.');
  });
}

function loadCourse(id) {
  getDoc(doc(db, 'courses', id)).then(function (docSnap) {
    if (!docSnap.exists()) return;

    const course = docSnap.data();
    document.getElementById('course-list').innerHTML = '';
    coursePlaces = course.places;

    renderCourseMarkers(coursePlaces);
    drawPolyline(coursePlaces);

    coursePlaces.forEach(function (place, index) {
      const list = document.getElementById('course-list');
      const li = document.createElement('li');
      li.dataset.index = index;
      li.innerHTML = `
        <span class="course-number">${index + 1}</span>
        <span>${place.name}</span>
        <span class="drag-handle">☰</span>
      `;
      list.appendChild(li);
    });

  }).catch(function (error) {
    console.error('불러오기 오류:', error);
  });
}