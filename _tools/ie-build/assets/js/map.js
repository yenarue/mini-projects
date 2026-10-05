import {
  layoutGraph, labelText, matchesKeyword, zoomAt, panBy, centerOn, zoomLevel, ZOOM_MIN, ZOOM_MAX,
} from './map-layout.mjs';

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
