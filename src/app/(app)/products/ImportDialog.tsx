'use client';

import { CheckCircle2, FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Application, ProductCategory, ProductStatus } from '@/lib/types';
import { Badge, Button, Dialog } from '@/components/vbds';
import { parseCsv } from '@/lib/export';
import { isValidCasChecksum } from '@/lib/validation';

/* ════════════════════════════════════════════════════════════════════
   Bulk import.

   Accepts CSV (including "Save as CSV" from Excel). Every row is
   validated and previewed before anything is written — an import that
   silently half-succeeds is worse than one that refuses to start.
   ════════════════════════════════════════════════════════════════════ */

const TEMPLATE_HEADERS = [
  'Product Name',
  'CAS Number',
  'Molecular Formula',
  'Application',
  'Category',
  'Status',
  'Description',
];

interface ParsedRow {
  name: string;
  casNumber: string;
  molecularFormula?: string;
  applicationId?: string;
  categoryId?: string;
  status: ProductStatus;
  description?: string;
  errors: string[];
}

export function ImportDialog({
  open,
  onOpenChange,
  applications,
  categories,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applications: Application[];
  categories: ProductCategory[];
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [importing, setImporting] = useState(false);

  const valid = rows?.filter((r) => r.errors.length === 0) ?? [];
  const invalid = rows?.filter((r) => r.errors.length > 0) ?? [];

  function reset() {
    setRows(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleFile(file: File) {
    const text = await file.text();
    const records = parseCsv(text);

    if (records.length === 0) {
      toast.error('That file has no data rows.');
      return;
    }

    const parsed: ParsedRow[] = records.map((record) => {
      const errors: string[] = [];

      const name = (record['Product Name'] ?? record['name'] ?? '').trim();
      if (name.length < 2) errors.push('Product name is required');

      const casNumber = (record['CAS Number'] ?? record['cas'] ?? '').trim();
      if (!casNumber) errors.push('CAS number is required');
      else if (!isValidCasChecksum(casNumber)) errors.push(`"${casNumber}" is not a valid CAS number`);

      const applicationName = (record['Application'] ?? '').trim().toLowerCase();
      const application = applications.find((a) => a.name.toLowerCase() === applicationName);
      if (!application) errors.push(`Unknown application "${record['Application'] ?? ''}"`);

      const categoryName = (record['Category'] ?? '').trim().toLowerCase();
      const category = categories.find((c) => c.name.toLowerCase() === categoryName);
      if (!category) errors.push(`Unknown category "${record['Category'] ?? ''}"`);

      const rawStatus = (record['Status'] ?? 'Development').trim();
      const status = (['Commercial', 'Development', 'Pilot', 'Discontinued'] as ProductStatus[]).find(
        (s) => s.toLowerCase() === rawStatus.toLowerCase(),
      );
      if (!status) errors.push(`Unknown status "${rawStatus}"`);

      return {
        name,
        casNumber,
        molecularFormula: (record['Molecular Formula'] ?? '').trim() || undefined,
        applicationId: application?.id,
        categoryId: category?.id,
        status: status ?? 'Development',
        description: (record['Description'] ?? '').trim() || undefined,
        errors,
      };
    });

    setRows(parsed);
  }

  async function runImport() {
    if (valid.length === 0) return;
    setImporting(true);

    let created = 0;
    const failures: string[] = [];

    for (const row of valid) {
      try {
        const response = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: row.name,
            casNumber: row.casNumber,
            molecularFormula: row.molecularFormula,
            applicationId: row.applicationId,
            categoryId: row.categoryId,
            status: row.status,
            description: row.description,
          }),
        });
        if (response.ok) created += 1;
        else failures.push(row.name);
      } catch {
        failures.push(row.name);
      }
    }

    setImporting(false);

    if (created > 0) toast.success(`Imported ${created} ${created === 1 ? 'product' : 'products'}`);
    if (failures.length > 0) toast.error(`${failures.length} rows failed: ${failures.slice(0, 3).join(', ')}`);

    reset();
    onOpenChange(false);
    onImported();
  }

  function downloadTemplate() {
    const example = [
      'Sodium borohydride,16940-66-2,NaBH4,API Intermediate,Reagent,Commercial,Selective reducing agent',
    ];
    const blob = new Blob([`${TEMPLATE_HEADERS.join(',')}\n${example.join('\n')}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'astra-product-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      size="lg"
      icon={<Upload size={18} />}
      title="Import products"
      description="Upload a CSV. Every row is validated against the master data and CAS checksum before anything is written."
      hideActions
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--vbds-space-16)' }}>
        {!rows ? (
          <>
            <label className="astra-dropzone">
              <FileSpreadsheet size={26} style={{ color: 'var(--vbds-text-tertiary)' }} aria-hidden="true" />
              <span className="astra-dropzone__title">Choose a CSV file</span>
              <span className="astra-dropzone__hint">
                Columns: {TEMPLATE_HEADERS.join(' · ')}
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="astra-sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button variant="text" size="sm" onClick={downloadTemplate}>
                Download template
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 'var(--vbds-space-8)', alignItems: 'center' }}>
              <Badge tone="success" dot>
                {valid.length} ready
              </Badge>
              {invalid.length > 0 && (
                <Badge tone="danger" dot>
                  {invalid.length} with errors
                </Badge>
              )}
            </div>

            <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--vbds-border)', borderRadius: 'var(--vbds-radius-sm)' }}>
              <table className="astra-table">
                <thead>
                  <tr>
                    <th style={{ width: 34 }} aria-label="Row status" />
                    <th>Product</th>
                    <th>CAS</th>
                    <th>Status</th>
                    <th>Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index}>
                      <td>
                        {row.errors.length === 0 ? (
                          <CheckCircle2 size={14} style={{ color: 'var(--vbds-success)' }} aria-label="Valid" />
                        ) : (
                          <TriangleAlert size={14} style={{ color: 'var(--vbds-danger)' }} aria-label="Invalid" />
                        )}
                      </td>
                      <td title={row.name}>{row.name || '—'}</td>
                      <td className="astra-table__mono">{row.casNumber || '—'}</td>
                      <td>{row.status}</td>
                      <td style={{ color: 'var(--vbds-danger)' }} title={row.errors.join('; ')}>
                        {row.errors.join('; ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--vbds-space-8)' }}>
              <Button variant="ghost" onClick={reset}>
                Choose another file
              </Button>
              <Button onClick={() => void runImport()} loading={importing} disabled={valid.length === 0}>
                Import {valid.length} {valid.length === 1 ? 'product' : 'products'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
