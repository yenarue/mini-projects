import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMetaPairs, parseCoreFile, buildFocus, MAX_STARS } from '../lib/focus.mjs';
import { Warnings } from '../build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, 'fixtures', 'focus');
const CORE_MD = path.join(FIXTURE, '쪽지시험_핵심개념', '샘플_핵심개념.md');

test('한 줄에 여러 쌍이 있어도 메타를 라벨·값으로 쪼갠다', () => {
  const pairs = parseMetaPairs('> **주차:** W01<br>\n> **슬라이드:** p10–11 · **강의기록:** W01 §5');
  assert.deepEqual(pairs, [
    { label: '주차', value: 'W01' },
    { label: '슬라이드', value: 'p10–11' },
    { label: '강의기록', value: 'W01 §5' },
  ]);
});

test('<br>로 이어진 여러 줄짜리 값은 한 값으로 합친다', () => {
  const pairs = parseMetaPairs('> **주차:** W01<br>\n> W02-1 · **슬라이드:** p6');
  assert.deepEqual(pairs[0], { label: '주차', value: 'W01 W02-1' });
});

test('핵심개념 md를 항목으로 쪼개고 부록 절은 버린다', () => {
  const warnings = new Warnings();
  const doc = parseCoreFile(CORE_MD, warnings);

  assert.equal(doc.title, '샘플 쪽지시험 핵심 개념 2');
  assert.match(doc.introMd, /머리말 문단/);
  assert.equal(doc.items.length, 2, '"참고한 강의기록" 절은 항목이 아니다');
  assert.equal(doc.items[0].title, '첫 번째 핵심 개념');
  assert.equal(doc.items[0].meta.length, 3);
  assert.match(doc.items[0].bodyMd, /첫 개념\(first\)/);
  assert.doesNotMatch(doc.items[1].bodyMd, /사이트에 싣지 않는다/);
  assert.doesNotMatch(doc.items[1].bodyMd, /^---$/m, '항목 끝의 구분선은 본문에 남지 않는다');
  assert.equal(warnings.count, 0);
});

function makeConcept(week, no, title) {
  return { week, no, title, slug: `c${String(no).padStart(2, '0')}` };
}

test('핵심개념에 뽑힌 개념은 별점이 5점으로 올라가고 배지 참조가 붙는다', () => {
  const warnings = new Warnings();
  const concepts = [makeConcept('W01', 5, '세 가지 고착')];
  const { coreSets } = buildFocus({
    toolDir: FIXTURE, conceptDir: FIXTURE, concepts, warnings,
  });

  assert.equal(concepts[0].importance.stars, MAX_STARS, 'importance.json에 2점이라 적혀 있어도 핵심개념은 5점이다');
  assert.equal(concepts[0].coreRefs.length, 1);
  assert.equal(concepts[0].coreRefs[0].href, 'core.html#q1-k1');
  assert.equal(coreSets[0].items[0].concepts[0], concepts[0]);
  assert.match(coreSets[0].items[0].bodyHtml, /<strong>첫 개념\(first\)<\/strong>/);
});

test('importance.json에 없는 개념은 기본값을 쓰고 경고를 남긴다', () => {
  const warnings = new Warnings();
  const concepts = [makeConcept('W01', 5, '세 가지 고착'), makeConcept('W01', 6, '시장실패')];
  buildFocus({ toolDir: FIXTURE, conceptDir: FIXTURE, concepts, warnings });

  assert.equal(concepts[1].importance.stars, 3);
  assert.equal(warnings.items.filter((w) => w.scope === 'importance').length, 1);
});

test('연결된 개념이 아직 없으면 경고만 남기고 항목은 살린다', () => {
  const warnings = new Warnings();
  const concepts = [makeConcept('W01', 5, '세 가지 고착')];
  const { coreSets } = buildFocus({ toolDir: FIXTURE, conceptDir: FIXTURE, concepts, warnings });

  assert.equal(coreSets[0].items[1].concepts.length, 0, 'W09/1은 아직 없는 개념이다');
  assert.equal(warnings.items.filter((w) => w.scope === 'core').length, 1);
});
