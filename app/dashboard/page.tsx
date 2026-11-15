import Link from 'next/link';
import { Archive, Eye, Pencil, Plus } from 'lucide-react';
import { WorkspaceShell } from '../../components/workspace-shell';
import { ConfirmButton } from '../../components/confirm-button';
import { changeInvoice, createDraft } from '../actions';
import { getSubscription, requireWorkspace } from '../../lib/supabase';
import { currencies, invoiceNumber, money, totals, type SavedInvoice } from '../../lib/invoice';
import { formatPlanEnd, plans } from '../../lib/plans';
export const metadata={title:'Invoices',robots:{index:false}};
const pageSize=25;
type Filters={q?:string;status?:string;currency?:string;history?:string;page?:string};
export default async function Dashboard({searchParams}:{searchParams:Promise<Filters>}) {
  const {db,workspace}=await requireWorkspace();
  const {q='',status='all',currency='all',history='current',page='1'}=await searchParams;
  const currentPage=Math.min(100000,Math.max(1,Number.parseInt(page,10)||1));
  let query=db.from('invoices').select('id,number,status,data,created_at,updated_at,archived_at',{count:'exact'}).eq('workspace_id',workspace.id).order('updated_at',{ascending:false}).order('id');
  query=history==='archived'?query.not('archived_at','is',null):query.is('archived_at',null);
  if(['draft','issued','paid'].includes(status)) query=query.eq('status',status);
  if(currencies.some(c=>c===currency)) query=query.eq('data->>currency',currency);
  const search=q.trim().slice(0,100).replace(/[%_*\\]/g,'');
  const number=/^(?:INV-)?0*(\d+)$/i.exec(search);
  if(number && Number(number[1])<=2147483647) query=query.eq('number',Number(number[1]));
  else if(search) query=query.ilike('data->>client','%'+search+'%');
  const [rows,admin,subscription]=await Promise.all([query.range((currentPage-1)*pageSize,currentPage*pageSize-1),db.rpc('is_admin'),getSubscription(db,workspace.id)]);
  if(rows.error) throw new Error('Could not load invoices.');
  const invoices=rows.data as SavedInvoice[];
  const pages=Math.max(1,Math.ceil((rows.count||0)/pageSize));
  const pageLink=(next:number)=>'/dashboard?'+new URLSearchParams({q,status,currency,history,page:String(next)});
  return <WorkspaceShell admin={Boolean(admin.data)}><main className="section">
    <div className="heading"><div><p className="eyebrow">{workspace.profile.name}</p><h1>Invoices</h1></div>
    {subscription ? <form action={createDraft}><input type="hidden" name="workspace" value={workspace.id}/><button className="button"><Plus size={18}/> New invoice</button></form>:<Link className="button" href="/plans">Choose a plan</Link>}</div>
    <div className="card subscription-card"><div><b>{subscription?plans[subscription.plan].name+' plan is active':'No active plan'}</b>
      <p>{subscription?'Ends '+formatPlanEnd(subscription.expires_at):'Activate a plan to issue and export invoices.'}</p></div><Link className="button secondary small" href="/plans">Manage plan</Link></div>
    <section className="card stack"><form className="filters" action="/dashboard">
      <input name="q" aria-label="Search invoices" defaultValue={q} placeholder="Client or invoice number"/>
      <select aria-label="Status" name="status" defaultValue={status}><option value="all">All statuses</option><option value="draft">Draft</option><option value="issued">Issued</option><option value="paid">Paid</option></select>
      <select aria-label="Currency" name="currency" defaultValue={currency}><option value="all">All currencies</option>{currencies.map(c=><option key={c}>{c}</option>)}</select>
      <select aria-label="History" name="history" defaultValue={history}><option value="current">Current</option><option value="archived">Archived</option></select>
      <button className="button secondary small">Apply</button>
    </form>
    {invoices.length===0?<p>No invoices match these filters.</p>:<div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Client</th><th>Status</th><th>Updated</th><th>Total</th><th>Actions</th></tr></thead><tbody>
      {invoices.map(i=>{const href='/invoices/'+i.id;return <tr key={i.id}>
        <td><Link href={href+'?view=1'}>{invoiceNumber(i.number)}</Link></td><td>{i.data.client||'—'}</td>
        <td><span className="pill">{i.status}</span></td><td>{new Intl.DateTimeFormat('en-PK',{dateStyle:'medium',timeZone:'Asia/Karachi'}).format(new Date(i.updated_at))}</td>
        <td>{money(totals(i.data).total,i.data.currency)}</td>
        <td><div className="row-tools"><Link href={href+'?view=1'} className="icon-button" aria-label="View invoice" title="View"><Eye size={17}/></Link>
          {i.status==='draft' && !i.archived_at && <Link href={href} className="icon-button" aria-label="Edit draft" title="Edit draft"><Pencil size={17}/></Link>}
          {!i.archived_at && <form action={changeInvoice}><input type="hidden" name="id" value={i.id}/><ConfirmButton className="icon-button" name="mode" value="archive" title="Archive invoice" aria-label="Archive invoice" message="Move this invoice to the archive? Its history will be retained."><Archive size={17}/></ConfirmButton></form>}
        </div></td>
      </tr>;})}
    </tbody></table></div>}
    {pages>1 && <nav className="actions" aria-label="Invoice pages">{currentPage>1&&<Link href={pageLink(currentPage-1)}>Previous</Link>}<span>Page {currentPage} of {pages}</span>{currentPage<pages&&<Link href={pageLink(currentPage+1)}>Next</Link>}</nav>}
    </section></main></WorkspaceShell>;
}