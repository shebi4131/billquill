import { ConfirmButton } from '../../components/confirm-button';
import { notFound } from 'next/navigation';
import { requireAccount } from '../../lib/supabase';
import { templates } from '../../lib/invoice';
import { changeEntitlement, changeSubscription, reviewPlanRequest, changeBusinessStatus } from '../actions';
import { WorkspaceShell } from '../../components/workspace-shell';
export const dynamic='force-dynamic';
export const metadata={title:'Superadmin',robots:{index:false}};
export default async function Admin({searchParams}:{searchParams:Promise<{q?:string}>}) {
  const {db}=await requireAccount();
  if(!(await db.rpc('is_admin')).data) notFound();
  const {q=''}=await searchParams;
  let query=db.from('workspaces').select('id,profile,status').order('created_at',{ascending:false});
  if(q.trim()) query=query.ilike('profile->>name','%'+q.trim().slice(0,100).replace(/[%_*\\]/g,'')+'%');
  const [workspaces,requests,pending]=await Promise.all([query.limit(100),db.from('contact_requests').select('*').order('created_at',{ascending:false}).limit(50),db.from('plan_requests').select('id,plan,included_template,created_at,workspaces(profile,status)').eq('status','pending').order('created_at').limit(50)]);
  if(workspaces.error || requests.error || pending.error) throw new Error('Could not load the admin workspace.');
  const ids=workspaces.data.map(w=>w.id);
  const [access,subscriptions]=ids.length?await Promise.all([
    db.from('template_entitlements').select('workspace_id,template').in('workspace_id',ids),
    db.from('workspace_subscriptions').select('*').in('workspace_id',ids),
  ]):[{data:[],error:null},{data:[],error:null}];
  if(access.error || subscriptions.error) throw new Error('Could not load access settings.');
  return <WorkspaceShell admin><main className="section"><h1>Superadmin</h1>
    <section className="stack plan-queue"><h2>Pending plan requests</h2>
      {pending.data.length===0 && <p>No plans awaiting approval.</p>}
      {pending.data.map(r=>{
        const business=r.workspaces as unknown as {profile:{name?:string};status:string}|null;
        const design=templates.find(t=>t.id===r.included_template);
        return <article className="card heading" key={r.id}><div><b>{business?.profile.name || 'Workspace'}</b>
          <p>{r.plan==='basic'?'Basic · '+design?.name:'Plus · All five templates'}</p></div>
          <form className="actions" action={reviewPlanRequest}><input type="hidden" name="id" value={r.id}/>
            <button className="button secondary small" name="decision" value="decline">Decline</button>
            <button className="button small" name="decision" value="approve" disabled={business?.status!=='active'}>Approve and activate</button>
          </form>
        </article>;
      })}
    </section>
    <form className="actions" action="/admin"><input name="q" aria-label="Business name" defaultValue={q} placeholder="Search businesses"/><button className="button secondary">Search</button></form>
    <div className="grid two">{workspaces.data.map(w=>{
      const sub=subscriptions.data?.find(s=>s.workspace_id===w.id);
      return <article className="card stack" key={w.id}><h2>{w.profile.name}</h2><span className="pill">{w.status}</span><small>{w.id}</small>
      {w.status!=='removed' && <form className="actions" action={changeBusinessStatus}><input type="hidden" name="id" value={w.id}/><ConfirmButton className="button secondary small" name="status" value={w.status==='active'?'suspended':'active'} message="Change access for this business?">{w.status==='active'?'Suspend':'Activate'}</ConfirmButton><ConfirmButton className="button secondary small" name="status" value="removed" message="Remove this business? Records will be retained.">Remove</ConfirmButton></form>}
      {w.status==='active' && <>
      <form action={changeSubscription} className="stack"><input type="hidden" name="workspace" value={w.id}/>
        <label className="field">Plan<select name="plan" defaultValue={sub?.plan || 'basic'}><option value="basic">Basic</option><option value="plus">Plus</option></select></label>
        <label className="field">Included Basic design<select name="included" defaultValue={sub?.included_template || 'essential'}>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="field">Expires at end of day (Pakistan time)<input type="date" name="expires" defaultValue={sub?.expires_at ? new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi'}).format(new Date(sub.expires_at)):undefined} required/></label>
        <div className="actions"><button className="button small" name="mode" value="save">Save plan</button>{sub && <button formNoValidate className="button secondary small" name="mode" value="cancel">Cancel access</button>}</div>
      </form><b>One-time design purchases</b>
      {templates.map(t=>{const enabled=access.data?.some(a=>a.workspace_id===w.id && a.template===t.id);
      return <form action={changeEntitlement} className="mockrow" key={t.id}><span>{t.name}</span><input type="hidden" name="workspace" value={w.id}/><input type="hidden" name="template" value={t.id}/><button className="button secondary small" name="mode" value={enabled?'revoke':'grant'}>{enabled?'Revoke purchase':'Grant purchase'}</button></form>;})}</>}</article>;
    })}</div>
    {!workspaces.data.length && <p>No businesses found.</p>}
    <section className="plan-note stack"><h2>Contact requests</h2>
      {requests.data.length===0 && <p>No requests yet.</p>}
      {requests.data.map(r=><article className="card" key={r.id}><b>{r.name} · {r.topic}</b><p><a href={'mailto:'+r.email}>{r.email}</a></p><p className="preserve">{r.message}</p></article>)}
    </section>
  </main></WorkspaceShell>;
}