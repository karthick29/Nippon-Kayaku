'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { Application, ProductCategory, ProductRow, ProductStatus } from '@/lib/types';
import { Button, Card, SearchField, Select, TextArea, TextField } from '@/components/vbds';
import { productBasicsSchema, type ProductBasicsValues } from '@/lib/validation';

const STATUSES: ProductStatus[] = ['Commercial', 'Development', 'Pilot', 'Discontinued'];

export function ProductEditForm({
  product,
  applications,
  categories,
}: {
  product: ProductRow;
  applications: Application[];
  categories: ProductCategory[];
}) {
  const router = useRouter();
  const [synonyms, setSynonyms] = useState<string[]>(product.synonyms);
  const [synonymDraft, setSynonymDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const form = useForm<ProductBasicsValues>({
    resolver: zodResolver(productBasicsSchema),
    mode: 'onBlur',
    defaultValues: {
      name: product.name,
      casNumber: product.casNumber,
      molecularFormula: product.molecularFormula ?? '',
      molecularWeight: product.molecularWeight,
      applicationId: product.applicationId,
      categoryId: product.categoryId,
      status: product.status,
      description: product.description ?? '',
    },
  });

  function addSynonym() {
    const value = synonymDraft.trim();
    if (!value || synonyms.includes(value) || synonyms.length >= 12) return;
    setSynonyms((current) => [...current, value]);
    setSynonymDraft('');
  }

  async function save(values: ProductBasicsValues) {
    setSaving(true);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          molecularFormula: values.molecularFormula || undefined,
          description: values.description || undefined,
          synonyms,
        }),
      });

      const body = (await response.json()) as {
        data?: { slug: string };
        error?: { message: string; fields?: Record<string, string> };
      };

      if (!response.ok) {
        if (body.error?.fields) {
          for (const [field, message] of Object.entries(body.error.fields)) {
            form.setError(field as keyof ProductBasicsValues, { message });
          }
        }
        throw new Error(body.error?.message ?? 'Could not save');
      }

      toast.success('Product updated');
      router.push(`/products/${body.data!.slug}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(save)}>
      <Card padding="lg">
        <div className="astra-form-grid">
          <div className="astra-form-grid__full">
            <TextField
              label="Product Name"
              required
              fullWidth
              error={!!form.formState.errors.name}
              supportingText={form.formState.errors.name?.message}
              {...form.register('name')}
            />
          </div>

          <TextField
            label="CAS Number"
            required
            fullWidth
            error={!!form.formState.errors.casNumber}
            supportingText={form.formState.errors.casNumber?.message ?? 'Format 000000-00-0'}
            {...form.register('casNumber')}
          />

          <TextField
            label="Molecular Formula"
            fullWidth
            error={!!form.formState.errors.molecularFormula}
            supportingText={form.formState.errors.molecularFormula?.message}
            {...form.register('molecularFormula')}
          />

          <TextField
            label="Molecular Weight"
            fullWidth
            type="number"
            step="0.0001"
            error={!!form.formState.errors.molecularWeight}
            supportingText={form.formState.errors.molecularWeight?.message ?? 'g/mol'}
            {...form.register('molecularWeight')}
          />

          <Select
            label="Status"
            required
            fullWidth
            options={STATUSES.map((s) => ({ value: s, label: s }))}
            {...form.register('status')}
          />

          <Select
            label="Application"
            required
            fullWidth
            options={applications.map((a) => ({ value: a.id, label: a.name }))}
            {...form.register('applicationId')}
          />

          <Select
            label="Category"
            required
            fullWidth
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
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
                  placeholder="Add a synonym"
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
              rows={5}
              error={!!form.formState.errors.description}
              supportingText={form.formState.errors.description?.message}
              {...form.register('description')}
            />
          </div>
        </div>
      </Card>

      <div className="astra-wizard__footer">
        <Button variant="ghost" href={`/products/${product.slug}`}>
          Cancel
        </Button>
        <span style={{ flex: 1 }} />
        <Button type="submit" icon={<Save size={14} />} loading={saving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
