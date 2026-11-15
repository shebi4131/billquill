import Link from 'next/link';
import { notFound } from 'next/navigation';
import { WorkspaceShell } from '../../components/workspace-shell';
import { BusinessForm } from '../../components/business-form';
import { emptyProfile } from '../../lib/invoice';
import { activeBusiness, requireAccount } from '../../lib/supabase';
export const metadata={title:'Business settings',robots:{index:false}};
export default async function Settings({searchParams}:{searchParams:Promise<{id?:string;new?:string}>}) {
  const {db,userId}=await requireAccount();
  const params=await searchParams;
  const data=params.new==='1' ? null : await activeBusiness(db,userId,params.id);
  if(params.id && !data) notFound();
  const profile={...emptyProfile,...data?.profile};
  const [logo,admin]=await Promise.all([
    profile.logo ? db.storage.from('logos').createSignedUrl(profile.logo,3600) : null,db.rpc('is_admin'),
  ]);
  return <WorkspaceShell admin={Boolean(admin.data)}><main className="section">
    <Link href="/businesses">← Your businesses</Link><h1>{data?'Edit business':'Add a business'}</h1>
    <p>These details appear on your invoices. You can update them anytime.</p>
    <BusinessForm key={data?.id || 'new'} businessId={data?.id} initial={profile} logoUrl={logo?.data?.signedUrl || ''}/>
  </main></WorkspaceShell>;
}