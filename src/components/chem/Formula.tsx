import type { ReactNode } from 'react';
import { cx } from '@/lib/cn';

/**
 * Typesets a molecular formula the way a chemist writes it: atom counts
 * as subscripts (C₃H₄N₂), with the leading coefficient of a hydrate or
 * solvate part left on the baseline (C6H5N3O·H2O → C₆H₅N₃O·H₂O).
 *
 * Presentational only, so it works in Server and Client Components. The
 * characters are unchanged — only wrapped in <sub> — so copying a formula
 * still gives the plain string that formula search matches.
 */
export function Formula({ value, className }: { value: string; className?: string }) {
  const parts = value.split(/([·.*])/);
  const nodes: ReactNode[] = [];

  parts.forEach((part, partIndex) => {
    if (part === '·' || part === '.' || part === '*') {
      nodes.push(part);
      return;
    }
    // A count leading a part multiplies the whole part — it is not an atom count.
    const lead = /^\d+/.exec(part)?.[0] ?? '';
    if (lead) nodes.push(lead);

    part
      .slice(lead.length)
      .split(/(\d+)/)
      .forEach((token, tokenIndex) => {
        if (!token) return;
        nodes.push(/^\d+$/.test(token) ? <sub key={`${partIndex}-${tokenIndex}`}>{token}</sub> : token);
      });
  });

  return (
    <span className={cx('astra-formula', className)}>
      {nodes}
    </span>
  );
}
