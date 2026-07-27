import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind-aware class merge — later conflicting utilities win.
 * Use for anything that mixes Tailwind utilities.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * VBDS `cx` — joins class names, skipping falsy values.
 * Ported from designsystem/src/components/Icon.tsx so design system
 * components keep their original, dependency-free implementation.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
