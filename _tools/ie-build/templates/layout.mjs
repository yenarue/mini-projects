import { esc } from './components.mjs';

export function layout({ title, description = '', bodyClass = '', head = '', body, scripts = [] }) {
  const scriptTags = scripts.map((s) => `<script src="${s}" defer></script>`).join('\n  ');
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex,nofollow">
  <meta name="description" content="${esc(description)}">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="styles.css">
  <script>
    (function () {
      try {
        var saved = localStorage.getItem('ie-theme');
        var dark = saved ? saved === 'dark'
          : window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (dark) document.documentElement.setAttribute('data-theme', 'dark');
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
