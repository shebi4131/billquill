'use client';
import { useActionState, useState } from 'react';
import { submitContact } from '../app/actions';
import { Field } from './fields';
import { templates } from '../lib/invoice';
export function ContactForm({topic,initialMessage,available}:{topic:string;initialMessage:string;available:boolean}) {
  const [state,action,pending]=useActionState(submitContact,{message:'',success:false});
  const [selectedTopic,setTopic]=useState(topic);
  if(!available) return <p className="notice">The contact form will open once BillQuill’s database is connected.</p>;
  if(state.success) return <p className="notice" role="status">{state.message}</p>;
  return <form action={action} className="card stack">
    <div className="grid two"><Field name="name" label="Name" required maxLength={100}/><Field type="email" name="email" label="Reply email" required maxLength={254}/></div>
    <Field label="What is this about?"><select name="topic" value={selectedTopic} onChange={e=>setTopic(e.target.value)}><option value="custom-letterhead">Custom letterhead</option><option value="subscription">Plan or template purchase</option><option value="support">Other support</option></select></Field>
    {selectedTopic==="subscription" && <Field label="Preferred invoice design (optional)"><select name="template"><option value="">Choose later</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}
    <Field label="Message"><textarea name="message" required minLength={10} maxLength={2000} defaultValue={initialMessage}/></Field>
    <input name="website" type="text" hidden tabIndex={-1} autoComplete="off" aria-hidden="true"/>
    {state.message && <p className="notice" role="alert">{state.message}</p>}
    <button className="button" disabled={pending}>{pending?'Sending…':'Send request'}</button>
  </form>;
}