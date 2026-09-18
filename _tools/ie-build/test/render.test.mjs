import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, toPlainText, extractListItems, slugifyHeading } from '../lib/render.mjs';
import { Warnings } from '../build.mjs';

const ctx = () => ({ week: 'W01', slug: 'c05', warnings: new Warnings(), label: 'W01/c05' });

test('md 링크를 주차 앵커로 바꾼다', () => {
  const html = renderMarkdown('[다른 개념](02-어떤-개념.md)을 보라', ctx());
  assert.match(html, /href="W01\.html#c02"/);
});

test('수업노트 링크는 평문으로 남기고 경고한다', () => {
  const c = ctx();
  const html = renderMarkdown('[기록](../../수업노트/W01_강의기록_260905.md)', c);
  assert.ok(!html.includes('<a '), '링크 태그가 남으면 안 된다');
  assert.match(html, /기록/);
  assert.equal(c.warnings.count, 1);
});

test('이미지를 figure로 감싸고 경로를 바꾼다', () => {
  const html = renderMarkdown('![W01 p10 세 가지 고착](../../수업노트/assets/W01/p10.png)', ctx());
  assert.match(html, /<figure class="slide">/);
  assert.match(html, /src="images\/W01\/p10\.jpg"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /<figcaption>W01 p10 세 가지 고착<\/figcaption>/);
});

test('h3/h4에 개념 슬러그 기반 id를 붙인다', () => {
  const html = renderMarkdown('### 1) 조직 고착 (Johnson 2010)', ctx());
  assert.match(html, /<h3 id="c05-h-[^"]+"/);
});

test('slugifyHeading은 한글을 보존하고 공백을 하이픈으로', () => {
  assert.equal(slugifyHeading('1) 조직 고착 (Johnson 2010)'), '1-조직-고착-johnson-2010');
  assert.equal(slugifyHeading('STI mode vs DUI mode'), 'sti-mode-vs-dui-mode');
});

test('toPlainText는 태그를 벗기고 공백을 정리한다', () => {
  assert.equal(toPlainText('<p>가나 <strong>다라</strong></p>\n<p>마바</p>'), '가나 다라 마바');
});

test('extractListItems는 ol 항목을 뽑는다', () => {
  const html = renderMarkdown('1. 첫 문제\n2. 비교형: 둘 문제', ctx());
  const items = extractListItems(html);
  assert.equal(items.length, 2);
  assert.match(items[0], /첫 문제/);
  assert.match(items[1], /비교형/);
});

test('코드블록 안의 링크는 건드리지 않는다', () => {
  const html = renderMarkdown('```\n[x](02-a.md)\n```', ctx());
  assert.ok(!html.includes('W01.html'));
});
