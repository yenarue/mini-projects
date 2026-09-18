(function () {
  'use strict';

  var raw = document.getElementById('map-data');
  if (!raw) return;
  var GRAPH = JSON.parse(raw.textContent);

  var svg = document.getElementById('map-svg');
  var tip = document.getElementById('map-tip');
  var emptyMsg = document.getElementById('map-empty');
  var legend = document.getElementById('map-legend');
  var weekSel = document.getElementById('map-week');
  var tagSel = document.getElementById('map-tag');
  var crossOnly = document.getElementById('map-cross-only');
  var relayout = document.getElementById('map-relayout');

  var W = 960, H = 680;
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

  /** 문자열을 32bit 정수로 접어 시드를 만든다 — 매 로드마다 같은 배치가 나오게. */
  function seedFrom(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function filtered() {
    var wk = weekSel.value, tg = tagSel.value;
    var nodes = GRAPH.nodes.filter(function (n) {
      if (wk !== 'all' && n.week !== wk) return false;
      if (tg !== 'all' && n.tags.indexOf(tg) < 0) return false;
      return true;
    });
    var ids = {};
    nodes.forEach(function (n) { ids[n.id] = true; });
    var edges = GRAPH.edges.filter(function (e) {
      if (!ids[e.source] || !ids[e.target]) return false;
      if (crossOnly.checked && !e.crossWeek) return false;
      return true;
    });
    return { nodes: nodes.map(function (n) { return Object.assign({}, n); }), edges: edges };
  }

  /**
   * Force 시뮬레이션 — Fruchterman-Reingold 방식의 "온도(temperature)" 감쇠를
   * 쓴다. 처음엔 속도-누적(velocity) 방식으로 짰었는데, 반발력이 조금만 세도
   * 두 노드가 서로를 튕겨내며 매 스텝 캔버스 전체를 왔다갔다 하는 진동이
   * 생겨서(감쇠가 발산을 못 이김) 25개 중 1~2쌍이 최종적으로 겹치는 문제가
   * 있었다. 온도 방식은 매 스텝의 "이동 거리 자체"에 상한을 걸고 그 상한을
   * 서서히 줄여서, 근접한 두 노드가 서로 지나쳐버리는 오버슈트를 원천적으로
   * 막는다 — 그래프 드로잉에서 흔히 쓰는 표준 기법이다.
   *
   *  1) week별로 초기 위치만 뭉치게 잡는다(클러스터 "시드") — 이후에는 지속적인
   *     클러스터 인력을 걸지 않는다. 지속적으로 걸면 반발력과 경계에 눌려
   *     여러 노드가 같은 벽에 나란히 붙는 것을 봤다(1차 시도). 대신 같은
   *     주차 개념끼리는 대개 related로도 이어져 있어서, 스프링 힘만으로도
   *     자연히 뭉친다.
   *  2) 반발력은 노드 반경(=degree 기반)을 고려해 큰 허브 주변을 더 넓게 비운다.
   *  3) 스프링 목표 거리는 주차 내부 연결(짧게)과 주차 간 연결(길게)을 다르게
   *     둬서, 주차 간 다리(=퀴즈 비교형 문제 자리)가 자연히 두 뭉치를 잇는
   *     형태로 보이게 한다.
   *  4) 시뮬레이션이 끝난 뒤 라벨 겹침을 별도로 한 번 더 풀어준다. 힘만으로는
   *     텍스트 폭까지 고려하지 못하기 때문이다.
   */
  function simulate(nodes, edges, seed) {
    var rng = mulberry32(seed);
    var byId = {};
    var clusterCenters = {};
    var wkCount = Math.max(1, WEEKS.length);

    WEEKS.forEach(function (w, i) {
      var a = (i / wkCount) * Math.PI * 2;
      var spread = wkCount > 1 ? Math.min(W, H) * 0.22 : 0;
      clusterCenters[w] = {
        x: W / 2 + Math.cos(a) * spread,
        y: H / 2 + Math.sin(a) * spread * (H / W),
      };
    });

    nodes.forEach(function (n) {
      var c = clusterCenters[n.week] || { x: W / 2, y: H / 2 };
      var a = rng() * Math.PI * 2;
      var r = 30 + rng() * 55;
      n.x = c.x + Math.cos(a) * r;
      n.y = c.y + Math.sin(a) * r;
      n.r = 7 + Math.min(n.degree, 8) * 1.7;
      byId[n.id] = n;
    });

    var links = edges.map(function (e) {
      return { s: byId[e.source], t: byId[e.target], cross: e.crossWeek };
    }).filter(function (l) { return l.s && l.t; });
    var idxOf = new Map(nodes.map(function (n, i) { return [n, i]; }));

    var iterations = 320;
    var temp0 = Math.min(W, H) * 0.055;

    for (var step = 0; step < iterations; step++) {
      // 온도: 처음엔 크게 움직이고 뒤로 갈수록 이동 거리 자체를 줄여 정착시킨다.
      var temp = temp0 * (1 - step / iterations) + 0.5;
      var dispX = new Array(nodes.length).fill(0);
      var dispY = new Array(nodes.length).fill(0);

      // 반발 — 모든 쌍. 노드가 크면(=허브) 밀어내는 힘도 커진다.
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i + 1; j < nodes.length; j++) {
          var a2 = nodes[i], b2 = nodes[j];
          var dx = a2.x - b2.x, dy = a2.y - b2.y;
          var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          var k = 16 + (a2.r + b2.r) * 1.1;
          var force = (k * k) / d;
          var ux = dx / d, uy = dy / d;
          dispX[i] += ux * force; dispY[i] += uy * force;
          dispX[j] -= ux * force; dispY[j] -= uy * force;
        }
      }
      // 스프링 — 주차 간 연결은 목표 거리를 더 길게 잡아 다리처럼 보이게 한다.
      links.forEach(function (l) {
        var si = idxOf.get(l.s), ti = idxOf.get(l.t);
        var dx = l.s.x - l.t.x, dy = l.s.y - l.t.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        var ideal = l.cross ? 190 : 90;
        var force = (d * d - ideal * ideal) / (d * 22);
        var ux = dx / d, uy = dy / d;
        dispX[si] -= ux * force; dispY[si] -= uy * force;
        dispX[ti] += ux * force; dispY[ti] += uy * force;
      });

      nodes.forEach(function (n, i) {
        // 단일 중심 인력만 쓴다 — week별 인력점을 지속시키지 않는 이유는
        // 위 주석 참고. 캔버스 밖으로 흩어지지 않게만 붙잡아 둔다.
        dispX[i] += (W / 2 - n.x) * 0.01;
        dispY[i] += (H / 2 - n.y) * 0.01;

        var mag = Math.hypot(dispX[i], dispY[i]) || 0.01;
        var capped = Math.min(mag, temp); // 오버슈트 방지의 핵심: 이동량 자체에 상한
        n.x += (dispX[i] / mag) * capped;
        n.y += (dispY[i] / mag) * capped;
        // 여백은 원 반경뿐 아니라 라벨(최대 13자, 아래쪽에 붙음)이 SVG viewBox
        // 밖으로 잘리지 않을 만큼 넉넉히 잡는다 — 원 반경만 봤을 때 노드가
        // 좌우 끝에 붙으면 가운데 정렬된 긴 라벨의 앞부분이 잘려 보였다.
        var marginX = Math.max(n.r + 12, 62);
        n.x = Math.max(marginX, Math.min(W - marginX, n.x));
        n.y = Math.max(n.r + 18, Math.min(H - n.r - 66, n.y));
      });
    }

    // 라벨 겹침 완화: 노드 위치는 그대로 두고 labelDy(라벨을 아래로 미는 거리)만
    // 조정한다. 두 종류의 충돌을 본다 — (a) 라벨 대 라벨, (b) 라벨 대 "자기
    // 것이 아닌" 다른 노드의 원. degree가 낮은 쪽(덜 중요한 노드)의 라벨을
    // 미는 것을 우선해, 허브 노드의 라벨은 되도록 자리를 지킨다.
    // 한글 라벨은 문자당 실제 렌더 폭이 로마자보다 넓다(글리프 실측 ~7.5px/글자,
    // 10.5px 폰트 기준) — 여유 있게 잡아야 라벨 겹침 완화 패스가 과소평가하지 않는다.
    var textW = function (n) { return Math.min(n.title.length, 13) * 7.6; };
    nodes.forEach(function (n) { n.labelDy = n.r + 12; });

    function labelBox(n) {
      var w = textW(n);
      return { x: n.x - w / 2, y: n.y + n.labelDy - 9, w: w, h: 12 };
    }
    function boxesOverlap(a, b) {
      return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
    }
    function boxOverlapsCircle(b, cx, cy, r) {
      var closestX = Math.max(b.x, Math.min(cx, b.x + b.w));
      var closestY = Math.max(b.y, Math.min(cy, b.y + b.h));
      var dx = cx - closestX, dy = cy - closestY;
      return (dx * dx + dy * dy) < r * r;
    }

    for (var pass = 0; pass < 6; pass++) {
      var moved = false;
      for (var x = 0; x < nodes.length; x++) {
        for (var y = x + 1; y < nodes.length; y++) {
          var na = nodes[x], nb = nodes[y];
          var lower = na.degree <= nb.degree ? na : nb; // 미는 대상: degree 낮은 쪽
          var labelVsLabel = boxesOverlap(labelBox(na), labelBox(nb));
          var aLabelHitsBCircle = boxOverlapsCircle(labelBox(na), nb.x, nb.y, nb.r);
          var bLabelHitsACircle = boxOverlapsCircle(labelBox(nb), na.x, na.y, na.r);
          if (labelVsLabel || aLabelHitsBCircle || bLabelHitsACircle) {
            lower.labelDy += 7;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }

    return links;
  }

  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, String(attrs[k])); });
    return e;
  }

  var currentSeed = 1;

  function draw() {
    var g = filtered();
    svg.innerHTML = '';

    if (!g.nodes.length) {
      emptyMsg.hidden = false;
      legend.textContent = '';
      return;
    }
    emptyMsg.hidden = true;

    var links = simulate(g.nodes, g.edges, currentSeed);

    var gEdges = el('g', { class: 'map-edges' });
    // 주차 간 연결을 나중에 그려서(=위에 겹쳐서) 항상 눈에 먼저 들어오게 한다.
    links.filter(function (l) { return !l.cross; }).concat(
      links.filter(function (l) { return l.cross; })
    ).forEach(function (l) {
      gEdges.appendChild(el('line', {
        class: l.cross ? 'map-edge map-edge-cross' : 'map-edge',
        x1: l.s.x, y1: l.s.y, x2: l.t.x, y2: l.t.y,
      }));
    });
    svg.appendChild(gEdges);

    var gNodes = el('g', { class: 'map-nodes' });
    g.nodes.forEach(function (n) {
      var a = el('a', { href: n.href, class: 'map-node' });

      var c = el('circle', {
        cx: n.x, cy: n.y, r: n.r,
        class: 'map-dot',
        style: 'fill:' + weekVar(n.week),
      });
      a.appendChild(c);

      var label = el('text', {
        x: n.x, y: n.y + n.labelDy, 'text-anchor': 'middle', class: 'map-label',
      });
      label.textContent = n.title.length > 13 ? n.title.slice(0, 12) + '…' : n.title;
      a.appendChild(label);

      function showTip(evt) {
        tip.hidden = false;
        tip.innerHTML = '<strong>' + escapeHtml(n.title) + '</strong><br>' +
          '<span class="map-tip-en">' + escapeHtml(n.en || '') + '</span><br>' +
          '<span class="map-tip-week">' + escapeHtml(n.week) + ' · 연결 ' + n.degree + '</span>' +
          (n.oneLine ? '<br><span class="map-tip-one">' + escapeHtml(n.oneLine) + '</span>' : '');
        positionTip(evt);
      }
      function positionTip(evt) {
        var box = svg.getBoundingClientRect();
        var left = (evt ? evt.clientX - box.left : n.x / W * box.width) + 14;
        var top = (evt ? evt.clientY - box.top : n.y / H * box.height) + 14;
        var maxLeft = box.width - 270;
        if (left > maxLeft) left = Math.max(4, left - 280);
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
      }

      a.addEventListener('mouseenter', showTip);
      a.addEventListener('mousemove', positionTip);
      a.addEventListener('mouseleave', function () { tip.hidden = true; });
      a.addEventListener('focus', showTip);
      a.addEventListener('blur', function () { tip.hidden = true; });

      gNodes.appendChild(a);
    });
    svg.appendChild(gNodes);

    legend.innerHTML = WEEKS.map(function (w) {
      return '<span class="map-legend-item"><i style="background:' + weekVar(w) + '"></i>' + escapeHtml(w) + '</span>';
    }).join('') +
      '<span class="map-legend-item"><i class="cross"></i>주차 간 연결</span>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  [weekSel, tagSel, crossOnly].forEach(function (e) {
    e.addEventListener('change', draw);
  });
  relayout.addEventListener('click', function () {
    currentSeed = (currentSeed * 2654435761 + 1) >>> 0;
    draw();
  });

  /* URL 파라미터: map.html?tag=lock-in */
  var params = new URLSearchParams(location.search);
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
