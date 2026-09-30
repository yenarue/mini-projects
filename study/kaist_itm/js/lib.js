/* KAIST ITM 대시보드 — 순수 로직. 브라우저(window.ITMLib)와 node(require) 겸용.
   날짜는 모두 로컬 자정 기준으로 다룬다(시간대 섞임 방지). */
(function (root, factory) {
  var lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.ITMLib = lib;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY = 24 * 60 * 60 * 1000;
  var DEADLINE_TYPES = ['presentation', 'assignment', 'exam'];

  function parseDate(s) {
    var p = String(s).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function midnight(dt) {
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  }

  function daysBetween(from, to) {
    return Math.round((midnight(to) - midnight(from)) / DAY);
  }

  function weekOf(termStart, today) {
    var n = daysBetween(parseDate(termStart), today);
    return n < 0 ? 0 : Math.floor(n / 7) + 1;
  }

  function ddayLabel(n) {
    if (n === 0) return 'D-DAY';
    return n > 0 ? 'D-' + n : 'D+' + (-n);
  }

  function byDate(a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  }

  function upcomingDeadlines(events, today, n) {
    if (n === undefined) n = 3;
    return events
      .filter(function (e) {
        return DEADLINE_TYPES.indexOf(e.type) !== -1 && daysBetween(today, parseDate(e.date)) >= 0;
      })
      .sort(byDate)
      .slice(0, n);
  }

  function resolveNotes(notes) {
    notes = notes || {};
    if (notes.status === 'private') {
      var priv = { state: 'private', url: null, label: notes.label || '비공개' };
      if (notes.url) { priv.url = notes.url; priv.urlLabel = notes.urlLabel || '공개 개요 보기'; }
      return priv;
    }
    if (notes.status === 'live' && notes.url) {
      return { state: 'live', url: notes.url, label: '개념정리 →' };
    }
    return {
      state: 'planned', url: null,
      label: notes.eta ? '개념정리 · ' + notes.eta + ' 예정' : '개념정리 · 준비 중'
    };
  }

  function termProgress(courses) {
    var done = 0, total = 0;
    courses.forEach(function (c) {
      var s = resolveNotes(c.notes).state;
      if (s === 'private') return;
      total++;
      if (s === 'live') done++;
    });
    return { done: done, total: total };
  }

  function groupByWeek(events, termStart) {
    var map = {};
    events.slice().sort(byDate).forEach(function (e) {
      var w = weekOf(termStart, parseDate(e.date));
      (map[w] = map[w] || []).push(e);
    });
    return Object.keys(map).map(Number).sort(function (a, b) { return a - b; })
      .map(function (w) { return { week: w, events: map[w] }; });
  }

  // 'YYYY' 또는 'YYYY.MM' 기준 최신순. 빈 연도는 뒤로, 같은 연도는 원래 순서 유지(원본 불변)
  function sortByYearDesc(items) {
    return items
      .map(function (it, i) { return { it: it, i: i }; })
      .sort(function (a, b) {
        var ya = a.it.year || '', yb = b.it.year || '';
        if (ya === yb) return a.i - b.i;
        if (!ya) return 1;
        if (!yb) return -1;
        return ya < yb ? 1 : -1;
      })
      .map(function (x) { return x.it; });
  }

  var EXTRA_KEY = '_extra';

  function projectKeys(p) {
    return p.courses && p.courses.length ? p.courses : [EXTRA_KEY];
  }

  function filterProjects(projects, active) {
    return projects.filter(function (p) {
      return !!active.categories[p.category] &&
        projectKeys(p).some(function (c) { return !!active.courses[c]; });
    });
  }

  function usedCourseCodes(projects) {
    var seen = {}, out = [], extra = false;
    projects.forEach(function (p) {
      if (!p.courses || !p.courses.length) { extra = true; return; }
      p.courses.forEach(function (c) {
        if (!seen[c]) { seen[c] = true; out.push(c); }
      });
    });
    if (extra) out.push(EXTRA_KEY);
    return out;
  }

  function groupByCategory(projects, categories) {
    return categories
      .map(function (c) {
        return { category: c, items: projects.filter(function (p) { return p.category === c.id; }) };
      })
      .filter(function (g) { return g.items.length > 0; });
  }

  return {
    DEADLINE_TYPES: DEADLINE_TYPES,
    parseDate: parseDate, daysBetween: daysBetween, weekOf: weekOf, ddayLabel: ddayLabel,
    upcomingDeadlines: upcomingDeadlines, resolveNotes: resolveNotes,
    termProgress: termProgress, groupByWeek: groupByWeek,
    sortByYearDesc: sortByYearDesc, EXTRA_KEY: EXTRA_KEY, filterProjects: filterProjects, usedCourseCodes: usedCourseCodes, groupByCategory: groupByCategory
  };
});
