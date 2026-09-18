import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderCorePage } from '../templates/core.mjs';

const coreSets = [{
  quiz: 1,
  id: 'q1',
  label: '샘플 세트',
  title: 'W01 쪽지시험 핵심 개념 2',
  introHtml: '<p>머리말</p>',
  items: [
    {
      n: 1,
      anchor: 'q1-k1',
      title: '첫 번째 핵심 개념',
      meta: [{ label: '주차', value: 'W01' }, { label: '슬라이드', value: 'p10' }],
      bodyHtml: '<p>본문</p>',
      concepts: [{
        week: 'W01', no: 5, slug: 'c05', title: '세 가지 고착',
        importance: { stars: 5, why: '핵심개념' },
      }],
    },
    {
      n: 2,
      anchor: 'q1-k2',
      title: '아직 연결 안 된 개념',
      meta: [],
      bodyHtml: '<p>본문 2</p>',
      concepts: [],
    },
  ],
}];
const quizSchedule = [{ n: 1, date: '2026-09-19', weeks: ['W01', 'W02-1'] }];

test('항목마다 앵커·번호·본문이 나온다', () => {
  const html = renderCorePage({ coreSets, quizSchedule });
  assert.match(html, /<article class="core-item" id="q1-k1">/);
  assert.match(html, /<article class="core-item" id="q1-k2">/);
  assert.match(html, /첫 번째 핵심 개념/);
  assert.match(html, /<div class="core-body"><p>본문<\/p><\/div>/);
});

test('세트 앵커와 퀴즈 범위·날짜가 학기 지도에서 온 링크를 받는다', () => {
  const html = renderCorePage({ coreSets, quizSchedule });
  assert.match(html, /id="quiz1"/, 'index.html이 core.html#quiz1로 링크한다');
  assert.match(html, /2026-09-19/);
  assert.match(html, /누적 범위 W01 · W02-1/);
  assert.match(html, /href="quiz\.html\?quiz=1"/);
});

test('연결된 개념이 있으면 상세 페이지 버튼을, 없으면 안내 문구를 넣는다', () => {
  const html = renderCorePage({ coreSets, quizSchedule });
  assert.match(html, /<a class="btn btn-quiet" href="W01\.html#c05">W01 · 세 가지 고착 →<\/a>/);
  assert.match(html, /연결된 개념 정리가 아직 없다/);
});

test('사이드바에 항목 목차가 들어간다', () => {
  const html = renderCorePage({ coreSets, quizSchedule });
  assert.match(html, /data-concept="q1-k1"/);
  assert.match(html, /data-concept="q1-k2"/);
});

test('세트가 없어도 페이지는 깨지지 않는다', () => {
  const html = renderCorePage({ coreSets: [], quizSchedule });
  assert.match(html, /아직 정리된 핵심 개념 세트가 없다/);
});
