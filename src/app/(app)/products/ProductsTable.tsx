'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { Application, ProductCategory, ProductRow, ProductStatus, Role } from '@/lib/types';
import { DataTable } from '@/components/data-table/DataTable';
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  Select,
  Tooltip,
} from '@/components/vbds';
import { statusTone } from '@/lib/status';
import { formatDate } from '@/lib/format';
import { can } from '@/server/rbac';
import type { ExportColumn } from '@/lib/export';
import { ImportDialog } from './ImportDialog';

/* ════════════════════════════════════════════════════════════════════
   Products table.

   The full column set from the brief: S.No, Product Name, CAS Number,
   Application, Status, Companies, Created Date, Actions — plus Category
   and Formula, hidden by default and available from the Columns menu.
   ════════════════════════════════════════════════════════════════════ */

const STATUSES: ProductStatus[] = ['Commercial', 'Development', 'Pilot', 'Discontinued'];

export function ProductsTable({
  products,
  applications,
  categories,
  role,
}: {
  products: ProductRow[];
  applications: Application[];
  categories: ProductCategory[];
  role: Role;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const [applicationFilter, setApplicationFilter] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; label: string } | null>(null);
  const [bulkStatus, setBulkStatus] = useState<{ ids: string[]; clear: () => void } | null>(null);
  const [bulkStatusValue, setBulkStatusValue] = useState<ProductStatus>('Commercial');
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const canEdit = can(role, 'product:update');
  const canDelete = can(role, 'product:delete');
  const canCreate = can(role, 'product:create');

  const rows = useMemo(
    () =>
      products.filter(
        (p) =>
          (!statusFilter || p.status === statusFilter) &&
          (!applicationFilter || p.applicationId === applicationFilter),
      ),
    [products, statusFilter, applicationFilter],
  );

  async function mutate(input: RequestInfo, init: RequestInit, successMessage: string) {
    setBusy(true);
    try {
      const response = await fetch(input, init);
      const body = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? 'Request failed');
      toast.success(successMessage);
      router.refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const columns = useMemo<ColumnDef<ProductRow, unknown>[]>(
    () => [
      {
        id: 'sno',
        header: 'S.No',
        size: 64,
        enableSorting: false,
        cell: ({ row, table }) => {
          const { pageIndex, pageSize } = table.getState().pagination;
          return <span className="astra-table__num">{pageIndex * pageSize + row.index + 1}</span>;
        },
      },
      {
        accessorKey: 'name',
        header: 'Product Name',
        size: 300,
        cell: ({ row }) => (
          <Link href={`/products/${row.original.slug}`} className="astra-table__link" title={row.original.name}>
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'casNumber',
        header: 'CAS Number',
        size: 130,
        cell: ({ getValue }) => <span className="astra-table__mono">{String(getValue())}</span>,
      },
      {
        accessorKey: 'applicationName',
        header: 'Application',
        size: 220,
        cell: ({ getValue }) => (
          <Badge tone="primary" size="sm" title={String(getValue())}>
            {String(getValue())}
          </Badge>
        ),
      },
      {
        accessorKey: 'categoryName',
        header: 'Category',
        size: 140,
      },
      {
        accessorKey: 'molecularFormula',
        header: 'Formula',
        size: 120,
        cell: ({ getValue }) => <span className="astra-table__mono">{String(getValue() ?? '—')}</span>,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 130,
        cell: ({ row }) => (
          <Badge tone={statusTone(row.original.status)} size="sm" dot>
            {row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'companyCount',
        header: 'Companies',
        size: 160,
        cell: ({ row }) => {
          const { companies, companyCount } = row.original;
          if (companyCount === 0) return <span style={{ color: 'var(--vbds-text-tertiary)' }}>—</span>;
          return (
            <Tooltip content={companies.map((c) => c.name).join(', ')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span className="astra-result__avatars">
                  {companies.slice(0, 3).map((c) => (
                    <Avatar key={c.id} name={c.name} size="sm" />
                  ))}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--vbds-text-secondary)' }}>
                  {companyCount}
                </span>
              </span>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: 'Created Date',
        size: 130,
        cell: ({ getValue }) => formatDate(String(getValue())),
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 90,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => (
          <Menu
            trigger={<IconButton size="sm" icon={<MoreHorizontal size={15} />} label="Row actions" />}
          >
            <MenuItem icon={<Eye size={14} />} onSelect={() => router.push(`/products/${row.original.slug}`)}>
              View
            </MenuItem>
            {canEdit && (
              <MenuItem
                icon={<Pencil size={14} />}
                onSelect={() => router.push(`/products/${row.original.slug}/edit`)}
              >
                Edit
              </MenuItem>
            )}
            <MenuItem
              icon={<Building2 size={14} />}
              onSelect={() => router.push(`/products/${row.original.slug}?tab=companies`)}
            >
              Companies ({row.original.companyCount})
            </MenuItem>
            {canCreate && (
              <MenuItem
                icon={<Copy size={14} />}
                onSelect={() =>
                  void mutate(
                    `/api/products/${row.original.id}/duplicate`,
                    { method: 'POST' },
                    `Duplicated ${row.original.name}`,
                  )
                }
              >
                Duplicate
              </MenuItem>
            )}
            {canDelete && (
              <>
                <MenuSeparator />
                <MenuItem
                  icon={<Trash2 size={14} />}
                  danger
                  onSelect={() => setConfirmDelete({ ids: [row.original.id], label: row.original.name })}
                >
                  Delete
                </MenuItem>
              </>
            )}
          </Menu>
        ),
      },
    ],
    [canCreate, canDelete, canEdit, router],
  );

  const exportColumns: ExportColumn<ProductRow>[] = useMemo(
    () => [
      { header: 'Product Name', accessor: (p) => p.name, width: 42 },
      { header: 'CAS Number', accessor: (p) => p.casNumber, width: 16 },
      { header: 'Molecular Formula', accessor: (p) => p.molecularFormula ?? '', width: 18 },
      { header: 'Molecular Weight', accessor: (p) => p.molecularWeight ?? '', width: 16 },
      { header: 'SMILES', accessor: (p) => p.smiles ?? '', width: 40 },
      { header: 'InChIKey', accessor: (p) => p.inchiKey ?? '', width: 30 },
      { header: 'Application', accessor: (p) => p.applicationName, width: 30 },
      { header: 'Category', accessor: (p) => p.categoryName, width: 18 },
      { header: 'Status', accessor: (p) => p.status, width: 14 },
      { header: 'Companies', accessor: (p) => p.companyCount, width: 12 },
      { header: 'Company Names', accessor: (p) => p.companies.map((c) => c.name).join('; '), width: 46 },
      { header: 'Synonyms', accessor: (p) => p.synonyms.join('; '), width: 34 },
      { header: 'Created Date', accessor: (p) => formatDate(p.createdAt), width: 16 },
    ],
    [],
  );

  return (
    <>
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(p) => p.id}
        searchPlaceholder="Search products, CAS, synonyms…"
        exportColumns={exportColumns}
        exportName="astra-products"
        enableSelection={canEdit || canDelete}
        stickyFirstColumn
        emptyTitle="No products match these filters"
        emptyDescription="Clear a filter or widen the search to see more of the catalogue."
        emptyAction={
          canCreate ? (
            <Button variant="secondary" href="/products/new">
              Add product
            </Button>
          ) : undefined
        }
        toolbar={
          <>
            <Select
              options={[{ value: '', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: s }))]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="astra-toolbar-select"
            />
            <Select
              options={[
                { value: '', label: 'All applications' },
                ...applications.map((a) => ({ value: a.id, label: a.name })),
              ]}
              value={applicationFilter}
              onChange={(e) => setApplicationFilter(e.target.value)}
              aria-label="Filter by application"
              className="astra-toolbar-select"
            />
            {canCreate && (
              <Button variant="outlined" size="sm" icon={<Upload size={14} />} onClick={() => setImportOpen(true)}>
                Import
              </Button>
            )}
          </>
        }
        bulkActions={(ids, clear) => (
          <>
            {canEdit && (
              <Button variant="outlined" size="sm" icon={<Pencil size={13} />} onClick={() => setBulkStatus({ ids, clear })}>
                Bulk edit
              </Button>
            )}
            {canDelete && (
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 size={13} />}
                onClick={() => setConfirmDelete({ ids, label: `${ids.length} products` })}
              >
                Delete
              </Button>
            )}
          </>
        )}
      />

      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        tone="danger"
        icon={<AlertTriangle size={18} />}
        title={`Delete ${confirmDelete?.label}?`}
        description="Deleted products are removed from search, tables and reports. This is a soft delete — the record and its history stay in the audit log and can be restored by an administrator."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmLoading={busy}
        onConfirm={async () => {
          if (!confirmDelete) return;
          const ok = await mutate(
            '/api/products/bulk',
            {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: confirmDelete.ids }),
            },
            `Deleted ${confirmDelete.label}`,
          );
          if (ok) setConfirmDelete(null);
        }}
      />

      <Dialog
        open={!!bulkStatus}
        onOpenChange={(open) => !open && setBulkStatus(null)}
        title="Bulk edit products"
        description={`Apply a new status to ${bulkStatus?.ids.length ?? 0} selected ${bulkStatus?.ids.length === 1 ? 'product' : 'products'}.`}
        cancelLabel="Cancel"
        confirmLabel="Apply"
        confirmLoading={busy}
        onConfirm={async () => {
          if (!bulkStatus) return;
          const ok = await mutate(
            '/api/products/bulk',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: bulkStatus.ids, patch: { status: bulkStatusValue } }),
            },
            `Updated ${bulkStatus.ids.length} products`,
          );
          if (ok) {
            bulkStatus.clear();
            setBulkStatus(null);
          }
        }}
      >
        <Select
          label="Status"
          options={STATUSES.map((s) => ({ value: s, label: s }))}
          value={bulkStatusValue}
          onChange={(e) => setBulkStatusValue(e.target.value as ProductStatus)}
          fullWidth
        />
      </Dialog>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        applications={applications}
        categories={categories}
        onImported={() => router.refresh()}
      />
    </>
  );
}
