const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const L = require(path.join(__dirname, '../../../study/kaist_itm/js/lib.js'));

const d = L.parseDate;

test('parseDate: 로컬 자정', () => {
  const x = d('2026-10-01');
  assert.equal(x.getFullYear(), 2026);
  assert.equal(x.getMonth(), 9);
  assert.equal(x.getDate(), 1);
  assert.equal(x.getHours(), 0);
});

test('daysBetween: 정수 일수', () => {
  assert.equal(L.daysBetween(d('2026-09-29'), d('2026-10-01')), 2);
  assert.equal(L.daysBetween(d('2026-10-01'), d('2026-09-29')), -2);
  assert.equal(L.daysBetween(new Date(2026, 8, 29, 23, 30), d('2026-09-30')), 1);
});

test('weekOf: 2026-08-31 시작', () => {
  assert.equal(L.weekOf('2026-08-31', d('2026-08-30')), 0);
  assert.equal(L.weekOf('2026-08-31', d('2026-08-31')), 1);
  assert.equal(L.weekOf('2026-08-31', d('2026-09-06')), 1);
  assert.equal(L.weekOf('2026-08-31', d('2026-09-29')), 5);
  assert.equal(L.weekOf('2026-08-31', d('2026-12-19')), 16);
});

test('ddayLabel', () => {
  assert.equal(L.ddayLabel(0), 'D-DAY');
  assert.equal(L.ddayLabel(2), 'D-2');
  assert.equal(L.ddayLabel(-3), 'D+3');
});

const EV = [
  { date: '2026-09-19', course: 'ITM60034', type: 'exam', title: 'Quiz 1' },
  { date: '2026-10-01', course: 'ITM69000', type: 'presentation', title: '발표 (1)' },
  { date: '2026-10-01', course: 'ITM69000', type: 'class', title: '수업' },
  { date: '2026-10-09', course: 'ITM60062', type: 'assignment', title: '과제2' },
  { date: '2026-10-17', course: 'ITM60034', type: 'exam', title: 'Quiz 2' },
  { date: '2026-10-24', course: 'ITM50023', type: 'assignment', title: '중간리포트' },
  { date: '2026-09-26', course: 'ITM60062', type: 'holiday', title: '추석' }
];

test('upcomingDeadlines: 마감형만, 오늘 포함, 날짜순, n개', () => {
  const r = L.upcomingDeadlines(EV, d('2026-09-29'), 3);
  assert.deepEqual(r.map(e => e.title), ['발표 (1)', '과제2', 'Quiz 2']);
  const today = L.upcomingDeadlines(EV, d('2026-10-01'), 1);
  assert.equal(today[0].title, '발표 (1)');
  assert.equal(L.upcomingDeadlines(EV, d('2027-01-01')).length, 0);
});

test('resolveNotes: 3상태 + live 빈 url은 planned', () => {
  assert.deepEqual(L.resolveNotes({ status: 'live', url: 'notes/a/' }),
    { state: 'live', url: 'notes/a/', label: '개념정리 →' });
  assert.deepEqual(L.resolveNotes({ status: 'planned' }),
    { state: 'planned', url: null, label: '개념정리 · 준비 중' });
  assert.deepEqual(L.resolveNotes({ status: 'planned', eta: '10월' }),
    { state: 'planned', url: null, label: '개념정리 · 10월 예정' });
  assert.deepEqual(L.resolveNotes({ status: 'private', label: '해외 저널 리뷰 중' }),
    { state: 'private', url: null, label: '해외 저널 리뷰 중' });
  assert.equal(L.resolveNotes({ status: 'live', url: '' }).state, 'planned');
  assert.equal(L.resolveNotes(undefined).state, 'planned');
});

test('termProgress: private 제외', () => {
  const cs = [
    { notes: { status: 'live', url: 'x/' } },
    { notes: { status: 'planned' } },
    { notes: { status: 'private', label: 'p' } }
  ];
  assert.deepEqual(L.termProgress(cs), { done: 1, total: 2 });
});

test('groupByWeek: 주차 오름차순, 주 내 날짜순', () => {
  const g = L.groupByWeek(EV, '2026-08-31');
  assert.deepEqual(g.map(w => w.week), [3, 4, 5, 6, 7, 8]);
  const w5 = g.find(w => w.week === 5);
  assert.equal(w5.events.length, 2);
});

const PJ = [
  { title: 'A', category: 'study', courses: ['ITM60034'] },
  { title: 'B', category: 'analysis', courses: ['ITM69000'] },
  { title: 'C', category: 'research', courses: ['ITM89912', 'ITM69000'] },
  { title: 'D', category: 'analysis', courses: [], activity: '캠퍼스 특허 유니버시아드' }
];
const CATS = [
  { id: 'research', label: '연구' }, { id: 'analysis', label: '분석' }, { id: 'study', label: '학습' }
];

test('filterProjects: 종류 AND 과목(하나라도)', () => {
  const all = {
    categories: { research: true, analysis: true, study: true },
    courses: { ITM60034: true, ITM69000: true, ITM89912: true, _extra: true }
  };
  assert.deepEqual(L.filterProjects(PJ, all).map(p => p.title), ['A', 'B', 'C', 'D']);
  assert.deepEqual(L.filterProjects(PJ, { categories: { research: true }, courses: all.courses }).map(p => p.title), ['C']);
  assert.deepEqual(L.filterProjects(PJ, { categories: all.categories, courses: { ITM69000: true } }).map(p => p.title), ['B', 'C']);
  assert.deepEqual(L.filterProjects(PJ, { categories: all.categories, courses: { _extra: true } }).map(p => p.title), ['D']);
  assert.deepEqual(L.filterProjects(PJ, { categories: all.categories, courses: {} }), []);
});

test('usedCourseCodes: 등장 순서, 중복 제거, 과목 외는 마지막 _extra', () => {
  assert.equal(L.EXTRA_KEY, '_extra');
  assert.deepEqual(L.usedCourseCodes(PJ), ['ITM60034', 'ITM69000', 'ITM89912', '_extra']);
  assert.deepEqual(L.usedCourseCodes(PJ.slice(0, 3)), ['ITM60034', 'ITM69000', 'ITM89912']);
});

test('groupByCategory: 정의 순서, 빈 종류 제외', () => {
  const g = L.groupByCategory(PJ.slice(0, 2), CATS);
  assert.deepEqual(g.map(x => x.category.id), ['analysis', 'study']);
  assert.equal(g[0].items[0].title, 'B');
});

test('sortByYearDesc: 최신 연도 먼저, 빈 연도는 뒤, 같은 연도는 원래 순서', () => {
  const items = [
    { title: 'a', year: '2013' }, { title: 'b', year: '' }, { title: 'c', year: '2020' },
    { title: 'd', year: '2013' }, { title: 'e', year: '2016.05' }
  ];
  assert.deepEqual(L.sortByYearDesc(items).map(i => i.title), ['c', 'e', 'a', 'd', 'b']);
  assert.equal(items[0].title, 'a', '원본은 바꾸지 않는다');
});

test('resolveNotes: private에 url이 있으면 공개 개요 링크', () => {
  assert.deepEqual(L.resolveNotes({ status: 'private', label: '해외 저널 리뷰 중', url: 'projects/x/', urlLabel: '공개 개요 보기' }),
    { state: 'private', url: 'projects/x/', label: '해외 저널 리뷰 중', urlLabel: '공개 개요 보기' });
  assert.equal(L.resolveNotes({ status: 'private', label: 'p' }).url, null);
});
