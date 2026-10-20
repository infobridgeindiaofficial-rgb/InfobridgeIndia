const KEY="infobridgeindia.public-gst.v1";
const storage=()=>globalThis.localStorage;
function read(){try{return JSON.parse(storage().getItem(KEY)||"{}")||{}}catch{return{}}}
function write(data){storage().setItem(KEY,JSON.stringify(data))}
export function createPublicGstStore(){return{async all(collection){return structuredClone(read()[collection]||[])},async put(collection,record){const data=read(),rows=data[collection]||[],index=rows.findIndex(x=>x.id===record.id);index<0?rows.push(structuredClone(record)):rows[index]=structuredClone(record);data[collection]=rows;write(data);return record},async clear(collection){const data=read();data[collection]=[];write(data)},async replace(collection,rows){const data=read();data[collection]=structuredClone(rows||[]);write(data);return rows}}}
