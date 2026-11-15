import Link from 'next/link';
import { extraTemplatePrice, plans } from '../../lib/plans';
export const metadata={title:'Plans and pricing',description:'Monthly BillQuill plans for unlimited invoices and customizable templates.',alternates:{canonical:'/pricing'}};
const price=(n:number)=>'PKR '+n.toLocaleString('en');
export default function Pricing(){return <main className="wrap section"><p className="eyebrow">PLANS</p><h1>Choose how you invoice</h1><p>Every subscription includes unlimited invoices, PDF and JPEG downloads, and printing.</p>
  <div className="grid three plans">{Object.entries(plans).map(([key,plan])=><article key={key} className="card">
    <h2>{plan.name}</h2><div className="price">{price(plan.price)} <small>/ month</small></div>
    <p>{key==='basic'?'Choose one of the five designs when you activate your plan.':'Use all five invoice designs with your subscription.'}</p>
    <Link href={'/plans?plan='+key} className="button">Request {plan.name}</Link></article>)}
    <article className="card"><h2>Custom letterhead</h2><div className="price">By quote</div><p>Request a branded invoice layout tailored to your company.</p><Link className="button secondary" href="/contact?topic=custom-letterhead">Request a quote</Link></article></div>
  <section className="card plan-note"><h2>Extra designs</h2><p>Basic subscribers can add any other design for {price(extraTemplatePrice)} per design, paid once. Purchased designs stay on your workspace and can be used whenever your subscription is active.</p><Link href="/contact?topic=subscription">Request an extra design</Link></section>
  <p className="notice">Sign in and register your business first. Your plan activates after BillQuill approves the request.</p></main>;}