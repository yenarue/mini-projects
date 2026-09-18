import { Marked } from 'marked';
import { rewriteMdLink, rewriteImagePath } from './links.mjs';

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
    walkTokens(token) {
      if (token.type === 'link') {
        const r = rewriteMdLink(token.href, week);
        if (r.ok) {
          token.href = r.href;
        } else {
          warnings.add('render', `${label}: 링크를 해석할 수 없어 평문 처리 — ${token.href}`);
          // 링크를 평문으로 강등
          token.type = 'text';
          token.text = token.text ?? '';
          delete token.href;
          delete token.tokens;
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

  html = html.replace(/<h([34])>([\s\S]*?)<\/h\1>/g, (_m, lvl, inner) => {
    const base = `${slug}-h-${slugifyHeading(inner)}`;
    const n = seenIds.get(base) ?? 0;
    seenIds.set(base, n + 1);
    const id = n === 0 ? base : `${base}-${n + 1}`;
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });

  if (!ctx.images) ctx.images = [];
  ctx.images.push(...images);
  return html;
}

const COMPARISON_RE = /비교|차이|대비|\bvs\.?\b|↔/i;

/** 개념 객체에 html·quizPoints·images를 채워 넣는다. */
export function renderConcept(concept, warnings) {
  const allImages = [];
  const headingIds = new Map(); // 모든 섹션이 공유할 heading ID dedup 맵

  for (const section of concept.sections) {
    const ctx = {
      week: concept.week,
      slug: concept.slug,
      warnings,
      label: `${concept.week}/${concept.file}`,
      headingIds, // 모든 섹션이 같은 headingIds를 씀
    };
    section.html = renderMarkdown(section.md, ctx);
    section.plain = toPlainText(section.html);
    for (const img of ctx.images ?? []) allImages.push(img);
  }

  const quizSection = concept.sections.find((s) => s.key === 'quiz');
  concept.quizPoints = quizSection
    ? extractListItems(quizSection.html).map((html) => ({
        html,
        text: toPlainText(html),
        isComparison: COMPARISON_RE.test(toPlainText(html)),
      }))
    : [];

  concept.images = allImages;
  return concept;
}
