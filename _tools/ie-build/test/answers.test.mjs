import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadAnswers, normalizeQuestion } from '../lib/answers.mjs';
import { Warnings } from '../build.mjs';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ie-answers-'));
}

function writeFile(dir, name, content) {
  fs.writeFileSync(path.join(dir, name), content, 'utf8');
}

function concept(overrides = {}) {
  return {
    week: 'W02-2',
    no: 1,
    slug: 'c01',
    title: '고전적 공공재 논리와 그 한계',
    en: 'The Classical Public Good Argument',
    quizPoints: [
      { html: '비배제성·비경합성을 설명하라.', text: '비배제성·비경합성을 설명하라.', isComparison: false },
      { html: '생략된 것은 무엇인가?', text: '생략된 것은 무엇인가?', isComparison: false },
      { html: '비교형: 시장 실패와의 관계.', text: '비교형: 시장 실패와의 관계.', isComparison: true },
    ],
    ...overrides,
  };
}

test('normalizeQuestion은 이모지·★와 공백 차이를 무시한다', () => {
  assert.equal(
    normalizeQuestion('★  비배제성·비경합성을   설명하라.  '),
    normalizeQuestion('비배제성·비경합성을 설명하라.')
  );
  assert.notEqual(normalizeQuestion('질문 A'), normalizeQuestion('질문 B'));
});

test('디렉터리가 없으면 빈 결과를 돌려준다(에러를 던지지 않는다)', () => {
  const warnings = new Warnings();
  const result = loadAnswers(path.join(os.tmpdir(), 'ie-answers-does-not-exist'), [concept()], warnings);
  assert.equal(result.size, 0);
  assert.equal(warnings.count, 0);
});

test('스냅샷이 일치하면 마크다운을 렌더해 해당 인덱스에 채운다', () => {
  const dir = tmpDir();
  try {
    writeFile(
      dir,
      'W02-2-c01.md',
      [
        '---', 'week: W02-2', 'no: 1', '---', '',
        '## Q1',
        '> 비배제성·비경합성을 설명하라.',
        '',
        '**비배제성**은 막기 어렵다는 뜻이다.',
        '',
      ].join('\n')
    );
    const warnings = new Warnings();
    const result = loadAnswers(dir, [concept()], warnings);
    assert.equal(warnings.items.filter((w) => w.scope === 'answer-mismatch').length, 0);
    const byIndex = result.get('W02-2/c01');
    assert.ok(byIndex);
    assert.match(byIndex.get(0), /<strong>비배제성<\/strong>/);
    assert.ok(!byIndex.has(1));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('스냅샷이 실제 퀴즈 포인트와 다르면 answer-mismatch 경고를 내고 답안을 넣지 않는다', () => {
  const dir = tmpDir();
  try {
    writeFile(
      dir,
      'W02-2-c01.md',
      [
        '---', 'week: W02-2', 'no: 1', '---', '',
        '## Q1',
        '> 예전 질문 — 지금은 소스 노트가 바뀌었다.',
        '',
        '이 답안은 절대 노출되면 안 된다.',
        '',
      ].join('\n')
    );
    const warnings = new Warnings();
    const result = loadAnswers(dir, [concept()], warnings);
    const byIndex = result.get('W02-2/c01');
    assert.ok(!byIndex || !byIndex.has(0));
    const mismatches = warnings.items.filter((w) => w.scope === 'answer-mismatch');
    assert.equal(mismatches.length, 1);
    assert.match(mismatches[0].message, /W02-2-c01\.md/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('한 파일 안에서 일부 문항만 일치해도 일치한 문항만 채운다', () => {
  const dir = tmpDir();
  try {
    writeFile(
      dir,
      'W02-2-c01.md',
      [
        '---', 'week: W02-2', 'no: 1', '---', '',
        '## Q1',
        '> 비배제성·비경합성을 설명하라.',
        '',
        '답1',
        '',
        '## Q2',
        '> 달라진 질문',
        '',
        '답2 (노출되면 안 됨)',
        '',
        '## Q3',
        '> 비교형: 시장 실패와의 관계.',
        '',
        '답3',
        '',
      ].join('\n')
    );
    const warnings = new Warnings();
    const result = loadAnswers(dir, [concept()], warnings);
    const byIndex = result.get('W02-2/c01');
    assert.match(byIndex.get(0), /답1/);
    assert.ok(!byIndex.has(1));
    assert.match(byIndex.get(2), /답3/);
    assert.equal(warnings.items.filter((w) => w.scope === 'answer-mismatch').length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('개념 인덱스 범위를 벗어난 Q번호는 answers 경고를 내고 건너뛴다(크래시하지 않는다)', () => {
  const dir = tmpDir();
  try {
    writeFile(
      dir,
      'W02-2-c01.md',
      ['---', 'week: W02-2', 'no: 1', '---', '', '## Q9', '> 존재하지 않는 문항', '', '답', ''].join('\n')
    );
    const warnings = new Warnings();
    const result = loadAnswers(dir, [concept()], warnings);
    assert.equal(result.size, 0);
    assert.ok(warnings.items.some((w) => w.scope === 'answers'));
    assert.equal(warnings.items.filter((w) => w.scope === 'answer-mismatch').length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('frontmatter의 week/no에 해당하는 개념이 없으면 경고만 내고 건너뛴다', () => {
  const dir = tmpDir();
  try {
    writeFile(
      dir,
      'W09-c01.md',
      ['---', 'week: W09', 'no: 1', '---', '', '## Q1', '> 아무 질문', '', '답', ''].join('\n')
    );
    const warnings = new Warnings();
    const result = loadAnswers(dir, [concept()], warnings);
    assert.equal(result.size, 0);
    assert.ok(warnings.items.some((w) => w.scope === 'answers' && /W09\/1/.test(w.message)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('frontmatter가 없으면 경고를 내고 건너뛴다', () => {
  const dir = tmpDir();
  try {
    writeFile(dir, 'broken.md', '## Q1\n> 질문\n\n답\n');
    const warnings = new Warnings();
    const result = loadAnswers(dir, [concept()], warnings);
    assert.equal(result.size, 0);
    assert.ok(warnings.items.some((w) => w.scope === 'answers'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('여러 개념 파일을 함께 읽어 각자의 conceptId 아래에 모은다', () => {
  const dir = tmpDir();
  try {
    writeFile(
      dir,
      'W02-2-c01.md',
      ['---', 'week: W02-2', 'no: 1', '---', '', '## Q1', '> 비배제성·비경합성을 설명하라.', '', '답A', ''].join('\n')
    );
    writeFile(
      dir,
      'W02-2-c02.md',
      ['---', 'week: W02-2', 'no: 2', '---', '', '## Q1', '> 다른 개념의 문제', '', '답B', ''].join('\n')
    );
    const c2 = concept({
      no: 2,
      slug: 'c02',
      title: 'Kealey의 도전',
      quizPoints: [{ html: '다른 개념의 문제', text: '다른 개념의 문제', isComparison: false }],
    });
    const warnings = new Warnings();
    const result = loadAnswers(dir, [concept(), c2], warnings);
    assert.match(result.get('W02-2/c01').get(0), /답A/);
    assert.match(result.get('W02-2/c02').get(0), /답B/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
