'use client';
import { useState, useTransition } from 'react';
import { currencies, type Profile } from '../lib/invoice';
import { saveProfile } from '../app/actions';
import { Field } from './fields';
const steps=['Business','Contact & tax','Branding','Defaults'];
export function BusinessForm({initial,logoUrl,businessId}:{initial:Profile;logoUrl:string;businessId?:string}) {
  const [profile,setProfile]=useState(initial);
  const [step,setStep]=useState(0);
  const [file,setFile]=useState<File>();
  const [remove,setRemove]=useState(false);
  const [error,setError]=useState('');
  const [pending,start]=useTransition();
  const field=(key:keyof Profile,label:string,type='text')=><Field key={key} label={label} type={type} value={profile[key]} onChange={e=>setProfile({...profile,[key]:e.target.value})}/>;
  return <form className="card stack business-form" onSubmit={e=>{
    e.preventDefault();setError('');
    if (!profile.name.trim()) {setStep(0);setError('Enter your business name.');return;}
    if(step<3){setStep(step+1);return;}
    const upload=new FormData();
    if(file) upload.set('logo',file);
    start(async()=>{const result=await saveProfile(profile,upload,remove,businessId);if(result?.error)setError(result.error);});
  }}>
    <div className="steps" role="group" aria-label="Business setup steps">{steps.map((label,i)=><button type="button" key={label} className={i===step?'current':''} aria-current={i===step?'step':undefined} disabled={pending} onClick={()=>{setError('');setStep(i);}}><span className="step-number">{i+1}</span><span>{label}</span></button>)}</div>
    <h2>{steps[step]}</h2>
    {step===0 && <div className="grid two business-fields">{field('name','Business or trading name *')}{field('legalName','Legal name')}{field('country','Country')}
      <Field label="Default invoice currency"><select value={profile.currency} onChange={e=>setProfile({...profile,currency:e.target.value as Profile['currency']})}>{currencies.map(c=><option key={c}>{c}</option>)}</select></Field></div>}
    {step===1 && <div className="grid two">{field('address','Address')}{field('email','Email','email')}{field('phone','Phone')}{field('website','Website')}{field('registration','Registration number')}{field('taxId','Tax ID')}</div>}
    {step===2 && <>{logoUrl && !remove && !file && <img className="logo-preview" src={logoUrl} alt="Current business logo"/>}
      <Field label="Business logo (optional, PNG or JPEG up to 2 MB)" type="file" accept="image/png,image/jpeg" onChange={e=>{setFile(e.target.files?.[0]);setRemove(false);}}/>
      {file && <p>Selected: {file.name}</p>}
      {(file || (logoUrl && !remove)) && <button type="button" className="button secondary" onClick={()=>{setFile(undefined);setRemove(true);}}>Remove logo</button>}</>}
    {step===3 && <>{field('taxLabel','Default tax label')}{field('taxRate','Default tax rate (%)')}
      <Field label="Payment instructions"><textarea value={profile.payment} onChange={e=>setProfile({...profile,payment:e.target.value})}/></Field></>}
    {error && <p role="alert" className="notice">{error}</p>}
    <div className="actions business-actions">{step>0 && <button type="button" className="button secondary" onClick={()=>setStep(step-1)}>Back</button>}<button disabled={pending} className="button">{pending?'Saving…':step===3?'Save business':'Continue'}</button></div>
  </form>;
}