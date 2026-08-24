export const DEFAULT_WORKSPACE_BATCH_SIZE=500;

export async function writeInChunks(values,writeBatch,{batchSize=DEFAULT_WORKSPACE_BATCH_SIZE,onProgress=()=>{}}={}){
  if(!Number.isInteger(batchSize)||batchSize<1)throw Error("Batch size must be a positive integer.");
  let saved=0,batchNumber=0;
  for(let start=0;start<values.length;start+=batchSize){
    const chunk=values.slice(start,start+batchSize),end=start+chunk.length;
    batchNumber++;
    try{await writeBatch(chunk,{batchNumber,start,end,total:values.length})}
    catch(cause){const error=new Error(`Attendance import batch ${batchNumber} failed for rows ${start+1}-${end} after ${saved} of ${values.length} rows were saved: ${cause?.message||cause}`);error.cause=cause;error.batchNumber=batchNumber;error.startRow=start+1;error.endRow=end;error.saved=saved;error.total=values.length;throw error}
    saved=end;
    onProgress(saved,values.length);
    if(end<values.length)await new Promise(resolve=>setTimeout(resolve,0));
  }
  return{saved,batches:batchNumber};
}
