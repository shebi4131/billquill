import Link from 'next/link';
import { WorkspaceShell } from '../../components/workspace-shell';
import { requestPlan } from '../actions';
import { getSubscription, requireWorkspace } from '../../lib/supabase';
import { formatPlanEnd, plans } from '../../lib/plans';
import { templates } from '../../lib/invoice';

export const metadata={title:'Workspace plans',robots:{index:false}};
export default async function WorkspacePlans({searchParams}:{searchParams:Promise<{plan?:string;result?:string}>}) {
  const {db,workspace}=await requireWorkspace();
  const {plan,result}=await searchParams;
  const [requests,sub,admin]=await Promise.all([
    db.from('plan_requests').select('id,plan,included_template,status').eq('workspace_id',workspace.id).order('created_at',{ascending:false}).limit(10),
    getSubscription(db,workspace.id),db.rpc('is_admin'),
  ]);
  if(requests.error) throw new Error('Could not load your plan requests. Check that migration 003 has been applied.');
  const pending=requests.data.find(r=>r.status==='pending');
  return <WorkspaceShell admin={Boolean(admin.data)}><main className="section">
    <p className="eyebrow">{workspace.profile.name}</p><h1>Workspace plans</h1>
    <p>{sub ? plans[sub.plan].name+' is active through '+formatPlanEnd(sub.expires_at)+'.' : 'Choose a monthly plan to start issuing invoices.'}</p>
    {result==='error' && <p className="notice" role="alert">Could not submit your request. Try again.</p>}
    {pending ? <section className="card"><h2>Pending approval</h2><p>Your {pending.plan==='basic'?'Basic':'Plus'} request has been sent to BillQuill. Access starts after approval.</p></section>
    : <form className="card stack plan-request" action={requestPlan}><input type="hidden" name="workspace" value={workspace.id}/><h2>Request a plan</h2>
      <label className="field">Monthly plan<select name="plan" defaultValue={plan==='plus'?'plus':'basic'}>{Object.entries(plans).map(([id,p])=><option key={id} value={id}>{p.name} · PKR {p.price.toLocaleString('en')}/month</option>)}</select></label>
      <label className="field">Preferred Basic template<select name="template">{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><small>Plus includes all five templates.</small></label>
      <div><button className="button">Submit request</button></div>
    </form>}
    {requests.data.some(r=>r.status!=='pending') && <section className="plan-note"><h2>Recent decisions</h2>{requests.data.filter(r=>r.status!=='pending').map(r=><div className="mockrow" key={r.id}><span>{r.plan==='basic'?'Basic':'Plus'}</span><span className="pill">{r.status}</span></div>)}</section>}
    <p><Link href="/pricing">Compare plans</Link></p>
  </main></WorkspaceShell>;
}