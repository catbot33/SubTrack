import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken } from '../../Workers/Authentication-JWT.ts';
import DashboardClient from './dashboard-client.tsx';

export const metadata: Metadata = {
  title: 'Overview | SubTrack',
  description: 'Connect an inbox to start finding and organizing recurring subscriptions.',
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string }>;
}) {
  const sessionToken = (await cookies()).get('session_token')?.value;
  const user = sessionToken ? verifySessionToken(sessionToken) : null;

  if (!user) {
    redirect('/');
  }

  const query = await searchParams;
  return <DashboardClient user={{ name: user.name, email: user.email, avatar: user.avatar }} autoStart={query.gmail === 'connected'} />;
}
