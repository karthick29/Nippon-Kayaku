'use client';

import { Check, ChevronDown, Minus, Search, X } from 'lucide-react';
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from '@/lib/cn';

/* ════════════════════════════════════════════════════════════════════
   Ported from designsystem/src/components/{TextField,SearchField,Select,
   Switch,Checkbox,SegmentedControl}.tsx

   Deviations: icons are ReactNode (Lucide) rather than Material Symbols
   names; every field forwards its ref and spreads native props so it
   composes with React Hook Form's `register()`; a TextArea variant of
   the field shell was added for the product description.
   ════════════════════════════════════════════════════════════════════ */

interface FieldShellProps {
  label?: string;
  supportingText?: string;
  error?: boolean;
  required?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export interface TextFieldProps
  extends FieldShellProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'required' | 'disabled'> {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  trailing?: ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label,
    supportingText,
    error,
    required,
    disabled,
    fullWidth,
    className,
    leadingIcon,
    trailingIcon,
    trailing,
    id,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const supportId = `${fieldId}-support`;

  return (
    <div
      className={cx(
        'vbds-field',
        error && 'vbds-field--error',
        disabled && 'vbds-field--disabled',
        fullWidth && 'vbds-field--full',
        className,
      )}
    >
      {label && (
        <label className="vbds-field__label" htmlFor={fieldId}>
          {label}
          {required && (
            <span className="vbds-field__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <span className="vbds-field__box">
        {leadingIcon && (
          <span className="vbds-field__icon" aria-hidden="true">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={fieldId}
          className="vbds-field__input"
          disabled={disabled}
          required={required}
          aria-invalid={error || undefined}
          aria-describedby={supportingText ? supportId : undefined}
          {...rest}
        />
        {trailing ??
          (trailingIcon && (
            <span className="vbds-field__icon" aria-hidden="true">
              {trailingIcon}
            </span>
          ))}
      </span>
      {supportingText && (
        <span className="vbds-field__support" id={supportId}>
          {supportingText}
        </span>
      )}
    </div>
  );
});

export interface TextAreaProps
  extends FieldShellProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'required' | 'disabled'> {}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, supportingText, error, required, disabled, fullWidth, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const supportId = `${fieldId}-support`;

  return (
    <div
      className={cx(
        'vbds-field',
        'vbds-field--textarea',
        error && 'vbds-field--error',
        disabled && 'vbds-field--disabled',
        fullWidth && 'vbds-field--full',
        className,
      )}
    >
      {label && (
        <label className="vbds-field__label" htmlFor={fieldId}>
          {label}
          {required && (
            <span className="vbds-field__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <span className="vbds-field__box">
        <textarea
          ref={ref}
          id={fieldId}
          className="vbds-field__input"
          disabled={disabled}
          required={required}
          aria-invalid={error || undefined}
          aria-describedby={supportingText ? supportId : undefined}
          {...rest}
        />
      </span>
      {supportingText && (
        <span className="vbds-field__support" id={supportId}>
          {supportingText}
        </span>
      )}
    </div>
  );
});

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps
  extends FieldShellProps,
    Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'required' | 'disabled'> {
  options: Array<string | SelectOption>;
  placeholder?: string;
  leadingIcon?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    options,
    placeholder,
    leadingIcon,
    supportingText,
    error,
    required,
    disabled,
    fullWidth,
    className,
    id,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const supportId = `${fieldId}-support`;
  const opts = options.map((o) => (typeof o === 'string' ? { label: o, value: o } : o));

  return (
    <div
      className={cx(
        'vbds-field',
        error && 'vbds-field--error',
        disabled && 'vbds-field--disabled',
        fullWidth && 'vbds-field--full',
        className,
      )}
    >
      {label && (
        <label className="vbds-field__label" htmlFor={fieldId}>
          {label}
          {required && (
            <span className="vbds-field__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <span className="vbds-field__box">
        {leadingIcon && (
          <span className="vbds-field__icon" aria-hidden="true">
            {leadingIcon}
          </span>
        )}
        <select
          ref={ref}
          id={fieldId}
          className="vbds-select-el"
          disabled={disabled}
          required={required}
          aria-invalid={error || undefined}
          aria-describedby={supportingText ? supportId : undefined}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="vbds-select__chevron" aria-hidden="true">
          <ChevronDown size={15} />
        </span>
      </span>
      {supportingText && (
        <span className="vbds-field__support" id={supportId}>
          {supportingText}
        </span>
      )}
    </div>
  );
});

export interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'onChange' | 'value'> {
  value?: string;
  onValueChange?: (value: string) => void;
  onClear?: () => void;
  fullWidth?: boolean;
  /** Large hero treatment for the Search Chemicals page. */
  hero?: boolean;
  trailing?: ReactNode;
  className?: string;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onValueChange, onClear, fullWidth, hero, trailing, className, placeholder, ...rest },
  ref,
) {
  return (
    <div
      className={cx(
        'vbds-search',
        fullWidth && 'vbds-search--full',
        hero && 'vbds-search--hero',
        className,
      )}
    >
      <span className="vbds-search__icon" aria-hidden="true">
        <Search size={hero ? 20 : 15} />
      </span>
      <input
        ref={ref}
        type="search"
        className="vbds-search__input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onValueChange?.(e.target.value)}
        {...rest}
      />
      {value ? (
        <button
          type="button"
          className="vbds-search__clear"
          onClick={() => {
            onValueChange?.('');
            onClear?.();
          }}
          aria-label="Clear search"
        >
          <X size={12} />
        </button>
      ) : null}
      {trailing}
    </div>
  );
});

export interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function Switch({ checked, onCheckedChange, label, disabled, className, id }: SwitchProps) {
  const autoId = useId();
  const switchId = id ?? autoId;
  return (
    <span
      className={cx('vbds-switch', checked && 'vbds-switch--on', disabled && 'vbds-switch--disabled', className)}
    >
      <button
        type="button"
        role="switch"
        id={switchId}
        aria-checked={!!checked}
        aria-label={label}
        disabled={disabled}
        className="vbds-switch__track"
        onClick={() => onCheckedChange?.(!checked)}
      >
        <span className="vbds-switch__thumb" />
      </button>
      {label && (
        <label className="vbds-switch__label" htmlFor={switchId}>
          {label}
        </label>
      )}
    </span>
  );
}

export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  /** Accessible name when no visible label is rendered (table row select). */
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  checked,
  indeterminate,
  onCheckedChange,
  label,
  ariaLabel,
  disabled,
  className,
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : !!checked}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cx(
        'vbds-checkbox',
        checked && 'vbds-checkbox--checked',
        indeterminate && 'vbds-checkbox--indeterminate',
        disabled && 'vbds-checkbox--disabled',
        className,
      )}
      style={{ background: 'none', border: 'none', padding: 0 }}
    >
      <span className="vbds-checkbox__box" aria-hidden="true">
        {indeterminate ? (
          <Minus size={11} strokeWidth={3.5} />
        ) : checked ? (
          <Check size={11} strokeWidth={3.5} />
        ) : null}
      </span>
      {label && <span className="vbds-checkbox__label">{label}</span>}
    </button>
  );
}

export interface SegmentedItem {
  label: string;
  value: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps {
  items: Array<string | SegmentedItem>;
  value?: string;
  onValueChange?: (value: string) => void;
  fullWidth?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl({
  items,
  value,
  onValueChange,
  fullWidth,
  ariaLabel,
  className,
}: SegmentedControlProps) {
  const opts = items.map((i) => (typeof i === 'string' ? { label: i, value: i } : i));
  return (
    <div
      className={cx('vbds-segmented', fullWidth && 'vbds-segmented--full', className)}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={cx('vbds-segmented__item', o.value === value && 'vbds-segmented__item--active')}
          onClick={() => onValueChange?.(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
