const mermaid = window.mermaid;
import QRCode from 'qrcode';
import { cases } from './cases.js';
import { galleryPresets } from './gallery-presets.js';
import './styles.css';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const concept = 'flowchart LR\n    A[아이디어] --> B[검토]\n    B --> C[실행]';
const first = 'flowchart LR\n    E["E · 시작"] --> HJ["H·J"]\n    HJ --> CDG["C·D·G"]\n    CDG --> F["F"]\n    F --> B["B · 종료"]';
const parallel = 'flowchart LR\n    E["E · 시작"] --> HJ["H·J"]\n    HJ --> CDG["C·D·G"]\n    HJ --> AI["A·I"]\n    CDG --> F["F"]\n    AI --> F\n    F --> B["B · 종료"]';
const presets = [first, parallel, parallel.replace(' LR', ' TB')];
let caseIndex = 0, sequence = 0, demoRevision = 0, caseRevision = 0, timer;
const rendererConfig = {startOnLoad:false,securityLevel:'strict',theme:'base',fontFamily:'Arial, Apple SD Gothic Neo, sans-serif',themeVariables:{primaryColor:'#fdebf2',primaryTextColor:'#16181d',primaryBorderColor:'#e0095f',lineColor:'#606773',fontSize:'28px',clusterBkg:'#f6f7f9',clusterBorder:'#e3e6eb'},flowchart:{htmlLabels:true,useMaxWidth:true,nodeSpacing:28,rankSpacing:20,padding:8,curve:'basis'},suppressErrorRendering:true};
mermaid.initialize(rendererConfig);
// A single queue isolates Mermaid's shared renderer; revisions discard stale results.
let queue = Promise.resolve();
function render(code, original = false) { const task = queue.then(async () => { mermaid.initialize({...rendererConfig,themeVariables:{...rendererConfig.themeVariables,fontSize:original?'18px':'28px'},flowchart:{...rendererConfig.flowchart,padding:original?15:8,rankSpacing:original?40:20}}); const { svg } = await mermaid.render(`diagram-${++sequence}`, code); return svg; }); queue = task.catch(() => {}); return task; }
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
async function updateDemo(revision = ++demoRevision){
 const code = $('#editor').value;
 $('#render-status').classList.remove('error');$('#render-status').textContent='렌더링 중…';$('#preview-label').textContent='갱신 중';
 try{const svg=await render(code);if(revision!==demoRevision)return;$('#demo-graph').innerHTML=svg;$('#render-status').textContent='✓ 코드와 그림이 동기화되었습니다.';$('#preview-label').textContent='LIVE';}
 catch(error){if(revision!==demoRevision)return;$('#render-status').classList.add('error');$('#render-status').textContent='문법을 확인해 주세요. 대괄호와 화살표를 확인하거나 ‘초기화’를 누르세요.\n'+String(error.message||error).split('\n').slice(0,3).join('\n');$('#preview-label').textContent=$('#demo-graph svg')?'이전 정상 결과':'렌더링 오류';}
}
function setStep(step){clearTimeout(timer);$('#editor').value=presets[step];$$('[data-step]').forEach((b,i)=>b.setAttribute('aria-pressed',i===step));$('#step-hint').textContent=['순차 흐름부터 시작합니다.','A·I가 C·D·G와 병렬로 연결됩니다.','관계는 그대로, 가로(LR)에서 세로(TB)로.'][step];updateDemo();}
$('#editor').addEventListener('input',()=>{const revision=++demoRevision;clearTimeout(timer);$$('[data-step]').forEach(b=>b.setAttribute('aria-pressed','false'));$('#step-hint').textContent='직접 편집 중';$('#render-status').textContent='변경 사항을 기다리는 중…';$('#preview-label').textContent='갱신 대기';timer=setTimeout(()=>updateDemo(revision),300);});
$$('[data-step]').forEach(b=>b.addEventListener('click',()=>setStep(Number(b.dataset.step))));$('#reset').onclick=()=>setStep(0);
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText($('#editor').value);toast('현재 코드를 복사했습니다.');}catch{toast('복사가 허용되지 않았습니다. 편집기에서 직접 선택해 복사해 주세요.');}};
async function setCase(index){caseIndex=index;const revision=++caseRevision;$$('[data-case]').forEach((b,i)=>b.setAttribute('aria-pressed',i===index));
 $('#case-explanation').textContent=index===0?'C·D·G와 A·I는 서로 의존하지 않아 병렬로 진행할 수 있습니다.':'X 25개를 개별 작업 간 직접 의존관계로 표현했습니다.';
 $('#case-legend').textContent=index===0?'심플 버전은 블록 사이의 전체 흐름을 보여줍니다.':'굵은 선: 블록 내부 7개 / 실선: 12개 / 점선: 6개. 양방향 화살표는 관계 2개입니다.';
 $('#case-graph').textContent='원본 코드를 렌더링합니다…';$('#enlarge').disabled=true;
 try{const svg=await render(cases[index], true);if(revision!==caseRevision)return;$('#case-graph').innerHTML=svg;$('#enlarge').disabled=false;}catch{if(revision!==caseRevision)return;const img=document.createElement('img');img.src=`./assets/${index===0?'simple':'detail'}.png`;img.alt='렌더링을 대신한 실제 제출 PDF 캡처';img.style='width:100%;height:100%;object-fit:contain';$('#case-graph').replaceChildren(img);toast('원본 PDF 캡처로 표시합니다.');}
}
$$('[data-case]').forEach(b=>b.onclick=()=>setCase(Number(b.dataset.case)));
// Native anchors and scrolling keep every section available, including keyboard navigation.
const sections = $$('#intro, .presentation-section');
let navFrame = 0;
function updateNavigation() {
 navFrame = 0;
 const marker = $('.topbar').getBoundingClientRect().bottom + 48;
 const current = [...sections].reverse().find(section => section.getBoundingClientRect().top <= marker);
 $$('.section-nav a').forEach(link => {
  if (current && link.hash === '#'+current.id) link.setAttribute('aria-current','location');
  else link.removeAttribute('aria-current');
 });
}
function scheduleNavigation() { if (!navFrame) navFrame = requestAnimationFrame(updateNavigation); }
window.addEventListener('scroll', scheduleNavigation, {passive:true});
window.addEventListener('resize', scheduleNavigation);
updateNavigation();
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('전체 화면을 사용할 수 없습니다. 브라우저의 전체 화면 메뉴를 이용하세요.');}};document.addEventListener('fullscreenchange',()=>{const button=$('#fullscreen');const label=document.fullscreenElement?'전체 화면 종료':'전체 화면';button.textContent=document.fullscreenElement?'↙':'↗';button.setAttribute('aria-label',label);button.title=label;});
let zoomScale=1;function scaleZoom(){ $('#zoom-graph').style.width=`${zoomScale*100}%`; }
$('#enlarge').onclick=()=>{const graph=$('#case-graph svg');if(!graph)return;$('#zoom-graph').innerHTML=graph.outerHTML;zoomScale=1;scaleZoom();$('#zoom').showModal();};$('#zoom-in').onclick=()=>{zoomScale=Math.min(4,zoomScale+.5);scaleZoom();};$('#zoom-out').onclick=()=>{zoomScale=Math.max(1,zoomScale-.5);scaleZoom();};$('#zoom-close').onclick=()=>$('#zoom').close();

function createGallery() {
 const grid = $('#gallery-grid');
 grid.innerHTML = galleryPresets.map((preset) => `<article class="gallery-card card"><button class="gallery-card-button" type="button" data-gallery-open="${preset.id}" aria-label="${preset.title} 크게 보기"><div class="gallery-card-meta"><span class="chip">${preset.label}</span><span class="gallery-use">${preset.use}</span></div><h3>${preset.title}</h3><p>${preset.description}</p><div class="gallery-card-graph" id="gallery-graph-${preset.id}" role="img" aria-label="${preset.title} 미리보기"><span class="gallery-loading">렌더링 중…</span></div><span class="gallery-open">자세히 보기 ↗</span></button></article>`).join('');
 galleryPresets.forEach((preset) => render(preset.code).then((svg) => { const target = $(`#gallery-graph-${preset.id}`); if (target) target.innerHTML = svg; }).catch(() => { const target = $(`#gallery-graph-${preset.id}`); if (target) { target.textContent = '미리보기를 불러오지 못했습니다.'; target.classList.add('gallery-error'); } }));
 $$('[data-gallery-open]').forEach((button) => button.addEventListener('click', () => openGallery(button.dataset.galleryOpen)));
}
function openGallery(id) {
 const preset = galleryPresets.find((item) => item.id === id); if (!preset) return;
 $('#gallery-dialog-label').textContent = preset.label; $('#gallery-dialog-title').textContent = preset.title; $('#gallery-dialog-description').textContent = preset.description; $('#gallery-dialog-use').textContent = `활용: ${preset.use}`; $('#gallery-dialog-code').textContent = preset.code;
 const target = $(`#gallery-graph-${preset.id}`); $('#gallery-dialog-graph').innerHTML = target?.querySelector('svg')?.outerHTML || '<p>미리보기를 준비하는 중입니다.</p>';
 $('#gallery-dialog').showModal();
}
$('#gallery-dialog-close').onclick = () => $('#gallery-dialog').close();
$('#gallery-dialog').addEventListener('click', (event) => { if (event.target === $('#gallery-dialog')) $('#gallery-dialog').close(); });

QRCode.toDataURL('https://mermaid.live/',{width:320,margin:2,color:{dark:'#16181d',light:'#ffffff'}}).then(url=>$('#qr').src=url).catch(()=>$('#qr').hidden=true);
createGallery();
setStep(0);
render(concept).then(svg=>$('#concept-graph').innerHTML=svg).catch(()=>$('#concept-graph').textContent='개념 그래프를 불러오지 못했습니다. 새로고침해 주세요.');
setCase(0);
const signatureFooter = $('#signature-footer');
const utilityFooter = $('#utility-footer');
if (signatureFooter && utilityFooter && 'IntersectionObserver' in window) {
 const footerObserver = new IntersectionObserver(([entry]) => utilityFooter.classList.toggle('is-docked', entry.isIntersecting), {threshold: 0.08});
 footerObserver.observe(signatureFooter);
}
