import type { NextRequest } from 'next/server';
import { fail, ok, readJson, route } from '@/server/api';
import { currentActor, requirePermission } from '@/server/auth';
import { repo } from '@/server/repo';
import { parseRouteRequest } from '@/server/route-request';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ routeId: string }> };

/** PATCH /api/routes/:routeId — replace a route's fields and inputs. */
export const PATCH = route(async (request: NextRequest, { params }: Context) => {
  await requirePermission('product:update');
  const { routeId } = await params;
  const input = await parseRouteRequest(await readJson(request));
  const updated = await repo.updateRoute(routeId, input, await currentActor());
  return updated ? ok(updated) : fail('Route not found', 404);
});

/** DELETE /api/routes/:routeId — soft delete, recorded in the product's history. */
export const DELETE = route(async (_request: NextRequest, { params }: Context) => {
  await requirePermission('product:update');
  const { routeId } = await params;
  const deleted = await repo.deleteRoute(routeId, await currentActor());
  return deleted ? ok({ deleted: true }) : fail('Route not found', 404);
});
