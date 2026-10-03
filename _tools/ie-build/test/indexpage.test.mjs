import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderIndexPage } from '../templates/index.mjs';
import { renderCorePage } from '../templates/core.mjs';
import { renderQuizPage } from '../templates/quiz.mjs';
import { buildGraph, renderMapPage } from '../templates/map.mjs';
import { renderConcept } from '../lib/render.mjs';
import { renderWeekPage } from '../templates/week.mjs';
import { Warnings } from '../build.mjs';

const weeks = [
  {
    id: 'W01', date: '2026-09-05', topic: 'Intro', subtitle: '', source: 'a.pdf', quiz: null, lectured: true,
    concepts: [
      { slug: 'c01', no: 1, title: '사회 속의 시스템' },
      { slug: 'c02', no: 2, title: '상호구성' },
    ],
  },
  {
    id: 'W02-1', date: '2026-09-12', topic: '미시적 기초', subtitle: '', source: '', quiz: null, lectured: true,
    concepts: [{ slug: 'c01', no: 1, title: '암묵지' }],
  },
  {
    id: 'W03', date: '2026-09-19', topic: '거시 I', subtitle: '', source: '', quiz: 1, lectured: false, concepts: [],
  },
];
const quizSchedule = [{ n: 1, date: '2026-09-19', weeks: ['W01', 'W02-1'] }];

test('개념이 있는 주차는 링크된 카드로 렌더한다', () => {
  const html = renderIndexPage({ weeks, quizSchedule, builtAt: '2026-09-18 10:00' });
  assert.match(html, /href="W01\.html"/);
  assert.match(html, /href="W02-1\.html"/);
});

test('강의 전 주차는 비활성 카드로 렌더하고 링크하지 않는다', () => {
  const html = renderIndexPage({ weeks, quizSchedule, builtAt: '' });
  assert.match(html, /class="week-card is-pending"/);
  assert.ok(!html.includes('href="W03.html"'));
});

test('같은 날짜 주차를 한 카드로 묶는다', () => {
  const two = [
    { ...weeks[1], id: 'W02-1', date: '2026-09-12' },
    { ...weeks[1], id: 'W02-2', date: '2026-09-12', topic: '지식의 공공성' },
  ];
  const html = renderIndexPage({ weeks: two, quizSchedule, builtAt: '' });
  const cards = html.match(/class="week-card/g) || [];
  assert.equal(cards.length, 1);
  assert.match(html, /W02-1\.html/);
  assert.match(html, /W02-2\.html/);
});

test('퀴즈 배지와 일정 타임라인을 렌더한다', () => {
  const html = renderIndexPage({ weeks, quizSchedule, builtAt: '' });
  assert.match(html, /Quiz 1/);
  assert.match(html, /2026-09-19/);
});

test('진행 현황 합계가 맞다', () => {
  const html = renderIndexPage({ weeks, quizSchedule, builtAt: '' });
  assert.match(html, /개념 3개/);
  assert.doesNotMatch(html, /완료 \d+개/);
});

test('강의 프레임 3분류를 렌더한다', () => {
  const html = renderIndexPage({ weeks, quizSchedule, builtAt: '' });
  assert.match(html, /구조의 차이/);
  assert.match(html, /구조의 변화/);
  assert.match(html, /구조 변화의 기작/);
});

test('퀴즈 1 범위는 W01·W02-1만 포함하고 W02-2는 포함하지 않는다', () => {
  const html = renderIndexPage({ weeks, quizSchedule, builtAt: '' });
  assert.match(html, /W01 · W02-1/);
});

test('개념이 없는 주차로는 어떤 href도 생성하지 않는다', () => {
  const html = renderIndexPage({ weeks, quizSchedule, builtAt: '' });
  const hrefs = [...html.matchAll(/href="([^"]+\.html)"/g)].map((m) => m[1]);
  assert.ok(!hrefs.includes('W03.html'));
});

test('퀴즈 행은 핵심 개념·퀴즈 풀기 두 버튼을 오른쪽에 둔다', () => {
  const coreSets = [{ quiz: 1, items: new Array(10).fill({}) }];
  const html = renderIndexPage({ weeks, quizSchedule, coreSets, builtAt: '' });
  assert.match(html, /<div class="quiz-row-actions">/);
  assert.match(html, /<a class="btn btn-quiet" href="core\.html#quiz1">핵심 개념 10가지<\/a>/);
  assert.match(html, /<a class="btn btn-primary" href="quiz\.html\?quiz=1">퀴즈 풀기 →<\/a>/);
});

test('핵심 개념을 아직 추리지 않은 회차는 비활성 표시로 자리를 지킨다', () => {
  const html = renderIndexPage({ weeks, quizSchedule, coreSets: [], builtAt: '' });
  assert.match(html, /<span class="btn btn-disabled" aria-disabled="true">핵심 개념 준비 중<\/span>/);
  assert.match(html, /href="quiz\.html\?quiz=1"/);
});

test('주차 서브메뉴(weeknav)는 주차 페이지에서만 보이고, 학기 지도·핵심 개념·퀴즈·개념 지도에는 없다', () => {
  const indexHtml = renderIndexPage({ weeks, quizSchedule, builtAt: '' });
  const coreHtml = renderCorePage({ coreSets: [], quizSchedule: [] });
  const quizHtml = renderQuizPage({ items: [], answers: {}, weeks: [], quizSchedule: [] });
  const mapHtml = renderMapPage({ graph: buildGraph([]), weeks: [], comparisons: [] });

  for (const html of [indexHtml, coreHtml, quizHtml, mapHtml]) {
    assert.ok(!html.includes('class="weeknav"'));
  }

  const warnings = new Warnings();
  const concept = {
    week: 'W01', no: 1, slug: 'c01', file: '01-x.md', title: 'x', en: 'x', subtitle: '',
    tags: [], slides: [], hasMyNotes: false, related: [],
    sections: [{ key: 'definition', heading: '한 줄 정의', md: '정의.' }],
  };
  renderConcept(concept, warnings);
  const week = { id: 'W01', date: '2026-09-05', topic: 'Intro', subtitle: '', source: '', concepts: [concept] };
  const weekHtml = renderWeekPage({ week, weeks: [week] });
  assert.match(weekHtml, /<nav class="weeknav"/);
});
