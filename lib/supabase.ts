import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const configured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export async function database() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => jar.getAll(), setAll: (values) => {
      try { values.forEach(({name,value,options}) => jar.set(name,value,options)); } catch { /* Proxy handles refresh in Server Components. */ }
    }},
  });
}
export async function requireAccount() {
  if (!configured()) redirect('/login');
  const db = await database();
  const {data} = await db.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) redirect('/login');
  return {db,userId};
}
export const selectedBusiness=async()=> (await cookies()).get('billquill-business')?.value;
export async function activeBusiness(db:Awaited<ReturnType<typeof database>>,userId:string,id?:string) {
  const query=()=>db.from('workspaces').select('id,profile').eq('owner_id',userId).eq('status','active');
  const preferred=id || await selectedBusiness();
  if(preferred && /^[0-9a-f-]{36}$/i.test(preferred)) {
    const {data,error}=await query().eq('id',preferred).maybeSingle();
    if(error) throw new Error('Could not load workspace.');
    if(data || id) return data;
  } else if(id) return null;
  const {data,error}=await query().order('created_at').order('id').limit(1).maybeSingle();
  if(error) throw new Error('Could not load workspace.');
  return data;
}
export async function requireWorkspace() {
  const account=await requireAccount();
  const workspace=await activeBusiness(account.db,account.userId);
  if(!workspace) {
    const {data}=await account.db.from('workspaces').select('id').eq('owner_id',account.userId).neq('status','removed').limit(1);
    redirect(data?.length ? '/businesses' : '/settings?new=1');
  }
  return {...account,workspace};
}
export async function getSubscription(db:Awaited<ReturnType<typeof database>>,workspaceId:string) {
  const {data,error}=await db.from('workspace_subscriptions').select('plan,included_template,expires_at').eq('workspace_id',workspaceId).maybeSingle();
  if(error) throw new Error('Could not load subscription status.');
  return data && Date.parse(data.expires_at)>Date.now() ? data as import('./plans').Subscription : null;
}
