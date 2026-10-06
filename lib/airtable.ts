import schema from './airtable-schema.json' with { type: 'json' };
type Row = { id: string; fields: Record<string, unknown> };
type Snapshot = {state:string; fetchedAt:string; errors:Record<string,string>; truncated:string[]; accounts:Row[]; posts:Row[]; history:Row[]; activity:Row[]};
let cache: { expires: number; value: Snapshot } | undefined;
let pending: Promise<Snapshot> | undefined;
export async function loadWorkspace(token: string): Promise<Snapshot> {
  if (cache && cache.expires > Date.now()) return cache.value;
  if (pending) return pending;
  pending = collect(token);
  try { const value = await pending; cache = {value, expires:Date.now()+60000}; return value; }
  finally { pending = undefined; }
}
async function collect(token:string):Promise<Snapshot> {
  const signal = AbortSignal.timeout(45000);
  const result: Snapshot = {state:'connected',fetchedAt:new Date().toISOString(),errors:{},truncated:[],accounts:[],posts:[],history:[],activity:[]};
  for (const [name,key] of [['Accounts','accounts'],['Content & Posts','posts'],['Insight History','history'],['Activity Log','activity']] as const) {
    try {
      const table=schema.tables[name];const names=Object.fromEntries(Object.entries(table.fields).map(([name,id])=>[id,name]));
      const rows:Row[]=[];let offset:string|undefined;
      for(let page=0;page<5;page++) {
        signal.throwIfAborted();
        const url=new URL(`https://api.airtable.com/v0/${schema.baseId}/${table.id}`);
        url.searchParams.set('pageSize','100');url.searchParams.set('returnFieldsByFieldId','true');if(offset)url.searchParams.set('offset',offset);
        const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal});
        if(!response.ok)throw new Error(response.status===429?'Airtable request limit reached; retry after the next refresh.':`Airtable read failed (${response.status}). Check token access to this base.`);
        const data=await response.json() as {records:Row[];offset?:string};
        rows.push(...data.records.map(r=>({id:r.id,fields:Object.fromEntries(Object.entries(r.fields).map(([id,v])=>[names[id]||id,v]))})));
        offset=data.offset;
        await new Promise(resolve=>setTimeout(resolve,350));
        if(!offset)break;
      }
      result[key]=rows;if(offset)result.truncated.push(key);
    } catch(error) {result.errors[key]=signal.aborted?'Airtable refresh timed out. Try again.':error instanceof Error?error.message:'Read failed';}
  }
  return result;
}
