import Link from 'next/link';
import { Building2, Pencil, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { WorkspaceShell } from '../../components/workspace-shell';
import { ConfirmButton } from '../../components/confirm-button';
import { requireAccount, selectedBusiness } from '../../lib/supabase';
import { selectBusiness, changeBusinessStatus } from '../actions';
export const metadata={title:'Businesses',robots:{index:false}};
export default async function Businesses(){
  const {db,userId}=await requireAccount();
  const [businesses,admin,current]=await Promise.all([
    db.from('workspaces').select('id,profile,status').eq('owner_id',userId).neq('status','removed').order('created_at'),
    db.rpc('is_admin'),selectedBusiness(),
  ]);
  if(businesses.error) throw new Error('Could not load businesses.');
  return <WorkspaceShell admin={Boolean(admin.data)}><main className="section">
    <div className="heading"><div><h1>Your businesses</h1><p>Manage company details and switch between separate invoice workspaces.</p></div><Link href="/settings?new=1" className="button"><Plus size={18}/> Add business</Link></div>
    <div className="grid two business-list">{businesses.data.map(b=><article className="card stack" key={b.id}>
      <div className="business-mark"><Building2 size={22}/></div><h2>{b.profile.name}</h2>
      <div className="business-meta"><span>{b.profile.country || 'Business workspace'} · {b.profile.currency}</span><span className="pill">{b.status==='suspended'?'Suspended':current===b.id?'Selected':'Active'}</span></div>
      <div className="actions">
        {b.status==='active' && <><form action={selectBusiness}><input type="hidden" name="id" value={b.id}/><button className="button small">Open workspace <ArrowRight size={15}/></button></form>
        <Link className="button secondary small" href={'/settings?id='+b.id}><Pencil size={15}/> Edit</Link></>}
        <form action={changeBusinessStatus}><input type="hidden" name="id" value={b.id}/><input type="hidden" name="returnTo" value="businesses"/>
          <ConfirmButton className="button secondary small" name="status" value="removed" message={'Remove '+b.profile.name+'? Its invoice history will be retained and workspace access will end.'}><Trash2 size={15}/> Remove</ConfirmButton></form>
      </div>
    </article>)}</div>
    {businesses.data.length===0 && <article className="card"><h2>Set up your first business</h2><p>Add a trading name to create a workspace and choose a plan.</p></article>}
  </main></WorkspaceShell>;
}