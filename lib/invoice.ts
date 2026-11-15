import Decimal from 'decimal.js';
import { z } from 'zod';

export const currencies = ['PKR','USD','GBP','EUR','CAD','AUD','AED','SAR','JPY'] as const;
export const templates = [
  { id:'essential', name:'Essential', description:'A clean, monochrome layout.', color:'#25302f' },
  { id:'studio', name:'Studio', description:'An understated editorial layout.', color:'#5844a0' },
  { id:'ledger', name:'Ledger', description:'A structured layout for detailed billing.', color:'#25527a' },
  { id:'letterhead', name:'Letterhead', description:'A formal, centered business header.', color:'#6c442b' },
  { id:'accent', name:'Accent', description:'A bold banner with prominent totals.', color:'#164f40' },
] as const;
const short = z.string().max(240);
const date = z.union([z.literal(''), z.iso.date()]);
const amount = (max: number) => z.string().regex(/^\d{0,8}(\.\d{0,4})?$/).refine(s => Number(s) <= max);
export const profileSchema = z.object({
  name: short.trim().min(1), legalName: short, country:short, address:short, email:z.union([z.literal(''),z.email()]),
  phone:short, website:short, registration:short, taxId:short, currency:z.enum(currencies),
  logo:short, payment:z.string().max(1000), taxLabel:short, taxRate:amount(100),
});
export const invoiceSchema = z.object({
  client:short, clientEmail:z.union([z.literal(''),z.email()]), clientAddress:short, clientTaxId:short,
  date, due:date, currency:z.enum(currencies), template:z.enum(['essential','studio','ledger','letterhead','accent']),
  taxLabel:short, taxRate:amount(100), taxEnabled:z.boolean(), discount:amount(100),
  logoPosition:z.enum(['left','center','right']), addressLayout:z.enum(['columns','stacked']),
  accentColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  addressSize:z.enum(['compact','regular','large']).optional(),
  footer:z.string().max(240).optional(),
  notes:z.string().max(2000), payment:z.string().max(1000),
  items:z.array(z.object({description:short, quantity:amount(999999), unitPrice:amount(99999999)})).min(1).max(100),
});
export type Profile = z.infer<typeof profileSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export const emptyProfile: Profile = {name:'',legalName:'',country:'Pakistan',address:'',email:'',phone:'',website:'',registration:'',taxId:'',currency:'PKR',logo:'',payment:'',taxLabel:'Sales Tax',taxRate:'0'};
export const newInvoice = (profile: Profile): Invoice => ({
  client:'',clientEmail:'',clientAddress:'',clientTaxId:'',date:'',due:'',currency:profile.currency,template:'essential',
  taxLabel:profile.taxLabel,taxRate:profile.taxRate,taxEnabled:false,discount:'0',
  logoPosition:'left',addressLayout:'columns',notes:'',payment:profile.payment,
  items:[{description:'',quantity:'1',unitPrice:''}],
});
export const sampleProfile: Profile = {...emptyProfile,name:'Northline Studio',address:'Lahore, Pakistan',email:'studio@example.com'};
export const sampleInvoice: Invoice = {...newInvoice(sampleProfile),client:'Fieldwork Coffee',date:'2026-11-15',due:'2026-11-29',
  items:[{description:'Brand identity', quantity:'1',unitPrice:'24000'},{description:'Packaging design', quantity:'1',unitPrice:'12000'}]};
function decimal(value: string) {
  return /^\d{0,8}(\.\d{0,4})?$/.test(value) && Number.isFinite(Number(value)) ? new Decimal(value || '0') : new Decimal(0);
}
export function totals(invoice: Invoice) {
  const scale = invoice.currency === 'JPY' ? 0 : 2;
  const round = (value: Decimal) => value.toDecimalPlaces(scale, Decimal.ROUND_HALF_UP);
  const lines = invoice.items.map(item => round(decimal(item.quantity).times(decimal(item.unitPrice))));
  const subtotal = lines.reduce((sum, line) => sum.plus(line), new Decimal(0));
  const discount = round(subtotal.times(Decimal.min(decimal(invoice.discount), 100)).div(100));
  const net = subtotal.minus(discount);
  const tax = invoice.taxEnabled ? round(net.times(Decimal.min(decimal(invoice.taxRate),100)).div(100)) : new Decimal(0);
  return {lines,subtotal,discount,tax,total:net.plus(tax)};
}
export const money = (value: Decimal.Value, currency: string) =>
  new Intl.NumberFormat('en', {style:'currency',currency,currencyDisplay:'code'}).format(Number.isFinite(Number(value)) ? Number(value) : 0);
export type SavedInvoice = {id:string, number:number|null, status:'draft'|'issued'|'paid', data:Invoice, seller:Profile|null, updated_at:string;created_at?:string|null;created_by?:string|null;updated_by?:string|null;issued_at?:string|null;paid_at?:string|null;archived_at?:string|null;archived_by?:string|null};
export const invoiceNumber = (number: number|null) => number === null ? 'Draft' : 'INV-' + String(number).padStart(4,'0');
export function invoiceAppearance(invoice:Invoice) {
  const template=templates.find(t=>t.id===invoice.template) || templates[0];
  const accent=invoice.accentColor && /^#[0-9a-f]{6}$/i.test(invoice.accentColor)?invoice.accentColor:template.color;
  const [r,g,b]=[1,3,5].map(i=>parseInt(accent.slice(i,i+2),16)/255)
    .map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  const onAccent=0.2126*r+0.7152*g+0.0722*b>0.179?'#151515':'#ffffff';
  const sizes={essential:9,studio:9,ledger:8,letterhead:9,accent:8};
  const infoSize=sizes[template.id]+(invoice.addressSize==='compact'?-1:invoice.addressSize==='large'?2:0);
  return {template,accent,onAccent,infoSize};
}
