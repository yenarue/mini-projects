/* KAIST ITM — 메인·About 페이지가 공유하는 표시 헬퍼 (window.ITMUI). data.js 다음에 로드. */
(function () {
  'use strict';
  var D = window.ITM;
  if (!D) return;
  var byCode = {};
  D.terms.forEach(function (t) { t.courses.forEach(function (c) { byCode[c.code] = c; }); });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function dot(code) {
    var c = byCode[code];
    return '<span class="course-dot" style="background:var(' + (c ? c.color : '--muted') + ')" aria-hidden="true"></span>';
  }
  function courseName(code) { var c = byCode[code]; return c ? c.name : code; }
  var EXTRA_LABEL = '과목 외 활동';
  function projectCourses(p) {
    if (!p.courses || !p.courses.length) return '<span class="activity-tag">' + esc(p.activity || EXTRA_LABEL) + '</span>';
    return p.courses.map(function (c) { return dot(c) + ' ' + esc(courseName(c)); }).join(' · ');
  }

  function chipRow(el, items, state, onChange) {
    el.innerHTML = items.map(function (i) {
      return '<button type="button" class="chip" data-key="' + esc(i.key) + '" aria-pressed="' +
        (state[i.key] ? 'true' : 'false') + '">' + (i.code ? dot(i.code) : '') + esc(i.label) + '</button>';
    }).join('');
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('.chip');
      if (!b) return;
      var k = b.getAttribute('data-key');
      state[k] = !state[k];
      b.setAttribute('aria-pressed', String(state[k]));
      onChange();
    });
  }

  function statusControl(p) {
    if (p.status === 'live') {
      return '<a class="btn btn-live" href="' + esc(p.url) + '">' + esc(p.linkLabel || '열어 보기') + ' →</a>' +
        (p.extraLinks || []).map(function (l) {
          return '<a class="btn btn-ghost" href="' + esc(l.url) + '">' + esc(l.label) + '</a>';
        }).join('') +
        (p.badge ? '<span class="badge-review">' + esc(p.badge) + '</span>' : '');
    }
    if (p.status === 'private') return '<span class="badge-private"><span aria-hidden="true">🔒</span>' + esc(p.label) + '</span>';
    return '<span class="badge-wip">준비 중</span>';
  }

  function avatar(P, size) {
    var s = size || 96;
    var dim = 'width:' + s + 'px;height:' + s + 'px';
    return P.photo
      ? '<img class="avatar" src="' + esc(P.photo) + '" alt="' + esc(P.name) + ' 프로필 사진" style="' + dim + '">'
      : '<div class="avatar avatar-fallback" style="' + dim + ';font-size:' + Math.round(s * 0.42) + 'px" aria-hidden="true">' +
        esc(P.name.charAt(0)) + '</div>';
  }

  window.ITMUI = { esc: esc, dot: dot, courseName: courseName, EXTRA_LABEL: EXTRA_LABEL, projectCourses: projectCourses,
    chipRow: chipRow, statusControl: statusControl, avatar: avatar };
})();
