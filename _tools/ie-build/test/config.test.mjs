import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../lib/config.mjs';

test('상대 outDir을 설정 파일 기준 절대경로로 바꾼다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ie-cfg-'));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
    conceptDir: dir, assetDir: dir, outDir: './out', baseHref: '/x/', jpegQuality: 82,
  }));
  const cfg = loadConfig(dir);
  assert.equal(cfg.outDir, path.join(dir, 'out'));
  assert.equal(path.isAbsolute(cfg.conceptDir), true);
});

test('conceptDir이 없으면 경로를 포함한 에러를 던진다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ie-cfg-'));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
    conceptDir: '/definitely/not/here', assetDir: dir, outDir: './out',
    baseHref: '/x/', jpegQuality: 82,
  }));
  assert.throws(() => loadConfig(dir), /conceptDir.*\/definitely\/not\/here/s);
});

test('jpegQuality 기본값은 82다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ie-cfg-'));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
    conceptDir: dir, assetDir: dir, outDir: './out', baseHref: '/x/',
  }));
  assert.equal(loadConfig(dir).jpegQuality, 82);
});
