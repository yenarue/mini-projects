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
