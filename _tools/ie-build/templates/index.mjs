import { esc, topbar, legend, footer } from './components.mjs';
import { layout } from './layout.mjs';

// AGENTS.md §1 "강의 전체를 관통하는 프레임(W01)" 그대로. 내용은 REDESIGN.md가
// 아니라 강의자료 쪽 정본이므로 손대지 않는다 — 여기서는 카드 프레임만 새로 짠다.
const FRAMES = [
  {
    title: '구조의 차이',
    note: '시스템이 나라·부문마다 왜 다르게 생겼는가',
    items: ['NIS 국가혁신시스템', 'SIS 부문혁신시스템', 'SSIP 혁신·생산의 사회시스템', 'BizS 비즈니스 시스템'],
  },
  {
    title: '구조의 변화',
    note: '시스템이 어떻게 바뀌는가',
    items: ['TS 기술시스템', 'TIS 기술혁신시스템', 'StS 사회기술시스템 + Transition'],
  },
  {
    title: '구조 변화의 기작',
    note: '무엇이 변화를 일으키는가',
    items: ['BMI 비즈니스 모델 혁신', 'SPT 일상생활방식 접근', 'MOIP 임무지향형 혁신정책', 'Innovation Ecosystem'],
  },
];

function shortDate(iso) {
  // "2026-09-05" -> "09/05" — week.mjs의 chapterLabel과 같은 규칙.
  return iso.slice(5).replace('-', '/');
}

/**
 * 같은 날짜에 강의된(예정된) 주차를 한 카드로 묶는다.
 * 입력 순서(=weeks.json 순서, 이미 날짜순)를 그대로 유지한 채 날짜로만 묶고,
 * 혹시 몰라 날짜 문자열로 한 번 더 정렬한다(ISO 형식이라 문자열 정렬 = 시간 정렬).
 */
function groupByDate(weeks) {
  const map = new Map();
  for (const w of weeks) {
    if (!map.has(w.date)) map.set(w.date, { date: w.date, weeks: [] });
    map.get(w.date).weeks.push(w);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// 서브 요소 클래스는 절대 "week-card"로 시작하면 안 된다 — 링크 검증/카드 수
// 세는 쪽에서 `class="week-card`로 시작하는 속성을 모두 카드로 셀 수 있어서다.
// (wc-* 접두어로 분리해 카드 1장 = "week-card" 매치 1개를 보장한다.)
function weekCard(group) {
  const active = group.weeks.filter((w) => w.concepts.length);
  const pending = group.weeks.filter((w) => !w.concepts.length);
  const isPending = active.length === 0;
  const total = active.reduce((n, w) => n + w.concepts.length, 0);
  const quizWeek = group.weeks.find((w) => w.quiz);

  const links = active
    .map((w) => {
      const preview = w.concepts.slice(0, 4).map((c) => esc(c.title)).join(' · ');
      return `
      <a class="wc-link" href="${esc(w.id)}.html">
        <span class="wc-id">${esc(w.id)}</span>
        <span class="wc-topic">${esc(w.topic)}</span>
        ${preview ? `<span class="wc-preview">${preview}</span>` : ''}
      </a>`;
    })
    .join('');

  // 카드 전체가 이미 예정(pending)이면 헤더의 "예정" 표시로 충분하다 — 항목마다
  // 또 "예정" 태그를 붙이면 같은 말이 두 번 반복된다. 태그는 병합 카드(활성
  // 주차 + 예정 주차가 한 카드에 섞인 경우)에서만 개별 항목에 붙여 구분한다.
  const pendingItems = pending
    .map(
      (w) => `
      <div class="wc-pending-item">
        <span class="wc-id">${esc(w.id)}</span>
        <span class="wc-topic">${esc(w.topic)}</span>
        ${isPending ? '' : '<span class="wc-pending-tag">예정</span>'}
      </div>`
    )
    .join('');

  return `
<article class="week-card${isPending ? ' is-pending' : ''}">
  <header class="wc-head">
    <time datetime="${esc(group.date)}">${esc(shortDate(group.date))}</time>
    ${quizWeek ? `<span class="wc-quiz" title="그날 수업 시작 전 실시 · 전주까지 누적 범위">★ Quiz ${quizWeek.quiz}</span>` : ''}
    <span class="wc-count">${total ? `개념 ${total}개` : '예정'}</span>
  </header>
  ${links}
  ${pendingItems ? `<div class="wc-pending">${pendingItems}</div>` : ''}
</article>`;
}

function quizRow(q, weeksById, coreSet) {
  const total = q.weeks.length;
  const ready = q.weeks.filter((id) => weeksById.get(id)?.concepts.length).length;
  const scope = q.weeks.map(esc).join(' · ');

  // 왼쪽 버튼은 그 회차의 핵심 개념 목록(core.html), 오른쪽은 퀴즈 풀기.
  // 아직 핵심 개념을 추려 두지 않은 회차는 자리만 지키는 비활성 표시로 둔다 —
  // 회차마다 버튼 줄의 폭이 들쭉날쭉해지지 않게 하려는 것.
  const coreBtn = coreSet
    ? `<a class="btn btn-quiet" href="core.html#quiz${q.n}">핵심 개념 ${coreSet.items.length}가지</a>`
    : '<span class="btn btn-disabled" aria-disabled="true">핵심 개념 준비 중</span>';

  return `
    <li class="quiz-row">
      <div class="quiz-row-top">
        <span class="quiz-n">Quiz ${q.n}</span>
        <time class="quiz-date" datetime="${esc(q.date)}">${esc(q.date)}</time>
        <span class="quiz-ready">정리 완료 ${ready}/${total}주차</span>
      </div>
      <div class="quiz-row-main">
        <p class="quiz-scope">누적 범위 · ${scope}</p>
        <div class="quiz-row-actions">
          ${coreBtn}
          <a class="btn btn-primary" href="quiz.html?quiz=${q.n}">퀴즈 풀기 →</a>
        </div>
      </div>
    </li>`;
}

function progressRow(w) {
  const done = w.concepts.filter((c) => c.status === 'done').length;
  return `
      <tr>
        <td><a href="${esc(w.id)}.html">${esc(w.id)}</a></td>
        <td>${esc(w.topic)}</td>
        <td>${w.concepts.length}</td>
        <td>${done}</td>
      </tr>`;
}

export function renderIndexPage({ weeks, quizSchedule, coreSets = [], builtAt }) {
  const withConcepts = weeks.filter((w) => w.concepts.length);
  const totalConcepts = withConcepts.reduce((n, w) => n + w.concepts.length, 0);
  const doneConcepts = withConcepts.reduce(
    (n, w) => n + w.concepts.filter((c) => c.status === 'done').length,
    0
  );
  const weeksById = new Map(weeks.map((w) => [w.id, w]));
  const coreByQuiz = new Map(coreSets.map((s) => [s.quiz, s]));
  const groups = groupByDate(weeks);

  const body = `
${topbar({ active: 'index' })}
<main class="index-main" id="top">
  <header class="index-hero">
    <p class="eyebrow">ITM60034 · 혁신생태계론 (임홍탁)</p>
    <h1>학기 지도</h1>
    <p class="index-lede">
      강의자료와 수업노트에서 뽑은 개념을 주차별로 정리했다.
      주차 카드를 눌러 그 주의 개념을 읽고, 퀴즈 일정에서 다음 퀴즈의 누적 범위를 확인하고,
      개념 지도에서 주차를 넘나드는 연결을 살펴본다.
    </p>
  </header>

  <div class="usage-box">
    <h2>사용법</h2>
    <ul>
      <li>주차 카드를 누르면 그 주차의 개념 전체가 한 페이지에 나온다. 좌측 목차로 개념 사이를 이동한다.</li>
      <li>상단 <kbd>/</kbd> 로 개념명·태그·본문을 검색한다.</li>
      <li><strong>수업에서 나온 논점 · 보충 사례 · 프레임에서의 위치 · 관련 개념</strong>은 기본으로 접혀 있다. 제목을 눌러 펼친다. 개념 헤더의 <strong>⤢</strong> 버튼(또는 <kbd>F</kbd>)으로 한 개념씩 집중해서 읽을 수 있다.</li>
      <li>개념마다 <strong>★ 시험 중요도(5점)</strong>가 붙어 있고, 쪽지시험 핵심 개념으로 추린 것에는 <strong>핵심</strong> 배지가 붙는다. 별에 마우스를 올리면 그 점수의 근거가 나온다.</li>
      <li>퀴즈는 매회 서술형 2~3문제, 범위는 그 직전 주까지 누적이다. 아래 퀴즈 일정에서 회차별 범위와 <strong>핵심 개념</strong> 목록을 먼저 확인한다.</li>
    </ul>
    ${legend()}
  </div>

  <h2 class="section-title">강의 전체 프레임</h2>
  <div class="frame-grid">
    ${FRAMES.map(
      (f) => `
    <div class="frame-card">
      <h3>${esc(f.title)}</h3>
      <p class="frame-note">${esc(f.note)}</p>
      <ul>${f.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    </div>`
    ).join('')}
  </div>

  <h2 class="section-title">주차별 개념</h2>
  <div class="week-grid">
    ${groups.map(weekCard).join('')}
  </div>

  <h2 class="section-title">퀴즈 일정</h2>
  <ol class="quiz-timeline">${quizSchedule.map((q) => quizRow(q, weeksById, coreByQuiz.get(q.n))).join('')}</ol>

  <h2 class="section-title">진행 현황</h2>
  <p class="progress-summary">전체 개념 ${totalConcepts}개 · 완료 ${doneConcepts}개</p>
  <div class="table-scroll">
    <table class="progress-table">
      <thead><tr><th>주차</th><th>주제</th><th>개념</th><th>완료</th></tr></thead>
      <tbody>${withConcepts.map(progressRow).join('')}</tbody>
    </table>
  </div>

  <p class="built-at">마지막 빌드: ${esc(builtAt)}</p>
  ${footer()}
</main>`;

  return layout({
    title: '혁신생태계론 개념 정리 · 시험 대비',
    description: 'ITM60034 혁신생태계론 주차별 개념 정리와 퀴즈 셀프테스트',
    bodyClass: 'page-index',
    body,
    scripts: ['js/main.js'],
  });
}
