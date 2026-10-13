import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as library from 'pdf-lib';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { pageGeometry, pointerPoint, cropBox, incompatiblePages, loadPdf, exportCrop, outputFilename } from '../src/crop-pdf/core.js';
import { cropPdfPageHtml } from '../src/pages/marketing/crop-pdf.js';
import { mainNav } from '../src/data/nav.js';
globalThis.DOMMatrix ||= DOMMatrix; globalThis.ImageData ||= ImageData; globalThis.Path2D ||= Path2D;
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');

async function fixture(rotations=[0], sizes=rotations.map(()=>[400,600]), offset=false) {
  const pdf=await library.PDFDocument.create();
  for(let i=0;i<rotations.length;i++) {
    const page=pdf.addPage(sizes[i]); page.setRotation(library.degrees(rotations[i]));
    if(offset)page.setCropBox(20,30,sizes[i][0]-40,sizes[i][1]-60);
    page.drawText('SYNTHETIC SHIPPING LABEL',{x:35,y:530,size:12});
    page.drawText('SYNTHETIC TAX INVOICE',{x:35,y:130,size:12});
    // Barcode-like vector bars and a QR-like vector grid: no private data.
    for(let n=0;n<30;n++)page.drawRectangle({x:40+n*4,y:420,width:n%3+1,height:60,color:library.rgb(0,0,0)});
    for(let row=0;row<15;row++)for(let col=0;col<15;col++)if((row*col+row+col)%3)page.drawRectangle({x:220+col*5,y:420+row*5,width:5,height:5,color:library.rgb(0,0,0)});
  }
  return pdf.save();
}
async function rendered(bytes,index=0) {
  const pdf=await pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false,standardFontDataUrl:fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/',import.meta.url)).replaceAll('\\','/')}).promise;
  const page=await pdf.getPage(index+1),viewport=page.getViewport({scale:1}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
  await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;
  const text=(await page.getTextContent()).items.map(i=>i.str).join(' ');
  await pdf.destroy();return {canvas,text,width:viewport.width,height:viewport.height};
}
test('single crop preserves the source bytes and creates exact PDF dimensions',async()=>{
  const bytes=await fixture(),unchanged=bytes.slice(),source=await loadPdf(bytes,library),g=pageGeometry(source.getPage(0));
  const result=await exportCrop(bytes,{x:25,y:50,width:300,height:170},[0],g,library),out=await loadPdf(result,library);
  assert.deepEqual(bytes,unchanged);assert.deepEqual(out.getPage(0).getCropBox(),{x:25,y:380,width:300,height:170});assert.deepEqual(out.getPage(0).getMediaBox(),out.getPage(0).getCropBox());
});
test('two independent exports apply to all ten pages and retain vector barcode and QR-like patterns pixel-for-pixel',async()=>{
  const bytes=await fixture(Array(10).fill(0)),source=await loadPdf(bytes,library),g=pageGeometry(source.getPage(0));
  const a={x:20,y:50,width:310,height:180},b={x:20,y:430,width:310,height:120};
  const first=await exportCrop(bytes,a,Array.from({length:10},(_,i)=>i),g,library),second=await exportCrop(bytes,b,Array.from({length:10},(_,i)=>i),g,library);
  for(const result of [first,second])assert.equal((await loadPdf(result,library)).getPageCount(),10);
  const original=await rendered(bytes),cropped=await rendered(first);
  assert.deepEqual(original.canvas.getContext('2d').getImageData(a.x,a.y,a.width,a.height).data,cropped.canvas.getContext('2d').getImageData(0,0,a.width,a.height).data);
  assert.ok(cropped.text.includes('SYNTHETIC')); // Text remains text, not an image.
  assert.notDeepEqual(first,second);
});
for(const rotation of [0,90,180,270])test('rotated page '+rotation+' and nonzero CropBox origin match the original visual region',async()=>{
  const bytes=await fixture([rotation],undefined,true),source=await loadPdf(bytes,library),g=pageGeometry(source.getPage(0));
  const region={x:30,y:35,width:150,height:180};
  const result=await exportCrop(bytes,region,[0],g,library),original=await rendered(bytes),out=await rendered(result);
  assert.equal(out.width,150);assert.equal(out.height,180);
  const actual=out.canvas.getContext('2d').getImageData(0,0,150,180).data,expected=original.canvas.getContext('2d').getImageData(30,35,150,180).data;
  const difference=actual.reduce((total,value,index)=>total+Math.abs(value-expected[index]),0)/(actual.length*255);
  // Font hinting can change at a new canvas origin; vector regions are checked exactly above.
  assert.ok(difference<.002, 'Rendered crop differs by '+difference);
});
test('zoomed and scrolled pointer coordinates map to the same PDF region',()=>{
  const g={displayWidth:400,displayHeight:600};
  for(const scale of [.4,1,2,4])assert.deepEqual(pointerPoint(100+40*scale,50+70*scale,{left:100,top:50,width:400*scale,height:600*scale},g),{x:40,y:70});
});
test('mixed sizes are rejected without silently skipping or producing blank pages',async()=>{
  const bytes=await fixture([0,90],[[400,600],[250,300]]),source=await loadPdf(bytes,library),gs=source.getPages().map(pageGeometry),r={x:20,y:20,width:200,height:200};
  assert.deepEqual(incompatiblePages(gs,gs[0],r),[2]);await assert.rejects(exportCrop(bytes,r,[0,1],gs[0],library),/pages 2/);
  assert.equal((await loadPdf(await exportCrop(bytes,r,[0],gs[0],library),library)).getPageCount(),1);
});
test('compatible displayed sizes with different rotations export consistently',async()=>{
  const bytes=await fixture([0,90],[[400,600],[600,400]]),source=await loadPdf(bytes,library),gs=source.getPages().map(pageGeometry),r={x:20,y:20,width:200,height:150};
  assert.deepEqual(incompatiblePages(gs,gs[0],r),[]);
  const output=await exportCrop(bytes,r,[0,1],gs[0],library);
  for(let i=0;i<2;i++){const result=await rendered(output,i);assert.equal(result.width,200);assert.equal(result.height,150);}
});
test('invalid, corrupted and encrypted files have clear errors; invalid crops cannot export',async()=>{
  await assert.rejects(loadPdf(new TextEncoder().encode('not a PDF'),library),/valid PDF/);
  await assert.rejects(loadPdf(new TextEncoder().encode('%PDF-1.7\ncorrupt'),library),/corrupted/);
  await assert.rejects(loadPdf(new TextEncoder().encode('%PDF-1.7'),{PDFDocument:{load:async()=>{throw new Error('encrypted PDF');}}}),/Password-protected/);
  await assert.rejects(loadPdf(new Uint8Array(fs.readFileSync(new URL('fixtures/crop-pdf/encrypted-synthetic.pdf',import.meta.url))),library),/Password-protected/);
  assert.throws(()=>cropBox({x:-2,y:0,width:10,height:10},{displayWidth:400,displayHeight:600}),/fits inside/);
});
test('filenames are safe and two regions remain separate',()=>{
  assert.equal(outputFilename('Report.pdf','Shipping Labels',false),'report-cropped.pdf');
  assert.equal(outputFilename('Report.pdf','Shipping Labels',true),'shipping-labels-cropped.pdf');
  assert.equal(outputFilename('Report.pdf','Tax Invoices',true),'tax-invoices-cropped.pdf');
});
test('different PDF UserUnit values are blocked for all-page cropping',async()=>{
  const pdf=await library.PDFDocument.create();pdf.addPage([400,600]);
  pdf.addPage([400,600]).node.set(library.PDFName.of('UserUnit'),library.PDFNumber.of(2));
  const bytes=await pdf.save(),g=pdf.getPages().map(pageGeometry),r={x:20,y:20,width:100,height:100};
  assert.deepEqual(incompatiblePages(g,g[0],r),[2]);
  await assert.rejects(exportCrop(bytes,r,[0,1],g[0],library),/pages 2/);
  const result=await exportCrop(bytes,r,[1],g[1],library);
  assert.equal(pageGeometry((await loadPdf(result,library)).getPage(0)).userUnit,2);
});
test('normal navigation includes Crop PDF and retains existing PDF tools',()=>{
  const nav=JSON.stringify(mainNav);for(const route of ['crop-pdf','split-pdf','merge-pdf','pdf-to-word','shipping-label-4in1'])assert.ok(nav.includes('/'+route+'.html'));
  const page=cropPdfPageHtml();for(const control of ['cp-prev','cp-next','cp-fit','cp-width','cp-preview','cp-export-a','cp-export-b','cp-export-both'])assert.ok(page.includes('id="'+control+'"'));
  assert.ok(page.includes('not redaction'));assert.ok(page.includes('/vendor/pdf-lib.min.js'));
  const css=fs.readFileSync(new URL('../src/crop-pdf/styles.css',import.meta.url),'utf8');assert.match(css,/@media\(max-width:850px\)/);assert.match(css,/touch-action:none/);
});
