import Link from 'next/link';
import { WorkspaceShell } from '../../../components/workspace-shell';
import { notFound } from 'next/navigation';
import { InvoiceEditor } from '../../../components/invoice-editor';
import { emptyProfile, invoiceNumber, templates, type SavedInvoice } from '../../../lib/invoice';
import { formatPlanEnd } from '../../../lib/plans';
import { getSubscription, requireWorkspace } from '../../../lib/supabase';
import { changeInvoice,createDraft } from '../../actions';
export const metadata={title:'Invoice',robots:{index:false}};
export default async function InvoicePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{view?:string}>}) {
  const [{id},{view}]=await Promise.all([params,searchParams]);
  if(!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const {db,workspace}=await requireWorkspace();
  const [row,access,subscription,admin]=await Promise.all([
    db.from('invoices').select('*').eq('workspace_id',workspace.id).eq('id',id).maybeSingle(),
    db.from('template_entitlements').select('template').eq('workspace_id',workspace.id),
    getSubscription(db,workspace.id),db.rpc('is_admin'),
  ]);
  if(row.error || access.error) throw new Error('Could not load invoice.');
  if(!row.data) notFound();
  const invoice=row.data as SavedInvoice;
  const profile={...emptyProfile,...(invoice.seller || workspace.profile)};
  const logo=profile.logo?(await db.storage.from('logos').createSignedUrl(profile.logo,3600)).data?.signedUrl:undefined;
  const allowed=subscription?.plan==='plus'?templates.map(t=>t.id):subscription?[subscription.included_template,...access.data.map(e=>e.template)]:[];
  const readOnly=Boolean(invoice.archived_at)||view==='1';
  const audit=[
    ['Created',invoice.created_at,invoice.created_by],['Updated',invoice.updated_at,invoice.updated_by],
    ['Issued',invoice.issued_at],['Marked paid',invoice.paid_at],['Archived',invoice.archived_at,invoice.archived_by],
  ];
  return <WorkspaceShell admin={Boolean(admin.data)}><main className="section"><Link href="/dashboard">← Invoices</Link>
    <div className="heading"><div><p className="eyebrow">{workspace.profile.name}{invoice.archived_at?' · Archived':''}</p><h1>{invoice.number?invoiceNumber(invoice.number):'Invoice draft'}</h1></div><div className="actions">
      {invoice.status==='draft' && !invoice.archived_at && readOnly && <Link className="button" href={'/invoices/'+id}>Edit draft</Link>}
      {subscription && !invoice.archived_at && <form action={createDraft}><input type="hidden" name="workspace" value={workspace.id}/><input type="hidden" name="source" value={id}/><button className="button secondary">Duplicate</button></form>}
      {invoice.status==='issued' && !invoice.archived_at && <form action={changeInvoice}><input type="hidden" name="id" value={id}/><button className="button secondary" name="mode" value="paid">Mark paid</button></form>}
    </div></div>
    <InvoiceEditor key={id+invoice.status+readOnly} initial={invoice.data} profile={profile} logoUrl={logo} id={id} number={invoice.number} status={invoice.status} entitlements={allowed} activePlan={Boolean(subscription)} readOnly={readOnly}/>
    <details className="card plan-note audit-panel"><summary>Invoice history</summary><dl>{audit.filter(([,date])=>date).map(([label,date,actor])=><div key={label}><dt>{label}</dt><dd>{formatPlanEnd(date!)}{actor&&<small>Account {actor}</small>}</dd></div>)}</dl></details>
  </main></WorkspaceShell>;
}