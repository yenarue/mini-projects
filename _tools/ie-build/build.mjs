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
  const startedAt = Date.now();
  const args = new Set(process.argv.slice(2));
  const cfg = loadConfig(HERE);

  if (args.has('--print-config')) {
    console.log(JSON.stringify(cfg, null, 2));
    return;
  }

  const warnings = new Warnings();
  const { collectConcepts } = await import('./lib/parse.mjs');
  const concepts = collectConcepts(cfg.conceptDir, warnings);

  // 존재하는 개념 키 집합("W01/5" 형태) — 본문 마크다운 링크가 아직 쓰이지 않은
  // 개념을 가리키면 renderConcept이 <a>가 아니라 평문으로 남기도록 전달한다.
  // (아래 related 필드 해석과 별개로, 본문에 직접 쓴 [텍스트](../W02-2/05-*.md)
  // 링크도 같은 문제를 일으킨다 — 존재하지 않는 앵커로 링크가 걸리면 안 된다.)
  const existingKeys = new Set(concepts.map((c) => `${c.week}/${c.no}`));

  const { renderConcept } = await import('./lib/render.mjs');
  for (const c of concepts) renderConcept(c, warnings, existingKeys);

  // 시험 중요도(별점)와 쪽지시험 핵심 개념 세트. 개념 객체에 importance·coreRefs를
  // 직접 붙이므로, 뒤따르는 템플릿은 모두 그 값을 그대로 읽어 쓴다.
  const { buildFocus } = await import('./lib/focus.mjs');
  const { coreSets } = buildFocus({
    toolDir: HERE, conceptDir: cfg.conceptDir, concepts, warnings,
  });

  const { processImages, formatBytes, applyImageDimensions } = await import('./lib/images.mjs');
  const imgStats = processImages(concepts, cfg, warnings);
  console.log(
    `이미지 ${imgStats.copied}개 ` +
    `(${formatBytes(imgStats.totalSrcBytes)} → ${formatBytes(imgStats.totalOutBytes)}), ` +
    `고아 이미지 ${imgStats.orphansRemoved}개 삭제`
  );

  // 레이아웃 시프트 방지: 렌더링이 끝난 <img>에 실제 픽셀 치수를 width/height로 채운다.
  applyImageDimensions(concepts, imgStats.dimensions);

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
      return {
        week: ref.week,
        no: ref.no,
        href: conceptHref(ref.week, ref.no),
        title: target?.title ?? '',
        resolved: !!target,
      };
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

  // assets/js/quiz.js(소스)는 assets/js/quiz-logic.mjs를 import하는 ES 모듈이다
  // — Node 테스트가 두 파일을 그대로 import해서 정렬·필터 로직을 검증하기
  // 위해서다. 하지만 file://로 여는 배포 페이지는 origin이 null이라 브라우저가
  // ES 모듈 import를 CORS로 막아 스크립트가 전혀 안 돈다(Task 14 회귀). 그래서
  // 위에서 그대로 복사된 js/quiz.js를, 두 소스를 합친 classic script로
  // 덮어쓴다. js/quiz-logic.mjs는 이제 배포본에서 쓰이지 않으므로 지운다 —
  // 남겨두면 아무도 안 부르는 죽은 파일이 사이트에 딸려 나간다.
  const { buildQuizScript } = await import('./lib/quizscript.mjs');
  fsp.writeFileSync(path.join(cfg.outDir, 'js', 'quiz.js'), buildQuizScript(HERE), 'utf8');
  fsp.rmSync(path.join(cfg.outDir, 'js', 'quiz-logic.mjs'), { force: true });

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

  const { renderIndexPage } = await import('./templates/index.mjs');
  const quizSchedule = JSON.parse(fsp.readFileSync(path.join(HERE, 'quiz-schedule.json'), 'utf8'));
  const builtAt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });

  fsp.writeFileSync(
    path.join(cfg.outDir, 'index.html'),
    renderIndexPage({ weeks: orderedWeeks, quizSchedule, coreSets, builtAt }),
    'utf8'
  );
  console.log('index.html 생성');

  const { renderCorePage } = await import('./templates/core.mjs');
  fsp.writeFileSync(
    path.join(cfg.outDir, 'core.html'),
    renderCorePage({ coreSets, quizSchedule }),
    'utf8'
  );
  console.log(
    `core.html 생성 (세트 ${coreSets.length}개 · 항목 ${coreSets.reduce((n, s) => n + s.items.length, 0)}개)`
  );

  const { buildSearchIndex, estimateSize, trimIfLarge } = await import('./lib/searchindex.mjs');
  let searchIndex = buildSearchIndex(concepts, orderedWeeks);
  const trimResult = trimIfLarge(searchIndex);
  searchIndex = trimResult.index;
  if (trimResult.trimmed) {
    warnings.add('search', '인덱스가 1.5MB를 넘어 본문을 3000자로 잘랐습니다');
  }
  fsp.writeFileSync(
    path.join(cfg.outDir, 'search-index.json'),
    JSON.stringify(searchIndex),
    'utf8'
  );
  console.log(`검색 인덱스 ${searchIndex.docs.length}건 (${(estimateSize(searchIndex) / 1024).toFixed(0)}KB)`);

  const { buildQuizData, renderQuizPage } = await import('./templates/quiz.mjs');
  const mismatchesBefore = warnings.items.filter((w) => w.scope === 'answer-mismatch').length;
  const { items: quizItems, answers: quizAnswers } = buildQuizData(concepts, { warnings });
  const mismatchCount = warnings.items.filter((w) => w.scope === 'answer-mismatch').length - mismatchesBefore;
  const answeredItems = quizItems.filter(
    (it) => quizAnswers[it.conceptId] && quizAnswers[it.conceptId].byIndex[it.index] !== undefined
  ).length;

  fsp.writeFileSync(
    path.join(cfg.outDir, 'quiz.html'),
    renderQuizPage({ items: quizItems, answers: quizAnswers, weeks: orderedWeeks, quizSchedule }),
    'utf8'
  );
  const quizBytes = fsp.statSync(path.join(cfg.outDir, 'quiz.html')).size;
  const quizKb = quizBytes / 1024;
  console.log(
    `quiz.html 생성 (문항 ${quizItems.length}개 · 답안 있는 문항 ${answeredItems}개 · ` +
      `질문 스냅샷 불일치 ${mismatchCount}건 · ${quizKb.toFixed(0)}KB)`
  );
  if (quizKb > 1500) {
    warnings.add('quiz', `quiz.html이 ${quizKb.toFixed(0)}KB입니다. 답안을 별도 JSON으로 분리하는 것을 검토하세요`);
  }

  const yaml = (await import('js-yaml')).default;
  const { buildGraph, renderMapPage } = await import('./templates/map.mjs');

  let comparisons = [];
  const cmpFile = path.join(HERE, 'comparisons.yml');
  if (fsp.existsSync(cmpFile)) {
    try {
      comparisons = yaml.load(fsp.readFileSync(cmpFile, 'utf8')) ?? [];
    } catch (err) {
      warnings.add('map', `comparisons.yml 파싱 실패: ${err.message}`);
    }
  }

  const graph = buildGraph(concepts);
  fsp.writeFileSync(
    path.join(cfg.outDir, 'map.html'),
    renderMapPage({ graph, weeks: orderedWeeks, comparisons }),
    'utf8'
  );
  const crossEdges = graph.edges.filter((e) => e.crossWeek).length;
  console.log(
    `map.html 생성 (노드 ${graph.nodes.length} · 엣지 ${graph.edges.length} · ` +
      `주차 간 ${crossEdges} · 비교표 ${comparisons.length})`
  );

  // file://에서 완전히 죽어버리는 <script type="module"> 회귀를 매 빌드에서
  // 잡는다(--check와 무관하게) — 소유자는 항상 디스크에서 사이트를 여니까,
  // 이 실수는 링크 검사 대상이 아니라 빌드 자체를 실패시켜야 하는 종류다.
  const { assertNoModuleScripts } = await import('./lib/check.mjs');
  assertNoModuleScripts(cfg.outDir);

  if (args.has('--check')) {
    const { checkLinks } = await import('./lib/check.mjs');
    const result = checkLinks(cfg.outDir);
    console.log(`\n내부 링크 ${result.checked}건 검사`);
    if (result.broken.length) {
      console.log(`깨진 링크 ${result.broken.length}건:`);
      for (const b of result.broken) {
        console.log(`  ${b.from} → ${b.href}  (${b.reason})`);
      }
    } else {
      console.log('깨진 링크 없음');
    }
  }

  const coreItemCount = coreSets.reduce((n, s) => n + s.items.length, 0);
  const searchKb = (estimateSize(searchIndex) / 1024).toFixed(0);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(
    `\n요약: 개념 ${concepts.length}개 · 주차 ${pages}개 · ` +
    `이미지 ${imgStats.copied}개 (${formatBytes(imgStats.totalSrcBytes)} → ${formatBytes(imgStats.totalOutBytes)}) · ` +
    `고아 이미지 ${imgStats.orphansRemoved}개 삭제 · ` +
    `퀴즈 ${quizItems.length}문항 (답안 ${answeredItems}개) · ` +
    `지도 노드 ${graph.nodes.length}·엣지 ${graph.edges.length} · ` +
    `핵심개념 ${coreItemCount}개 · 검색 인덱스 ${searchKb}KB · ` +
    `경고 ${warnings.count}건 · ${elapsed}초`
  );
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
