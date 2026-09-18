import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveSourceImage, processImages } from '../lib/images.mjs';
import { Warnings } from '../build.mjs';

/** sips로 1x1 테스트 PNG를 만든다 (외부 픽스처 없이 결정적으로) */
function makePng(file) {
  const b64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ie-img-'));
  const cfg = {
    assetDir: path.join(root, 'assets'),
    conceptDir: path.join(root, '개념정리'),
    outDir: path.join(root, 'out'),
    jpegQuality: 82,
  };
  makePng(path.join(cfg.assetDir, 'W01', 'p10.png'));
  makePng(path.join(cfg.conceptDir, 'assets', 'W01', '자체그림.png'));
  fs.mkdirSync(cfg.outDir, { recursive: true });
  return cfg;
}

test('assetDir의 슬라이드를 찾는다', () => {
  const cfg = fixture();
  assert.ok(resolveSourceImage(cfg, 'W01', 'p10').endsWith('assets/W01/p10.png'));
});

test('개념정리/assets의 자체 제작 그림도 찾는다', () => {
  const cfg = fixture();
  assert.ok(resolveSourceImage(cfg, 'W01', '자체그림').includes('개념정리'));
});

test('없는 이미지는 null', () => {
  const cfg = fixture();
  assert.equal(resolveSourceImage(cfg, 'W01', '없음'), null);
});

test('참조된 이미지만 JPEG으로 변환해 복사한다', () => {
  const cfg = fixture();
  const concepts = [
    { week: 'W01', file: 'a.md', images: [{ href: 'images/W01/p10.jpg', week: 'W01', name: 'p10' }] },
  ];
  const w = new Warnings();
  const stats = processImages(concepts, cfg, w);

  assert.equal(stats.copied, 1);
  const out = path.join(cfg.outDir, 'images', 'W01', 'p10.jpg');
  assert.ok(fs.existsSync(out));
  const type = execFileSync('sips', ['-g', 'format', out]).toString();
  assert.match(type, /jpeg/);
  // 참조되지 않은 자체그림은 복사되지 않는다
  assert.ok(!fs.existsSync(path.join(cfg.outDir, 'images', 'W01', '자체그림.jpg')));
  assert.equal(w.count, 0);
});

test('원본이 없으면 경고하고 계속 진행한다', () => {
  const cfg = fixture();
  const concepts = [
    { week: 'W01', file: 'a.md', images: [{ href: 'images/W01/없음.jpg', week: 'W01', name: '없음' }] },
  ];
  const w = new Warnings();
  const stats = processImages(concepts, cfg, w);
  assert.equal(stats.copied, 0);
  assert.equal(w.count, 1);
  assert.match(w.items[0].message, /없음/);
});

test('같은 이미지를 두 개념이 참조해도 한 번만 변환한다', () => {
  const cfg = fixture();
  const img = { href: 'images/W01/p10.jpg', week: 'W01', name: 'p10' };
  const concepts = [
    { week: 'W01', file: 'a.md', images: [img] },
    { week: 'W01', file: 'b.md', images: [img] },
  ];
  const stats = processImages(concepts, cfg, new Warnings());
  assert.equal(stats.copied, 1);
});
