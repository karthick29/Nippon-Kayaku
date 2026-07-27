'use client';

import * as RDialog from '@radix-ui/react-dialog';
import * as RDropdown from '@radix-ui/react-dropdown-menu';
import * as RTooltip from '@radix-ui/react-tooltip';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cn';
import { Button, IconButton } from './actions';

/* ════════════════════════════════════════════════════════════════════
   Ported from designsystem/src/components/{Dialog,BottomSheet}.tsx and
   extended with Menu/Tooltip (no VBDS equivalent).

   The VBDS originals rendered raw divs with a click-to-close scrim,
   which is not accessible enough for an enterprise app: no focus trap,
   no Escape handling, no return focus. These wrap Radix primitives for
   correct modal semantics while keeping the exact VBDS class names and
   visual treatment. BottomSheet became a right-side Sheet — a bottom
   sheet is a touch pattern, and ASTRA is desktop-first.
   ════════════════════════════════════════════════════════════════════ */

/* ── Dialog ─────────────────────────────────────────────────────── */

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'danger' | 'warning';
  size?: 'md' | 'lg' | 'xl';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  confirmLoading?: boolean;
  /** Hide the built-in footer when the body renders its own form actions. */
  hideActions?: boolean;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  icon,
  tone = 'default',
  size = 'md',
  confirmLabel,
  cancelLabel,
  onConfirm,
  confirmLoading,
  hideActions,
  className,
}: DialogProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="vbds-dialog-scrim" />
        <RDialog.Content
          className={cx(
            'vbds-dialog',
            tone !== 'default' && `vbds-dialog--${tone}`,
            size !== 'md' && `vbds-dialog--${size}`,
            className,
          )}
        >
          {icon && (
            <span className="vbds-dialog__icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <RDialog.Title className="vbds-dialog__title">{title}</RDialog.Title>
          {description ? (
            <RDialog.Description className="vbds-dialog__desc">{description}</RDialog.Description>
          ) : (
            <RDialog.Description className="astra-sr-only">{title}</RDialog.Description>
          )}
          {children && <div className="vbds-dialog__body">{children}</div>}
          {!hideActions && (confirmLabel || cancelLabel) && (
            <div className="vbds-dialog__actions">
              {cancelLabel && (
                <RDialog.Close asChild>
                  <Button variant="ghost">{cancelLabel}</Button>
                </RDialog.Close>
              )}
              {confirmLabel && (
                <Button
                  variant={tone === 'danger' ? 'danger' : 'primary'}
                  onClick={onConfirm}
                  loading={confirmLoading}
                >
                  {confirmLabel}
                </Button>
              )}
            </div>
          )}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/* ── Sheet (right-side drawer) ──────────────────────────────────── */

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  className?: string;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: SheetProps) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="vbds-dialog-scrim" />
        <RDialog.Content className={cx('vbds-sheet', size === 'lg' && 'vbds-sheet--lg', className)}>
          <div className="vbds-sheet__header">
            <RDialog.Title className="vbds-sheet__title">{title}</RDialog.Title>
            <RDialog.Close asChild>
              <IconButton icon={<X size={16} />} label="Close" />
            </RDialog.Close>
          </div>
          {description ? (
            <RDialog.Description className="astra-sr-only">{description}</RDialog.Description>
          ) : (
            <RDialog.Description className="astra-sr-only">{title}</RDialog.Description>
          )}
          <div className="vbds-sheet__body">{children}</div>
          {footer && <div className="vbds-sheet__footer">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/* ── Menu (dropdown) ────────────────────────────────────────────── */

export function Menu({
  trigger,
  children,
  align = 'end',
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  return (
    <RDropdown.Root>
      <RDropdown.Trigger asChild>{trigger}</RDropdown.Trigger>
      <RDropdown.Portal>
        <RDropdown.Content className={cx('vbds-menu', className)} align={align} sideOffset={6} collisionPadding={12}>
          {children}
        </RDropdown.Content>
      </RDropdown.Portal>
    </RDropdown.Root>
  );
}

export function MenuItem({
  children,
  icon,
  shortcut,
  danger,
  disabled,
  onSelect,
  href,
  closeOnSelect = true,
}: {
  children: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  href?: string;
  closeOnSelect?: boolean;
}) {
  const className = cx('vbds-menu__item', danger && 'vbds-menu__item--danger');

  if (href) {
    return (
      <RDropdown.Item asChild disabled={disabled}>
        <a href={href} className={className}>
          {icon}
          {children}
          {shortcut && <span className="vbds-menu__shortcut">{shortcut}</span>}
        </a>
      </RDropdown.Item>
    );
  }

  return (
    <RDropdown.Item
      className={className}
      disabled={disabled}
      onSelect={(e) => {
        if (!closeOnSelect) e.preventDefault();
        onSelect?.();
      }}
    >
      {icon}
      {children}
      {shortcut && <span className="vbds-menu__shortcut">{shortcut}</span>}
    </RDropdown.Item>
  );
}

export function MenuCheckboxItem({
  children,
  checked,
  onCheckedChange,
}: {
  children: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <RDropdown.CheckboxItem
      className="vbds-menu__item"
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(e) => e.preventDefault()}
    >
      <span
        aria-hidden="true"
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          border: '1.5px solid var(--vbds-border-strong)',
          background: checked ? 'var(--vbds-primary)' : 'transparent',
          borderColor: checked ? 'var(--vbds-primary)' : 'var(--vbds-border-strong)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {children}
    </RDropdown.CheckboxItem>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <RDropdown.Label className="vbds-menu__label">{children}</RDropdown.Label>;
}

export function MenuSeparator() {
  return <RDropdown.Separator className="vbds-menu__sep" />;
}

/* ── Tooltip ────────────────────────────────────────────────────── */

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RTooltip.Provider delayDuration={280} skipDelayDuration={120}>
      {children}
    </RTooltip.Provider>
  );
}

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  if (!content) return <>{children}</>;
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content className="vbds-tooltip" side={side} sideOffset={6} collisionPadding={8}>
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}
