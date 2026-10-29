import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Warnings } from '../build.mjs';
import { collectTermPaper } from '../lib/termpaper.mjs';
import { renderTermPaperPage } from '../templates/termpaper.mjs';

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ie-tp-'));
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body);
  return dir;
}

test('파일명 순서대로 섹션을 만들고 ## 소제목을 h3 목차로 쓴다', () => {
  const dir = fixture({
    '02-본문.md': '# 본문\n\n## 서론\n\n내용',
    '01-과제안내.md': '---\ntitle: 과제 안내\nupdated: 2026-10-30\n---\n# 무시되는 제목\n\n## 일정\n\n표\n\n### 세부\n',
  });
  const s = collectTermPaper(dir, new Warnings());
  assert.deepEqual(s.map((x) => x.title), ['과제 안내', '본문']);
  assert.equal(s[0].slug, 'tp01');
  assert.equal(s[0].updated, '2026-10-30');
  assert.deepEqual(s[0].headings.map((h) => h.text), ['일정']);
  assert.match(s[0].html, /<h3 id="tp01-h-[^"]+">일정<\/h3>/);
  assert.match(s[0].html, /<h4 id="[^"]+">세부<\/h4>/);
  assert.doesNotMatch(s[0].html, /무시되는 제목/);
});

test('draft와 _ 파일은 싣지 않는다', () => {
  const dir = fixture({
    '01-a.md': '# A\n',
    '02-b.md': '---\ndraft: true\n---\n# B\n',
    '_memo.md': '# 메모\n',
  });
  assert.deepEqual(collectTermPaper(dir, new Warnings()).map((x) => x.title), ['A']);
});

test('폴더가 없으면 빈 목록, 페이지는 빈 상태로 그려진다', () => {
  assert.deepEqual(collectTermPaper('/definitely/not/here', new Warnings()), []);
  assert.deepEqual(collectTermPaper(null, new Warnings()), []);
  const html = renderTermPaperPage({ sections: [] });
  assert.match(html, /아직 올린 내용이 없습니다/);
  assert.match(html, /href="termpaper.html" class="active"/);
});

test('frames 블록은 계열별 카드로 바뀌고, 없는 개념 링크는 버튼 없이 경고만 남긴다', () => {
  const dir = fixture({
    '01-a.md': [
      '# A', '', '## 프레임', '',
      '```frames',
      '- group: 구조의 차이',
      '  name: NIS',
      '  status: done',
      '  when: W06 · 10/10',
      "  desc: '**전환(transition)**을 본다'",
      "  example: '한국 vs **라틴아메리카**'",
      '  links:',
      '    - { ref: W06/1, label: NIS 개요 }',
      '    - { ref: W09/1, label: 아직 없음 }',
      '- group: 구조의 변화',
      '  name: GIS',
      '  status: planned',
      '```', '',
    ].join('\n'),
  });
  const w = new Warnings();
  const [s] = collectTermPaper(dir, w, new Set(['W06/1']));
  assert.equal((s.html.match(/class="frame-group"/g) ?? []).length, 2);
  assert.match(s.html, /<article class="frame-card frame-done" id="frame-nis">/);
  assert.match(s.html, /<article class="frame-card frame-planned" id="frame-gis">/);
  assert.match(s.html, /<strong>전환\(transition\)<\/strong>을/);
  assert.match(s.html, /href="W06.html#c01">NIS 개요 →/);
  assert.match(s.html, /<p class="frame-example"><span class="frame-example-label">예시<\/span>한국 vs <strong>라틴아메리카<\/strong><\/p>/);
  assert.doesNotMatch(s.html, /아직 없음/);
  assert.ok(w.items.some((x) => x.scope === 'termpaper' && /W09\/1/.test(x.message)));
  assert.doesNotMatch(s.html, /```|tp-frames/);
});

test('[W06] 맥락을 단 교수 발언은 따옴표 장식 인용으로 렌더된다', () => {
  const dir = fixture({ '01-a.md': '# A\n\n> 🗣 [W06] "한 페이지면 돼."\n' });
  const [s] = collectTermPaper(dir, new Warnings());
  assert.match(s.html, /<blockquote class="quote-prof quote-bare"><p>한 페이지면 돼.<\/p><footer class="quote-cite">교수님 · W06<\/footer>/);
});

test('카드마다 frame- 앵커가 붙어 본문에서 [NIS](#frame-nis)로 링크할 수 있다', () => {
  const dir = fixture({
    '01-a.md': '# A\n\n[NIS](#frame-nis) · [BS](#frame-ssip-bs)\n\n```frames\n- name: NIS\n- name: SSIP · BS\n- name: 시민 인식론\n  id: civic-epistemology\n- name: X\n  id: custom\n```\n',
  });
  const [s] = collectTermPaper(dir, new Warnings());
  for (const id of ['frame-nis', 'frame-ssip-bs', 'frame-civic-epistemology', 'frame-custom']) {
    assert.match(s.html, new RegExp(`id="${id}"`));
  }
  assert.match(s.html, /<a href="#frame-nis">NIS<\/a>/);
});
