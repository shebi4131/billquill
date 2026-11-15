'use client';
import { Download, Mail, MessageCircle, Printer, Share2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { currencies, invoiceAppearance, invoiceNumber, money, templates, totals, type Profile, type Invoice } from '../lib/invoice';
import { issueInvoice, saveDraft } from '../app/actions';
import { Field } from './fields';
type Props={initial:Invoice;profile:Profile;logoUrl?:string;id?:string;number?:number|null;status?:'draft'|'issued'|'paid';entitlements?:string[];activePlan?:boolean;readOnly?:boolean};
export function InvoiceEditor({initial,profile,logoUrl,id,number=null,status='draft',entitlements=[],activePlan=false,readOnly=false}:Props) {
  const [invoice,setInvoice]=useState(initial);
  const [tab,setTab]=useState<'edit'|'preview'>('edit');
  const [feedback,setFeedback]=useState('');
  const [pending,start]=useTransition();
  const [colorInput,setColorInput]=useState(initial.accentColor || '');
  const [exportError,setExportError]=useState('');
  const [exportBusy,setExportBusy]=useState(false);
  const paper=useRef<HTMLElement>(null);
  const edited=useRef(false);
  const saveQueue=useRef<Promise<unknown>>(Promise.resolve());
  const editable=status==='draft'&&!readOnly;
  const demo=!id;
  const locked=!demo && editable && (!activePlan || !entitlements.includes(invoice.template));
  const canExport=!demo && status!=='draft' && activePlan;
  async function downloadJpeg() {
    if(!canExport || !paper.current) return;
    setExportBusy(true);
    setExportError('');
    try {
      const {toJpeg}=await import('html-to-image');
      const url=await toJpeg(paper.current,{quality:0.95,pixelRatio:2,backgroundColor:'#fff',skipFonts:true,style:{boxShadow:'none',borderRadius:'0'}});
      const link=document.createElement('a');
      link.href=url;
      link.download=invoiceNumber(number)+'.jpg';
      link.click();
    } catch {
      setExportError('Could not export JPEG. Try again or use PDF.');
    } finally {
      setExportBusy(false);
    }
  }
  async function exportPdf(share=false) {
    if(!canExport) return;
    setExportBusy(true);setExportError('');
    try {
      const {createInvoicePdf}=await import('./invoice-pdf');
      const blob=await createInvoicePdf({invoice,profile,logoUrl,number});
      const filename=invoiceNumber(number)+'.pdf';
      const file=new File([blob],filename,{type:'application/pdf'});
      if(share && navigator.canShare?.({files:[file]})) {
        try {
          await navigator.share({files:[file],title:'Invoice '+invoiceNumber(number)});
          return;
        } catch(error) {
          if(error instanceof DOMException && error.name==='AbortError') return;
        }
      }
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=url;link.download=filename;link.click();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      if(share) setExportError('PDF downloaded. Attach it in WhatsApp or email.');
    } catch(error) {
      if(!(error instanceof DOMException && error.name==='AbortError')) setExportError('Could not export or share the PDF.');
    } finally {setExportBusy(false);}
  }
  const {template:design,accent,onAccent,infoSize}=invoiceAppearance(invoice);
  const sum=totals(invoice);
  const currency=(value:Parameters<typeof money>[0])=>money(value,invoice.currency);
  useEffect(()=>{
    if(!id || !editable || !edited.current || pending) return;
    let active=true;
    const timer=setTimeout(()=>{
      const save=saveQueue.current.then(()=>active ? saveDraft(id,invoice) : null);
      saveQueue.current=save.catch(()=>undefined);
      save.then(result=>{if(active && result)setFeedback(result.error || 'Draft saved');}).catch(()=>{if(active)setFeedback('Could not save draft.');});
    },750);
    return ()=>{active=false;clearTimeout(timer);};
  },[id,invoice,editable,pending]);
  function update<K extends keyof Invoice>(key:K,value:Invoice[K]) {
    edited.current=true;setFeedback(id?'Saving draft…':'');setInvoice(previous=>({...previous,[key]:value}));
  }
  const shareText='Invoice '+invoiceNumber(number)+' from '+profile.name+' — '+currency(sum.total)+(invoice.due?' · Due '+invoice.due:'');
  const exportTools=()=> <div className="actions invoice-tools">
    <button className="button secondary small" disabled={exportBusy} onClick={()=>exportPdf()}><Download size={16}/> PDF</button>
    <button className="button secondary small" disabled={exportBusy} onClick={downloadJpeg}><Download size={16}/> JPEG</button>
    <button className="button secondary small" onClick={()=>window.print()}><Printer size={16}/> Print</button>
    <a className="button secondary small" href={'https://wa.me/?text='+encodeURIComponent(shareText)} target="_blank" rel="noreferrer"><MessageCircle size={16}/> WhatsApp</a>
    <a className="button secondary small" href={'mailto:'+encodeURIComponent(invoice.clientEmail)+'?subject='+encodeURIComponent('Invoice '+invoiceNumber(number))+'&body='+encodeURIComponent(shareText)}><Mail size={16}/> Email</a>
    <button className="button secondary small" disabled={exportBusy} onClick={()=>exportPdf(true)}><Share2 size={16}/> Share PDF</button>
  </div>;
  const field=(key:'client'|'clientEmail'|'clientAddress'|'clientTaxId'|'date'|'due'|'discount'|'taxLabel'|'taxRate',label:string,type='text')=><Field label={label} type={type} value={invoice[key]} inputMode={key==='discount'||key==='taxRate'?'decimal':undefined} onChange={e=>update(key,e.target.value)}/>;
  return <>{editable && <div className="mobile-tabs"><button className="button secondary" aria-pressed={tab==='edit'} onClick={()=>setTab('edit')}>Edit</button><button className="button secondary" aria-pressed={tab==='preview'} onClick={()=>setTab('preview')}>Preview</button><b>{currency(sum.total)}</b></div>}
  <div className={'editor '+(editable?'editable show-'+tab:'readonly')}>
    {editable && <section className="card stack editor-controls"><h2>Invoice details</h2>
      <fieldset disabled={pending}><legend>Client</legend><div className="grid two">{field('client','Client name')}{field('clientEmail','Client email','email')}{field('clientAddress','Billing address')}{field('clientTaxId','Client tax ID')}</div></fieldset>
      <fieldset disabled={pending}><legend>Invoice</legend><div className="grid two">{field('date','Invoice date','date')}{field('due','Due date','date')}
        <Field label="Currency"><select value={invoice.currency} onChange={e=>update('currency',e.target.value as Invoice['currency'])}>{currencies.map(c=><option key={c}>{c}</option>)}</select></Field>{field('discount','Discount (%)')}
      </div></fieldset>
      <fieldset disabled={pending}><legend>Line items</legend><div className="stack">
        {invoice.items.map((item,i)=><div className="item-fields" key={i}>
          <Field label={'Item '+(i+1)} value={item.description} onChange={e=>update('items',invoice.items.map((old,j)=>i===j?{...old,description:e.target.value}:old))}/>
          <div className="grid two">{(['quantity','unitPrice'] as const).map(key=><Field key={key} label={key==='quantity'?'Quantity':'Unit price'} value={item[key]} inputMode="decimal" onChange={e=>update('items',invoice.items.map((old,j)=>i===j?{...old,[key]:e.target.value}:old))}/>)}</div>
          {invoice.items.length>1 && <button type="button" className="text-button" onClick={()=>update('items',invoice.items.filter((_,j)=>i!==j))}>Remove item {i+1}</button>}
        </div>)}
        <button type="button" className="button secondary" disabled={invoice.items.length>=100} onClick={()=>update('items',[...invoice.items,{description:'',quantity:'1',unitPrice:''}])}>+ Add item</button>
      </div></fieldset>
      <fieldset disabled={pending}><legend>Tax and notes</legend>
        <label><input type="checkbox" checked={invoice.taxEnabled} onChange={e=>update('taxEnabled',e.target.checked)}/> Apply tax</label>
        {invoice.taxEnabled && <div className="grid two">{field('taxLabel','Tax label')}{field('taxRate','Tax rate (%)')}</div>}
        <Field label="Payment instructions"><textarea value={invoice.payment} onChange={e=>update('payment',e.target.value)}/></Field>
        <Field label="Notes"><textarea value={invoice.notes} onChange={e=>update('notes',e.target.value)}/></Field>
      </fieldset>
      <fieldset disabled={pending}><legend>Appearance</legend>
        <Field label="Template"><select value={invoice.template} onChange={e=>update('template',e.target.value as Invoice['template'])}>{templates.map(t=><option key={t.id} value={t.id}>{t.name}{!demo && !entitlements.includes(t.id)?' · Locked':''}</option>)}</select></Field>
        <div className="grid two">
          <Field label="Accent color"><div className="color-control"><input aria-label="Choose accent color" type="color" value={accent} onChange={e=>{setColorInput(e.target.value);update('accentColor',e.target.value);}}/>
            <input aria-label="Hex color" value={colorInput} placeholder={accent} maxLength={7} onChange={e=>{
              const value=e.target.value.trim();setColorInput(value);
              const normalized=value.startsWith('#')?value:'#'+value;
              if(!value || /^#[0-9a-f]{6}$/i.test(normalized)) update('accentColor',value?normalized:undefined);
            }}/></div>{colorInput && !/^#?[0-9a-f]{6}$/i.test(colorInput) && <small>Enter a six-digit hex color.</small>}</Field>
          <Field label="Address text size"><select value={invoice.addressSize || 'regular'} onChange={e=>update('addressSize',e.target.value as Invoice['addressSize'])}><option value="compact">Compact</option><option value="regular">Template default</option><option value="large">Large</option></select></Field>
          <Field label="Logo position"><select value={invoice.logoPosition} onChange={e=>update('logoPosition',e.target.value as Invoice['logoPosition'])}><option>left</option><option>center</option><option>right</option></select></Field>
          <Field label="Address layout"><select value={invoice.addressLayout} onChange={e=>update('addressLayout',e.target.value as Invoice['addressLayout'])}><option>columns</option><option>stacked</option></select></Field>
        </div>
        <Field label="Invoice footer" value={invoice.footer || ''} maxLength={240} placeholder="Business name or a short thank-you" onChange={e=>update('footer',e.target.value)}/>
      </fieldset>
      {locked && <p className="notice">{activePlan?"This design is outside your plan.":"An active plan is required to issue invoices."} <Link href="/pricing">View prices</Link>.</p>}
      {id && <div className="actions"><button className="button secondary" disabled={pending} onClick={()=>start(async()=>{await saveQueue.current;const result=await saveDraft(id,invoice);if(!result.error)edited.current=false;setFeedback(result.error || "Draft saved");})}>Save draft</button>
        <button className="button" disabled={pending||locked} onClick={()=>start(async()=>{const result=await issueInvoice(id,invoice);if(result?.error)setFeedback(result.error);})}>Issue now</button>
        <span role="status">{feedback}</span>
      </div>}
    </section>}
    <section className="preview-panel"><div className="preview-label"><span>Invoice preview</span><span>{status==='draft'?'Draft':status==='paid'?'Paid':'Issued'}</span></div>
      {canExport && exportTools()}
      {editable && id && <p className="preview-help">Issue this draft to unlock PDF, JPEG, WhatsApp and email.</p>}
      <article ref={paper} className={'paper invoice '+design.id+(canExport?' printable-invoice':'')} style={{'--accent':accent,'--on-accent':onAccent,'--info-size':(infoSize+2)+'px'} as React.CSSProperties}>
        {logoUrl && <div style={{textAlign:invoice.logoPosition}}><img className="logo-preview" src={logoUrl} alt="Business logo"/></div>}
        {demo && <p className="preview-watermark">BILLQUILL SAMPLE</p>}<div className="paper-head"><b>{profile.name || 'Your business'}</b><div><strong>Invoice</strong><p>{invoiceNumber(number)}</p></div></div>
        <div className={'addresses '+invoice.addressLayout}><div><p className="eyebrow">FROM</p>
          {[profile.legalName || profile.name,profile.address,profile.country,profile.email,profile.phone,profile.website,profile.registration && 'Registration: '+profile.registration,profile.taxId && 'Tax ID: '+profile.taxId].filter(Boolean).map((line,i)=><div key={i}>{line}</div>)}</div>
          <div><p className="eyebrow">BILL TO</p><b>{invoice.client || 'Client name'}</b><div>{invoice.clientAddress}</div><div>{invoice.clientEmail}</div>{invoice.clientTaxId && <div>Tax ID: {invoice.clientTaxId}</div>}</div>
        </div>
        <div className="mockrow"><span>Issued {invoice.date || '—'}</span><span>Due {invoice.due || '—'}</span></div>
        <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>{invoice.items.map((item,i)=><tr key={i}><td>{item.description || '—'}</td><td>{item.quantity}</td><td>{currency(item.unitPrice || 0)}</td><td>{currency(sum.lines[i])}</td></tr>)}</tbody></table>
        <div className="invoice-totals"><div className="mockrow"><span>Subtotal</span><span>{currency(sum.subtotal)}</span></div>
        {sum.discount.gt(0) && <div className="mockrow"><span>Discount</span><span>{currency(sum.discount.negated())}</span></div>}
        {invoice.taxEnabled && <div className="mockrow"><span>{invoice.taxLabel || 'Tax'}</span><span>{currency(sum.tax)}</span></div>}
        <div className="mocktotal"><span>Amount due</span><b>{currency(sum.total)}</b></div></div>
        {[['Payment instructions',invoice.payment],['Notes',invoice.notes]].map(([label,value])=>value && <div className="invoice-note" key={label}><b>{label}</b><p>{value}</p></div>)}
        <footer className="invoice-footer"><span>{invoice.footer?.trim() || profile.legalName || profile.name || "Thank you for your business."}</span><span>{invoiceNumber(number)}</span></footer>
      </article>
      {canExport && exportTools()}
      {exportError && <p role="alert" className="notice">{exportError}</p>}
      {demo && <p><Link href="/login?mode=register">Register your business</Link> to issue, download, or print invoices with a plan.</p>}
      {!demo && status!=='draft' && !activePlan && <p className="notice"><Link href="/pricing">Activate a plan</Link> to download or print this invoice.</p>}
    </section>
  </div></>;
}