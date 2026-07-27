import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { repo } from '@/server/repo';
import { SignInForm } from './SignInForm';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  // Demo affordance: the seeded directory is offered as one-click logins
  // so the app is explorable without credentials. Remove this, and the
  // `accounts` prop, when wiring a real identity provider.
  const users = await repo.listUsers();
  const accounts = users
    .filter((u) => u.active)
    .map((u) => ({ name: u.name, email: u.email, role: u.role, title: u.title }));

  return <SignInForm accounts={accounts} />;
}
