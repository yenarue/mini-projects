import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { rewriteMdLink, rewriteImagePath } from './links.mjs';
import {
  listRenderer,
  paragraphRenderer,
  blockquoteRenderer,
  tableRenderer,
  groupNumberedSteps,
} from './transform.mjs';

/** conceptHref()가 만드는 형식("W01.html#c05")에서 week/no를 뽑아 existingKeys에 있는지 본다. */
const CONCEPT_HREF_RE = /^(W\d{2}(?:-\d)?)\.html#c(\d{1,2})$/;

function targetConceptExists(href, existingKeys) {
  const m = CONCEPT_HREF_RE.exec(String(href));
  if (!m) return true; // 개념 앵커 형식이 아니면(외부 링크 등) 이 체크 대상이 아니다
  return existingKeys.has(`${m[1]}/${Number(m[2])}`);
}

/** 제목 → 앵커 슬러그. 한글은 그대로 두고 공백·기호만 정리한다. */
export function slugifyHeading(text) {
  return String(text)
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function toPlainText(html) {
  return String(html)
    .replace(/<figcaption>[\s\S]*?<\/figcaption>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39);/g, (_m, ent) =>
      ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[ent]
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 최상위(top-level) <li> 내용만 깊이를 세어 뽑는다.
 * 중첩 리스트(<ul><li>…</li></ul>)가 안에 있어도 바깥 <li>가 중간에서 잘리지 않는다.
 */
export function extractListItems(html) {
  const s = String(html);
  const tagRe = /<li[^>]*>|<\/li>/g;
  const items = [];
  let depth = 0;
  let start = -1;
  let m;
  while ((m = tagRe.exec(s))) {
    if (m[0].startsWith('</')) {
      if (depth > 0) {
        depth--;
        if (depth === 0 && start !== -1) {
          items.push(s.slice(start, m.index).trim());
          start = -1;
        }
      }
    } else {
      if (depth === 0) start = tagRe.lastIndex;
      depth++;
    }
  }
  return items.filter(Boolean);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]
  );
}

/**
 * marked 확장: `**개념(English)**조사` 처럼 닫는 `**` 바로 앞에 문장부호(예: `)`)가 오고
 * 뒤에 공백 없이 글자가 바로 붙는 경우를 <strong>으로 렌더한다.
 *
 * 배경: CommonMark의 right-flanking delimiter 규칙은 "구두점 뒤에 오는 닫는 델리미터는,
 * 그 뒤에 공백이나 구두점이 와야만" 닫을 수 있다고 정의한다. `)**조사`는 `)`(구두점) 뒤에
 * `**`가 오고 그 뒤에 한글 글자(구두점도 공백도 아님)가 바로 붙으므로 이 조건을 만족하지
 * 못해, marked(스펙을 따름)는 `**`를 델리미터로 닫지 못하고 별표를 그대로 텍스트에 남긴다.
 * 이 저자는 "**용어(영문)**조사" 패턴을 습관적으로 쓰므로 매주 계속 나온다.
 *
 * 이 확장은 flanking 규칙을 아예 따지지 않고 여는 `**`와 가장 가까운 닫는 `**` 쌍을
 * 직접 찾아 <strong>으로 렌더한다. 일반적인 `**foo** bar` 같은 케이스도 이 확장 하나로
 * 그대로 처리되고, 짝이 없는 `**`(닫는 `**`가 없는 경우)는 매치하지 않으므로 원문 그대로
 * 텍스트에 남는다(별표가 사라지거나 망가지지 않는다).
 *
 * 코드에는 손대지 않는다: 펜스 코드블록(```)은 block 단계에서 이미 별도 'code' 토큰으로
 * 분리되어 인라인 토크나이저 자체가 그 내용을 보지 못한다. 인라인 코드(`...`)는 marked의
 * codespan 토크나이저가 여는 백틱 위치에서 백틱~백틱 전체를 통째로 하나의 토큰으로 삼키므로,
 * 이 확장의 tokenizer는 그 백틱 내부의 `**`에는 결코 도달하지 않는다(커서가 백틱 위치에
 * 있을 때 이 확장의 정규식은 애초에 매치하지 않고, codespan 토크나이저가 그 자리를 가져간다).
 */
const STRONG_KO_RULE = /^\*\*(?!\*)(?!\s)([\s\S]+?)\*\*(?!\*)/;

/**
 * R4 Fix A — marked GFM 기본 del(취소선) 토크나이저는 `~~?`(물결표 1개 또는 2개)를
 * 모두 취소선으로 인식한다(marked 15 소스: `/^(~~?)(?=[^\s~])((?:\\.|[^\\])*?
 * (?:\\.|[^\s~\\]))\1(?=[^~]|$)/`). 이 저자는 "A~B" 형태(구석기~디지털혁명~바이오혁명)를
 * "A부터 B까지"라는 뜻의 범위 표시로 습관적으로 쓰는데, marked 기본값이 이 물결표
 * 하나짜리 쌍을 <del>로 렌더해 버려 의미가 정반대(취소선)로 뒤집힌다.
 *
 * 이 토크나이저는 물결표 정확히 2개(`~~...~~`)일 때만 매치하도록 좁힌다. 물결표
 * 1개는 이 함수가 매치하지 않고(undefined 반환) 아무 토큰도 만들지 않으므로, 렉서가
 * 다음 인라인 규칙(결국 text)으로 넘어가 물결표가 그대로 리터럴 텍스트에 남는다.
 * marked.use()의 tokenizer 병합 로직(node_modules/marked/lib/marked.cjs)은 커스텀
 * 함수가 정확히 `false`를 반환할 때만 원래 del 토크나이저로 폴백한다 — undefined는
 * 폴백을 일으키지 않으므로, 여기서 절대 `false`를 반환하지 않는다(폴백되면 원래의
 * 느슨한 물결표 1개 매치가 되살아나 이 수정 자체가 무력화된다).
 */
const STRICT_DEL_RE = /^~~(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))~~(?=[^~]|$)/;

function strictDelTokenizer(src) {
  const cap = STRICT_DEL_RE.exec(src);
  if (!cap) return undefined;
  return {
    type: 'del',
    raw: cap[0],
    text: cap[1],
    tokens: this.lexer.inlineTokens(cap[1]),
  };
}

const strongKoExtension = {
  name: 'strongKo',
  level: 'inline',
  start(src) {
    const idx = src.indexOf('**');
    return idx === -1 ? undefined : idx;
  },
  tokenizer(src) {
    const match = STRONG_KO_RULE.exec(src);
    if (!match) return undefined;
    return {
      type: 'strongKo',
      raw: match[0],
      text: match[1],
      tokens: this.lexer.inlineTokens(match[1]),
    };
  },
  renderer(token) {
    return `<strong>${this.parser.parseInline(token.tokens)}</strong>`;
  },
};

/**
 * 섹션 마크다운을 HTML로 렌더한다.
 * walkTokens로 href를 먼저 고치고(코드블록은 토큰 타입이 달라 자동으로 제외됨),
 * 렌더 후 h3/h4에 id를 붙인다.
 *
 * 주의: ctx.images는 덮어쓰지 않고 누적한다(없으면 새로 만든다). 같은 ctx로
 * 여러 번 호출하면 이전 호출에서 모인 이미지가 그대로 남아 있다. 섹션별로
 * 이미지를 따로 모으고 싶으면 호출마다 새 ctx를 쓸 것.
 *
 * h3/h4 앵커의 슬러그 충돌 방지 범위는 ctx.headingIds의 생명주기에 따른다:
 * - renderConcept가 ctx를 만들 때 ctx.headingIds를 전달하면, 그 개념의
 *   모든 섹션 렌더링이 같은 dedup map을 공유해 앵커 충돌이 방지된다.
 * - standalone 호출(테스트 등)에서 ctx.headingIds가 없으면, 이 호출 안에서만
 *   de-duplication이 이루어진다.
 */
export function renderMarkdown(md, ctx) {
  const { week, slug, warnings, label } = ctx;
  const images = [];

  const marked = new Marked({ gfm: true, breaks: false });

  marked.use({
    extensions: [strongKoExtension],
    tokenizer: { del: strictDelTokenizer }, // R4 Fix A — 물결표 2개일 때만 취소선
    walkTokens(token) {
      if (token.type === 'link') {
        const r = rewriteMdLink(token.href, week);
        if (!r.ok) {
          warnings.add('render', `${label}: 링크를 해석할 수 없어 평문 처리 — ${token.href}`);
          // 링크를 평문으로 강등
          token.type = 'text';
          token.text = token.text ?? '';
          delete token.href;
          delete token.tokens;
        } else if (ctx.existingKeys && !targetConceptExists(r.href, ctx.existingKeys)) {
          // 본문에 직접 쓴 [텍스트](../W02-2/05-*.md) 링크가 아직 작성되지 않은
          // 개념을 가리키는 경우. frontmatter related 필드와 달리 이건 저자가
          // 자유 텍스트로 쓴 링크라 build.mjs가 미리 걸러내지 못했고, 이미
          // "이 주차의 W02-2 관련 개념이 아직 없다"는 사실은 related 경고
          // 10건으로 보고되고 있으므로 여기서 또 경고를 추가하지는 않는다.
          // 존재하지 않는 앵커로 보내는 대신 평문으로 남긴다.
          token.type = 'text';
          token.text = token.text ?? '';
          delete token.href;
          delete token.tokens;
        } else {
          token.href = r.href;
        }
      } else if (token.type === 'image') {
        const r = rewriteImagePath(token.href);
        if (r.ok) {
          token.href = r.href;
          images.push({ href: r.href, week: r.week, name: r.name, src: token.href });
        } else {
          warnings.add('render', `${label}: 이미지 경로를 해석할 수 없음 — ${token.href}`);
        }
      }
    },
    renderer: {
      // marked의 기본 <img> 출력을 후처리하는 대신 직접 figure를 만든다.
      // alt/title에 따옴표·<·& 등이 섞여도 escapeHtml로 안전하게 처리한다
      // (marked 15는 alt 속성을 이스케이프하지 않는다).
      image(token) {
        const alt = escapeHtml(token.text ?? '');
        const src = token.href ?? '';
        return (
          `<figure class="slide">` +
          `<img src="${src}" alt="${alt}" loading="lazy" decoding="async">` +
          (alt ? `<figcaption>${alt}</figcaption>` : '') +
          `</figure>`
        );
      },
      // R2 내용 자동 변환(REDESIGN.md §5) — lib/transform.mjs가 실제 로직을 갖고,
      // 여기서는 marked 렌더러에 끼워 넣기만 한다.
      list: listRenderer,       // T1(정의 목록→표) + T4/T5(목록 항목 콜아웃)
      paragraph: paragraphRenderer, // T4/T5(문단 콜아웃)
      blockquote: blockquoteRenderer, // T3(🗣 교수 발언)
      table: tableRenderer,     // T6(표 가로 스크롤 래퍼)
    },
  });

  let html = marked.parse(md);

  // marked가 figure를 <p> 안에 넣는 경우 정리 (한 문단에 이미지 여러 개면
  // 형제 figure로 남고 <p> 래핑만 벗겨진다)
  html = html.replace(/<p>(\s*<figure class="slide">[\s\S]*?<\/figure>\s*)<\/p>/g, '$1');

  // h3/h4 앵커 — 슬러그가 겹치면 -2, -3 …으로 구분한다.
  // ctx.headingIds가 있으면 그것을 쓰고(renderConcept이 전달), 없으면 새로 만든다(standalone).
  if (!ctx.headingIds) ctx.headingIds = new Map();
  const seenIds = ctx.headingIds;

  // 사이드바의 소제목 목차가 쓸 목록을 이 자리에서 같이 모은다. 렌더가 끝난 HTML을
  // 나중에 다시 훑지 않는 이유는 바로 아래 groupNumberedSteps가 h3를 카드 wrapper로
  // 옮기면서 `<h3 id=...>` 모양을 없애기 때문이다(id 자체는 wrapper로 옮겨가 살아 있다).
  // 제목 텍스트와 앵커가 동시에 확실한 지점은 여기뿐이다.
  if (!ctx.headings) ctx.headings = [];

  html = html.replace(/<h([34])>([\s\S]*?)<\/h\1>/g, (_m, lvl, inner) => {
    const base = `${slug}-h-${slugifyHeading(inner)}`;
    const n = seenIds.get(base) ?? 0;
    seenIds.set(base, n + 1);
    const id = n === 0 ? base : `${base}-${n + 1}`;
    ctx.headings.push({ id, level: Number(lvl), text: toPlainText(inner) });
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });

  // T2(번호 단계 카드) — h3/h4 id가 이미 붙은 뒤에 돌려야 카드 wrapper에
  // 그 id를 그대로 옮겨서 기존 해시 링크(#c05-h-...)가 계속 동작한다.
  html = groupNumberedSteps(html);

  if (!ctx.images) ctx.images = [];
  ctx.images.push(...images);
  return html;
}

const COMPARISON_RE = /비교|차이|대비|\bvs\.?\b|↔/i;
// "응용:"으로 시작하는 문항은 정해진 답이 없는 사고 실험형 프롬프트다(Task 14).
// 서술형/비교형과 다른 차원의 구분이라 별도 플래그로 둔다 — 모범답안이 없는 이유가
// "아직 안 씀"이 아니라 "원래 답이 없음"임을 퀴즈 페이지가 구분해서 보여줄 수 있게 한다.
const APPLIED_RE = /^\s*응용\s*[:：]/;

// ==================================================================
// R4 — 개념 다이어그램 삽입 (REDESIGN.md §6)
//
// _tools/ie-build/diagrams/<week>-<slug>.svg (예: W01-c05.svg) 파일이 있으면
// 그 개념의 '핵심 내용' 섹션의 첫 슬라이드 이미지(<figure class="slide">) 바로
// 앞에 끼워 넣는다. 파일이 없으면 아무 것도 하지 않는다 — "10개 개념" 목록을
// 템플릿이나 이 모듈에 하드코딩하지 않고, 파일의 존재 여부만으로 판단한다
// (작업 지시: "Make the insertion data-driven (presence of the file), not a
// hardcoded list in the template").
// ==================================================================

const DIAGRAM_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'diagrams');

// 작업 지시("Attribution, and this is not optional"): 다이어그램은 교수의 강의
// 슬라이드가 아니라 이 사이트 제작자가 이해를 돕기 위해 그린 보충 자료이므로,
// 다른 💡 보충 콘텐츠와 같은 표시 규칙(💡 접두사)을 캡션에 붙인다.
const DIAGRAM_CAPTION =
  '💡 이 그림은 강의 슬라이드가 아니라, 이해를 돕기 위해 직접 정리한 보충 다이어그램입니다.';

function diagramFilePath(concept, diagramDir) {
  return path.join(diagramDir, `${concept.week}-${concept.slug}.svg`);
}

/**
 * concept.sections 중 'core'(핵심 내용) 섹션의 html에 다이어그램 figure를 끼워 넣는다.
 * 대응하는 SVG 파일이 없으면 아무 일도 하지 않는다. renderConcept이 section.html을
 * 다 채운 뒤 호출해야 한다.
 * @param {object} concept
 * @param {string} [diagramDir] 테스트에서 fixture 디렉터리를 넘길 수 있게 기본값을 둔다.
 */
export function insertDiagram(concept, diagramDir = DIAGRAM_DIR) {
  const core = concept.sections.find((s) => s.key === 'core');
  if (!core) return;

  const file = diagramFilePath(concept, diagramDir);
  if (!fs.existsSync(file)) return;

  const svg = fs.readFileSync(file, 'utf8').trim();
  const figure =
    `<figure class="concept-diagram">\n${svg}\n` +
    `<figcaption class="diagram-caption">${DIAGRAM_CAPTION}</figcaption>\n</figure>\n`;

  const marker = '<figure class="slide">';
  const idx = core.html.indexOf(marker);
  core.html = idx === -1 ? figure + core.html : core.html.slice(0, idx) + figure + core.html.slice(idx);
}

/**
 * 개념 객체에 html·quizPoints·images를 채워 넣는다.
 * @param {Set<string>} [existingKeys] "W01/5" 형태의 존재하는 개념 키 집합.
 *   전달되면 본문 마크다운 링크가 이 집합에 없는 개념을 가리킬 때 <a> 대신
 *   평문으로 남긴다(아직 쓰이지 않은 개념으로 가는 죽은 링크 방지). 생략하면
 *   (예: standalone 테스트) 이 체크를 하지 않는다 — build.mjs가 전체 개념
 *   목록을 안 뒤에만 의미가 있기 때문.
 */
export function renderConcept(concept, warnings, existingKeys) {
  const allImages = [];
  const headingIds = new Map(); // 모든 섹션이 공유할 heading ID dedup 맵

  for (const section of concept.sections) {
    const ctx = {
      week: concept.week,
      slug: concept.slug,
      warnings,
      label: `${concept.week}/${concept.file}`,
      headingIds, // 모든 섹션이 같은 headingIds를 씀
      existingKeys,
    };
    section.html = renderMarkdown(section.md, ctx);
    section.plain = toPlainText(section.html);
    section.headings = ctx.headings ?? [];
    for (const img of ctx.images ?? []) allImages.push(img);
  }

  insertDiagram(concept);

  const quizSection = concept.sections.find((s) => s.key === 'quiz');
  concept.quizPoints = quizSection
    ? extractListItems(quizSection.html).map((html) => {
        const text = toPlainText(html);
        return {
          html,
          text,
          isComparison: COMPARISON_RE.test(text),
          isApplied: APPLIED_RE.test(text),
        };
      })
    : [];

  concept.images = allImages;
  return concept;
}
