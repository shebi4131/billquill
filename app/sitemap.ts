import type { MetadataRoute } from 'next';
import { templates } from '../lib/invoice';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  return ['/', '/templates', '/pricing', '/contact', '/invoice-generator', ...templates.map(t=>'/templates/'+t.id)].map(path=>({url:new URL(path,base).href}));
}