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

test('과목 개념정리: extraLinks·private url 로컬 경로 존재', () => {
  allCourses.forEach(c => {
    (c.notes.extraLinks || []).forEach(l => assert.ok(fs.existsSync(path.join(SITE, l.url)), c.code + ' → ' + l.url));
    if (c.notes.status === 'private' && c.notes.url)
      assert.ok(fs.existsSync(path.join(SITE, c.notes.url, 'index.html')), c.code + ' → ' + c.notes.url);
  });
  assert.equal(allCourses.find(c => c.code === 'ITM60034').notes.extraLinks.length, 2);
  assert.equal(allCourses.find(c => c.code === 'ITM89912').notes.url, 'projects/genai-paper/');
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

test('프로젝트: 종류·과목·상태 유효', () => {
  const cats = ITM.projectCategories.map(c => c.id);
  assert.deepEqual([...cats], ['research', 'analysis', 'study']);
  const codes = new Set(allCourses.map(c => c.code));
  ITM.projects.forEach(p => {
    assert.ok(cats.includes(p.category), p.title);
    assert.ok(Array.isArray(p.courses), p.title);
    if (p.courses.length === 0) assert.ok(p.activity, p.title + ': 과목이 없으면 activity 필요');
    p.courses.forEach(c => assert.ok(codes.has(c), p.title + ' → ' + c));
    assert.ok(['live', 'wip', 'private'].includes(p.status), p.title);
    if (p.status === 'live') assert.ok(p.url, p.title);
    if (p.status === 'private') assert.ok(p.label, p.title);
    if (p.badge !== undefined) assert.ok(typeof p.badge === 'string' && p.badge, p.title + ' badge');
    (p.extraLinks || []).forEach(l => {
      assert.ok(l.label && l.url, p.title + ' extraLinks');
      assert.ok(fs.existsSync(path.join(SITE, l.url)), p.title + ' → 없음: ' + l.url);
    });
  });
});

test('프로젝트 v3: 혁신생태계론 지도·퀴즈는 개념정리 카드의 보조 버튼, 상세 페이지 연결', () => {
  const titles = ITM.projects.map(p => p.title);
  assert.ok(!titles.some(t => /개념 지도|퀴즈 셀프테스트/.test(t)), '지도·퀴즈 별도 카드 없음');
  const ie = ITM.projects.find(p => p.url === 'notes/innovation_ecosystem/');
  assert.deepEqual([...ie.extraLinks.map(l => l.url)], ['notes/innovation_ecosystem/map.html', 'notes/innovation_ecosystem/quiz.html']);
  const cpu = ITM.projects.find(p => p.activity && /2026/.test(p.activity));
  assert.ok(cpu && cpu.status === 'live' && cpu.url === 'projects/cpu-2026-ai-distillation/', 'CPU 상세');
  const paper = ITM.projects.find(p => p.courses.includes('ITM89912'));
  assert.equal(paper.url, 'projects/genai-paper/');
  assert.match(paper.badge, /Under Review/);
  const atlas = ITM.projects.find(p => p.url === 'projects/korea-genai-research-atlas/');
  assert.ok(atlas && atlas.status === 'live' && atlas.category === 'analysis', 'W03 과제2 연결');
});

test('프로필: About 페이지 데이터', () => {
  const P = ITM.profile;
  assert.ok(P.tagline, 'tagline');
  assert.ok(P.facts.length >= 3, 'facts');
  assert.ok(Array.isArray(P.interests), 'interests (비어 있어도 됨)');
  P.interests.forEach(i => assert.ok(i.title && i.desc, 'interest title/desc'));
  assert.ok(P.timeline.length >= 3, 'timeline');
  P.timeline.forEach(t => assert.ok(['career', 'education'].includes(t.kind), t.org));
  ['patents', 'awards', 'certifications', 'publications'].forEach(k => {
    assert.ok(Array.isArray(P.credentials[k]), k);
    P.credentials[k].forEach(c => {
      assert.ok(c.title, k + ' title');
      assert.match(c.year, /^(\d{4}(\.\d{2})?)?$/, k + ' year: ' + c.title);
    });
  });
  assert.ok(P.credentials.publications.every(c => c.venue), '논문은 학회(venue) 필요');
  assert.ok(P.journey.length >= 4, 'journey 오버뷰');
  P.journey.forEach(j => assert.ok(j.title && j.desc, 'journey title/desc'));
  assert.ok(typeof ITM.workflowIntro === 'string' && ITM.workflowIntro.length > 0, 'workflowIntro');
  assert.ok(!P.summary.some(s => s.includes('AI와 토론')), '워크플로 문장은 workflowIntro로 이동');
  assert.ok(!JSON.stringify(P).includes('충남대'), '학사 대학교 이름 제외');
  if (P.photo) assert.ok(fs.existsSync(path.join(SITE, P.photo)), '사진 없음: ' + P.photo);
});

const PAGES = {
  'index.html': ['now-list', 'courses-body', 'timeline-filters', 'timeline-body',
    'project-cat-filters', 'project-course-filters', 'projects-grid', 'projects-count', 'about-card'],
  'about.html': ['about-hero', 'interests-grid', 'journey', 'career-list', 'workflow-intro', 'cred-grid', 'itm-projects', 'workflow', 'contact-links']
};
for (const [page, ids] of Object.entries(PAGES)) {
  test(page + ': 로컬 src/href 존재, noindex, 컨테이너', () => {
    const file = path.join(SITE, page);
    assert.ok(fs.existsSync(file), page + ' 없음');
    const html = fs.readFileSync(file, 'utf8');
    assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
    ids.forEach(id => assert.ok(html.includes('id="' + id + '"'), page + ' #' + id));
    [...html.matchAll(/(?:src|href)="([^"#?]+)/g)].map(m => m[1])
      .filter(u => !/^(https?:|mailto:)/.test(u))
      .forEach(u => {
        const t = path.join(SITE, u.endsWith('/') ? u + 'index.html' : u);
        assert.ok(fs.existsSync(t), page + ' → 없음: ' + u);
      });
  });
}
