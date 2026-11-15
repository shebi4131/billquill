import Link from 'next/link';
import { Check, Feather } from 'lucide-react';
import { configured } from '../../lib/supabase';
import { accountWithEmail, signIn } from '../actions';
export const metadata={title:'Sign in',robots:{index:false}};
const messages:Record<string,string>={oauth:'Google sign-in could not be completed.',credentials:'Sign-in failed. Check your credentials and confirm your email.',registration:'Could not create the account. Check your details and try again.',invalid:'Enter a valid email and a password of at least eight characters.'};
function GoogleIcon(){return <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M44 24.5c0-1.5-.1-2.9-.4-4.3H24v8.1h11.2a9.6 9.6 0 0 1-4.1 6.3v5.2h6.7C41.7 36.2 44 30.9 44 24.5z"/><path fill="#34A853" d="M24 45c5.6 0 10.3-1.9 13.8-5.2l-6.7-5.2c-1.9 1.3-4.3 2.1-7.1 2.1-5.4 0-10-3.6-11.6-8.5H5.5v5.4A21 21 0 0 0 24 45z"/><path fill="#FBBC05" d="M12.4 28.2a12.6 12.6 0 0 1 0-8.4v-5.4H5.5a21 21 0 0 0 0 19.2z"/><path fill="#EA4335" d="M24 11.3c3 0 5.8 1 7.9 3.1l5.9-5.9A20 20 0 0 0 24 3 21 21 0 0 0 5.5 14.4l6.9 5.4c1.6-4.9 6.2-8.5 11.6-8.5z"/></svg>}
export default async function Login({searchParams}:{searchParams:Promise<{error?:string;mode?:string;confirmed?:string}>}) {
  const {error,mode,confirmed}=await searchParams;
  const register=mode==='register';
  return <main className="wrap section auth-layout">
    <section className="auth-story"><Feather size={36}/><h1>{register?'Start invoicing with BillQuill':'Welcome back to BillQuill'}</h1>
      <p><Check size={17}/> Manage all your businesses in one account</p><p><Check size={17}/> Give invoices your own look</p><p><Check size={17}/> Keep a record of every invoice</p></section>
    <section className="card stack auth-card"><h2>{register?'Create your account':'Sign in to your account'}</h2>
    {error && <p role="alert" className="notice">{messages[error] || messages.oauth}</p>}
    {confirmed==='check-email' && <p className="notice">Check your email for a confirmation link. Open it in this browser to finish creating your account.</p>}
    {configured() ? <><form action={signIn}><button className="button secondary"><GoogleIcon/>{register?'Sign up with Google':'Continue with Google'}</button></form>
      <div className="auth-divider">or use email</div><form className="stack" action={accountWithEmail}>
        <input type="hidden" name="mode" value={register?'register':'login'}/>
        <label className="field">Email address<input name="email" type="email" required autoComplete="email" maxLength={254}/></label>
        <label className="field">Password<input name="password" type="password" required minLength={register?8:undefined} maxLength={72} autoComplete={register?'new-password':'current-password'}/></label>
        {register && <small>Use at least eight characters.</small>}
        <button className="button">{register?'Create account':'Sign in'}</button>
      </form></> : <p className="notice">Workspace sign-in requires Supabase setup.</p>}
    <p>{register ? <Link href="/login">Already registered? Sign in</Link> : <Link href="/login?mode=register">New to BillQuill? Create an account</Link>}</p></section>
  </main>;
}