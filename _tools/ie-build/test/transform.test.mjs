import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../lib/render.mjs';
import { Warnings } from '../build.mjs';
import {
  sourcePanel, quizCards, resetCounts, counts,
  polishHtml, honorific, contextFromBracket, stripTimestampText, cleanLabel,
} from '../lib/transform.mjs';

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
// T2 — 번호 소제목 (DESIGN.md v2 §5.4: 단계 카드 폐기, h3 그대로)
// ------------------------------------------------------------------

test('T2(v2): ### N) 제목은 카드로 묶지 않고 앵커가 붙은 h3로 남는다', () => {
  const md = ['### 1) 조직 고착', '', '첫 번째 내용.', '', '### 2) 기술 고착', '', '두 번째 내용.'].join('\n');
  const html = renderMarkdown(md, ctx());
  assert.ok(!html.includes('step-card'), '단계 카드는 더 이상 만들지 않는다');
  assert.match(html, /<h3 id="c05-h-1-조직-고착">1\) 조직 고착<\/h3>/);
  assert.match(html, /<h3 id="c05-h-2-기술-고착">2\) 기술 고착<\/h3>/);
});

// ------------------------------------------------------------------
// T3 — 🗣 교수님 발언 blockquote
// ------------------------------------------------------------------

test('T3: 🗣 blockquote는 quote-prof가 되고 녹취 시각은 버리고 주차 맥락만 출처 줄에 남긴다', () => {
  const html = renderMarkdown('> 🗣 [W01 40:48] "그 얘기는 맞는데."', ctx());
  assert.match(html, /<blockquote class="quote-prof quote-bare">/);
  assert.match(html, /<p>그 얘기는 맞는데\.<\/p>/, '원문 따옴표는 벗기고 CSS 따옴표 하나로 표시한다');
  assert.match(html, /<footer class="quote-cite">교수님 · W01 강의<\/footer>/);
  assert.ok(!html.includes('40:48'), '녹취 시각이 화면에 남으면 안 된다');
  assert.ok(!html.includes('🗣'), '이모지가 남으면 안 된다');
});

test('T3: 맥락 없는 시각([19:45], [P1 27:45])은 출처 줄에 "교수님"만 남긴다', () => {
  for (const md of ['> 🗣 [19:45] "말."', '> 🗣 [P1 27:45] "말."', '> 🗣 "얘기해 보자."']) {
    const html = renderMarkdown(md, ctx());
    assert.match(html, /<footer class="quote-cite">교수님<\/footer>/, md);
  }
});

test('T3: 따옴표가 인용 전체를 감싸지 않으면 원문을 그대로 두고 CSS 따옴표도 걸지 않는다', () => {
  const html = renderMarkdown('> 🗣 "앞부분" 하고 덧붙인 말.', ctx());
  assert.match(html, /<blockquote class="quote-prof">/);
  assert.match(html, /&quot;앞부분&quot; 하고 덧붙인 말\./);
});

test('T3: 🗣로 시작하지 않는 일반 blockquote는 그대로 둔다', () => {
  const html = renderMarkdown('> 그냥 인용문입니다.', ctx());
  assert.ok(!html.includes('quote-prof'));
  assert.match(html, /^<blockquote>\n<p>그냥 인용문입니다\.<\/p>\n<\/blockquote>/);
});

test('T3: 빈 `>` 줄로 이어붙인 두 개의 🗣 발언은 한 인용 안에 두 문단, 맥락은 중복 없이 모은다', () => {
  const md = '> 🗣 [W01 11:11] "A"\n>\n> 🗣 [W02 07:06] "B"\n';
  const html = renderMarkdown(md, ctx());
  assert.match(html, /<blockquote class="quote-prof quote-bare"><p>A<\/p><p>B<\/p>/);
  assert.match(html, /<footer class="quote-cite">교수님 · W01 강의 · W02 강의<\/footer>/);
});

test('T3: 일부 문단만 🗣인 여러-문단 blockquote는 애매하니 변환하지 않는다', () => {
  const md = '> 🗣 [W01 11:11] "A"\n>\n> 그냥 설명 문단.\n';
  const html = renderMarkdown(md, ctx());
  assert.ok(!html.includes('quote-prof'), '전부 🗣가 아니면 변환하지 않는다');
});

// ------------------------------------------------------------------
// T4 / T5 — 📄은 표시 없이, 💡는 "보충" 표지 (DESIGN.md v2 §2.5)
// ------------------------------------------------------------------

test('T4: 📄로 시작하는 문단은 상자 없는 일반 문단이 된다', () => {
  const html = renderMarkdown('📄 슬라이드에 나온 그대로다.', ctx());
  assert.equal(html.trim(), '<p>슬라이드에 나온 그대로다.</p>');
});

test('T5: 💡로 시작하는 문단은 앞머리에 "보충" 표지가 붙은 supp 문단이 된다', () => {
  const html = renderMarkdown('💡 이건 보충 설명이다.', ctx());
  assert.match(html, /<p class="supp"><span class="tag tag-supp">보충<\/span>이건 보충 설명이다\.<\/p>/);
});

test('T4: 📄로 시작하는 목록 항목은 표시 없는 일반 항목이 된다', () => {
  const html = renderMarkdown('- 📄 슬라이드 문구\n- 그냥 항목\n', ctx());
  assert.match(html, /<li>슬라이드 문구<\/li>/);
  assert.match(html, /<li>그냥 항목<\/li>/);
});

test('T5: 💡로 시작하는 목록 항목은 "보충" 표지가 붙은 supp 항목이 된다', () => {
  const html = renderMarkdown('- 💡 보충 문구\n- 다른 항목\n- 또 다른 항목\n', ctx());
  assert.match(html, /<li class="supp"><span class="tag tag-supp">보충<\/span>보충 문구<\/li>/);
});

test('T4/T5: 목록 항목에 중첩 하위 목록이 있으면(애매함) 렌더 단계에서는 변환하지 않는다', () => {
  const md = '- 📄 상위 항목\n  - 하위 항목\n';
  const html = renderMarkdown(md, ctx());
  assert.ok(!html.includes('class="supp"'));
  assert.match(html, /📄 상위 항목/, '남은 이모지는 주차 페이지의 polishHtml이 지운다');
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
// T7 — 접힌 "출처 · 태그" 패널
// ------------------------------------------------------------------

test('T7: 리딩·수업노트·태그를 접힌 패널로 만들고, 수업노트 참조의 녹취 시각은 지운다', () => {
  const concept = {
    slug: 'c05',
    readings: ['Johnson (2010)'],
    lectureRefs: ['수업노트/W01_강의기록_260905.md §5 [39:38–45:35]'],
    tags: ['lock-in', 'path dependency'],
  };
  const html = sourcePanel(concept);
  assert.match(html, /<details class="sec-fold source-panel"/);
  assert.match(html, /<summary>출처 · 태그<svg/);
  assert.match(html, /Johnson \(2010\)/);
  assert.match(html, /<li>수업노트\/W01_강의기록_260905\.md §5<\/li>/);
  assert.ok(!html.includes('39:38'), '녹취 시각이 남으면 안 된다');
  assert.match(html, /<a href="map\.html\?tag=path%20dependency">path dependency<\/a>/);
});

test('T7: 리딩·수업노트·태그가 모두 없으면 아무것도 렌더하지 않는다', () => {
  const html = sourcePanel({ slug: 'c05', readings: [], lectureRefs: [] });
  assert.equal(html, '');
});

// ------------------------------------------------------------------
// T8 — 예상 퀴즈 포인트 번호 목록
// ------------------------------------------------------------------

test('T8: quizPoints의 isComparison을 재계산하지 않고 그대로 유형 표지에 쓴다', () => {
  const quizPoints = [
    { html: '★ 정의를 설명하라.', text: '정의를 설명하라.', isComparison: false },
    { html: 'A와 B의 차이를 설명하라.', text: 'A와 B의 차이를 설명하라.', isComparison: true },
  ];
  const html = quizCards(quizPoints);
  assert.match(html, /^<ol class="quiz-list">/);
  assert.match(html, /<li>정의를 설명하라\. <span class="tag">서술형<\/span><\/li>/, '문항 앞 ★는 지운다');
  assert.match(html, /<li>A와 B의 차이를 설명하라\. <span class="tag">비교형<\/span><\/li>/);
});

test('T8: quizPoints가 비어 있으면 빈 문자열을 돌려준다', () => {
  assert.equal(quizCards([]), '');
  assert.equal(quizCards(undefined), '');
});

// ------------------------------------------------------------------
// 주차 페이지 텍스트 정리 (DESIGN.md v2) — 녹취 시각 · 이모지 · 존칭
// ------------------------------------------------------------------

test('contextFromBracket: 시각은 버리고 주차 맥락만, 시각이 없으면 그대로 맥락', () => {
  assert.equal(contextFromBracket('19:45'), '');
  assert.equal(contextFromBracket('30:21–34:00'), '');
  assert.equal(contextFromBracket('P1 1:19:44'), '');
  assert.equal(contextFromBracket('45:00 전후'), '');
  assert.equal(contextFromBracket('W01 40:48'), 'W01 강의');
  assert.equal(contextFromBracket('W05b 논의'), 'W05b 논의');
});

test('stripTimestampText: 본문 속 녹취 시각 대괄호를 지우고, 주차가 있으면 괄호 맥락으로 남긴다', () => {
  assert.equal(stripTimestampText('설명한다 [12:30] 그래서'), '설명한다 그래서');
  assert.equal(stripTimestampText('앞 강의 [W02 07:06]에서'), '앞 강의 (W02 강의)에서');
  assert.equal(stripTimestampText('대괄호 [참고]는 그대로'), '대괄호 [참고]는 그대로');
});

test('honorific: 교수 → 교수님, 조사도 존칭형으로 맞춘다', () => {
  assert.equal(honorific('교수가 말했다'), '교수님이 말했다');
  assert.equal(honorific('교수의 단서'), '교수님의 단서');
  assert.equal(honorific('교수는 본다'), '교수님은 본다');
  assert.equal(honorific('교수에게 묻다'), '교수님께 묻다');
  assert.equal(honorific('교수: 그렇죠'), '교수님: 그렇죠');
  assert.equal(honorific('(교수 coining)'), '(교수님 coining)');
});

test('honorific: 이미 교수님인 곳, 교수법·교수들, 일반 명사 "대학 교수"는 건드리지 않는다', () => {
  assert.equal(honorific('교수님이 말했다'), '교수님이 말했다');
  assert.equal(honorific('교수법과 교수진, 교수들'), '교수법과 교수진, 교수들');
  assert.equal(honorific('대학 교수만 지식을'), '대학 교수만 지식을');
});

test('polishHtml: 소제목의 ★·💡는 표지로, 🗣·📄는 지운다', () => {
  const html = polishHtml('<h3 id="a">3) 🗣 그러나 쉽지 않다 — 교수의 단서 ★</h3><h3 id="b">5) 공론장 💡</h3>');
  assert.equal(
    html,
    '<h3 id="a">3) 그러나 쉽지 않다 — 교수님의 단서 <span class="tag tag-exam">시험 포인트</span></h3>' +
      '<h3 id="b">5) 공론장 <span class="tag tag-supp">보충</span></h3>'
  );
});

test('polishHtml: 본문의 🗣·📄·녹취 시각은 지우고 💡는 "보충" 표지로 바꾼다', () => {
  const html = polishHtml('<li>🗣 [12:30] 설명. 📄 슬라이드의 답. 연결 💡: 끝</li>');
  assert.equal(html, '<li>설명. 슬라이드의 답. 연결 <span class="tag tag-supp">보충</span>: 끝</li>');
});

test('polishHtml: 교수님 발언 인용 안의 글은 존칭 변환하지 않는다(발언 원문 보존)', () => {
  const html = polishHtml('<blockquote class="quote-prof"><p>교수가 할 일</p></blockquote><p>교수가 말했다</p>');
  assert.match(html, /<p>교수가 할 일<\/p>/);
  assert.match(html, /<p>교수님이 말했다<\/p>/);
});

test('polishHtml: 태그 속성과 코드 안은 건드리지 않는다', () => {
  const html = polishHtml('<img alt="📄 슬라이드"><pre><code>🗣 [00:00] 교수가</code></pre>');
  assert.equal(html, '<img alt="📄 슬라이드"><pre><code>🗣 [00:00] 교수가</code></pre>');
});

test('cleanLabel: 사이드바 라벨에서 글리프·시각을 지우고 존칭을 맞춘다', () => {
  assert.equal(cleanLabel('3) 🗣 교수의 단서 ★★ [19:45]'), '3) 교수님의 단서');
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
  assert.ok(!html.includes('class="supp"'));
  assert.ok(!html.includes('step-card'));
});
