import { esc, topbar, sidebar, legend, statusBadge, stars, coreBadge, footer } from './components.mjs';
import { layout } from './layout.mjs';
import { sourcePanel, quizCards } from '../lib/transform.mjs';

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
    return `<div class="sec sec-mynotes" id="${id}"><h4>${esc(label)}</h4>${section.html}</div>`;
  }
  if (section.key === 'quiz') {
    // T8(REDESIGN.md §5): 예상 퀴즈 포인트 목록을 번호 카드 + 비교형/서술형 배지로.
    // isComparison은 renderConcept이 이미 계산해 둔 값을 그대로 쓴다(재계산 금지).
    const cards = quizCards(concept.quizPoints);
    return `<div class="sec sec-quiz" id="${id}">
  <h4>${esc(label)}</h4>
  ${cards || section.html}
  <p class="sec-quiz-link"><a href="quiz.html?week=${encodeURIComponent(concept.week)}&amp;c=${concept.slug}">퀴즈 모드로 풀기 →</a></p>
</div>`;
  }
  if (section.key === 'definition' || section.key === 'analogy') {
    return `<div class="sec sec-${section.key}" id="${id}"><h4>${esc(label)}</h4>${section.html}</div>`;
  }
  if (OPEN_SECTIONS.has(section.key)) {
    return `<div class="sec sec-${section.key}" id="${id}"><h4>${esc(label)}</h4>${section.html}</div>`;
  }
  return `<details class="sec sec-fold" id="${id}" data-sec="${id}">
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
      ${coreBadge(concept.coreRefs)}
      ${stars(concept.importance)}
      ${statusBadge(concept.status)}
      <button type="button" class="focus-btn" data-focus-target="${concept.slug}" aria-label="집중 모드로 보기" title="집중 모드 (F)">⤢</button>
    </div>
  </header>
  <div class="concept-title-row">
    <h2>${esc(concept.title)}</h2>
    <p class="concept-en">${esc(concept.en)}${concept.subtitle ? ` — ${esc(concept.subtitle)}` : ''}</p>
  </div>
  ${chips ? `<p class="concept-meta">${chips}</p>` : ''}
  ${sourcePanel(concept)}
  ${concept.sections.map((s) => sectionBlock(concept, s)).join('\n')}
  ${related ? `<p class="concept-related">관련: ${related}</p>` : ''}
  <p class="concept-top"><a href="#top">↑ 맨 위로</a></p>
</section>`;
}

/**
 * 사이드바에 붙일 개념 내부 목차.
 *
 * 한 줄 정의·쉽게 말하면·핵심 내용 셋은 화면에서도 작은 라벨로만 구분되는
 * "개념의 본문"이므로 목차에서도 항목 셋으로 쪼개지 않고 하나로 묶는다.
 * 그 아래에 본문 소제목(h3)이 문서 순서대로 오고, 접혀 있는 나머지 섹션들은
 * 섹션 이름 자체가 목차 항목이 된다(클릭하면 js/main.js의 revealHash가 펼친다).
 */
function conceptSubItems(concept) {
  const INTRO = ['definition', 'analogy', 'core'];
  const out = [];
  const headingsOf = (s) => (s.headings ?? [])
    .filter((h) => h.level === 3 && h.text)
    .map((h) => ({ href: `#${h.id}`, label: h.text, kind: 'h' }));

  const intro = concept.sections.filter((s) => INTRO.includes(s.key) && s.html?.trim());
  if (intro.length) {
    out.push({ href: `#${concept.slug}-${intro[0].key}`, label: '정의 · 비유 · 핵심 내용', kind: 'sec' });
    for (const s of intro) out.push(...headingsOf(s));
  }

  for (const s of concept.sections) {
    if (INTRO.includes(s.key)) continue;
    if (s.key === 'mynotes' && !concept.hasMyNotes) continue;
    if (!s.html?.trim()) continue;
    out.push({
      href: `#${concept.slug}-${s.key}`,
      label: SECTION_LABEL[s.key] ?? s.heading,
      kind: 'sec',
    });
    out.push(...headingsOf(s));
  }
  return out;
}

function weekSidebar(week, weeks) {
  const idx = weeks.findIndex((w) => w.id === week.id);
  const prevWeek = weeks.slice(0, idx).reverse().find((w) => w.concepts?.length);
  const nextWeek = weeks.slice(idx + 1).find((w) => w.concepts?.length);

  const navItems = week.concepts.map((c, i) => ({
    href: `#${c.slug}`,
    slug: c.slug,
    no: String(c.no).padStart(2, '0'),
    title: c.title,
    core: (c.coreRefs ?? []).length > 0,
    // 첫 개념은 페이지를 열자마자 활성이다. 스크롤 추적(js/main.js)이 곧바로
    // 다시 계산하지만, JS가 뜨기 전에도 목차가 펼쳐져 있게 서버에서 표시해 둔다.
    active: i === 0,
    subItems: conceptSubItems(c),
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
