import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conceptHref, parseRelatedRef, rewriteMdLink, rewriteImagePath } from '../lib/links.mjs';

test('conceptHref는 번호를 2자리로 채운다', () => {
  assert.equal(conceptHref('W01', 5), 'W01.html#c05');
  assert.equal(conceptHref('W02-1', 12), 'W02-1.html#c12');
});

test('parseRelatedRef는 W##/NN과 W##-#/NN을 파싱한다', () => {
  assert.deepEqual(parseRelatedRef('W01/05'), { week: 'W01', no: 5 });
  assert.deepEqual(parseRelatedRef('W02-2/05'), { week: 'W02-2', no: 5 });
  assert.deepEqual(parseRelatedRef(' W01/2 '), { week: 'W01', no: 2 });
  assert.equal(parseRelatedRef('그냥 텍스트'), null);
  assert.equal(parseRelatedRef('W01'), null);
});

test('같은 폴더 md 링크를 주차 페이지 앵커로 바꾼다', () => {
  assert.deepEqual(
    rewriteMdLink('05-세-가지-고착.md', 'W01'),
    { href: 'W01.html#c05', ok: true }
  );
});

test('다른 주차 폴더의 md 링크를 바꾼다', () => {
  assert.deepEqual(
    rewriteMdLink('../W02-2/05-사유화의-누적과-기술-다양성-축소.md', 'W01'),
    { href: 'W02-2.html#c05', ok: true }
  );
});

test('md 링크에 붙은 앵커는 버리고 개념 앵커를 쓴다', () => {
  assert.deepEqual(
    rewriteMdLink('05-세-가지-고착.md#핵심-내용', 'W01'),
    { href: 'W01.html#c05', ok: true }
  );
});

test('외부 링크와 페이지 내 앵커는 그대로 둔다', () => {
  assert.deepEqual(rewriteMdLink('https://example.com', 'W01'), { href: 'https://example.com', ok: true });
  assert.deepEqual(rewriteMdLink('mailto:a@b.c', 'W01'), { href: 'mailto:a@b.c', ok: true });
  assert.deepEqual(rewriteMdLink('#section', 'W01'), { href: '#section', ok: true });
});

test('해석 불가능한 md 링크는 ok:false', () => {
  assert.equal(rewriteMdLink('../../수업노트/W01_강의기록_260905.md', 'W01').ok, false);
  assert.equal(rewriteMdLink('그냥-파일.md', 'W01').ok, false);
});

test('슬라이드 이미지 경로를 images/W##/p##.jpg로 바꾼다', () => {
  assert.deepEqual(
    rewriteImagePath('../../수업노트/assets/W01/p10.png'),
    { href: 'images/W01/p10.jpg', ok: true, week: 'W01', name: 'p10' }
  );
  assert.deepEqual(
    rewriteImagePath('../../수업노트/assets/W02-2/p07.png'),
    { href: 'images/W02-2/p07.jpg', ok: true, week: 'W02-2', name: 'p07' }
  );
});

test('개념정리/assets의 자체 제작 그림도 처리한다', () => {
  const r = rewriteImagePath('../assets/W01/그림1.png');
  assert.equal(r.ok, true);
  assert.equal(r.href, 'images/W01/그림1.jpg');
});

test('알 수 없는 이미지 경로는 ok:false', () => {
  assert.equal(rewriteImagePath('https://example.com/a.png').ok, false);
  assert.equal(rewriteImagePath('random.png').ok, false);
});

test('외부 https URL에 assets/W##/name.png 꼬리가 있어도 ok:false', () => {
  assert.equal(rewriteImagePath('https://cdn.example.com/수업노트/assets/W01/p1.png').ok, false);
});

test('프로토콜 상대 URL에 assets/W##/name.png 꼬리가 있어도 ok:false', () => {
  assert.equal(rewriteImagePath('//cdn.example.com/수업노트/assets/W01/p1.png').ok, false);
});

test('외부 URL에 ../assets/W##/name.png 형태가 있어도 ok:false', () => {
  assert.equal(rewriteImagePath('http://example.com/a/../assets/W01/p1.png').ok, false);
});
