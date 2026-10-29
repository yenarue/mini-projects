import { esc, topbar, sidebar, footer } from './components.mjs';
import { layout } from './layout.mjs';
import { polishHtml } from '../lib/transform.mjs';

/**
 * Term Paper 페이지(termpaper.html).
 *
 * 내용의 정본은 Google Drive `TermPaper/web/*.md`(lib/termpaper.mjs가 읽는다).
 * 섹션 카드는 주차 페이지의 개념 카드(.concept)와 같은 틀을 쓴다 — 사이드바
 * 스크롤 추적(js/main.js)과 본문 타이포를 그대로 물려받기 위해서다. 화면에 내기
 * 직전 polishHtml로 이모지·존칭을 정리하는 것도 주차 페이지와 같다.
 */
function sectionBlock(s) {
  const meta = [s.subtitle, s.updated ? `갱신 ${s.updated}` : ''].filter(Boolean);
  return `
<section class="concept" id="${esc(s.slug)}">
  <h2 class="concept-title">${esc(s.title)}</h2>
  ${meta.length ? `<div class="concept-meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>` : ''}
  ${polishHtml(s.html)}
  <p class="concept-top"><a href="#top">↑ 맨 위로</a></p>
</section>`;
}

export function renderTermPaperPage({ sections = [], weeks = [] }) {
  const navItems = sections.map((s, i) => ({
    href: `#${s.slug}`,
    slug: s.slug,
    no: String(s.n).padStart(2, '0'),
    title: s.title,
    active: i === 0,
    subItems: s.headings.map((h) => ({ href: `#${h.id}`, label: h.text, kind: 'h' })),
  }));

  const body = `
${topbar({ active: 'termpaper', weeks })}
<div class="layout" id="top">
  ${sidebar({
    chapterLabel: '개인 케이스 스터디',
    title: 'Term Paper',
    subtitle: 'Proposal 11/1 · 최종 제출 12/19',
    progressText: `섹션 ${sections.length}개`,
    navItems,
  })}
  <main>
    <div class="week-intro">
      <h1 class="week-title">Term Paper</h1>
      <p class="week-meta">과제 안내와 내 Term Paper 진행 내용을 모아 두는 곳입니다.</p>
    </div>
    ${sections.length
      ? sections.map(sectionBlock).join('\n')
      : '<p class="core-empty">아직 올린 내용이 없습니다.</p>'}
    ${footer()}
  </main>
</div>`;

  return layout({
    title: 'Term Paper — 혁신생태계론',
    description: 'Term Paper 과제 안내와 진행 내용',
    bodyClass: 'page-week page-termpaper',
    head: '<link rel="stylesheet" href="week.css">',
    body,
    scripts: ['js/main.js'],
  });
}
