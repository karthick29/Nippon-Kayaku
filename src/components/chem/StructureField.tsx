'use client';

import { TriangleAlert, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Button, TextField } from '@/components/vbds';
import { formatHill, parseFormula } from '@/lib/formula';
import type { ProductBasicsValues } from '@/lib/validation';
import { StructureSvg } from './StructureSvg';

export interface StructurePreview {
  status: 'empty' | 'loading' | 'valid' | 'invalid';
  svg?: string;
  canonicalSmiles?: string;
  formula?: string;
  molecularWeight?: number;
  message?: string;
}

/**
 * Live server-side depiction of a SMILES string, debounced.
 * RDKit only runs on the server, so this calls /api/structure/depict;
 * stale requests are aborted so a slow early response can't overwrite a
 * later one. The last good drawing stays visible while the next loads.
 */
export function useStructurePreview(smiles: string | undefined, delay = 400): StructurePreview {
  const [preview, setPreview] = useState<StructurePreview>({ status: 'empty' });

  useEffect(() => {
    const value = (smiles ?? '').trim();
    if (!value) {
      setPreview({ status: 'empty' });
      return;
    }

    setPreview((current) => ({ ...current, status: 'loading' }));
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/structure/depict?smiles=${encodeURIComponent(value)}&w=320&h=220`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          data?: Omit<StructurePreview, 'status'>;
          error?: { message: string; fields?: Record<string, string> };
        };
        if (response.ok && body.data) {
          setPreview({ status: 'valid', ...body.data });
        } else {
          setPreview({ status: 'invalid', message: body.error?.fields?.smiles ?? body.error?.message ?? 'Not a valid structure' });
        }
      } catch {
        if (!controller.signal.aborted) setPreview({ status: 'invalid', message: 'Could not check the structure' });
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [smiles, delay]);

  return preview;
}

/** Hill-normalised formula, or null when the written form can't be parsed (e.g. parentheses). */
function normalise(formula: string | undefined): string | null {
  const counts = formula ? parseFormula(formula) : null;
  return counts ? formatHill(counts) : null;
}

/**
 * SMILES input with live structure preview for the product forms.
 * Optional: the server canonicalises on save and rejects unparseable
 * input with a 422 on `smiles`, which the forms map back onto this field.
 */
export function StructureField({
  form,
  preview: sharedPreview,
}: {
  form: UseFormReturn<ProductBasicsValues>;
  /** Pass when the parent already runs `useStructurePreview` (e.g. to show it on a review step) to avoid a second fetch. */
  preview?: StructurePreview;
}) {
  const smiles = form.watch('smiles');
  const enteredFormula = form.watch('molecularFormula');
  const enteredWeight = form.watch('molecularWeight');
  // Hooks can't be conditional: with a shared preview, give the local one nothing to fetch.
  const ownPreview = useStructurePreview(sharedPreview ? undefined : smiles);
  const preview = sharedPreview ?? ownPreview;
  const serverError = form.formState.errors.smiles?.message;

  const valid = preview.status === 'valid';
  const entered = normalise(enteredFormula);
  const mismatch = valid && entered !== null && entered !== preview.formula;
  const incomplete = valid && (!enteredFormula || enteredWeight === undefined || enteredWeight === '');

  function applyStructureValues() {
    if (!preview.formula || preview.molecularWeight === undefined) return;
    form.setValue('molecularFormula', preview.formula, { shouldDirty: true, shouldValidate: true });
    form.setValue('molecularWeight', preview.molecularWeight, { shouldDirty: true, shouldValidate: true });
  }

  const invalid = Boolean(serverError) || preview.status === 'invalid';
  const helper =
    serverError ??
    (preview.status === 'invalid'
      ? preview.message
      : 'Optional. Paste from PubChem, or ChemDraw › Copy As › SMILES. For a solution, enter the active substance.');

  return (
    <div className="astra-structure-field">
      <div className="astra-structure-field__main">
        <TextField
          label="Structure (SMILES)"
          fullWidth
          placeholder="O=C(Cl)OCc1ccccc1"
          spellCheck={false}
          autoComplete="off"
          error={invalid}
          supportingText={helper}
          {...form.register('smiles')}
        />

        {valid && (
          <p className="astra-structure-field__derived" aria-live="polite">
            From structure: <span className="astra-table__mono">{preview.formula}</span> · {preview.molecularWeight} g/mol
          </p>
        )}

        {mismatch && (
          <div className="astra-structure-field__warning" role="status">
            <TriangleAlert size={14} aria-hidden="true" />
            <span>
              Doesn&apos;t match the molecular formula entered (<span className="astra-table__mono">{enteredFormula}</span>).
            </span>
            <Button size="sm" variant="text" onClick={applyStructureValues}>
              Use structure values
            </Button>
          </div>
        )}

        {!mismatch && incomplete && (
          <div>
            <Button size="sm" variant="outlined" icon={<Wand2 size={14} />} onClick={applyStructureValues}>
              Fill formula and weight from structure
            </Button>
          </div>
        )}
      </div>

      <StructureSvg
        svg={preview.status === 'valid' || preview.status === 'loading' ? (preview.svg ?? null) : null}
        label={valid ? `Structure preview, ${preview.formula}` : 'Structure preview'}
        size="sm"
        className={preview.status === 'loading' ? 'astra-structure--loading' : undefined}
      />
    </div>
  );
}
