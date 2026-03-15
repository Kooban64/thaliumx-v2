import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Home() {
  const hdrs = await headers();
  const host = (hdrs.get('x-forwarded-host') || hdrs.get('host') || '').toLowerCase();

  // Host-aware root routing (server-side, no client flash):
  // - thaliumx.com -> exchange landing
  // - thal.thaliumx.com -> token presale landing
  if (host.includes('thal.thaliumx.com')) {
    redirect('/token-presale');
  }

  redirect('/landing');
}
