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

/** sips가 "not a valid file"로 조용히 실패하는(exit 0, 출력 없음) 상황을 재현하는 0바이트 픽스처 */
function makeZeroBytePng(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.alloc(0));
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

// --- Finding 1/2: sips가 exit 0인데 출력 파일을 만들지 않는 경우 ---

test('sips가 exit 0으로 조용히 실패해도(0바이트 원본) 던지지 않고 경고 후 원본 복사로 대체한다', () => {
  const cfg = fixture();
  makeZeroBytePng(path.join(cfg.assetDir, 'W01', 'broken.png'));
  const concepts = [
    {
      week: 'W01',
      file: 'a.md',
      images: [{ href: 'images/W01/broken.jpg', week: 'W01', name: 'broken' }],
    },
  ];
  const w = new Warnings();

  const stats = processImages(concepts, cfg, w); // 던지면 이 테스트 자체가 실패한다

  assert.equal(w.count, 1);
  assert.match(w.items[0].message, /broken/);
  assert.equal(stats.copied, 1); // 원본 복사로 대체되어 1개로 집계된다
  assert.ok(fs.existsSync(path.join(cfg.outDir, 'images', 'W01', 'broken.jpg')));
});

test('한 이미지의 변환이 실패해도 같은 호출의 다른 정상 이미지는 계속 변환·카운트된다', () => {
  const cfg = fixture();
  makeZeroBytePng(path.join(cfg.assetDir, 'W01', 'broken.png'));
  const concepts = [
    {
      week: 'W01',
      file: 'a.md',
      images: [
        { href: 'images/W01/broken.jpg', week: 'W01', name: 'broken' },
        { href: 'images/W01/p10.jpg', week: 'W01', name: 'p10' },
      ],
    },
  ];
  const w = new Warnings();
  const stats = processImages(concepts, cfg, w);

  assert.equal(stats.copied, 2); // broken(복사 대체) + p10(정상 변환)
  const out = path.join(cfg.outDir, 'images', 'W01', 'p10.jpg');
  assert.ok(fs.existsSync(out));
  const type = execFileSync('sips', ['-g', 'format', out]).toString();
  assert.match(type, /jpeg/); // p10은 진짜로 jpeg 변환됐다
  assert.equal(w.count, 1);
  assert.match(w.items[0].message, /broken/);
});

// --- Finding 3: 같은 week/name이 두 root에 모두 있을 때 ---

test('같은 week/name이 두 root에 모두 있으면 경고하고 assetDir 쪽을 쓴다', () => {
  const cfg = fixture();
  // fixture()가 assetDir/W01/p10.png 를 이미 만든다. conceptDir/assets/W01에도 같은 이름을 심는다.
  makePng(path.join(cfg.conceptDir, 'assets', 'W01', 'p10.png'));

  const w = new Warnings();
  const src = resolveSourceImage(cfg, 'W01', 'p10', w);
  assert.ok(src.startsWith(cfg.assetDir), 'assetDir 쪽이 우선되어야 한다');
  assert.equal(w.count, 1);
  assert.match(w.items[0].message, /p10/);
  assert.match(w.items[0].message, new RegExp(cfg.assetDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(w.items[0].message, /개념정리/);

  const concepts = [
    { week: 'W01', file: 'a.md', images: [{ href: 'images/W01/p10.jpg', week: 'W01', name: 'p10' }] },
  ];
  const w2 = new Warnings();
  const stats = processImages(concepts, cfg, w2);
  assert.equal(stats.copied, 1);
  assert.ok(w2.items.some((i) => /두 경로에 모두 있습니다/.test(i.message)));
});

// --- Finding 4: 고아 이미지 삭제 ---

test('outDir/images/ 아래 참조되지 않는 output 파일은 이번 실행에서 삭제되고 개수가 집계된다', () => {
  const cfg = fixture();
  const staleDir = path.join(cfg.outDir, 'images', 'W01');
  fs.mkdirSync(staleDir, { recursive: true });
  fs.writeFileSync(path.join(staleDir, 'stale.jpg'), 'stale-content');

  const concepts = [
    { week: 'W01', file: 'a.md', images: [{ href: 'images/W01/p10.jpg', week: 'W01', name: 'p10' }] },
  ];
  const stats = processImages(concepts, cfg, new Warnings());

  assert.equal(stats.orphansRemoved, 1);
  assert.ok(!fs.existsSync(path.join(staleDir, 'stale.jpg')), '참조되지 않는 파일은 삭제되어야 한다');
  assert.ok(fs.existsSync(path.join(cfg.outDir, 'images', 'W01', 'p10.jpg')), '참조되는 파일은 살아남아야 한다');
});
