import Link from 'next/link';
import { templates } from '../lib/invoice';
export function TemplateList() {
  return <div className="grid three">{templates.map(t=><Link className="card template-card" key={t.id} href={'/templates/'+t.id}>
    <div className={'mini-invoice '+t.id} style={{'--accent':t.color} as React.CSSProperties} aria-hidden="true"><div>Invoice</div><span/><span/><span/><b/></div>
    <div className="heading"><h2>{t.name}</h2></div><p>{t.description}</p>
  </Link>)}</div>;
}