export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]
  );
}

/** §4.1 topbar: 브랜드 → 페이지 네비 → 글자크기 3단 → 검색 → 다크모드 */
export function topbar({ active = '' } = {}) {
  const link = (href, label, key) =>
    `<a href="${href}"${active === key ? ' class="active"' : ''}>${label}</a>`;
  return `
<header class="topbar">
  <a class="topbar-brand" href="index.html"><span class="dot" aria-hidden="true"></span>혁신생태계론</a>
  <nav class="topbar-nav">
    ${link('index.html', '학기 지도', 'index')}
    ${link('core.html', '핵심 개념', 'core')}
    ${link('quiz.html', '퀴즈', 'quiz')}
    ${link('map.html', '개념 지도', 'map')}
  </nav>
  <div class="topbar-right">
    <div class="fontsize-control" id="fontsize-control" role="group" aria-label="글자 크기">
      <button type="button" data-fontsize="sm" aria-label="글자 작게">A−</button>
      <button type="button" data-fontsize="md" aria-label="글자 보통">A</button>
      <button type="button" data-fontsize="lg" aria-label="글자 크게">A+</button>
    </div>
    <button type="button" id="search-open" class="search-trigger" aria-label="검색 열기">
      <span class="search-icon" aria-hidden="true"></span><span class="search-label">검색</span><kbd>/</kbd>
    </button>
    <button type="button" id="theme-toggle" class="icon-btn" aria-label="다크모드 전환">
      <span class="theme-icon" aria-hidden="true"></span>
    </button>
  </div>
</header>
<div class="search-overlay" id="search-overlay" hidden>
  <div class="search-panel" role="dialog" aria-modal="true" aria-label="개념 검색">
    <input type="search" id="search-input" placeholder="개념명 · 영어 · 태그 · 본문 검색" autocomplete="off">
    <ul class="search-results" id="search-results"></ul>
    <p class="search-hint">↑↓ 이동 · Enter 열기 · Esc 닫기</p>
  </div>
</div>`;
}

/**
 * §4.2 사이드바 셸. 주차 페이지가 개념 목록·이전/다음 주차 데이터를 채워 넣는다.
 * navItems: [{ href, no, title, slug, active, core, subItems }]
 *   core:     핵심개념 배지를 붙일지 (truthy면 붙인다)
 *   subItems: [{ href, label, kind }] — 그 개념 안의 소제목·섹션 목차.
 *             기본은 접혀 있고(CSS), 활성 개념에서만 펼쳐진다(js/main.js가 li에
 *             .is-open을 붙인다). kind는 'sec'(섹션 이름) 또는 'h'(본문 소제목).
 */
export function sidebar({
  chapterLabel,
  title,
  subtitle = '',
  progressText = '',
  navItems = [],
  prev = null, // { href, label }
  next = null, // { href, label }
} = {}) {
  const items = navItems.map((item) => {
    const subs = (item.subItems ?? []).map((s) => `
        <li><a href="${s.href}" class="side-sub-${s.kind ?? 'h'}" data-anchor="${esc(String(s.href).replace(/^#/, ''))}">${esc(s.label)}</a></li>`).join('');
    return `
    <li${item.slug ? ` data-item="${item.slug}"` : ''}${item.active ? ' class="is-open"' : ''}>
      <a href="${item.href}"${item.slug ? ` data-concept="${item.slug}"` : ''}${item.active ? ' class="active"' : ''}>
        <span class="side-no">${esc(item.no)}</span>
        <span class="side-title">${esc(item.title)}</span>
        ${item.core ? '<span class="side-core" title="쪽지시험 핵심 개념">핵심</span>' : ''}
      </a>
      ${subs ? `<ul class="side-sub">${subs}\n      </ul>` : ''}
    </li>`;
  }).join('');

  return `
<aside class="sidebar">
  ${chapterLabel ? `<div class="chapter-label">${esc(chapterLabel)}</div>` : ''}
  <h1>${esc(title)}</h1>
  ${subtitle ? `<p class="side-subtitle">${esc(subtitle)}</p>` : ''}
  ${progressText ? `<div class="side-progress">${esc(progressText)}</div>` : ''}
  <nav><ul class="side-nav">${items}</ul></nav>
  <div class="side-tools">
    <button type="button" id="expand-all" class="side-btn">전부 펼치기</button>
    <button type="button" id="collapse-all" class="side-btn">전부 접기</button>
  </div>
  <div class="side-prevnext">
    ${prev ? `<a href="${prev.href}">← ${esc(prev.label)}</a>` : '<span></span>'}
    ${next ? `<a href="${next.href}">${esc(next.label)} →</a>` : '<span></span>'}
  </div>
</aside>`;
}

export function legend() {
  return `
<p class="legend">
  <span class="legend-item">🗣 교수 발언</span>
  <span class="legend-item">📄 슬라이드</span>
  <span class="legend-item">💡 보충(외부 지식)</span>
</p>`;
}

/**
 * 시험 중요도 별점(5점 만점). 값의 출처는 `_tools/ie-build/importance.json`이고
 * 핵심개념 10에 뽑힌 개념은 lib/focus.mjs가 5점으로 올려 둔다.
 * why가 있으면 title에 넣어 "왜 이 점수인지"를 마우스로 확인할 수 있게 한다.
 */
export function stars(importance, max = 5) {
  if (!importance) return '';
  const n = Math.min(max, Math.max(0, Number(importance.stars) || 0));
  if (!n) return '';
  const label = `시험 중요도 ${n}/${max}`;
  const title = importance.why ? `${label} — ${importance.why}` : label;
  return `<span class="stars" title="${esc(title)}" aria-label="${esc(label)}" role="img" data-stars="${n}">` +
    `<span class="stars-on" aria-hidden="true">${'★'.repeat(n)}</span>` +
    `<span class="stars-off" aria-hidden="true">${'★'.repeat(max - n)}</span>` +
    `</span>`;
}

/** 쪽지시험 핵심 개념으로 뽑힌 개념에 붙는 배지. 핵심개념 페이지의 해당 항목으로 간다. */
export function coreBadge(coreRefs = []) {
  if (!coreRefs.length) return '';
  const first = coreRefs[0];
  const extra = coreRefs.length > 1 ? ` 외 ${coreRefs.length - 1}건` : '';
  const title = `Quiz ${first.quiz} 핵심 개념 ${first.n}번 — ${first.title}${extra}`;
  return `<a class="badge badge-core" href="${first.href}" title="${esc(title)}">핵심</a>`;
}

export function statusBadge(status) {
  return status === 'done'
    ? '<span class="badge badge-done">완료</span>'
    : '<span class="badge badge-draft">초안</span>';
}

// 서명 푸터 — 마크업은 기존 그대로 유지한다(스타일만 CSS에서 새로 입힌다).
export function footer() {
  return `
<footer class="site-footer">
  <p style="margin: 0 0 12px 0;">Made by <strong>Yena Kim (Yenarue)</strong> · <span class="footer-year"></span></p>
  <div class="site-footer-icons">
    <a href="mailto:yenarue@gmail.com" title="Email" onmouseover="this.style.color='#EA4335'" onmouseout="this.style.color='#666'">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
    </a>
    <a href="https://www.linkedin.com/in/yena-kim-yenarue" target="_blank" rel="noopener noreferrer" title="LinkedIn" onmouseover="this.style.color='#0A66C2'" onmouseout="this.style.color='#666'">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
    </a>
    <a href="https://github.com/yenarue" target="_blank" rel="noopener noreferrer" title="GitHub" onmouseover="this.style.color='#181717'" onmouseout="this.style.color='#666'">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>
    </a>
    <a href="https://www.instagram.com/yenarue" target="_blank" rel="noopener noreferrer" title="Instagram" onmouseover="this.style.color='#E1306C'" onmouseout="this.style.color='#666'">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
    </a>
  </div>
</footer>`;
}
