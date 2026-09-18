import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildQuizData, renderQuizPage } from '../templates/quiz.mjs';
import { Warnings } from '../build.mjs';

/**
 * Task 11b: 퀴즈 페이지는 더 이상 개념 본문(정의·비유·핵심 내용)을 통째로
 * 복제하지 않는다. buildQuizData의 두 번째 인자로 answersDir을 넘겨, 실제
 * _tools/ie-build/answers/의 내용과 무관하게(테스트 격리) 임시 디렉터리를 쓴다.
 */

const EMPTY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ie-quiz-empty-'));

function makeConcepts() {
  return [{
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
}
const weeks = [{ id: 'W01', topic: 'Intro', concepts: makeConcepts() }];
const quizSchedule = [{ n: 1, date: '2026-09-19', weeks: ['W01'] }];

test('퀴즈 포인트 하나가 문항 하나가 된다', () => {
  const { items } = buildQuizData(makeConcepts(), { answersDir: EMPTY_DIR });
  assert.equal(items.length, 2);
  assert.equal(items[0].id, 'W01/c05/0');
  assert.equal(items[0].conceptId, 'W01/c05');
  assert.equal(items[0].index, 0);
  assert.equal(items[1].index, 1);
  assert.equal(items[0].href, 'W01.html#c05');
});

test('비교형 플래그를 보존한다', () => {
  const { items } = buildQuizData(makeConcepts(), { answersDir: EMPTY_DIR });
  assert.equal(items[0].isComparison, false);
  assert.equal(items[1].isComparison, true);
});

test('답안 메타(제목·영문명·링크)는 개념당 하나만 만든다', () => {
  const { items, answers } = buildQuizData(makeConcepts(), { answersDir: EMPTY_DIR });
  assert.equal(items.length, 2);
  assert.equal(Object.keys(answers).length, 1);
  assert.equal(answers['W01/c05'].title, '세 가지 고착');
  assert.equal(answers['W01/c05'].en, 'Lock-in');
  assert.equal(answers['W01/c05'].href, 'W01.html#c05');
});

test('답안 파일이 없으면 byIndex가 비어 있다 (개념 본문을 대신 채우지 않는다)', () => {
  const { answers } = buildQuizData(makeConcepts(), { answersDir: EMPTY_DIR });
  assert.deepEqual(answers['W01/c05'].byIndex, {});
});

test('답안 파일의 질문 스냅샷이 현재 퀴즈 포인트와 일치하면 그 인덱스에 답안이 채워진다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ie-quiz-answers-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'W01-c05.md'),
      [
        '---',
        'week: W01',
        'no: 5',
        '---',
        '',
        '## Q1',
        '> 조직·기술·사용자 고착을 설명하라.',
        '',
        '**고착**은 시스템이 새 질서로 바뀌지 못하게 붙잡는 힘이다.',
        '',
      ].join('\n'),
      'utf8'
    );
    const warnings = new Warnings();
    const { answers } = buildQuizData(makeConcepts(), { answersDir: dir, warnings });
    assert.equal(warnings.items.filter((w) => w.scope === 'answer-mismatch').length, 0);
    assert.match(answers['W01/c05'].byIndex[0], /<strong>고착<\/strong>/);
    assert.equal(answers['W01/c05'].byIndex[1], undefined, '2번 문항은 답안 파일에 없으므로 비어 있어야 한다');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('답안 본문에 개념의 정의·비유·핵심 섹션 전체를 통째로 넣지 않는다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ie-quiz-answers-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'W01-c05.md'),
      ['---', 'week: W01', 'no: 5', '---', '', '## Q1', '> 조직·기술·사용자 고착을 설명하라.', '', '짧은 예시 답안이다.', ''].join('\n'),
      'utf8'
    );
    const { answers } = buildQuizData(makeConcepts(), { answersDir: dir });
    // 옛 방식이면 concept.sections의 'core' 섹션 원문("Johnson 2010")이 그대로 들어갔다.
    assert.ok(!answers['W01/c05'].byIndex[0].includes('Johnson 2010'));
    assert.match(answers['W01/c05'].byIndex[0], /짧은 예시 답안이다/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('질문 스냅샷이 실제 퀴즈 포인트와 다르면 경고를 내고 그 문항은 답안 없음으로 남긴다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ie-quiz-mismatch-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'W01-c05.md'),
      [
        '---',
        'week: W01',
        'no: 5',
        '---',
        '',
        '## Q1',
        '> 이것은 소스 노트가 고쳐지기 전의 옛날 질문이다.',
        '',
        '이 답안은 노출되면 안 된다.',
        '',
      ].join('\n'),
      'utf8'
    );
    const warnings = new Warnings();
    const { answers } = buildQuizData(makeConcepts(), { answersDir: dir, warnings });
    assert.equal(answers['W01/c05'].byIndex[0], undefined, '스냅샷이 다르면 답안을 절대 보여주면 안 된다');
    const mismatches = warnings.items.filter((w) => w.scope === 'answer-mismatch');
    assert.equal(mismatches.length, 1);
    assert.match(mismatches[0].message, /W01-c05\.md/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('공백·이모지 차이만 있는 스냅샷은 일치로 본다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ie-quiz-normalize-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'W01-c05.md'),
      [
        '---',
        'week: W01',
        'no: 5',
        '---',
        '',
        '## Q1',
        '>   조직·기술·사용자   고착을 설명하라.   ',
        '',
        '답안 본문.',
        '',
      ].join('\n'),
      'utf8'
    );
    const warnings = new Warnings();
    const { answers } = buildQuizData(makeConcepts(), { answersDir: dir, warnings });
    assert.equal(warnings.items.filter((w) => w.scope === 'answer-mismatch').length, 0);
    assert.match(answers['W01/c05'].byIndex[0], /답안 본문/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('데이터를 JSON 스크립트로 인라인 삽입한다', () => {
  const { items, answers } = buildQuizData(makeConcepts(), { answersDir: EMPTY_DIR });
  const html = renderQuizPage({ items, answers, weeks, quizSchedule });
  assert.match(html, /<script type="application\/json" id="quiz-data">/);
  assert.match(html, /세 가지 고착/);
});

test('회차 필터·주차 필터·답 항상 펼치기 토글을 렌더한다', () => {
  const { items, answers } = buildQuizData(makeConcepts(), { answersDir: EMPTY_DIR });
  const html = renderQuizPage({ items, answers, weeks, quizSchedule });
  assert.match(html, /id="quiz-range"/);
  assert.match(html, /value="1"/);
  assert.match(html, /data-week="W01"/);
  assert.match(html, /id="quiz-always-reveal"/);
});

test('문항 카드는 JS가 채우므로 stage는 비어 있다', () => {
  const { items, answers } = buildQuizData(makeConcepts(), { answersDir: EMPTY_DIR });
  const html = renderQuizPage({ items, answers, weeks, quizSchedule });
  assert.match(html, /<div class="quiz-stage" id="quiz-stage"><\/div>/);
});

test('안내문에 답안이 교수님 모범답안이 아님을 명시한다', () => {
  const { items, answers } = buildQuizData(makeConcepts(), { answersDir: EMPTY_DIR });
  const html = renderQuizPage({ items, answers, weeks, quizSchedule });
  assert.match(html, /교수님의 모범답안이 아니라/);
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
  const { items, answers } = buildQuizData(trickyConcepts, { answersDir: EMPTY_DIR });
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

test('Task 14: 문항이 개념의 별점(importance.stars)과 핵심 개념 여부(core)를 상속한다', () => {
  const concepts = makeConcepts();
  concepts[0].importance = { stars: 4, why: '테스트용' };
  concepts[0].coreRefs = [{ quiz: 1, n: 1, title: '핵심1', href: 'core.html#x-k1' }];
  const { items, answers } = buildQuizData(concepts, { answersDir: EMPTY_DIR });
  assert.equal(items.length, 2);
  assert.ok(items.every((it) => it.stars === 4), '모든 문항이 개념 별점을 그대로 상속해야 한다');
  assert.ok(items.every((it) => it.core === true), '핵심 개념으로 뽑힌 개념의 문항은 core가 true여야 한다');
  assert.equal(answers['W01/c05'].stars, 4, '답안 헤더 메타에도 별점이 실려야 한다');
});

test('Task 14: coreRefs가 없으면 core는 false, importance가 없으면 stars는 null이다', () => {
  const concepts = makeConcepts(); // importance/coreRefs를 붙이지 않은 기본 fixture
  const { items, answers } = buildQuizData(concepts, { answersDir: EMPTY_DIR });
  assert.ok(items.every((it) => it.core === false));
  assert.ok(items.every((it) => it.stars === null));
  assert.equal(answers['W01/c05'].stars, null);
});

test('Task 14: "응용:"으로 시작하는 문항은 isApplied가 true, 그 외는 false다', () => {
  const concepts = makeConcepts();
  concepts[0].quizPoints[0].isApplied = false;
  concepts[0].quizPoints[1] = {
    html: '응용: 자신의 조직에 적용해 보라.', text: '응용: 자신의 조직에 적용해 보라.',
    isComparison: false, isApplied: true,
  };
  const { items } = buildQuizData(concepts, { answersDir: EMPTY_DIR });
  assert.equal(items[0].isApplied, false);
  assert.equal(items[1].isApplied, true);
});

test('클라이언트 스크립트는 답안 없는 문항을 위한 안내 문구와 라벨 클래스를 갖고 있다', () => {
  const js = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'assets', 'js', 'quiz.js'),
    'utf8'
  );
  assert.match(js, /아직 답안 없음/);
  assert.match(js, /quiz-answer-label/);
  assert.match(js, /교수님의 모범답안이 아닙니다/);
});

test('클라이언트 스크립트는 "응용:" 문항을 위한 별도 안내 문구를 갖고 있다(Task 14)', () => {
  const js = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'assets', 'js', 'quiz.js'),
    'utf8'
  );
  assert.match(js, /응용 사고 문제/);
  assert.match(js, /quiz-no-answer-applied/);
  assert.match(js, /import \{ sortByImportance, applyFilters \} from '\.\/quiz-logic\.mjs';/);
});

test('회차 필터 다음에 정렬 선택과 핵심 개념/★4 이상 필터를 렌더한다(Task 14)', () => {
  const { items, answers } = buildQuizData(makeConcepts(), { answersDir: EMPTY_DIR });
  const html = renderQuizPage({ items, answers, weeks, quizSchedule });
  assert.match(html, /id="quiz-sort"/);
  assert.match(html, /value="importance">중요도 높은 순/);
  assert.match(html, /id="quiz-core-only"/);
  assert.match(html, /id="quiz-stars-only"/);
});

test('quiz.js는 type="module"로 로드된다(Task 14: quiz-logic.mjs를 import하므로)', () => {
  const { items, answers } = buildQuizData(makeConcepts(), { answersDir: EMPTY_DIR });
  const html = renderQuizPage({ items, answers, weeks, quizSchedule });
  assert.match(html, /<script type="module" src="js\/quiz\.js"><\/script>/);
});
