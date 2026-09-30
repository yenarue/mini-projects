/* KAIST ITM 대시보드 메인 — data.js + lib.js + ui.js 로 각 섹션을 그린다. */
(function () {
  'use strict';
  var D = window.ITM, L = window.ITMLib, U = window.ITMUI;
  if (!D || !L || !U) return;
  var esc = U.esc, dot = U.dot, courseName = U.courseName;

  var today = new Date();
  var current = D.terms.filter(function (t) { return t.current; })[0];
  function $(id) { return document.getElementById(id); }
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
    if (n.state === 'live') {
      return '<a class="btn btn-live" href="' + esc(n.url) + '">' + esc(n.label) + '</a>' +
        ((c.notes && c.notes.extraLinks) || []).map(function (l) {
          return '<a class="btn btn-ghost" href="' + esc(l.url) + '">' + esc(l.label) + '</a>';
        }).join('');
    }
    if (n.state === 'private') {
      return '<span class="badge-private"><span aria-hidden="true">🔒</span>' + esc(n.label) + '</span>' +
        (n.url ? '<a class="btn btn-ghost" href="' + esc(n.url) + '">' + esc(n.urlLabel) + ' →</a>' : '');
    }
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
  var tlActive = {};
  current.courses.forEach(function (c) { tlActive[c.code] = true; });
  function applyTimelineFilter() {
    document.querySelectorAll('#timeline-body .tl-ev').forEach(function (el) {
      el.hidden = !tlActive[el.getAttribute('data-code')];
    });
  }
  function renderTimeline() {
    U.chipRow($('timeline-filters'), current.courses.map(function (c) {
      return { key: c.code, label: c.name, code: c.code };
    }), tlActive, applyTimelineFilter);
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

  /* ---------- 프로젝트 ---------- */
  var catActive = {}, pcActive = {}, CAT_LABEL = {};
  D.projectCategories.forEach(function (c) { catActive[c.id] = true; CAT_LABEL[c.id] = c.label; });
  var projCodes = L.usedCourseCodes(D.projects);
  projCodes.forEach(function (c) { pcActive[c] = true; });

  function renderProjectList() {
    var list = L.filterProjects(D.projects, { categories: catActive, courses: pcActive });
    $('projects-count').textContent = list.length + ' / ' + D.projects.length + '개';
    $('projects-grid').innerHTML = list.length ? list.map(function (p) {
      return '<article class="card project-card">' +
        '<span class="project-cat">' + esc(CAT_LABEL[p.category]) + '</span>' +
        '<h3>' + esc(p.title) + '</h3><p>' + esc(p.desc) + '</p>' +
        '<span class="project-courses">' + U.projectCourses(p) + '</span>' +
        '<div class="course-actions">' + U.statusControl(p) + '</div></article>';
    }).join('') : '<p class="empty">선택한 조건에 맞는 프로젝트가 없습니다.</p>';
  }
  function renderProjects() {
    U.chipRow($('project-cat-filters'), D.projectCategories.map(function (c) {
      return { key: c.id, label: c.label };
    }), catActive, renderProjectList);
    U.chipRow($('project-course-filters'), projCodes.map(function (code) {
      return code === L.EXTRA_KEY ? { key: code, label: U.EXTRA_LABEL } : { key: code, label: courseName(code), code: code };
    }), pcActive, renderProjectList);
    renderProjectList();
  }

  /* ---------- About 요약 카드 ---------- */
  function renderAboutCard() {
    var P = D.profile;
    $('about-card').innerHTML = U.avatar(P, 88) +
      '<div><p class="eyebrow">' + esc(P.cohort) + '</p>' +
      '<h3>' + esc(P.name) + ' <small>' + esc(P.nameEn) + '</small></h3>' +
      '<p class="about-card-tagline">' + esc(P.tagline) + '</p>' +
      '<p>' + esc(P.summary[0]) + '</p>' +
      '<a class="btn btn-live" href="about.html">About 더 보기 →</a></div>';
  }

  renderNow();
  renderCourses();
  renderTimeline();
  renderProjects();
  renderAboutCard();
})();
