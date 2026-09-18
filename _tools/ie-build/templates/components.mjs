export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]
  );
}

export function topbar({ active = '' } = {}) {
  const link = (href, label, key) =>
    `<a href="${href}"${active === key ? ' class="active"' : ''}>${label}</a>`;
  return `
<header class="topbar">
  <a class="topbar-home" href="index.html">혁신생태계론</a>
  <nav class="topbar-nav">
    ${link('index.html', '학기 지도', 'index')}
    ${link('quiz.html', '퀴즈', 'quiz')}
    ${link('map.html', '개념 지도', 'map')}
  </nav>
  <div class="topbar-right">
    <button type="button" id="search-open" class="search-trigger" aria-label="검색 열기">
      <span>검색</span><kbd>/</kbd>
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

export function legend() {
  return `
<p class="legend">
  <span class="legend-item">🗣 교수 발언</span>
  <span class="legend-item">📄 슬라이드</span>
  <span class="legend-item">💡 보충(외부 지식)</span>
</p>`;
}

export function statusBadge(status) {
  return status === 'done'
    ? '<span class="badge badge-done">완료</span>'
    : '<span class="badge badge-draft">초안</span>';
}

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
