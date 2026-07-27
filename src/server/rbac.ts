import type { Permission, Role } from '@/lib/types';

/* ════════════════════════════════════════════════════════════════════
   Role-based access control.

   One source of truth for both the API guards (`requirePermission`) and
   the UI (`can`, used to hide actions the caller cannot perform). The UI
   check is a convenience only — every mutating route re-checks server
   side, because hiding a button is not authorisation.
   ════════════════════════════════════════════════════════════════════ */

const VIEWER: Permission[] = ['product:read', 'company:read', 'report:read', 'settings:read'];

const ANALYST: Permission[] = [
  ...VIEWER,
  'product:create',
  'product:update',
  'company:update',
  'report:export',
];

const MANAGER: Permission[] = [
  ...ANALYST,
  'product:delete',
  'company:create',
  'company:delete',
  'audit:read',
];

const ADMIN: Permission[] = [...MANAGER, 'settings:manage', 'user:manage'];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  VIEWER: VIEWER,
  ANALYST: ANALYST,
  MANAGER: MANAGER,
  ADMIN: ADMIN,
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  ANALYST: 'Analyst',
  VIEWER: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Full access including users, roles, master data and audit logs.',
  MANAGER: 'Create, edit and delete products and companies. Can read audit logs.',
  ANALYST: 'Create and edit products, update companies, export reports.',
  VIEWER: 'Read-only access to products, companies and reports.',
};

/** True when the role grants the permission. */
export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** True when the role grants every listed permission. */
export function canAll(role: Role | undefined, permissions: Permission[]): boolean {
  return permissions.every((p) => can(role, p));
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(permission: Permission) {
    super(`Missing required permission: ${permission}`);
    this.name = 'ForbiddenError';
  }
}
