/* KAIST ITM — About 페이지. data.js + lib.js + ui.js 로 그린다. */
(function () {
  'use strict';
  var D = window.ITM, L = window.ITMLib, U = window.ITMUI;
  if (!D || !L || !U) return;
  var P = D.profile, esc = U.esc;
  function $(id) { return document.getElementById(id); }
  function linkBtns(links) {
    return links.map(function (l) {
      return '<a class="btn btn-ghost" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + ' ↗</a>';
    }).join('');
  }

  function renderHero() {
    var facts = P.facts.map(function (f) {
      var v = f.url ? '<a href="' + esc(f.url) + '">' + esc(f.value) + '</a>' : esc(f.value);
      return '<div class="fact"><dt>' + esc(f.label) + '</dt><dd>' + v + '</dd></div>';
    }).join('');
    $('about-hero').innerHTML = U.avatar(P, 150) +
      '<div class="about-hero-text">' +
        '<p class="eyebrow">' + esc(P.cohort) + '</p>' +
        '<h1>' + esc(P.name) + ' <small>' + esc(P.nameEn) + ' · ' + esc(P.handle) + '</small></h1>' +
        '<p class="tagline">' + esc(P.tagline) + '</p>' +
        P.summary.map(function (s) { return '<p>' + esc(s) + '</p>'; }).join('') +
        '<dl class="facts">' + facts + '</dl>' +
        '<div class="about-links">' + linkBtns(P.links) + '</div>' +
      '</div>';
  }

  function renderInterests() {
    if (!P.interests.length) {
      $('interests-grid').innerHTML = '<div class="card"><p class="interest-empty">관심 연구 주제를 정리하고 있습니다. 곧 채워집니다.</p></div>';
      return;
    }
    $('interests-grid').innerHTML = P.interests.map(function (it, i) {
      return '<article class="card interest-card">' +
        '<span class="interest-no">' + (i < 9 ? '0' : '') + (i + 1) + '</span>' +
        '<h3>' + esc(it.title) + '</h3><p>' + esc(it.desc) + '</p></article>';
    }).join('');
  }

  var KIND = { career: '경력', education: '학력' };
  function renderCareer() {
    $('career-list').innerHTML = P.timeline.map(function (t) {
      return '<li class="ct-item ct-' + t.kind + '">' +
        '<span class="ct-period">' + esc(t.period) + '</span>' +
        '<div class="ct-body"><span class="ct-kind">' + KIND[t.kind] + '</span>' +
          '<h3>' + esc(t.role) + '</h3><p class="ct-org">' + esc(t.org) + '</p>' +
          (t.highlights && t.highlights.length
            ? '<ul>' + t.highlights.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>' : '') +
        '</div></li>';
    }).join('');
  }

  var CRED = [['patents', '특허'], ['awards', '수상'], ['certifications', '자격'], ['publications', '논문 · 발표']];
  function renderCredentials() {
    $('cred-grid').innerHTML = CRED.filter(function (c) { return P.credentials[c[0]].length; }).map(function (c) {
      return '<div class="card"><h3>' + c[1] + '</h3><ul>' +
        P.credentials[c[0]].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    }).join('');
  }

  function renderProjects() {
    $('itm-projects').innerHTML = L.groupByCategory(D.projects, D.projectCategories).map(function (g) {
      return '<div class="proj-group"><h3>' + esc(g.category.label) + '<small>' + esc(g.category.desc) + '</small></h3>' +
        '<ul class="proj-rows">' + g.items.map(function (p) {
          return '<li><div><strong>' + esc(p.title) + '</strong>' +
            '<span class="project-courses">' + U.projectCourses(p) + '</span></div>' + U.statusControl(p) + '</li>';
        }).join('') + '</ul></div>';
    }).join('');
  }

  function renderWorkflow() {
    $('workflow').innerHTML = D.workflow.map(function (w, i) {
      return (i ? '<span class="flow-arrow" aria-hidden="true">→</span>' : '') +
        '<div class="flow-step"><b>' + esc(w.step) + '</b>' + esc(w.desc) +
        (w.evidence ? '<br><a href="' + esc(w.evidence.url) + '">' + esc(w.evidence.label) + ' →</a>' : '') + '</div>';
    }).join('');
  }

  function renderContact() {
    $('contact-links').innerHTML =
      '<a class="btn btn-live" href="mailto:yenarue@gmail.com">yenarue@gmail.com</a>' + linkBtns(P.links);
  }

  renderHero();
  renderInterests();
  renderCareer();
  renderCredentials();
  renderProjects();
  renderWorkflow();
  renderContact();
})();
