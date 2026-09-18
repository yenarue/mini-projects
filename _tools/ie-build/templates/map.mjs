import { esc, topbar, footer } from './components.mjs';
import { layout } from './layout.mjs';
import { conceptHref } from '../lib/links.mjs';

/**
 * 개념 지도(map.html)의 그래프 데이터.
 *
 * `related`는 build.mjs가 이미 해석해 둔 배열이다({week, no, href, title, resolved}) —
 * 대상 개념이 아직 없으면 resolved:false지만 배열에는 남아 있다. 여기서는 그
 * 대상이 `concepts` 안에 실제로 있는지(=현재 그래프에 노드가 있는지)만 다시
 * 확인한다. 없으면 조용히 제외한다 — related 파싱 경고는 build.mjs가 이미
 * 냈으므로 여기서 또 경고를 내면 같은 문제를 두 번 보여주는 것이 된다.
 */
export function buildGraph(concepts) {
  const ids = new Set(concepts.map((c) => `${c.week}/${c.slug}`));
  const degree = new Map();
  const seen = new Set();
  const edges = [];

  for (const c of concepts) {
    const from = `${c.week}/${c.slug}`;
    for (const r of c.related ?? []) {
      const to = `${r.week}/c${String(r.no).padStart(2, '0')}`;
      if (!ids.has(to) || to === from) continue;
      const key = [from, to].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: from, target: to, crossWeek: c.week !== r.week });
      degree.set(from, (degree.get(from) ?? 0) + 1);
      degree.set(to, (degree.get(to) ?? 0) + 1);
    }
  }

  const nodes = concepts.map((c) => ({
    id: `${c.week}/${c.slug}`,
    week: c.week,
    no: c.no,
    slug: c.slug,
    title: c.title,
    en: c.en,
    href: conceptHref(c.week, c.no),
    oneLine: (c.sections?.find((s) => s.key === 'definition')?.plain ?? '').slice(0, 140),
    tags: c.tags ?? [],
    degree: degree.get(`${c.week}/${c.slug}`) ?? 0,
  }));

  return { nodes, edges };
}

// "W01/05" 같은 표기만 잡는다 — 주차 두 자리, 슬래시, 개념 번호 두 자리.
const REF_RE = /(W\d{2}(?:-\d)?)\/(\d{2})/g;

/** 존재하는 개념만 링크로 바꾼다. 없는 개념은 표기를 그대로 평문으로 남긴다. */
function linkifyRefs(text, existing) {
  return esc(text).replace(REF_RE, (m, week, noStr) => {
    const no = Number(noStr);
    if (!existing.has(`${week}/${no}`)) return m;
    return `<a href="${conceptHref(week, no)}">${m}</a>`;
  });
}

function comparisonTable(cmp, existing) {
  const head = cmp.columns.map((c) => `<th>${linkifyRefs(c, existing)}</th>`).join('');
  const rows = cmp.rows.map((r) =>
    `<tr>${r.map((cell, i) =>
      i === 0
        ? `<th scope="row">${linkifyRefs(cell, existing)}</th>`
        : `<td>${linkifyRefs(cell, existing)}</td>`
    ).join('')}</tr>`
  ).join('');

  return `
<section class="cmp" id="${esc(cmp.id)}">
  <h3>${esc(cmp.id)} · ${esc(cmp.title)}</h3>
  ${cmp.note ? `<p class="cmp-note">${esc(cmp.note)}</p>` : ''}
  <div class="cmp-scroll">
    <table class="cmp-table">
      <thead><tr>${head}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</section>`;
}

export function renderMapPage({ graph, weeks, comparisons }) {
  const withConcepts = weeks.filter((w) => w.concepts.length);
  const allTags = [...new Set(graph.nodes.flatMap((n) => n.tags))].sort();
  // 비교표 셀의 "W##/NN" 표기 중 실제로 그래프에 있는 개념만 링크로 바꾼다.
  const existing = new Set(graph.nodes.map((n) => `${n.week}/${n.no}`));

  const crossCount = graph.edges.filter((e) => e.crossWeek).length;

  const data = JSON.stringify(graph).replace(/</g, '\\u003c');

  const body = `
${topbar({ active: 'map' })}
<main class="page-map-main">
  <p class="eyebrow">개념 연결</p>
  <h1>개념 지도</h1>
  <p class="lede">
    각 개념 파일의 <code>related</code>로 이은 그래프다. 개념 ${graph.nodes.length}개 ·
    연결 ${graph.edges.length}개 · 그중 주차를 넘는 연결 <strong>${crossCount}개</strong> —
    퀴즈의 비교형 문제가 나오는 자리라 굵고 진한 색으로 표시했다.
  </p>

  <div class="map-controls">
    <label class="ctrl">
      <span>주차</span>
      <select id="map-week">
        <option value="all">전체</option>
        ${withConcepts.map((w) => `<option value="${esc(w.id)}">${esc(w.id)} · ${esc(w.topic)}</option>`).join('')}
      </select>
    </label>
    <label class="ctrl">
      <span>태그</span>
      <select id="map-tag">
        <option value="all">전체</option>
        ${allTags.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
      </select>
    </label>
    <label class="ctrl ctrl-inline">
      <input type="checkbox" id="map-cross-only">
      <span>주차 간 연결만</span>
    </label>
    <button type="button" id="map-relayout" class="side-btn">다시 배치</button>
  </div>

  <div class="map-wrap">
    <svg id="map-svg" viewBox="0 0 960 680" role="img" aria-label="개념 관계 그래프"></svg>
    <div class="map-tip" id="map-tip" hidden></div>
    <p class="map-empty" id="map-empty" hidden>조건에 맞는 개념이 없다.</p>
  </div>
  <p class="map-legend" id="map-legend"></p>

  <h2 class="section-title">주차 간 비교표</h2>
  <p class="lede">퀴즈에 반드시 나오는 비교형 문제를 위한 정리다. 표의 <code>W##/NN</code> 표기는
    해당 개념이 있으면 링크로, 아직 작성되지 않은 개념이면 평문으로 남는다.</p>
  ${comparisons.length
    ? comparisons.map((c) => comparisonTable(c, existing)).join('')
    : '<p class="quiz-empty">아직 비교표가 없다.</p>'}

  ${footer()}
</main>
<script type="application/json" id="map-data">${data}</script>`;

  return layout({
    title: '개념 지도 — 혁신생태계론',
    description: '개념 간 연결 그래프와 주차 간 비교표',
    bodyClass: 'page-map',
    body,
    scripts: ['js/main.js', 'js/map.js'],
  });
}
