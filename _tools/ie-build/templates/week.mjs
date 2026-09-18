import { esc, topbar, sidebar, legend, statusBadge, footer } from './components.mjs';
import { layout } from './layout.mjs';

/** 기본 펼침 섹션(§4.3: 한 줄 정의·쉽게 말하면·핵심 내용·예상 퀴즈). 나머지 4개는 <details>로 접는다. */
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

// 내용 변환(T1~T8, §5)은 R2의 몫이다. 여기서는 lib/render.mjs가 만든
// section.html을 그대로 새 카드 프레임 안에 넣기만 한다.
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

// §4.3 개념 카드 프레임: eyebrow(주차·번호) → 상태·집중모드 → 제목 → 영문/부제 →
// 메타 칩(슬라이드·태그) → 섹션들(펼침 4 + 접힘 4) → 관련 개념 → 맨 위로.
function conceptBlock(concept) {
  const chips = [
    ...(concept.slides ?? []).map((s) => `<span class="chip chip-slide">📄 ${esc(s)}</span>`),
    ...(concept.tags ?? []).map((t) => `<a class="chip chip-tag" href="map.html?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`),
  ].join(' ');

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
    <span class="concept-eyebrow">${esc(concept.week)} · 개념 ${String(concept.no).padStart(2, '0')}</span>
    <span class="concept-head-spacer"></span>
    <div class="concept-actions">
      ${statusBadge(concept.status)}
      <button type="button" class="focus-btn" data-focus-target="${concept.slug}" aria-label="집중 모드로 보기" title="집중 모드 (F)">⤢</button>
    </div>
  </header>
  <div class="concept-title-row">
    <h2>${esc(concept.title)}</h2>
    <p class="concept-en">${esc(concept.en)}${concept.subtitle ? ` — ${esc(concept.subtitle)}` : ''}</p>
  </div>
  ${chips ? `<p class="concept-meta">${chips}</p>` : ''}
  ${concept.sections.map((s) => sectionBlock(concept, s)).join('\n')}
  ${related ? `<p class="concept-related">관련: ${related}</p>` : ''}
  <p class="concept-top"><a href="#top">↑ 맨 위로</a></p>
</section>`;
}

function weekSidebar(week, weeks) {
  const idx = weeks.findIndex((w) => w.id === week.id);
  const prevWeek = weeks.slice(0, idx).reverse().find((w) => w.concepts?.length);
  const nextWeek = weeks.slice(idx + 1).find((w) => w.concepts?.length);

  const navItems = week.concepts.map((c) => ({
    href: `#${c.slug}`,
    slug: c.slug,
    no: String(c.no).padStart(2, '0'),
    title: c.title,
  }));

  return sidebar({
    chapterLabel: `${week.id} · ${week.date.slice(5).replace('-', '/')}`,
    title: week.topic,
    subtitle: week.subtitle,
    progressText: `개념 ${week.concepts.length}개 · 완료 ${week.concepts.filter((c) => c.status === 'done').length}개`,
    navItems,
    prev: prevWeek ? { href: `${prevWeek.id}.html`, label: prevWeek.id } : null,
    next: nextWeek ? { href: `${nextWeek.id}.html`, label: nextWeek.id } : null,
  });
}

export function renderWeekPage({ week, weeks }) {
  const body = `
${topbar({})}
<div class="layout" id="top">
  ${weekSidebar(week, weeks)}
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
