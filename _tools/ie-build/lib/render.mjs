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
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractListItems(html) {
  return [...String(html).matchAll(/<li>([\s\S]*?)<\/li>/g)]
    .map((m) => m[1].trim())
    .filter(Boolean);
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
  });

  let html = marked.parse(md);

  // 이미지를 figure로 감싼다
  html = html.replace(
    /<img src="([^"]+)" alt="([^"]*)"[^>]*>/g,
    (_m, src, alt) =>
      `<figure class="slide">` +
      `<img src="${src}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">` +
      (alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : '') +
      `</figure>`
  );
  // marked가 figure를 <p> 안에 넣는 경우 정리
  html = html.replace(/<p>(\s*<figure class="slide">[\s\S]*?<\/figure>\s*)<\/p>/g, '$1');

  // h3/h4 앵커
  html = html.replace(/<h([34])>([\s\S]*?)<\/h\1>/g, (_m, lvl, inner) => {
    const id = `${slug}-h-${slugifyHeading(inner)}`;
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });

  ctx.images = images;
  return html;
}

const COMPARISON_RE = /비교형|\bvs\.?\b|↔/i;

/** 개념 객체에 html·quizPoints·images를 채워 넣는다. */
export function renderConcept(concept, warnings) {
  const allImages = [];

  for (const section of concept.sections) {
    const ctx = {
      week: concept.week,
      slug: concept.slug,
      warnings,
      label: `${concept.week}/${concept.file}`,
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
