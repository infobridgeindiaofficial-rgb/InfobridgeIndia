// Coordinates are stored in displayed PDF points, independent of preview zoom.
export function pageGeometry(page) {
  const media = page.getMediaBox(), crop = page.getCropBox();
  const x = Math.max(media.x, crop.x), y = Math.max(media.y, crop.y);
  const width = Math.min(media.x + media.width, crop.x + crop.width) - x;
  const height = Math.min(media.y + media.height, crop.y + crop.height) - y;
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const unitEntry=page.node.entries().find(([key])=>key.toString()==='/UserUnit');
  const userUnit=unitEntry ? page.doc.context.lookup(unitEntry[1]).asNumber() : 1;
  if (!Number.isFinite(userUnit) || userUnit<=0) throw new Error('Unsupported PDF page units.');
  if (![0, 90, 180, 270].includes(rotation) || width <= 0 || height <= 0) throw new Error('Unsupported page geometry or rotation.');
  return { x, y, width, height, rotation, userUnit, displayWidth: rotation % 180 ? height : width, displayHeight: rotation % 180 ? width : height };
}
export function pointerPoint(clientX, clientY, bounds, geometry) {
  return { x: Math.max(0, Math.min(geometry.displayWidth, (clientX - bounds.left) * geometry.displayWidth / bounds.width)), y: Math.max(0, Math.min(geometry.displayHeight, (clientY - bounds.top) * geometry.displayHeight / bounds.height)) };
}
export function validRegion(region, geometry) {
  return region && [region.x, region.y, region.width, region.height].every(Number.isFinite) && region.width >= 1 && region.height >= 1 && region.x >= 0 && region.y >= 0 && region.x + region.width <= geometry.displayWidth + .01 && region.y + region.height <= geometry.displayHeight + .01;
}
export function cropBox(region, geometry) {
  if (!validRegion(region, geometry)) throw new Error('Select an area that fits inside this page.');
  const {x, y, width: w, height: h} = region;
  const g = geometry;
  switch (g.rotation) {
    case 0: return { x: g.x + x, y: g.y + g.height - y - h, width: w, height: h };
    case 90: return { x: g.x + y, y: g.y + x, width: h, height: w };
    case 180: return { x: g.x + g.width - x - w, y: g.y + y, width: w, height: h };
    case 270: return { x: g.x + g.width - y - h, y: g.y + g.height - x - w, width: h, height: w };
  }
}
export function incompatiblePages(geometries, reference, region) {
  return geometries.flatMap((g, index) => Math.abs(g.displayWidth-reference.displayWidth) > .1 || Math.abs(g.displayHeight-reference.displayHeight) > .1 || Math.abs((g.userUnit||1)-(reference.userUnit||1))>.0001 || !validRegion(region,g) ? [index+1] : []);
}
export async function loadPdf(bytes, library) {
  if (!bytes?.length || !new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-')) throw new Error('This file is not a readable PDF. Choose a valid PDF file.');
  try {
    const pdf = await library.PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
    if (!pdf.getPageCount()) throw new Error('Empty PDF');
    return pdf;
  } catch (error) {
    if (/encrypt|password/i.test(error.message)) throw new Error('Password-protected or encrypted PDFs are not supported. Save an unprotected copy first.');
    throw new Error('This PDF is corrupted or unsupported. Try saving a new copy from your PDF application.');
  }
}
export async function exportCrop(bytes, region, indices, reference, library, progress = () => {}) {
  const source = await loadPdf(bytes, library), geometries = source.getPages().map(pageGeometry);
  if (!indices.length || indices.some(i=>!Number.isInteger(i) || i<0 || i>=geometries.length)) throw new Error('Invalid page selection.');
  const bad = indices.filter(i => incompatiblePages([geometries[i]], reference, region).length);
  if (bad.length) throw new Error('Crop cannot be applied safely to pages ' + bad.map(i=>i+1).join(', ') + '. Choose Current Page Only or redefine the crop on compatible pages.');
  const output = await library.PDFDocument.create();
  for (let n=0; n<indices.length; n++) {
    const index=indices[n], [page]=await output.copyPages(source,[index]), box=cropBox(region,geometries[index]);
    for (const method of ['setMediaBox','setCropBox','setBleedBox','setTrimBox','setArtBox']) page[method](box.x,box.y,box.width,box.height);
    output.addPage(page); progress(n+1,indices.length);
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return output.save({addDefaultPage:false});
}
export function outputFilename(original, name, dual) {
  const value=dual ? name : original.replace(/\.pdf$/i,'');
  const stem=value.normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu,'').trim().replace(/\s+/g,'-').slice(0,100) || 'document';
  return stem.toLowerCase()+'-cropped.pdf';
}
