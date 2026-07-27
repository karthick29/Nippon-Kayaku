import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { Permission, Role, User } from '@/lib/types';
import { can, ForbiddenError } from './rbac';
import { repo } from './repo';

/* ════════════════════════════════════════════════════════════════════
   Authentication.

   Signed, HttpOnly JWT session cookies via `jose`. The exported surface
   (`auth`, `signIn`, `signOut`) matches Auth.js v5 so swapping in
   next-auth is a drop-in: replace this module, keep every call site.
   See docs/ARCHITECTURE.md § Authentication for the Clerk/Auth.js
   migration notes.
   ════════════════════════════════════════════════════════════════════ */

const COOKIE_NAME = 'astra.session';
const MAX_AGE_SECONDS = 60 * 60 * 8; // one working day

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET ?? 'astra-development-secret-change-me-in-production';
  return new TextEncoder().encode(value.padEnd(32, '0'));
}

export interface Session {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    title?: string;
  };
  expires: string;
}

/** Reads and verifies the current session. Returns null when signed out. */
export async function auth(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (!payload.sub || !payload.role) return null;

    return {
      user: {
        id: payload.sub,
        name: String(payload.name ?? ''),
        email: String(payload.email ?? ''),
        role: payload.role as Role,
        title: payload.title ? String(payload.title) : undefined,
      },
      expires: new Date((payload.exp ?? 0) * 1000).toISOString(),
    };
  } catch {
    return null; // tampered, expired, or signed with a rotated secret
  }
}

/**
 * Credentials sign-in against the seeded user directory.
 *
 * The demo corpus ships no password hashes, so any non-empty password is
 * accepted for a known, active email — this is a demonstration seam, not
 * a security control. Replace the block marked below with a real
 * verification (argon2/bcrypt against `users.password_hash`) before any
 * deployment that is not a local demo.
 */
export async function signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!email?.trim() || !password) {
    return { ok: false, error: 'Enter your email and password.' };
  }

  const user = await repo.getUserByEmail(email);
  if (!user) return { ok: false, error: 'No account matches that email address.' };
  if (!user.active) return { ok: false, error: 'This account has been deactivated. Contact an administrator.' };

  // ── DEMO CREDENTIAL CHECK — replace with a password hash comparison ──
  // e.g. `if (!(await argon2.verify(user.passwordHash, password))) return { ok: false, ... }`
  if (password.length < 4) return { ok: false, error: 'Incorrect password.' };
  // ─────────────────────────────────────────────────────────────────────

  await createSession(user);

  await repo.recordAudit({
    action: 'LOGIN',
    entity: 'session',
    entityId: user.id,
    entityLabel: user.email,
    actorId: user.id,
    actorName: user.name,
    summary: `${user.name} signed in`,
  });

  return { ok: true };
}

export async function createSession(user: User): Promise<void> {
  const token = await new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax', // blocks cross-site form posts while keeping normal navigation
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** Throws when there is no session. Use at the top of protected handlers. */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session) {
    const error = new Error('Authentication required') as Error & { status: number };
    error.status = 401;
    throw error;
  }
  return session;
}

/** Throws when the session lacks the permission. */
export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await requireSession();
  if (!can(session.user.role, permission)) throw new ForbiddenError(permission);
  return session;
}

/** The audit actor for the current request. */
export async function currentActor(): Promise<{ id: string; name: string }> {
  const session = await auth();
  return session ? { id: session.user.id, name: session.user.name } : { id: 'system', name: 'System' };
}
