import { esc } from './components.mjs';

export function layout({ title, description = '', bodyClass = '', head = '', body, scripts = [], hasWeeknav = false }) {
  // scripts의 각 항목은 보통 클래식 defer 스크립트를 가리키는 경로 문자열이지만,
  // { src, type: 'module' } 형태를 주면 ES 모듈로 로드한다(모듈은 스펙상 이미
  // defer 동작이라 defer 속성을 따로 붙이지 않는다). quiz.js가 이 방식으로
  // quiz-logic.mjs를 import한다.
  const scriptTags = scripts.map((s) => {
    if (typeof s === 'object' && s !== null) {
      return `<script type="${esc(s.type)}" src="${esc(s.src)}"></script>`;
    }
    return `<script src="${s}" defer></script>`;
  }).join('\n  ');
  // weeknav(주차 서브메뉴)가 있는 페이지(week.mjs)만 헤더가 두 줄이다. 그 두
  // 줄 높이를 --header-h로 반영해야 스크롤 앵커·사이드바 sticky 오프셋이
  // 맞는다(assets/styles.css `:root[data-header="two"]`). <html> 자체에
  // 붙이는 이유는 --header-h를 쓰는 곳 중 `html { scroll-padding-top }`처럼
  // body보다 위 레벨(=:root)에서 읽는 규칙이 있어서다 — body class로는
  // 거기까지 내려오지 않는다.
  return `<!DOCTYPE html>
<html lang="ko"${hasWeeknav ? ' data-header="two"' : ''}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,nofollow">
  <meta name="description" content="${esc(description)}">
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
  <link rel="stylesheet" href="styles.css">
  <script>
    // 테마·글자크기를 body가 그려지기 전에 <html>에 붙인다("no-flash").
    // localStorage에 저장된 값이 없으면 OS 다크모드 설정을 1회 참고한다.
    (function () {
      try {
        var root = document.documentElement;
        var theme = localStorage.getItem('ie-theme');
        var dark = theme ? theme === 'dark'
          : window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', dark ? 'dark' : 'light');

        var fontsize = localStorage.getItem('ie-fontsize') || 'md';
        if (fontsize !== 'sm' && fontsize !== 'md' && fontsize !== 'lg') fontsize = 'md';
        root.setAttribute('data-fontsize', fontsize);
      } catch (e) {}
    })();
  </script>
  ${head}
</head>
<body class="${bodyClass}">
${body}
  ${scriptTags}
</body>
</html>`;
}
