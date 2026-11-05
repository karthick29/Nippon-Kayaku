import 'server-only';
import { ZodError } from 'zod';

/**
 * Throws a validation failure discovered after schema parsing — an
 * unparseable structure, a route that would form a loop. It's a ZodError
 * so `handleError` maps it to the same 422 `{ fields: { [path]: message } }`
 * envelope the forms already understand.
 */
export function throwFieldError(path: Array<string | number>, message: string): never {
  throw new ZodError([{ code: 'custom', path, message, input: undefined }]);
}
