import { ok, route } from '@/server/api';
import { requirePermission } from '@/server/auth';
import { repo } from '@/server/repo';

export const dynamic = 'force-dynamic';

/** GET /api/dashboard — every metric and chart series for the dashboard. */
export const GET = route(async () => {
  await requirePermission('product:read');
  return ok(await repo.dashboard());
});
