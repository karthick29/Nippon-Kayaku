import type { ReactNode } from 'react';
import { Breadcrumbs, type Crumb } from '@/components/vbds';

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <div className="astra-page__header">
      <div style={{ minWidth: 0 }}>
        {crumbs && crumbs.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <Breadcrumbs items={crumbs} />
          </div>
        )}
        <h1 className="astra-page__title">{title}</h1>
        {subtitle && <p className="astra-page__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="astra-page__actions">{actions}</div>}
    </div>
  );
}

/** Vertical rhythm between major page blocks. */
export function Stack({ children, gap = 16 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap }}>{children}</div>;
}
