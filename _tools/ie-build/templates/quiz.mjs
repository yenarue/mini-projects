import { esc, topbar, footer } from './components.mjs';
import { layout } from './layout.mjs';
import { conceptHref } from '../lib/links.mjs';
import { loadAnswers, ANSWERS_DIR } from '../lib/answers.mjs';

/**
 * 퀴즈 데이터 (Task 11b 재작업).
 *
 * 이전 버전은 개념의 정의·비유·핵심 내용 섹션 전체(주차 페이지와 동일한 본문)를
 * "답"으로 그대로 복제해 넣었다 — 결과물이 개념 상세 페이지의 사본일 뿐 실제
 * 서술형 답안이 아니었고, 페이지 무게(323KB, 97%가 인라인 데이터)만 키웠다.
 *
 * 이제 인라인하는 것은 문항·배지·개념 제목/주차, 그리고 (있다면) `answers/`에
 * 사람이 직접 쓴 답안 텍스트뿐이다. 표·인용·슬라이드·다이어그램을 포함한 전체
 * 자료는 인라인하지 않고 개념 페이지로 링크한다("W01.html#c05") — 퀴즈 페이지는
 * 답안을 "구성하는" 연습이지 원문 재현이 아니기 때문이다.
 */
export function buildQuizData(concepts, opts = {}) {
  const { answersDir = ANSWERS_DIR, warnings } = opts;
  const answersByConceptIndex = loadAnswers(answersDir, concepts, warnings ?? { add() {} });

  const items = [];
  const answers = {};

  for (const c of concepts) {
    if (!(c.quizPoints ?? []).length) continue;

    const conceptId = `${c.week}/${c.slug}`;
    const byIndex = answersByConceptIndex.get(conceptId);

    answers[conceptId] = {
      title: c.title,
      en: c.en,
      week: c.week,
      href: conceptHref(c.week, c.no),
      byIndex: byIndex ? Object.fromEntries(byIndex) : {},
    };

    c.quizPoints.forEach((q, i) => {
      items.push({
        id: `${conceptId}/${i}`,
        conceptId,
        index: i,
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
  // 실행되지 않으므로 문법상 안전하지만, "<"를 그대로 두면 답안 본문(따옴표·꺾쇠·
  // 한글이 섞인 마크다운 렌더 결과) 안에 우연히 "</script>"와 같은 시퀀스가 생겨
  // 태그가 조기 종료될 수 있다. "<"를 전부 <로 escape하면 </script>를 포함한
  // 모든 "<...>" 형태가 문자 그대로의 텍스트로만 남는다.
  const data = JSON.stringify({ items, answers, quizSchedule })
    .replace(/</g, '\\u003c');

  const body = `
${topbar({ active: 'quiz' })}
<main class="page-quiz-main" id="top">
  <p class="eyebrow">퀴즈 대비</p>
  <h1>예상 퀴즈 포인트</h1>
  <p class="quiz-lede">
    문제를 보고 <strong>답 보기</strong>를 누르면 짧은 예시 답안이 펼쳐진다. 이 답안은
    <strong>교수님의 모범답안이 아니라</strong> AI가 작성한 학습 보조 자료다 —
    표·인용·슬라이드까지 포함한 전체 자료는 답안 아래 <strong>개념 전체 보기</strong>
    링크에서 확인한다.
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
    description: '예상 퀴즈 포인트 — 문제와 짧은 예시 답안, 전체 자료는 개념 페이지 링크로',
    bodyClass: 'page-quiz',
    body,
    scripts: ['js/main.js', 'js/quiz.js'],
  });
}
