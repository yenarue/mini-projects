import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkLinks } from '../lib/check.mjs';

function site(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ie-check-'));
  for (const [name, html] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), html);
  }
  return dir;
}

test('정상 링크는 broken에 없다', () => {
  const dir = site({
    'a.html': '<a href="b.html#c05">x</a>',
    'b.html': '<section id="c05"></section>',
  });
  const r = checkLinks(dir);
  assert.equal(r.broken.length, 0);
  assert.equal(r.checked, 1);
});

test('없는 파일을 가리키면 broken', () => {
  const dir = site({ 'a.html': '<a href="zz.html">x</a>' });
  const r = checkLinks(dir);
  assert.equal(r.broken.length, 1);
  assert.match(r.broken[0].reason, /파일/);
});

test('없는 앵커를 가리키면 broken', () => {
  const dir = site({
    'a.html': '<a href="b.html#c99">x</a>',
    'b.html': '<section id="c05"></section>',
  });
  const r = checkLinks(dir);
  assert.equal(r.broken.length, 1);
  assert.match(r.broken[0].reason, /앵커/);
});

test('외부 링크와 mailto는 건너뛴다', () => {
  const dir = site({
    'a.html': '<a href="https://x.com">x</a><a href="mailto:a@b.c">y</a>',
  });
  const r = checkLinks(dir);
  assert.equal(r.checked, 0);
  assert.equal(r.broken.length, 0);
});

test('같은 페이지 앵커도 검사한다', () => {
  const dir = site({ 'a.html': '<a href="#top">x</a>' });
  const r = checkLinks(dir);
  assert.equal(r.broken.length, 1);
  assert.match(r.broken[0].reason, /앵커/);
});

test('이미지 src도 검사한다', () => {
  const dir = site({ 'a.html': '<img src="images/W01/p10.jpg">' });
  const r = checkLinks(dir);
  assert.equal(r.broken.length, 1);
});

test('script src와 link href도 검사한다', () => {
  const dir = site({
    'a.html': '<script src="js/main.js"></script><link rel="stylesheet" href="styles.css">',
  });
  const r = checkLinks(dir);
  assert.equal(r.checked, 2);
  assert.equal(r.broken.length, 2);
});

test('쿼리 스트링이 붙은 href는 파일명만으로 존재를 확인한다', () => {
  const dir = site({
    'a.html': '<a href="quiz.html?week=W01&amp;c=c01">x</a>',
    'quiz.html': '<p>퀴즈</p>',
  });
  const r = checkLinks(dir);
  assert.equal(r.broken.length, 0);
  assert.equal(r.checked, 1);
});

test('JSON 데이터 블록의 id/href 키는 라이브 DOM id로 취급하지 않는다', () => {
  // "id":"a/b" 같은 JSON 키-값이 페이지의 실제 id 집합에 흘러 들어가면 안 되고,
  // 반대로 페이지 안의 실제 <a href="#real">도 JSON 텍스트 때문에 오탐이 나면 안 된다.
  const dir = site({
    'a.html':
      '<a href="#real">x</a><section id="real"></section>' +
      '<script type="application/json" id="d">{"id":"fake/anchor","items":[{"href":"#real"}]}</script>',
  });
  const r = checkLinks(dir);
  assert.equal(r.broken.length, 0);
});

test('JSON 데이터 안의 href가 존재하지 않는 파일을 가리키면 broken', () => {
  const dir = site({
    'a.html': '<script type="application/json" id="d">{"items":[{"href":"zz.html#c05"}]}</script>',
  });
  const r = checkLinks(dir);
  assert.equal(r.broken.length, 1);
  assert.match(r.broken[0].reason, /파일/);
  assert.match(r.broken[0].from, /JSON/);
});

test('JSON 데이터 안의 href가 존재하지 않는 앵커를 가리키면 broken', () => {
  const dir = site({
    'a.html': '<script type="application/json" id="d">{"items":[{"href":"b.html#c99"}]}</script>',
    'b.html': '<section id="c05"></section>',
  });
  const r = checkLinks(dir);
  assert.equal(r.broken.length, 1);
  assert.match(r.broken[0].reason, /앵커/);
});

test('JSON 데이터 안의 순수 프래그먼트("#top")는 런타임 DOM이라 검사하지 않는다', () => {
  const dir = site({
    'a.html': '<script type="application/json" id="d">{"items":[{"href":"#top"}]}</script>',
  });
  const r = checkLinks(dir);
  assert.equal(r.checked, 0);
  assert.equal(r.broken.length, 0);
});

test('JSON 데이터 안에 박힌 <a href> 태그 조각도 검사한다', () => {
  const dir = site({
    'a.html':
      '<script type="application/json" id="d">{"answers":{"x":{"html":"<a href=\\"zz.html\\">답</a>"}}}</script>',
  });
  const r = checkLinks(dir);
  assert.equal(r.broken.length, 1);
  assert.match(r.broken[0].reason, /파일/);
});

test('깨진 JSON은 조용히 건너뛴다', () => {
  const dir = site({
    'a.html': '<script type="application/json" id="d">{not valid json</script>',
  });
  const r = checkLinks(dir);
  assert.equal(r.broken.length, 0);
});
