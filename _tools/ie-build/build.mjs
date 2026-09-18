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
    `(${formatBytes(imgStats.totalSrcBytes)} → ${formatBytes(imgStats.totalOutBytes)})`
  );

  if (args.has('--dump-json')) {
    console.log(JSON.stringify(concepts, null, 2));
    warnings.print();
    return;
  }

  console.log(`개념 ${concepts.length}개를 읽었습니다.`);
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
