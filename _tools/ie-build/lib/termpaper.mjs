import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { Marked } from 'marked';
import { renderMarkdown, toPlainText, strongKoExtension, strictDelTokenizer } from './render.mjs';
import { conceptHref, parseRelatedRef } from './links.mjs';

/**
 * Term Paper 페이지(termpaper.html)의 원본을 읽는다.
 *
 * 내용의 정본은 Google Drive `TermPaper/web/*.md`다. 파일 하나 = 페이지의 섹션
 * 하나(사이드바 항목 하나)이고, 파일명 순서대로 싣는다. 지금은 과제 안내만 있지만
 * 나중에 Proposal·본문 정리 파일을 같은 폴더에 추가하면 코드를 고치지 않고 쌓인다.
 *
 * 파일 형식:
 *   ---                      (선택) frontmatter
 *   title: 과제 안내          없으면 첫 `# ` 제목 → 파일명 순으로 대신 쓴다
 *   subtitle: …              제목 아래 한 줄
 *   updated: 2026-10-30      메타 줄에 표시
 *   draft: true              true면 사이트에 싣지 않는다(작성 중인 본문 보호)
 *   ---
 *   # 제목                    첫 `# `은 제목으로 쓰이고 본문에서 빠진다
 *   ## 소제목                  한 단계씩 내려 h3가 된다 → 사이드바 하위 목차
 *
 * `_`로 시작하는 파일은 건너뛴다(메모·템플릿용).
 *
 * 본문 안의 ```frames 코드 블록(YAML 목록)은 프레임 카드로 바꾼다 — renderFrames 참고.
 * existingKeys("W06/1" 형태)를 넘기면 카드의 개념 링크가 실제로 있는지 확인한다.
 */
export function collectTermPaper(dir, warnings, existingKeys = null) {
  if (!dir || !fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_') && !f.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, 'ko'));

  const sections = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const { meta, body } = splitFrontmatter(raw, file, warnings);
    if (meta.draft === true) continue;

    const { title: h1, rest } = takeTitle(body);
    const n = sections.length + 1;
    const slug = `tp${String(n).padStart(2, '0')}`;
    const title = String(meta.title ?? h1 ?? file.replace(/\.md$/, '').replace(/^\d+[-_]/, ''));

    const label = `TermPaper/${file}`;
    const blocks = [];
    const md = demoteHeadings(rest).replace(/^```frames[^\n]*\n([\s\S]*?)^```[ \t]*$/gm, (_m, src) => {
      blocks.push(renderFrames(src, { warnings, label, existingKeys }));
      return `<!--tp-frames-${blocks.length - 1}-->`;
    });
    const ctx = { week: 'TermPaper', slug, warnings, label };
    const html = renderMarkdown(md, ctx)
      .replace(/<!--tp-frames-(\d+)-->/g, (_m, i) => blocks[Number(i)]);
    sections.push({
      file,
      slug,
      n,
      title,
      subtitle: meta.subtitle ? String(meta.subtitle) : '',
      updated: meta.updated ? formatDate(meta.updated) : '',
      html,
      headings: (ctx.headings ?? []).filter((h) => h.level === 3)
        .map((h) => ({ id: h.id, text: toPlainText(h.text) })),
    });
  }
  return sections;
}

function splitFrontmatter(raw, file, warnings) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return { meta: {}, body: raw };
  try {
    return { meta: yaml.load(m[1]) ?? {}, body: raw.slice(m[0].length) };
  } catch (err) {
    warnings.add('termpaper', `${file}: frontmatter 파싱 실패 — ${err.message}`);
    return { meta: {}, body: raw.slice(m[0].length) };
  }
}

/** 코드 블록 밖의 첫 `# 제목` 줄을 떼어 낸다. */
function takeTitle(body) {
  const lines = body.split('\n');
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) fence = !fence;
    if (fence) continue;
    const m = /^#\s+(.+?)\s*#*\s*$/.exec(lines[i]);
    if (m) {
      lines.splice(i, 1);
      return { title: m[1], rest: lines.join('\n') };
    }
    if (lines[i].trim()) break; // 제목보다 본문이 먼저 나오면 제목 없음
  }
  return { title: null, rest: body };
}

/** `##`→h3, `###`→h4 … (섹션 제목이 h2 자리를 쓰므로 본문 제목을 한 단계 내린다) */
function demoteHeadings(md) {
  let fence = false;
  return md.split('\n').map((line) => {
    if (/^\s*```/.test(line)) fence = !fence;
    if (fence) return line;
    return /^#{1,5}\s/.test(line) ? `#${line}` : line;
  }).join('\n');
}

function formatDate(v) {
  // js-yaml은 `2026-10-30`을 Date로 읽는다.
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
}

const STATUS_LABEL = { done: '다룸', planned: '예정', pending: '아직 안 다룸', ref: '참고용' };
// 본문(renderMarkdown)과 같은 한국어 굵게·취소선 규칙을 쓴다 — `**전환(transition)**을`처럼
// 닫는 ** 뒤에 조사가 붙는 경우를 CommonMark 기본 규칙은 굵게로 보지 않는다.
const inline = new Marked({ gfm: true });
inline.use({ extensions: [strongKoExtension], tokenizer: { del: strictDelTokenizer } });

function escHtml(v) {
  return String(v ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}

/**
 * ```frames 블록 → 계열별 카드 묶음.
 *
 *   - group: 구조의 차이          같은 group이 이어지면 한 묶음(그리드)으로 모인다
 *     name: NIS
 *     ko: 국가혁신시스템
 *     status: done               done | planned | pending | ref
 *     when: W06 · 10/10          상태 칩 옆에 붙는 진도
 *     desc: 한두 줄 설명 (인라인 마크다운 가능)
 *     example: 한국 vs 라틴아메리카 …  "예시" 라벨을 단 사례 한 줄 (선택, 인라인 마크다운)
 *     note: 💡 수업 전 요약 …      설명 아래 작은 출처 줄 (선택)
 *     links:
 *       - { ref: W06/1, label: NIS 개요 }
 *     id: nis                    (선택) 카드 앵커 → #frame-nis. 없으면 name의 영숫자로 만든다
 *                                — 한글 이름이면 id를 꼭 단다(marked가 한글 href를 퍼센트
 *                                인코딩해 링크 검사와 어긋난다)
 *
 * 본문 표 등에서 `[NIS](#frame-nis)`처럼 카드로 바로 링크할 수 있다.
 *
 * 링크 대상 개념이 아직 없으면 버튼을 만들지 않고 경고만 남긴다(빌드 링크 검사가
 * 존재하지 않는 앵커를 깨진 링크로 잡기 때문).
 */
/** 카드 앵커: `frame-` + id(없으면 name의 영숫자를 소문자·하이픈으로). 예: "SSIP · BS" → frame-ssip-bs */
export function frameId(it, n = 0) {
  const base = String(it.id ?? it.name ?? '').toLowerCase()
    .replace(/[^0-9a-z]+/g, '-').replace(/^-+|-+$/g, '');
  return `frame-${base || n}`;
}

export function renderFrames(src, { warnings, label, existingKeys = null }) {
  let items;
  try {
    items = yaml.load(src);
  } catch (err) {
    warnings.add('termpaper', `${label}: frames 블록 파싱 실패 — ${err.message}`);
    return '';
  }
  if (!Array.isArray(items)) {
    warnings.add('termpaper', `${label}: frames 블록은 YAML 목록이어야 합니다`);
    return '';
  }

  const groups = [];
  for (const it of items) {
    const g = String(it.group ?? '');
    if (!groups.length || groups[groups.length - 1].name !== g) groups.push({ name: g, items: [] });
    groups[groups.length - 1].items.push(it);
  }

  const card = (it, i) => {
    if (!it.id && !/[0-9a-z]/i.test(String(it.name ?? ''))) {
      warnings.add('termpaper', `${label}: 프레임 "${it.name}" 카드에 영문 id가 없어 frame-${i + 1}로 붙였습니다`);
    }
    const status = STATUS_LABEL[it.status] ? it.status : 'pending';
    const links = (it.links ?? []).map((l) => {
      const ref = parseRelatedRef(l.ref);
      if (!ref) {
        warnings.add('termpaper', `${label}: frames 링크 "${l.ref}" 해석 실패`);
        return '';
      }
      if (existingKeys && !existingKeys.has(`${ref.week}/${ref.no}`)) {
        warnings.add('termpaper', `${label}: frames 링크 "${l.ref}" 대상 개념이 아직 없습니다`);
        return '';
      }
      return `<a class="btn btn-quiet" href="${conceptHref(ref.week, ref.no)}">${escHtml(l.label ?? l.ref)} →</a>`;
    }).filter(Boolean).join('');
    return `<article class="frame-card frame-${status}" id="${escHtml(frameId(it, i + 1))}">
  <header class="frame-head">
    <h4 class="frame-name">${escHtml(it.name)}${it.ko ? ` <span class="frame-ko">${escHtml(it.ko)}</span>` : ''}</h4>
    <span class="frame-status">${STATUS_LABEL[status]}${it.when ? ` · ${escHtml(it.when)}` : ''}</span>
  </header>
  ${it.desc ? `<p class="frame-desc">${inline.parseInline(String(it.desc))}</p>` : ''}
  ${it.example ? `<p class="frame-example"><span class="frame-example-label">예시</span>${inline.parseInline(String(it.example))}</p>` : ''}
  ${it.note ? `<p class="frame-note">${inline.parseInline(String(it.note))}</p>` : ''}
  ${links ? `<p class="frame-links">${links}</p>` : ''}
</article>`;
  };

  return groups.map((g) => `<div class="frame-group">
${g.name ? `<p class="frame-group-label">${escHtml(g.name)}</p>` : ''}
<div class="frame-grid">
${g.items.map((it) => card(it, items.indexOf(it))).join('\n')}
</div>
</div>`).join('\n');
}
