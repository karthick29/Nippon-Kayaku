'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Check, Minus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { EquipmentKey, EquipmentMaster, ProductCompanyRow } from '@/lib/types';
import { DataTable } from '@/components/data-table/DataTable';
import { Badge, Tooltip } from '@/components/vbds';
import { statusTone } from '@/lib/status';
import { orDash } from '@/lib/format';
import type { ExportColumn } from '@/lib/export';

/* ════════════════════════════════════════════════════════════════════
   Product → Companies capability matrix.

   The widest table in ASTRA and the reason the product page exists: for
   one chemical, every company that can make it and exactly what each one
   has to make it with.

   Column set is the brief's, in order: Company Name, Location, Chemical
   Staff, PhD, Established, Hoods, Autoclave, Flow Chemistry, Kilo Lab,
   Rotavapor, Open Reaction, HPLC, GC, MS, Prep HPLC, NMR, Strength,
   Presentation, Capital, Product Codes, Actions.

   Rendering rules that make 21 columns readable:
     · Company Name is sticky while scrolling horizontally.
     · Count capabilities render the number; a zero renders as an
       explicit dash, never a bare "0" that reads as data-entry noise.
     · Spec capabilities render their text, truncated with a tooltip.
     · Boolean capabilities render a check or a dash, plus a text label
       for screen readers — never colour alone.
   ════════════════════════════════════════════════════════════════════ */

/** Column order from the brief. */
const EQUIPMENT_ORDER: EquipmentKey[] = [
  'hoods',
  'autoclave',
  'flowChemistry',
  'kiloLab',
  'rotavapor',
  'openReaction',
  'hplc',
  'gc',
  'ms',
  'prepHplc',
  'nmr',
];

function EquipmentCell({
  row,
  equipmentKey,
  master,
}: {
  row: ProductCompanyRow;
  /** Not named `key` — React reserves that and would never pass it through. */
  equipmentKey: EquipmentKey;
  master: EquipmentMaster | undefined;
}) {
  const entry = row.equipment[equipmentKey];

  if (!entry?.available) {
    return (
      <span style={{ color: 'var(--vbds-text-tertiary)' }} title="Not available">
        <Minus size={13} aria-label="Not available" />
      </span>
    );
  }

  if (master?.valueType === 'boolean') {
    return (
      <Tooltip content={entry.remarks ?? 'Available'}>
        <span style={{ color: 'var(--vbds-success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Check size={13} aria-hidden="true" />
          <span className="astra-sr-only">Available</span>
          Yes
        </span>
      </Tooltip>
    );
  }

  if (master?.valueType === 'count') {
    const count = entry.count ?? 0;
    if (count === 0) {
      return (
        <span style={{ color: 'var(--vbds-text-tertiary)' }} title="None">
          <Minus size={13} aria-label="None" />
        </span>
      );
    }
    return <span className="astra-table__num">{count}</span>;
  }

  const text = entry.specification ?? entry.capacity ?? 'Available';
  return (
    <Tooltip content={entry.remarks ? `${text} — ${entry.remarks}` : text}>
      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
    </Tooltip>
  );
}

export function ProductCompaniesTable({
  rows,
  equipmentMaster,
  productName,
}: {
  rows: ProductCompanyRow[];
  equipmentMaster: EquipmentMaster[];
  productName: string;
}) {
  const masterByKey = useMemo(
    () => new Map(equipmentMaster.map((e) => [e.key, e])),
    [equipmentMaster],
  );

  const columns = useMemo<ColumnDef<ProductCompanyRow, unknown>[]>(() => {
    const base: ColumnDef<ProductCompanyRow, unknown>[] = [
      {
        id: 'company',
        header: 'Company Name',
        size: 230,
        accessorFn: (row) => row.company.name,
        cell: ({ row }) => (
          <Link
            href={`/companies/${row.original.company.slug}`}
            className="astra-table__link"
            title={row.original.company.name}
          >
            {row.original.company.name}
          </Link>
        ),
      },
      {
        id: 'location',
        header: 'Location',
        size: 120,
        accessorFn: (row) => row.company.locationName,
      },
      {
        id: 'chemicalStaff',
        header: 'Chemical Staff',
        size: 110,
        accessorFn: (row) => row.company.chemicalStaff,
        cell: ({ getValue }) => <span className="astra-table__num">{String(getValue())}</span>,
      },
      {
        id: 'phdCount',
        header: 'PhD',
        size: 70,
        accessorFn: (row) => row.company.phdCount,
        cell: ({ getValue }) => <span className="astra-table__num">{String(getValue())}</span>,
      },
      {
        id: 'established',
        header: 'Established',
        size: 100,
        accessorFn: (row) => row.company.established,
        cell: ({ getValue }) => <span className="astra-table__num">{String(getValue())}</span>,
      },
    ];

    const equipmentColumns: ColumnDef<ProductCompanyRow, unknown>[] = EQUIPMENT_ORDER.map((key) => {
      const master = masterByKey.get(key);
      return {
        id: key,
        header: master?.name ?? key,
        size: master?.valueType === 'spec' ? 150 : 90,
        accessorFn: (row: ProductCompanyRow) => {
          const entry = row.equipment[key];
          if (!entry?.available) return '';
          return entry.count ?? entry.specification ?? 'Yes';
        },
        cell: ({ row }) => <EquipmentCell row={row.original} equipmentKey={key} master={master} />,
      };
    });

    const tail: ColumnDef<ProductCompanyRow, unknown>[] = [
      {
        id: 'strength',
        header: 'Strength',
        size: 200,
        accessorFn: (row) => row.strength ?? row.company.strength ?? '',
        cell: ({ getValue }) => {
          const text = orDash(String(getValue()));
          return (
            <Tooltip content={text}>
              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
            </Tooltip>
          );
        },
      },
      {
        id: 'presentation',
        header: 'Presentation',
        size: 170,
        accessorFn: (row) => row.presentation ?? row.company.presentation ?? '',
        cell: ({ getValue }) => orDash(String(getValue())),
      },
      {
        id: 'capital',
        header: 'Capital',
        size: 90,
        accessorFn: (row) => row.capital ?? row.company.capital ?? '',
        cell: ({ getValue }) => orDash(String(getValue())),
      },
      {
        id: 'productCodes',
        header: 'Product Codes',
        size: 140,
        accessorFn: (row) => row.productCodes.join(', '),
        cell: ({ row }) => (
          <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'nowrap' }}>
            {row.original.productCodes.map((code) => (
              <Badge key={code} size="sm" tone="info" className="astra-table__mono">
                {code}
              </Badge>
            ))}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Supply Status',
        size: 120,
        accessorFn: (row) => row.status,
        cell: ({ row }) => (
          <Badge tone={statusTone(row.original.status)} size="sm" dot>
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 90,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => (
          <Link
            href={`/companies/${row.original.company.slug}`}
            style={{
              color: 'var(--vbds-primary)',
              fontSize: 'var(--vbds-caption-size)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            View
          </Link>
        ),
      },
    ];

    return [...base, ...equipmentColumns, ...tail];
  }, [masterByKey]);

  const exportColumns: ExportColumn<ProductCompanyRow>[] = useMemo(() => {
    const equipmentExports: ExportColumn<ProductCompanyRow>[] = EQUIPMENT_ORDER.map((key) => {
      const master = masterByKey.get(key);
      return {
        header: master?.name ?? key,
        width: 18,
        accessor: (row: ProductCompanyRow) => {
          const entry = row.equipment[key];
          if (!entry?.available) return 'NA';
          if (master?.valueType === 'boolean') return 'Yes';
          if (master?.valueType === 'count') return entry.count ?? 0;
          return entry.specification ?? 'Yes';
        },
      };
    });

    return [
      { header: 'Company Name', accessor: (r) => r.company.name, width: 34 },
      { header: 'Location', accessor: (r) => r.company.locationName, width: 16 },
      { header: 'Chemical Staff', accessor: (r) => r.company.chemicalStaff, width: 14 },
      { header: 'PhD', accessor: (r) => r.company.phdCount, width: 8 },
      { header: 'Established', accessor: (r) => r.company.established, width: 12 },
      ...equipmentExports,
      { header: 'Strength', accessor: (r) => r.strength ?? r.company.strength ?? '', width: 40 },
      { header: 'Presentation', accessor: (r) => r.presentation ?? r.company.presentation ?? '', width: 26 },
      { header: 'Capital', accessor: (r) => r.capital ?? r.company.capital ?? '', width: 12 },
      { header: 'Product Codes', accessor: (r) => r.productCodes.join(', '), width: 18 },
      { header: 'Supply Status', accessor: (r) => r.status, width: 14 },
      { header: 'Remarks', accessor: (r) => r.remarks ?? '', width: 46 },
    ];
  }, [masterByKey]);

  return (
    <DataTable
      data={rows}
      columns={columns}
      getRowId={(r) => r.linkId}
      searchPlaceholder="Search companies, locations, capabilities…"
      exportColumns={exportColumns}
      exportName={`astra-${productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-companies`}
      initialPageSize={25}
      stickyFirstColumn
      emptyTitle="No companies mapped to this product"
      emptyDescription="Attach a company from the product editor to start building the supply picture."
    />
  );
}
