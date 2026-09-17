import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripEmoji, parseConceptFile, collectConcepts } from '../lib/parse.mjs';
import { Warnings } from '../build.mjs';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('stripEmoji는 이모지와 양끝 공백을 제거한다', () => {
  assert.equal(stripEmoji('쉽게 말하면 (비유) 💡'), '쉽게 말하면 (비유)');
  assert.equal(stripEmoji('한 줄 정의'), '한 줄 정의');
  assert.equal(stripEmoji('보충 사례 💡'), '보충 사례');
});

test('frontmatter 10키를 파싱한다', () => {
  const w = new Warnings();
  const c = parseConceptFile(path.join(FIXTURES, 'W01', '05-샘플-개념.md'), w);
  assert.equal(c.week, 'W01');
  assert.equal(c.no, 5);
  assert.equal(c.slug, 'c05');
  assert.equal(c.title, '샘플 개념 — 첫째·둘째');
  assert.equal(c.en, 'Sample Concept — First / Second');
  assert.deepEqual(c.tags, ['alpha', 'beta']);
  assert.deepEqual(c.slides, ['W01 p10']);
  assert.equal(c.lectureRefs.length, 1);
  assert.deepEqual(c.relatedRaw, ['W01/02', 'W02-2/03']);
  assert.equal(c.status, 'draft');
  assert.equal(w.count, 0);
});

test('알 수 없는 frontmatter 키는 extraMeta로 보존한다', () => {
  const c = parseConceptFile(path.join(FIXTURES, 'W01', '05-샘플-개념.md'), new Warnings());
  assert.equal(c.extraMeta.note, '테스트용 추가 키');
});

test('H1과 출처 범례를 버리고 이탤릭 부제만 남긴다', () => {
  const c = parseConceptFile(path.join(FIXTURES, 'W01', '05-샘플-개념.md'), new Warnings());
  assert.equal(c.subtitle, '부제목 자리');
  const core = c.sections.find((s) => s.key === 'core');
  assert.ok(!core.md.includes('출처 표시'));
});

test('9개 섹션을 순서대로 분할한다', () => {
  const c = parseConceptFile(path.join(FIXTURES, 'W01', '05-샘플-개념.md'), new Warnings());
  assert.deepEqual(
    c.sections.map((s) => s.key),
    ['definition', 'analogy', 'core', 'discussion', 'examples', 'position', 'related', 'quiz', 'mynotes']
  );
});

test('빈 "나의 이해"는 hasMyNotes=false, 채워지면 true', () => {
  const empty = parseConceptFile(path.join(FIXTURES, 'W01', '05-샘플-개념.md'), new Warnings());
  assert.equal(empty.hasMyNotes, false);
  const filled = parseConceptFile(path.join(FIXTURES, 'W02-2', '03-두번째-주차.md'), new Warnings());
  assert.equal(filled.hasMyNotes, true);
});

test('알 수 없는 섹션 제목은 경고하고 other로 담는다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ie-parse-'));
  fs.mkdirSync(path.join(dir, 'W09'));
  const file = path.join(dir, 'W09', '01-새-개념.md');
  fs.writeFileSync(file, [
    '---', 'week: W09', 'no: 1', 'title: X', 'en: X', 'tags: []',
    'slides: []', 'lecture_refs: []', 'readings: []', 'related: []',
    'status: draft', '---', '', '## 한 줄 정의', '', 'ㅇㅇ', '',
    '## 완전히 새로운 섹션', '', '내용', '',
  ].join('\n'));

  const w = new Warnings();
  const c = parseConceptFile(file, w);
  const other = c.sections.find((s) => s.key === 'other');
  assert.equal(other.heading, '완전히 새로운 섹션');
  // 알 수 없는 섹션 1건 + 누락된 8개 섹션 경고
  assert.ok(w.items.some((i) => /완전히 새로운 섹션/.test(i.message)));
});

test('collectConcepts는 주차·번호 순으로 모은다', () => {
  const list = collectConcepts(FIXTURES, new Warnings());
  assert.equal(list.length, 2);
  assert.equal(list[0].week, 'W01');
  assert.equal(list[1].week, 'W02-2');
});
