import Link from 'next/link';
import { TemplateList } from '../components/template-list';
import { ArrowRight, Check, FileText, Layers, Calculator } from 'lucide-react';
export const metadata = { alternates: { canonical: '/' } };

export default function Home() {
  return <main><section className="hero wrap">
    <div><p className="eyebrow">ONLINE INVOICE GENERATOR</p><h1>Invoices made <em>simple.</em></h1>
    <p className="intro">Create a branded invoice, see every change live, and download a polished PDF ready to send.</p>
    <div className="actions"><Link className="button" href="/login?mode=register">Set up your business <ArrowRight size={18}/></Link><Link className="button secondary" href="/invoice-generator">Preview the editor</Link></div>
    <div className="perks"><span><Check size={16}/> Five invoice designs</span><span><Check size={16}/> PKR and international currencies</span></div></div>
    <div className="mock"><article className="paper"><div className="paper-head"><div><b>Northline Studio</b><p>Design & creative services</p></div><div><strong>Invoice</strong><p>INV-0012</p></div></div>
    <p className="eyebrow">BILL TO</p><b>Fieldwork Coffee</b><div className="mockrow"><span>Brand identity</span><b>PKR 24,000</b></div><div className="mockrow"><span>Packaging design</span><b>PKR 12,000</b></div><div className="mocktotal"><span>Amount due</span><b>PKR 36,000</b></div></article></div>
  </section><section className="wrap features"><h2>From draft to ready to send</h2><div className="grid three">
    {[[FileText,'Make it yours','Save your business details and add a logo once.'],[Calculator,'See the totals live','Adjust line items, discounts, and optional tax as you work.'],[Layers,'Choose your design','Choose one design with Basic or get all five with Plus.']].map(([Icon,title,copy])=>{const Glyph=Icon as typeof FileText;return <article className="card" key={String(title)}><Glyph size={23}/><h3>{String(title)}</h3><p>{String(copy)}</p></article>})}
  </div></section><section className="wrap features"><h2>Find your invoice style</h2><TemplateList/></section></main>;
}