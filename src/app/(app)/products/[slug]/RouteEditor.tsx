'use client';

import { Pencil, Plus, Route as RouteIcon, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Checkbox,
  Dialog,
  IconButton,
  SegmentedControl,
  Select,
  TextArea,
  TextField,
} from '@/components/vbds';
import { ROUTE_ROLE_LABELS } from '@/lib/synthesis';
import {
  ROUTE_INPUT_ROLES,
  type RouteInputRole,
  type RouteReviewStatus,
  type SynthesisRouteView,
} from '@/lib/types';
import { routeSchema } from '@/lib/validation';

/* ════════════════════════════════════════════════════════════════════
   Route editor — create and edit a synthesis route.

   Controlled state rather than React Hook Form: each input row carries a
   UI-only "source" (catalogue vs external) that isn't part of the API
   shape. The payload is built on submit, checked with the shared
   `routeSchema`, and errors — client or server — are keyed by the same
   dotted path the API returns (`inputs.2.externalSmiles`), so one
   lookup renders both.
   ════════════════════════════════════════════════════════════════════ */

export interface CatalogueOption {
  id: string;
  name: string;
  casNumber: string;
}

interface InputDraft {
  /** Stable React key — row indices shift when a row is removed. */
  key: number;
  source: 'catalogue' | 'external';
  role: RouteInputRole;
  productId: string;
  externalName: string;
  externalCas: string;
  externalSmiles: string;
  quantity: string;
}

interface Draft {
  name: string;
  isPreferred: boolean;
  reviewStatus: RouteReviewStatus;
  notes: string;
  inputs: InputDraft[];
}

type Errors = Record<string, string>;

const ROLE_OPTIONS = ROUTE_INPUT_ROLES.map((role) => ({ value: role, label: ROUTE_ROLE_LABELS[role] }));
const REVIEW_OPTIONS = [
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'reviewed', label: 'Reviewed by a chemist' },
];

function toDraft(route: SynthesisRouteView | undefined, isFirstRoute: boolean, nextKey: () => number): Draft {
  if (!route) {
    return {
      name: '',
      isPreferred: isFirstRoute,
      reviewStatus: 'unreviewed',
      notes: '',
      inputs: [emptyInput(nextKey())],
    };
  }
  return {
    name: route.name,
    isPreferred: route.isPreferred,
    reviewStatus: route.reviewStatus,
    notes: route.notes ?? '',
    inputs: route.inputs.map((input) => ({
      key: nextKey(),
      source: input.productId ? 'catalogue' : 'external',
      role: input.role,
      productId: input.productId ?? '',
      externalName: input.externalName ?? '',
      externalCas: input.externalCas ?? '',
      externalSmiles: input.externalSmiles ?? '',
      quantity: input.quantity ?? '',
    })),
  };
}

function emptyInput(key: number): InputDraft {
  return {
    key,
    source: 'catalogue',
    role: 'building-block',
    productId: '',
    externalName: '',
    externalCas: '',
    externalSmiles: '',
    quantity: '',
  };
}

/** API shape: a catalogue row sends only productId; an external row only external_*. */
function toPayload(draft: Draft) {
  return {
    name: draft.name,
    isPreferred: draft.isPreferred,
    reviewStatus: draft.reviewStatus,
    notes: draft.notes,
    inputs: draft.inputs.map((input) =>
      input.source === 'catalogue'
        ? { role: input.role, productId: input.productId || undefined, quantity: input.quantity }
        : {
            role: input.role,
            externalName: input.externalName,
            externalCas: input.externalCas,
            externalSmiles: input.externalSmiles,
            quantity: input.quantity,
          },
    ),
  };
}

/** Errors the schema can't phrase well for an empty row, checked first. */
function blankRowErrors(draft: Draft): Errors {
  const errors: Errors = {};
  draft.inputs.forEach((input, index) => {
    if (input.source === 'catalogue' && !input.productId) errors[`inputs.${index}.productId`] = 'Choose a product';
    if (input.source === 'external' && !input.externalName.trim()) errors[`inputs.${index}.externalName`] = 'Name the substance';
  });
  return errors;
}

export function RouteEditorDialog({
  open,
  onOpenChange,
  productId,
  productName,
  catalogue,
  route,
  isFirstRoute = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  /** Catalogue products that can be inputs — the current product already excluded. */
  catalogue: CatalogueOption[];
  route?: SynthesisRouteView;
  isFirstRoute?: boolean;
}) {
  const router = useRouter();
  const keyCounter = useRef(0);
  const nextKey = () => (keyCounter.current += 1);
  const [draft, setDraft] = useState<Draft>(() => toDraft(route, isFirstRoute, nextKey));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  // Reset the form each time the dialog opens, so a cancelled edit doesn't
  // linger. An effect, not onOpenChange: Radix only calls onOpenChange for
  // changes it initiates (closing), never when the parent sets open=true.
  useEffect(() => {
    if (!open) return;
    setDraft(toDraft(route, isFirstRoute, nextKey));
    setErrors({});
    // Deliberately only on open: re-running when `route` refreshes mid-edit would wipe the user's changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const updateInput = (index: number, patch: Partial<InputDraft>) => {
    setDraft((d) => ({ ...d, inputs: d.inputs.map((input, i) => (i === index ? { ...input, ...patch } : input)) }));
    // Clear just this row's errors; other rows keep theirs.
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([path]) => !path.startsWith(`inputs.${index}.`))));
  };
  const removeInput = (index: number) => {
    setDraft((d) => ({ ...d, inputs: d.inputs.filter((_, i) => i !== index) }));
    setErrors({}); // indices shifted — stale row errors would point at the wrong row
  };

  async function save() {
    const blank = blankRowErrors(draft);
    const payload = toPayload(draft);
    const parsed = routeSchema.safeParse(payload);
    const schemaErrors: Errors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.') || 'form';
        schemaErrors[path] ??= issue.message;
      }
    }
    const clientErrors = { ...schemaErrors, ...blank };
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(route ? `/api/routes/${route.id}` : `/api/products/${productId}/routes`, {
        method: route ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: { message: string; fields?: Record<string, string> } };
      if (!response.ok) {
        // Loops, unknown products and bad SMILES are only knowable on the server.
        if (body.error?.fields) setErrors(body.error.fields);
        throw new Error(body.error?.fields ? 'Fix the highlighted fields' : (body.error?.message ?? 'Could not save the route'));
      }
      toast.success(route ? 'Route updated' : `Route added to ${productName}`);
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  const catalogueOptions = catalogue.map((p) => ({ value: p.id, label: `${p.name} · ${p.casNumber}` }));

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={route ? 'Edit synthesis route' : 'Add synthesis route'}
      description={`How ${productName} is made. Inputs can be catalogue products or substances from outside the catalogue.`}
      icon={<RouteIcon size={18} />}
      size="xl"
      hideActions
    >
      <form
        className="astra-route-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        noValidate
      >
        <div className="astra-route-editor__body">
          <div className="astra-form-grid">
            <div className="astra-form-grid__full">
              <TextField
                label="Route name"
                required
                fullWidth
                placeholder="e.g. Glycidylation of bisphenol A"
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
                error={Boolean(errors.name)}
                supportingText={errors.name}
              />
            </div>
            <Select
              label="Review status"
              fullWidth
              options={REVIEW_OPTIONS}
              value={draft.reviewStatus}
              onChange={(e) => update({ reviewStatus: e.target.value as RouteReviewStatus })}
            />
            <div className="astra-route-editor__preferred">
              <Checkbox
                checked={draft.isPreferred}
                onCheckedChange={(checked) => update({ isPreferred: checked })}
                label="Preferred route for this product"
              />
            </div>
            <div className="astra-form-grid__full">
              <TextArea
                label="Notes"
                fullWidth
                rows={2}
                placeholder="Conditions, references, caveats…"
                value={draft.notes}
                onChange={(e) => update({ notes: e.target.value })}
                error={Boolean(errors.notes)}
                supportingText={errors.notes}
              />
            </div>
          </div>

          <div className="astra-route-editor__inputs-header">
            <h3 className="astra-route-editor__heading">Inputs</h3>
            {(errors.inputs || errors.form) && (
              <span className="astra-route-editor__error" role="alert">
                {errors.inputs ?? errors.form}
              </span>
            )}
          </div>

          <ol className="astra-route-editor__inputs">
            {draft.inputs.map((input, index) => {
              const err = (field: string) => errors[`inputs.${index}.${field}`];
              return (
                <li key={input.key} className="astra-route-editor__input">
                  <div className="astra-route-editor__input-head">
                    <span className="astra-route-editor__index" aria-hidden="true">
                      {index + 1}
                    </span>
                    <SegmentedControl
                      ariaLabel={`Input ${index + 1} source`}
                      value={input.source}
                      onValueChange={(v) => updateInput(index, { source: v as InputDraft['source'] })}
                      items={[
                        { value: 'catalogue', label: 'Catalogue product' },
                        { value: 'external', label: 'External substance' },
                      ]}
                    />
                    <span style={{ flex: 1 }} />
                    <IconButton
                      icon={<X size={14} />}
                      label={`Remove input ${index + 1}`}
                      variant="plain"
                      size="sm"
                      onClick={() => removeInput(index)}
                      disabled={draft.inputs.length === 1}
                    />
                  </div>

                  <div className="astra-route-editor__fields">
                    {input.source === 'catalogue' ? (
                      <div className="astra-route-editor__wide">
                        <Select
                          label="Product"
                          fullWidth
                          placeholder="Choose a product"
                          options={catalogueOptions}
                          value={input.productId}
                          onChange={(e) => updateInput(index, { productId: e.target.value })}
                          error={Boolean(err('productId'))}
                          supportingText={err('productId')}
                        />
                      </div>
                    ) : (
                      <>
                        <TextField
                          label="Substance"
                          fullWidth
                          placeholder="e.g. Bisphenol A"
                          value={input.externalName}
                          onChange={(e) => updateInput(index, { externalName: e.target.value })}
                          error={Boolean(err('externalName'))}
                          supportingText={err('externalName')}
                        />
                        <TextField
                          label="CAS number"
                          fullWidth
                          placeholder="80-05-7"
                          value={input.externalCas}
                          onChange={(e) => updateInput(index, { externalCas: e.target.value })}
                          error={Boolean(err('externalCas'))}
                          supportingText={err('externalCas')}
                        />
                        <div className="astra-route-editor__wide">
                          <TextField
                            label="SMILES (optional)"
                            fullWidth
                            spellCheck={false}
                            autoComplete="off"
                            className="astra-route-editor__smiles"
                            placeholder="CC(C)(c1ccc(O)cc1)c1ccc(O)cc1"
                            value={input.externalSmiles}
                            onChange={(e) => updateInput(index, { externalSmiles: e.target.value })}
                            error={Boolean(err('externalSmiles'))}
                            supportingText={err('externalSmiles')}
                          />
                        </div>
                      </>
                    )}
                    <Select
                      label="Role"
                      fullWidth
                      options={ROLE_OPTIONS}
                      value={input.role}
                      onChange={(e) => updateInput(index, { role: e.target.value as RouteInputRole })}
                    />
                    <TextField
                      label="Quantity (optional)"
                      fullWidth
                      placeholder="1.05 eq"
                      value={input.quantity}
                      onChange={(e) => updateInput(index, { quantity: e.target.value })}
                      error={Boolean(err('quantity'))}
                      supportingText={err('quantity')}
                    />
                  </div>
                </li>
              );
            })}
          </ol>

          <div>
            <Button
              variant="outlined"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setDraft((d) => ({ ...d, inputs: [...d.inputs, emptyInput(nextKey())] }))}
              disabled={draft.inputs.length >= 30}
            >
              Add input
            </Button>
          </div>
        </div>

        <div className="astra-route-editor__footer">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {route ? 'Save route' : 'Add route'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ── Triggers ───────────────────────────────────────────────────── */

export function AddRouteButton(props: {
  productId: string;
  productName: string;
  catalogue: CatalogueOption[];
  isFirstRoute: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
        Add route
      </Button>
      <RouteEditorDialog open={open} onOpenChange={setOpen} {...props} />
    </>
  );
}

export function RouteActions({
  route,
  productId,
  productName,
  catalogue,
}: {
  route: SynthesisRouteView;
  productId: string;
  productName: string;
  catalogue: CatalogueOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/routes/${route.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message: string } };
        throw new Error(body.error?.message ?? 'Could not remove the route');
      }
      toast.success('Route removed');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <span className="astra-route-card__actions">
      <IconButton icon={<Pencil size={14} />} label={`Edit route ${route.name}`} variant="outlined" size="sm" onClick={() => setEditing(true)} />
      <IconButton icon={<Trash2 size={14} />} label={`Remove route ${route.name}`} variant="outlined" size="sm" onClick={() => setConfirming(true)} />

      <RouteEditorDialog
        open={editing}
        onOpenChange={setEditing}
        productId={productId}
        productName={productName}
        catalogue={catalogue}
        route={route}
      />
      <Dialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="danger"
        icon={<Trash2 size={18} />}
        title="Remove this route?"
        description={`“${route.name}” will no longer appear on ${productName} or in where-used results. The removal is recorded in the product's history.`}
        cancelLabel="Cancel"
        confirmLabel="Remove route"
        onConfirm={() => void remove()}
        confirmLoading={deleting}
      />
    </span>
  );
}
