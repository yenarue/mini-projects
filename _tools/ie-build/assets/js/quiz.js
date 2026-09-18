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

  var state = {};
  try { state = JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); } catch (e) { state = {}; }
  function saveState() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  var stage = document.getElementById('quiz-stage');
  var counter = document.getElementById('quiz-counter');
  var tally = document.getElementById('quiz-tally');
  var rangeSel = document.getElementById('quiz-range');
  var alwaysReveal = document.getElementById('quiz-always-reveal');
  var compareOnly = document.getElementById('quiz-compare-only');
  var againOnly = document.getElementById('quiz-again-only');
  var shuffleBox = document.getElementById('quiz-shuffle');
  var resetBtn = document.getElementById('quiz-reset');
  var prevBtn = document.getElementById('quiz-prev');
  var nextBtn = document.getElementById('quiz-next');
  var weekBoxes = Array.prototype.slice.call(document.querySelectorAll('.chip input[data-week]'));

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

  function rebuild() {
    var weeks = selectedWeeks();
    queue = ALL.filter(function (it) {
      if (weeks.indexOf(it.week) < 0) return false;
      if (onlyConceptId && it.conceptId !== onlyConceptId) return false;
      if (compareOnly.checked && !it.isComparison) return false;
      if (againOnly.checked && state[it.id] !== 'again') return false;
      return true;
    });
    if (shuffleBox.checked) shuffle(queue);
    pos = 0;
    render();
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
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
    var ans = ANSWERS[it.conceptId] || { title: '', en: '', html: '', href: it.href };
    var mark = state[it.id] || '';
    var open = alwaysReveal.checked;

    stage.innerHTML =
      '<article class="quiz-card' + (mark ? ' is-' + mark : '') + '">' +
        '<div class="quiz-card-head">' +
          '<span class="quiz-kind">' + (it.isComparison ? '비교형' : '서술형') + '</span>' +
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
          ans.html +
          '<p class="quiz-jump"><a href="' + ans.href + '">개념 전체 보기 (논점 · 보충 사례까지) →</a></p>' +
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
  [rangeSel, compareOnly, againOnly, shuffleBox].forEach(function (el) {
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
  rebuild();
})();
