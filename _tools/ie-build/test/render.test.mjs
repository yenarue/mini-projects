import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, toPlainText, extractListItems, slugifyHeading, renderConcept } from '../lib/render.mjs';
import { Warnings } from '../build.mjs';

const ctx = () => ({ week: 'W01', slug: 'c05', warnings: new Warnings(), label: 'W01/c05' });

test('md 링크를 주차 앵커로 바꾼다', () => {
  const html = renderMarkdown('[다른 개념](02-어떤-개념.md)을 보라', ctx());
  assert.match(html, /href="W01\.html#c02"/);
});

test('수업노트 링크는 평문으로 남기고 경고한다', () => {
  const c = ctx();
  const html = renderMarkdown('[기록](../../수업노트/W01_강의기록_260905.md)', c);
  assert.ok(!html.includes('<a '), '링크 태그가 남으면 안 된다');
  assert.match(html, /기록/);
  assert.equal(c.warnings.count, 1);
});

test('이미지를 figure로 감싸고 경로를 바꾼다', () => {
  const html = renderMarkdown('![W01 p10 세 가지 고착](../../수업노트/assets/W01/p10.png)', ctx());
  assert.match(html, /<figure class="slide">/);
  assert.match(html, /src="images\/W01\/p10\.jpg"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /<figcaption>W01 p10 세 가지 고착<\/figcaption>/);
});

test('h3/h4에 개념 슬러그 기반 id를 붙인다', () => {
  const html = renderMarkdown('### 1) 조직 고착 (Johnson 2010)', ctx());
  assert.match(html, /<h3 id="c05-h-[^"]+"/);
});

test('slugifyHeading은 한글을 보존하고 공백을 하이픈으로', () => {
  assert.equal(slugifyHeading('1) 조직 고착 (Johnson 2010)'), '1-조직-고착-johnson-2010');
  assert.equal(slugifyHeading('STI mode vs DUI mode'), 'sti-mode-vs-dui-mode');
});

test('toPlainText는 태그를 벗기고 공백을 정리한다', () => {
  assert.equal(toPlainText('<p>가나 <strong>다라</strong></p>\n<p>마바</p>'), '가나 다라 마바');
});

test('extractListItems는 ol 항목을 뽑는다', () => {
  const html = renderMarkdown('1. 첫 문제\n2. 비교형: 둘 문제', ctx());
  const items = extractListItems(html);
  assert.equal(items.length, 2);
  assert.match(items[0], /첫 문제/);
  assert.match(items[1], /비교형/);
});

test('코드블록 안의 링크는 건드리지 않는다', () => {
  const html = renderMarkdown('```\n[x](02-a.md)\n```', ctx());
  assert.ok(!html.includes('W01.html'));
});

// --- Finding 1: extractListItems는 depth-aware해야 한다 ---

test('extractListItems는 중첩 리스트가 있어도 바깥 li를 온전히 뽑는다', () => {
  const html =
    '<ul><li>outer <ul><li>inner1</li><li>inner2</li></ul> tail</li></ul>';
  const items = extractListItems(html);
  assert.equal(items.length, 1);
  assert.match(items[0], /outer/);
  assert.match(items[0], /tail/);
});

test('extractListItems는 평평한 두 항목짜리 리스트에서 항목 두 개를 뽑는다', () => {
  const html = '<ul><li>a</li><li>b</li></ul>';
  const items = extractListItems(html);
  assert.equal(items.length, 2);
  assert.equal(items[0], 'a');
  assert.equal(items[1], 'b');
});

// --- Finding 2: renderConcept 커버리지 ---

test('renderConcept은 섹션마다 html/plain을 채우고 이미지를 모두 모은다(섹션 간 누적)', () => {
  const warnings = new Warnings();
  const concept = {
    week: 'W01',
    no: 5,
    slug: 'c05',
    file: '05-샘플-개념.md',
    title: '샘플 개념',
    en: 'Sample Concept',
    tags: [],
    sections: [
      { key: 'definition', heading: '한 줄 정의', md: '이것은 정의다.' },
      {
        key: 'core',
        heading: '핵심 내용',
        md:
          '첫 번째 슬라이드다.\n\n' +
          '![W01 p10 슬라이드](../../수업노트/assets/W01/p10.png)\n\n' +
          '두 번째 슬라이드다.\n\n' +
          '![W01 p11 슬라이드](../../수업노트/assets/W01/p11.png)',
      },
      {
        key: 'quiz',
        heading: '예상 퀴즈 포인트',
        md: '1. 첫 문제\n2. 순수 시장과 조직화된 시장의 차이를 설명하라.',
      },
    ],
  };

  renderConcept(concept, warnings);

  for (const section of concept.sections) {
    assert.ok(section.html && section.html.length > 0, `${section.key} html 없음`);
    assert.ok(section.plain && section.plain.length > 0, `${section.key} plain 없음`);
  }

  // core 섹션의 이미지 두 개가 모두 concept.images에 들어있어야 한다
  // (이미지 누적이 조용히 깨졌던 지점)
  const names = concept.images.map((i) => i.name).sort();
  assert.deepEqual(names, ['p10', 'p11']);

  assert.equal(concept.quizPoints.length, 2);
  for (const qp of concept.quizPoints) {
    assert.ok('html' in qp && 'text' in qp && 'isComparison' in qp);
  }
  assert.equal(concept.quizPoints[0].isComparison, false);
  assert.equal(concept.quizPoints[1].isComparison, true);
});

test('renderConcept은 서로 다른 섹션의 이미지를 덮어쓰지 않고 누적한다', () => {
  const warnings = new Warnings();
  const concept = {
    week: 'W01',
    no: 6,
    slug: 'c06',
    file: '06-샘플-개념2.md',
    title: '샘플 개념2',
    en: '',
    tags: [],
    sections: [
      { key: 'analogy', heading: '쉽게 말하면', md: '![비유 이미지](../../수업노트/assets/W01/p10.png)' },
      { key: 'core', heading: '핵심 내용', md: '![핵심 이미지](../../수업노트/assets/W01/p11.png)' },
    ],
  };
  renderConcept(concept, warnings);
  const names = concept.images.map((i) => i.name).sort();
  assert.deepEqual(names, ['p10', 'p11']);
});

// --- Finding 3: COMPARISON_RE 확장 ---

test('비교형 분류가 "차이"/"비교하라" 문구도 잡고 일반 정의 문제는 잡지 않는다', () => {
  const warnings = new Warnings();
  const concept = {
    week: 'W01',
    no: 9,
    slug: 'c09',
    file: '09-비교-테스트.md',
    title: '비교 테스트',
    en: '',
    tags: [],
    sections: [
      {
        key: 'quiz',
        heading: '예상 퀴즈 포인트',
        md: [
          '1. 순수 시장과 조직화된 시장의 차이를 설명하라.',
          '2. NIS, SIS, TIS, StS의 분석 단위가 각각 무엇인지 비교하라.',
          '3. 기술 고착의 정의를 설명하라.',
        ].join('\n'),
      },
    ],
  };
  renderConcept(concept, warnings);
  const [diffQ, compareQ, plainQ] = concept.quizPoints;
  assert.equal(diffQ.isComparison, true, '차이 문구는 비교형이어야 한다');
  assert.equal(compareQ.isComparison, true, '비교하라 문구는 비교형이어야 한다');
  assert.equal(plainQ.isComparison, false, '일반 정의 문제는 비교형이 아니어야 한다');
});

// --- Finding 4: alt 텍스트 이스케이프 ---

test('alt 텍스트의 큰따옴표가 잘리지 않고 이스케이프된다', () => {
  const html = renderMarkdown('![alt "with" quotes](../../수업노트/assets/W01/p10.png)', ctx());
  assert.match(html, /alt="alt &quot;with&quot; quotes"/);
  assert.match(html, /<figcaption>alt &quot;with&quot; quotes<\/figcaption>/);
});

test('alt 텍스트의 <, &도 이스케이프된다', () => {
  const html = renderMarkdown('![a <b> & c](../../수업노트/assets/W01/p10.png)', ctx());
  assert.match(html, /alt="a &lt;b&gt; &amp; c"/);
  assert.match(html, /<figcaption>a &lt;b&gt; &amp; c<\/figcaption>/);
});

test('한 문단에 이미지 두 개는 <p> 래핑 없이 형제 figure로 남는다', () => {
  const html = renderMarkdown(
    '![하나](../../수업노트/assets/W01/p10.png) ![둘](../../수업노트/assets/W01/p11.png)',
    ctx()
  );
  assert.ok(!html.includes('<p>'), '<p>가 남으면 안 된다');
  const count = (html.match(/<figure class="slide">/g) || []).length;
  assert.equal(count, 2);
});

// --- Finding 5: toPlainText 이중 디코딩 방지 ---

test('toPlainText는 이스케이프된 엔티티를 이중 디코딩하지 않는다', () => {
  assert.equal(toPlainText('<p>&amp;lt;br&amp;gt;</p>'), '&lt;br&gt;');
});

// --- Finding 6: slugifyHeading 충돌 방지 ---

test('같은 슬러그로 좁혀지는 헤딩 두 개는 -2로 구분된 id를 받는다', () => {
  const html = renderMarkdown('### 개념!\n\n내용\n\n### 개념?\n\n내용2', ctx());
  const ids = [...html.matchAll(/<h3 id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, 2);
  assert.equal(ids[0], 'c05-h-개념');
  assert.equal(ids[1], 'c05-h-개념-2');
});

// --- Finding 7: ctx.images 누적 ---

test('renderMarkdown을 같은 ctx로 두 번 호출하면 이미지가 누적된다', () => {
  const c = ctx();
  renderMarkdown('![첫째](../../수업노트/assets/W01/p10.png)', c);
  renderMarkdown('![둘째](../../수업노트/assets/W01/p11.png)', c);
  const names = c.images.map((i) => i.name).sort();
  assert.deepEqual(names, ['p10', 'p11']);
});
