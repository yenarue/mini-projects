import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuizData, renderQuizPage } from '../templates/quiz.mjs';

const concepts = [{
  week: 'W01', no: 5, slug: 'c05', title: '세 가지 고착', en: 'Lock-in',
  quizPoints: [
    { html: '조직·기술·사용자 고착을 설명하라.', text: '조직·기술·사용자 고착을 설명하라.', isComparison: false },
    { html: '비교형: 추격과 프론티어를 비교하라.', text: '비교형: 추격과 프론티어를 비교하라.', isComparison: true },
  ],
  sections: [
    { key: 'definition', plain: '고착 때문에 시스템이 안 바뀐다.', html: '<p>고착 때문에 시스템이 안 바뀐다.</p>' },
    { key: 'analogy', plain: '새 길 비유', html: '<p>새 길 비유</p>' },
    { key: 'core', plain: '본문', html: '<h3 id="c05-h-a">1) 조직 고착</h3><p>Johnson 2010</p>' },
    { key: 'discussion', plain: '논점', html: '<p>논점</p>' },
  ],
}];
const weeks = [{ id: 'W01', topic: 'Intro', concepts }];
const quizSchedule = [{ n: 1, date: '2026-09-19', weeks: ['W01'] }];

test('퀴즈 포인트 하나가 문항 하나가 된다', () => {
  const { items } = buildQuizData(concepts);
  assert.equal(items.length, 2);
  assert.equal(items[0].id, 'W01/c05/0');
  assert.equal(items[0].conceptId, 'W01/c05');
  assert.equal(items[0].href, 'W01.html#c05');
});

test('비교형 플래그를 보존한다', () => {
  const { items } = buildQuizData(concepts);
  assert.equal(items[0].isComparison, false);
  assert.equal(items[1].isComparison, true);
});

test('답안은 개념당 하나만 만든다', () => {
  const { items, answers } = buildQuizData(concepts);
  assert.equal(items.length, 2);
  assert.equal(Object.keys(answers).length, 1);
  assert.equal(answers['W01/c05'].title, '세 가지 고착');
});

test('답안 본문에 정의·비유·핵심 내용이 모두 들어간다', () => {
  const { answers } = buildQuizData(concepts);
  const html = answers['W01/c05'].html;
  assert.match(html, /고착 때문에 시스템이 안 바뀐다/);
  assert.match(html, /새 길 비유/);
  assert.match(html, /Johnson 2010/);
});

test('답안 본문에 논점 등 나머지 섹션은 넣지 않는다', () => {
  const { answers } = buildQuizData(concepts);
  assert.ok(!answers['W01/c05'].html.includes('논점'));
});

test('답안 본문은 주차 페이지와 같은 .concept/.sec 선택자를 재사용한다', () => {
  const { answers } = buildQuizData(concepts);
  const html = answers['W01/c05'].html;
  assert.match(html, /<div class="concept quiz-answer-body">/);
  assert.match(html, /<div class="sec sec-definition"><h4>한 줄 정의<\/h4>/);
  assert.match(html, /<div class="sec sec-analogy"><h4>쉽게 말하면<\/h4>/);
  assert.match(html, /<div class="sec sec-core"><h4>핵심 내용<\/h4>/);
});

test('답안 안의 h3 id는 페이지 내 중복을 피해 접두사를 붙인다', () => {
  const { answers } = buildQuizData(concepts);
  assert.ok(!/id="c05-h-a"/.test(answers['W01/c05'].html));
  assert.match(answers['W01/c05'].html, /id="ans-c05-h-a"/);
});

test('데이터를 JSON 스크립트로 인라인 삽입한다', () => {
  const { items, answers } = buildQuizData(concepts);
  const html = renderQuizPage({ items, answers, weeks, quizSchedule });
  assert.match(html, /<script type="application\/json" id="quiz-data">/);
  assert.match(html, /세 가지 고착/);
});

test('회차 필터·주차 필터·답 항상 펼치기 토글을 렌더한다', () => {
  const { items, answers } = buildQuizData(concepts);
  const html = renderQuizPage({ items, answers, weeks, quizSchedule });
  assert.match(html, /id="quiz-range"/);
  assert.match(html, /value="1"/);
  assert.match(html, /data-week="W01"/);
  assert.match(html, /id="quiz-always-reveal"/);
});

test('문항 카드는 JS가 채우므로 stage는 비어 있다', () => {
  const { items, answers } = buildQuizData(concepts);
  const html = renderQuizPage({ items, answers, weeks, quizSchedule });
  assert.match(html, /<div class="quiz-stage" id="quiz-stage"><\/div>/);
});

test('JSON 스크립트 안에 </script>·따옴표가 섞여도 태그를 깨지 않는다', () => {
  const trickyConcepts = [{
    week: 'W02-1', no: 1, slug: 'c01', title: '암묵지"와 </script> 형식지', en: 'Tacit vs "explicit"',
    quizPoints: [
      { html: '암묵지와 "형식지"의 차이를 설명하라. </script>', text: '암묵지와 형식지의 차이', isComparison: true },
    ],
    sections: [
      { key: 'definition', html: '<p>정의에 </script> 태그 흉내와 "따옴표"가 섞여 있다.</p>' },
      { key: 'analogy', html: '<p>비유</p>' },
      { key: 'core', html: '<p>핵심</p>' },
    ],
  }];
  const { items, answers } = buildQuizData(trickyConcepts);
  const w = [{ id: 'W02-1', topic: '미시', concepts: trickyConcepts }];
  const html = renderQuizPage({ items, answers, weeks: w, quizSchedule });

  // 실제 페이지에 </script> 텍스트가 원문 그대로 나타나면 안 된다 —
  // 나타난다면 스크립트 태그가 거기서 조기 종료됐다는 뜻이다.
  assert.ok(!html.includes('</script> 형식지'), '위험한 시퀀스가 이스케이프되지 않은 채 남아있다');

  const m = /<script type="application\/json" id="quiz-data">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(m, 'quiz-data 스크립트 태그를 찾을 수 없다 — 조기 종료된 것으로 보인다');
  const parsed = JSON.parse(m[1]);
  assert.match(parsed.answers['W02-1/c01'].title, /형식지/);
});
