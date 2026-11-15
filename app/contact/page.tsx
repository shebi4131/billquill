import { ContactForm } from '../../components/contact-form';
import { configured } from '../../lib/supabase';
export const metadata={title:'Contact BillQuill',description:'Request a custom invoice letterhead, ask about subscriptions, or get help with BillQuill.',alternates:{canonical:'/contact'}};
export default async function Contact({searchParams}:{searchParams:Promise<{topic?:string;plan?:string}>}) {
  const {topic,plan}=await searchParams;
  return <main className="wrap narrow section"><p className="eyebrow">CONTACT</p><h1>How can we help?</h1><p>Tell us about your preferred plan, custom letterhead, or support issue.</p>
    <ContactForm topic={topic==='custom-letterhead'||topic==='subscription'?topic:'support'} initialMessage={plan==='basic'||plan==='plus'?'I’d like to request the '+(plan==='basic'?'Basic':'Plus')+' plan.':''} available={configured()}/></main>;
}