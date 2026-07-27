import type { NextRequest } from 'next/server';
import { ok, route } from '@/server/api';
import { requirePermission } from '@/server/auth';
import { repo } from '@/server/repo';

export const dynamic = 'force-dynamic';

/** GET /api/audit?limit=&entityId= — audit trail, newest first. */
export const GET = route(async (request: NextRequest) => {
  await requirePermission('audit:read');

  const params = request.nextUrl.searchParams;
  const limit = Math.min(500, Number.parseInt(params.get('limit') ?? '100', 10) || 100);
  const entityId = params.get('entityId');

  const logs = entityId
    ? await repo.listEntityAuditLogs(entityId, limit)
    : await repo.listAuditLogs(limit);

  return ok(logs);
});
