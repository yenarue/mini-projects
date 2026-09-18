import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex, estimateSize, trimIfLarge } from '../lib/searchindex.mjs';

const concepts = [{
  week: 'W01', no: 5, slug: 'c05', title: '세 가지 고착', en: 'Lock-in',
  tags: ['lock-in', 'path-dependency'], status: 'draft',
  readings: ['Callon (1994) Is Science a Public Good? ★Core Reading'],
  sections: [
    { key: 'definition', plain: '시스템이 잘 안 바뀌는 이유는 고착 때문이다.' },
    { key: 'core', plain: 'QWERTY 키보드는 대표 사례다.' },
    { key: 'mynotes', plain: '(직접 작성)' },
    { key: 'quiz', plain: '1. 고착의 세 유형을 비교하라.' },
  ],
}];
const weeks = [{ id: 'W01', topic: 'Introduction' }];

test('개념당 문서 하나를 만든다', () => {
  const idx = buildSearchIndex(concepts, weeks);
  assert.equal(idx.docs.length, 1);
  assert.equal(idx.docs[0].id, 'W01/c05');
  assert.equal(idx.docs[0].href, 'W01.html#c05');
  assert.equal(idx.docs[0].weekTopic, 'Introduction');
});

test('한 줄 정의를 별도 필드로 뽑는다', () => {
  const idx = buildSearchIndex(concepts, weeks);
  assert.match(idx.docs[0].oneLine, /고착 때문이다/);
});

test('본문에 핵심 내용이 들어가고 "나의 이해"는 빠진다', () => {
  const idx = buildSearchIndex(concepts, weeks);
  assert.match(idx.docs[0].body, /QWERTY/);
  assert.ok(!idx.docs[0].body.includes('직접 작성'));
});

test('본문에서 예상 퀴즈 포인트는 빠진다', () => {
  const idx = buildSearchIndex(concepts, weeks);
  assert.ok(!idx.docs[0].body.includes('세 유형을 비교하라'));
});

test('readings의 서지 정보가 refs 필드로 뽑힌다 (저자명 검색용)', () => {
  const idx = buildSearchIndex(concepts, weeks);
  assert.match(idx.docs[0].refs, /Callon/);
});

test('readings가 없으면 refs는 빈 문자열이다', () => {
  const noReadings = [{ ...concepts[0], readings: undefined }];
  const idx = buildSearchIndex(noReadings, weeks);
  assert.equal(idx.docs[0].refs, '');
});

test('definition 섹션이 없으면 oneLine은 빈 문자열이다', () => {
  const noDefinition = [{
    ...concepts[0],
    sections: concepts[0].sections.filter((s) => s.key !== 'definition'),
  }];
  const idx = buildSearchIndex(noDefinition, weeks);
  assert.equal(idx.docs[0].oneLine, '');
});

test('estimateSize는 바이트 수를 반환한다', () => {
  const idx = buildSearchIndex(concepts, weeks);
  assert.ok(estimateSize(idx) > 100);
});

test('trimIfLarge는 한도 이하면 그대로 둔다', () => {
  const idx = buildSearchIndex(concepts, weeks);
  const { trimmed } = trimIfLarge(idx, 1_500_000, 3000);
  assert.equal(trimmed, false);
});

test('trimIfLarge는 한도를 넘으면 본문을 자르고 trimmed를 알린다', () => {
  const bigConcepts = [{
    ...concepts[0],
    sections: [
      { key: 'definition', plain: '정의' },
      { key: 'core', plain: 'X'.repeat(5000) },
    ],
  }];
  const idx = buildSearchIndex(bigConcepts, weeks);
  const { index, trimmed } = trimIfLarge(idx, 100, 200);
  assert.equal(trimmed, true);
  assert.ok(index.docs[0].body.length <= 200);
});
