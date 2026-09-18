import { conceptHref } from './links.mjs';

/**
 * 검색 본문에서 제외할 섹션.
 * - mynotes("나의 이해"): 개인 메모라 검색 대상이 아니다.
 * - quiz("예상 퀴즈 포인트"): 평가용 콘텐츠라 답을 검색으로 미리 찾게 하지 않는다.
 */
const SKIP_IN_BODY = new Set(['mynotes', 'quiz']);

/** 섹션의 렌더된 plain text. render.mjs가 채우는 `.plain`을 쓰고,
 *  (테스트 등에서) 없으면 원본 md로 떨어진다. */
function plainOf(section) {
  return section?.plain ?? section?.md ?? '';
}

export function buildSearchIndex(concepts, weeks) {
  const topicOf = new Map(weeks.map((w) => [w.id, w.topic]));

  const docs = concepts.map((c) => {
    const definitionSection = c.sections.find((s) => s.key === 'definition');
    const oneLine = plainOf(definitionSection);

    const body = c.sections
      .filter((s) => !SKIP_IN_BODY.has(s.key))
      .map(plainOf)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 저자명(Callon, Jensen, Polanyi …)은 본문 어디에도 등장하지 않고
    // readings frontmatter의 서지 정보("Callon (1994) Is Science a Public
    // Good? ★Core Reading")에만 등장하는 경우가 많다. 학생이 저자명으로
    // 검색할 때 그 개념을 찾으려면 이 정보가 검색 대상이어야 한다 — 그래서
    // Doc에 refs 필드를 따로 둔다(브리프의 5필드 body/oneLine만으로는
    // "Callon" 검색이 아예 히트하지 않는 경우가 실제 데이터에 있었다).
    const refs = (c.readings ?? []).join(' ');

    return {
      id: `${c.week}/${c.slug}`,
      week: c.week,
      weekTopic: topicOf.get(c.week) ?? '',
      no: c.no,
      href: conceptHref(c.week, c.no),
      title: c.title,
      en: c.en,
      tags: c.tags ?? [],
      oneLine,
      body,
      refs,
    };
  });

  return { builtAt: new Date().toISOString(), docs };
}

export function estimateSize(index) {
  return Buffer.byteLength(JSON.stringify(index), 'utf8');
}

/** 인덱스가 너무 커지면 본문을 잘라 용량을 방어한다. PRD §6.5. */
export function trimIfLarge(index, limitBytes = 1_500_000, perDocChars = 3000) {
  if (estimateSize(index) <= limitBytes) return { index, trimmed: false };
  for (const doc of index.docs) {
    if (doc.body.length > perDocChars) doc.body = doc.body.slice(0, perDocChars);
  }
  return { index, trimmed: true };
}
