import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { auth } from '@/server/auth';
import { repo } from '@/server/repo';

export const dynamic = 'force-dynamic';

/**
 * Authenticated shell. Every route inside the (app) group is guarded
 * here as well as by middleware — middleware alone can be bypassed if a
 * route is ever rendered outside the matcher.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) redirect('/sign-in');

  const [products, companies, recentActivity] = await Promise.all([
    repo.allProducts(),
    repo.allCompanies(),
    repo.listAuditLogs(20),
  ]);

  const dayAgo = Date.now() - 86_400_000;
  const notificationCount = recentActivity.filter((a) => new Date(a.createdAt).getTime() > dayAgo).length;

  return (
    <AppShell
      user={session.user}
      counts={{ products: products.length, companies: companies.length }}
      notificationCount={notificationCount}
    >
      {children}
    </AppShell>
  );
}
