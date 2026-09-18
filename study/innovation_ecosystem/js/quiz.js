import { sortByImportance, applyFilters } from './quiz-logic.mjs';

(function () {
  'use strict';

  var raw = document.getElementById('quiz-data');
  if (!raw) return;
  var data = JSON.parse(raw.textContent);
  var ALL = data.items;
  var ANSWERS = data.answers;
  var SCHEDULE = data.quizSchedule;

  var STATE_KEY = 'ie-quiz-state';
  var PREF_KEY = 'ie-quiz-always-reveal';
  var SORT_KEY = 'ie-quiz-sort';
  var CORE_KEY = 'ie-quiz-core-only';
  var STARS_KEY = 'ie-quiz-stars-only';

  var state = {};
  try { state = JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); } catch (e) { state = {}; }
  function saveState() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  var stage = document.getElementById('quiz-stage');
  var counter = document.getElementById('quiz-counter');
  var tally = document.getElementById('quiz-tally');
  var rangeSel = document.getElementById('quiz-range');
  var sortSel = document.getElementById('quiz-sort');
  var alwaysReveal = document.getElementById('quiz-always-reveal');
  var compareOnly = document.getElementById('quiz-compare-only');
  var coreOnly = document.getElementById('quiz-core-only');
  var starsOnly = document.getElementById('quiz-stars-only');
  var againOnly = document.getElementById('quiz-again-only');
  var shuffleBox = document.getElementById('quiz-shuffle');
  var resetBtn = document.getElementById('quiz-reset');
  var prevBtn = document.getElementById('quiz-prev');
  var nextBtn = document.getElementById('quiz-next');
  var weekBoxes = Array.prototype.slice.call(document.querySelectorAll('.chip input[data-week]'));

  // 정렬·핵심 개념만·★4 이상만은 답 항상 펼치기와 같은 방식으로 localStorage에
  // 저장한다 — 저장된 값이 없으면 기본값(문서 순서, 필터 꺼짐)을 쓴다.
  try {
    var storedSort = localStorage.getItem(SORT_KEY);
    sortSel.value = storedSort === 'importance' ? 'importance' : 'doc';
  } catch (e) { sortSel.value = 'doc'; }
  try { coreOnly.checked = localStorage.getItem(CORE_KEY) === '1'; } catch (e) { coreOnly.checked = false; }
  try { starsOnly.checked = localStorage.getItem(STARS_KEY) === '1'; } catch (e) { starsOnly.checked = false; }

  var queue = [];
  var pos = 0;
  var onlyConceptId = null; // ?week=&c= 로 특정 개념만 골라 들어온 경우

  // 답 항상 펼치기는 저장된 값이 있으면 그것을, 없으면 브리핑 지침대로
  // "기본은 답이 보이는 상태"를 따른다 — 이 페이지의 기본 사용법은 질문을 보고
  // 바로 worked answer를 읽는 것이고, 답을 먼저 가리는 셀프테스트가 옵트인이다.
  try {
    var storedPref = localStorage.getItem(PREF_KEY);
    alwaysReveal.checked = storedPref === null ? true : storedPref === '1';
  } catch (e) { alwaysReveal.checked = true; }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function selectedWeeks() {
    var chosen = weekBoxes.filter(function (b) { return b.checked; })
      .map(function (b) { return b.dataset.week; });
    var rv = rangeSel.value;
    if (rv === 'all') return chosen;
    var q = SCHEDULE.filter(function (s) { return String(s.n) === rv; })[0];
    if (!q) return chosen;
    return chosen.filter(function (w) { return q.weeks.indexOf(w) >= 0; });
  }

  // 셔플과 정렬은 배타적으로 동작한다 — 셔플이 켜지면 정렬 선택은 의미가
  // 없으므로 비활성화해 둔다(값은 그대로 남아 있다가 셔플을 끄면 다시 적용된다).
  function syncSortShuffleExclusivity() {
    sortSel.disabled = shuffleBox.checked;
  }

  function rebuild() {
    queue = applyFilters(ALL, {
      weeks: selectedWeeks(),
      onlyConceptId: onlyConceptId,
      compareOnly: compareOnly.checked,
      coreOnly: coreOnly.checked,
      starsOnly: starsOnly.checked,
      againOnly: againOnly.checked,
      state: state,
    });
    if (shuffleBox.checked) {
      shuffle(queue);
    } else if (sortSel.value === 'importance') {
      queue = sortByImportance(queue);
    }
    pos = 0;
    render();
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  // templates/components.mjs의 stars()와 같은 마크업·클래스를 낸다(assets/styles.css
  // .stars/.stars-on/.stars-off를 그대로 입는다). 서버 쪽 stars()는 개념의 `why`까지
  // title에 넣지만, 퀴즈 데이터에는 별점만 실어 보낸다(PLAN.md Task 14 Step 1) —
  // 문항 카드에서는 "몇 점인지"만 한눈에 보이면 되고, 근거는 개념 페이지에 있다.
  function starsHtml(n) {
    n = Math.min(5, Math.max(0, Number(n) || 0));
    if (!n) return '';
    var label = '시험 중요도 ' + n + '/5';
    return '<span class="stars" title="' + esc(label) + '" aria-label="' + esc(label) + '" role="img" data-stars="' + n + '">' +
      '<span class="stars-on" aria-hidden="true">' + Array(n + 1).join('★') + '</span>' +
      '<span class="stars-off" aria-hidden="true">' + Array(5 - n + 1).join('★') + '</span>' +
    '</span>';
  }

  // 기존 .badge/.badge-core 스타일(assets/styles.css)을 그대로 쓴다 — 새 색은
  // 만들지 않는다. 쪽지시험 핵심개념 페이지의 특정 항목 링크(coreBadge())와
  // 달리, 퀴즈 문항에는 개념 단위의 coreRefs 목록을 통째로 보내지 않으므로
  // (Task 14 Step 1은 core만 boolean으로 carry) 링크가 아니라 라벨로만 표시한다.
  function coreBadgeHtml(isCore) {
    if (!isCore) return '';
    return '<span class="badge badge-core" title="쪽지시험 핵심 개념(core.html)으로 뽑힌 개념">핵심</span>';
  }

  function render() {
    counter.textContent = queue.length ? (pos + 1) + ' / ' + queue.length : '0 / 0';

    var known = 0, again = 0;
    for (var i = 0; i < queue.length; i++) {
      if (state[queue[i].id] === 'known') known++;
      else if (state[queue[i].id] === 'again') again++;
    }
    tally.textContent = queue.length ? '알았음 ' + known + ' · 다시 ' + again : '';

    prevBtn.disabled = pos <= 0;
    nextBtn.disabled = !queue.length || pos >= queue.length - 1;

    if (!queue.length) {
      // stage.innerHTML로 완전히 교체하므로 이전 문항의 id(ans-c05-h-a 등)는
      // 이 시점에 DOM에서 전부 사라진다 — 다음 문항의 같은 id와 동시에 존재하는
      // 일이 없다(Task 11 brief의 id 충돌 주의사항).
      stage.innerHTML = '<p class="quiz-empty">조건에 맞는 문제가 없다. 범위나 필터를 바꿔 보라.</p>';
      return;
    }

    var it = queue[pos];
    var ans = ANSWERS[it.conceptId] || { title: '', en: '', href: it.href, byIndex: {} };
    var answerHtml = (ans.byIndex || {})[it.index];
    var mark = state[it.id] || '';
    var open = alwaysReveal.checked;

    // 답안이 있으면 이 답이 교수님 모범답안이 아니라 AI가 쓴 학습 보조 자료임을
    // 못 박는 라벨을 답안 위에 붙인다(💡 보충 카테고리, --note 톤 재사용 —
    // assets/styles.css .quiz-answer-label). 답이 없으면 "아직 답안 없음"을 보여주되
    // 개념 전체 보기 링크는 항상 남긴다. "응용:" 문항은 애초에 정해진 답이 없는
    // 사고 실험형 프롬프트라 "아직 안 씀"과 다른 문구를 쓴다 — 그래야 읽는
    // 사람이 "답이 없어서 안 보이는 것"과 "원래 답이 없는 것"을 구분할 수 있다.
    var answerBody;
    if (answerHtml) {
      answerBody =
        '<div class="quiz-answer-label" role="note">' +
          '<span class="callout-badge" aria-hidden="true">💡</span>' +
          '<span>AI가 작성한 학습 보조 답안 — 교수님의 모범답안이 아닙니다</span>' +
        '</div>' +
        '<div class="concept quiz-answer-body">' + answerHtml + '</div>';
    } else if (it.isApplied) {
      answerBody = '<p class="quiz-no-answer quiz-no-answer-applied">이 문항은 <strong>응용 사고 문제</strong>라 정해진 모범답안이 없다. 스스로 답을 써 보고, 아래 링크에서 관련 개념을 확인하라.</p>';
    } else {
      answerBody = '<p class="quiz-no-answer">아직 답안 없음 — 아래 링크에서 개념 전체 자료로 직접 익혀 보라.</p>';
    }

    var kindLabel = it.isApplied ? '응용' : (it.isComparison ? '비교형' : '서술형');
    var kindClass = 'quiz-kind' + (it.isApplied ? ' quiz-kind-applied' : '');

    stage.innerHTML =
      '<article class="quiz-card' + (mark ? ' is-' + mark : '') + '">' +
        '<div class="quiz-card-head">' +
          '<span class="' + kindClass + '">' + kindLabel + '</span>' +
          starsHtml(it.stars) +
          coreBadgeHtml(it.core) +
          (mark ? '<span class="quiz-mark">' + (mark === 'known' ? '알았음' : '다시') + '</span>' : '') +
        '</div>' +
        '<div class="quiz-q">' + it.html + '</div>' +
        '<div class="quiz-actions"' + (open ? ' hidden' : '') + '>' +
          '<button type="button" class="side-btn" data-act="hint">힌트 (개념명)</button>' +
          '<button type="button" class="side-btn" data-act="reveal">답 보기</button>' +
        '</div>' +
        '<div class="quiz-hint"' + (open ? '' : ' hidden') + '>' +
          '<strong>' + esc(ans.title) + '</strong> · ' + esc(ans.en) +
          ' <span class="quiz-week">(' + esc(it.week) + ')</span>' +
        '</div>' +
        '<div class="quiz-answer"' + (open ? '' : ' hidden') + '>' +
          answerBody +
          '<p class="quiz-jump"><a href="' + ans.href + '">개념 전체 보기 (표·인용·슬라이드·다이어그램까지) →</a></p>' +
        '</div>' +
        '<div class="quiz-grade">' +
          '<button type="button" class="side-btn" data-act="known">알았음</button>' +
          '<button type="button" class="side-btn" data-act="again">다시</button>' +
        '</div>' +
      '</article>';
  }

  function reveal() {
    var hint = stage.querySelector('.quiz-hint');
    var answer = stage.querySelector('.quiz-answer');
    var actions = stage.querySelector('.quiz-actions');
    if (hint) hint.hidden = false;
    if (answer) answer.hidden = false;
    if (actions) actions.hidden = true;
  }

  stage.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var act = btn.dataset.act;
    var it = queue[pos];
    if (act === 'hint') {
      stage.querySelector('.quiz-hint').hidden = false;
      btn.hidden = true;
    } else if (act === 'reveal') {
      reveal();
    } else if (act === 'known' || act === 'again') {
      state[it.id] = act;
      saveState();
      if (pos < queue.length - 1) pos++;
      render();
    }
  });

  // 라이트박스(assets/js/main.js)는 문서 전체의 figure.slide img 클릭을 위임
  // 방식으로 듣고 있으므로, 답안 본문에 새로 삽입된 슬라이드 이미지도 별도
  // 배선 없이 그대로 동작한다.

  prevBtn.addEventListener('click', function () { if (pos > 0) { pos--; render(); } });
  nextBtn.addEventListener('click', function () { if (pos < queue.length - 1) { pos++; render(); } });

  document.addEventListener('keydown', function (e) {
    var overlay = document.getElementById('search-overlay');
    if (overlay && !overlay.hidden) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    if (e.key === 'ArrowRight') nextBtn.click();
    else if (e.key === 'ArrowLeft') prevBtn.click();
    else if (e.key === ' ') { e.preventDefault(); reveal(); }
  });

  alwaysReveal.addEventListener('change', function () {
    try { localStorage.setItem(PREF_KEY, alwaysReveal.checked ? '1' : '0'); } catch (e) {}
    render();
  });
  sortSel.addEventListener('change', function () {
    try { localStorage.setItem(SORT_KEY, sortSel.value); } catch (e) {}
    rebuild();
  });
  coreOnly.addEventListener('change', function () {
    try { localStorage.setItem(CORE_KEY, coreOnly.checked ? '1' : '0'); } catch (e) {}
    rebuild();
  });
  starsOnly.addEventListener('change', function () {
    try { localStorage.setItem(STARS_KEY, starsOnly.checked ? '1' : '0'); } catch (e) {}
    rebuild();
  });
  shuffleBox.addEventListener('change', function () {
    syncSortShuffleExclusivity();
    rebuild();
  });
  [rangeSel, compareOnly, againOnly].forEach(function (el) {
    el.addEventListener('change', rebuild);
  });
  weekBoxes.forEach(function (b) { b.addEventListener('change', rebuild); });
  resetBtn.addEventListener('click', function () {
    state = {};
    saveState();
    render();
  });

  /* URL 파라미터: quiz.html?quiz=1 / ?week=W01 / week.mjs가 예상 퀴즈 카드에서
     보내는 ?week=W01&c=c05(특정 개념 문항만 모아서 풀기) */
  var params = new URLSearchParams(location.search);
  if (params.get('quiz')) rangeSel.value = params.get('quiz');
  if (params.get('week')) {
    weekBoxes.forEach(function (b) { b.checked = b.dataset.week === params.get('week'); });
  }
  if (params.get('week') && params.get('c')) {
    onlyConceptId = params.get('week') + '/' + params.get('c');
  }
  syncSortShuffleExclusivity();
  rebuild();
})();
