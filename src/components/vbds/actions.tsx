'use client';

import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '@/lib/cn';

/* ════════════════════════════════════════════════════════════════════
   Ported from designsystem/src/components/{Button,IconButton}.tsx

   Two deliberate deviations from VBDS v2.0, both driven by the ASTRA
   platform decisions:
     1. `icon` takes a ReactNode (a Lucide element) rather than a Material
        Symbols ligature name — ASTRA standardises on Lucide.
     2. `href` renders a next/link anchor styled as a button, so nav
        actions do not need a wrapper element.
   Variants, sizes, and class names are otherwise unchanged.
   ════════════════════════════════════════════════════════════════════ */

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outlined'
  | 'ghost'
  | 'text'
  | 'danger'
  | 'success';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children?: ReactNode;
  /** Visual style. `primary` is the one main action per screen. */
  variant?: ButtonVariant;
  /** Control height: sm, md (default), lg — all relative to the density tier. */
  size?: 'sm' | 'md' | 'lg';
  /** Leading icon element (Lucide). */
  icon?: ReactNode;
  /** Trailing icon element (Lucide). */
  trailingIcon?: ReactNode;
  /** Shows a spinner and disables interaction. */
  loading?: boolean;
  /** Stretch to the container width. */
  fullWidth?: boolean;
  /** Render as a next/link anchor instead of a button. */
  href?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    icon,
    trailingIcon,
    loading,
    disabled,
    fullWidth,
    href,
    className,
    type = 'button',
    ...rest
  },
  ref,
) {
  const classes = cx(
    'vbds-button',
    `vbds-button--${variant}`,
    size !== 'md' && `vbds-button--${size}`,
    fullWidth && 'vbds-button--full',
    loading && 'vbds-button--loading',
    className,
  );

  const inner = (
    <>
      {loading ? (
        <span className="vbds-button__spinner" aria-hidden="true" />
      ) : (
        icon && (
          <span className="vbds-button__icon" aria-hidden="true">
            {icon}
          </span>
        )
      )}
      {children}
      {trailingIcon && !loading && (
        <span className="vbds-button__icon" aria-hidden="true">
          {trailingIcon}
        </span>
      )}
    </>
  );

  if (href && !disabled && !loading) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {inner}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Icon element (Lucide). */
  icon: ReactNode;
  /** Accessible name — required, the icon alone is not a label. */
  label: string;
  variant?: 'plain' | 'tonal' | 'filled' | 'outlined' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'plain', size = 'md', href, className, type = 'button', ...rest },
  ref,
) {
  const classes = cx(
    'vbds-icon-button',
    variant !== 'plain' && `vbds-icon-button--${variant}`,
    size !== 'md' && `vbds-icon-button--${size}`,
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={label} title={label}>
        {icon}
      </Link>
    );
  }

  return (
    <button ref={ref} type={type} className={classes} aria-label={label} title={label} {...rest}>
      {icon}
    </button>
  );
});
