import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderConcept } from '../lib/render.mjs';
import { renderWeekPage } from '../templates/week.mjs';
import { Warnings } from '../build.mjs';

function makeConcept(overrides = {}) {
  const base = {
    week: 'W01',
    no: 5,
    slug: 'c05',
    file: '05-세-가지-고착.md',
    title: '세 가지 고착',
    en: 'Lock-in',
    subtitle: '',
    tags: ['lock-in', 'path-dependency'],
    slides: ['W01 p10'],
    status: 'draft',
    hasMyNotes: false,
    related: [
      { week: 'W01', no: 2, href: 'W01.html#c02', title: '기존 개념', resolved: true },
      { week: 'W02-2', no: 5, href: 'W02-2.html#c05', title: '', resolved: false },
    ],
    sections: [
      { key: 'definition', heading: '한 줄 정의', md: '이것은 **정의**다.' },
      { key: 'analogy', heading: '쉽게 말하면', md: '비유 설명.' },
      { key: 'core', heading: '핵심 내용', md: '핵심 본문.' },
      { key: 'discussion', heading: '수업에서 나온 논점', md: '논점 내용.' },
      { key: 'examples', heading: '보충 사례', md: '사례 내용.' },
      { key: 'position', heading: '수업 프레임에서의 위치', md: '위치 설명.' },
      { key: 'related', heading: '관련 개념 · 논문', md: '관련 설명.' },
      { key: 'quiz', heading: '예상 퀴즈 포인트', md: '1. 첫 문제\n2. 차이를 설명하라.' },
      { key: 'mynotes', heading: '나의 이해 / 질문', md: '' },
    ],
  };
  return { ...base, ...overrides };
}

function buildWeek(concepts, id = 'W01') {
  return {
    id,
    date: '2026-09-05',
    topic: 'Introduction: Innovation Ecosystem',
    subtitle: '혁신생태계론 출발점',
    source: 'W01_slides.pdf',
    concepts,
  };
}

function renderFixture({ concepts, weeks, activeId = 'W01' } = {}) {
  const warnings = new Warnings();
  const allConcepts = concepts ?? [makeConcept()];
  for (const c of allConcepts) renderConcept(c, warnings);
  const week = buildWeek(allConcepts, activeId);
  const allWeeks = weeks ?? [week];
  return renderWeekPage({ week, weeks: allWeeks });
}

test('noindex,nofollow 메타가 항상 있다', () => {
  const html = renderFixture();
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/);
});

test('Yena Kim 서명 푸터가 그대로 남아있다', () => {
  const html = renderFixture();
  assert.match(html, /Made by <strong>Yena Kim \(Yenarue\)<\/strong>/);
  assert.match(html, /mailto:yenarue@gmail\.com/);
  assert.match(html, /class="site-footer-icons"/);
});

test('개념 섹션에 슬러그 기반 앵커 id가 붙는다', () => {
  const html = renderFixture();
  assert.match(html, /<section class="concept" id="c05">/);
});

test('정의·비유·핵심·퀴즈는 펼쳐진 div로, 나머지 4개는 접힌 details로 렌더된다', () => {
  const html = renderFixture();
  assert.match(html, /<div class="sec sec-definition" id="c05-definition">/);
  assert.match(html, /<div class="sec sec-analogy" id="c05-analogy">/);
  assert.match(html, /<div class="sec sec-core" id="c05-core">/);
  assert.match(html, /<div class="sec sec-quiz" id="c05-quiz">/);

  const foldCount = (html.match(/<details class="sec sec-fold"/g) || []).length;
  assert.equal(foldCount, 4, '수업 논점·보충 사례·프레임에서의 위치·관련 개념 4개가 접혀야 한다');
  assert.match(html, /<summary>수업에서 나온 논점<\/summary>/);
  assert.match(html, /<summary>보충 사례<\/summary>/);
  assert.match(html, /<summary>수업 프레임에서의 위치<\/summary>/);
  assert.match(html, /<summary>관련 개념 · 논문<\/summary>/);
});

test('나의 이해가 비어있으면 mynotes 섹션이 렌더되지 않는다', () => {
  const html = renderFixture();
  assert.ok(!html.includes('sec-mynotes'), '빈 mynotes는 숨겨야 한다');
});

test('나의 이해에 내용이 있으면 mynotes 섹션이 렌더된다', () => {
  const withNotes = makeConcept({
    hasMyNotes: true,
    sections: makeConcept().sections.map((s) =>
      s.key === 'mynotes' ? { ...s, md: '내가 궁금한 점.' } : s
    ),
  });
  const html = renderFixture({ concepts: [withNotes] });
  assert.match(html, /<div class="sec sec-mynotes" id="c05-mynotes">/);
  assert.match(html, /내가 궁금한 점/);
});

test('resolved related는 링크로, 미작성 related는 평문으로 남는다', () => {
  const html = renderFixture();
  assert.match(html, /<a href="W01\.html#c02">기존 개념<\/a>/);
  assert.match(html, /<span class="related-pending"[^>]*>W02-2\/05<\/span>/);
});

test('이전/다음 주차 링크가 주차 순서를 따라 생성된다', () => {
  const w01 = buildWeek([makeConcept()], 'W01');
  const w02 = buildWeek([makeConcept({ week: 'W02-1', slug: 'c01', no: 1 })], 'W02-1');
  const warnings = new Warnings();
  for (const c of w01.concepts) renderConcept(c, warnings);
  for (const c of w02.concepts) renderConcept(c, warnings);

  const html = renderWeekPage({ week: w01, weeks: [w01, w02] });
  assert.ok(!html.includes('← W'), '첫 주차는 이전 링크가 없어야 한다');
  assert.match(html, /<a href="W02-1\.html">W02-1 →<\/a>/);

  const html2 = renderWeekPage({ week: w02, weeks: [w01, w02] });
  assert.match(html2, /<a href="W01\.html">← W01<\/a>/);
});

test('상태 배지가 status에 따라 달라진다', () => {
  const done = renderFixture({ concepts: [makeConcept({ status: 'done' })] });
  assert.match(done, /<span class="badge badge-done">완료<\/span>/);

  const draft = renderFixture({ concepts: [makeConcept({ status: 'draft' })] });
  assert.match(draft, /<span class="badge badge-draft">초안<\/span>/);
});

test('집중 모드 버튼은 마크업에 있지만 아직 아무 동작도 하지 않는다(R3 예약)', () => {
  const html = renderFixture();
  assert.match(html, /<button type="button" class="focus-btn" data-focus-target="c05"/);
  assert.match(html, />⤢<\/button>/);
});

test('사이드바에 개념 번호와 제목, 진행률이 렌더된다', () => {
  const html = renderFixture();
  assert.match(html, /<span class="side-no">05<\/span>/);
  assert.match(html, /<span class="side-title">세 가지 고착<\/span>/);
  assert.match(html, /개념 1개 · 완료 0개/);
});

/* ---------- 사이드바 하위 목차 · 중요도 · 핵심 배지 ---------- */

test('사이드바에 개념 내부 목차가 붙고, 본문 셋은 한 항목으로 묶인다', () => {
  const concept = makeConcept({
    sections: makeConcept().sections.map((s) => (
      s.key === 'core'
        ? { ...s, md: '### 1) 첫 소제목\n\n내용\n\n### 2) 둘째 소제목\n\n내용' }
        : s
    )),
  });
  const html = renderFixture({ concepts: [concept] });

  assert.match(html, /<ul class="side-sub">/);
  assert.match(html, /href="#c05-definition" class="side-sub-sec"[^>]*>정의 · 비유 · 핵심 내용</);
  assert.match(html, /href="#c05-h-1-첫-소제목" class="side-sub-h"[^>]*>1\) 첫 소제목</);
  assert.match(html, /href="#c05-h-2-둘째-소제목"/);
  // 접힌 섹션도 목차 항목이 된다(클릭하면 revealHash가 펼친다)
  assert.match(html, /href="#c05-discussion" class="side-sub-sec"/);
  // 묶인 셋은 각각의 항목으로 중복해 나오지 않는다
  assert.doesNotMatch(html, /href="#c05-analogy" class="side-sub-sec"/);
});

test('내용이 없는 나의 이해는 목차에도 본문에도 나오지 않는다', () => {
  const html = renderFixture(); // hasMyNotes: false
  assert.doesNotMatch(html, /href="#c05-mynotes"/);
});

test('중요도 별점과 근거가 개념 헤더에 붙는다', () => {
  const concept = makeConcept({ importance: { stars: 4, why: '비교형 단골' } });
  const html = renderFixture({ concepts: [concept] });
  assert.match(html, /<span class="stars" title="시험 중요도 4\/5 — 비교형 단골"/);
  assert.match(html, /<span class="stars-on" aria-hidden="true">★★★★<\/span>/);
  assert.match(html, /<span class="stars-off" aria-hidden="true">★<\/span>/);
});

test('중요도가 없으면 별점을 그리지 않는다', () => {
  const html = renderFixture();
  assert.doesNotMatch(html, /class="stars"/);
});

test('핵심개념으로 뽑힌 개념은 목차와 본문 양쪽에 핵심 배지가 붙는다', () => {
  const concept = makeConcept({
    coreRefs: [{ quiz: 1, n: 5, title: '고착과 경로의존성', href: 'core.html#q1-k5' }],
  });
  const html = renderFixture({ concepts: [concept] });
  assert.match(html, /<span class="side-core" title="쪽지시험 핵심 개념">핵심<\/span>/);
  assert.match(html, /<a class="badge badge-core" href="core\.html#q1-k5"[^>]*>핵심<\/a>/);
});
