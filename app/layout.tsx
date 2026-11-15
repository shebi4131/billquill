import type { Metadata } from 'next';
import Link from 'next/link';
import './styles.css';

const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: 'BillQuill — Online Invoice Generator', template: '%s | BillQuill' },
  description: 'Create branded invoices, preview totals as you type, and download a PDF ready to send.',
  openGraph: { siteName: 'BillQuill', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><header className="top"><nav className="wrap nav">
    <Link className="brand" href="/"><span>✦</span> BillQuill</Link>
    <div className="navlinks"><Link href="/templates">Templates</Link><Link href="/pricing">Pricing</Link><Link href="/contact">Contact</Link><Link className="button small" href="/dashboard">Workspace</Link></div>
  </nav></header>{children}<footer className="wrap footer"><Link className="brand" href="/">BillQuill</Link><span>Online invoicing for independent businesses</span></footer></body></html>;
}