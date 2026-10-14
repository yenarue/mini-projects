import { esc, topbar, weeknav, sidebar, stars, coreBadge, footer } from './components.mjs';
import { layout } from './layout.mjs';
import {
  sourcePanel, quizCards, polishHtml, cleanLabel, honorific, SUPP_TAG, CHEVRON,
} from '../lib/transform.mjs';

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

// 내용 변환(T1~T8, §5)은 lib/render.mjs가 만든 section.html에 이미 들어 있다.
// 주차 페이지는 화면에 내보내기 직전에 polishHtml로 이모지·녹취 시각·존칭을 정리한다
// (DESIGN.md v2 — 퀴즈 페이지·검색 색인이 쓰는 원본 데이터는 그대로 둔다).
//
// 섹션 원제목에 💡가 붙어 있으면("쉽게 말하면 (비유) 💡", "보충 사례 💡") 그 섹션
// 전체가 외부 보충이라는 뜻이라 라벨 끝에 "보충" 표지를 단다.
function sectionLabel(section) {
  const label = esc(SECTION_LABEL[section.key] ?? cleanLabel(section.heading));
  return /💡/.test(section.heading ?? '') ? `${label} ${SUPP_TAG}` : label;
}

function sectionBlock(concept, section) {
  const label = sectionLabel(section);
  const id = `${concept.slug}-${section.key}`;
  const html = polishHtml(section.html);

  if (section.key === 'mynotes') {
    if (!concept.hasMyNotes) return '';
    return `<div class="sec sec-mynotes" id="${id}"><h4>${label}</h4>${html}</div>`;
  }
  if (section.key === 'quiz') {
    // T8(DESIGN.md v2 §5.10): 번호 목록 + 문항 끝 비교형/서술형 표지.
    // isComparison은 renderConcept이 이미 계산해 둔 값을 그대로 쓴다(재계산 금지).
    const list = quizCards(concept.quizPoints);
    return `<div class="sec sec-quiz" id="${id}">
  <h4>${label}</h4>
  ${list || html}
  <p class="sec-quiz-link"><a href="quiz.html?week=${encodeURIComponent(concept.week)}&amp;c=${concept.slug}">퀴즈 모드로 풀기 →</a></p>
</div>`;
  }
  if (OPEN_SECTIONS.has(section.key)) {
    return `<div class="sec sec-${section.key}" id="${id}"><h4>${label}</h4>${html}</div>`;
  }
  return `<details class="sec sec-fold" id="${id}" data-sec="${id}">
  <summary>${label}${CHEVRON}</summary>
  <div class="sec-body">${html}</div>
</details>`;
}

const FOCUS_ICON =
  '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>';
const UP_ICON =
  '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';

/** "W05a p9", "W05a p10" → "슬라이드 W05a p9, p10" (같은 자료면 접두를 한 번만). */
function slidesText(slides = []) {
  if (!slides.length) return '';
  const parts = slides.map((s) => String(s).trim());
  const deck = /^(\S+)\s/.exec(parts[0])?.[1];
  const same = deck && parts.every((p) => p.startsWith(`${deck} `));
  return `슬라이드 ${same ? `${deck} ${parts.map((p) => p.slice(deck.length + 1)).join(', ')}` : parts.join(', ')}`;
}

// DESIGN.md v2 §5.1 개념 헤더: 제목 → 영문/부제 → 메타 한 줄(주차·번호·슬라이드·
// 중요도·핵심·집중 모드). eyebrow·칩 줄은 없앤다(태그는 접힌 "출처 · 태그"로).
// 섹션은 펼침 4(정의·비유·핵심·퀴즈) + 접힘(논점·사례·위치·관련·출처).
function conceptBlock(concept) {
  const related = (concept.related ?? [])
    .map((r) => {
      const label = esc(cleanLabel(r.title || `${r.week}/${String(r.no).padStart(2, '0')}`));
      // 아직 쓰이지 않은 개념은 링크를 걸지 않는다 — 존재하지 않는 앵커로
      // 보내는 대신, 연결은 있지만 아직 작성되지 않았다는 것만 텍스트로 보여준다.
      return r.resolved
        ? `<a href="${r.href}">${label}</a>`
        : `<span class="related-pending" title="아직 작성되지 않은 개념">${label}</span>`;
    })
    .join(' · ');

  const sections = concept.sections.map((s) => sectionBlock(concept, s));
  // 출처 패널은 헤더 바로 아래가 아니라 접힘 섹션들 맨 끝에 둔다.
  const lastFold = sections.reduce((acc, html, i) => (html.startsWith('<details') ? i : acc), -1);
  const source = sourcePanel(concept);
  if (lastFold >= 0) sections.splice(lastFold + 1, 0, source);
  else sections.push(source);

  const slides = slidesText(concept.slides);
  return `
<section class="concept" id="${concept.slug}">
  <h2 class="concept-title">${esc(cleanLabel(concept.title))}</h2>
  <p class="concept-en">${esc(cleanLabel(concept.en))}${concept.subtitle ? ` — ${esc(cleanLabel(concept.subtitle))}` : ''}</p>
  <div class="concept-meta">
    <span>${esc(concept.week)} · 개념 ${String(concept.no).padStart(2, '0')}</span>
    ${slides ? `<span>${esc(slides)}</span>` : ''}
    ${stars(concept.importance)}
    ${coreBadge(concept.coreRefs)}
    <button type="button" class="focus-btn" data-focus-target="${concept.slug}" aria-label="집중 모드로 보기" title="집중 모드 (F)">${FOCUS_ICON}<span>집중해서 읽기</span></button>
  </div>
  ${sections.join('\n')}
  ${related ? `<p class="concept-related">관련: ${related}</p>` : ''}
  <p class="concept-top"><a href="#top">${UP_ICON}맨 위로</a></p>
</section>`;
}

/**
 * 사이드바에 붙일 개념 내부 목차 (DESIGN.md v2 §6).
 *
 * 본문 소제목(h3)만 문서 순서대로 싣는다. "정의 · 비유 · 핵심 내용", "보충 사례"처럼
 * 모든 개념에 똑같이 있는 고정 섹션 이름은 정보가 없어 뺀다. 대신 퀴즈 직전에 가장
 * 자주 찾는 "예상 퀴즈 포인트"는 목차 맨 끝에 바로가기로 둔다(사용자 요청).
 * 라벨에서는 이모지·★·녹취 시각을 지운다.
 */
function conceptSubItems(concept) {
  const out = [];
  for (const s of concept.sections) {
    if (s.key === 'quiz' || s.key === 'mynotes') continue;
    for (const h of s.headings ?? []) {
      if (h.level !== 3 || !h.text) continue;
      out.push({ href: `#${h.id}`, label: cleanLabel(h.text), kind: 'h' });
    }
  }
  const quiz = concept.sections.find((s) => s.key === 'quiz' && s.html?.trim());
  if (quiz) {
    const n = (concept.quizPoints ?? []).length;
    out.push({
      href: `#${concept.slug}-quiz`,
      label: `예상 퀴즈 포인트${n ? ` ${n}` : ''}`,
      kind: 'quiz',
    });
  }
  return out;
}

// 이전/다음 주차 이동은 더 이상 사이드바 몫이 아니다 — weeknav(topbar 아래
// 두 번째 줄)가 모든 페이지에서 "어느 주차든 한 클릭"을 이미 제공한다(Problem
// 1·2). 그래서 sidebar()에는 prev/next를 넘기지 않는다.
function weekSidebar(week) {
  const navItems = week.concepts.map((c, i) => ({
    href: `#${c.slug}`,
    slug: c.slug,
    no: String(c.no).padStart(2, '0'),
    title: cleanLabel(c.title),
    core: (c.coreRefs ?? []).length > 0,
    // 첫 개념은 페이지를 열자마자 활성이다. 스크롤 추적(js/main.js)이 곧바로
    // 다시 계산하지만, JS가 뜨기 전에도 목차가 펼쳐져 있게 서버에서 표시해 둔다.
    active: i === 0,
    subItems: conceptSubItems(c),
  }));

  return sidebar({
    chapterLabel: `${week.id} · ${week.date.slice(5).replace('-', '/')} · 개념 ${week.concepts.length}개`,
    title: week.topic,
    subtitle: week.subtitle,
    navItems,
  });
}

export function renderWeekPage({ week, weeks }) {
  const body = `
${topbar({ active: 'week', weeks })}
${weeknav({ weeks, activeWeek: week.id })}
<div class="layout" id="top">
  ${weekSidebar(week)}
  <main>
    <div class="week-intro">
      <h1 class="week-title">${esc(week.topic)}</h1>
      <p class="week-meta">${esc(week.id)} · ${esc(week.date)}${week.subtitle ? ` · ${esc(honorific(week.subtitle))}` : ''}</p>
      <p class="legend">본문은 강의 내용 기준입니다. ${SUPP_TAG} 표지는 외부 지식입니다.</p>
    </div>
    ${week.concepts.map(conceptBlock).join('\n')}
    ${footer()}
  </main>
</div>`;

  return layout({
    title: `${week.id} · ${week.topic} — 혁신생태계론`,
    description: `${week.topic} 개념 정리 ${week.concepts.length}개`,
    bodyClass: 'page-week',
    // DESIGN.md v2는 주차 페이지에만 먼저 적용한다 — 공용 styles.css 뒤에 덮어쓴다.
    head: '<link rel="stylesheet" href="week.css">',
    body,
    scripts: ['js/main.js'],
    hasSecondRow: true,
  });
}
