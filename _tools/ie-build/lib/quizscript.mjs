import fs from 'node:fs';
import path from 'node:path';

/**
 * quiz.html이 file://에서 완전히 비어 보이던 회귀(Task 14 이후)의 수정.
 *
 * Task 14는 정렬·필터 순수 함수를 assets/js/quiz-logic.mjs로 뽑아 브라우저
 * (quiz.js)와 Node 테스트(test/quiz-logic.test.mjs)가 같은 코드를 쓰게
 * 만들었다 — 좋은 방향이었다. 문제는 그 결합 방법이었다: quiz.js를
 * `<script type="module">`로 바꿔 quiz-logic.mjs를 import했는데, ES 모듈은
 * CORS 대상이라 origin이 "null"인 file:// 페이지에서는 브라우저가 로드
 * 자체를 거부한다. 소유자는 사이트를 디스크에서 직접 여는 게 정상 사용
 * 방식이라 스크립트가 전혀 실행되지 않고 퀴즈 페이지가 통째로 비었다.
 *
 * 해법: 소스는 그대로 두 파일로 나눠 두고(Node 테스트는 quiz-logic.mjs를
 * 계속 import), 빌드 시점에 이 둘을 한 파일로 합쳐 classic script로 낸다.
 * 번들러를 새로 들이지 않는다 — 두 파일 다 순수 JS라 단순 문자열 처리로
 * 충분하다.
 */

const EXPORT_DECL_RE = /^export\s+(function|const|class)\s/gm;
const IMPORT_LOGIC_RE = /^import\s*\{[^}]*\}\s*from\s*['"]\.\/quiz-logic\.mjs['"];\s*\n/m;

/**
 * quiz-logic.mjs(ESM, `export function ...`)와 quiz.js(브라우저 IIFE,
 * quiz-logic.mjs를 import)를 하나의 classic script 텍스트로 합친다.
 *
 * - quiz-logic.mjs 쪽은 top-level `export function/const/class` 선언에서
 *   `export` 키워드만 벗긴다 — 함수 자체는 그대로 두 파일이 이어붙은
 *   스크립트의 최상위(전역) 스코프에 선언된다.
 * - quiz.js 쪽은 quiz-logic.mjs를 가져오는 단 하나의 import 문을 지운다.
 *   quiz.js의 로직은 `(function () { ... })();` IIFE 안에 있으므로, 같은
 *   스크립트에서 그 앞에 선언된 전역 함수를 클로저로 그대로 참조한다.
 *
 * 처리 후에도 `export`/`import` 토큰이 남아있으면(다른 형태의 export가
 * 새로 생겼다는 뜻) 조용히 잘못된 스크립트를 내보내는 대신 바로 던진다 —
 * 이 실수는 quiz.html을 통째로 죽이는 종류라 빌드 시점에 잡아야 한다.
 */
export function combineQuizScript(logicSrc, mainSrc) {
  const logic = logicSrc.replace(EXPORT_DECL_RE, '$1 ');
  const main = mainSrc.replace(IMPORT_LOGIC_RE, '');

  if (/\bexport\b/.test(logic)) {
    throw new Error(
      'combineQuizScript: quiz-logic.mjs에 처리하지 못한 export가 남아있다 — ' +
      'EXPORT_DECL_RE가 다루지 않는 형태(export default, re-export 등)가 새로 생겼는지 확인하라.'
    );
  }
  if (/\bimport\b/.test(main)) {
    throw new Error(
      'combineQuizScript: quiz.js에 처리하지 못한 import가 남아있다 — ' +
      '새 import 문이 추가됐다면 이 함수도 같이 업데이트해야 한다.'
    );
  }

  return (
    `// 이 파일은 빌드 산출물이다 — assets/js/quiz-logic.mjs + assets/js/quiz.js를\n` +
    `// _tools/ie-build/lib/quizscript.mjs가 합쳐 classic script로 만든 것이다.\n` +
    `// 소스를 고치려면 위 두 파일을 고치고 node build.mjs를 다시 돌려라.\n` +
    `${logic}\n${main}`
  );
}

/** toolDir(=_tools/ie-build) 기준으로 실제 소스 파일 두 개를 읽어 합친 결과를 돌려준다. */
export function buildQuizScript(toolDir) {
  const logicSrc = fs.readFileSync(path.join(toolDir, 'assets/js/quiz-logic.mjs'), 'utf8');
  const mainSrc = fs.readFileSync(path.join(toolDir, 'assets/js/quiz.js'), 'utf8');
  return combineQuizScript(logicSrc, mainSrc);
}
