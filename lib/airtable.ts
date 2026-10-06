import schema from './airtable-schema.json' with { type: 'json' };
type Row = { id: string; fields: Record<string, unknown> };
type Snapshot = {state:string; fetchedAt:string; errors:Record<string,string>; truncated:string[]; accounts:Row[]; posts:Row[]; history:Row[]; activity:Row[]};
const MAX_PAGES: Record<string, number> = { accounts: 5, posts: 30, history: 40, activity: 10 };
let cache: { expires: number; value: Snapshot } | undefined;
let pending: Promise<Snapshot> | undefined;
export async function loadWorkspace(token: string): Promise<Snapshot> {
  if (cache && cache.expires > Date.now()) return cache.value;
  if (pending) return pending;
  pending = collect(token);
  try { const value = await pending; cache = {value, expires:Date.now()+60000}; return value; }
  finally { pending = undefined; }
}
async function readTable(token:string, tableId:string, key:string, signal:AbortSignal, sortField?:string) {
  const rows:Row[]=[]; let offset:string|undefined;
  for(let page=0;page<MAX_PAGES[key];page++) {
    signal.throwIfAborted();
    const url=new URL(`https://api.airtable.com/v0/${schema.baseId}/${tableId}`);
    url.searchParams.set('pageSize','100');
    if(sortField){url.searchParams.set('sort[0][field]',sortField);url.searchParams.set('sort[0][direction]','desc');}
    if(offset)url.searchParams.set('offset',offset);
    const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal});
    if(!response.ok)throw new Error(response.status===429?'Airtable request limit reached; retry after the next refresh.':`Airtable read failed (${response.status}). Check token access to this base.`);
    const data=await response.json() as {records:Row[];offset?:string};
    rows.push(...data.records.map(r=>({id:r.id,fields:r.fields})));
    offset=data.offset;
    if(!offset)break;
    await new Promise(resolve=>setTimeout(resolve,220));
  }
  return {rows,truncated:!!offset};
}
async function collect(token:string):Promise<Snapshot> {
  const signal = AbortSignal.timeout(50000);
  const result: Snapshot = {state:'connected',fetchedAt:new Date().toISOString(),errors:{},truncated:[],accounts:[],posts:[],history:[],activity:[]};
  const sources = [['Accounts','accounts',undefined],['Content & Posts','posts',undefined],['Insight History','history','Collected At'],['Activity Log','activity','Started At']] as const;
  for (const [name,key,sortField] of sources) {
    try {
      const table=(schema.tables as Record<string,{id:string}>)[name];
      const {rows,truncated}=await readTable(token,table.id,key,signal,sortField);
      result[key]=rows; if(truncated)result.truncated.push(key);
    } catch(error) {result.errors[key]=signal.aborted?'Airtable refresh timed out. Try again.':error instanceof Error?error.message:'Read failed';}
  }
  return result;
}
