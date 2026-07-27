import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ForbiddenError } from './rbac';

/* ════════════════════════════════════════════════════════════════════
   Shared API-route plumbing: uniform envelopes, uniform error mapping.

   Every route returns { data } or { error }. Zod failures surface as 422
   with per-field messages so the client can map them straight back onto
   React Hook Form fields.
   ════════════════════════════════════════════════════════════════════ */

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error: { message, ...extra } }, { status });
}

/** Maps thrown errors onto the right status. Never leaks stack traces. */
export function handleError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.') || '_';
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return fail('Validation failed', 422, { fields: fieldErrors });
  }

  if (error instanceof ForbiddenError) {
    return fail(error.message, 403);
  }

  const status = (error as { status?: number } | undefined)?.status;
  if (status === 401) return fail('Authentication required', 401);
  if (typeof status === 'number' && status >= 400 && status < 600) {
    return fail((error as Error).message, status);
  }

  console.error('[astra:api]', error);
  return fail('Something went wrong. Please try again.', 500);
}

/** Wraps a route handler with the shared error mapping. */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error);
    }
  };
}

/** Reads and JSON-parses a request body, tolerating an empty body. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
