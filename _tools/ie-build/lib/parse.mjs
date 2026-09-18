import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

/** 9섹션 정의. match는 이모지 제거 후 startsWith로 비교한다. */
export const SECTION_KEYS = [
  { key: 'definition', match: '한 줄 정의' },
  { key: 'analogy',    match: '쉽게 말하면' },
  { key: 'core',       match: '핵심 내용' },
  { key: 'discussion', match: '수업에서 나온 논점' },
  { key: 'examples',   match: '보충 사례' },
  { key: 'position',   match: '수업 프레임에서의 위치' },
  { key: 'related',    match: '관련 개념' },
  { key: 'quiz',       match: '예상 퀴즈 포인트' },
  { key: 'mynotes',    match: '나의 이해' },
];

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}]/gu;

export function stripEmoji(s) {
  return s.replace(EMOJI, '').trim();
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function sectionKeyFor(heading) {
  const clean = stripEmoji(heading);
  const hit = SECTION_KEYS.find((s) => clean.startsWith(s.match));
  return hit ? hit.key : null;
}

/** H1·출처 범례 blockquote를 버리고 이탤릭 부제만 뽑는다. */
function parsePreamble(preamble) {
  let subtitle = '';
  for (const line of preamble.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('>')) continue;
    const m = /^\*(.+)\*$/.exec(t);
    if (m) { subtitle = m[1].trim(); break; }
  }
  return { subtitle };
}

/** "(직접 작성)"·빈 리스트 마커·공백만 남으면 비어 있다고 본다. */
function isEmptyMyNotes(md) {
  const rest = md
    .replace(/\(직접 작성\)/g, '')
    .replace(/^[-*]\s*$/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, '');
  return rest.length === 0;
}

export function parseConceptFile(absPath, warnings) {
  const rel = path.basename(absPath);
  let raw;
  try {
    raw = fs.readFileSync(absPath, 'utf8');
  } catch (err) {
    warnings.add('parse', `${rel} 읽기 실패: ${err.message}`);
    return null;
  }

  const fm = FRONTMATTER.exec(raw);
  if (!fm) {
    warnings.add('parse', `${rel}: frontmatter가 없어 건너뜁니다`);
    return null;
  }

  let meta;
  try {
    meta = yaml.load(fm[1]) ?? {};
  } catch (err) {
    warnings.add('parse', `${rel}: frontmatter 파싱 실패 — ${err.message}`);
    return null;
  }

  const no = Number(meta.no);
  if (!Number.isInteger(no) || no < 1) {
    warnings.add('parse', `${rel}: no 값이 올바르지 않습니다 — "${meta.no}"`);
    return null;
  }

  const body = raw.slice(fm[0].length);

  // 섹션 분할
  const lines = body.split('\n');
  const sections = [];
  let preambleLines = [];
  let current = null;
  let inFence = false;

  for (const line of lines) {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence && line.startsWith('## ')) {
      if (current) sections.push(current);
      const heading = line.slice(3).trim();
      const key = sectionKeyFor(heading);
      if (!key) {
        warnings.add('parse', `${rel}: 알 수 없는 섹션 "${heading}" → other로 렌더`);
      }
      current = { key: key ?? 'other', heading, lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
    else preambleLines.push(line);
  }
  if (current) sections.push(current);

  if (inFence) {
    warnings.add('parse', `${rel}: 코드 펜스가 닫히지 않았습니다`);
  }

  const known = new Set(sections.map((s) => s.key));
  for (const { key, match } of SECTION_KEYS) {
    if (!known.has(key)) {
      warnings.add('parse', `${rel}: "${match}" 섹션이 없습니다`);
    }
  }

  const { subtitle } = parsePreamble(preambleLines.join('\n'));

  const knownKeys = new Set([
    'week', 'no', 'title', 'en', 'tags', 'slides',
    'lecture_refs', 'readings', 'related', 'status',
  ]);
  const extraMeta = {};
  for (const [k, v] of Object.entries(meta)) {
    if (!knownKeys.has(k)) extraMeta[k] = v;
  }

  const mynotes = sections.find((s) => s.key === 'mynotes');

  return {
    week: String(meta.week ?? '').trim(),
    no,
    slug: `c${String(no).padStart(2, '0')}`,
    file: rel,
    title: String(meta.title ?? '').trim(),
    en: String(meta.en ?? '').trim(),
    subtitle,
    tags: meta.tags ?? [],
    slides: meta.slides ?? [],
    lectureRefs: meta.lecture_refs ?? [],
    readings: meta.readings ?? [],
    relatedRaw: meta.related ?? [],
    status: meta.status === 'done' ? 'done' : 'draft',
    extraMeta,
    sections: sections.map((s) => ({
      key: s.key,
      heading: s.heading,
      md: s.lines.join('\n').trim(),
    })),
    hasMyNotes: mynotes ? !isEmptyMyNotes(mynotes.lines.join('\n')) : false,
  };
}

const WEEK_DIR = /^W\d{2}(-\d)?$/;

export function collectConcepts(conceptDir, warnings) {
  const weeks = fs.readdirSync(conceptDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && WEEK_DIR.test(e.name))
    .map((e) => e.name)
    .sort();

  const out = [];
  for (const week of weeks) {
    const dir = path.join(conceptDir, week);
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort();
    for (const f of files) {
      const c = parseConceptFile(path.join(dir, f), warnings);
      if (!c) continue;
      if (c.week !== week) {
        warnings.add('parse', `${week}/${f}: frontmatter week(${c.week})가 폴더명과 다릅니다`);
        c.week = week;
      }
      out.push(c);
    }
  }
  return out.sort((a, b) => (a.week === b.week ? a.no - b.no : a.week.localeCompare(b.week)));
}
