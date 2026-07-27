import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Badge, Card, CardHeader, EmptyState } from '@/components/vbds';
import { History } from 'lucide-react';
import { formatDateTime, formatRelative } from '@/lib/format';
import { auth } from '@/server/auth';
import { can } from '@/server/rbac';
import { repo } from '@/server/repo';
import type { AuditAction } from '@/lib/types';

export const metadata: Metadata = { title: 'Audit Logs · Settings' };
export const dynamic = 'force-dynamic';

const ACTION_TONE: Record<AuditAction, 'success' | 'info' | 'danger' | 'warning' | 'neutral'> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
  RESTORE: 'warning',
  EXPORT: 'neutral',
  LOGIN: 'neutral',
};

export default async function AuditPage() {
  const session = await auth();
  if (!can(session?.user.role, 'audit:read')) {
    redirect('/settings');
  }

  const logs = await repo.listAuditLogs(200);

  return (
    <Card padding="none">
      <div style={{ padding: 'var(--vbds-space-20) var(--vbds-space-20) 0' }}>
        <CardHeader
          title="Audit log"
          subtitle="Append-only record of every data change, with a field-level diff. Entries are never edited or deleted."
        />
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={<History size={22} />} title="No activity recorded yet" />
      ) : (
        <div className="astra-table-scroll">
          <table className="astra-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Action</th>
                <th style={{ width: 100 }}>Entity</th>
                <th>Summary</th>
                <th style={{ width: 220 }}>Changes</th>
                <th style={{ width: 150 }}>Actor</th>
                <th style={{ width: 190 }}>When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <Badge tone={ACTION_TONE[log.action]} size="sm" dot>
                      {log.action}
                    </Badge>
                  </td>
                  <td>{log.entity}</td>
                  <td title={log.summary}>{log.summary}</td>
                  <td>
                    {log.changes ? (
                      <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'nowrap' }}>
                        {Object.entries(log.changes)
                          .slice(0, 2)
                          .map(([field, change]) => (
                            <Badge key={field} size="sm" title={`${String(change.from)} → ${String(change.to)}`}>
                              {field}
                            </Badge>
                          ))}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{log.actorName}</td>
                  <td title={formatDateTime(log.createdAt)}>
                    {formatRelative(log.createdAt)}
                    <span style={{ color: 'var(--vbds-text-tertiary)', marginLeft: 6 }}>
                      {formatDateTime(log.createdAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
