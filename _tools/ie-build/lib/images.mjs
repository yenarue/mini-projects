import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const EXTS = ['.png', '.jpg', '.jpeg'];

/** 원본 이미지를 assetDir → conceptDir/assets 순으로 찾는다. */
export function resolveSourceImage(cfg, week, name) {
  const roots = [
    path.join(cfg.assetDir, week),
    path.join(cfg.conceptDir, 'assets', week),
  ];
  for (const root of roots) {
    for (const ext of EXTS) {
      const p = path.join(root, name + ext);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/**
 * 개념들이 실제로 참조하는 이미지만 골라 JPEG으로 변환해 outDir/images/ 에 넣는다.
 * sips가 실패하면 원본을 그대로 복사한다.
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

  for (const [href, { week, name, refs }] of wanted) {
    const src = resolveSourceImage(cfg, week, name);
    if (!src) {
      warnings.add('images', `원본을 찾을 수 없습니다: ${week}/${name} (참조: ${refs[0]})`);
      continue;
    }

    const dest = path.join(cfg.outDir, href);
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    try {
      execFileSync('sips', [
        '-s', 'format', 'jpeg',
        '-s', 'formatOptions', String(cfg.jpegQuality),
        src, '--out', dest,
      ], { stdio: 'pipe' });
    } catch (err) {
      warnings.add('images', `sips 변환 실패, 원본 복사로 대체: ${week}/${name} — ${err.message}`);
      fs.copyFileSync(src, dest);
    }

    copied += 1;
    totalSrcBytes += fs.statSync(src).size;
    totalOutBytes += fs.statSync(dest).size;
  }

  return { copied, totalSrcBytes, totalOutBytes };
}

export function formatBytes(n) {
  return `${(n / 1e6).toFixed(1)}MB`;
}
