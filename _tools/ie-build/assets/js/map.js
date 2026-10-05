import { layoutGraph, labelText, matchesKeyword } from './map-layout.mjs';

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
    svg.setAttribute('viewBox', out.viewBox.join(' '));
    // 그림이 커져 축소돼 보일 때도 라벨이 읽히는 크기를 유지한다(map-layout.mjs).
    svg.style.setProperty('--map-ls', String(out.labelScale));

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

    // 필터를 바꾸거나 다시 배치해도 선택한 개념이 아직 보이면 강조를 유지한다.
    if (selected && view.byId[selected]) focusNode(selected);
    else clearFocus();
  }

  /** 선택한 개념과 바로 이웃한 개념·연결만 남기고 나머지를 흐리게 한다. */
  function focusNode(id) {
    var n = view.byId[id];
    if (!n) return;
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
    if (btn.dataset.id) focusNode(btn.dataset.id);
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
