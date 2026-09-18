import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveSourceImage, processImages, getImageDimensions, applyImageDimensions } from '../lib/images.mjs';
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

test('sips가 exit 0으로 조용히 실패하고 원본도 0바이트면 출력 파일을 삭제하고 경고한다', () => {
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

  const stats = processImages(concepts, cfg, w);

  // sips 실패 경고 + 이미지 생성 실패 경고 = 2개
  assert.equal(w.count, 2);
  assert.match(w.items[0].message, /sips 변환 실패/);
  assert.match(w.items[1].message, /이미지를 생성할 수 없습니다/);
  assert.equal(stats.copied, 0); // 0바이트 원본은 복사되지 않음
  assert.ok(!fs.existsSync(path.join(cfg.outDir, 'images', 'W01', 'broken.jpg')), '0바이트 출력은 삭제되어야 한다');
});

test('0바이트 원본이 실패해도 같은 호출의 다른 정상 이미지는 계속 변환·카운트된다', () => {
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

  assert.equal(stats.copied, 1); // p10만(정상 변환), broken은 제외
  const out = path.join(cfg.outDir, 'images', 'W01', 'p10.jpg');
  assert.ok(fs.existsSync(out));
  const type = execFileSync('sips', ['-g', 'format', out]).toString();
  assert.match(type, /jpeg/); // p10은 진짜로 jpeg 변환됐다
  assert.ok(!fs.existsSync(path.join(cfg.outDir, 'images', 'W01', 'broken.jpg')), 'broken은 존재하지 않아야 한다');
  assert.equal(w.count, 2); // sips 실패 + 생성 실패
  assert.match(w.items[0].message, /sips 변환 실패/);
  assert.match(w.items[1].message, /이미지를 생성할 수 없습니다/);
});

// --- Finding 3: 같은 week/name이 두 root에 모두 있을 때 ---

test('같은 week/name이 서로 다른 두 root에 있으면 경고하고 assetDir 쪽을 쓴다', () => {
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

test('conceptDir/assets와 assetDir이 같은 디렉터리를 가리키면 dual-root 경고를 발생시키지 않는다', () => {
  const cfg = fixture();
  // conceptDir/assets가 assetDir과 같은 물리적 위치를 가리키도록 설정
  // conceptDir을 assetDir의 부모로, assets를 assetDir의 이름으로 만든다
  const parentDir = path.dirname(cfg.assetDir);
  cfg.conceptDir = parentDir;
  // 이제 conceptDir/assets = parentDir/assets = cfg.assetDir

  makePng(path.join(cfg.assetDir, 'W01', 'p10.png'));

  const w = new Warnings();
  const src = resolveSourceImage(cfg, 'W01', 'p10', w);
  assert.ok(src.endsWith('p10.png'));
  assert.equal(w.count, 0, '같은 물리적 위치는 dual-root 경고를 발생시키지 않아야 한다');
});

// --- Finding 4: 고아 이미지 삭제 ---

// --- Task 10: 레이아웃 시프트 방지 — <img>에 width/height 채우기 ---

test('getImageDimensions는 sips로 픽셀 크기를 읽는다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ie-dim-'));
  const file = path.join(root, 'p.png');
  makePng(file); // 1x1 PNG
  const dims = getImageDimensions(file);
  assert.deepEqual(dims, { width: 1, height: 1 });
});

test('getImageDimensions는 읽을 수 없는 파일에 대해 null을 돌려준다', () => {
  const dims = getImageDimensions('/no/such/file.png');
  assert.equal(dims, null);
});

test('processImages는 변환된 이미지의 실제 픽셀 치수를 href별로 돌려준다', () => {
  const cfg = fixture();
  const concepts = [
    { week: 'W01', file: 'a.md', images: [{ href: 'images/W01/p10.jpg', week: 'W01', name: 'p10' }] },
  ];
  const stats = processImages(concepts, cfg, new Warnings());
  assert.deepEqual(stats.dimensions.get('images/W01/p10.jpg'), { width: 1, height: 1 });
});

test('applyImageDimensions는 concept.sections의 <img>에 width/height를 채운다', () => {
  const concepts = [
    {
      week: 'W01',
      images: [{ href: 'images/W01/p10.jpg' }],
      sections: [
        { key: 'core', html: '<figure class="slide"><img src="images/W01/p10.jpg" alt="x" loading="lazy" decoding="async"></figure>' },
      ],
    },
  ];
  const dimensions = new Map([['images/W01/p10.jpg', { width: 1400, height: 788 }]]);
  applyImageDimensions(concepts, dimensions);
  assert.match(concepts[0].sections[0].html, /<img src="images\/W01\/p10\.jpg"[^>]*width="1400" height="788"/);
});

test('applyImageDimensions는 치수를 모르는 이미지는 건드리지 않는다', () => {
  const concepts = [
    {
      week: 'W01',
      images: [{ href: 'images/W01/모름.jpg' }],
      sections: [
        { key: 'core', html: '<figure class="slide"><img src="images/W01/모름.jpg" alt="x" loading="lazy" decoding="async"></figure>' },
      ],
    },
  ];
  applyImageDimensions(concepts, new Map());
  assert.equal(
    concepts[0].sections[0].html,
    '<figure class="slide"><img src="images/W01/모름.jpg" alt="x" loading="lazy" decoding="async"></figure>'
  );
});

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
