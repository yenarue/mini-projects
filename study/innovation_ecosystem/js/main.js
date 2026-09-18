(function () {
  'use strict';

  /* ---------- 푸터 연도 ---------- */
  document.querySelectorAll('.footer-year').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- 다크모드 ----------
     layout.mjs의 no-flash 스크립트가 이미 <html data-theme="light|dark">를
     찍어 두므로, 여기서는 그 값을 뒤집기만 하면 된다. */
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') === 'dark';
      var next = dark ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('ie-theme', next); } catch (e) {}
    });
  }

  /* ---------- 글자 크기 3단 (90/100/115%, localStorage로 유지) ---------- */
  var FONTSIZE_KEY = 'ie-fontsize';
  var fontsizeControl = document.getElementById('fontsize-control');
  if (fontsizeControl) {
    var sizeButtons = Array.prototype.slice.call(fontsizeControl.querySelectorAll('button[data-fontsize]'));
    function syncActiveButton() {
      var current = root.getAttribute('data-fontsize') || 'md';
      sizeButtons.forEach(function (b) {
        b.classList.toggle('active', b.dataset.fontsize === current);
      });
    }
    syncActiveButton();
    sizeButtons.forEach(function (b) {
      b.addEventListener('click', function () {
        var size = b.dataset.fontsize;
        root.setAttribute('data-fontsize', size);
        try { localStorage.setItem(FONTSIZE_KEY, size); } catch (e) {}
        syncActiveButton();
      });
    });
  }

  /* ---------- 접힘 상태 기억 ---------- */
  var FOLD_KEY = 'ie-folds';
  function loadFolds() {
    try { return JSON.parse(localStorage.getItem(FOLD_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveFolds(state) {
    try { localStorage.setItem(FOLD_KEY, JSON.stringify(state)); } catch (e) {}
  }
  var folds = loadFolds();
  var details = Array.prototype.slice.call(document.querySelectorAll('details.sec-fold'));
  details.forEach(function (d) {
    var key = d.dataset.sec;
    if (folds[key]) d.open = true;
    d.addEventListener('toggle', function () {
      folds[key] = d.open;
      saveFolds(folds);
    });
  });

  var expand = document.getElementById('expand-all');
  var collapse = document.getElementById('collapse-all');
  if (expand) expand.addEventListener('click', function () {
    details.forEach(function (d) { d.open = true; folds[d.dataset.sec] = true; });
    saveFolds(folds);
  });
  if (collapse) collapse.addEventListener('click', function () {
    details.forEach(function (d) { d.open = false; folds[d.dataset.sec] = false; });
    saveFolds(folds);
  });

  /* ---------- 사이드바 스크롤 추적 ----------
     예전 구현은 IntersectionObserver rootMargin으로 "화면 상단 70px~30% 지점"
     밴드에 걸리는 concept 중 DOM 순서상 첫 번째를 활성으로 골랐다. R2에서 개념
     카드에 패딩(.concept { padding: 30px 32px 34px })이 커지면서, 스크롤해서
     #c05를 보고 있어도 바로 위 #c04의 (커진) 아래쪽 패딩이 여전히 그 밴드에
     걸쳐 있어 04가 활성으로 남는 버그가 생겼다 — 카드 내부 여백 크기에 따라
     경계가 흔들리는 게 근본 원인.
     지금은 카드 패딩과 무관하게 "리더가 실제로 보고 있는" 개념을 직접 계산한다:
     topbar 바로 아래(§ THRESHOLD)를 지나는 기준선을 정해 놓고, 그 선보다 위쪽에서
     시작한 concept 중 가장 아래(=가장 최근에 그 선을 지난) 것을 활성으로 고른다.
     각 concept의 실제 top 좌표만 보므로 패딩·마진이 얼마든 흔들리지 않는다. */
  var links = {};
  document.querySelectorAll('.side-nav a[data-concept]').forEach(function (a) {
    links[a.dataset.concept] = a;
  });
  var concepts = Array.prototype.slice.call(document.querySelectorAll('section.concept'));
  if (concepts.length) {
    var THRESHOLD = 96; // topbar-h(60) + 여유 — 카드 padding과 무관한 고정 기준선

    var updateActive = function () {
      var current = concepts[0];
      for (var i = 0; i < concepts.length; i++) {
        if (concepts[i].getBoundingClientRect().top - THRESHOLD <= 0) {
          current = concepts[i];
        } else {
          break; // concepts는 DOM(=스크롤) 순서이므로 여기서부터는 전부 아직 안 옴
        }
      }
      Object.keys(links).forEach(function (k) { links[k].classList.remove('active'); });
      var link = links[current.id];
      if (!link) return;
      link.classList.add('active');
      // aside가 실제로 스크롤이 필요한 경우에만 scrollIntoView를 호출한다.
      // 그렇지 않으면(사이드바에 모든 항목이 이미 다 보이는 경우) 매 스크롤
      // 이벤트마다 불필요하게 호출되어, 메인 창에서 진행 중인 smooth scroll
      // (예: 개념 링크 클릭 → 해당 섹션으로 스크롤)을 중간에 끊어버린다.
      var side = link.closest('aside');
      if (side && side.scrollHeight > side.clientHeight) {
        var linkRect = link.getBoundingClientRect();
        var sideRect = side.getBoundingClientRect();
        var outOfView = linkRect.top < sideRect.top || linkRect.bottom > sideRect.bottom;
        if (outOfView) link.scrollIntoView({ block: 'nearest' });
      }
    };

    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        updateActive();
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateActive();
  }

  /* ---------- 슬라이드 라이트박스 ---------- */
  document.addEventListener('click', function (e) {
    var img = e.target.closest ? e.target.closest('figure.slide img') : null;
    if (!img) return;
    var box = document.createElement('div');
    box.className = 'lightbox';
    var big = document.createElement('img');
    big.src = img.src;
    big.alt = img.alt;
    box.appendChild(big);
    box.addEventListener('click', function () { box.remove(); });
    document.addEventListener('keydown', function esc(ev) {
      if (ev.key === 'Escape') { box.remove(); document.removeEventListener('keydown', esc); }
    });
    document.body.appendChild(box);
  });

  /* ---------- 해시로 들어오면 접힌 섹션 펼치기 ---------- */
  function revealHash() {
    if (!location.hash) return;
    var target = document.querySelector(location.hash);
    if (!target) return;
    var parent = target.closest('details');
    while (parent) { parent.open = true; parent = parent.parentElement.closest('details'); }
    target.scrollIntoView();
  }
  window.addEventListener('hashchange', revealHash);
  revealHash();

  /* ---------- 집중 모드 (R3) ----------
     헤더의 ⤢ 버튼(.focus-btn[data-focus-target])은 지금은 아무 동작도
     하지 않는다. R3가 여기에 오버레이 열기/개념 이동/키보드(←/→/Esc/F)를
     붙인다. CSS 쪽 셸은 .focus-overlay(styles.css)에 이미 예약돼 있다.
     구현 시 주의: 열 때 현재 스크롤 위치를 저장해 닫을 때 복원할 것. */
})();
