import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { renderMarkdown } from './render.mjs';
import { stripEmoji } from './parse.mjs';

/**
 * 퀴즈 답안 데이터 로더 (Task 11b).
 *
 * 답안 파일 하나 = 개념 하나. `_tools/ie-build/answers/<week>-<slug>.md`.
 *
 *   ---
 *   week: W01
 *   no: 5
 *   ---
 *
 *   ## Q1
 *   > (그 시점의 퀴즈 포인트 원문 스냅샷)
 *
 *   (자기 언어로 쓴 답안 — 마크다운)
 *
 *   ## Q2
 *   ...
 *
 * `>` 스냅샷은 "이 답안을 쓸 당시 질문이 이랬다"는 기록이다. 교수가 매주 소스 노트를
 * 고치므로, 빌드 시점에 실제 concept.quizPoints[i]와 (공백·이모지 정규화 후) 비교해
 * 일치할 때만 답안을 노출한다. 다르면 경고만 내고 그 문항은 답안 없음으로 남긴다 —
 * 틀린 질문 아래 답이 달리는 것보다 답이 없는 편이 낫다.
 */

export const ANSWERS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'answers'
);

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const Q_HEADING_RE = /^##\s+Q(\d+)\s*$/;
const BLOCKQUOTE_RE = /^>\s?(.*)$/;

/** 공백·이모지 차이를 무시하고 두 질문 텍스트를 비교한다. */
export function normalizeQuestion(s) {
  return stripEmoji(String(s ?? ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function slugFor(no) {
  return `c${String(no).padStart(2, '0')}`;
}

/** 답안 파일 하나를 파싱한다. frontmatter(week, no) + Q1, Q2, ... 블록. */
function parseAnswerFile(absPath, warnings) {
  const rel = path.basename(absPath);
  let raw;
  try {
    raw = fs.readFileSync(absPath, 'utf8');
  } catch (err) {
    warnings.add('answers', `${rel} 읽기 실패: ${err.message}`);
    return null;
  }

  const fm = FRONTMATTER.exec(raw);
  if (!fm) {
    warnings.add('answers', `${rel}: frontmatter가 없어 건너뜁니다`);
    return null;
  }

  let meta;
  try {
    meta = yaml.load(fm[1]) ?? {};
  } catch (err) {
    warnings.add('answers', `${rel}: frontmatter 파싱 실패 — ${err.message}`);
    return null;
  }

  const week = String(meta.week ?? '').trim();
  const no = Number(meta.no);
  if (!week || !Number.isInteger(no) || no < 1) {
    warnings.add('answers', `${rel}: week/no가 올바르지 않습니다 — week="${meta.week}", no="${meta.no}"`);
    return null;
  }

  const expectedBase = `${week}-${slugFor(no)}`;
  const actualBase = rel.replace(/\.md$/, '');
  if (actualBase !== expectedBase) {
    warnings.add(
      'answers',
      `${rel}: 파일명이 frontmatter(week=${week}, no=${no} → "${expectedBase}.md")와 다릅니다`
    );
  }

  const body = raw.slice(fm[0].length);
  const lines = body.split('\n');

  const blocks = [];
  let current = null;
  let collectingSnapshot = false;

  for (const line of lines) {
    const heading = Q_HEADING_RE.exec(line.trim());
    if (heading) {
      if (current) blocks.push(current);
      current = { n: Number(heading[1]), snapshotLines: [], mdLines: [] };
      collectingSnapshot = true;
      continue;
    }
    if (!current) continue;

    if (collectingSnapshot) {
      const t = line.trim();
      if (t === '') {
        if (current.snapshotLines.length > 0) collectingSnapshot = false;
        continue;
      }
      const bq = BLOCKQUOTE_RE.exec(t);
      if (bq) {
        current.snapshotLines.push(bq[1]);
        continue;
      }
      // "> "로 시작하지 않는 내용이 먼저 나오면 스냅샷이 없는 것으로 본다.
      collectingSnapshot = false;
    }
    current.mdLines.push(line);
  }
  if (current) blocks.push(current);

  if (blocks.length === 0) {
    warnings.add('answers', `${rel}: "## Q1" 형태의 문항 블록을 찾지 못했습니다`);
    return null;
  }

  const items = blocks.map((b) => ({
    n: b.n,
    snapshot: b.snapshotLines.join(' ').trim(),
    md: b.mdLines.join('\n').trim(),
  }));

  for (const item of items) {
    if (!item.snapshot) {
      warnings.add('answers', `${rel} Q${item.n}: "> " 질문 스냅샷이 없습니다 — 건너뜁니다`);
    }
    if (!item.md) {
      warnings.add('answers', `${rel} Q${item.n}: 답안 본문이 비어 있습니다 — 건너뜁니다`);
    }
  }

  return { rel, week, no, items: items.filter((it) => it.snapshot && it.md) };
}

/**
 * answers 디렉터리를 읽어 개념별·문항 인덱스별 답안 HTML을 만든다.
 * @returns {Map<string, Map<number, string>>} conceptId("W01/c05") → (0-based index → html)
 */
export function loadAnswers(dir, concepts, warnings) {
  const result = new Map();
  if (!fs.existsSync(dir)) return result;

  const conceptByKey = new Map(concepts.map((c) => [`${c.week}/${c.no}`, c]));

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  for (const f of files) {
    const parsed = parseAnswerFile(path.join(dir, f), warnings);
    if (!parsed) continue;

    const concept = conceptByKey.get(`${parsed.week}/${parsed.no}`);
    if (!concept) {
      warnings.add('answers', `${parsed.rel}: 개념 ${parsed.week}/${parsed.no}를 찾을 수 없습니다`);
      continue;
    }
    const conceptId = `${concept.week}/${concept.slug}`;

    for (const item of parsed.items) {
      const index = item.n - 1;
      const quizPoint = (concept.quizPoints ?? [])[index];
      if (!quizPoint) {
        warnings.add(
          'answers',
          `${parsed.rel} Q${item.n}: ${conceptId}에 인덱스 ${index}번 퀴즈 포인트가 없습니다 — 건너뜁니다`
        );
        continue;
      }

      if (normalizeQuestion(item.snapshot) !== normalizeQuestion(quizPoint.text)) {
        warnings.add(
          'answer-mismatch',
          `${parsed.rel} Q${item.n} (${conceptId}#${index}): 질문 스냅샷이 현재 퀴즈 포인트와 달라 답안을 숨겼습니다 — ` +
            `스냅샷="${item.snapshot}" / 현재="${quizPoint.text}"`
        );
        continue;
      }

      const html = renderMarkdown(item.md, {
        week: concept.week,
        slug: concept.slug,
        warnings,
        label: `${parsed.rel} Q${item.n}`,
      });

      if (!result.has(conceptId)) result.set(conceptId, new Map());
      result.get(conceptId).set(index, html);
    }
  }

  return result;
}
