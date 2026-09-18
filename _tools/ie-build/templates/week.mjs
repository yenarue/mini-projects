import { esc, topbar, legend, statusBadge, footer } from './components.mjs';
import { layout } from './layout.mjs';

/** 기본 펼침 섹션. 나머지는 <details>로 접는다. */
const OPEN_SECTIONS = new Set(['definition', 'analogy', 'core', 'quiz']);

const SECTION_LABEL = {
  definition: '한 줄 정의',
  analogy: '쉽게 말하면',
  core: '핵심 내용',
  discussion: '수업에서 나온 논점',
  examples: '보충 사례',
  position: '수업 프레임에서의 위치',
  related: '관련 개념 · 논문',
  quiz: '예상 퀴즈 포인트',
  mynotes: '나의 이해 / 질문',
  other: '기타',
};

function sectionBlock(concept, section) {
  const label = SECTION_LABEL[section.key] ?? section.heading;
  const id = `${concept.slug}-${section.key}`;

  if (section.key === 'mynotes') {
    if (!concept.hasMyNotes) return '';
    return `<div class="sec sec-mynotes"><h4>${esc(label)}</h4>${section.html}</div>`;
  }
  if (section.key === 'quiz') {
    return `<div class="sec sec-quiz">
  <h4>${esc(label)}</h4>
  ${section.html}
  <p class="sec-quiz-link"><a href="quiz.html?week=${encodeURIComponent(concept.week)}&amp;c=${concept.slug}">퀴즈 모드로 풀기 →</a></p>
</div>`;
  }
  if (section.key === 'definition' || section.key === 'analogy') {
    return `<div class="sec sec-${section.key}"><h4>${esc(label)}</h4>${section.html}</div>`;
  }
  if (OPEN_SECTIONS.has(section.key)) {
    return `<div class="sec sec-${section.key}"><h4>${esc(label)}</h4>${section.html}</div>`;
  }
  return `<details class="sec sec-fold" data-sec="${id}">
  <summary>${esc(label)}</summary>
  <div class="sec-body">${section.html}</div>
</details>`;
}

function conceptBlock(concept) {
  const tags = (concept.tags ?? [])
    .map((t) => `<a class="tag" href="map.html?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`)
    .join(' ');
  const slides = (concept.slides ?? []).map((s) => `<span class="meta-slide">📄 ${esc(s)}</span>`).join(' ');
  const related = (concept.related ?? [])
    .map((r) => {
      const label = esc(r.title || `${r.week}/${String(r.no).padStart(2, '0')}`);
      // 아직 쓰이지 않은 개념은 링크를 걸지 않는다 — 존재하지 않는 앵커로
      // 보내는 대신, 연결은 있지만 아직 작성되지 않았다는 것만 텍스트로 보여준다.
      return r.resolved
        ? `<a href="${r.href}">${label}</a>`
        : `<span class="related-pending" title="아직 작성되지 않은 개념">${label}</span>`;
    })
    .join(' · ');

  return `
<section class="concept" id="${concept.slug}">
  <header class="concept-head">
    <div class="concept-no">${String(concept.no).padStart(2, '0')}</div>
    <div class="concept-title">
      <h2>${esc(concept.title)}</h2>
      <p class="concept-en">${esc(concept.en)}</p>
      ${concept.subtitle ? `<p class="concept-subtitle">${esc(concept.subtitle)}</p>` : ''}
    </div>
    ${statusBadge(concept.status)}
  </header>
  <p class="concept-meta">${slides} ${tags}</p>
  ${concept.sections.map((s) => sectionBlock(concept, s)).join('\n')}
  ${related ? `<p class="concept-related">관련: ${related}</p>` : ''}
  <p class="concept-top"><a href="#top">↑ 맨 위로</a></p>
</section>`;
}

function sidebar(week, weeks) {
  const idx = weeks.findIndex((w) => w.id === week.id);
  const prev = weeks.slice(0, idx).reverse().find((w) => w.concepts?.length);
  const next = weeks.slice(idx + 1).find((w) => w.concepts?.length);

  const items = week.concepts.map((c) => `
    <li>
      <a href="#${c.slug}" data-concept="${c.slug}">
        <span class="side-no">${String(c.no).padStart(2, '0')}</span>
        <span class="side-title">${esc(c.title)}</span>
      </a>
    </li>`).join('');

  return `
<aside>
  <div class="chapter-label">${esc(week.id)} · ${esc(week.date.slice(5).replace('-', '/'))}</div>
  <h1>${esc(week.topic)}</h1>
  ${week.subtitle ? `<p class="side-subtitle">${esc(week.subtitle)}</p>` : ''}
  <div class="side-progress">개념 ${week.concepts.length}개 · 완료 ${week.concepts.filter((c) => c.status === 'done').length}개</div>
  <nav><ul class="side-nav">${items}</ul></nav>
  <div class="side-tools">
    <button type="button" id="expand-all" class="side-btn">전부 펼치기</button>
    <button type="button" id="collapse-all" class="side-btn">전부 접기</button>
  </div>
  <div class="side-prevnext">
    ${prev ? `<a href="${prev.id}.html">← ${esc(prev.id)}</a>` : '<span></span>'}
    ${next ? `<a href="${next.id}.html">${esc(next.id)} →</a>` : '<span></span>'}
  </div>
</aside>`;
}

export function renderWeekPage({ week, weeks }) {
  const body = `
${topbar({})}
<div class="layout" id="top">
  ${sidebar(week, weeks)}
  <main>
    <p class="breadcrumb"><a href="index.html">학기 지도</a> › ${esc(week.id)} · ${esc(week.topic)}</p>
    <div class="week-intro">
      <h1 class="week-title">${esc(week.topic)}</h1>
      <p class="week-meta">${esc(week.date)} · 개념 ${week.concepts.length}개${week.source ? ` · 자료 <code>${esc(week.source)}</code>` : ''}</p>
      ${legend()}
    </div>
    ${week.concepts.map(conceptBlock).join('\n')}
    ${footer()}
  </main>
</div>`;

  return layout({
    title: `${week.id} · ${week.topic} — 혁신생태계론`,
    description: `${week.topic} 개념 정리 ${week.concepts.length}개`,
    bodyClass: 'page-week',
    body,
    scripts: ['js/main.js'],
  });
}
