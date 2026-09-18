import { esc, topbar, footer } from './components.mjs';
import { layout } from './layout.mjs';
import { conceptHref } from '../lib/links.mjs';

/** 답안 본문에 넣을 섹션. 읽으면서 익힐 수 있는 완성된 내용이다(§ Task 11 brief). */
const ANSWER_SECTIONS = ['definition', 'analogy', 'core'];

const ANSWER_LABEL = {
  definition: '한 줄 정의',
  analogy: '쉽게 말하면',
  core: '핵심 내용',
};

/**
 * 답안 본문을 만든다.
 *
 * 주차 페이지(templates/week.mjs)의 section.html을 그대로 재사용한다 — 새 CSS를
 * 만드는 대신 `.concept` / `.sec sec-definition` 등 이미 있는 선택자를 그대로
 * 입도록 같은 마크업 모양(`<div class="sec sec-${key}"><h4>라벨</h4>...</div>`,
 * 바깥 `.concept` 래퍼)을 쓴다. 표·인용·슬라이드·다이어그램이 주차 페이지와
 * 동일한 타이포그래피로 렌더되는 이유가 이것이다.
 *
 * id 충돌 방지: 이 html 안의 h3/h4 앵커, 다이어그램 id 등은 원래 주차 페이지의
 * `#c05-h-a` 같은 id를 그대로 갖고 있다. 퀴즈 페이지는 한 번에 한 문항(=한
 * 개념의 답안)만 #quiz-stage에 넣고, 문항을 넘길 때마다 stage.innerHTML을
 * 통째로 교체하므로(assets/js/quiz.js render()) 같은 id 두 벌이 동시에 DOM에
 * 존재하는 일은 없다. 그래도 페이지 셸(topbar 등)의 id와 헷갈리지 않도록,
 * 그리고 이 값이 주차 페이지 자체의 앵커(#c05-h-a)와 겹쳐 브라우저가 "같은
 * 페이지 안의 다른 요소"로 착각하지 않도록 'ans-' 접두어를 붙인다.
 */
function answerHtml(concept) {
  const blocks = ANSWER_SECTIONS
    .map((key) => {
      const s = concept.sections.find((x) => x.key === key);
      if (!s?.html) return '';
      const scoped = s.html.replace(/\sid="([^"]+)"/g, ' id="ans-$1"');
      return `<div class="sec sec-${key}"><h4>${esc(ANSWER_LABEL[key])}</h4>${scoped}</div>`;
    })
    .filter(Boolean);
  return `<div class="concept quiz-answer-body">${blocks.join('\n')}</div>`;
}

export function buildQuizData(concepts) {
  const items = [];
  const answers = {};

  for (const c of concepts) {
    const conceptId = `${c.week}/${c.slug}`;
    if (!(c.quizPoints ?? []).length) continue;

    answers[conceptId] = {
      title: c.title,
      en: c.en,
      week: c.week,
      href: conceptHref(c.week, c.no),
      html: answerHtml(c),
    };

    c.quizPoints.forEach((q, i) => {
      items.push({
        id: `${conceptId}/${i}`,
        conceptId,
        week: c.week,
        no: c.no,
        href: conceptHref(c.week, c.no),
        html: q.html,
        text: q.text,
        isComparison: q.isComparison,
      });
    });
  }

  return { items, answers };
}

export function renderQuizPage({ items, answers, weeks, quizSchedule }) {
  const withConcepts = weeks.filter((w) => w.concepts.length);

  const rangeOptions = [
    '<option value="all">전체 범위</option>',
    ...quizSchedule.map((q) => {
      const has = q.weeks.some((id) => withConcepts.some((w) => w.id === id));
      return `<option value="${q.n}"${has ? '' : ' disabled'}>Quiz ${q.n} (${q.date}) — ${q.weeks.length}개 주차</option>`;
    }),
  ].join('');

  const weekChips = withConcepts.map((w) => `
    <label class="chip">
      <input type="checkbox" data-week="${esc(w.id)}" checked>
      <span>${esc(w.id)} · ${esc(w.topic)}</span>
    </label>`).join('');

  // 이 JSON은 <script type="application/json">의 텍스트 콘텐츠로 들어간다 — JS로
  // 실행되지 않으므로 문법상 안전하지만, "<"를 그대로 두면 답안 본문(주차 페이지와
  // 같은 HTML, 따옴표·꺾쇠·한글이 섞여 있다) 안에 우연히 "</script>"와 같은
  // 시퀀스가 생겨 태그가 조기 종료될 수 있다. "<"를 전부 <로 escape하면
  // </script>를 포함한 모든 "<...>" 형태가 문자 그대로의 텍스트로만 남는다.
  const data = JSON.stringify({ items, answers, quizSchedule })
    .replace(/</g, '\\u003c');

  const body = `
${topbar({ active: 'quiz' })}
<main class="page-quiz-main" id="top">
  <p class="eyebrow">퀴즈 대비</p>
  <h1>예상 퀴즈 포인트</h1>
  <p class="quiz-lede">
    문제를 보고 <strong>답 보기</strong>를 누르면 그 개념의 정의·비유·핵심 내용이 그대로 펼쳐진다.
    읽으면서 익히려면 <strong>답 항상 펼치기</strong>를 켜고, 먼저 써보는 훈련을 하려면 끈 채로 푼다.
  </p>

  <div class="quiz-controls">
    <label class="ctrl">
      <span>범위</span>
      <select id="quiz-range">${rangeOptions}</select>
    </label>
    <label class="ctrl ctrl-inline">
      <input type="checkbox" id="quiz-always-reveal">
      <span>답 항상 펼치기</span>
    </label>
    <label class="ctrl ctrl-inline">
      <input type="checkbox" id="quiz-compare-only">
      <span>비교형만</span>
    </label>
    <label class="ctrl ctrl-inline">
      <input type="checkbox" id="quiz-again-only">
      <span>"다시" 표시만</span>
    </label>
    <label class="ctrl ctrl-inline">
      <input type="checkbox" id="quiz-shuffle">
      <span>셔플</span>
    </label>
    <button type="button" id="quiz-reset" class="side-btn">기록 초기화</button>
  </div>

  <details class="quiz-weeks">
    <summary>주차 직접 고르기</summary>
    <div class="chip-row">${weekChips}</div>
  </details>

  <div class="quiz-progress">
    <span id="quiz-counter">0 / 0</span>
    <span id="quiz-tally"></span>
  </div>

  <div class="quiz-stage" id="quiz-stage"></div>

  <div class="quiz-nav">
    <button type="button" id="quiz-prev" class="side-btn">← 이전</button>
    <button type="button" id="quiz-next" class="side-btn">다음 →</button>
  </div>

  ${footer()}
</main>
<script type="application/json" id="quiz-data">${data}</script>`;

  return layout({
    title: '퀴즈 대비 — 혁신생태계론',
    description: '예상 퀴즈 포인트와 답안 본문 — 개념별 정의·비유·핵심 내용을 그대로 펼쳐서 읽는다',
    bodyClass: 'page-quiz',
    body,
    scripts: ['js/main.js', 'js/quiz.js'],
  });
}
