import type { Metadata } from 'next';
import { Fragment } from 'react';
import { Check, Minus } from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components/vbds';
import { ROLES, type Permission } from '@/lib/types';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS } from '@/server/rbac';

export const metadata: Metadata = { title: 'Roles & Permissions · Settings' };

/** Grouped for readability; order matches the resource lifecycle. */
const PERMISSION_GROUPS: Array<{ resource: string; permissions: Permission[] }> = [
  { resource: 'Products', permissions: ['product:read', 'product:create', 'product:update', 'product:delete'] },
  { resource: 'Companies', permissions: ['company:read', 'company:create', 'company:update', 'company:delete'] },
  { resource: 'Reports', permissions: ['report:read', 'report:export'] },
  { resource: 'Administration', permissions: ['settings:read', 'settings:manage', 'audit:read', 'user:manage'] },
];

const ACTION_LABEL: Record<string, string> = {
  read: 'View',
  create: 'Create',
  update: 'Edit',
  delete: 'Delete',
  export: 'Export',
  manage: 'Manage',
};

export default function RolesPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--vbds-space-16)' }}>
      <div className="astra-grid astra-grid--cards">
        {ROLES.map((role) => (
          <Card key={role} padding="md">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Badge tone={role === 'ADMIN' ? 'accent' : 'primary'}>{ROLE_LABELS[role]}</Badge>
              <span style={{ fontSize: 'var(--vbds-caption-size)', color: 'var(--vbds-text-tertiary)' }}>
                {ROLE_PERMISSIONS[role].length} permissions
              </span>
            </div>
            <p
              style={{
                fontSize: 'var(--vbds-caption-size)',
                color: 'var(--vbds-text-secondary)',
                lineHeight: 'var(--vbds-caption-line)',
              }}
            >
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </Card>
        ))}
      </div>

      <Card padding="none">
        <div style={{ padding: 'var(--vbds-space-20) var(--vbds-space-20) 0' }}>
          <CardHeader
            title="Permission matrix"
            subtitle="This grid is generated from the same ROLE_PERMISSIONS map the API guards use — it cannot drift from what is actually enforced."
          />
        </div>

        <div className="astra-scroll-x">
          <table className="astra-table">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Permission</th>
                {ROLES.map((role) => (
                  <th key={role} style={{ textAlign: 'center', width: 120 }}>
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <Fragment key={group.resource}>
                  <tr>
                    <td
                      colSpan={ROLES.length + 1}
                      style={{
                        background: 'var(--vbds-surface-2)',
                        fontWeight: 700,
                        fontSize: 'var(--vbds-caption-size)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--vbds-text-secondary)',
                      }}
                    >
                      {group.resource}
                    </td>
                  </tr>
                  {group.permissions.map((permission) => {
                    const action = permission.split(':')[1]!;
                    return (
                      <tr key={permission}>
                        <td>
                          <span style={{ fontWeight: 550 }}>{ACTION_LABEL[action] ?? action}</span>
                          <span
                            className="astra-table__mono"
                            style={{ color: 'var(--vbds-text-tertiary)', marginLeft: 8 }}
                          >
                            {permission}
                          </span>
                        </td>
                        {ROLES.map((role) => (
                          <td key={role} style={{ textAlign: 'center' }}>
                            {ROLE_PERMISSIONS[role].includes(permission) ? (
                              <>
                                <Check size={14} style={{ color: 'var(--vbds-success)', display: 'inline' }} aria-hidden="true" />
                                <span className="astra-sr-only">Granted</span>
                              </>
                            ) : (
                              <>
                                <Minus size={14} style={{ color: 'var(--vbds-text-tertiary)', display: 'inline' }} aria-hidden="true" />
                                <span className="astra-sr-only">Not granted</span>
                              </>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
