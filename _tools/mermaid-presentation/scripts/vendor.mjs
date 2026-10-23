import {copyFileSync,mkdirSync} from 'node:fs';
mkdirSync('public/assets',{recursive:true});
copyFileSync('node_modules/mermaid/dist/mermaid.min.js','public/assets/mermaid.min.js');
copyFileSync('node_modules/mermaid/LICENSE','public/assets/MERMAID-LICENSE.txt');
copyFileSync('node_modules/qrcode/license','public/assets/QRCODE-LICENSE.txt');
