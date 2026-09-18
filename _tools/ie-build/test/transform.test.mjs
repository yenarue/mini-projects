import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../lib/render.mjs';
import { Warnings } from '../build.mjs';
import { sourcePanel, quizCards, resetCounts, counts } from '../lib/transform.mjs';

const ctx = () => ({ week: 'W01', slug: 'c05', warnings: new Warnings(), label: 'W01/c05' });

// ------------------------------------------------------------------
// T1 — 정의 목록 → 2열 표
// ------------------------------------------------------------------

test('T1: **용어**: 설명 항목이 3개 이상 연속이면 표로 바뀐다', () => {
  resetCounts();
  const md = [
    '- **조직 고착**: 성공 공식에 갇힌다.',
    '- **기술 고착**: 최고가 아니어도 못 바꾼다.',
    '- **사용자 고착**: 네트워크 때문에 못 떠난다.',
  ].join('\n');
  const html = renderMarkdown(md, ctx());
  assert.match(html, /<table class="deflist">/);
  assert.match(html, /<th scope="row" class="deflist-term">조직 고착<\/th>/);
  assert.match(html, /<td class="deflist-desc">성공 공식에 갇힌다\.<\/td>/);
  assert.equal(counts.t1, 1);
  assert.ok(!html.includes('<ul>'), '표로 바뀌었으면 원래 <ul>이 남으면 안 된다');
});

test('T1: 항목이 2개뿐이면(3개 미만) 변환하지 않는다', () => {
  const md = ['- **STI**: 과학의 원리로 배운다.', '- **DUI**: 해 보면서 배운다.'].join('\n');
  const html = renderMarkdown(md, ctx());
  assert.ok(!html.includes('deflist'), '2개짜리는 표가 되면 안 된다');
  assert.match(html, /<ul>/);
});

test('T1: 섞인 목록(일부만 "**용어**: 설명" 형태)은 전체를 원래대로 둔다', () => {
  const md = [
    '- **조직 고착**: 성공 공식에 갇힌다.',
    '- **기술 고착**: 최고가 아니어도 못 바꾼다.',
    '- 그냥 평범한 항목이다.',
  ].join('\n');
  const html = renderMarkdown(md, ctx());
  assert.ok(!html.includes('deflist'), '일부만 매치하면 표로 바뀌면 안 된다(부분 변환 금지)');
  assert.match(html, /<li>그냥 평범한 항목이다\.<\/li>/);
});

// ------------------------------------------------------------------
// T2 — 번호 단계 카드
// ------------------------------------------------------------------

test('T2: ### N) 제목 h3가 2개 이상 연속이면 단계 카드로 묶인다', () => {
  const md = [
    '### 1) 조직 고착',
    '',
    '첫 번째 내용.',
    '',
    '### 2) 기술 고착',
    '',
    '두 번째 내용.',
  ].join('\n');
  const html = renderMarkdown(md, ctx());
  assert.equal((html.match(/class="step-card"/g) || []).length, 2);
  assert.match(html, /<span class="step-no"[^>]*>1<\/span>/);
  assert.match(html, /<span class="step-no"[^>]*>2<\/span>/);
  // 경계 정확성: 1번 카드에는 "첫 번째"만, 2번 카드에는 "두 번째"만 있어야 한다(내용 누수 금지)
  const idx1 = html.search(/step-no"[^>]*>1</);
  const idx2 = html.search(/step-no"[^>]*>2</);
  const card1 = html.slice(idx1, idx2);
  assert.match(card1, /첫 번째 내용/);
  assert.ok(!card1.includes('두 번째 내용'), '1번 카드에 2번 내용이 새면 안 된다');
});

test('T2: 숫자 헤딩이 하나뿐이면 묶지 않는다(2개 이상 필요)', () => {
  const md = ['### 1) 유일한 단계', '', '내용.', '', '### 다른 제목', '', '더 내용.'].join('\n');
  const html = renderMarkdown(md, ctx());
  assert.ok(!html.includes('step-group'), '헤딩 하나짜리는 카드 그룹이 되면 안 된다');
});

test('T2: 번호 없는 헤딩이 앞에 있어도 그 헤딩은 그대로 두고 뒤의 번호 런만 묶는다', () => {
  const md = [
    '### 📄 슬라이드',
    '',
    '슬라이드 설명.',
    '',
    '### 0) 도입',
    '',
    '도입 내용.',
    '',
    '### 1) 본론',
    '',
    '본론 내용.',
  ].join('\n');
  const html = renderMarkdown(md, ctx());
  assert.match(html, /<h3[^>]*>📄 슬라이드<\/h3>/, '번호 없는 헤딩은 h3로 그대로 남아야 한다');
  assert.equal((html.match(/class="step-card"/g) || []).length, 2);
  assert.match(html, /<span class="step-no"[^>]*>0<\/span>/);
});

test('T2: 마지막 카드의 본문은 섹션 끝까지 포함한다', () => {
  const md = ['### 1) 하나', '', '### 2) 둘', '', '둘의 내용이 여기 끝까지.'].join('\n');
  const html = renderMarkdown(md, ctx());
  const card2Start = html.search(/step-no"[^>]*>2</);
  assert.match(html.slice(card2Start), /둘의 내용이 여기 끝까지/);
});

// ------------------------------------------------------------------
// T3 — 🗣 교수 발언 blockquote
// ------------------------------------------------------------------

test('T3: 🗣 blockquote는 quote-prof 카드가 되고 타임스탬프가 분리된다', () => {
  const html = renderMarkdown('> 🗣 [W01 40:48] "그 얘기는 맞는데."', ctx());
  assert.match(html, /<blockquote class="quote-prof">/);
  assert.match(html, /<span class="quote-time">W01 40:48<\/span>/);
  assert.match(html, /<p class="quote-text">&quot;그 얘기는 맞는데\.&quot;<\/p>/);
  assert.ok(!html.includes('🗣 ['), '이모지+대괄호가 본문에 그대로 남으면 안 된다');
});

test('T3: 타임스탬프가 없어도(예: STI/DUI 파일처럼 짧은 인용) 변환된다', () => {
  const html = renderMarkdown('> 🗣 "얘기해 보자."', ctx());
  assert.match(html, /<blockquote class="quote-prof">/);
  assert.ok(!html.includes('quote-time'), '타임스탬프가 없으면 quote-time을 만들지 않는다');
});

test('T3: 🗣로 시작하지 않는 일반 blockquote는 그대로 둔다', () => {
  const html = renderMarkdown('> 그냥 인용문입니다.', ctx());
  assert.ok(!html.includes('quote-prof'));
  assert.match(html, /^<blockquote>\n<p>그냥 인용문입니다\.<\/p>\n<\/blockquote>/);
});

test('T3: 빈 `>` 줄로 이어붙인 두 개의 🗣 발언은 하나의 카드 안에 두 개의 인용으로 들어간다', () => {
  const md = '> 🗣 [W01 11:11] "A"\n>\n> 🗣 [W02 07:06] "B"\n';
  const html = renderMarkdown(md, ctx());
  assert.match(html, /<blockquote class="quote-prof">/);
  assert.equal((html.match(/class="quote-text"/g) || []).length, 2);
  assert.equal((html.match(/class="quote-time"/g) || []).length, 2);
  assert.match(html, /W01 11:11/);
  assert.match(html, /W02 07:06/);
});

test('T3: 일부 문단만 🗣인 여러-문단 blockquote는 애매하니 변환하지 않는다', () => {
  const md = '> 🗣 [W01 11:11] "A"\n>\n> 그냥 설명 문단.\n';
  const html = renderMarkdown(md, ctx());
  assert.ok(!html.includes('quote-prof'), '전부 🗣가 아니면 변환하지 않는다');
});

// ------------------------------------------------------------------
// T4 / T5 — 📄 슬라이드 근거 · 💡 보충 콜아웃
// ------------------------------------------------------------------

test('T4: 📄로 시작하는 문단은 slide 콜아웃이 된다', () => {
  const html = renderMarkdown('📄 슬라이드에 나온 그대로다.', ctx());
  assert.match(html, /<p class="callout callout-slide">/);
  assert.ok(!html.includes('📄 슬라이드에'), '이모지가 본문 맨 앞에 그대로 남으면 안 된다(배지로 대체)');
});

test('T5: 💡로 시작하는 문단은 note 콜아웃이 된다', () => {
  const html = renderMarkdown('💡 이건 보충 설명이다.', ctx());
  assert.match(html, /<p class="callout callout-note">/);
});

test('T4: 📄로 시작하는 목록 항목은 li-callout-slide가 된다', () => {
  const html = renderMarkdown('- 📄 슬라이드 문구\n- 그냥 항목\n', ctx());
  assert.match(html, /<li class="li-callout li-callout-slide">/);
  assert.match(html, /<li>그냥 항목<\/li>/);
});

test('T5: 💡로 시작하는 목록 항목은 li-callout-note가 된다', () => {
  const html = renderMarkdown('- 💡 보충 문구\n- 다른 항목\n- 또 다른 항목\n', ctx());
  assert.match(html, /<li class="li-callout li-callout-note">/);
});

test('T4/T5: 목록 항목에 중첩 하위 목록이 있으면(애매함) 변환하지 않고 이모지가 그대로 남는다', () => {
  const md = '- 📄 상위 항목\n  - 하위 항목\n';
  const html = renderMarkdown(md, ctx());
  assert.ok(!html.includes('li-callout'), '중첩 리스트가 있는 항목은 배지로 바뀌면 안 된다');
  assert.match(html, /📄 상위 항목/);
});

// ------------------------------------------------------------------
// T6 — 표: 가로 스크롤 래퍼, 내용 불변
// ------------------------------------------------------------------

test('T6: 표는 table-scroll로 감싸지고 셀 내용은 그대로다', () => {
  const md = ['| 요소 | 설명 |', '|---|---|', '| A | 첫 번째 |', '| B | 두 번째 |'].join('\n');
  const html = renderMarkdown(md, ctx());
  assert.match(html, /<div class="table-scroll"><table>/);
  assert.match(html, /<th>요소<\/th>/);
  assert.match(html, /<td>A<\/td>/);
  assert.match(html, /<td>첫 번째<\/td>/);
  assert.match(html, /<td>두 번째<\/td>/);
});

// ------------------------------------------------------------------
// T7 — 접힌 "출처" 패널
// ------------------------------------------------------------------

test('T7: readings·lecture_refs가 있으면 접힌 출처 패널을 만든다', () => {
  const concept = {
    slug: 'c05',
    readings: ['Johnson (2010)'],
    lectureRefs: ['수업노트/W01_강의기록_260905.md §5 [39:38–45:35]'],
  };
  const html = sourcePanel(concept);
  assert.match(html, /<details class="sec-fold source-panel"/);
  assert.match(html, /<summary>출처<\/summary>/);
  assert.match(html, /Johnson \(2010\)/);
  assert.match(html, /39:38–45:35/);
});

test('T7: readings·lecture_refs가 둘 다 없으면 아무것도 렌더하지 않는다', () => {
  const html = sourcePanel({ slug: 'c05', readings: [], lectureRefs: [] });
  assert.equal(html, '');
});

// ------------------------------------------------------------------
// T8 — 예상 퀴즈 포인트 번호 카드
// ------------------------------------------------------------------

test('T8: quizPoints의 isComparison을 재계산하지 않고 그대로 배지에 쓴다', () => {
  const quizPoints = [
    { html: '정의를 설명하라.', text: '정의를 설명하라.', isComparison: false },
    { html: 'A와 B의 차이를 설명하라.', text: 'A와 B의 차이를 설명하라.', isComparison: true },
  ];
  const html = quizCards(quizPoints);
  assert.equal((html.match(/class="quiz-card"/g) || []).length, 2);
  assert.match(html, /<span class="quiz-no">1<\/span>/);
  assert.match(html, /<span class="quiz-no">2<\/span>/);
  assert.match(html, /quiz-badge-desc">서술형/);
  assert.match(html, /quiz-badge-compare">비교형/);
});

test('T8: quizPoints가 비어 있으면 빈 문자열을 돌려준다', () => {
  assert.equal(quizCards([]), '');
  assert.equal(quizCards(undefined), '');
});

// ------------------------------------------------------------------
// 코드블록 안전성 — 어떤 변환도 펜스 코드블록 내부를 건드리지 않는다
// ------------------------------------------------------------------

test('안전 원칙: 펜스 코드블록 안의 패턴은 어떤 변환도 건드리지 않는다', () => {
  const md = [
    '```',
    '- **조직 고착**: 하나',
    '- **기술 고착**: 둘',
    '- **사용자 고착**: 셋',
    '> 🗣 [W01 00:00] "가짜 인용"',
    '📄 가짜 슬라이드 문단',
    '### 1) 가짜 단계',
    '```',
  ].join('\n');
  const html = renderMarkdown(md, ctx());
  assert.match(html, /<pre><code>/);
  assert.ok(!html.includes('deflist'));
  assert.ok(!html.includes('quote-prof'));
  assert.ok(!html.includes('callout'));
  assert.ok(!html.includes('step-card'));
});
