import fs from 'node:fs';
import path from 'node:path';
import { renderMarkdown } from './render.mjs';

/**
 * 시험 대비용 "무엇부터 볼 것인가" 데이터 두 가지를 한 곳에서 다룬다.
 *
 * 1) 중요도(importance.json) — 개념별 5점 만점 별점. 별점은 저자(사용자)의 판단이며
 *    빌드가 추정하지 않는다. 다만 아래 2)의 핵심개념에 뽑힌 개념은 정의상 최상위이므로
 *    5점으로 올린다(파일에 3이라고 적혀 있어도).
 * 2) 핵심개념 세트(core-concepts.json + 원본 md) — 퀴즈 회차별로 사용자가 직접 추린
 *    "핵심 개념 N개" 문서. 원본은 `개념정리/쪽지시험_핵심개념/*.md`이고, 이 모듈은
 *    그것을 읽어 항목으로 쪼갠다. 문서 내용을 이 리포지토리에 복사해 두지 않는다 —
 *    사용자가 md를 고치면 다음 빌드에 그대로 반영되어야 하기 때문.
 */

export const MAX_STARS = 5;

export function loadImportance(toolDir) {
  const file = path.join(toolDir, 'importance.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    default: Number(raw.default) || 3,
    concepts: raw.concepts ?? {},
  };
}

export function loadCoreSets(toolDir) {
  const file = path.join(toolDir, 'core-concepts.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** "**주차:** W02-1<br> **슬라이드:** p13–14" → [{label, value}, …] */
export function parseMetaPairs(raw) {
  const flat = String(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n')
    .map((l) => l.replace(/^\s*>\s?/, '').trim())
    .join('\n');

  const pairs = [];
  const re = /\*\*\s*([^*:]+?)\s*:\s*\*\*\s*([\s\S]*?)(?=\*\*\s*[^*:]+?\s*:\s*\*\*|$)/g;
  let m;
  while ((m = re.exec(flat))) {
    const value = m[2]
      .replace(/\s+/g, ' ')
      .replace(/[·,;\s]+$/, '')
      .trim();
    if (value) pairs.push({ label: m[1].trim(), value });
  }
  return pairs;
}

/**
 * 핵심개념 md 한 편을 항목 배열로 쪼갠다.
 * `## <번호>. <제목>` 이 항목이고, 그 밖의 `##`(예: "참고한 강의기록")은 버린다.
 */
export function parseCoreFile(absPath, warnings) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const lines = raw.split('\n');

  let docTitle = '';
  const introLines = [];
  const items = [];
  let current = null;
  let inFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;

    if (!inFence && line.startsWith('# ') && !docTitle) {
      docTitle = line.slice(2).trim();
      continue;
    }
    if (!inFence && line.startsWith('## ')) {
      const heading = line.slice(3).trim();
      const m = /^(\d+)\.\s*(.+)$/.exec(heading);
      if (current) items.push(current);
      current = m ? { n: Number(m[1]), title: m[2].trim(), lines: [] } : null;
      if (!m) {
        // "참고한 강의기록" 같은 부록 절. 여기서부터 문서 끝까지는 사이트에 싣지 않는다.
        current = null;
      }
      continue;
    }
    if (current) current.lines.push(line);
    else if (!items.length) introLines.push(line);
  }
  if (current) items.push(current);

  const parsed = items.map((item) => {
    const body = item.lines.join('\n').replace(/\n*^---\s*$\n*/gm, '\n').trim();
    const metaLines = [];
    const rest = [];
    let inMeta = true;
    for (const line of body.split('\n')) {
      if (inMeta && line.trim().startsWith('>')) metaLines.push(line);
      else if (inMeta && !line.trim() && !rest.length) continue;
      else { inMeta = false; rest.push(line); }
    }
    return {
      n: item.n,
      title: item.title,
      meta: parseMetaPairs(metaLines.join('\n')),
      bodyMd: rest.join('\n').trim(),
    };
  });

  if (!parsed.length) warnings.add('core', `${path.basename(absPath)}: 항목(## N. 제목)을 찾지 못했습니다`);
  return {
    title: docTitle,
    introMd: introLines.join('\n').trim(),
    items: parsed,
  };
}

/**
 * 개념에 importance/core 정보를 붙이고, 렌더링용 핵심개념 세트를 만든다.
 * 반환: { coreSets } — 각 세트는 { quiz, id, label, title, introMd, items[] }.
 *   item: { n, title, meta, bodyMd, anchor, concepts: [{week,no,href,title,slug}] }
 */
export function buildFocus({ toolDir, conceptDir, concepts, warnings }) {
  const importance = loadImportance(toolDir);
  const byKey = new Map(concepts.map((c) => [`${c.week}/${c.no}`, c]));

  for (const c of concepts) {
    const entry = importance.concepts[`${c.week}/${c.no}`];
    if (!entry) {
      warnings.add('importance', `${c.week}/${c.no} (${c.title}): importance.json에 없어 기본값 ${importance.default}점으로 표시합니다`);
    }
    const stars = Math.min(MAX_STARS, Math.max(1, Number(entry?.stars) || importance.default));
    c.importance = { stars, why: entry?.why ?? '' };
    c.coreRefs = [];
  }

  const coreSets = [];
  for (const set of loadCoreSets(toolDir)) {
    const abs = path.join(conceptDir, set.file);
    if (!fs.existsSync(abs)) {
      warnings.add('core', `핵심개념 원본이 없습니다 — ${set.file}`);
      continue;
    }
    const doc = parseCoreFile(abs, warnings);
    const mapped = new Map((set.items ?? []).map((i) => [i.n, i]));

    const items = doc.items.map((item) => {
      const entry = mapped.get(item.n);
      if (!entry) {
        warnings.add('core', `${set.file} ${item.n}번 "${item.title}": core-concepts.json에 개념 연결이 없습니다`);
      }
      const resolve = (keys) => (keys ?? []).map((key) => {
        const c = byKey.get(key);
        if (!c) {
          warnings.add('core', `${set.file} ${item.n}번: 연결된 개념 ${key}를 찾을 수 없습니다`);
          return null;
        }
        return c;
      }).filter(Boolean);

      const linked = resolve(entry?.concepts);
      // also는 "이 항목을 쓸 때 같이 보면 좋은" 개념이다. 핵심 배지도, 별점 승격도
      // 하지 않는다 — 핵심 N개라고 해 놓고 배지가 그보다 많이 붙으면 표시가 무의미해진다.
      const also = resolve(entry?.also);

      const anchor = `${set.id}-k${item.n}`;
      // 본문은 주차 페이지와 같은 렌더러를 쓴다 — 굵게·표·인용의 조판이 같아야
      // 한 사이트로 읽힌다. slug를 항목 앵커로 주어 혹시 소제목이 생겨도
      // 주차 페이지의 앵커(#c05-h-…)와 부딪히지 않는다.
      const ctx = { week: linked[0]?.week ?? '', slug: anchor, warnings, label: `${set.file} ${item.n}번` };
      const bodyHtml = renderMarkdown(item.bodyMd, ctx);
      for (const c of linked) {
        // 핵심개념에 뽑힌 개념은 정의상 최상위 — 별점을 5로 올린다.
        c.importance.stars = MAX_STARS;
        c.coreRefs.push({ quiz: set.quiz, n: item.n, title: item.title, href: `core.html#${anchor}` });
      }
      return { ...item, anchor, bodyHtml, concepts: linked, also };
    });

    const introHtml = doc.introMd
      ? renderMarkdown(doc.introMd, { week: '', slug: `${set.id}-intro`, warnings, label: `${set.file} 머리말` })
      : '';
    coreSets.push({ ...set, title: doc.title, introMd: doc.introMd, introHtml, items });
  }

  return { coreSets };
}
