import type { Metadata } from 'next';
import { CircleSlash, Mail, ShieldCheck } from 'lucide-react';
import { Avatar, Badge, Card, CardHeader } from '@/components/vbds';
import { formatDate, formatRelative } from '@/lib/format';
import { ROLE_LABELS } from '@/server/rbac';
import { auth } from '@/server/auth';
import { repo } from '@/server/repo';

export const metadata: Metadata = { title: 'Users · Settings' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const [users, session] = await Promise.all([repo.listUsers(), auth()]);

  return (
    <Card padding="none">
      <div style={{ padding: 'var(--vbds-space-20) var(--vbds-space-20) 0' }}>
        <CardHeader
          title="Users"
          subtitle={`${users.filter((u) => u.active).length} active of ${users.length} accounts. Roles are assigned here and enforced on every API route.`}
        />
      </div>

      <div className="astra-scroll-x">
        <table className="astra-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Title</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last active</th>
              <th>Member since</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.email === session?.user.email;
              return (
                <tr key={user.id}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <Avatar name={user.name} size="sm" />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 550 }}>
                          {user.name}
                          {isSelf && (
                            <Badge size="sm" tone="primary" className="astra-inline-badge">
                              You
                            </Badge>
                          )}
                        </span>
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 'var(--vbds-caption-size)',
                            color: 'var(--vbds-text-secondary)',
                          }}
                        >
                          <Mail size={11} aria-hidden="true" />
                          {user.email}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td title={user.title}>{user.title ?? '—'}</td>
                  <td>
                    <Badge tone={user.role === 'ADMIN' ? 'accent' : 'primary'} size="sm">
                      <ShieldCheck size={10} aria-hidden="true" />
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </td>
                  <td>
                    {user.active ? (
                      <Badge tone="success" size="sm" dot>
                        Active
                      </Badge>
                    ) : (
                      <Badge size="sm">
                        <CircleSlash size={10} aria-hidden="true" />
                        Deactivated
                      </Badge>
                    )}
                  </td>
                  <td>{formatRelative(user.lastActiveAt)}</td>
                  <td>{formatDate(user.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
