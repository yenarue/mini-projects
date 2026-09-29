/* KAIST ITM 대시보드 — data.js + lib.js 로 각 섹션을 그린다. */
(function () {
  'use strict';
  var D = window.ITM, L = window.ITMLib;
  if (!D || !L) return;

  var today = new Date();
  var current = D.terms.filter(function (t) { return t.current; })[0];
  var courseByCode = {};
  D.terms.forEach(function (t) { t.courses.forEach(function (c) { courseByCode[c.code] = c; }); });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function $(id) { return document.getElementById(id); }
  function dot(code) {
    var c = courseByCode[code];
    return '<span class="course-dot" style="background:var(' + (c ? c.color : '--muted') + ')" aria-hidden="true"></span>';
  }
  function courseName(code) { var c = courseByCode[code]; return c ? c.name : code; }
  function md(dateStr) { var d = L.parseDate(dateStr); return (d.getMonth() + 1) + '/' + d.getDate(); }
  var TYPE_LABEL = { presentation: '발표', assignment: '과제', exam: '시험', holiday: '휴강', class: '수업' };
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];

  /* ---------- 지금 ---------- */
  function renderNow() {
    var w = L.weekOf(current.start, today);
    $('now-week').textContent = w >= 1 && w <= 16 ? current.label + ' ' + w + '주차' : current.label;
    var list = L.upcomingDeadlines(D.events, today, 3);
    if (!list.length) {
      $('now-list').innerHTML = '<p class="card">남은 마감이 없습니다. 학기 끝!</p>';
      return;
    }
    $('now-list').innerHTML = list.map(function (e) {
      var n = L.daysBetween(today, L.parseDate(e.date));
      var d = L.parseDate(e.date);
      return '<div class="card now-item">' +
        '<span class="dday' + (n === 0 ? ' is-today' : '') + '">' + L.ddayLabel(n) + '</span>' +
        '<div><div class="now-meta">' + dot(e.course) + ' ' + esc(courseName(e.course)) + ' · ' +
        md(e.date) + '(' + DOW[d.getDay()] + ') · ' + TYPE_LABEL[e.type] + '</div>' +
        '<div class="now-title">' + esc(e.title) + '</div></div></div>';
    }).join('');
  }

  /* ---------- 과목 ---------- */
  function notesControl(c) {
    var n = L.resolveNotes(c.notes);
    if (n.state === 'live') return '<a class="btn btn-live" href="' + esc(n.url) + '">' + esc(n.label) + '</a>';
    if (n.state === 'private') return '<span class="badge-private"><span aria-hidden="true">🔒</span>' + esc(n.label) + '</span>';
    return '<span class="btn btn-planned" role="link" aria-disabled="true" title="곧 추가됩니다">' + esc(n.label) + '</span>';
  }
  function courseCard(c) {
    var sub = [c.professor && c.professor + ' 교수', c.schedule].filter(Boolean).join(' · ');
    var extra = (c.links || []).map(function (l) {
      return '<a class="btn btn-ghost" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + ' ↗</a>';
    }).join('');
    return '<article class="card course-card" style="--c:var(' + c.color + ')">' +
      '<span class="course-code">' + esc(c.code) + '</span>' +
      '<h3 class="course-name">' + esc(c.name) + '</h3>' +
      (sub ? '<span class="course-sub">' + esc(sub) + '</span>' : '') +
      '<div class="course-actions">' + notesControl(c) + extra + '</div></article>';
  }
  function renderCourses() {
    $('courses-body').innerHTML = D.terms.map(function (t) {
      var p = L.termProgress(t.courses);
      return '<details class="term"' + (t.current ? ' open' : '') + '>' +
        '<summary>' + esc(t.label) + ' <span class="progress-pill">개념정리 ' + p.done + '/' + p.total + '</span></summary>' +
        '<div class="grid">' + t.courses.map(courseCard).join('') + '</div></details>';
    }).join('');
  }

  /* ---------- 타임라인 ---------- */
  var active = {};
  current.courses.forEach(function (c) { active[c.code] = true; });

  function renderFilters() {
    $('timeline-filters').innerHTML = current.courses.map(function (c) {
      return '<button type="button" class="chip" data-code="' + esc(c.code) + '" aria-pressed="true">' +
        dot(c.code) + esc(c.name) + '</button>';
    }).join('');
    $('timeline-filters').addEventListener('click', function (ev) {
      var b = ev.target.closest('.chip');
      if (!b) return;
      var code = b.getAttribute('data-code');
      active[code] = !active[code];
      b.setAttribute('aria-pressed', String(active[code]));
      applyFilter();
    });
  }
  function applyFilter() {
    document.querySelectorAll('#timeline-body .tl-ev').forEach(function (el) {
      el.hidden = !active[el.getAttribute('data-code')];
    });
  }
  function renderTimeline() {
    var nowWeek = L.weekOf(current.start, today);
    var start = L.parseDate(current.start);
    $('timeline-body').innerHTML = L.groupByWeek(D.events, current.start).map(function (g) {
      var mon = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (g.week - 1) * 7);
      var cls = 'tl-week' + (g.week === nowWeek ? ' is-current' : g.week < nowWeek ? ' is-past' : '');
      var evs = g.events.map(function (e) {
        var deadline = L.DEADLINE_TYPES.indexOf(e.type) !== -1;
        return '<div class="tl-ev type-' + e.type + (deadline ? ' is-deadline' : '') + '" data-code="' + esc(e.course) + '">' +
          '<span class="tl-ev-date">' + md(e.date) + '</span>' + dot(e.course) +
          '<span>' + esc(e.title) + (e.note ? ' <small>(' + esc(e.note) + ')</small>' : '') + '</span>' +
          (deadline ? '<span class="tag">' + TYPE_LABEL[e.type] + '</span>' : '') +
          (e.tentative ? '<span class="tag tag-tentative">추정</span>' : '') + '</div>';
      }).join('');
      return '<div class="' + cls + '"' + (g.week === nowWeek ? ' aria-current="true"' : '') + '>' +
        '<div class="tl-label">' + g.week + '주차<small>' + (mon.getMonth() + 1) + '/' + mon.getDate() + '~</small></div>' +
        '<div class="tl-events">' + evs + '</div></div>';
    }).join('');
  }

  /* ---------- 결과물 ---------- */
  function renderProjects() {
    $('projects-grid').innerHTML = D.projects.map(function (p) {
      var action = p.status === 'live'
        ? '<a class="btn btn-live" href="' + esc(p.url) + '">열어 보기 →</a>'
        : '<span class="badge-wip">준비 중</span>';
      return '<article class="card project-card">' +
        '<span class="course-code">' + dot(p.course) + ' ' + esc(courseName(p.course)) + '</span>' +
        '<h3>' + esc(p.title) + '</h3><p>' + esc(p.desc) + '</p>' +
        '<div class="course-actions">' + action + '</div></article>';
    }).join('');
  }

  /* ---------- About ---------- */
  function renderAbout() {
    var P = D.profile;
    var career = P.career.map(function (c) {
      return '<li><span class="period">' + esc(c.period) + '</span><span><strong>' + esc(c.role) + ' · ' +
        esc(c.org) + '</strong>' + esc(c.desc) + '</span></li>';
    }).join('');
    var flow = D.workflow.map(function (w, i) {
      return (i ? '<span class="flow-arrow" aria-hidden="true">→</span>' : '') +
        '<div class="flow-step"><b>' + esc(w.step) + '</b>' + esc(w.desc) +
        (w.evidence ? '<br><a href="' + esc(w.evidence.url) + '">' + esc(w.evidence.label) + ' →</a>' : '') + '</div>';
    }).join('');
    var links = P.links.map(function (l) {
      return '<a class="btn btn-ghost" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + ' ↗</a>';
    }).join('');
    $('about-body').innerHTML =
      '<div class="about-grid">' +
        '<div class="card about-lede">' +
          '<p class="eyebrow">' + esc(P.cohort) + '</p>' +
          '<h3 style="margin:0 0 4px">' + esc(P.name) + ' <small style="color:var(--muted);font-weight:500">' + esc(P.nameEn) + ' · ' + esc(P.handle) + '</small></h3>' +
          '<p style="color:var(--muted);font-size:14px">' + esc(P.headline) + '</p>' +
          P.summary.map(function (s) { return '<p>' + esc(s) + '</p>'; }).join('') +
          '<div class="about-links">' + links + '</div>' +
        '</div>' +
        '<div class="card"><ul class="career">' + career + '</ul></div>' +
      '</div>' +
      '<div class="card" style="margin-top:14px"><h3 style="margin:0 0 4px;font-size:16px">공부하는 방법</h3>' +
        '<div class="flow">' + flow + '</div></div>';
  }

  renderNow();
  renderCourses();
  renderFilters();
  renderTimeline();
  renderProjects();
  renderAbout();
})();
