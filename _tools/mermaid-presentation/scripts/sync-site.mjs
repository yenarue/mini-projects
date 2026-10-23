import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const target = resolve(root, '../../study/kaist_itm/projects/mermaid-dsm-presentation');
mkdirSync(target, { recursive: true });
for (const file of ['index.html', 'index_v2.0.html', 'mermaid-assets', 'assets']) {
  cpSync(resolve(root, 'dist', file), resolve(target, file), { recursive: true });
}
cpSync(resolve(root, 'README.md'), resolve(target, 'README.md'));
console.log(`Static presentation copied to ${target}/index.html`);
