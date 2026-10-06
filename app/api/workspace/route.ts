import { authorized } from '@/lib/access';
import { loadWorkspace } from '@/lib/airtable';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function POST(request:Request) {
  if(!authorized(request.headers.get('authorization')))return Response.json({error:'Sign in to access the workspace'},{status:401,headers});
  const origin=request.headers.get('origin');
  if(!origin || origin!==new URL(request.url).origin)return Response.json({error:'Invalid request origin'},{status:403,headers});
  const token=process.env.AIRTABLE_READ_TOKEN;
  if(!token)return Response.json({state:'setup_required',accounts:[],posts:[],history:[],activity:[]},{headers});
  return Response.json(await loadWorkspace(token),{headers});
}
