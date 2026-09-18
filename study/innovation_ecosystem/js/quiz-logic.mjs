/**
 * 퀴즈 문항 정렬·필터 순수 함수 (Task 14).
 *
 * 브라우저(quiz.js)와 Node 테스트(test/quiz-logic.test.mjs)가 같은 파일을
 * 그대로 import한다 — 로직을 두 곳에 따로 적어두면 테스트가 실제로 뭘
 * 검증하는지 알 수 없게 되기 때문이다. 브라우저 네이티브 ES 모듈이라
 * 번들러도 새 런타임 의존성도 필요 없다.
 */

/**
 * 중요도(별점) 내림차순으로 정렬한다. 동점이면 비교형(isComparison) 문항을
 * 앞에 둔다 — 서술형 2~3문제라는 시험 형식에서 비교형이 답안 분량을 만들기
 * 쉽기 때문이다(PLAN.md Task 14 규칙). 그 밖의 동점은 원래 순서를 유지한다
 * (Array#sort는 ES2019+부터 표준상 안정 정렬이다).
 */
export function sortByImportance(items) {
  return items.slice().sort((a, b) => {
    const starDiff = (Number(b.stars) || 0) - (Number(a.stars) || 0);
    if (starDiff !== 0) return starDiff;
    const aRank = a.isComparison ? 0 : 1;
    const bRank = b.isComparison ? 0 : 1;
    return aRank - bRank;
  });
}

/**
 * 범위·필터를 모두 AND로 결합해 문항 목록을 좁힌다. opts에 없는(undefined/false)
 * 조건은 적용하지 않는다.
 *
 * @param {Array} items
 * @param {object} opts
 * @param {string[]} [opts.weeks] 선택된 주차 id 목록 — 주어지면 이 목록에 있는
 *   주차만 남긴다.
 * @param {string} [opts.onlyConceptId] 특정 개념(week/slug)의 문항만 남긴다.
 * @param {boolean} [opts.compareOnly] 비교형만.
 * @param {boolean} [opts.coreOnly] 쪽지시험 핵심 개념(core)만.
 * @param {boolean} [opts.starsOnly] 중요도 4점 이상만.
 * @param {boolean} [opts.againOnly] "다시" 표시된 문항만 (state 맵 기준).
 * @param {Object<string,string>} [opts.state] 문항 id → 'known' | 'again'.
 */
export function applyFilters(items, opts = {}) {
  const {
    weeks, onlyConceptId, compareOnly, coreOnly, starsOnly, againOnly,
    state = {},
  } = opts;

  return items.filter((it) => {
    if (weeks && weeks.indexOf(it.week) < 0) return false;
    if (onlyConceptId && it.conceptId !== onlyConceptId) return false;
    if (compareOnly && !it.isComparison) return false;
    if (coreOnly && !it.core) return false;
    if (starsOnly && !((Number(it.stars) || 0) >= 4)) return false;
    if (againOnly && state[it.id] !== 'again') return false;
    return true;
  });
}
