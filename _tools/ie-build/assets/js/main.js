(function () {
  'use strict';

  /* ---------- 푸터 연도 ---------- */
  document.querySelectorAll('.footer-year').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- 다크모드 ---------- */
  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (dark) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('ie-theme', dark ? 'light' : 'dark'); } catch (e) {}
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

  /* ---------- 사이드바 스크롤 추적 ---------- */
  var links = {};
  document.querySelectorAll('.side-nav a[data-concept]').forEach(function (a) {
    links[a.dataset.concept] = a;
  });
  var concepts = Array.prototype.slice.call(document.querySelectorAll('section.concept'));
  if (concepts.length && 'IntersectionObserver' in window) {
    var visible = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible.add(e.target.id);
        else visible.delete(e.target.id);
      });
      var first = concepts.find(function (c) { return visible.has(c.id); });
      Object.keys(links).forEach(function (k) { links[k].classList.remove('active'); });
      if (first && links[first.id]) {
        links[first.id].classList.add('active');
        // aside가 실제로 스크롤이 필요한 경우에만 scrollIntoView를 호출한다.
        // 그렇지 않으면(사이드바에 모든 항목이 이미 다 보이는 경우) 매 intersection
        // 업데이트마다 불필요하게 호출되어, 메인 창에서 진행 중인 smooth scroll
        // (예: 개념 링크 클릭 → 해당 섹션으로 스크롤)을 중간에 끊어버린다.
        var side = links[first.id].closest('aside');
        if (side && side.scrollHeight > side.clientHeight) {
          var linkRect = links[first.id].getBoundingClientRect();
          var sideRect = side.getBoundingClientRect();
          var outOfView = linkRect.top < sideRect.top || linkRect.bottom > sideRect.bottom;
          if (outOfView) links[first.id].scrollIntoView({ block: 'nearest' });
        }
      }
    }, { rootMargin: '-70px 0px -70% 0px' });
    concepts.forEach(function (c) { io.observe(c); });
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
})();
