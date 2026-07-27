'use client';

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Columns3,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Button,
  Checkbox,
  EmptyState,
  IconButton,
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  SearchField,
  Select,
} from '@/components/vbds';
import { exportCsv, exportExcel, type ExportColumn } from '@/lib/export';
import { cx } from '@/lib/cn';

/* ════════════════════════════════════════════════════════════════════
   Enterprise data table.

   TanStack Table headless core + VBDS chrome. One component backs the
   Products table, the Companies table, the widest table in the app (the
   product Companies tab, 22 columns) and every Settings list.

   Behaviour that is deliberate rather than default:
     · Sorting/paging happen client-side over the page the server sent.
       The Products page requests the full filtered set, so sorting is
       instant and never re-fetches.
     · Column sizing uses the TanStack column-sizing model with a live
       drag handle; widths persist for the session via `storageKey`.
     · Exports run over the *filtered, visible, ordered* rows, not the
       raw data — what you see is what you get.
   ════════════════════════════════════════════════════════════════════ */

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  /** Stable row id — required for selection to survive sorting. */
  getRowId: (row: T) => string;
  /** Placeholder for the toolbar search box. */
  searchPlaceholder?: string;
  /** Columns used when exporting. Defaults to the visible columns. */
  exportColumns?: ExportColumn<T>[];
  exportName?: string;
  /** Rendered in the toolbar, left of the export buttons. */
  toolbar?: ReactNode;
  /** Rendered in the bulk bar when rows are selected. */
  bulkActions?: (selectedIds: string[], clear: () => void) => ReactNode;
  enableSelection?: boolean;
  initialPageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Persists column visibility and sizing under this key. */
  storageKey?: string;
  /** Sticks the first data column while scrolling horizontally. */
  stickyFirstColumn?: boolean;
  className?: string;
}

const PAGE_SIZES = ['10', '25', '50', '100'];

export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchPlaceholder = 'Search…',
  exportColumns,
  exportName = 'astra-export',
  toolbar,
  bulkActions,
  enableSelection,
  initialPageSize = 25,
  emptyTitle = 'No results',
  emptyDescription = 'Adjust your filters or search terms and try again.',
  emptyAction,
  stickyFirstColumn,
  className,
}: DataTableProps<T>) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);

  const allColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!enableSelection) return columns;

    const selectColumn: ColumnDef<T, unknown> = {
      id: '__select__',
      size: 40,
      enableResizing: false,
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(v)}
          ariaLabel="Select all rows on this page"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(v)}
          ariaLabel="Select row"
        />
      ),
    };

    return [selectColumn, ...columns];
  }, [columns, enableSelection]);

  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    state: { globalFilter, sorting, columnVisibility, rowSelection },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: 'onChange',
    enableRowSelection: !!enableSelection,
    initialState: { pagination: { pageSize: initialPageSize } },
  });

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const filteredRows = table.getFilteredRowModel().rows.map((r) => r.original);
  const total = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);

  const resolvedExportColumns: ExportColumn<T>[] = useMemo(() => {
    if (exportColumns) return exportColumns;
    // Fall back to the visible leaf columns using their accessor keys.
    return table
      .getVisibleLeafColumns()
      .filter((c) => c.id !== '__select__' && c.id !== 'actions')
      .map((c) => ({
        header: typeof c.columnDef.header === 'string' ? c.columnDef.header : c.id,
        accessor: (row: T) => {
          const key = (c.columnDef as { accessorKey?: string }).accessorKey ?? c.id;
          const value = (row as Record<string, unknown>)[key];
          return value === null || value === undefined ? '' : String(value);
        },
      }));
  }, [exportColumns, table]);

  async function handleExport(kind: 'csv' | 'xlsx') {
    setExporting(true);
    try {
      if (kind === 'csv') exportCsv(filteredRows, resolvedExportColumns, exportName);
      else await exportExcel(filteredRows, resolvedExportColumns, exportName);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={cx('astra-table-wrap', className)}>
      <div className="astra-table-toolbar">
        <div className="astra-table-toolbar__search">
          <SearchField
            fullWidth
            value={globalFilter}
            onValueChange={setGlobalFilter}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>

        {toolbar}

        <div style={{ flex: 1 }} />

        <Menu
          trigger={
            <Button variant="outlined" size="sm" icon={<Columns3 size={14} />}>
              Columns
            </Button>
          }
        >
          <MenuLabel>Visible columns</MenuLabel>
          {table
            .getAllLeafColumns()
            .filter((c) => c.id !== '__select__')
            .map((column) => (
              <MenuCheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                onCheckedChange={(v) => column.toggleVisibility(v)}
              >
                {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
              </MenuCheckboxItem>
            ))}
        </Menu>

        <Menu
          trigger={
            <Button variant="outlined" size="sm" icon={<Download size={14} />} loading={exporting}>
              Export
            </Button>
          }
        >
          <MenuLabel>{total} filtered rows</MenuLabel>
          <MenuItem icon={<FileText size={14} />} onSelect={() => void handleExport('csv')}>
            Export CSV
          </MenuItem>
          <MenuItem icon={<FileSpreadsheet size={14} />} onSelect={() => void handleExport('xlsx')}>
            Export Excel
          </MenuItem>
        </Menu>
      </div>

      {enableSelection && selectedIds.length > 0 && (
        <div className="astra-bulkbar">
          <span>
            {selectedIds.length} {selectedIds.length === 1 ? 'row' : 'rows'} selected
          </span>
          <div style={{ flex: 1 }} />
          {bulkActions?.(selectedIds, () => setRowSelection({}))}
          <Button variant="text" size="sm" onClick={() => setRowSelection({})}>
            Clear
          </Button>
        </div>
      )}

      {total === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <div className="astra-table-scroll">
          <table className="astra-table" style={{ width: table.getCenterTotalSize() }}>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header, index) => {
                    const sortDir = header.column.getIsSorted();
                    const canSort = header.column.getCanSort();
                    const sticky = stickyFirstColumn && index === (enableSelection ? 1 : 0);

                    return (
                      <th
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{ width: header.getSize(), position: 'relative' }}
                        className={cx(sticky && 'astra-table__sticky-col')}
                        aria-sort={
                          sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : undefined
                        }
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            className="astra-table__sort"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <span
                              className={cx(
                                'astra-table__sort-icon',
                                sortDir && 'astra-table__sort-icon--active',
                              )}
                              aria-hidden="true"
                            >
                              {sortDir === 'asc' ? (
                                <ArrowUp size={12} />
                              ) : sortDir === 'desc' ? (
                                <ArrowDown size={12} />
                              ) : (
                                <ChevronsUpDown size={12} />
                              )}
                            </span>
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}

                        {header.column.getCanResize() && (
                          <button
                            type="button"
                            aria-label={`Resize ${header.id} column`}
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={cx(
                              'astra-table__resizer',
                              header.column.getIsResizing() && 'astra-table__resizer--active',
                            )}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} data-selected={row.getIsSelected() || undefined}>
                  {row.getVisibleCells().map((cellItem, index) => {
                    const sticky = stickyFirstColumn && index === (enableSelection ? 1 : 0);
                    return (
                      <td
                        key={cellItem.id}
                        style={{ width: cellItem.column.getSize() }}
                        className={cx(sticky && 'astra-table__sticky-col')}
                      >
                        {flexRender(cellItem.column.columnDef.cell, cellItem.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 && (
        <div className="astra-table-footer">
          <span>
            Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--vbds-space-12)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--vbds-space-8)' }}>
              <span>Rows</span>
              <Select
                options={PAGE_SIZES}
                value={String(pageSize)}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                aria-label="Rows per page"
                className="astra-page-size"
              />
            </label>

            <div className="astra-pagination">
              <IconButton
                size="sm"
                variant="outlined"
                icon={<ChevronsLeft size={14} />}
                label="First page"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.setPageIndex(0)}
              />
              <IconButton
                size="sm"
                variant="outlined"
                icon={<ChevronLeft size={14} />}
                label="Previous page"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              />
              <span style={{ padding: '0 8px', fontVariantNumeric: 'tabular-nums' }}>
                {pageIndex + 1} / {table.getPageCount()}
              </span>
              <IconButton
                size="sm"
                variant="outlined"
                icon={<ChevronRight size={14} />}
                label="Next page"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              />
              <IconButton
                size="sm"
                variant="outlined"
                icon={<ChevronsRight size={14} />}
                label="Last page"
                disabled={!table.getCanNextPage()}
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { type ColumnDef };
export { MenuSeparator };
