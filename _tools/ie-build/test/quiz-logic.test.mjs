import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortByImportance, applyFilters } from '../assets/js/quiz-logic.mjs';

/**
 * Task 14: 퀴즈 문항 중요도. sortByImportance/applyFilters는 브라우저(quiz.js)와
 * 이 테스트가 같은 파일(assets/js/quiz-logic.mjs)을 그대로 import해서 쓴다 —
 * 로직을 두 곳에 따로 적어두면 테스트가 실제 동작을 보증하지 못하기 때문이다.
 */

function item(overrides) {
  return Object.assign({
    id: 'W01/c01/0', conceptId: 'W01/c01', week: 'W01',
    isComparison: false, isApplied: false, stars: 3, core: false,
  }, overrides);
}

test('sortByImportance: 별점 내림차순으로 정렬한다', () => {
  const items = [item({ id: 'a', stars: 2 }), item({ id: 'b', stars: 5 }), item({ id: 'c', stars: 3 })];
  const sorted = sortByImportance(items);
  assert.deepEqual(sorted.map((it) => it.id), ['b', 'c', 'a']);
});

test('sortByImportance: 동점이면 비교형(isComparison)을 앞에 둔다', () => {
  const items = [
    item({ id: 'desc', stars: 4, isComparison: false }),
    item({ id: 'compare', stars: 4, isComparison: true }),
  ];
  const sorted = sortByImportance(items);
  assert.deepEqual(sorted.map((it) => it.id), ['compare', 'desc']);
});

test('sortByImportance: 별점도 비교형 여부도 같으면 원래 순서를 유지한다(안정 정렬)', () => {
  const items = [item({ id: 'first', stars: 3 }), item({ id: 'second', stars: 3 })];
  const sorted = sortByImportance(items);
  assert.deepEqual(sorted.map((it) => it.id), ['first', 'second']);
});

test('sortByImportance: 원본 배열을 바꾸지 않는다', () => {
  const items = [item({ id: 'a', stars: 2 }), item({ id: 'b', stars: 5 })];
  sortByImportance(items);
  assert.deepEqual(items.map((it) => it.id), ['a', 'b']);
});

test('applyFilters: 필터가 없으면 전부 남긴다', () => {
  const items = [item({ id: 'a' }), item({ id: 'b' })];
  assert.equal(applyFilters(items, {}).length, 2);
});

test('applyFilters: coreOnly와 starsOnly는 AND로 결합된다', () => {
  const items = [
    item({ id: 'core-high', core: true, stars: 5 }),
    item({ id: 'core-low', core: true, stars: 2 }),
    item({ id: 'noncore-high', core: false, stars: 5 }),
  ];
  const result = applyFilters(items, { coreOnly: true, starsOnly: true });
  assert.deepEqual(result.map((it) => it.id), ['core-high']);
});

test('applyFilters: starsOnly는 ★4 이상만 남긴다', () => {
  const items = [item({ id: 'a', stars: 4 }), item({ id: 'b', stars: 3 }), item({ id: 'c', stars: 5 })];
  const result = applyFilters(items, { starsOnly: true });
  assert.deepEqual(result.map((it) => it.id).sort(), ['a', 'c']);
});

test('applyFilters: compareOnly·coreOnly·againOnly·주차 필터가 모두 AND로 결합된다', () => {
  const state = { 'match/0': 'again', 'nomatch/0': 'again' };
  const items = [
    item({ id: 'match/0', conceptId: 'match', week: 'W01', isComparison: true, core: true, stars: 5 }),
    // 주차가 다름
    item({ id: 'wrong-week', conceptId: 'x', week: 'W02-1', isComparison: true, core: true, stars: 5 }),
    // again 표시가 없음
    item({ id: 'not-again', conceptId: 'y', week: 'W01', isComparison: true, core: true, stars: 5 }),
    // 비교형이 아님
    item({ id: 'nomatch/0', conceptId: 'nomatch', week: 'W01', isComparison: false, core: true, stars: 5 }),
  ];
  const result = applyFilters(items, {
    weeks: ['W01'], compareOnly: true, coreOnly: true, starsOnly: true, againOnly: true, state,
  });
  assert.deepEqual(result.map((it) => it.id), ['match/0']);
});

test('applyFilters: onlyConceptId가 있으면 그 개념 문항만 남긴다', () => {
  const items = [item({ id: 'a', conceptId: 'W01/c01' }), item({ id: 'b', conceptId: 'W01/c02' })];
  const result = applyFilters(items, { onlyConceptId: 'W01/c01' });
  assert.deepEqual(result.map((it) => it.id), ['a']);
});
