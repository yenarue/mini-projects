import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const EXTS = ['.png', '.jpg', '.jpeg'];
const SIPS_TIMEOUT_MS = 30_000;

/** 원본 이미지를 assetDir → conceptDir/assets 순으로 찾는다.
 *  같은 week/name이 두 root에 모두 있으면 assetDir 쪽을 쓰고(우선순위 유지),
 *  warnings가 주어지면 어느 쪽을 썼는지 경고한다. */
export function resolveSourceImage(cfg, week, name, warnings) {
  const roots = [
    path.join(cfg.assetDir, week),
    path.join(cfg.conceptDir, 'assets', week),
  ];
  const matches = [];
  for (const root of roots) {
    for (const ext of EXTS) {
      const p = path.join(root, name + ext);
      if (fs.existsSync(p)) {
        matches.push(p);
        break; // root 하나당 한 번만 매치
      }
    }
  }

  if (matches.length === 0) return null;

  if (matches.length > 1 && warnings) {
    // 두 파일이 실제로 다른 물리적 위치인지 확인 (같은 디렉터리로 링크된 경우 제외)
    let areGenuinelyDifferent = false;
    try {
      const real0 = fs.realpathSync(matches[0]);
      const real1 = fs.realpathSync(matches[1]);
      areGenuinelyDifferent = real0 !== real1;
    } catch {
      // 경로 해석 실패 시 보수적으로 다르다고 간주하지 않음
      areGenuinelyDifferent = false;
    }

    if (areGenuinelyDifferent) {
      warnings.add(
        'images',
        `같은 이름의 이미지가 두 경로에 모두 있습니다: ${week}/${name} — ` +
        `${matches[0]} 을(를) 사용하고 ${matches[1]} 은(는) 무시합니다.`
      );
    }
  }

  return matches[0];
}

/** sips로 이미지의 픽셀 크기를 읽는다. 실패하면 null(호출부가 조용히 건너뛴다 —
 *  치수를 못 읽어도 빌드를 막을 이유는 없다, <img>에 width/height가 안 붙을 뿐). */
export function getImageDimensions(filePath) {
  try {
    const out = execFileSync(
      'sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath],
      { stdio: 'pipe', timeout: SIPS_TIMEOUT_MS }
    ).toString();
    const w = /pixelWidth:\s*(\d+)/.exec(out);
    const h = /pixelHeight:\s*(\d+)/.exec(out);
    if (w && h) return { width: Number(w[1]), height: Number(h[1]) };
  } catch {
    // sips 실패 — 호출부가 undefined로 처리
  }
  return null;
}

/** 파일이 존재하고 크기가 0보다 큰지 확인한다 (sips가 조용히 실패해도 잡아낸다). */
function isNonEmptyFile(p) {
  try {
    const st = fs.statSync(p);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

/** dir 아래 모든 파일을 재귀적으로 모은다. 심볼릭 링크는 절대 따라가지 않는다. */
function collectFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) out.push(...collectFiles(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/** imagesDir 아래에서 이제는 비어 있는 하위 디렉터리를 정리한다. */
function removeEmptyDirs(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const p = path.join(dir, e.name);
    removeEmptyDirs(p);
    try {
      if (fs.readdirSync(p).length === 0) fs.rmdirSync(p);
    } catch {
      // 비어있지 않거나 이미 사라졌으면 그냥 둔다.
    }
  }
}

/** imagesDir(반드시 outDir/images) 아래에서 이번 실행이 쓰지 않은 파일을 지운다.
 *  imagesDir 바깥은 절대 건드리지 않는다. */
function removeOrphans(imagesDir, writtenPaths) {
  if (!fs.existsSync(imagesDir)) return 0;
  let removed = 0;
  for (const p of collectFiles(imagesDir)) {
    if (!writtenPaths.has(p)) {
      fs.unlinkSync(p);
      removed += 1;
    }
  }
  removeEmptyDirs(imagesDir);
  return removed;
}

/**
 * 개념들이 실제로 참조하는 이미지만 골라 JPEG으로 변환해 outDir/images/ 에 넣는다.
 * sips가 실패하면(비정상 종료든, exit 0인데 출력 파일을 안 만들든) 원본을 그대로 복사한다.
 * 복사조차 실패하면 그 이미지는 경고 후 건너뛴다. 빌드는 절대 멈추지 않는다.
 * 마지막에 이번 실행이 쓰지 않은 output 파일(고아 이미지)을 outDir/images/ 안에서만 지운다.
 */
export function processImages(concepts, cfg, warnings) {
  const wanted = new Map(); // href -> { week, name, refs: [label] }

  for (const c of concepts) {
    for (const img of c.images ?? []) {
      const hit = wanted.get(img.href);
      if (hit) hit.refs.push(`${c.week}/${c.file}`);
      else wanted.set(img.href, { week: img.week, name: img.name, refs: [`${c.week}/${c.file}`] });
    }
  }

  let copied = 0;
  let totalSrcBytes = 0;
  let totalOutBytes = 0;
  const writtenPaths = new Set();
  const dimensions = new Map(); // href -> { width, height }

  for (const [href, { week, name, refs }] of wanted) {
    const src = resolveSourceImage(cfg, week, name, warnings);
    if (!src) {
      warnings.add('images', `원본을 찾을 수 없습니다: ${week}/${name} (참조: ${refs[0]})`);
      continue;
    }

    const dest = path.join(cfg.outDir, href);
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    let failMessage = null;
    try {
      execFileSync('sips', [
        '-s', 'format', 'jpeg',
        '-s', 'formatOptions', String(cfg.jpegQuality),
        src, '--out', dest,
      ], { stdio: 'pipe', timeout: SIPS_TIMEOUT_MS });
      if (!isNonEmptyFile(dest)) {
        failMessage = 'sips가 exit 0으로 끝났지만 출력 파일을 만들지 않았습니다';
      }
    } catch (err) {
      failMessage = err.message;
    }

    if (failMessage) {
      warnings.add('images', `sips 변환 실패, 원본 복사로 대체: ${week}/${name} — ${failMessage}`);
      try {
        fs.copyFileSync(src, dest);
      } catch (copyErr) {
        warnings.add('images', `원본 복사도 실패해 건너뜁니다: ${week}/${name} — ${copyErr.message}`);
        continue;
      }

      // 복사 후에도 출력 파일이 0바이트이거나 없으면 이미지를 사용할 수 없음
      if (!isNonEmptyFile(dest)) {
        try {
          fs.unlinkSync(dest);
        } catch {
          // 파일이 없거나 삭제 실패해도 계속 진행
        }
        warnings.add('images', `이미지를 생성할 수 없습니다(원본이 유효하지 않음): ${week}/${name} — ${src}`);
        continue;
      }
    }

    writtenPaths.add(dest);
    copied += 1;
    totalSrcBytes += fs.statSync(src).size;
    totalOutBytes += fs.statSync(dest).size;

    // 실제로 서빙되는 파일(dest) 기준으로 치수를 읽는다 — sips 포맷 변환은
    // 픽셀 크기를 바꾸지 않으므로 dest에서 읽어도 원본과 동일하다.
    const dims = getImageDimensions(dest);
    if (dims) dimensions.set(href, dims);
  }

  const imagesDir = path.join(cfg.outDir, 'images');
  const orphansRemoved = removeOrphans(imagesDir, writtenPaths);

  return { copied, totalSrcBytes, totalOutBytes, orphansRemoved, dimensions };
}

/**
 * 렌더링이 끝난 concept.sections[].html 안의 <img src="..."> 태그에
 * width/height를 채워 넣는다(레이아웃 시프트 방지 — 브라우저가 이미지가
 * 도착하기 전에 올바른 박스를 예약할 수 있게). CSS(max-width:100%; height:auto)가
 * 반응형 크기 조정을 그대로 담당하고, width/height 속성은 종횡비만 알려준다.
 * dimensions에 없는 href(치수를 못 읽은 이미지)는 건드리지 않고 조용히 넘어간다.
 * @param {object[]} concepts renderConcept()으로 sections[].html이 채워진 개념들
 * @param {Map<string, {width:number,height:number}>} dimensions processImages()의 반환값
 */
export function applyImageDimensions(concepts, dimensions) {
  if (!dimensions || dimensions.size === 0) return;

  for (const c of concepts) {
    const hrefs = new Set((c.images ?? []).map((img) => img.href));
    if (hrefs.size === 0) continue;

    for (const section of c.sections ?? []) {
      if (!section.html || !section.html.includes('<img ')) continue;
      let html = section.html;
      for (const href of hrefs) {
        const dims = dimensions.get(href);
        if (!dims) continue;
        const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(<img src="${escapedHref}"(?![^>]*\\swidth=)[^>]*?)(\\s*/?>)`, 'g');
        html = html.replace(re, (_m, pre, close) => `${pre} width="${dims.width}" height="${dims.height}"${close}`);
      }
      section.html = html;
    }
  }
}

export function formatBytes(n) {
  return `${(n / 1e6).toFixed(1)}MB`;
}
