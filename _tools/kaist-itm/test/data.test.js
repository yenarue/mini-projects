const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SITE = path.join(__dirname, '../../../study/kaist_itm');
const L = require(path.join(SITE, 'js/lib.js'));

function loadData() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(SITE, 'data.js'), 'utf8'), ctx);
  return ctx.window.ITM;
}
const ITM = loadData();
const allCourses = ITM.terms.flatMap(t => t.courses);
const current = ITM.terms.find(t => t.current);

test('학기: current 정확히 1개, 시작일 형식', () => {
  assert.equal(ITM.terms.filter(t => t.current).length, 1);
  assert.equal(current.start, '2026-08-31');
  ITM.terms.forEach(t => assert.match(t.start, /^\d{4}-\d{2}-\d{2}$/));
});

test('과목: 코드 유일, notes 상태 유효, color 토큰', () => {
  const codes = allCourses.map(c => c.code);
  assert.equal(new Set(codes).size, codes.length);
  allCourses.forEach(c => {
    assert.ok(['live', 'planned', 'private'].includes(c.notes.status), c.code);
    assert.ok(['--brand', '--prof', '--slide', '--note', '--term'].includes(c.color), c.code);
  });
});

test('PRD 결정 반영: 생성형AI 논문 private, 나머지 비공개 없음', () => {
  const priv = allCourses.filter(c => c.notes.status === 'private').map(c => c.code);
  assert.deepEqual([...priv], ['ITM89912']); // vm 컨텍스트 배열이라 host 배열로 복사
  assert.equal(allCourses.find(c => c.code === 'ITM89912').notes.label, '해외 저널 리뷰 중');
  assert.equal(allCourses.find(c => c.code === 'CC.50011').notes.status, 'planned');
});

test('이벤트: 날짜·유형·과목 참조 유효, 이번 학기 과목만', () => {
  const cur = new Set(current.courses.map(c => c.code));
  const types = ['class', 'presentation', 'assignment', 'exam', 'holiday'];
  ITM.events.forEach(e => {
    assert.match(e.date, /^2026-\d{2}-\d{2}$/, e.title);
    assert.ok(!isNaN(L.parseDate(e.date)), e.title);
    assert.ok(types.includes(e.type), e.title);
    assert.ok(cur.has(e.course), e.course + ' ' + e.title);
  });
  cur.forEach(code => assert.ok(ITM.events.some(e => e.course === code), code + ' 이벤트 없음'));
});

test('이벤트: 모두 16주 안', () => {
  ITM.events.forEach(e => {
    const w = L.weekOf(current.start, L.parseDate(e.date));
    assert.ok(w >= 1 && w <= 16, e.date + ' ' + e.title + ' → W' + w);
  });
});

test('로컬 링크: live 개념정리·live 결과물 경로가 실제로 존재', () => {
  const local = [];
  allCourses.forEach(c => { if (c.notes.status === 'live') local.push(c.notes.url); });
  ITM.projects.forEach(p => { if (p.status === 'live' && !/^https?:/.test(p.url)) local.push(p.url); });
  ITM.workflow.forEach(w => { if (w.evidence && !/^https?:/.test(w.evidence.url)) local.push(w.evidence.url); });
  local.forEach(u => {
    const clean = u.split('#')[0];
    const target = path.join(SITE, clean.endsWith('/') ? clean + 'index.html' : clean);
    assert.ok(fs.existsSync(target), '없음: ' + u);
  });
});

test('결과물: 상태 유효, wip는 url 없어도 됨', () => {
  ITM.projects.forEach(p => {
    assert.ok(['live', 'wip'].includes(p.status), p.title);
    if (p.status === 'live') assert.ok(p.url, p.title);
  });
});

test('index.html: 로컬 src/href 모두 존재, noindex, 섹션 컨테이너', () => {
  const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
  ['now-list', 'courses-body', 'timeline-filters', 'timeline-body', 'projects-grid', 'about-body']
    .forEach(id => assert.ok(html.includes('id="' + id + '"'), id));
  const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1])
    .filter(u => !/^(https?:|mailto:)/.test(u));
  refs.forEach(u => {
    const t = path.join(SITE, u.endsWith('/') ? u + 'index.html' : u);
    assert.ok(fs.existsSync(t), '없음: ' + u);
  });
});
