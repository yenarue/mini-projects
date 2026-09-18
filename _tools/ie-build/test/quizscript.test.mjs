import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { combineQuizScript, buildQuizScript } from '../lib/quizscript.mjs';

/**
 * file:// CORS 회귀 수정: quiz-logic.mjs(ESM)와 quiz.js(module 스크립트, 브라우저
 * IIFE)를 하나의 classic script로 합치는 lib/quizscript.mjs를 검증한다.
 */

const LOGIC_FIXTURE = `export function sortByImportance(items) {
  return items.slice().sort((a, b) => b.stars - a.stars);
}

export function applyFilters(items, opts) {
  return items.filter((it) => !opts.starsOnly || it.stars >= 4);
}
`;

const MAIN_FIXTURE = `import { sortByImportance, applyFilters } from './quiz-logic.mjs';

(function () {
  'use strict';
  globalThis.__quizProbe = {
    sorted: sortByImportance([{ stars: 1 }, { stars: 5 }]),
    filtered: applyFilters([{ stars: 5 }, { stars: 1 }], { starsOnly: true }),
  };
})();
`;

test('combineQuizScript: export/import 키워드를 모두 벗겨낸다', () => {
  const combined = combineQuizScript(LOGIC_FIXTURE, MAIN_FIXTURE);
  assert.ok(!/\bexport\b/.test(combined), 'export 토큰이 남아있으면 안 된다');
  assert.ok(!/\bimport\b/.test(combined), 'import 토큰이 남아있으면 안 된다');
});

test('combineQuizScript: type="module" 없이도 실제로 동작하는 classic script를 만든다', () => {
  const combined = combineQuizScript(LOGIC_FIXTURE, MAIN_FIXTURE);
  const sandbox = { globalThis: {} };
  sandbox.globalThis.globalThis = sandbox.globalThis;
  vm.runInNewContext(combined, sandbox); // module이 아닌 평범한 스크립트로 실행된다
  // vm 컨텍스트의 배열은 이 realm의 Array와 다른 realm이라 deepStrictEqual이
  // "같은 구조지만 참조가 다르다"고 던진다 — JSON을 오가며 이 realm의 평범한
  // 값으로 바꾼 뒤 비교한다.
  const probe = JSON.parse(JSON.stringify(sandbox.globalThis.__quizProbe));
  assert.deepEqual(probe.sorted.map((it) => it.stars), [5, 1]);
  assert.deepEqual(probe.filtered.map((it) => it.stars), [5]);
});

test('combineQuizScript: 처리 못한 export/import가 남으면 조용히 넘기지 않고 던진다', () => {
  assert.throws(() => combineQuizScript('export default {};\n', MAIN_FIXTURE), /export/);
  assert.throws(() => combineQuizScript(LOGIC_FIXTURE, "import x from 'y';\n"), /import/);
});

test('buildQuizScript: 실제 assets/js 소스 파일을 읽어 합쳐도 export/import가 남지 않는다', () => {
  const toolDir = new URL('..', import.meta.url).pathname;
  const combined = buildQuizScript(toolDir);
  assert.ok(!/\bexport\s+(function|const|class)\b/.test(combined));
  assert.ok(!/^import\b/m.test(combined));
  // 실제 함수 이름이 살아있는지 최소 확인
  assert.match(combined, /function sortByImportance/);
  assert.match(combined, /function applyFilters/);
});
