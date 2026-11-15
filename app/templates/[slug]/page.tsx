import { notFound } from 'next/navigation';
import Link from 'next/link';
import { InvoiceEditor } from '../../../components/invoice-editor';
import { sampleProfile,sampleInvoice,templates } from '../../../lib/invoice';
type Props={params:Promise<{slug:string}>};
export const generateStaticParams=()=>templates.map(t=>({slug:t.id}));
export async function generateMetadata({params}:Props){
  const {slug}=await params;const t=templates.find(item=>item.id===slug);
  if(!t) notFound();
  return {title:t.name+' invoice template',description:t.description,alternates:{canonical:'/templates/'+t.id}};
}
export default async function Template({params}:Props){
  const {slug}=await params;const t=templates.find(item=>item.id===slug);
  if(!t) notFound();
  return <main className="wrap section"><Link href="/templates">← All templates</Link><h1>{t.name} invoice template</h1><p>{t.description}</p>
    <InvoiceEditor profile={sampleProfile} initial={{...sampleInvoice,template:t.id}}/></main>;
}