import * as pdfjs from '/vendor/pdf.js';
import { pageGeometry, pointerPoint, validRegion, incompatiblePages, loadPdf, exportCrop, outputFilename } from './core.js';
pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.min.js';
const rendererOptions={isEvalSupported:false,standardFontDataUrl:'/vendor/pdfjs-fonts/',cMapUrl:'/vendor/pdfjs-cmaps/',cMapPacked:true,wasmUrl:'/vendor/pdfjs-wasm/'};
const $=id=>document.getElementById('cp-'+id), library=window.PDFLib;
let state=null, active='a', zoom=1, viewMode='width', generation=0, renderTask=null, renderSerial=0, busy=false, rendering=false, gesture=null, previewDocument=null, previewTask=null;
const urls=[];
function error(text='') { $('error').textContent=text; $('error').hidden=!text; }
function status(text='') { $('status').textContent=text; }
function clearOutputs() { urls.splice(0).forEach(url=>URL.revokeObjectURL(url)); $('downloads').replaceChildren(); }
function regions() { if(!state) return {}; return state.regions[state.page] ||= {a:null,b:null}; }
function geometry() { return state.geometries[state.page]; }
function dual() { return $('mode').value==='dual'; }
function scope() { return $('scope').value==='all'; }
function indices() { return scope()?state.geometries.map((_,i)=>i):[state.page]; }
function invalidate() { clearOutputs(); error(); }
function setBusy(value) {
  busy=value;
  document.querySelectorAll('#cp-workspace button, #cp-workspace input, #cp-workspace select, #cp-file').forEach(el=>el.disabled=value);
  $('overlay').style.pointerEvents=value || rendering?'none':'';
}
async function clearPreview() {
  previewTask?.cancel(); previewTask=null;
  if(previewDocument) { const doc=previewDocument; previewDocument=null; await doc.destroy(); }
  $('result-canvas').width=1; $('result-canvas').height=1;
}
async function reset() {
  generation++; renderSerial++; renderTask?.cancel(); gesture=null;
  await clearPreview(); $('dialog').close();
  if(state) { const old=state; state=null; await old.preview.destroy(); }
  clearOutputs(); $('workspace').hidden=true; $('drop').hidden=false; $('file').value=''; $('canvas').width=1; $('canvas').height=1; $('overlay').replaceChildren(); status(); error();
}
async function upload(file) {
  if(busy) return;
  await reset();
  if(!file || !/\.pdf$/i.test(file.name) && file.type!=='application/pdf') { error('Unsupported file. Choose a PDF document.'); return; }
  // Bound local memory use; PDF rendering and editing require several copies.
  if(file.size>100*1024*1024) { error('This file exceeds the 100 MB limit. Choose a smaller PDF.'); return; }
  setBusy(true); status('Reading PDF…'); const ticket=generation;
  let loading=null, preview=null;
  try {
    if(!library?.PDFDocument) throw new Error('The PDF library did not load. Refresh this page.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    const source=await loadPdf(bytes,library), geometries=source.getPages().map(pageGeometry);
    loading=pdfjs.getDocument({data:bytes.slice(),...rendererOptions});
    loading.onPassword=()=>{ loading.destroy(); };
    preview=await loading.promise;
    if(ticket!==generation) { await preview.destroy(); return; }
    if(preview.numPages!==geometries.length) throw new Error('This PDF has inconsistent page data. Save a new copy first.');
    state={bytes,preview,geometries,page:0,regions:{},filename:file.name}; active='a'; viewMode='width';
    $('filename').textContent=file.name; $('page-count').textContent='/ '+geometries.length; $('page').max=geometries.length;
    $('workspace').hidden=false; $('drop').hidden=true; await render(); status('PDF ready. Select a region on the page.');
  } catch(e) {
    if(preview && !state) await preview.destroy(); else if(loading && !state) await loading.destroy();
    error(/password|encrypt/i.test(e.message)?'Password-protected PDFs are not supported. Save an unprotected copy first.':e.message || 'Unable to open this PDF.');
  } finally { setBusy(false); update(); $('file').value=''; }
}
function update() {
  if(!state)return;
  const g=geometry(), selected=regions(), keys=dual()?['a','b']:['a'];
  $('page').value=state.page+1; $('prev').disabled=busy || state.page===0; $('next').disabled=busy || state.page===state.geometries.length-1;
  $('region-b').hidden=!dual(); $('export-b').hidden=!dual(); $('export-both').hidden=!dual();
  $('details').textContent=`${state.geometries.length} pages · Page ${state.page+1}: ${g.displayWidth.toFixed(1)} × ${g.displayHeight.toFixed(1)} PDF units · ${g.rotation}° rotation`;
  const bad=new Set();
  for(const key of ['a','b']) {
    const r=selected[key]; $('size-'+key).textContent=r?`${r.width.toFixed(1)} × ${r.height.toFixed(1)} PDF units`:'No selection';
    const incompatible=r && scope()?incompatiblePages(state.geometries,g,r):[];
    if(keys.includes(key)) incompatible.forEach(i=>bad.add(i));
    $('export-'+key).disabled=busy || rendering || !validRegion(r,g) || !!incompatible.length;
    $('select-'+key).setAttribute('aria-pressed',String(active===key));
  }
  $('compatibility').textContent=bad.size?`Incompatible page sizes: ${[...bad].join(', ')}. Export is blocked; choose Current Page Only.`:scope()?'The selected areas will be applied to every compatible page.':'Selections are saved independently for each page.';
  $('export-both').disabled=busy || rendering || keys.some(key=>!validRegion(selected[key],g)) || !!bad.size;
  $('preview').disabled=busy || rendering || !validRegion(selected[active],g) || !!bad.size;
}
function drawSelections() {
  if(!state)return;
  const overlay=$('overlay'),g=geometry(); overlay.replaceChildren();
  for(const key of dual()?['a','b']:['a']) {
    const r=regions()[key]; if(!r)continue;
    const el=document.createElement('div'); el.className=`cp-selection ${key} ${key===active?'active':''}`; el.dataset.region=key;
    Object.assign(el.style,{left:100*r.x/g.displayWidth+'%',top:100*r.y/g.displayHeight+'%',width:100*r.width/g.displayWidth+'%',height:100*r.height/g.displayHeight+'%'});
    el.setAttribute('aria-label',`Region ${key.toUpperCase()}`);
    if(key===active)for(const handle of ['nw','n','ne','e','se','s','sw','w']) { const h=document.createElement('span'); h.className='cp-handle'; h.dataset.handle=handle; el.append(h); }
    overlay.append(el);
  }
  update();
}
async function render() {
  if(!state)return; renderTask?.cancel();
  const current=state, pageIndex=state.page, serial=++renderSerial;
  rendering=true; gesture=null; $('overlay').style.pointerEvents='none'; update();
  try {
    const page=await current.preview.getPage(pageIndex+1);
    if(serial!==renderSerial || state!==current)return;
    const initial=page.getViewport({scale:1}), width=Math.max(120,$('scroll').clientWidth-40), height=Math.max(100,$('scroll').clientHeight-40);
    if(viewMode==='width')zoom=width/initial.width;
    if(viewMode==='page')zoom=Math.min(width/initial.width,height/initial.height);
    zoom=Math.max(.1,Math.min(4,zoom));
    const viewport=page.getViewport({scale:zoom});
    const dpr=Math.min(window.devicePixelRatio||1,2,Math.sqrt(16000000/(viewport.width*viewport.height)));
    const canvas=$('canvas'); canvas.width=Math.ceil(viewport.width*dpr); canvas.height=Math.ceil(viewport.height*dpr);
    $('stage').style.width=viewport.width+'px'; $('stage').style.height=viewport.height+'px';
    renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:[dpr,0,0,dpr,0,0]}); await renderTask.promise;
    if(serial!==renderSerial)return;
    $('zoom').textContent=Math.round(zoom*100)+'%'; drawSelections();
  } catch(e) { if(e.name!=='RenderingCancelledException')error('Unable to render this page. Try saving a new PDF copy.'); }
  finally { if(serial===renderSerial) { rendering=false; $('overlay').style.pointerEvents=busy?'none':''; update(); } }
}
function point(event) { return pointerPoint(event.clientX,event.clientY,$('overlay').getBoundingClientRect(),geometry()); }
$('overlay').addEventListener('pointerdown',event=>{
  if(!state || busy || rendering || event.button!==0 || gesture)return;
  event.preventDefault(); invalidate();
  const target=event.target.closest('[data-region]'), p=point(event);
  if(target)active=target.dataset.region;
  const r=regions()[active];
  gesture={id:event.pointerId,start:p,original:r?{...r}:null,kind:target?(event.target.dataset.handle||'move'):'new'};
  if(!target)regions()[active]={x:p.x,y:p.y,width:0,height:0};
  $('overlay').setPointerCapture(event.pointerId); drawSelections();
});
$('overlay').addEventListener('pointermove',event=>{
  if(!gesture || gesture.id!==event.pointerId)return;
  const p=point(event),{start,original:r,kind}=gesture,g=geometry();
  if(kind==='new')regions()[active]={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),width:Math.abs(p.x-start.x),height:Math.abs(p.y-start.y)};
  else if(kind==='move')regions()[active]={...r,x:Math.max(0,Math.min(g.displayWidth-r.width,r.x+p.x-start.x)),y:Math.max(0,Math.min(g.displayHeight-r.height,r.y+p.y-start.y))};
  else {
    let left=r.x,top=r.y,right=r.x+r.width,bottom=r.y+r.height;
    if(kind.includes('w'))left=Math.min(p.x,right-1); if(kind.includes('e'))right=Math.max(p.x,left+1);
    if(kind.includes('n'))top=Math.min(p.y,bottom-1); if(kind.includes('s'))bottom=Math.max(p.y,top+1);
    regions()[active]={x:left,y:top,width:right-left,height:bottom-top};
  }
  drawSelections();
});
function finish(event) { if(!gesture || event.pointerId!==gesture.id)return; if(event.type==='pointercancel')regions()[active]=gesture.original; else if(!validRegion(regions()[active],geometry()))regions()[active]=null; gesture=null; drawSelections(); }
$('overlay').addEventListener('pointerup',finish); $('overlay').addEventListener('pointercancel',finish);
async function output(keys, preview=false) {
  if(!state || busy || rendering)return;
  if(keys.some(key=>!validRegion(regions()[key],geometry()))) { error('Draw each requested crop region first.'); return; }
  clearOutputs(); error(); setBusy(true); update();
  try {
    const results=[];
    for(const key of keys) {
      status(`Preparing Region ${key.toUpperCase()}…`);
      const bytes=await exportCrop(state.bytes,{...regions()[key]},indices(),geometry(),library,(done,total)=>status(`Region ${key.toUpperCase()}: ${done} / ${total} pages`));
      results.push({bytes,key,filename:outputFilename(state.filename,$('name-'+key).value,dual())});
    }
    if(preview) {
      await clearPreview(); previewDocument=await pdfjs.getDocument({data:results[0].bytes.slice(),...rendererOptions}).promise;
      const page=await previewDocument.getPage(scope()?state.page+1:1),base=page.getViewport({scale:1});
      const viewport=page.getViewport({scale:Math.min(2,800/base.width,1000/base.height)}),canvas=$('result-canvas');
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      $('preview-title').textContent='Region '+active.toUpperCase()+' — '+$('name-'+active).value;
      $('preview-info').textContent=`Page ${state.page+1} crop · ${base.width.toFixed(1)} × ${base.height.toFixed(1)} pt · ${previewDocument.numPages} output pages`;
      $('dialog').showModal(); previewTask=page.render({canvasContext:canvas.getContext('2d'),viewport}); await previewTask.promise;
      status('Crop preview ready. Original document unchanged.');
    } else {
      for(const result of results) {
        const url=URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'}));urls.push(url);
        const link=document.createElement('a');link.href=url;link.download=result.filename;link.className='btn btn-secondary cp-download';link.textContent='Save '+result.filename; $('downloads').append(link);
        // Both outputs remain as distinct links; no browser multiple-download permission is needed.
        if(results.length===1)link.click();
      }
      status(results.length===2?'Both PDFs are ready. Use the two separate Save links below.':'Cropped PDF ready.');
    }
  } catch(e) { error(e.message||'Unable to crop this document.'); status(); }
  finally { setBusy(false); update(); }
}
$('file').addEventListener('change',()=>{if($('file').files[0])upload($('file').files[0]);});
$('drop').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click();}});
for(const name of ['dragenter','dragover'])$('drop').addEventListener(name,e=>{e.preventDefault();$('drop').classList.add('dragging');});
for(const name of ['dragleave','drop'])$('drop').addEventListener(name,e=>{e.preventDefault();$('drop').classList.remove('dragging');});
$('drop').addEventListener('drop',e=>{if(e.dataTransfer.files.length!==1)error('Drop one PDF at a time.');else upload(e.dataTransfer.files[0]);});
$('replace').onclick=()=>$('file').click(); $('remove').onclick=reset;
for(const [id,delta] of [['prev',-1],['next',1]])$(id).onclick=()=>{state.page+=delta; invalidate();render();};
$('page').onchange=()=>{const n=Number($('page').value);if(Number.isInteger(n)&&n>=1&&n<=state.geometries.length){state.page=n-1;invalidate();render();}else update();};
for(const [id,factor] of [['in',1.25],['out',.8]])$(id).onclick=()=>{viewMode='manual';zoom*=factor;render();};
for(const [id,mode] of [['width','width'],['fit','page'],['reset','width']])$(id).onclick=()=>{viewMode=mode; $('scroll').scrollTo(0,0);render();};
for(const key of ['a','b']) {
  $('select-'+key).onclick=()=>{active=key;drawSelections();};
  $('clear-'+key).onclick=()=>{regions()[key]=null;invalidate();drawSelections();};
  $('name-'+key).oninput=invalidate;
  $('export-'+key).onclick=()=>output([key]);
}
$('mode').onchange=()=>{if(!dual())active='a';invalidate();drawSelections();}; $('scope').onchange=()=>{invalidate();update();};
$('preview').onclick=()=>output([active],true); $('export-both').onclick=()=>output(['a','b']);
$('close').onclick=()=>$('dialog').close(); $('dialog').addEventListener('close',clearPreview);
let resizeTimer; window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(state && viewMode!=='manual')render();},150);});
window.addEventListener('pagehide',()=>{clearOutputs();renderTask?.cancel();previewTask?.cancel();previewDocument?.destroy();state?.preview.destroy();state=null;});
