'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CircleCheck,
  FlaskConical,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { Application, CompanyRow, ProductCategory, ProductStatus } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DescriptionItem,
  DescriptionList,
  Divider,
  EmptyState,
  IconButton,
  SearchField,
  Select,
  TextArea,
  TextField,
} from '@/components/vbds';
import { productBasicsSchema, type ProductBasicsValues } from '@/lib/validation';
import { statusTone } from '@/lib/status';
import { cx } from '@/lib/cn';

/* ════════════════════════════════════════════════════════════════════
   Add Product wizard.

   Three steps: Basic Information → Company Mapping → Review.

   · Step 1 is validated by the same Zod schema the API uses, so the
     client and server can never disagree about what is valid.
   · The draft autosaves to localStorage on every change (debounced),
     because losing a half-filled chemical record to an accidental
     refresh is the single most annoying thing this form could do.
   · Steps are only navigable forward once the prior step validates;
     backward is always free.
   ════════════════════════════════════════════════════════════════════ */

const DRAFT_KEY = 'astra.product-draft';
const STATUSES: ProductStatus[] = ['Commercial', 'Development', 'Pilot', 'Discontinued'];

interface CompanyLink {
  companyId: string;
  productCodes: string;
  strength: string;
  presentation: string;
  remarks: string;
}

const STEPS = [
  { title: 'Basic Information', hint: 'Identity and classification' },
  { title: 'Company Mapping', hint: 'Who can supply it' },
  { title: 'Review', hint: 'Confirm and submit' },
];

export function ProductWizard({
  applications,
  categories,
  companies,
}: {
  applications: Application[];
  categories: ProductCategory[];
  companies: CompanyRow[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [links, setLinks] = useState<CompanyLink[]>([]);
  const [companyQuery, setCompanyQuery] = useState('');
  const [synonymDraft, setSynonymDraft] = useState('');
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const restored = useRef(false);

  const form = useForm<ProductBasicsValues>({
    resolver: zodResolver(productBasicsSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      casNumber: '',
      molecularFormula: '',
      molecularWeight: undefined,
      applicationId: applications[0]?.id ?? '',
      categoryId: categories[0]?.id ?? '',
      status: 'Development',
      description: '',
    },
  });

  const values = form.watch();

  /* ── Draft restore (once, on mount) ───────────────────────────── */
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        values?: ProductBasicsValues;
        links?: CompanyLink[];
        synonyms?: string[];
        savedAt?: string;
      };
      if (draft.values) form.reset(draft.values);
      if (draft.links) setLinks(draft.links);
      if (draft.synonyms) setSynonyms(draft.synonyms);
      if (draft.savedAt) {
        setDraftSavedAt(draft.savedAt);
        toast('Draft restored', { description: 'Picked up where you left off.' });
      }
    } catch {
      /* corrupt draft — ignore and start fresh */
    }
  }, [form]);

  /* ── Draft autosave (debounced) ───────────────────────────────── */
  useEffect(() => {
    if (!restored.current) return;
    const timer = setTimeout(() => {
      const savedAt = new Date().toISOString();
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ values, links, synonyms, savedAt }));
        setDraftSavedAt(savedAt);
      } catch {
        /* storage full or unavailable — the form still works */
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [values, links, synonyms]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const filteredCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) => c.name.toLowerCase().includes(q) || c.locationName.toLowerCase().includes(q),
    );
  }, [companies, companyQuery]);

  const linkedIds = useMemo(() => new Set(links.map((l) => l.companyId)), [links]);

  function toggleCompany(companyId: string) {
    setLinks((current) =>
      current.some((l) => l.companyId === companyId)
        ? current.filter((l) => l.companyId !== companyId)
        : [
            ...current,
            {
              companyId,
              productCodes: `PR-${String(900 + current.length + 1)}`,
              strength: '',
              presentation: '',
              remarks: '',
            },
          ],
    );
  }

  function updateLink(companyId: string, patch: Partial<CompanyLink>) {
    setLinks((current) => current.map((l) => (l.companyId === companyId ? { ...l, ...patch } : l)));
  }

  function addSynonym() {
    const value = synonymDraft.trim();
    if (!value || synonyms.includes(value) || synonyms.length >= 12) return;
    setSynonyms((current) => [...current, value]);
    setSynonymDraft('');
  }

  async function goToStep(next: number) {
    // Forward moves require the current step to validate.
    if (next > step && step === 0) {
      const valid = await form.trigger();
      if (!valid) {
        toast.error('Fix the highlighted fields before continuing.');
        return;
      }
    }
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
  }

  async function submit() {
    const valid = await form.trigger();
    if (!valid) {
      setStep(0);
      toast.error('Fix the highlighted fields before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form.getValues(),
        molecularFormula: values.molecularFormula || undefined,
        description: values.description || undefined,
        synonyms,
        companies: links.map((l) => ({
          companyId: l.companyId,
          productCodes: l.productCodes
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
          strength: l.strength || undefined,
          presentation: l.presentation || undefined,
          remarks: l.remarks || undefined,
        })),
      };

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as {
        data?: { slug: string; name: string };
        error?: { message: string; fields?: Record<string, string> };
      };

      if (!response.ok) {
        // Map server-side field errors back onto the form.
        if (body.error?.fields) {
          for (const [field, message] of Object.entries(body.error.fields)) {
            form.setError(field as keyof ProductBasicsValues, { message });
          }
          setStep(0);
        }
        throw new Error(body.error?.message ?? 'Could not create the product');
      }

      clearDraft();
      toast.success(`${body.data!.name} created`);
      router.push(`/products/${body.data!.slug}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const applicationName = applications.find((a) => a.id === values.applicationId)?.name ?? '—';
  const categoryName = categories.find((c) => c.id === values.categoryId)?.name ?? '—';

  return (
    <div className="astra-wizard">
      <nav className="astra-steps" aria-label="Progress">
        {STEPS.map((s, index) => (
          <button
            key={s.title}
            type="button"
            onClick={() => void goToStep(index)}
            aria-current={index === step ? 'step' : undefined}
            className={cx(
              'astra-step',
              index === step && 'astra-step--active',
              index < step && 'astra-step--done',
            )}
          >
            <span className="astra-step__dot" aria-hidden="true">
              {index < step ? <Check size={13} strokeWidth={3} /> : index + 1}
            </span>
            <span>
              <span className="astra-step__label" style={{ display: 'block' }}>
                {s.title}
              </span>
              <span className="astra-step__hint" style={{ display: 'block' }}>
                {s.hint}
              </span>
            </span>
          </button>
        ))}

        {draftSavedAt && (
          <p className="astra-steps__draft">
            <Save size={12} aria-hidden="true" /> Draft saved automatically
          </p>
        )}
      </nav>

      <div>
        {/* ── Step 1 · Basic Information ───────────────────────────── */}
        {step === 0 && (
          <Card padding="lg">
            <h2 className="vbds-card__title" style={{ marginBottom: 4 }}>
              Basic Information
            </h2>
            <p className="vbds-card__subtitle" style={{ marginBottom: 'var(--vbds-space-24)' }}>
              Identity and classification. The CAS number is checksum-validated as you type.
            </p>

            <div className="astra-form-grid">
              <div className="astra-form-grid__full">
                <TextField
                  label="Product Name"
                  required
                  fullWidth
                  placeholder="e.g. Benzyl chloroformate (50% in toluene)"
                  error={!!form.formState.errors.name}
                  supportingText={form.formState.errors.name?.message}
                  {...form.register('name')}
                />
              </div>

              <TextField
                label="CAS Number"
                required
                fullWidth
                placeholder="501-53-1"
                error={!!form.formState.errors.casNumber}
                supportingText={form.formState.errors.casNumber?.message ?? 'Format 000000-00-0'}
                {...form.register('casNumber')}
              />

              <TextField
                label="Molecular Formula"
                fullWidth
                placeholder="C8H7ClO2"
                error={!!form.formState.errors.molecularFormula}
                supportingText={form.formState.errors.molecularFormula?.message}
                {...form.register('molecularFormula')}
              />

              <TextField
                label="Molecular Weight"
                fullWidth
                type="number"
                step="0.0001"
                placeholder="170.59"
                error={!!form.formState.errors.molecularWeight}
                supportingText={form.formState.errors.molecularWeight?.message ?? 'g/mol'}
                {...form.register('molecularWeight')}
              />

              <Select
                label="Status"
                required
                fullWidth
                options={STATUSES.map((s) => ({ value: s, label: s }))}
                error={!!form.formState.errors.status}
                supportingText={form.formState.errors.status?.message}
                {...form.register('status')}
              />

              <Select
                label="Application"
                required
                fullWidth
                options={applications.map((a) => ({ value: a.id, label: a.name }))}
                error={!!form.formState.errors.applicationId}
                supportingText={form.formState.errors.applicationId?.message}
                {...form.register('applicationId')}
              />

              <Select
                label="Category"
                required
                fullWidth
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                error={!!form.formState.errors.categoryId}
                supportingText={form.formState.errors.categoryId?.message}
                {...form.register('categoryId')}
              />

              <div className="astra-form-grid__full">
                <label className="vbds-field__label" style={{ marginBottom: 8, display: 'block' }}>
                  Synonyms and trade names
                </label>
                <div style={{ display: 'flex', gap: 'var(--vbds-space-8)' }}>
                  <div style={{ flex: 1 }}>
                    <SearchField
                      fullWidth
                      value={synonymDraft}
                      onValueChange={setSynonymDraft}
                      placeholder="e.g. Cbz-Cl"
                      aria-label="Add a synonym"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addSynonym();
                        }
                      }}
                    />
                  </div>
                  <Button variant="outlined" icon={<Plus size={14} />} onClick={addSynonym}>
                    Add
                  </Button>
                </div>
                {synonyms.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'var(--vbds-space-12)' }}>
                    {synonyms.map((synonym) => (
                      <span key={synonym} className="astra-token">
                        {synonym}
                        <button
                          type="button"
                          onClick={() => setSynonyms((c) => c.filter((s) => s !== synonym))}
                          aria-label={`Remove ${synonym}`}
                          className="astra-token__remove"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="astra-form-grid__full">
                <TextArea
                  label="Description"
                  fullWidth
                  rows={4}
                  placeholder="What the chemical is used for, and anything a business team should know before quoting it."
                  error={!!form.formState.errors.description}
                  supportingText={form.formState.errors.description?.message}
                  {...form.register('description')}
                />
              </div>
            </div>
          </Card>
        )}

        {/* ── Step 2 · Company Mapping ─────────────────────────────── */}
        {step === 1 && (
          <Card padding="lg">
            <h2 className="vbds-card__title" style={{ marginBottom: 4 }}>
              Company Mapping
            </h2>
            <p className="vbds-card__subtitle" style={{ marginBottom: 'var(--vbds-space-16)' }}>
              Attach the companies that can supply this product. You can add more later from the product page.
            </p>

            <SearchField
              fullWidth
              value={companyQuery}
              onValueChange={setCompanyQuery}
              placeholder="Filter companies by name or location…"
              aria-label="Filter companies"
            />

            <div className="astra-company-picker">
              {filteredCompanies.length === 0 ? (
                <EmptyState size="sm" title="No companies match" description="Try a different name or city." />
              ) : (
                filteredCompanies.map((company) => {
                  const linked = linkedIds.has(company.id);
                  return (
                    <div key={company.id} className={cx('astra-company-picker__row', linked && 'astra-company-picker__row--on')}>
                      <Checkbox
                        checked={linked}
                        onCheckedChange={() => toggleCompany(company.id)}
                        ariaLabel={`Attach ${company.name}`}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="astra-company-picker__name">{company.name}</div>
                        <div className="astra-company-picker__meta">
                          {company.locationName} · {company.chemicalStaff} staff · est. {company.established}
                          {company.strength ? ` · ${company.strength}` : ''}
                        </div>
                      </div>
                      <Badge size="sm">{company.equipmentCount} capabilities</Badge>
                    </div>
                  );
                })
              )}
            </div>

            {links.length > 0 && (
              <>
                <div style={{ margin: 'var(--vbds-space-24) 0 var(--vbds-space-16)' }}>
                  <Divider label={`${links.length} attached`} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--vbds-space-12)' }}>
                  {links.map((link) => {
                    const company = companies.find((c) => c.id === link.companyId);
                    return (
                      <Card key={link.companyId} padding="sm" flat style={{ background: 'var(--vbds-surface-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <Building2 size={14} style={{ color: 'var(--vbds-primary)' }} aria-hidden="true" />
                          <strong style={{ fontSize: 'var(--vbds-body-size)' }}>{company?.name}</strong>
                          <span style={{ flex: 1 }} />
                          <IconButton
                            size="sm"
                            variant="danger"
                            icon={<Trash2 size={13} />}
                            label={`Remove ${company?.name}`}
                            onClick={() => toggleCompany(link.companyId)}
                          />
                        </div>
                        <div className="astra-form-grid">
                          <TextField
                            label="Product codes"
                            fullWidth
                            placeholder="PR-001, PR-004"
                            supportingText="Comma-separated"
                            value={link.productCodes}
                            onChange={(e) => updateLink(link.companyId, { productCodes: e.target.value })}
                          />
                          <TextField
                            label="Strength"
                            fullWidth
                            placeholder="50% in toluene"
                            value={link.strength}
                            onChange={(e) => updateLink(link.companyId, { strength: e.target.value })}
                          />
                          <TextField
                            label="Presentation"
                            fullWidth
                            placeholder="200 kg HDPE drum"
                            value={link.presentation}
                            onChange={(e) => updateLink(link.companyId, { presentation: e.target.value })}
                          />
                          <TextField
                            label="Remarks"
                            fullWidth
                            placeholder="Qualified supplier, two audits on record"
                            value={link.remarks}
                            onChange={(e) => updateLink(link.companyId, { remarks: e.target.value })}
                          />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        )}

        {/* ── Step 3 · Review ──────────────────────────────────────── */}
        {step === 2 && (
          <Card padding="lg">
            <h2 className="vbds-card__title" style={{ marginBottom: 4 }}>
              Review
            </h2>
            <p className="vbds-card__subtitle" style={{ marginBottom: 'var(--vbds-space-24)' }}>
              Check everything below, then submit. You can edit any field afterwards.
            </p>

            <div className="astra-detail-header" style={{ marginBottom: 'var(--vbds-space-24)' }}>
              <span className="astra-detail-header__glyph" aria-hidden="true">
                <FlaskConical size={22} />
              </span>
              <div className="astra-detail-header__main">
                <h3 className="astra-detail-header__title">{values.name || 'Untitled product'}</h3>
                <div className="astra-detail-header__meta">
                  <span className="astra-table__mono">{values.casNumber || 'No CAS'}</span>
                  <Badge tone={statusTone((values.status as ProductStatus) ?? 'Development')} size="sm" dot>
                    {values.status}
                  </Badge>
                  <Badge tone="primary" size="sm">
                    {applicationName}
                  </Badge>
                </div>
              </div>
            </div>

            <DescriptionList>
              <DescriptionItem term="Category">{categoryName}</DescriptionItem>
              <DescriptionItem term="Molecular formula">{values.molecularFormula || '—'}</DescriptionItem>
              <DescriptionItem term="Molecular weight">
                {values.molecularWeight ? `${values.molecularWeight} g/mol` : '—'}
              </DescriptionItem>
              <DescriptionItem term="Synonyms">{synonyms.length ? synonyms.join(', ') : '—'}</DescriptionItem>
            </DescriptionList>

            {values.description && (
              <>
                <div style={{ margin: 'var(--vbds-space-24) 0 var(--vbds-space-12)' }}>
                  <Divider label="Description" />
                </div>
                <p style={{ color: 'var(--vbds-text-secondary)', lineHeight: 'var(--vbds-body-line)' }}>
                  {values.description}
                </p>
              </>
            )}

            <div style={{ margin: 'var(--vbds-space-24) 0 var(--vbds-space-12)' }}>
              <Divider label={`${links.length} ${links.length === 1 ? 'company' : 'companies'}`} />
            </div>

            {links.length === 0 ? (
              <p style={{ color: 'var(--vbds-text-tertiary)', fontSize: 'var(--vbds-caption-size)' }}>
                No companies attached. The product will be created without supplier mapping — you can add
                companies from the product page at any time.
              </p>
            ) : (
              <div className="astra-scroll-x">
                <table className="astra-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Location</th>
                      <th>Product codes</th>
                      <th>Strength</th>
                      <th>Presentation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {links.map((link) => {
                      const company = companies.find((c) => c.id === link.companyId);
                      return (
                        <tr key={link.companyId}>
                          <td>{company?.name}</td>
                          <td>{company?.locationName}</td>
                          <td className="astra-table__mono">{link.productCodes || '—'}</td>
                          <td>{link.strength || '—'}</td>
                          <td>{link.presentation || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ── Wizard footer ────────────────────────────────────────── */}
        <div className="astra-wizard__footer">
          <Button
            variant="ghost"
            icon={<ArrowLeft size={14} />}
            onClick={() => void goToStep(step - 1)}
            disabled={step === 0}
          >
            Back
          </Button>

          <span style={{ flex: 1 }} />

          <Button
            variant="text"
            onClick={() => {
              clearDraft();
              form.reset();
              setLinks([]);
              setSynonyms([]);
              setDraftSavedAt(null);
              setStep(0);
              toast('Draft discarded');
            }}
          >
            Discard draft
          </Button>

          {step < STEPS.length - 1 ? (
            <Button trailingIcon={<ArrowRight size={14} />} onClick={() => void goToStep(step + 1)}>
              Continue
            </Button>
          ) : (
            <Button icon={<CircleCheck size={15} />} loading={submitting} onClick={() => void submit()}>
              Create product
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
