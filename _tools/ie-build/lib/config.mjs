import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_DIRS = ['conceptDir', 'assetDir'];

/**
 * config.json을 읽어 경로를 절대경로로 resolve한다.
 * @param {string} dir config.json이 있는 디렉터리
 */
export function loadConfig(dir) {
  const file = path.join(dir, 'config.json');
  if (!fs.existsSync(file)) {
    throw new Error(`설정 파일이 없습니다: ${file}`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));

  const cfg = {
    conceptDir: path.resolve(dir, raw.conceptDir),
    assetDir: path.resolve(dir, raw.assetDir),
    outDir: path.resolve(dir, raw.outDir),
    baseHref: raw.baseHref ?? '/',
    jpegQuality: raw.jpegQuality ?? 82,
  };

  for (const key of REQUIRED_DIRS) {
    if (!fs.existsSync(cfg[key])) {
      throw new Error(
        `${key} 경로를 찾을 수 없습니다: ${cfg[key]}\n` +
        `config.json의 ${key}를 확인하세요. Google Drive 동기화가 진행 중일 수 있습니다.`
      );
    }
  }

  const outParent = path.dirname(cfg.outDir);
  if (!fs.existsSync(outParent)) {
    throw new Error(`outDir의 상위 디렉터리가 없습니다: ${outParent}`);
  }
  fs.mkdirSync(cfg.outDir, { recursive: true });

  return cfg;
}
