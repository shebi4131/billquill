'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { configured, database, getSubscription, requireAccount, requireWorkspace } from '../lib/supabase';
import { emptyProfile, invoiceSchema, newInvoice, profileSchema, templates, type Invoice } from '../lib/invoice';

export async function signIn() {
  if (!configured()) redirect('/login');
  const db=await database();
  const url = new URL('/auth/callback',process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  const {data,error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:url.href}});
  if (error || !data.url) redirect('/login?error=oauth');
  redirect(data.url);
}
export async function signOut() {
  const {db}=await requireAccount();
  await db.auth.signOut();
  redirect('/');
}
export async function saveProfile(raw: unknown, logo: FormData, remove: boolean, businessId?: string) {
  const parsed=profileSchema.safeParse(raw);
  if (!parsed.success) return {error:'Enter a business name and check your contact details.'};
  const {db,userId}=await requireAccount();
  const existing=businessId?await db.from('workspaces').select('id,profile').eq('owner_id',userId).eq('id',businessId).eq('status','active').maybeSingle():{data:null,error:null};
  if (existing.error || (businessId && !existing.data)) return {error:'Could not load the business.'};
  const profile={...parsed.data,logo:remove?'':existing.data?.profile.logo || ''};
  const file=logo.get('logo');
  if (file instanceof File && file.size) {
    if (file.size > 2097152 || !['image/png','image/jpeg'].includes(file.type)) return {error:'Use a PNG or JPEG up to 2 MB.'};
    profile.logo=userId+'/'+crypto.randomUUID()+(file.type==='image/png'?'.png':'.jpg');
    const result=await db.storage.from('logos').upload(profile.logo,file);
    if (result.error) return {error:'Could not upload the logo.'};
  }
  const result=existing.data
    ? await db.from('workspaces').update({profile}).eq('id',existing.data.id).select('id').single()
    : await db.from('workspaces').insert({owner_id:userId,profile}).select('id').single();
  if (result.error) return {error:'Could not save the business.'};
  await rememberBusiness(result.data.id);
  redirect('/businesses');
}
export async function createDraft(form: FormData) {
  const {db,workspace}=await requireWorkspace();
  const subscription=await getSubscription(db,workspace.id);
  if(!subscription) redirect('/plans');
  const workspaceHint=form.get('workspace');
  if(workspaceHint && workspaceHint!==workspace.id) redirect('/businesses');
  const source=form.get('source');
  let data:Invoice={...newInvoice({...emptyProfile,...workspace.profile}),template:subscription.included_template as Invoice['template']};
  if (typeof source==='string') {
    const {data:original}=await db.from('invoices').select('data').eq('id',source).eq('workspace_id',workspace.id).is('archived_at',null).maybeSingle();
    if (original) data={...original.data,date:'',due:''};
  }
  const result=await db.from('invoices').insert({workspace_id:workspace.id,data}).select('id').single();
  if (result.error) throw new Error('Could not create draft.');
  redirect('/invoices/'+result.data.id);
}
export async function saveDraft(id:string, input:Invoice) {
  const parsed=invoiceSchema.safeParse(input);
  if (!parsed.success) return {error:'Check the email, dates, and numeric fields.'};
  const {db,workspace}=await requireWorkspace();
  const {error,data}=await db.from('invoices').update({data:parsed.data}).eq('workspace_id',workspace.id).eq('id',id).eq('status','draft').select('id').maybeSingle();
  if (error || !data) return {error:'Draft could not be saved.'};
  return {error:null};
}
export async function issueInvoice(id:string, input:Invoice) {
  const parsed=invoiceSchema.safeParse(input);
  if (!parsed.success) return {error:'Check the invoice fields before issuing.'};
  const {client,date,due,items}=parsed.data;
  if (!client.trim() || !date || (due && due<date) || items.some(i=>!i.description.trim() || Number(i.quantity)<=0 || !i.unitPrice)) {
    return {error:'Enter a client, valid dates, and a description, quantity and price for every item.'};
  }
  const {db}=await requireWorkspace();
  const {error,data}=await db.rpc('issue_invoice',{target:id,payload:parsed.data});
  if (error || data==null) return {error:error?.message || 'Could not issue invoice.'};
  revalidatePath('/dashboard');
  redirect('/invoices/'+id);
}
export async function changeInvoice(form:FormData) {
  const {db}=await requireWorkspace();
  const id=String(form.get('id'));
  const result=form.get('mode')==='paid'
    ? await db.rpc('mark_invoice_paid',{target:id})
    : await db.rpc('archive_invoice',{target:id});
  if (result.error) throw new Error('Could not update invoice.');
  redirect('/dashboard');
}
export async function changeEntitlement(form:FormData) {
  const {db}=await requireAccount();
  const admin=await db.rpc('is_admin');
  if (!admin.data) redirect('/dashboard');
  const workspace_id=String(form.get('workspace'));
  const template=String(form.get('template'));
  if (!templates.some(t=>t.id===template)) return;
  const result=form.get('mode')==='revoke'
    ? await db.from('template_entitlements').delete().match({workspace_id,template})
    : await db.from('template_entitlements').insert({workspace_id,template});
  if (result.error && result.error.code!=='23505') throw new Error('Could not update template access.');
  revalidatePath('/admin');
}
export async function changeSubscription(form:FormData) {
  const {db}=await requireAccount();
  if(!(await db.rpc('is_admin')).data) redirect('/dashboard');
  const workspace_id=String(form.get('workspace'));
  if(form.get('mode')==='cancel') {
    const {error}=await db.from('workspace_subscriptions').delete().eq('workspace_id',workspace_id);
    if(error) throw new Error('Could not cancel the subscription.');
  } else {
    const plan=form.get('plan');
    const included_template=String(form.get('included'));
    const expires=String(form.get('expires'));
    const end=new Date(expires+'T23:59:59.999+05:00');
    if((plan!=='basic' && plan!=='plus') || !templates.some(t=>t.id===included_template) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(expires) || !Number.isFinite(end.getTime())) throw new Error('Invalid subscription details.');
    const {error}=await db.from('workspace_subscriptions').upsert({workspace_id,plan,included_template,expires_at:end.toISOString()});
    if(error) throw new Error('Could not save the subscription.');
  }
  revalidatePath('/admin');
  revalidatePath('/dashboard');
}

export async function submitContact(_state:{message:string;success:boolean}, form:FormData) {
  const received={message:'Your request has been received.',success:true};
  if(form.get('website')) return received;
  if(!configured()) return {message:'Contact is currently unavailable.',success:false};
  const db=await database();
  const template=templates.find(t=>t.id===form.get('template'));
  const body=String(form.get('message') || '').trim();
  const {error}=await db.rpc('submit_contact',{
    sender:String(form.get('name') || ''), reply_to:String(form.get('email') || '').trim(),
    subject:String(form.get('topic') || ''), body:template && body.length>=10 ? 'Preferred design: '+template.name+'\n\n'+body : body,
  });
  return error ? {message:'Could not send your request. Check the details or try again later.',success:false} : received;
}

export async function requestPlan(form:FormData) {
  const {db,workspace}=await requireWorkspace();
  if(form.get('workspace')!==workspace.id) redirect('/businesses');
  const plan=form.get('plan');
  const template=form.get('template');
  if((plan!=='basic' && plan!=='plus') || !templates.some(t=>t.id===template)) redirect('/plans?result=error');
  const {error}=await db.from('plan_requests').insert({workspace_id:workspace.id,plan,included_template:template});
  if(error && error.code!=='23505') redirect('/plans?result=error');
  revalidatePath('/admin');
  redirect('/plans');
}

export async function reviewPlanRequest(form:FormData) {
  const {db}=await requireAccount();
  const target=String(form.get('id'));
  const decision=form.get('decision');
  if(!/^[0-9a-f-]{36}$/i.test(target) || (decision!=='approve' && decision!=='decline')) return;
  const {error}=await db.rpc('review_plan_request',{target,approve:decision==='approve'});
  if(error) throw new Error('Could not review the plan request.');
  revalidatePath('/admin');
  revalidatePath('/plans');
  revalidatePath('/dashboard');
}

async function rememberBusiness(id:string) {
  (await cookies()).set('billquill-business',id,{httpOnly:true,sameSite:'lax',path:'/',maxAge:60*60*24*365});
}

export async function selectBusiness(form:FormData) {
  const {db,userId}=await requireAccount();
  const id=String(form.get('id'));
  const {data}=await db.from('workspaces').select('id').eq('id',id).eq('owner_id',userId).eq('status','active').maybeSingle();
  if(!data) redirect('/businesses');
  await rememberBusiness(data.id);
  redirect('/dashboard');
}

export async function changeBusinessStatus(form:FormData) {
  const {db}=await requireAccount();
  const desired=form.get('status');
  if(desired!=='active' && desired!=='suspended' && desired!=='removed') return;
  const {error}=await db.rpc('change_workspace_status',{target:String(form.get('id')),desired});
  if(error) throw new Error('Could not update the business.');
  revalidatePath('/businesses');
  revalidatePath('/admin');
  redirect(form.get('returnTo')==='businesses'?'/businesses':'/admin');
}

export async function accountWithEmail(form:FormData) {
  const register=form.get('mode')==='register';
  const page=register?'/login?mode=register&':'/login?';
  if(!configured()) redirect('/login');
  const email=String(form.get('email')||'').trim();
  const password=String(form.get('password')||'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!password||(register&&password.length<8)||Buffer.byteLength(password)>72) redirect(page+'error=invalid');
  const db=await database();
  if(register) {
    const emailRedirectTo=new URL('/auth/callback',process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').href;
    const {data,error}=await db.auth.signUp({email,password,options:{emailRedirectTo}});
    if(error) redirect(page+'error=registration');
    if(!data.session) redirect(page+'confirmed=check-email');
  } else {
    const {error}=await db.auth.signInWithPassword({email,password});
    if(error) redirect(page+'error=credentials');
  }
  redirect('/dashboard');
}
