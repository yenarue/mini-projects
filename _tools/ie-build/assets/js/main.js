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

  /* ---------- 인쇄: 접힌 섹션을 인쇄 직전에만 펼치기 ----------
     <details>가 닫혀 있으면 브라우저가 내용을 그리지 않는다(그 내용을 감싸는
     자식에 display:block !important를 줘도 안 그려진다 — Chromium이 open
     속성 자체로 렌더 여부를 결정하기 때문에 CSS만으로는 못 뚫는다). 그래서
     @media print의 CSS 트릭 대신 beforeprint/afterprint에서 open 속성을
     실제로 바꾼다. 사용자가 보던 접힘 상태는 인쇄가 끝나면 원래대로 되돌린다. */
  var printRestoreOpen = null;
  window.addEventListener('beforeprint', function () {
    printRestoreOpen = details.map(function (d) { return d.open; });
    details.forEach(function (d) { d.open = true; });
  });
  window.addEventListener('afterprint', function () {
    if (!printRestoreOpen) return;
    details.forEach(function (d, i) { d.open = printRestoreOpen[i]; });
    printRestoreOpen = null;
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

  /* ---------- 검색 ----------
     DOM 셸(#search-overlay, #search-input, #search-results, #search-open)은
     이미 templates/components.mjs의 topbar()가 모든 페이지에 찍어 둔다(이전
     작업에서 만든 것). 여기서는 그 위에 fetch → 매칭 → 렌더 → 키보드만 얹는다.

     변수명 주의: 아래쪽 "집중 모드" 블록이 이미 `overlay`라는 이름을 이 IIFE
     스코프에서 쓰고 있다(var는 함수 스코프라 같은 이름을 쓰면 서로 덮어쓴다).
     충돌을 피하려고 검색 쪽 변수는 전부 search 접두어를 붙인다. */
  var searchOverlay = document.getElementById('search-overlay');
  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');
  var searchOpenBtn = document.getElementById('search-open');
  var searchDocs = null; // 인덱스를 아직 못 불러왔으면 null
  var searchActiveIdx = -1;

  // file://로 이 사이트를 직접 열면(owner가 자주 그렇게 연다) fetch('search-index.json')가
  // 항상 실패한다 — file:// 문서에서의 fetch는 대부분 브라우저에서 로컬 파일 접근이
  // 막혀 있다(크롬은 net::ERR_FAILED). 매번 실패하는 걸 알면서 fetch를 시도해 콘솔에
  // 에러를 남기는 대신, 아예 fetch를 걸지 않고 검색창을 열자마자 이유와 해결책을
  // 보여준다("클릭했는데 아무 일도 안 일어남"이 제일 나쁜 결과).
  var isFileProtocol = location.protocol === 'file:';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function showNotice(html) {
    searchResults.innerHTML = '';
    var li = document.createElement('li');
    li.className = 'search-notice';
    li.innerHTML = html;
    searchResults.appendChild(li);
  }

  function loadIndex() {
    if (searchDocs) return Promise.resolve(searchDocs);
    return fetch('search-index.json')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        searchDocs = data.docs || [];
        return searchDocs;
      });
  }

  function openSearch() {
    if (!searchOverlay) return;
    searchOverlay.hidden = false;

    if (isFileProtocol) {
      searchInput.disabled = true;
      searchInput.placeholder = '검색은 서버로 열었을 때만 동작합니다';
      showNotice(
        '이 페이지를 파일로 직접 열면(<code>file://…</code>) 검색 데이터를 불러올 수 없습니다.<br>' +
        '터미널에서 이 폴더를 <code>python3 -m http.server</code> 같은 로컬 서버로 열고 ' +
        '<code>http://localhost:…</code> 주소로 다시 접속해 주세요.'
      );
      return;
    }

    searchInput.focus();
    searchInput.select();
    if (searchDocs) return;
    showNotice('검색 데이터를 불러오는 중…');
    loadIndex()
      .then(function () {
        if (searchInput.value.trim()) runSearch();
        else searchResults.innerHTML = '';
      })
      .catch(function () {
        showNotice('검색 데이터를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.');
      });
  }

  function closeSearch() {
    if (!searchOverlay) return;
    searchOverlay.hidden = true;
    searchActiveIdx = -1;
  }

  // 가중치. 한국어는 형태소 분석을 하지 않으므로(약속: 조사·활용형이 원문과
  // 다르면 매칭되지 않는다) 부분 문자열 매칭만 쓰고, 어느 필드에 맞았는지로
  // 순위를 매긴다. refs는 readings(frontmatter의 서지 정보, 예: "Callon (1994)
  // Is Science a Public Good? ★Core Reading")를 모은 필드다 — Callon·Jensen·
  // Polanyi처럼 저자명이 본문에는 안 나오고 읽기자료 인용에만 나오는 경우가
  // 실제 데이터에 있어서, title/en/tags/oneLine/body 다섯 필드만으로는 저자명
  // 검색이 아예 히트하지 않는다(자세한 근거는 task-9-report.md).
  var W_TITLE = 100;
  var W_EN = 60;
  var W_REFS = 55;
  var W_TAGS = 45;
  var W_ONELINE = 25;
  var W_BODY_BASE = 6;
  var W_BODY_PER_HIT = 2;
  var W_BODY_HIT_CAP = 5;

  function countHits(hay, needle) {
    if (!needle) return 0;
    var n = 0, i = 0;
    while (true) {
      i = hay.indexOf(needle, i);
      if (i === -1) break;
      n += 1;
      i += needle.length;
    }
    return n;
  }

  function scoreDoc(doc, tokens) {
    var total = 0;
    var title = (doc.title || '').toLowerCase();
    var en = (doc.en || '').toLowerCase();
    var refs = (doc.refs || '').toLowerCase();
    var tags = (doc.tags || []).join(' ').toLowerCase();
    var oneLine = (doc.oneLine || '').toLowerCase();
    var body = (doc.body || '').toLowerCase();

    for (var i = 0; i < tokens.length; i++) {
      var q = tokens[i];
      var inTitle = title.indexOf(q) >= 0;
      var inEn = en.indexOf(q) >= 0;
      var inRefs = refs.indexOf(q) >= 0;
      var inTags = tags.indexOf(q) >= 0;
      var inOneLine = oneLine.indexOf(q) >= 0;
      var bodyHits = countHits(body, q);
      // AND: 토큰 하나라도 아무 필드에도 없으면 이 문서는 탈락.
      if (!(inTitle || inEn || inRefs || inTags || inOneLine || bodyHits > 0)) return 0;

      var t = 0;
      if (inTitle) t += W_TITLE;
      if (inEn) t += W_EN;
      if (inRefs) t += W_REFS;
      if (inTags) t += W_TAGS;
      if (inOneLine) t += W_ONELINE;
      if (bodyHits > 0) t += W_BODY_BASE + W_BODY_PER_HIT * Math.min(bodyHits, W_BODY_HIT_CAP);
      total += t;
    }
    return total;
  }

  // 스니펫: 여러 토큰 중 (한 줄 정의 + 본문)에서 가장 먼저 등장하는 것을 기준으로
  // 앞뒤를 잘라내고, 등장한 토큰을 전부 <mark>로 감싼다. 순서가 중요하다 — 원문에는
  // <, &, 따옴표가 그대로 들어있으므로 먼저 이스케이프한 뒤에, 이스케이프된
  // 문자열 위에서 하이라이트 정규식을 돌린다(반대로 하면 <mark> 태그 자체가
  // 다시 이스케이프되어 화면에 글자로 보인다).
  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function findFirstHit(hay, tokens) {
    var lower = hay.toLowerCase();
    var best = -1;
    for (var i = 0; i < tokens.length; i++) {
      var at = lower.indexOf(tokens[i]);
      if (at !== -1 && (best === -1 || at < best)) best = at;
    }
    return best;
  }

  function highlight(safeText, tokens) {
    var parts = [];
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i]) parts.push(escapeRegExp(tokens[i]));
    }
    if (!parts.length) return safeText;
    var re = new RegExp('(' + parts.join('|') + ')', 'ig');
    return safeText.replace(re, '<mark>$1</mark>');
  }

  function snippet(doc, tokens) {
    var hay = (doc.oneLine ? doc.oneLine + ' ' : '') + (doc.body || '');
    var at = findFirstHit(hay, tokens);
    if (at === -1) {
      var fallback = doc.oneLine || doc.body || '';
      return escapeHtml(fallback.slice(0, 90));
    }
    var from = Math.max(0, at - 35);
    var raw = hay.slice(from, from + 120);
    var safe = escapeHtml(raw); // 먼저 이스케이프
    return (from > 0 ? '…' : '') + highlight(safe, tokens) + '…'; // 그다음 하이라이트
  }

  function runSearch() {
    if (!searchDocs) return;
    var q = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = '';
    searchActiveIdx = -1;
    if (q.length < 1) return;

    var tokens = q.split(/\s+/).filter(Boolean);
    var hits = searchDocs
      .map(function (d) { return { doc: d, s: scoreDoc(d, tokens) }; })
      .filter(function (h) { return h.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 20);

    if (!hits.length) {
      showNotice('일치하는 개념이 없습니다.');
      return;
    }

    hits.forEach(function (h) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = h.doc.href;
      a.innerHTML =
        '<span class="search-r-title">' + escapeHtml(h.doc.title) + '</span> ' +
        '<span class="search-r-meta">' + escapeHtml(h.doc.week) + ' · ' + escapeHtml(h.doc.en) + '</span>' +
        '<span class="search-r-snippet">' + snippet(h.doc, tokens) + '</span>';
      li.appendChild(a);
      searchResults.appendChild(li);
    });
  }

  function moveSearchActive(delta) {
    var items = searchResults.querySelectorAll('li:not(.search-notice)');
    if (!items.length) return;
    if (searchActiveIdx >= 0 && items[searchActiveIdx]) items[searchActiveIdx].classList.remove('active');
    searchActiveIdx = (searchActiveIdx + delta + items.length) % items.length;
    items[searchActiveIdx].classList.add('active');
    items[searchActiveIdx].scrollIntoView({ block: 'nearest' });
  }

  if (searchOpenBtn) searchOpenBtn.addEventListener('click', openSearch);
  if (searchInput) searchInput.addEventListener('input', runSearch);
  if (searchOverlay) searchOverlay.addEventListener('click', function (e) {
    if (e.target === searchOverlay) closeSearch();
  });

  document.addEventListener('keydown', function (e) {
    var active = document.activeElement;
    var typing = active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);

    if (searchOverlay && ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'))) {
      e.preventDefault();
      openSearch();
      return;
    }
    if (!searchOverlay || searchOverlay.hidden) return;

    if (e.key === 'Escape') { closeSearch(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSearchActive(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveSearchActive(-1); return; }
    if (e.key === 'Enter') {
      var items = searchResults.querySelectorAll('li:not(.search-notice)');
      var pick = searchActiveIdx >= 0 ? items[searchActiveIdx] : items[0];
      if (pick) {
        e.preventDefault();
        var link = pick.querySelector('a');
        if (link) link.click();
        closeSearch();
      }
    }
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
     §4.4. 헤더의 ⤢ 버튼(.focus-btn[data-focus-target]) 또는 F 키로 연다.
     오버레이 안의 개념 콘텐츠는 그 페이지에 이미 렌더된 section.concept를
     그대로 복제(cloneNode)해서 채운다 — 별도 렌더링도, 재요청(fetch)도 없다.
     함정: 복제하면 문서 안에 같은 id(개념 슬러그, 헤딩 앵커, step-card id 등)가
     두 벌 생긴다. getElementById/앵커가 깨지므로 복제본의 id는 전부 제거한다. */
  var concepts = Array.prototype.slice.call(document.querySelectorAll('section.concept'));
  if (concepts.length) {
    try { history.scrollRestoration = 'manual'; } catch (e) {}

    var overlay = null;
    var overlayBody = null;
    var positionEl = null;
    var dotsEl = null;
    var prevBtn = null;
    var nextBtn = null;
    var closeBtn = null;
    var currentIndex = -1;
    var savedScrollY = 0;
    var openerEl = null;

    function hashFor(index) { return '#focus-' + concepts[index].id; }

    function buildOverlay() {
      overlay = document.createElement('div');
      overlay.className = 'focus-overlay';
      overlay.id = 'focus-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', '집중 모드');
      overlay.hidden = true;

      var topbarEl = document.createElement('div');
      topbarEl.className = 'focus-topbar';

      positionEl = document.createElement('span');
      positionEl.className = 'focus-position';
      topbarEl.appendChild(positionEl);

      closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'focus-close';
      closeBtn.setAttribute('aria-label', '집중 모드 닫기 (Esc)');
      closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', closeFocus);
      topbarEl.appendChild(closeBtn);
      overlay.appendChild(topbarEl);

      overlayBody = document.createElement('div');
      overlayBody.className = 'focus-body';
      overlay.appendChild(overlayBody);

      // R4 Fix B — 오버레이 안(관련 개념 · 퀴즈 링크 등)에서 링크를 클릭하면
      // 오버레이가 안 닫힌 채 남는 버그(R3 report에서 지적됨)를 막는다.
      // conceptHref()가 만드는 href는 항상 "W01.html#c05"처럼 파일명을 포함하므로,
      // 그 파일명이 현재 페이지와 같으면 "같은 페이지의 다른 개념" 링크다 —
      // 이 경우는 오버레이를 닫는 대신 집중 모드 자체를 그 개념으로 옮긴다(이미
      // 몰입 읽기 중이던 흐름을 유지하는 것이 페이지로 내보냈다가 다시 열게 하는
      // 것보다 자연스럽다고 판단). 그 외 링크(퀴즈 페이지, 다른 주차 페이지,
      // 개념 지도, 또는 "맨 위로"처럼 이 페이지의 개념이 아닌 앵커)는 오버레이를
      // 먼저 닫아 원래 페이지로 돌아간 것처럼 보이게 한 뒤 기본 네비게이션이
      // 이어지게 둔다 — 오버레이가 독자가 이동한 콘텐츠를 계속 덮는 일이 없도록.
      overlayBody.addEventListener('click', function (e) {
        var a = e.target.closest ? e.target.closest('a[href]') : null;
        if (!a) return;
        var href = a.getAttribute('href') || '';
        if (!href) return;
        var hashIdx = href.indexOf('#');
        if (hashIdx !== -1) {
          var pagePart = href.slice(0, hashIdx);
          var currentFile = location.pathname.split('/').pop();
          var samePage = pagePart === '' || pagePart === currentFile;
          if (samePage) {
            var slug = href.slice(hashIdx + 1);
            var idx = concepts.findIndex(function (c) { return c.id === slug; });
            if (idx !== -1) {
              e.preventDefault();
              goTo(idx, true);
              return;
            }
          }
        }
        // 다른 페이지로 가는 링크이거나, 이 페이지 안이지만 개념이 아닌 앵커
        // (예: #top) — 오버레이만 닫고 링크의 기본 동작은 그대로 진행시킨다.
        closeFocus(true);
      });

      var bar = document.createElement('div');
      bar.className = 'focus-bar';

      prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'focus-nav focus-prev';
      prevBtn.textContent = '‹ 이전 개념';
      prevBtn.addEventListener('click', function () { goTo(currentIndex - 1, true); });
      bar.appendChild(prevBtn);

      dotsEl = document.createElement('div');
      dotsEl.className = 'focus-dots';
      dotsEl.setAttribute('role', 'tablist');
      dotsEl.setAttribute('aria-label', '개념 위치');
      concepts.forEach(function (c, i) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'focus-dot';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', (i + 1) + '번째 개념 · ' + c.id);
        dot.addEventListener('click', function () { goTo(i, true); });
        dotsEl.appendChild(dot);
      });
      bar.appendChild(dotsEl);

      nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'focus-nav focus-next';
      nextBtn.textContent = '다음 개념 ›';
      nextBtn.addEventListener('click', function () { goTo(currentIndex + 1, true); });
      bar.appendChild(nextBtn);

      overlay.appendChild(bar);
      document.body.appendChild(overlay);

      // 키보드는 오버레이가 열려있는 동안만 반응하고, 여기서 밖으로 새지 않는다
      // (stopPropagation은 안 쓴다 — 대신 열림 여부를 매번 검사).
      overlay.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); closeFocus(); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); goTo(currentIndex + 1, true); return; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(currentIndex - 1, true); return; }
        if (e.key === 'Tab') { trapTab(e); }
      });
    }

    function trapTab(e) {
      var focusables = Array.prototype.slice.call(
        overlay.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')
      ).filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }

    // 복제본에서 id를 전부 지운다 — 페이지 본문에 같은 id를 가진 원본이
    // 여전히 존재하는 동안 getElementById/#anchor가 둘 중 하나만 가리켜야 하므로.
    function stripIds(root) {
      if (root.hasAttribute && root.hasAttribute('id')) root.removeAttribute('id');
      var withIds = root.querySelectorAll ? root.querySelectorAll('[id]') : [];
      Array.prototype.forEach.call(withIds, function (el) { el.removeAttribute('id'); });
    }

    function renderConcept(index) {
      var clone = concepts[index].cloneNode(true);
      stripIds(clone);
      // 접힌 섹션(수업 논점·보충 사례·프레임에서의 위치·관련 개념·출처)은
      // 집중 모드에서는 전부 펼쳐서 보여준다 — 다시 클릭하게 하지 않는다.
      Array.prototype.forEach.call(clone.querySelectorAll('details'), function (d) { d.open = true; });

      overlayBody.innerHTML = '';
      overlayBody.appendChild(clone);
      overlayBody.scrollTop = 0;

      var dots = dotsEl.querySelectorAll('.focus-dot');
      Array.prototype.forEach.call(dots, function (d, i) {
        var active = i === index;
        d.classList.toggle('active', active);
        d.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      positionEl.textContent = '개념 ' + (index + 1) + ' / ' + concepts.length;
      prevBtn.disabled = index <= 0;
      nextBtn.disabled = index >= concepts.length - 1;
      currentIndex = index;
    }

    function goTo(index, updateUrl) {
      if (index < 0 || index >= concepts.length || index === currentIndex) return;
      renderConcept(index);
      if (updateUrl) {
        try { history.replaceState({ ieFocus: concepts[index].id }, '', hashFor(index)); } catch (e) {}
      }
    }

    // 사이드바 스크롤 추적(위쪽 THRESHOLD 로직)과 같은 기준으로, 지금 화면에
    // 보이는 개념을 찾는다 — F 키를 눌렀을 때 "지금 보고 있는 개념"을 연다.
    function conceptIndexInView() {
      var THRESHOLD = 96;
      var current = 0;
      for (var i = 0; i < concepts.length; i++) {
        if (concepts[i].getBoundingClientRect().top - THRESHOLD <= 0) current = i;
        else break;
      }
      return current;
    }

    function openFocus(index, pushUrl) {
      if (!overlay) buildOverlay();
      if (overlay.hidden) {
        savedScrollY = window.scrollY;
        openerEl = document.activeElement;
        document.body.classList.add('focus-lock');
        overlay.hidden = false;
        document.addEventListener('focus', keepFocusInside, true);
      }
      renderConcept(index);
      closeBtn.focus();
      if (pushUrl) {
        try { history.pushState({ ieFocus: concepts[index].id }, '', hashFor(index)); } catch (e) {}
      }
    }

    function closeFocus(skipUrl) {
      if (!overlay || overlay.hidden) return;
      overlay.hidden = true;
      document.body.classList.remove('focus-lock');
      document.removeEventListener('focus', keepFocusInside, true);
      window.scrollTo(0, savedScrollY);
      if (!skipUrl && location.hash.indexOf('#focus-') === 0) {
        try { history.pushState({}, '', location.pathname + location.search); } catch (e) {}
      }
      if (openerEl && typeof openerEl.focus === 'function') openerEl.focus();
      openerEl = null;
    }

    // 포커스 트랩 보강: 어떤 경로로든(마우스 클릭 등) 오버레이 밖 요소가
    // 포커스를 받으면 즉시 되돌린다. Tab 키 트랩(trapTab)과 이중 방어.
    function keepFocusInside(e) {
      if (overlay && !overlay.hidden && !overlay.contains(e.target)) {
        closeBtn.focus();
      }
    }

    document.querySelectorAll('.focus-btn[data-focus-target]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slug = btn.dataset.focusTarget;
        var idx = concepts.findIndex(function (c) { return c.id === slug; });
        openFocus(idx === -1 ? 0 : idx, true);
      });
    });

    // F 키: 입력창에 포커스가 있을 땐 무시. 오버레이가 이미 열려 있으면
    // (자체 keydown 핸들러가 Esc/←/→만 처리하므로) 여기서 그냥 무시해도 된다.
    window.addEventListener('keydown', function (e) {
      if (overlay && !overlay.hidden) return;
      if (e.key !== 'f' && e.key !== 'F') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      openFocus(conceptIndexInView(), true);
    });

    // URL 해시로 열고 닫힘을 반영한다: 직접 링크로 들어오거나 뒤로/앞으로
    // 가기 버튼을 눌러도 같은 상태가 재현된다.
    function syncFromHash() {
      var m = /^#focus-(.+)$/.exec(location.hash);
      if (m) {
        var idx = concepts.findIndex(function (c) { return c.id === m[1]; });
        if (idx !== -1) {
          if (!overlay || overlay.hidden) openFocus(idx, false);
          else renderConcept(idx);
          return;
        }
      }
      if (overlay && !overlay.hidden) closeFocus(true);
    }
    window.addEventListener('popstate', syncFromHash);
    syncFromHash();
  }
})();
