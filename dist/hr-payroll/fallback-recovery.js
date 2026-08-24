export async function recoverLegacyHrFallback({cloudStore,localData={},collections=[]}={}){
  if(!cloudStore)throw Error("Cloud workspace store is required.");
  const cloudCounts=Object.fromEntries(await Promise.all(collections.map(async collection=>[collection,(await cloudStore.all(collection)).length])));
  const localCounts=Object.fromEntries(collections.map(collection=>[collection,Array.isArray(localData[collection])?localData[collection].length:0]));
  const shouldRecover=cloudCounts.employees===0&&localCounts.employees>0;
  if(!shouldRecover)return{recovered:false,cloudCounts,localCounts,finalCounts:cloudCounts};
  for(const collection of collections){
    const rows=Array.isArray(localData[collection])?localData[collection].filter(row=>row?.id):[];
    if(!rows.length)continue;
    if(typeof cloudStore.putMany==="function")await cloudStore.putMany(collection,rows);
    else for(const row of rows)await cloudStore.put(collection,row);
  }
  const finalCounts=Object.fromEntries(await Promise.all(collections.map(async collection=>[collection,(await cloudStore.all(collection)).length])));
  if(finalCounts.employees<localCounts.employees)throw Error(`Legacy employee recovery was incomplete: ${finalCounts.employees} of ${localCounts.employees} employees persisted.`);
  return{recovered:true,cloudCounts,localCounts,finalCounts};
}
