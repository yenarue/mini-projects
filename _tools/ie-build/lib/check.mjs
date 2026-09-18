import fs from 'node:fs';
import path from 'node:path';

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

const HREF_RE = /<a[^>]+href="([^"]+)"/g;
const IMG_RE = /<img[^>]+src="([^"]+)"/g;
const SCRIPT_LINK_RE = /<(?:script[^>]+src|link[^>]+href)="([^"]+)"/g;
const ID_RE = /\sid="([^"]+)"/g;
const JSON_SCRIPT_RE = /<script[^>]*type="application\/json"[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/script>/g;
const MODULE_SCRIPT_RE = /<script\b[^>]*\btype="module"[^>]*>/g;

function idsOf(html) {
  return new Set([...html.matchAll(ID_RE)].map((m) => m[1]));
}

/** `<a>`/`<img>`/`<script src>`/`<link href>`가 실제 라이브 DOM에서 갖는 href/src 값들. */
function domTargetsOf(html) {
  return [
    ...[...html.matchAll(HREF_RE)].map((m) => m[1]),
    ...[...html.matchAll(IMG_RE)].map((m) => m[1]),
    ...[...html.matchAll(SCRIPT_LINK_RE)].map((m) => m[1]),
  ];
}

/**
 * `<script type="application/json">` 블록을 페이지 텍스트에서 떼어낸다.
 * 이 블록은 JS로 실행되지 않고 텍스트 콘텐츠로만 존재하므로, 라이브 DOM
 * 검사(id 수집·href/src 정규식 스캔) 대상에서 제외해야 한다. 안 떼어내면
 * JSON 안의 `"id":"..."`, `"href":"..."` 같은 키-값 표기가 공교롭게 우리
 * HTML 속성 정규식과 겹쳐 보일 수 있고(실측 결과 현재는 겹치지 않지만,
 * JSON.stringify는 컨텐츠에 따라 형태가 달라질 수 있어 안전하게 배제한다),
 * 반대로 그 안의 실제 id 후보를 페이지의 "라이브 id"로 잘못 인정해버리는
 * 위험도 있다.
 */
function stripJsonScripts(html) {
  return html.replace(JSON_SCRIPT_RE, '');
}

function jsonScriptsOf(html) {
  return [...html.matchAll(JSON_SCRIPT_RE)].map((m) => ({ id: m[1], text: m[2] }));
}

/**
 * JSON 데이터에서 실제 링크로 쓰일 수 있는 문자열을 모은다.
 *
 * 두 가지 형태를 잡는다:
 * 1. `href`/`src` 키의 문자열 값 그 자체 — 예: `{"href":"W01.html#c05"}`.
 *    클라이언트 JS가 이 값을 그대로 `<a href="...">`에 꽂아 넣는 실제 내비게이션
 *    타깃이다(quiz-data의 items[].href·answers[].href, map-data의 nodes[].href).
 * 2. 다른 문자열 값(예: 렌더된 답안 HTML) 안에 박힌 `<a href="...">` 같은
 *    태그 조각 — `domTargetsOf()`로 다시 스캔한다. 답안 마크다운의 링크가
 *    marked를 거쳐 실제 앵커 태그로 바뀐 뒤 JSON.stringify에 실려 들어간다.
 *
 * "id" 키는 의도적으로 건너뛴다 — JSON 값의 id는 실행 후 DOM에 생기는 id의
 * 소스일 뿐, 정적 HTML을 읽는 이 검사기 시점에는 아직 존재하지 않는 페이지의
 * id라서 "이 페이지의 라이브 id 집합"에 넣으면 오히려 틀린 판정(다른 진짜
 * 깨진 프래그먼트 링크를 통과시키는 거짓 음성)을 만든다.
 */
function collectJsonHrefs(node, out) {
  if (Array.isArray(node)) {
    for (const v of node) collectJsonHrefs(v, out);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, v] of Object.entries(node)) {
      if ((key === 'href' || key === 'src') && typeof v === 'string') {
        out.push(v);
      } else if (typeof v === 'string') {
        out.push(...domTargetsOf(v));
      } else {
        collectJsonHrefs(v, out);
      }
    }
  }
}

/**
 * 생성된 사이트의 내부 링크·이미지·앵커가 전부 실재하는지 확인한다.
 *
 * quiz.html/map.html은 `<script type="application/json">` 안에 데이터를 심어두고
 * 클라이언트 JS가 그걸로 DOM을 그린다(퀴즈 답안의 링크, 그래프 노드의 href 등).
 * 이 데이터는 "라이브 DOM은 아니다" — 정적 HTML을 훑는 이 검사기가 실행 시점의
 * DOM을 재현할 수는 없다. 하지만 그 안의 href 값 대부분(예: "W01.html#c05")은
 * 결국 실제 페이지로 가는 진짜 링크이고, 답안 마크다운의 링크가 깨져도 이 데이터
 * 안에서만 깨지므로 무시하면 그 깨짐을 영영 못 본다.
 *
 * 그래서 두 트랙으로 나눈다:
 * 1. JSON 블록을 페이지 텍스트에서 제거한 "라이브 DOM 텍스트"에서 <a>/<img>/
 *    <script src>/<link href>를 정규식으로 스캔한다(기존 방식). 이 트랙의
 *    `#앵커`는 같은 페이지의 실제 id와 대조한다.
 * 2. 제거하기 전에 각 JSON 블록을 파싱해, 그 안의 모든 문자열 리프에서
 *    "<a href=...>" 같은 HTML 태그 조각을 다시 정규식으로 찾아 확인한다.
 *    이 트랙의 `#앵커`(자기 페이지를 향한 순수 프래그먼트, 예: "#top")는
 *    검사하지 않는다 — 그 프래그먼트가 존재할 DOM은 클라이언트 JS가 그
 *    데이터를 렌더링한 *뒤*에만 생기고, 정적 파일에는 아직 없다. 파일+앵커
 *    형태("W01.html#c05")는 대상 파일이 이미 존재하는 정적 페이지이므로
 *    그대로 검사한다 — 여기서 실제로 깨진 링크를 찾을 수 있다.
 */
export function checkLinks(outDir) {
  const pages = fs.readdirSync(outDir).filter((f) => f.endsWith('.html'));
  const cache = new Map();

  const read = (file) => {
    if (!cache.has(file)) {
      const abs = path.join(outDir, file);
      cache.set(file, fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null);
    }
    return cache.get(file);
  };

  let checked = 0;
  const broken = [];

  function checkHref(fromLabel, href, { selfIds, allowSelfAnchor }) {
    if (!href || EXTERNAL.test(href)) return;

    if (href.startsWith('#')) {
      if (!allowSelfAnchor) return; // JSON 트랙: 정적 파일에 없는 런타임 DOM이라 판단 불가·집계 제외
      checked += 1;
      if (!selfIds.has(href.slice(1))) {
        broken.push({ from: fromLabel, href, reason: `앵커 없음 (자기 페이지)` });
      }
      return;
    }

    const [filePart, anchor] = href.split('#');
    const clean = filePart.split('?')[0];
    if (!clean) return; // "?x=1" 같은 쿼리 전용 표기 — 파일명이 없어 검사 대상 아님
    checked += 1;

    const abs = path.join(outDir, clean);
    if (!fs.existsSync(abs)) {
      broken.push({ from: fromLabel, href, reason: `파일 없음: ${clean}` });
      return;
    }
    if (anchor && clean.endsWith('.html')) {
      const targetHtml = read(clean);
      if (targetHtml && !idsOf(targetHtml).has(anchor)) {
        broken.push({ from: fromLabel, href, reason: `앵커 없음 (${clean})` });
      }
    }
  }

  for (const page of pages) {
    const html = read(page);

    // 트랙 1: 라이브 DOM (JSON 블록 제외)
    const domHtml = stripJsonScripts(html);
    const selfIds = idsOf(domHtml);
    for (const href of domTargetsOf(domHtml)) {
      checkHref(page, href, { selfIds, allowSelfAnchor: true });
    }

    // 트랙 2: <script type="application/json"> 안의 데이터가 실어 나르는 링크
    for (const { id: scriptId, text } of jsonScriptsOf(html)) {
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        continue; // 파싱 실패한 JSON은 이 검사기의 책임 밖 — 다른 곳에서 이미 오류가 난다
      }
      const hrefs = [];
      collectJsonHrefs(data, hrefs);
      const label = `${page} (JSON#${scriptId || '?'})`;
      for (const href of hrefs) {
        checkHref(label, href, { selfIds, allowSelfAnchor: false });
      }
    }
  }

  return { checked, broken };
}

/**
 * 생성된 HTML 어디에도 `<script type="module">`이 남아있지 않은지 확인하고,
 * 있으면 즉시 던진다.
 *
 * 배경(Task 14 회귀): quiz.js가 quiz-logic.mjs를 import하려고 module 스크립트로
 * 바뀌었는데, file://로 연 페이지는 origin이 "null"이라 크롬이 ES 모듈 import를
 * CORS로 거부한다 — 스크립트가 전혀 실행되지 않아 quiz.html이 0/0으로 완전히
 * 비어 보였다. 이 사이트는 소유자가 디스크에서 직접 여는 게 정상적인 사용
 * 방식이라, module 스크립트가 출력물에 나타나는 순간 그건 "경고"가 아니라
 * 페이지 하나를 통째로 죽이는 회귀다. checkLinks()의 broken 목록에 조용히
 * 얹지 않고 별도로 던지는 이유도 그것이다 — 링크 검사기는 `--check`를 줄 때만
 * 돌지만, 이 검사는 매 빌드에서 돌아야 한다(build.mjs 참고).
 */
export function assertNoModuleScripts(outDir) {
  const pages = fs.readdirSync(outDir).filter((f) => f.endsWith('.html'));
  const offenders = [];
  for (const page of pages) {
    const html = fs.readFileSync(path.join(outDir, page), 'utf8');
    const matches = html.match(MODULE_SCRIPT_RE);
    if (matches) offenders.push({ page, matches });
  }
  if (offenders.length) {
    const detail = offenders
      .map((o) => `  ${o.page}: ${o.matches.join(', ')}`)
      .join('\n');
    throw new Error(
      '생성된 HTML에 <script type="module">이 남아있다. file://로 연 페이지는 ' +
      'origin이 "null"이라 브라우저가 ES 모듈 import를 CORS로 막아 스크립트가 ' +
      '전혀 실행되지 않는다(quiz.html이 0/0으로 완전히 비어 보인 Task 14 회귀와 ' +
      '같은 원인). 브라우저·테스트가 공유하는 소스는 그대로 두고, 빌드 시점에 ' +
      '하나의 classic script로 합쳐서 내보내라(lib/quizscript.mjs 참고).\n' + detail
    );
  }
}
