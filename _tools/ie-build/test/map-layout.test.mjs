import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutGraph, hubThreshold, mulberry32, matchesKeyword, VIEW_W, VIEW_H,
} from '../assets/js/map-layout.mjs';

/**
 * 개념 지도 레이아웃. 브라우저(map.js)와 같은 파일을 그대로 import한다.
 * 고정 시드로 실제 그래프와 비슷한 모양(주차 3개, 주차 안은 촘촘, 주차 간은
 * 드문드문)을 만들어 검증한다.
 */
function fixture(n = 40, seed = 3) {
  const rng = mulberry32(seed);
  const weeks = ['W01', 'W02', 'W03'];
  const nodes = Array.from({ length: n }, (_, i) => ({
    id: `n${i}`, week: weeks[i % 3], title: `개념 이름 ${i}`, degree: 0,
  }));
  const edges = [];
  const seen = new Set();
  function add(a, b) {
    const key = [a, b].sort().join('|');
    if (a === b || seen.has(key)) return;
    seen.add(key);
    edges.push({ source: nodes[a].id, target: nodes[b].id, crossWeek: nodes[a].week !== nodes[b].week });
    nodes[a].degree++; nodes[b].degree++;
  }
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 2; k++) add(i, (i + 3 * (1 + Math.floor(rng() * 4))) % n); // 같은 주차
    if (rng() < 0.3) add(i, Math.floor(rng() * n)); // 주차를 넘을 수 있는 연결
  }
  return { nodes, edges, weeks };
}

function run(seed = 1) {
  const g = fixture();
  const out = layoutGraph(g.nodes, g.edges, { seed, weeks: g.weeks });
  return { ...g, ...out };
}

test('같은 시드면 같은 배치가 나온다', () => {
  const a = run(5), b = run(5);
  assert.deepEqual(a.nodes.map((n) => [n.x, n.y]), b.nodes.map((n) => [n.x, n.y]));
});

test('노드가 그림 테두리에 일렬로 붙지 않는다', () => {
  // 회귀: 이전 구현은 캔버스 경계에서 좌표를 잘라내 43개 중 41개가 사각형
  // 테두리를 따라 줄을 섰다. 원들을 감싸는 상자의 변에 바짝 붙은 노드가
  // 일부(볼록 껍질에 해당하는 몇 개)뿐이어야 한다.
  const { nodes } = run();
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const tol = Math.min(x1 - x0, y1 - y0) * 0.04;
  const onEdge = nodes.filter((n) =>
    n.x - x0 < tol || x1 - n.x < tol || n.y - y0 < tol || y1 - n.y < tol).length;
  assert.ok(onEdge <= nodes.length * 0.2, `테두리에 붙은 노드 ${onEdge}/${nodes.length}`);
});

test('원끼리 겹치지 않는다', () => {
  const { nodes } = run();
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
      assert.ok(gap > 0, `${a.id}–${b.id} 간격 ${gap.toFixed(1)}`);
    }
  }
});

test('viewBox가 모든 원과 라벨을 담고 화면 비율을 지킨다', () => {
  const { nodes, viewBox: [x, y, w, h] } = run();
  assert.ok(Math.abs(w / h - VIEW_W / VIEW_H) < 1e-9);
  for (const n of nodes) {
    assert.ok(n.x - n.r >= x && n.x + n.r <= x + w, `${n.id} 원 가로 이탈`);
    assert.ok(n.y - n.r >= y && n.y + n.r <= y + h, `${n.id} 원 세로 이탈`);
    assert.ok(n.lb.x >= x && n.lb.x + n.lb.w <= x + w, `${n.id} 라벨 가로 이탈`);
    assert.ok(n.lb.y >= y && n.lb.y + n.lb.h <= y + h, `${n.id} 라벨 세로 이탈`);
  }
});

test('주차 간 연결은 주차 안 연결보다 평균적으로 길다', () => {
  const { links } = run();
  const len = (l) => Math.hypot(l.s.x - l.t.x, l.s.y - l.t.y);
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const cross = avg(links.filter((l) => l.cross).map(len));
  const intra = avg(links.filter((l) => !l.cross).map(len));
  assert.ok(cross > intra * 1.3, `cross ${cross.toFixed(0)} vs intra ${intra.toFixed(0)}`);
});

test('라벨은 degree 상위 약 1/4(허브)만 상시 노출한다', () => {
  const nodes = [9, 8, 7, 6, 5, 4, 3, 3, 2, 1, 1, 1].map((degree) => ({ degree }));
  assert.equal(hubThreshold(nodes), 7);
  const { nodes: laid } = run();
  const hubs = laid.filter((n) => n.hub).length;
  assert.ok(hubs >= 1 && hubs <= laid.length * 0.4, `허브 ${hubs}/${laid.length}`);
});

test('상시 노출되는 허브 라벨끼리는 겹치지 않는다', () => {
  const { nodes } = run();
  const hubs = nodes.filter((n) => n.hub);
  for (let i = 0; i < hubs.length; i++) {
    for (let j = i + 1; j < hubs.length; j++) {
      const a = hubs[i].lb, b = hubs[j].lb;
      const hit = !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
      assert.ok(!hit, `${hubs[i].id}–${hubs[j].id} 라벨 겹침`);
    }
  }
});

test('노드가 없으면 기본 viewBox를 돌려준다', () => {
  const out = layoutGraph([], [], { seed: 1 });
  assert.deepEqual(out.viewBox, [0, 0, VIEW_W, VIEW_H]);
});

test('키워드: 제목·영문명·태그·정의에서 공백 분리 AND로 찾는다', () => {
  const n = { title: '세 가지 고착', en: 'Lock-in', tags: ['path-dependency'], oneLine: '조직·기술·사용자 고착' };
  assert.ok(matchesKeyword(n, ''));
  assert.ok(matchesKeyword(n, '  '));
  assert.ok(matchesKeyword(n, '고착'));
  assert.ok(matchesKeyword(n, 'LOCK'));
  assert.ok(matchesKeyword(n, 'path 사용자'));
  assert.ok(!matchesKeyword(n, '고착 시민'));
});
