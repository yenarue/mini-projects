/**
 * R2 — 내용 자동 변환 T1~T8 (REDESIGN.md §5).
 *
 * T1, T3, T4, T5, T6은 marked 렌더러 오버라이드(list/paragraph/blockquote/table)로
 * 구현한다. lib/render.mjs가 이 함수들을 marked.use({ renderer: {...} })에 그대로
 * 끼워 넣는다 — marked는 커스텀 렌더러 함수를 `fn.apply(renderer, args)`로 호출하므로
 * (marked 15 소스 확인), 여기 있는 일반 함수 선언들은 `this`가 실제 렌더러 인스턴스에
 * 바인딩된 채로 호출된다. `this.parser`·`this.listitem` 등 marked 내장 메서드를 그대로
 * 쓸 수 있는 이유가 이것이다.
 *
 * T2는 예외적으로 렌더된 HTML 문자열 위에서 동작한다(§ 하단 설명). T7·T8은 마크다운
 * 패턴이 아니라 개념 메타데이터(frontmatter·quizPoints)를 다루므로 템플릿 계층
 * (templates/week.mjs)에서 직접 호출한다 — 그래도 "변환 로직을 한 모듈에 모은다"는
 * 원칙을 지키기 위해 이 파일에 함께 둔다.
 *
 * 안전 원칙(REDESIGN.md §5 하단, 작업 지시 "Safety rule"): 패턴이 애매하면 절대
 * 변환하지 않고 원래대로 렌더한다. 모든 판정은 "정말 그 형태인가"를 먼저 확인하고,
 * 실패하면 조용히 기본 렌더링으로 폴백한다 — 원본 md는 절대 건드리지 않는다.
 */

// ------------------------------------------------------------------
// 측정용 카운터. 빌드 1회 전체(개념 25개)에 걸쳐 각 변환이 몇 번 발동했는지 센다.
// 테스트가 서로 간섭하지 않도록 resetCounts()로 리셋할 수 있다.
// ------------------------------------------------------------------
export function createCounts() {
  return { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0, t6: 0, t7: 0, t8: 0 };
}
export const counts = createCounts();
export function resetCounts() {
  Object.assign(counts, createCounts());
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]
  );
}

// ==================================================================
// T1 — 정의 목록 (3개 이상 연속 "**용어**: 설명" 항목 → 2열 표)
// ==================================================================

const DEFLIST_MIN = 3;
const DEFLIST_COLON_RE = /^\s*[:：]\s*/;

/**
 * 목록 항목 하나가 "**용어**: 설명" 형태인지 판정한다.
 * 성공하면 { termTokens, descTokens }를 돌려준다(둘 다 marked 인라인 토큰 배열 —
 * this.parser.parseInline()에 그대로 넣을 수 있다). 실패하면 null.
 *
 * 엄격한 조건(모두 만족해야 함):
 * - 항목이 블록 토�큰 정확히 1개여야 한다(중첩 리스트·여러 문단이 있으면 탈락 —
 *   설명이 여러 블록에 걸치는 항목은 표 한 칸에 욱여넣지 않는다).
 * - 그 블록의 첫 인라인 토큰이 strong(또는 strongKo — render.mjs의 커스텀 확장이
 *   만드는 "**a(b)**c" 패턴용 토큰 타입)이어야 한다.
 * - 그 바로 뒤 인라인 토큰이 텍스트이고, 콜론(반각 또는 전각)으로 시작해야 한다.
 */
function definitionMatch(item) {
  if (!item.tokens || item.tokens.length !== 1) return null;
  const block = item.tokens[0];
  if (block.type !== 'text' && block.type !== 'paragraph') return null;
  const inline = block.tokens;
  if (!Array.isArray(inline) || inline.length < 2) return null;

  const first = inline[0];
  if (first.type !== 'strong' && first.type !== 'strongKo') return null;
  if (!Array.isArray(first.tokens) || first.tokens.length === 0) return null;

  const second = inline[1];
  if (second.type !== 'text') return null;
  const m = DEFLIST_COLON_RE.exec(second.text);
  if (!m) return null;

  const restText = second.text.slice(m[0].length);
  const descTokens = [{ ...second, text: restText }, ...inline.slice(2)];
  // 설명이 완전히 빈 문자열이고 뒤에 다른 토큰도 없으면 의미 없는 매치이니 버린다.
  if (restText.length === 0 && descTokens.length === 1) return null;

  return { termTokens: first.tokens, descTokens };
}

/** 목록 전체가 정의 목록인지: 3개 이상이고 "전부" 매치해야 한다(부분 매치는 변환하지 않음). */
function isDefinitionList(token) {
  if (!token.items || token.items.length < DEFLIST_MIN) return false;
  return token.items.every((item) => definitionMatch(item) !== null);
}

function renderDefinitionTable(token, renderer) {
  let rows = '';
  for (const item of token.items) {
    const { termTokens, descTokens } = definitionMatch(item);
    const term = renderer.parser.parseInline(termTokens);
    const desc = renderer.parser.parseInline(descTokens);
    rows += `<tr><th scope="row" class="deflist-term">${term}</th><td class="deflist-desc">${desc}</td></tr>\n`;
  }
  counts.t1 += 1;
  return `<table class="deflist"><tbody>\n${rows}</tbody></table>\n`;
}

// ==================================================================
// T4 / T5 — 📄 슬라이드 근거 · 💡 보충 콜아웃 (문단 또는 목록 항목)
// ==================================================================

const SLIDE_EMOJI = '📄';
const NOTE_EMOJI = '💡';

function calloutKindFromText(text) {
  if (typeof text !== 'string') return null;
  if (/^\s*📄/.test(text)) return 'slide';
  if (/^\s*💡/.test(text)) return 'note';
  return null;
}

function calloutBadgeHtml(kind) {
  return kind === 'slide'
    ? `<span class="callout-badge callout-badge-slide" aria-hidden="true">${SLIDE_EMOJI}</span>`
    : `<span class="callout-badge callout-badge-note" aria-hidden="true">${NOTE_EMOJI}</span>`;
}

/** T4/T5 — 문단(paragraph) 오버라이드. 기본 동작은 marked 원본 paragraph()와 동일하게 맞춘다. */
export function paragraphRenderer(token) {
  const tokens = token.tokens ?? [];
  const first = tokens[0];
  if (first && first.type === 'text') {
    const kind = calloutKindFromText(first.text);
    if (kind) {
      const stripped = first.text.replace(/^\s*(?:📄|💡)\s*/, '');
      const bodyTokens = [{ ...first, text: stripped }, ...tokens.slice(1)];
      const body = this.parser.parseInline(bodyTokens);
      counts[kind === 'slide' ? 't4' : 't5'] += 1;
      return `<p class="callout callout-${kind}">${calloutBadgeHtml(kind)}${body}</p>\n`;
    }
  }
  return `<p>${this.parser.parseInline(tokens)}</p>\n`;
}

/**
 * 목록 항목 하나의 렌더된 <li>...</li> HTML에 콜아웃 배지를 입힌다.
 * marked 기본 listitem()이 만든 HTML을 그대로 받아, 앞부분(<li> 또는 <li><p>)
 * 바로 뒤에 오는 이모지만 정확히 앵커된 정규식으로 제거·배지로 치환한다.
 * 매치하지 않으면(=토큰상 이모지 시작이라고 판단했는데 실제 HTML 접두사가 다르면)
 * 원본을 그대로 돌려주고 카운트도 올리지 않는다 — 애매하면 손대지 않는다.
 */
function applyListItemCallout(liHtml, kind) {
  const emoji = kind === 'slide' ? SLIDE_EMOJI : NOTE_EMOJI;
  const cls = kind === 'slide' ? 'li-callout li-callout-slide' : 'li-callout li-callout-note';
  const re = new RegExp(`^<li>(\\s*<p>)?\\s*${emoji}\\s*`);
  let matched = false;
  const out = liHtml.replace(re, (_m, p) => {
    matched = true;
    return `<li class="${cls}">${p ?? ''}${calloutBadgeHtml(kind)}`;
  });
  if (!matched) return { html: liHtml, changed: false };
  return { html: out, changed: true };
}

function calloutKindForItem(item) {
  if (!item.tokens || item.tokens.length !== 1) return null;
  const block = item.tokens[0];
  const inline = block?.tokens;
  const first = Array.isArray(inline) ? inline[0] : null;
  if (!first || first.type !== 'text') return null;
  return calloutKindFromText(first.text);
}

// ==================================================================
// T1 fallback + T4/T5 (list item) — list() 오버라이드
// ==================================================================

/**
 * marked 15 기본 Renderer.list()와 동일한 래핑(<ul>/<ol> + start 속성)을 재현한다.
 * (node_modules/marked/lib/marked.cjs의 Renderer.prototype.list 참고, 주석에 출처 남김)
 * — 정의 목록이 아닐 때 폴백으로 쓴다. listitem()은 marked 기본 그대로 호출하고,
 * 그 결과 HTML에만 T4/T5 배지를 입힌다(리스트 구조 자체는 건드리지 않는다).
 */
export function listRenderer(token) {
  if (isDefinitionList(token)) {
    return renderDefinitionTable(token, this);
  }

  let body = '';
  for (const item of token.items) {
    let li = this.listitem(item);
    const kind = calloutKindForItem(item);
    if (kind) {
      const { html, changed } = applyListItemCallout(li, kind);
      if (changed) {
        counts[kind === 'slide' ? 't4' : 't5'] += 1;
        li = html;
      }
    }
    body += li;
  }
  const type = token.ordered ? 'ol' : 'ul';
  const startAttr = token.ordered && token.start !== 1 ? ` start="${token.start}"` : '';
  return `<${type}${startAttr}>\n${body}</${type}>\n`;
}

// ==================================================================
// T3 — 🗣 교수 발언 blockquote
// ==================================================================

// 실제 원고에서는 타임스탬프가 "🗣 [W01 40:48] "설명..." 처럼 이모지 바로 뒤,
// 인용의 맨 앞에 온다(REDESIGN.md 표현은 "trailing"이지만 실측 43건이 전부 이 형태 —
// report에 명시). 추출 위치와 무관하게 인용 흐름에서 빼내 카드 하단에 작게·우측
// 정렬로 보여주면 되므로, 소스상 위치는 앞이어도 그대로 뽑아 렌더 위치만 바꾼다.
const PROF_QUOTE_RE = /^\s*🗣\s*(\[[^\]]+\])?\s*/;

/**
 * 문단 하나가 "🗣로 시작하는 교수 발언 문단"인지 판정한다. 실패하면 null.
 * 성공하면 { parsedBody, timestamp } — parsedBody는 이모지·타임스탬프를 뺀
 * 나머지를 parseInline한 HTML, timestamp는 대괄호 안 텍스트(없으면 '').
 */
function profParagraphParts(renderer, p) {
  if (p.type !== 'paragraph') return null;
  const first = (p.tokens ?? [])[0];
  if (!first || first.type !== 'text' || !/^\s*🗣/.test(first.text)) return null;
  const m = PROF_QUOTE_RE.exec(first.text);
  const rest = first.text.slice(m[0].length);
  const bodyTokens = [{ ...first, text: rest }, ...p.tokens.slice(1)];
  const parsedBody = renderer.parser.parseInline(bodyTokens);
  const timestamp = m[1] ? escapeHtml(m[1].slice(1, -1)) : '';
  return { parsedBody, timestamp };
}

/**
 * `> 🗣 ...\n>\n> 🗣 ...` 처럼 빈 `>` 줄로 이어붙인 두 개 이상의 교수 발언이
 * 하나의 blockquote 토큰(문단 여러 개) 안에 들어오는 경우가 실제 원고에 있다
 * (W01/01 핵심 내용). 이 경우 "일부만 매치"가 아니라 "전부" 🗣로 시작해야만
 * 변환한다 — 안전 원칙(애매하면 원래대로)을 여기서도 지킨다.
 */
export function blockquoteRenderer(token) {
  const inner = token.tokens ?? [];
  // 빈 `>` 줄은 blockquote 안에서 'space' 토큰으로 따로 떨어져 나온다(문단
  // 사이 구분자일 뿐 발언이 아니므로 무시한다). paragraph·space가 아닌 다른
  // 토큰(중첩 목록·코드블록 등)이 하나라도 섞여 있으면 애매하다고 보고 변환하지 않는다.
  const hasOtherBlock = inner.some((t) => t.type !== 'paragraph' && t.type !== 'space');
  const paragraphs = inner.filter((t) => t.type === 'paragraph');
  const parts = paragraphs.map((p) => profParagraphParts(this, p));
  const allProf = !hasOtherBlock && paragraphs.length > 0 && parts.every((p) => p !== null);

  if (allProf) {
    counts.t3 += 1;
    const quotes = parts
      .map(
        ({ parsedBody, timestamp }) =>
          `<p class="quote-text">${parsedBody}</p>` +
          (timestamp ? `<span class="quote-time">${timestamp}</span>` : '')
      )
      .join('');
    return (
      `<blockquote class="quote-prof">` +
      `<span class="quote-icon" aria-hidden="true">🗣</span>` +
      quotes +
      `</blockquote>\n`
    );
  }
  // 기본 blockquote와 동일한 출력(marked 소스 Renderer.prototype.blockquote 참고)
  const body = this.parser.parse(token.tokens);
  return `<blockquote>\n${body}</blockquote>\n`;
}

// ==================================================================
// T6 — 표: 구조는 그대로, 가로 스크롤 래퍼만 추가
// ==================================================================

/**
 * marked 15 기본 Renderer.table()과 동일하게 만들고 <div class="table-scroll">로
 * 감싸기만 한다. 헤더 배경·홀짝 줄무늬·첫 열 강조는 CSS(styles.css)에서 처리한다 —
 * 내용(셀 텍스트·정렬)은 손대지 않는다.
 */
export function tableRenderer(token) {
  let header = '';
  let cell = '';
  for (let j = 0; j < token.header.length; j++) {
    cell += this.tablecell(token.header[j]);
  }
  header += this.tablerow({ text: cell });

  let body = '';
  for (let j = 0; j < token.rows.length; j++) {
    const row = token.rows[j];
    cell = '';
    for (let k = 0; k < row.length; k++) {
      cell += this.tablecell(row[k]);
    }
    body += this.tablerow({ text: cell });
  }
  const tbody = body ? `<tbody>${body}</tbody>` : '';
  counts.t6 += 1;
  return (
    `<div class="table-scroll"><table>\n<thead>\n${header}</thead>\n${tbody}</table></div>\n`
  );
}

// ==================================================================
// T2 — 번호 단계 카드 (### N) 제목 이 2개 이상 연속)
//
// 예외적으로 렌더된 HTML 문자열 위에서 동작한다. 이유: marked의 lexer가 만드는
// 최상위 토큰 배열(heading/paragraph/list/...)은 순서만 보존된 평평한 배열이라
// "헤딩 N개를 묶어 하나의 카드 그룹으로" 재구성하려면 그 배열 자체를 들어내야
// 하는데, 이는 사실상 파서를 새로 하나 더 만드는 것과 다르지 않다. 반면 render.mjs가
// 이미 h3/h4에 안정적인 id를 붙여 놓은 뒤(이 함수는 그 다음 단계에서 호출된다)의
// HTML은 "<h(1-3) ...>...</h(1-3)>"이 리터럴로만 등장한다는 보장이 있다 — marked는
// 이 파이프라인에서 원본 HTML 패스스루를 쓰지 않으므로 사용자 텍스트 안에 이
// 문자열이 우연히 나타날 수 없다. 그래서 여기서는 정규식으로 h1~h3 태그의 위치만
// 찾고(태그 자체는 절대 중첩되지 않으므로 안전), 경계는 "다음 h1~h3 시작 전까지"로
// 명시적으로 계산한다. 펜스 코드블록 안의 텍스트는 marked가 이미 &lt;h3&gt;로
// 이스케이프해 버리므로 이 정규식이 코드 안을 오검출할 위험도 없다.
// ==================================================================

const HEADING_TAG_RE = /<h([1-3])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/g;
const STEP_TITLE_RE = /^(\d+)\)\s*/;

function extractIdAttr(attrs) {
  const m = /\sid="([^"]*)"/.exec(attrs ?? '');
  return m ? m[1] : '';
}

export function groupNumberedSteps(html) {
  const headings = [];
  HEADING_TAG_RE.lastIndex = 0;
  let m;
  while ((m = HEADING_TAG_RE.exec(html))) {
    const level = Number(m[1]);
    const attrs = m[2];
    const inner = m[3];
    const stepMatch = level === 3 ? STEP_TITLE_RE.exec(inner) : null;
    headings.push({
      level,
      attrs,
      inner,
      start: m.index,
      end: HEADING_TAG_RE.lastIndex,
      isStep: !!stepMatch,
      stepNo: stepMatch ? stepMatch[1] : null,
    });
  }
  if (headings.length < 2) return html;

  // 인접한(사이에 다른 h1~h3가 없는) isStep 헤딩들의 연속 구간(길이 >= 2)을 찾는다.
  const runs = [];
  let i = 0;
  while (i < headings.length) {
    if (!headings[i].isStep) {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < headings.length && headings[j + 1].isStep) j += 1;
    if (j - i + 1 >= 2) runs.push([i, j]);
    i = j + 1;
  }
  if (runs.length === 0) return html;

  let out = html;
  for (let r = runs.length - 1; r >= 0; r -= 1) {
    const [a, b] = runs[r];
    const groupStart = headings[a].start;
    const groupEnd = b + 1 < headings.length ? headings[b + 1].start : html.length;

    let stepsHtml = '';
    for (let k = a; k <= b; k += 1) {
      const bodyStart = headings[k].end;
      const bodyEnd = k < b ? headings[k + 1].start : groupEnd;
      const body = html.slice(bodyStart, bodyEnd);
      const id = extractIdAttr(headings[k].attrs);
      const title = headings[k].inner.replace(STEP_TITLE_RE, '');
      stepsHtml +=
        `<div class="step-card"${id ? ` id="${id}"` : ''}>` +
        `<span class="step-no" aria-hidden="true">${escapeHtml(headings[k].stepNo)}</span>` +
        `<div class="step-body"><p class="step-title">${title}</p>${body}</div>` +
        `</div>\n`;
    }
    const replacement = `<div class="step-group">\n${stepsHtml}</div>\n`;
    out = out.slice(0, groupStart) + replacement + out.slice(groupEnd);
    counts.t2 += 1;
  }
  return out;
}

// ==================================================================
// T7 — frontmatter → 접힌 "출처" 패널 (메타 칩은 templates/week.mjs가 이미 만든다)
// ==================================================================

/**
 * concept.readings(리딩리스트)·concept.lectureRefs(수업노트 타임스탬프 참조)를
 * 접힌 <details> 패널로 만든다. 둘 다 비어 있으면 아무것도 렌더하지 않는다
 * (빈 패널을 만들어 "애매하면 만들지 않는다" 원칙을 지킨다).
 */
export function sourcePanel(concept) {
  const readings = concept.readings ?? [];
  const lectureRefs = concept.lectureRefs ?? [];
  if (readings.length === 0 && lectureRefs.length === 0) return '';

  counts.t7 += 1;

  const readingItems = readings.map((r) => `<li>${escapeHtml(r)}</li>`).join('');
  const lectureItems = lectureRefs.map((r) => `<li>${escapeHtml(r)}</li>`).join('');

  return `
<details class="sec-fold source-panel" data-sec="${concept.slug}-source">
  <summary>출처</summary>
  <div class="sec-body">
    ${readings.length ? `<h5>리딩</h5><ul class="source-list">${readingItems}</ul>` : ''}
    ${lectureRefs.length ? `<h5>수업노트</h5><ul class="source-list">${lectureItems}</ul>` : ''}
  </div>
</details>`;
}

// ==================================================================
// T8 — 예상 퀴즈 포인트 → 번호 카드 + 비교형/서술형 배지
// ==================================================================

/**
 * concept.quizPoints(render.mjs의 renderConcept이 이미 계산한 {html, text, isComparison})를
 * 받아 번호 카드 목록으로 그린다. isComparison 재계산은 하지 않는다(요청사항).
 */
export function quizCards(quizPoints) {
  if (!quizPoints || quizPoints.length === 0) return '';
  counts.t8 += 1;
  const items = quizPoints
    .map((qp, idx) => {
      const badgeClass = qp.isComparison ? 'quiz-badge-compare' : 'quiz-badge-desc';
      const badgeLabel = qp.isComparison ? '비교형' : '서술형';
      return `<li class="quiz-card">
    <span class="quiz-no">${idx + 1}</span>
    <div class="quiz-card-body">
      <span class="quiz-badge ${badgeClass}">${badgeLabel}</span>
      <div class="quiz-text">${qp.html}</div>
    </div>
  </li>`;
    })
    .join('\n');
  return `<ol class="quiz-cards">\n${items}\n</ol>`;
}
