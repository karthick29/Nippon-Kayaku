import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/page/PageHeader';
import { SettingsNav } from './SettingsNav';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="astra-page">
      <PageHeader
        title="Settings"
        subtitle="Preferences, people, permissions, master data and the audit trail."
        crumbs={[{ label: 'nipponkayaku', href: '/dashboard' }, { label: 'Settings' }]}
      />

      <div className="astra-settings">
        <SettingsNav />
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
