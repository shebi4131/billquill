import { NextResponse } from 'next/server';
import { configured, database } from '../../../lib/supabase';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const code=url.searchParams.get('code');
  if (code && configured()) {
    const db=await database();
    const {error}=await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/dashboard',base));
  }
  return NextResponse.redirect(new URL('/login?error=oauth',base));
}