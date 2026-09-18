import path from 'node:path';

const WEEK = String.raw`W\d{2}(?:-\d)?`;
const RELATED_RE = new RegExp(`^(${WEEK})\\/(\\d{1,2})$`);
const CONCEPT_FILE_RE = new RegExp(`^(${WEEK})\\/(\\d{2})-.*\\.md$`);
const IMAGE_RE = new RegExp(`(?:수업노트\\/assets|개념정리\\/assets|(?<=\\.\\.\\/)assets)\\/(${WEEK})\\/([^\\/]+)\\.(?:png|jpe?g)$`);
const EXTERNAL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export function conceptHref(week, no) {
  return `${week}.html#c${String(no).padStart(2, '0')}`;
}

export function parseRelatedRef(ref) {
  const m = RELATED_RE.exec(String(ref).trim());
  return m ? { week: m[1], no: Number(m[2]) } : null;
}

/**
 * md 상대 링크를 사이트 URL로 바꾼다.
 * @param {string} href 원본 href
 * @param {string} fromWeek 이 링크가 들어 있는 파일의 주차 폴더명 (예: 'W01')
 */
export function rewriteMdLink(href, fromWeek) {
  const raw = String(href).trim();
  if (!raw) return { href: raw, ok: true };
  if (EXTERNAL_RE.test(raw) || raw.startsWith('#')) return { href: raw, ok: true };
  if (!raw.includes('.md')) return { href: raw, ok: false };

  const withoutAnchor = raw.split('#')[0];
  const resolved = path.posix.normalize(path.posix.join(fromWeek, withoutAnchor));
  const m = CONCEPT_FILE_RE.exec(resolved);
  if (!m) return { href: raw, ok: false };

  return { href: conceptHref(m[1], Number(m[2])), ok: true };
}

/** 슬라이드·자체제작 이미지 경로를 출력 경로로 바꾼다. */
export function rewriteImagePath(href) {
  const raw = String(href).trim();
  if (EXTERNAL_RE.test(raw)) return { href: raw, ok: false };
  const m = IMAGE_RE.exec(raw);
  if (!m) return { href: raw, ok: false };
  const [, week, name] = m;
  return { href: `images/${week}/${name}.jpg`, ok: true, week, name };
}
