'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Eye, MoreHorizontal, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { CompanyRow, EquipmentMaster, Location, Role } from '@/lib/types';
import { DataTable } from '@/components/data-table/DataTable';
import { Avatar, Badge, Button, Dialog, IconButton, Menu, MenuItem, Select, Tooltip } from '@/components/vbds';
import { formatNumber, orDash } from '@/lib/format';
import { can } from '@/server/rbac';
import type { ExportColumn } from '@/lib/export';

export function CompaniesTable({
  companies,
  locations,
  equipment,
  role,
}: {
  companies: CompanyRow[];
  locations: Location[];
  equipment: EquipmentMaster[];
  role: Role;
}) {
  const router = useRouter();
  const [locationFilter, setLocationFilter] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ ids: string[]; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const canDelete = can(role, 'company:delete');

  const rows = useMemo(
    () => companies.filter((c) => !locationFilter || c.locationId === locationFilter),
    [companies, locationFilter],
  );

  const columns = useMemo<ColumnDef<CompanyRow, unknown>[]>(
    () => [
      {
        id: 'sno',
        header: 'S.No',
        size: 60,
        enableSorting: false,
        cell: ({ row, table }) => {
          const { pageIndex, pageSize } = table.getState().pagination;
          return <span className="astra-table__num">{pageIndex * pageSize + row.index + 1}</span>;
        },
      },
      {
        accessorKey: 'name',
        header: 'Company Name',
        size: 260,
        cell: ({ row }) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Avatar name={row.original.name} size="sm" square />
            <Link href={`/companies/${row.original.slug}`} className="astra-table__link" title={row.original.name}>
              {row.original.name}
            </Link>
          </span>
        ),
      },
      { accessorKey: 'locationName', header: 'Location', size: 130 },
      {
        accessorKey: 'chemicalStaff',
        header: 'Chemical Staff',
        size: 120,
        cell: ({ getValue }) => <span className="astra-table__num">{formatNumber(Number(getValue()))}</span>,
      },
      {
        accessorKey: 'phdCount',
        header: 'PhD',
        size: 70,
        cell: ({ getValue }) => <span className="astra-table__num">{String(getValue())}</span>,
      },
      {
        accessorKey: 'established',
        header: 'Established',
        size: 100,
        cell: ({ getValue }) => <span className="astra-table__num">{String(getValue())}</span>,
      },
      {
        accessorKey: 'equipmentCount',
        header: 'Capabilities',
        size: 110,
        cell: ({ getValue }) => (
          <Badge tone="secondary" size="sm">
            {String(getValue())} / {equipment.length}
          </Badge>
        ),
      },
      {
        accessorKey: 'productCount',
        header: 'Products',
        size: 90,
        cell: ({ getValue }) => <span className="astra-table__num">{String(getValue())}</span>,
      },
      {
        accessorKey: 'strength',
        header: 'Strength',
        size: 280,
        cell: ({ getValue }) => {
          const text = orDash(getValue() as string);
          return (
            <Tooltip content={text}>
              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: 'capital',
        header: 'Capital',
        size: 90,
        cell: ({ getValue }) => orDash(getValue() as string),
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 80,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => (
          <Menu trigger={<IconButton size="sm" icon={<MoreHorizontal size={15} />} label="Row actions" />}>
            <MenuItem icon={<Eye size={14} />} onSelect={() => router.push(`/companies/${row.original.slug}`)}>
              View profile
            </MenuItem>
            {canDelete && (
              <MenuItem
                icon={<Trash2 size={14} />}
                danger
                onSelect={() => setConfirmDelete({ ids: [row.original.id], label: row.original.name })}
              >
                Delete
              </MenuItem>
            )}
          </Menu>
        ),
      },
    ],
    [canDelete, equipment.length, router],
  );

  const exportColumns: ExportColumn<CompanyRow>[] = useMemo(
    () => [
      { header: 'Company Name', accessor: (c) => c.name, width: 36 },
      { header: 'Location', accessor: (c) => c.locationName, width: 16 },
      { header: 'Chemical Staff', accessor: (c) => c.chemicalStaff, width: 14 },
      { header: 'PhD', accessor: (c) => c.phdCount, width: 8 },
      { header: 'Established', accessor: (c) => c.established, width: 12 },
      { header: 'Capabilities', accessor: (c) => c.equipmentCount, width: 12 },
      { header: 'Products', accessor: (c) => c.productCount, width: 10 },
      { header: 'Strength', accessor: (c) => c.strength ?? '', width: 46 },
      { header: 'Presentation', accessor: (c) => c.presentation ?? '', width: 28 },
      { header: 'Capital', accessor: (c) => c.capital ?? '', width: 12 },
      { header: 'Website', accessor: (c) => c.website ?? '', width: 30 },
      { header: 'Contact', accessor: (c) => c.contactEmail ?? '', width: 30 },
      { header: 'Remarks', accessor: (c) => c.remarks ?? '', width: 50 },
    ],
    [],
  );

  return (
    <>
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(c) => c.id}
        searchPlaceholder="Search companies, cities, capabilities…"
        exportColumns={exportColumns}
        exportName="astra-companies"
        enableSelection={canDelete}
        stickyFirstColumn
        emptyTitle="No companies match these filters"
        emptyDescription="Clear the location filter or widen the search."
        toolbar={
          <Select
            options={[
              { value: '', label: 'All locations' },
              ...locations.map((l) => ({ value: l.id, label: l.name })),
            ]}
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            aria-label="Filter by location"
            className="astra-toolbar-select"
          />
        }
        bulkActions={(ids) =>
          canDelete ? (
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={13} />}
              onClick={() => setConfirmDelete({ ids, label: `${ids.length} companies` })}
            >
              Delete
            </Button>
          ) : null
        }
      />

      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        tone="danger"
        icon={<AlertTriangle size={18} />}
        title={`Delete ${confirmDelete?.label}?`}
        description="The company disappears from every product's supply picture. This is a soft delete — the record stays in the audit trail and can be restored by an administrator."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmLoading={busy}
        onConfirm={async () => {
          if (!confirmDelete) return;
          setBusy(true);
          try {
            for (const id of confirmDelete.ids) {
              const response = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
              if (!response.ok) throw new Error('Delete failed');
            }
            toast.success(`Deleted ${confirmDelete.label}`);
            router.refresh();
            setConfirmDelete(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Something went wrong');
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
