import { esc, topbar, sidebar, stars, footer } from './components.mjs';
import { layout } from './layout.mjs';

/**
 * 쪽지시험 핵심 개념 페이지(core.html).
 *
 * 내용의 정본은 `개념정리/쪽지시험_핵심개념/*.md`다. 이 템플릿은 그것을 항목 카드로
 * 배치하고, 각 항목에서 주차 페이지의 개념 상세로 건너갈 수 있는 링크를 붙인다.
 * 퀴즈 회차가 늘면 core-concepts.json에 세트를 추가하는 것만으로 이 페이지에 쌓인다.
 */

function itemBlock(item) {
  const meta = item.meta
    .map((m) => `<span class="chip chip-meta"><b>${esc(m.label)}</b> ${esc(m.value)}</span>`)
    .join(' ');

  const link = (c) => `<a class="btn btn-quiet" href="${esc(c.week)}.html#${esc(c.slug)}">${esc(c.week)} · ${esc(c.title)} →</a>`;
  const links = item.concepts.map(link).join(' ');
  const alsoLinks = (item.also ?? []).map(link).join(' ');

  const importance = item.concepts.length
    ? item.concepts.reduce((best, c) => (
      (c.importance?.stars ?? 0) > (best?.stars ?? 0) ? c.importance : best
    ), null)
    : null;

  return `
<article class="core-item" id="${esc(item.anchor)}">
  <header class="core-item-head">
    <span class="core-no">${String(item.n).padStart(2, '0')}</span>
    <h3>${esc(item.title)}</h3>
    ${stars(importance)}
  </header>
  ${meta ? `<p class="core-meta">${meta}</p>` : ''}
  <div class="core-body">${item.bodyHtml}</div>
  ${links
    ? `<p class="core-links"><span class="core-links-label">개념 상세</span>${links}</p>`
    : '<p class="core-links core-links-empty">연결된 개념 정리가 아직 없다.</p>'}
  ${alsoLinks ? `<p class="core-links core-links-also"><span class="core-links-label">함께 보기</span>${alsoLinks}</p>` : ''}
</article>`;
}

function setBlock(set, quiz) {
  const scope = quiz ? quiz.weeks.join(' · ') : '';
  return `
<section class="core-set" id="quiz${set.quiz}">
  <header class="core-set-head">
    <p class="eyebrow">Quiz ${set.quiz}${quiz ? ` · ${esc(quiz.date)}` : ''}${scope ? ` · 누적 범위 ${esc(scope)}` : ''}</p>
    <h2>${esc(set.title || set.label)}</h2>
    ${set.introHtml ? `<div class="core-intro">${set.introHtml}</div>` : ''}
    <p class="core-set-actions">
      <a class="btn btn-primary" href="quiz.html?quiz=${set.quiz}">이 범위 퀴즈 풀기 →</a>
    </p>
  </header>
  ${set.items.map(itemBlock).join('\n')}
</section>`;
}

export function renderCorePage({ coreSets, quizSchedule = [] }) {
  const quizById = new Map(quizSchedule.map((q) => [q.n, q]));
  const multi = coreSets.length > 1;

  const navItems = coreSets.flatMap((set) =>
    set.items.map((item) => ({
      href: `#${item.anchor}`,
      slug: item.anchor,
      no: multi ? `${set.quiz}-${item.n}` : String(item.n).padStart(2, '0'),
      title: item.title,
      // 이 페이지는 전부 핵심 개념이라 항목마다 배지를 붙이면 의미가 없다.
    }))
  );

  const first = coreSets[0];
  const body = `
${topbar({ active: 'core' })}
<div class="layout" id="top">
  ${sidebar({
    chapterLabel: '쪽지시험 대비',
    title: '핵심 개념',
    subtitle: multi ? `${coreSets.length}개 회차` : (first ? `Quiz ${first.quiz}` : ''),
    progressText: `항목 ${navItems.length}개`,
    navItems,
    prev: { href: 'index.html', label: '학기 지도' },
    next: first ? { href: `quiz.html?quiz=${first.quiz}`, label: '퀴즈' } : null,
  })}
  <main>
    <p class="breadcrumb"><a href="index.html">학기 지도</a> › 핵심 개념</p>
    <div class="week-intro">
      <h1 class="week-title">쪽지시험 핵심 개념</h1>
      <p class="week-meta">
        퀴즈 범위에서 먼저 볼 개념을 추린 목록이다. 실제 출제 목록이 아니라 공부 우선순위이고,
        각 항목에서 그 개념의 전체 정리로 바로 넘어갈 수 있다.
      </p>
    </div>
    ${coreSets.length
      ? coreSets.map((set) => setBlock(set, quizById.get(set.quiz))).join('\n')
      : '<p class="core-empty">아직 정리된 핵심 개념 세트가 없다.</p>'}
    <p class="concept-top"><a href="#top">↑ 맨 위로</a></p>
    ${footer()}
  </main>
</div>`;

  return layout({
    title: '쪽지시험 핵심 개념 — 혁신생태계론',
    description: '퀴즈 회차별 핵심 개념과 개념 상세 페이지로 가는 링크',
    bodyClass: 'page-core',
    body,
    scripts: ['js/main.js'],
  });
}
