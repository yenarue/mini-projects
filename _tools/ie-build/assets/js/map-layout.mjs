/**
 * 개념 지도 레이아웃 — DOM을 모르는 순수 함수만 둔다. 브라우저(map.js)와
 * Node 테스트(test/map-layout.test.mjs)가 이 파일을 그대로 쓴다. 배포본에서는
 * build.mjs가 map.js와 합쳐 classic script 하나로 낸다(lib/quizscript.mjs 참고).
 *
 * 이전 구현은 960×680 캔버스 안에서 힘을 계산하고, 밖으로 나간 노드를
 * Math.max/min으로 경계에 잘라 붙였다. 반발력(k²/d, k≈50)이 중심 인력
 * (0.01×거리)보다 훨씬 세서 평형 지점이 캔버스 밖에 있었고, 그 결과 노드
 * 43개 중 41개가 사각형 테두리를 따라 줄을 섰다(2026-10-05 실측).
 *
 * 지금 방식:
 *  1) 좌표계에 경계가 없다. Fruchterman-Reingold 힘(반발 k²/d, 인력 d²/k)으로
 *     자유롭게 배치하고, 끝난 뒤 그림 전체를 감싸는 viewBox를 계산해 화면에
 *     맞춘다. 노드가 늘어도 축척만 바뀔 뿐 벽에 붙는 일이 구조적으로 없다.
 *  2) 이동량 상한(온도)을 서서히 줄여 진동 없이 정착시킨다.
 *  3) 주차 간 연결은 인력을 약하게 걸어 "다리"처럼 길게 늘어지게 한다.
 *  4) 중심 인력은 세로 방향을 더 세게 걸어 가로로 긴 그림을 만든다 —
 *     화면 비율(960:680)에 맞춰야 여백이 덜 남는다.
 *  5) 마지막에 원끼리 겹치지 않도록 충돌을 한 번 더 풀고, 라벨은 상하좌우
 *     후보 중 덜 겹치는 자리를 고른다.
 */

export const VIEW_W = 960;
export const VIEW_H = 680;

/** 시드 고정 난수 — 같은 시드면 매번 같은 배치가 나온다. */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function nodeRadius(degree) {
  return 7 + Math.min(degree, 8) * 1.7;
}

export const LABEL_MAX = 13;
export function labelText(title) {
  return title.length > LABEL_MAX ? title.slice(0, LABEL_MAX - 1) + '…' : title;
}
// 한글 10.5px 기준 글자당 실측 ~7.5px. 여유 있게 잡는다. n.ls는 라벨 배율
// (labelScale) — 그림이 커져 viewBox가 넓어지면 글자를 그만큼 키워 화면에서
// 읽히는 크기를 유지한다.
function labelWidth(n) { return Math.min(n.title.length, LABEL_MAX) * 7.6 * (n.ls || 1); }

/**
 * 라벨을 항상 보여줄 "허브" 기준 degree. 상위 약 1/4만 라벨을 상시 노출하고
 * 나머지는 hover·선택 때만 보인다 — 노드가 100개로 늘어도 글자가 뒤덮지 않게.
 * 동점이 많으면 1/4보다 조금 더 보일 수 있다.
 */
export function hubThreshold(nodes) {
  if (!nodes.length) return Infinity;
  const ds = nodes.map((n) => n.degree).sort((a, b) => b - a);
  return Math.max(1, ds[Math.max(0, Math.ceil(ds.length * 0.25) - 1)]);
}

/**
 * nodes: [{id, week, degree, title}] (x, y, r, hub, 라벨 위치 lx·ly·anchor·lb를 채워 넣는다)
 * edges: [{source, target, crossWeek}]
 * weeks: 주차 id 배열(초기 위치를 주차별로 묶는 데만 쓴다)
 * 반환: { links: [{s, t, cross}], viewBox: [x, y, w, h], labelScale }
 */
export function layoutGraph(nodes, edges, { seed = 1, weeks = [] } = {}) {
  const rng = mulberry32(seed);
  const N = nodes.length;
  const byId = new Map();
  const K = 50; // 이상적인 노드 간격

  // 초기 위치: 주차별로 원 둘레에 뭉쳐 둔다(시드일 뿐, 이후 지속적인 인력 없음).
  const wks = weeks.length ? weeks : [...new Set(nodes.map((n) => n.week))];
  const spread = K * Math.sqrt(N) * 0.6;
  const centers = new Map(wks.map((w, i) => {
    const a = (i / Math.max(1, wks.length)) * Math.PI * 2;
    return [w, wks.length > 1 ? { x: Math.cos(a) * spread, y: Math.sin(a) * spread } : { x: 0, y: 0 }];
  }));
  for (const n of nodes) {
    const c = centers.get(n.week) || { x: 0, y: 0 };
    const a = rng() * Math.PI * 2;
    const r = K * (0.3 + rng());
    n.x = c.x + Math.cos(a) * r;
    n.y = c.y + Math.sin(a) * r;
    n.r = nodeRadius(n.degree);
    byId.set(n.id, n);
  }

  const links = edges
    .map((e) => ({ s: byId.get(e.source), t: byId.get(e.target), cross: !!e.crossWeek }))
    .filter((l) => l.s && l.t);
  const idx = new Map(nodes.map((n, i) => [n, i]));

  const iterations = 400;
  const temp0 = K * 2;
  const gravity = 0.1;
  const aspect = VIEW_W / VIEW_H;
  const dx = new Float64Array(N);
  const dy = new Float64Array(N);

  for (let step = 0; step < iterations; step++) {
    const temp = temp0 * (1 - step / iterations) + 0.3;
    dx.fill(0); dy.fill(0);

    // 반발: 큰 노드(허브)는 주변을 조금 더 넓게 비운다.
    for (let i = 0; i < N; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < N; j++) {
        const b = nodes[j];
        let ex = a.x - b.x, ey = a.y - b.y;
        let d2 = ex * ex + ey * ey;
        if (d2 < 0.01) { ex = rng() - 0.5; ey = rng() - 0.5; d2 = ex * ex + ey * ey; }
        const k = K + (a.r + b.r) * 0.6;
        const f = (k * k) / d2; // (k²/d) / d — 단위벡터 곱을 미리 묶었다
        dx[i] += ex * f; dy[i] += ey * f;
        dx[j] -= ex * f; dy[j] -= ey * f;
      }
    }
    // 인력: 주차 간 연결은 약하게 → 다리처럼 길게.
    for (const l of links) {
      const i = idx.get(l.s), j = idx.get(l.t);
      const ex = l.s.x - l.t.x, ey = l.s.y - l.t.y;
      const d = Math.sqrt(ex * ex + ey * ey) || 0.01;
      const f = (d / K) * (l.cross ? 0.35 : 1); // (d²/k) / d
      dx[i] -= ex * f; dy[i] -= ey * f;
      dx[j] += ex * f; dy[j] += ey * f;
    }
    for (let i = 0; i < N; i++) {
      const n = nodes[i];
      // 중심 인력 — 세로를 더 세게 걸어 가로로 긴 그림을 만든다.
      dx[i] -= n.x * gravity;
      dy[i] -= n.y * gravity * aspect;
      const m = Math.hypot(dx[i], dy[i]) || 0.01;
      const c = Math.min(m, temp);
      n.x += (dx[i] / m) * c;
      n.y += (dy[i] / m) * c;
    }
  }

  resolveCollisions(nodes, 10);
  // 라벨 배율: 원만 감싼 viewBox가 기본 폭(VIEW_W)보다 넓으면 그 비율만큼 글자를
  // 키운다. 노드가 많아 축소돼 보여도 라벨은 대략 10.5px로 읽히게 하려는 것.
  const labelScale = Math.max(1, fitViewBox(nodes, 24, false)[2] / VIEW_W);
  for (const n of nodes) n.ls = labelScale;
  placeLabels(nodes);
  return { links, viewBox: fitViewBox(nodes), labelScale };
}

/** 원끼리 pad보다 가까우면 서로 반씩 밀어낸다. */
export function resolveCollisions(nodes, pad) {
  for (let pass = 0; pass < 80; pass++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const min = a.r + b.r + pad;
        const ex = b.x - a.x, ey = b.y - a.y;
        const d = Math.sqrt(ex * ex + ey * ey) || 0.01;
        if (d >= min) continue;
        const push = (min - d) / 2 + 0.01;
        const ux = ex / d, uy = ey / d;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function boxesOverlap(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}
function boxHitsCircle(b, n) {
  const cx = Math.max(b.x, Math.min(n.x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(n.y, b.y + b.h));
  const ex = n.x - cx, ey = n.y - cy;
  return ex * ex + ey * ey < (n.r + 2) * (n.r + 2);
}

/**
 * 라벨 후보 위치: 아래(기본) → 위 → 오른쪽 → 왼쪽 → 한 칸 더 아래.
 * 반환하는 lx/ly는 <text>의 x/y, anchor는 text-anchor, box는 겹침 판정용 상자.
 */
function labelCandidates(n) {
  const s = n.ls || 1, w = labelWidth(n), h = 12 * s;
  const below = (gap) => ({
    lx: n.x, ly: n.y + n.r + gap, anchor: 'middle',
    box: { x: n.x - w / 2, y: n.y + n.r + gap - 9 * s, w, h },
  });
  return [
    below(12 * s),
    { lx: n.x, ly: n.y - n.r - 5 * s, anchor: 'middle',
      box: { x: n.x - w / 2, y: n.y - n.r - 14 * s, w, h } },
    { lx: n.x + n.r + 4 * s, ly: n.y + 4 * s, anchor: 'start',
      box: { x: n.x + n.r + 4 * s, y: n.y - 5 * s, w, h } },
    { lx: n.x - n.r - 4 * s, ly: n.y + 4 * s, anchor: 'end',
      box: { x: n.x - n.r - 4 * s - w, y: n.y - 5 * s, w, h } },
    below(26 * s),
  ];
}

/**
 * 허브 표시(hub)와 라벨 위치(lx, ly, anchor, lb)를 정한다. degree가 높은
 * 노드부터 차례로, 후보 위치 중 이미 놓인 라벨·남의 원과 가장 덜 겹치는 곳을
 * 고른다. 상시 노출되는 허브 라벨끼리의 겹침을 가장 무겁게 본다. 허브가 아닌
 * 라벨은 선택 강조 때만 보이므로 원과 허브 라벨만 피하면 된다.
 */
export function placeLabels(nodes) {
  const th = hubThreshold(nodes);
  // pin: 키워드에 맞은 개념처럼 degree와 상관없이 이름을 늘 보여야 하는 노드(map.js가 표시).
  for (const n of nodes) n.hub = n.degree >= th || !!n.pin;
  const order = nodes.slice().sort((a, b) => (b.hub - a.hub) || (b.degree - a.degree));
  const placedHub = [];
  for (const n of order) {
    let best = null, bestScore = Infinity;
    for (const c of labelCandidates(n)) {
      let score = 0;
      for (const b of placedHub) if (boxesOverlap(c.box, b)) score += 4;
      for (const m of nodes) if (m !== n && boxHitsCircle(c.box, m)) score += m.hub ? 3 : 2;
      if (score < bestScore) { best = c; bestScore = score; }
      if (score === 0) break;
    }
    n.lx = best.lx; n.ly = best.ly; n.anchor = best.anchor; n.lb = best.box;
    if (n.hub) placedHub.push(best.box);
  }
}

/** 원과 라벨을 모두 감싸고 화면 비율(VIEW_W:VIEW_H)에 맞춘 viewBox. */
export function fitViewBox(nodes, pad = 24, withLabels = true) {
  if (!nodes.length) return [0, 0, VIEW_W, VIEW_H];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) {
    x0 = Math.min(x0, n.x - n.r); x1 = Math.max(x1, n.x + n.r);
    y0 = Math.min(y0, n.y - n.r); y1 = Math.max(y1, n.y + n.r);
    if (withLabels && n.lb) {
      x0 = Math.min(x0, n.lb.x); x1 = Math.max(x1, n.lb.x + n.lb.w);
      y0 = Math.min(y0, n.lb.y); y1 = Math.max(y1, n.lb.y + n.lb.h);
    }
  }
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  let w = x1 - x0, h = y1 - y0;
  // 노드가 몇 개 없을 때(필터·키워드) 기본 크기보다 확대하지 않는다 — 원과
  // 글자가 혼자 커지면 다른 화면과 비교가 안 된다.
  const minW = VIEW_W;
  if (w < minW) { x0 -= (minW - w) / 2; w = minW; }
  const aspect = VIEW_W / VIEW_H;
  if (w / h > aspect) { const nh = w / aspect; y0 -= (nh - h) / 2; h = nh; }
  else { const nw = h * aspect; x0 -= (nw - w) / 2; w = nw; }
  return [x0, y0, w, h];
}

/**
 * 키워드 필터. 사이트 검색(main.js)과 같은 규칙 — 형태소 분석 없이 공백으로
 * 나눈 낱말이 모두(AND) 제목·영문명·태그·한 줄 정의 어딘가에 부분 문자열로
 * 들어 있으면 통과한다. 대소문자는 무시한다. 빈 질의는 모두 통과.
 */
export function matchesKeyword(node, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [node.title, node.en, (node.tags || []).join(' '), node.oneLine]
    .join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

/* ------------------------------------------------------------------
 * 확대·이동. 화면 상태는 viewBox 하나([x, y, w, h])로 표현한다. base는
 * layoutGraph가 돌려준 "전체 맞춤" viewBox이고, 확대 배율 k = base.w / cur.w.
 * 축소는 전체 맞춤(k=1)까지만 허용하고, 이동은 base 밖으로 나가지 않게 막는다
 * — 그래프를 화면 밖으로 날려 보내 길을 잃는 일이 없도록.
 * ------------------------------------------------------------------ */
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 8;

export function zoomLevel(base, cur) { return base[2] / cur[2]; }

/** 보이는 영역이 base 안에 머물도록 x, y만 보정한다. */
export function clampView(base, v) {
  const [bx, by, bw, bh] = base;
  const x = Math.min(Math.max(v[0], bx), bx + bw - v[2]);
  const y = Math.min(Math.max(v[1], by), by + bh - v[3]);
  return [x, y, v[2], v[3]];
}

/** (fx, fy) — viewBox 좌표의 한 점 — 을 화면에서 제자리에 둔 채 factor배 확대(1 미만이면 축소). */
export function zoomAt(base, cur, factor, fx, fy) {
  const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomLevel(base, cur) * factor));
  const w = base[2] / k, h = base[3] / k;
  const x = fx - (fx - cur[0]) * (w / cur[2]);
  const y = fy - (fy - cur[1]) * (h / cur[3]);
  return clampView(base, [x, y, w, h]);
}

/** viewBox 좌표 단위로 (dx, dy)만큼 보이는 영역을 옮긴다. */
export function panBy(base, cur, dx, dy) {
  return clampView(base, [cur[0] + dx, cur[1] + dy, cur[2], cur[3]]);
}

/** 배율은 그대로 두고 (px, py)가 가운데 오도록 옮긴다. */
export function centerOn(base, cur, px, py) {
  return clampView(base, [px - cur[2] / 2, py - cur[3] / 2, cur[2], cur[3]]);
}
