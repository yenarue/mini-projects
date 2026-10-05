// 이 파일은 빌드 산출물이다 — assets/js/map-layout.mjs + assets/js/map.js를
// _tools/ie-build/lib/quizscript.mjs가 합쳐 classic script로 만든 것이다.
// 소스를 고치려면 위 두 파일을 고치고 node build.mjs를 다시 돌려라.
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

const VIEW_W = 960;
const VIEW_H = 680;

/** 시드 고정 난수 — 같은 시드면 매번 같은 배치가 나온다. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nodeRadius(degree) {
  return 7 + Math.min(degree, 8) * 1.7;
}

const LABEL_MAX = 13;
function labelText(title) {
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
function hubThreshold(nodes) {
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
function layoutGraph(nodes, edges, { seed = 1, weeks = [] } = {}) {
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
function resolveCollisions(nodes, pad) {
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
function placeLabels(nodes) {
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
function fitViewBox(nodes, pad = 24, withLabels = true) {
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
function matchesKeyword(node, query) {
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
const ZOOM_MIN = 1;
const ZOOM_MAX = 8;

function zoomLevel(base, cur) { return base[2] / cur[2]; }

/** 보이는 영역이 base 안에 머물도록 x, y만 보정한다. */
function clampView(base, v) {
  const [bx, by, bw, bh] = base;
  const x = Math.min(Math.max(v[0], bx), bx + bw - v[2]);
  const y = Math.min(Math.max(v[1], by), by + bh - v[3]);
  return [x, y, v[2], v[3]];
}

/** (fx, fy) — viewBox 좌표의 한 점 — 을 화면에서 제자리에 둔 채 factor배 확대(1 미만이면 축소). */
function zoomAt(base, cur, factor, fx, fy) {
  const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomLevel(base, cur) * factor));
  const w = base[2] / k, h = base[3] / k;
  const x = fx - (fx - cur[0]) * (w / cur[2]);
  const y = fy - (fy - cur[1]) * (h / cur[3]);
  return clampView(base, [x, y, w, h]);
}

/** viewBox 좌표 단위로 (dx, dy)만큼 보이는 영역을 옮긴다. */
function panBy(base, cur, dx, dy) {
  return clampView(base, [cur[0] + dx, cur[1] + dy, cur[2], cur[3]]);
}

/** 배율은 그대로 두고 (px, py)가 가운데 오도록 옮긴다. */
function centerOn(base, cur, px, py) {
  return clampView(base, [px - cur[2] / 2, py - cur[3] / 2, cur[2], cur[3]]);
}

(function () {
  'use strict';

  var raw = document.getElementById('map-data');
  if (!raw) return;
  var GRAPH = JSON.parse(raw.textContent);

  var svg = document.getElementById('map-svg');
  var tip = document.getElementById('map-tip');
  var panel = document.getElementById('map-focus');
  var emptyMsg = document.getElementById('map-empty');
  var legend = document.getElementById('map-legend');
  var weekSel = document.getElementById('map-week');
  var tagSel = document.getElementById('map-tag');
  var qInput = document.getElementById('map-q');
  var qNear = document.getElementById('map-q-near');
  var qCount = document.getElementById('map-q-count');
  var crossOnly = document.getElementById('map-cross-only');
  var relayout = document.getElementById('map-relayout');

  var NS = 'http://www.w3.org/2000/svg';

  // 그래프 자체는 week 순서를 모른다(개념 배열 순서일 뿐) — 나온 순서대로 고유
  // week를 모으고, weeks.json 순서와 대략 일치하도록 정렬한다.
  var WEEKS = [];
  GRAPH.nodes.forEach(function (n) { if (WEEKS.indexOf(n.week) < 0) WEEKS.push(n.week); });
  WEEKS.sort();

  // 색은 "week 번호"가 아니라 팔레트 순환에서 뽑는다 — week가 늘어도 깨지지 않는다.
  // 값 자체는 인라인 hex가 아니라 CSS 변수를 가리키는 이름만 쓰고, 실제 색은
  // styles.css의 --map-c0..--map-c7 토큰이 라이트/다크에서 각각 정의한다.
  function weekVar(week) {
    var i = WEEKS.indexOf(week);
    return 'var(--map-c' + ((i < 0 ? 0 : i) % 8) + ')';
  }

  function filtered() {
    var wk = weekSel.value, tg = tagSel.value, q = qInput.value.trim();
    var base = GRAPH.nodes.filter(function (n) {
      if (wk !== 'all' && n.week !== wk) return false;
      if (tg !== 'all' && n.tags.indexOf(tg) < 0) return false;
      return true;
    });
    var baseIds = {};
    base.forEach(function (n) { baseIds[n.id] = true; });
    var baseEdges = GRAPH.edges.filter(function (e) {
      if (!baseIds[e.source] || !baseIds[e.target]) return false;
      if (crossOnly.checked && !e.crossWeek) return false;
      return true;
    });

    // 키워드: 맞는 개념(hit)만 남기되, "연결된 개념도"가 켜져 있으면 hit에 바로
    // 이어진 개념까지 함께 보여준다 — 맞는 개념 하나만 덩그러니 남으면 무엇과
    // 이어지는지 볼 수 없어서다.
    var hits = {}, keep = baseIds, hitCount = 0;
    if (q) {
      base.forEach(function (n) { if (matchesKeyword(n, q)) { hits[n.id] = true; hitCount++; } });
      keep = Object.assign({}, hits);
      if (qNear.checked) {
        baseEdges.forEach(function (e) {
          if (hits[e.source]) keep[e.target] = true;
          if (hits[e.target]) keep[e.source] = true;
        });
      }
    }
    qCount.textContent = q ? '일치 ' + hitCount + '개' : '';

    var nodes = base.filter(function (n) { return keep[n.id]; }).map(function (n) {
      var c = Object.assign({}, n);
      if (hits[n.id]) { c.hit = true; c.pin = true; }
      return c;
    });
    var edges = baseEdges.filter(function (e) { return keep[e.source] && keep[e.target]; });
    return { nodes: nodes, edges: edges };
  }

  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, String(attrs[k])); });
    return e;
  }

  var currentSeed = 1;
  // 현재 그려진 그래프 — 선택 강조가 이웃을 찾을 때 쓴다.
  var view = { byId: {}, nodeEls: {}, labelEls: {}, edgeEls: [], links: [] };
  var selected = null;

  function draw() {
    var g = filtered();
    svg.innerHTML = '';
    tip.hidden = true;

    if (!g.nodes.length) {
      emptyMsg.hidden = false;
      legend.textContent = '';
      view = { byId: {}, nodeEls: {}, labelEls: {}, edgeEls: [], links: [] };
      clearFocus();
      return;
    }
    emptyMsg.hidden = true;

    var out = layoutGraph(g.nodes, g.edges, { seed: currentSeed, weeks: WEEKS });
    // 필터를 바꾸거나 다시 배치하면 확대 상태를 풀고 전체 맞춤에서 시작한다.
    baseVB = out.viewBox;
    labelScale = out.labelScale;

    view = { byId: {}, nodeEls: {}, labelEls: {}, edgeEls: [], links: out.links };
    g.nodes.forEach(function (n) { view.byId[n.id] = n; });

    var gEdges = el('g', { class: 'map-edges' });
    // 주차 간 연결을 나중에 그려서(=위에 겹쳐서) 항상 눈에 먼저 들어오게 한다.
    out.links.filter(function (l) { return !l.cross; }).concat(
      out.links.filter(function (l) { return l.cross; })
    ).forEach(function (l) {
      var line = el('line', {
        class: l.cross ? 'map-edge map-edge-cross' : 'map-edge',
        x1: l.s.x, y1: l.s.y, x2: l.t.x, y2: l.t.y,
      });
      view.edgeEls.push({ el: line, s: l.s.id, t: l.t.id });
      gEdges.appendChild(line);
    });
    svg.appendChild(gEdges);

    var gNodes = el('g', { class: 'map-nodes' });
    // 라벨은 원과 다른 그룹에, 원보다 나중에 그린다 — 노드 <a> 안에 두면 뒤에
    // 그려지는 이웃 원이 라벨을 덮는다. 대신 hover·강조 상태는 JS가 라벨에도
    // 같은 클래스를 달아 맞춘다.
    var gLabels = el('g', { class: 'map-labels', 'aria-hidden': 'true' });
    g.nodes.forEach(function (n) {
      var a = el('a', { href: n.href, class: 'map-node' + (n.hit ? ' is-hit' : ''), 'aria-label': n.title });

      a.appendChild(el('circle', {
        cx: n.x, cy: n.y, r: n.r,
        class: 'map-dot',
        style: 'fill:' + weekVar(n.week),
      }));

      var label = el('text', {
        x: n.lx, y: n.ly, 'text-anchor': n.anchor, class: 'map-label' + (n.hub ? ' is-hub' : '') + (n.hit ? ' is-hit' : ''),
      });
      label.textContent = labelText(n.title);
      gLabels.appendChild(label);
      view.labelEls[n.id] = label;

      function showTip(evt) {
        label.classList.add('is-hover');
        if (selected === n.id) { tip.hidden = true; return; }
        tip.hidden = false;
        tip.innerHTML = '<strong>' + escapeHtml(n.title) + '</strong><br>' +
          '<span class="map-tip-en">' + escapeHtml(n.en || '') + '</span><br>' +
          '<span class="map-tip-week">' + escapeHtml(n.week) + ' · 연결 ' + n.degree + '</span>' +
          (n.oneLine ? '<br><span class="map-tip-one">' + escapeHtml(n.oneLine) + '</span>' : '') +
          '<br><span class="map-tip-hint">클릭하면 연결된 개념만 강조</span>';
        positionTip(evt);
      }
      function positionTip(evt) {
        var box = svg.getBoundingClientRect();
        var left, top;
        if (evt && evt.clientX) {
          left = evt.clientX - box.left; top = evt.clientY - box.top;
        } else {
          // 키보드 포커스 — 마우스 좌표가 없으니 노드의 화면 위치를 viewBox 변환으로 구한다.
          var m = svg.getScreenCTM();
          left = n.x * m.a + m.e - box.left; top = n.y * m.d + m.f - box.top;
        }
        left += 14; top += 14;
        var maxLeft = box.width - 270;
        if (left > maxLeft) left = Math.max(4, left - 280);
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
      }

      a.addEventListener('mouseenter', showTip);
      a.addEventListener('mousemove', positionTip);
      function hideTip() { tip.hidden = true; label.classList.remove('is-hover'); }
      a.addEventListener('mouseleave', hideTip);
      a.addEventListener('focus', showTip);
      a.addEventListener('blur', hideTip);
      // 첫 클릭은 강조만 하고, 이미 선택된 노드를 다시 누르면 개념 페이지로 간다.
      a.addEventListener('click', function (evt) {
        if (selected === n.id) return;
        evt.preventDefault();
        focusNode(n.id);
      });

      view.nodeEls[n.id] = a;
      gNodes.appendChild(a);
    });
    svg.appendChild(gNodes);
    svg.appendChild(gLabels);

    legend.innerHTML = WEEKS.map(function (w) {
      return '<span class="map-legend-item"><i style="background:' + weekVar(w) + '"></i>' + escapeHtml(w) + '</span>';
    }).join('') +
      '<span class="map-legend-item"><i class="cross"></i>주차 간 연결</span>';

    setView(baseVB);

    // 필터를 바꾸거나 다시 배치해도 선택한 개념이 아직 보이면 강조를 유지한다.
    if (selected && view.byId[selected]) focusNode(selected);
    else clearFocus();
  }

  /* ---------- 확대·이동 ----------
   * 화면 상태는 viewBox 하나다(계산은 map-layout.mjs의 zoomAt/panBy). 라벨은
   * 확대할수록 덜 커지게(배율의 제곱근만큼 상쇄) 해서, 확대하면 라벨끼리 사이가
   * 벌어지고 숨겨 둔 라벨도 꺼내 보일 수 있게 한다. */
  var baseVB = [0, 0, 960, 680];
  var curVB = baseVB;
  var labelScale = 1;
  var zoomBtns = {
    inn: document.getElementById('map-zoom-in'),
    out: document.getElementById('map-zoom-out'),
    fit: document.getElementById('map-zoom-fit'),
  };
  var zoomPct = document.getElementById('map-zoom-level');

  function setView(vb) {
    curVB = vb;
    svg.setAttribute('viewBox', vb.join(' '));
    var k = zoomLevel(baseVB, vb);
    var lz = labelScale / Math.sqrt(k);
    // 확대한 상태에서는 라벨이 화면에서 9px 아래로 작아지지 않게 한다 — 폭이 좁은
    // 모바일에서는 √k 상쇄만으로는 확대해도 글자가 읽히지 않았다. 배율 1(전체
    // 보기)은 허브 라벨 배치가 깨지지 않도록 그대로 둔다.
    var w = svg.getBoundingClientRect().width;
    if (k > 1.01 && w) lz = Math.max(lz, 9 / (10.5 * (w / vb[2])));
    svg.style.setProperty('--map-ls', String(labelScale));
    svg.style.setProperty('--map-lz', String(lz));
    svg.classList.toggle('is-zoomed', k > 1.01);
    // 2.5배 이상 확대하면 허브가 아닌 개념의 이름도 모두 보여준다.
    svg.classList.toggle('show-all-labels', k >= 2.5);
    // 원 반경과 라벨까지의 거리도 라벨 글자와 같은 비율(√k)로 상쇄한다 — 확대할수록
    // 노드 사이가 벌어져 빽빽한 곳이 풀린다. 라벨 오프셋은 원 반경과 글자 크기의
    // 합이라 같은 비율로 줄이면 정확히 맞는다.
    var c = 1 / Math.sqrt(k);
    var cl = Math.max(c, lz / labelScale); // 라벨 거리: 글자가 하한에 걸리면 그만큼 덜 줄인다
    Object.keys(view.nodeEls).forEach(function (id) {
      var n = view.byId[id];
      view.nodeEls[id].firstChild.setAttribute('r', n.r * c);
      var lb = view.labelEls[id];
      lb.setAttribute('x', n.x + (n.lx - n.x) * cl);
      lb.setAttribute('y', n.y + (n.ly - n.y) * cl);
    });
    zoomPct.textContent = Math.round(k * 100) + '%';
    zoomBtns.inn.disabled = k >= ZOOM_MAX - 1e-6;
    zoomBtns.out.disabled = zoomBtns.fit.disabled = k <= ZOOM_MIN + 1e-6;
  }

  /** 화면 좌표(clientX/Y) → viewBox 좌표 */
  function toUser(cx, cy) {
    var m = svg.getScreenCTM();
    if (!m) return { x: curVB[0] + curVB[2] / 2, y: curVB[1] + curVB[3] / 2 };
    var p = svg.createSVGPoint();
    p.x = cx; p.y = cy;
    p = p.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }
  function zoomCenter(factor) {
    setView(zoomAt(baseVB, curVB, factor, curVB[0] + curVB[2] / 2, curVB[1] + curVB[3] / 2));
  }

  // 창 폭이 바뀌면 화면 기준 라벨 하한을 다시 계산한다.
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { setView(curVB); }, 150);
  });

  zoomBtns.inn.addEventListener('click', function () { zoomCenter(1.5); });
  zoomBtns.out.addEventListener('click', function () { zoomCenter(1 / 1.5); });
  zoomBtns.fit.addEventListener('click', function () { setView(baseVB); });

  // 휠: 그냥 스크롤은 페이지 스크롤로 남겨 두고, Ctrl/⌘ + 휠과 트랙패드
  // 핀치(브라우저가 ctrlKey 휠로 보낸다)만 확대로 쓴다 — 페이지를 내리다
  // 지도 위를 지나갈 때 스크롤이 갑자기 확대로 바뀌지 않도록.
  svg.addEventListener('wheel', function (evt) {
    if (!evt.ctrlKey && !evt.metaKey) return;
    evt.preventDefault();
    var d = Math.max(-50, Math.min(50, evt.deltaY));
    var p = toUser(evt.clientX, evt.clientY);
    setView(zoomAt(baseVB, curVB, Math.exp(-d * 0.01), p.x, p.y));
  }, { passive: false });

  // 빈 곳 더블클릭: 그 지점을 중심으로 확대(Shift면 축소).
  svg.addEventListener('dblclick', function (evt) {
    if (evt.target.closest('.map-node')) return;
    evt.preventDefault();
    var p = toUser(evt.clientX, evt.clientY);
    setView(zoomAt(baseVB, curVB, evt.shiftKey ? 1 / 1.6 : 1.6, p.x, p.y));
  });

  // 드래그 이동 + 두 손가락 핀치. 4px 넘게 움직이면 "끌기"로 보고 뒤따르는
  // click(노드 선택·강조 해제)을 삼킨다.
  var pointers = {};
  var drag = null;
  var swallowClick = false;
  function pointerList() { return Object.keys(pointers).map(function (k) { return pointers[k]; }); }

  svg.addEventListener('pointerdown', function (evt) {
    if (evt.pointerType === 'mouse' && evt.button !== 0) return;
    pointers[evt.pointerId] = { x: evt.clientX, y: evt.clientY };
    var ps = pointerList();
    if (ps.length === 1) {
      drag = { x: evt.clientX, y: evt.clientY, vb: curVB, moved: false, id: evt.pointerId };
    } else if (ps.length === 2) {
      var a = ps[0], b = ps[1];
      drag = {
        pinch: true, vb: curVB, moved: true,
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: toUser((a.x + b.x) / 2, (a.y + b.y) / 2),
      };
    }
  });
  svg.addEventListener('pointermove', function (evt) {
    if (!pointers[evt.pointerId] || !drag) return;
    pointers[evt.pointerId] = { x: evt.clientX, y: evt.clientY };
    var rect = svg.getBoundingClientRect();
    var unit = drag.vb[2] / rect.width; // 화면 1px = viewBox 몇 단위인가
    if (drag.pinch) {
      var ps = pointerList();
      if (ps.length < 2) return;
      var dist = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      setView(zoomAt(baseVB, drag.vb, dist / drag.dist, drag.mid.x, drag.mid.y));
      return;
    }
    var dx = evt.clientX - drag.x, dy = evt.clientY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      // 전체 맞춤 상태(배율 1)에서는 옮길 곳이 없으니 끌기를 시작하지 않는다
      // — 노드 클릭이 손떨림 때문에 무시되지 않게.
      if (zoomLevel(baseVB, curVB) <= 1.01) return;
      drag.moved = true;
      svg.classList.add('is-dragging');
      tip.hidden = true;
      try { svg.setPointerCapture(evt.pointerId); } catch (e) { /* 무시 */ }
    }
    setView(panBy(baseVB, drag.vb, -dx * unit, -dy * unit));
  });
  function endPointer(evt) {
    delete pointers[evt.pointerId];
    if (!drag) return;
    if (drag.moved) swallowClick = true;
    if (pointerList().length === 0) {
      drag = null;
      svg.classList.remove('is-dragging');
    } else if (drag.pinch) {
      // 핀치 중 한 손가락을 떼면 남은 손가락으로 이어서 끌 수 있게 다시 잡는다.
      var p = pointerList()[0];
      drag = { x: p.x, y: p.y, vb: curVB, moved: true };
    }
  }
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  // 캡처 단계에서 끌기 직후의 click을 막는다(노드 <a>의 이동·선택보다 먼저).
  svg.addEventListener('click', function (evt) {
    if (!swallowClick) return;
    swallowClick = false;
    evt.preventDefault();
    evt.stopPropagation();
  }, true);

  // 지도 영역에 포커스가 있을 때 + / - / 0 키
  document.querySelector('.map-wrap').addEventListener('keydown', function (evt) {
    if (evt.target.closest('input, textarea, select')) return;
    if (evt.key === '+' || evt.key === '=') { zoomCenter(1.5); evt.preventDefault(); }
    else if (evt.key === '-' || evt.key === '_') { zoomCenter(1 / 1.5); evt.preventDefault(); }
    else if (evt.key === '0') { setView(baseVB); evt.preventDefault(); }
  });

  /** 선택한 개념과 바로 이웃한 개념·연결만 남기고 나머지를 흐리게 한다. */
  function focusNode(id, reveal) {
    var n = view.byId[id];
    if (!n) return;
    // 패널 목록에서 고른 이웃이 확대된 화면 밖에 있으면 그 개념이 가운데 오게 옮긴다.
    if (reveal) {
      var v = curVB, m = v[2] * 0.08;
      if (n.x < v[0] + m || n.x > v[0] + v[2] - m || n.y < v[1] + m || n.y > v[1] + v[3] - m) {
        setView(centerOn(baseVB, curVB, n.x, n.y));
      }
    }
    selected = id;
    tip.hidden = true;

    var near = {};
    view.links.forEach(function (l) {
      if (l.s.id === id) near[l.t.id] = l.cross;
      else if (l.t.id === id) near[l.s.id] = l.cross;
    });
    Object.keys(view.nodeEls).forEach(function (k) {
      [view.nodeEls[k], view.labelEls[k]].forEach(function (e) {
        e.classList.toggle('is-focus', k === id);
        e.classList.toggle('is-near', k in near);
      });
    });
    view.edgeEls.forEach(function (e) {
      e.el.classList.toggle('is-near', e.s === id || e.t === id);
    });
    svg.classList.add('has-focus');

    // 패널: 주차 간 이웃(비교형 문제 자리)을 먼저, 그다음 같은 주차 이웃.
    var neighbors = Object.keys(near).map(function (k) { return view.byId[k]; });
    neighbors.sort(function (a, b) {
      return (near[b.id] - near[a.id]) || (b.degree - a.degree);
    });
    panel.innerHTML =
      '<button type="button" class="map-focus-close" aria-label="강조 해제">×</button>' +
      '<p class="map-focus-week"><i style="background:' + weekVar(n.week) + '"></i>' + escapeHtml(n.week) + '</p>' +
      '<h3>' + escapeHtml(n.title) + '</h3>' +
      (n.en ? '<p class="map-focus-en">' + escapeHtml(n.en) + '</p>' : '') +
      (n.oneLine ? '<p class="map-focus-one">' + escapeHtml(n.oneLine) + '</p>' : '') +
      '<p class="map-focus-sub">연결된 개념 ' + neighbors.length + '개' +
      (neighbors.some(function (m) { return near[m.id]; }) ? ' · <span class="is-cross">주차 간</span> 먼저' : '') +
      '</p>' +
      '<ul class="map-focus-list">' + neighbors.map(function (m) {
        return '<li><button type="button" data-id="' + escapeHtml(m.id) + '"' +
          (near[m.id] ? ' class="is-cross"' : '') + '>' +
          '<i style="background:' + weekVar(m.week) + '"></i>' + escapeHtml(m.title) +
          '</button></li>';
      }).join('') + '</ul>' +
      '<a class="map-focus-go" href="' + escapeHtml(n.href) + '">개념 페이지 열기 →</a>';
    panel.hidden = false;
  }

  function clearFocus() {
    selected = null;
    svg.classList.remove('has-focus');
    Object.keys(view.nodeEls).forEach(function (k) {
      view.nodeEls[k].classList.remove('is-focus', 'is-near');
      view.labelEls[k].classList.remove('is-focus', 'is-near');
    });
    view.edgeEls.forEach(function (e) { e.el.classList.remove('is-near'); });
    panel.hidden = true;
    panel.innerHTML = '';
  }

  panel.addEventListener('click', function (evt) {
    var btn = evt.target.closest('button');
    if (!btn) return;
    if (btn.classList.contains('map-focus-close')) { clearFocus(); return; }
    if (btn.dataset.id) focusNode(btn.dataset.id, true);
  });
  // 노드가 아닌 빈 곳을 누르면 강조를 푼다.
  svg.addEventListener('click', function (evt) {
    if (!evt.target.closest('.map-node')) clearFocus();
  });
  document.addEventListener('keydown', function (evt) {
    if (evt.key === 'Escape' && selected) clearFocus();
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  [weekSel, tagSel, crossOnly, qNear].forEach(function (e) {
    e.addEventListener('change', draw);
  });
  // 타이핑마다 다시 배치하면 그림이 계속 출렁이므로 입력이 잠깐 멈췄을 때만 그린다.
  var qTimer = null;
  qInput.addEventListener('input', function () {
    clearTimeout(qTimer);
    qTimer = setTimeout(draw, 200);
  });
  qInput.addEventListener('keydown', function (evt) {
    // Esc는 강조 해제(document 핸들러)보다 먼저 키워드부터 지운다.
    if (evt.key === 'Escape' && qInput.value) {
      evt.stopPropagation();
      qInput.value = '';
      draw();
    }
  });
  relayout.addEventListener('click', function () {
    currentSeed = (currentSeed * 2654435761 + 1) >>> 0;
    draw();
  });

  /* URL 파라미터: map.html?tag=lock-in, map.html?q=고착 */
  var params = new URLSearchParams(location.search);
  if (params.get('q')) qInput.value = params.get('q');
  if (params.get('tag')) {
    var t = params.get('tag');
    if ([].some.call(tagSel.options, function (o) { return o.value === t; })) tagSel.value = t;
  }
  if (params.get('week')) {
    var wkParam = params.get('week');
    if ([].some.call(weekSel.options, function (o) { return o.value === wkParam; })) weekSel.value = wkParam;
  }

  draw();
})();
