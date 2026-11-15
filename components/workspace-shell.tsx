import Link from 'next/link';
import { LayoutDashboard, Settings, CreditCard, LifeBuoy, Shield, LogOut, Building2 } from 'lucide-react';
import { signOut } from '../app/actions';
export function WorkspaceShell({children,admin=false}:{children:React.ReactNode;admin?:boolean}) {
  return <div className="workspace-shell wrap"><aside className="workspace-sidebar"><p className="eyebrow">WORKSPACE</p><nav aria-label="Workspace">
    <Link href="/dashboard"><LayoutDashboard size={17}/> Invoices</Link><Link href="/businesses"><Building2 size={17}/> Businesses</Link><Link href="/settings"><Settings size={17}/> Business settings</Link>
    <Link href="/plans"><CreditCard size={17}/> Plans</Link><Link href="/contact"><LifeBuoy size={17}/> Support</Link>
    {admin && <Link href="/admin"><Shield size={17}/> Superadmin</Link>}
  </nav><form action={signOut}><button className="sidebar-signout"><LogOut size={17}/> Sign out</button></form></aside><div className="workspace-content">{children}</div></div>;
}