#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig } from './lib/config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** 빌드 전역에서 공유하는 경고 수집기 */
export class Warnings {
  constructor() { this.items = []; }
  add(scope, message) { this.items.push({ scope, message }); }
  get count() { return this.items.length; }
  print() {
    if (this.items.length === 0) return;
    console.warn(`\n경고 ${this.items.length}건:`);
    for (const { scope, message } of this.items) {
      console.warn(`  [${scope}] ${message}`);
    }
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const cfg = loadConfig(HERE);

  if (args.has('--print-config')) {
    console.log(JSON.stringify(cfg, null, 2));
    return;
  }

  const warnings = new Warnings();
  const { collectConcepts } = await import('./lib/parse.mjs');
  const concepts = collectConcepts(cfg.conceptDir, warnings);

  const { renderConcept } = await import('./lib/render.mjs');
  for (const c of concepts) renderConcept(c, warnings);

  const { processImages, formatBytes } = await import('./lib/images.mjs');
  const imgStats = processImages(concepts, cfg, warnings);
  console.log(
    `이미지 ${imgStats.copied}개 ` +
    `(${formatBytes(imgStats.totalSrcBytes)} → ${formatBytes(imgStats.totalOutBytes)}), ` +
    `고아 이미지 ${imgStats.orphansRemoved}개 삭제`
  );

  if (args.has('--dump-json')) {
    console.log(JSON.stringify(concepts, null, 2));
    warnings.print();
    return;
  }

  console.log(`개념 ${concepts.length}개를 읽었습니다.`);

  const fsp = await import('node:fs');
  const { parseRelatedRef, conceptHref } = await import('./lib/links.mjs');
  const { renderWeekPage } = await import('./templates/week.mjs');

  const weeks = JSON.parse(fsp.readFileSync(path.join(HERE, 'weeks.json'), 'utf8'));
  const byId = new Map(weeks.map((w) => [w.id, { ...w, concepts: [] }]));
  const conceptIndex = new Map(concepts.map((c) => [`${c.week}/${c.no}`, c]));

  for (const c of concepts) {
    // related를 해석 가능한 링크로 바꾼다
    c.related = (c.relatedRaw ?? []).map((raw) => {
      const ref = parseRelatedRef(raw);
      if (!ref) {
        warnings.add('related', `${c.week}/${c.file}: related "${raw}" 해석 실패`);
        return null;
      }
      const target = conceptIndex.get(`${ref.week}/${ref.no}`);
      if (!target) {
        warnings.add('related', `${c.week}/${c.file}: related "${raw}" 대상 개념이 아직 없습니다`);
      }
      return { week: ref.week, no: ref.no, href: conceptHref(ref.week, ref.no), title: target?.title ?? '' };
    }).filter(Boolean);

    const w = byId.get(c.week);
    if (!w) {
      warnings.add('weeks', `${c.week}가 weeks.json에 없습니다 — 페이지가 생성되지 않습니다`);
      continue;
    }
    w.concepts.push(c);
  }

  const orderedWeeks = weeks.map((w) => byId.get(w.id));

  // 정적 에셋 복사
  fsp.cpSync(path.join(HERE, 'assets'), cfg.outDir, { recursive: true });

  let pages = 0;
  for (const week of orderedWeeks) {
    if (!week.concepts.length) continue;
    fsp.writeFileSync(
      path.join(cfg.outDir, `${week.id}.html`),
      renderWeekPage({ week, weeks: orderedWeeks }),
      'utf8'
    );
    pages += 1;
  }
  console.log(`주차 페이지 ${pages}개 생성`);

  warnings.print();
}

// CLI로 직접 실행할 때만 빌드한다.
// 이후 Task들의 테스트가 `import { Warnings } from '../build.mjs'`를 하므로,
// 가드가 없으면 클래스 하나 가져오려다 loadConfig와 실제 파일 I/O가 돌아간다.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`\n빌드 실패: ${err.message}`);
    process.exit(1);
  });
}
