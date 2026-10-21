import {readFile,writeFile} from 'node:fs/promises';
let html=await readFile('dist/app.html','utf8');
const scripts=[...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)];
for(const [tag,path] of scripts){const js=await readFile('dist/'+path.replace(/^\.\//,''),'utf8');html=html.replace(tag,()=>'<script type="module">'+js.replace(/<\/script/gi,'<\\/script')+'</script>')}
for(const [tag,path] of html.matchAll(/<link[^>]*href="([^"]+\.css)"[^>]*>/g)){const css=await readFile('dist/'+path.replace(/^\.\//,''),'utf8');html=html.replace(tag,()=>'<style>'+css+'</style>')}
await writeFile('dist/index.html',html);await writeFile('index.html',html);console.log('Self-contained index.html generated (file:// and GitHub Pages)');
