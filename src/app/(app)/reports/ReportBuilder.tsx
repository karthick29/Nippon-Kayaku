'use client';

import { FileSpreadsheet, FileText, FileType2, Rocket, Beaker, Building2, Wrench } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { CompanyRow, EquipmentMaster, ProductRow } from '@/lib/types';
import { Badge, Button, Card, EmptyState } from '@/components/vbds';
import { exportCsv, exportExcel, exportPdf, type ExportColumn } from '@/lib/export';
import { formatDate } from '@/lib/format';

/* ════════════════════════════════════════════════════════════════════
   Reports.

   Each report is a (rows, columns, metadata) triple; the three export
   formats are the same code path for every report, so a new report is a
   definition rather than three new export implementations.
   ════════════════════════════════════════════════════════════════════ */

type Format = 'csv' | 'xlsx' | 'pdf';

interface ReportDefinition<T> {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  rows: T[];
  columns: ExportColumn<T>[];
  /** Columns shown in the on-screen preview (usually a subset). */
  previewColumns: number;
}

export function ReportBuilder({
  products,
  companies,
  equipment,
}: {
  products: ProductRow[];
  companies: CompanyRow[];
  equipment: EquipmentMaster[];
}) {
  const [activeId, setActiveId] = useState('product-report');
  const [busy, setBusy] = useState<Format | null>(null);

  const productColumns: ExportColumn<ProductRow>[] = [
    { header: 'Product Name', accessor: (p) => p.name, width: 40 },
    { header: 'CAS Number', accessor: (p) => p.casNumber, width: 16 },
    { header: 'Formula', accessor: (p) => p.molecularFormula ?? '', width: 16 },
    { header: 'Application', accessor: (p) => p.applicationName, width: 30 },
    { header: 'Category', accessor: (p) => p.categoryName, width: 18 },
    { header: 'Status', accessor: (p) => p.status, width: 14 },
    { header: 'Companies', accessor: (p) => p.companyCount, width: 12 },
    { header: 'Suppliers', accessor: (p) => p.companies.map((c) => c.name).join('; '), width: 46 },
    { header: 'Created', accessor: (p) => formatDate(p.createdAt), width: 14 },
  ];

  const companyColumns: ExportColumn<CompanyRow>[] = [
    { header: 'Company Name', accessor: (c) => c.name, width: 34 },
    { header: 'Location', accessor: (c) => c.locationName, width: 16 },
    { header: 'Chemical Staff', accessor: (c) => c.chemicalStaff, width: 14 },
    { header: 'PhD', accessor: (c) => c.phdCount, width: 8 },
    { header: 'Established', accessor: (c) => c.established, width: 12 },
    { header: 'Capabilities', accessor: (c) => `${c.equipmentCount} / ${equipment.length}`, width: 14 },
    { header: 'Products', accessor: (c) => c.productCount, width: 10 },
    { header: 'Strength', accessor: (c) => c.strength ?? '', width: 44 },
    { header: 'Capital', accessor: (c) => c.capital ?? '', width: 12 },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const REPORTS: ReportDefinition<any>[] = [
    {
      id: 'product-report',
      title: 'Product Report',
      description: 'Every product in the catalogue with its classification and supplier coverage.',
      icon: <Beaker size={16} />,
      rows: products,
      columns: productColumns,
      previewColumns: 6,
    },
    {
      id: 'company-report',
      title: 'Company Report',
      description: 'The full supplier panel with staffing, capability count and headline strength.',
      icon: <Building2 size={16} />,
      rows: companies,
      columns: companyColumns,
      previewColumns: 6,
    },
    {
      id: 'commercial-products',
      title: 'Commercial Products',
      description: 'Products at commercial status — the sellable catalogue.',
      icon: <Rocket size={16} />,
      rows: products.filter((p) => p.status === 'Commercial'),
      columns: productColumns,
      previewColumns: 6,
    },
    {
      id: 'development-products',
      title: 'Development Products',
      description: 'Products still in development or pilot — the forward pipeline.',
      icon: <Beaker size={16} />,
      rows: products.filter((p) => p.status === 'Development' || p.status === 'Pilot'),
      columns: productColumns,
      previewColumns: 6,
    },
    {
      id: 'capability-report',
      title: 'Capability Report',
      description: 'Companies ranked by how much of the tracked capability set they have on site.',
      icon: <Wrench size={16} />,
      rows: [...companies].sort((a, b) => b.equipmentCount - a.equipmentCount),
      columns: companyColumns,
      previewColumns: 6,
    },
    {
      id: 'unsupplied-products',
      title: 'Products Without a Supplier',
      description: 'Catalogue entries with no company mapped — the gaps to close.',
      icon: <FileText size={16} />,
      rows: products.filter((p) => p.companyCount === 0),
      columns: productColumns,
      previewColumns: 6,
    },
  ];

  const active = REPORTS.find((r) => r.id === activeId)!;

  async function run(format: Format) {
    if (active.rows.length === 0) {
      toast.error('This report has no rows to export.');
      return;
    }

    setBusy(format);
    try {
      const name = `astra-${active.id}`;
      if (format === 'csv') exportCsv(active.rows, active.columns, name);
      else if (format === 'xlsx') await exportExcel(active.rows, active.columns, name, active.title);
      else
        await exportPdf(active.rows, active.columns, name, {
          title: active.title,
          subtitle: 'ASTRA · Nippon Kayaku',
        });

      toast.success(`${active.title} exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  }

  const previewColumns = active.columns.slice(0, active.previewColumns);
  const previewRows = active.rows.slice(0, 12);

  return (
    <div className="astra-reports">
      <div className="astra-reports__list">
        {REPORTS.map((report) => (
          <button
            key={report.id}
            type="button"
            onClick={() => setActiveId(report.id)}
            aria-pressed={report.id === activeId}
            className={`astra-report-card${report.id === activeId ? ' astra-report-card--active' : ''}`}
          >
            <span className="astra-report-card__icon" aria-hidden="true">
              {report.icon}
            </span>
            <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
              <span className="astra-report-card__title">{report.title}</span>
              <span className="astra-report-card__desc">{report.description}</span>
            </span>
            <Badge size="sm" tone={report.id === activeId ? 'primary' : 'neutral'}>
              {report.rows.length}
            </Badge>
          </button>
        ))}
      </div>

      <Card padding="none" className="astra-reports__preview">
        <div className="astra-table-toolbar">
          <div style={{ minWidth: 0 }}>
            <h2 className="vbds-card__title">{active.title}</h2>
            <p className="vbds-card__subtitle">
              {active.rows.length} {active.rows.length === 1 ? 'row' : 'rows'} · {active.columns.length} columns
            </p>
          </div>

          <div style={{ flex: 1 }} />

          <Button
            variant="outlined"
            size="sm"
            icon={<FileText size={14} />}
            loading={busy === 'csv'}
            onClick={() => void run('csv')}
          >
            CSV
          </Button>
          <Button
            variant="outlined"
            size="sm"
            icon={<FileSpreadsheet size={14} />}
            loading={busy === 'xlsx'}
            onClick={() => void run('xlsx')}
          >
            Excel
          </Button>
          <Button size="sm" icon={<FileType2 size={14} />} loading={busy === 'pdf'} onClick={() => void run('pdf')}>
            PDF
          </Button>
        </div>

        {active.rows.length === 0 ? (
          <EmptyState
            title="Nothing to report"
            description="This report has no matching rows right now — which, for the gap reports, is good news."
          />
        ) : (
          <>
            <div className="astra-table-scroll">
              <table className="astra-table">
                <thead>
                  <tr>
                    {previewColumns.map((column) => (
                      <th key={column.header}>{column.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={index}>
                      {previewColumns.map((column) => (
                        <td key={column.header} title={String(column.accessor(row) ?? '')}>
                          {String(column.accessor(row) ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="astra-table-footer">
              <span>
                Previewing {previewRows.length} of {active.rows.length} rows and {previewColumns.length} of{' '}
                {active.columns.length} columns. Exports include every row and column.
              </span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
