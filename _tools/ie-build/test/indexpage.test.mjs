import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderIndexPage } from '../templates/index.mjs';

const weeks = [
  {
    id: 'W01', date: '2026-09-05', topic: 'Intro', subtitle: '', source: 'a.pdf', quiz: null, lectured: true,
    concepts: [
      { slug: 'c01', no: 1, title: '사회 속의 시스템', status: 'done' },
      { slug: 'c02', no: 2, title: '상호구성', status: 'draft' },
    ],
  },
  {
    id: 'W02-1', date: '2026-09-12', topic: '미시적 기초', subtitle: '', source: '', quiz: null, lectured: true,
    concepts: [{ slug: 'c01', no: 1, title: '암묵지', status: 'draft' }],
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
  assert.match(html, /완료 1개/);
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
