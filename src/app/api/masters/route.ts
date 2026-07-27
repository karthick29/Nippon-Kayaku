import { ok, route } from '@/server/api';
import { requirePermission } from '@/server/auth';
import { APPLICATIONS, CATEGORIES, EQUIPMENT_MASTER, LOCATIONS } from '@/data/masters';
import { PRODUCT_STATUSES } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** GET /api/masters — every reference list, for pickers and filters. */
export const GET = route(async () => {
  await requirePermission('product:read');
  return ok({
    applications: APPLICATIONS,
    categories: CATEGORIES,
    locations: LOCATIONS,
    equipment: EQUIPMENT_MASTER,
    statuses: PRODUCT_STATUSES,
  });
});
