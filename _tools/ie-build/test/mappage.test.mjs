import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, renderMapPage } from '../templates/map.mjs';

const concepts = [
  { week: 'W01', no: 5, slug: 'c05', title: '고착', en: 'Lock-in', tags: ['lock-in'],
    related: [{ week: 'W01', no: 2, href: 'W01.html#c02', title: '상호구성' },
              { week: 'W02-2', no: 5, href: 'W02-2.html#c05', title: '사유화' }],
    sections: [{ key: 'definition', plain: '고착 정의' }] },
  { week: 'W01', no: 2, slug: 'c02', title: '상호구성', en: 'Co-constitution', tags: [],
    related: [{ week: 'W01', no: 5, href: 'W01.html#c05', title: '고착' }],
    sections: [{ key: 'definition', plain: '상호구성 정의' }] },
  { week: 'W02-2', no: 5, slug: 'c05', title: '사유화', en: 'Appropriation', tags: [],
    related: [], sections: [{ key: 'definition', plain: '사유화 정의' }] },
];
const weeks = [
  { id: 'W01', topic: 'Intro', concepts: concepts.slice(0, 2) },
  { id: 'W02-2', topic: '공공성', concepts: concepts.slice(2) },
];
const comparisons = [{
  id: 'X01', title: '비교 하나', note: '설명',
  columns: ['항목', 'W01/05 고착', 'W02-2/05 사유화'],
  rows: [['층위', 'a', 'b']],
}];

test('개념당 노드 하나를 만든다', () => {
  const g = buildGraph(concepts);
  assert.equal(g.nodes.length, 3);
  assert.equal(g.nodes[0].id, 'W01/c05');
});

test('양방향 related를 엣지 하나로 합친다', () => {
  const g = buildGraph(concepts);
  const between = g.edges.filter(function (e) {
    return (e.source === 'W01/c05' && e.target === 'W01/c02') ||
           (e.source === 'W01/c02' && e.target === 'W01/c05');
  });
  assert.equal(between.length, 1);
});

test('주차를 넘는 엣지에 crossWeek 플래그를 단다', () => {
  const g = buildGraph(concepts);
  const cross = g.edges.find((e) => e.crossWeek);
  assert.ok(cross);
  assert.ok([cross.source, cross.target].includes('W02-2/c05'));
});

test('degree를 계산한다', () => {
  const g = buildGraph(concepts);
  const hub = g.nodes.find((n) => n.id === 'W01/c05');
  assert.equal(hub.degree, 2);
});

test('존재하지 않는 대상은 엣지에서 뺀다', () => {
  const broken = [{ week: 'W01', no: 1, slug: 'c01', title: 'x', en: 'x', tags: [],
    related: [{ week: 'W09', no: 9, href: 'W09.html#c09', title: '' }], sections: [] }];
  const g = buildGraph(broken);
  assert.equal(g.edges.length, 0);
});

test('그래프 데이터를 JSON 스크립트로 인라인 삽입한다', () => {
  const html = renderMapPage({ graph: buildGraph(concepts), weeks, comparisons });
  assert.match(html, /<script type="application\/json" id="map-data">/);
});

test('비교표 셀의 W##/NN 표기를 링크로 바꾼다', () => {
  const html = renderMapPage({ graph: buildGraph(concepts), weeks, comparisons });
  assert.match(html, /href="W01\.html#c05"/);
  assert.match(html, /href="W02-2\.html#c05"/);
});

test('비교표 셀이 존재하지 않는 개념을 가리키면 링크가 아니라 평문으로 남는다', () => {
  const comparisonsWithGhost = [{
    id: 'X02', title: '비교 둘', note: '',
    columns: ['항목', 'W01/05 고착', 'W02-2/99 없는개념'],
    rows: [['층위', 'a', 'b']],
  }];
  const html = renderMapPage({ graph: buildGraph(concepts), weeks, comparisons: comparisonsWithGhost });
  assert.doesNotMatch(html, /href="W02-2\.html#c99"/);
  assert.match(html, />W02-2\/99 없는개념</);
});

test('그래프 노드 수와 엣지 수가 25 · 63이 아니어도(픽스처는 작음) 구조를 지킨다', () => {
  const g = buildGraph(concepts);
  assert.equal(g.nodes.length, concepts.length);
  assert.ok(Array.isArray(g.edges));
});

test('주차별 필터용 select 옵션이 렌더된다', () => {
  const html = renderMapPage({ graph: buildGraph(concepts), weeks, comparisons });
  assert.match(html, /<option value="W01">/);
  assert.match(html, /<option value="W02-2">/);
});

test('태그 필터용 select 옵션이 렌더된다', () => {
  const html = renderMapPage({ graph: buildGraph(concepts), weeks, comparisons });
  assert.match(html, /<option value="lock-in">/);
});
