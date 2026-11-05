import { FlaskConical } from 'lucide-react';
import { cx } from '@/lib/cn';

/**
 * Renders a structure depiction produced by `depictStructure()`.
 *
 * Presentational only — no hooks, no server imports — so both the
 * server-rendered `StructureImage` and the client form preview use it.
 * The SVG is inserted as markup because it must inherit `currentColor`
 * to theme; it only ever comes from RDKit on our server (never echoes
 * input text) and `depictStructure` refuses script-capable output.
 */
export function StructureSvg({
  svg,
  label,
  size = 'md',
  className,
}: {
  svg: string | null;
  label: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  if (!svg) {
    return (
      <div className={cx('astra-structure', `astra-structure--${size}`, 'astra-structure--empty', className)} role="img" aria-label={`${label}: no structure`}>
        <FlaskConical size={size === 'xs' || size === 'sm' ? 16 : 22} aria-hidden="true" />
      </div>
    );
  }
  return (
    <div
      className={cx('astra-structure', `astra-structure--${size}`, className)}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
