/* ════════════════════════════════════════════════════════════════════
   Client-side export.

   Exports run in the browser against exactly the rows the user is
   looking at — current filters, current column order, current
   visibility. A server round trip would have to re-derive that state and
   would drift from what is on screen.

   Heavy writers (exceljs, jspdf) are dynamically imported so they are
   only fetched when someone actually exports.
   ════════════════════════════════════════════════════════════════════ */

export interface ExportColumn<T> {
  header: string;
  /** Cell value. Return a primitive — objects are stringified. */
  accessor: (row: T) => string | number | null | undefined;
  /** Column width hint in characters, for Excel. */
  width?: number;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next frame so Safari has committed the navigation.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

function cell<T>(row: T, column: ExportColumn<T>): string {
  const value = column.accessor(row);
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * RFC 4180 CSV escaping, plus a leading apostrophe on values that begin
 * with =, +, - or @ — otherwise Excel and Sheets evaluate them as
 * formulas, which is a real injection vector in exported data.
 */
function escapeCsv(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

export function exportCsv<T>(rows: T[], columns: ExportColumn<T>[], name: string): void {
  const header = columns.map((c) => escapeCsv(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => escapeCsv(cell(row, c))).join(',')).join('\r\n');
  // BOM so Excel opens UTF-8 correctly on Windows.
  const blob = new Blob([`﻿${header}\r\n${body}`], { type: 'text/csv;charset=utf-8;' });
  download(blob, `${name}-${timestamp()}.csv`);
}

export async function exportExcel<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  name: string,
  sheetName = 'Data',
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ASTRA — Nippon Kayaku';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1 }], // sticky header, same as the on-screen table
  });

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.header,
    width: c.width ?? Math.min(46, Math.max(12, c.header.length + 6)),
  }));

  sheet.getRow(1).font = { bold: true, size: 11 };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  sheet.getRow(1).alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 22;

  for (const row of rows) {
    sheet.addRow(columns.map((c) => c.accessor(row) ?? ''));
  }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  const buffer = await workbook.xlsx.writeBuffer();
  download(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${name}-${timestamp()}.xlsx`,
  );
}

export async function exportPdf<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  name: string,
  meta: { title: string; subtitle?: string },
): Promise<void> {
  const { jsPDF: JsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new JsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(meta.title, 40, 44);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const stamp = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  doc.text(`${meta.subtitle ? `${meta.subtitle} · ` : ''}${rows.length} rows · Generated ${stamp}`, 40, 60);

  autoTable(doc, {
    startY: 76,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => cell(row, c))),
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 5, textColor: [15, 23, 42], overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40, bottom: 40 },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const current = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `ASTRA · Nippon Kayaku · Page ${current} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 20,
        { align: 'center' },
      );
    },
  });

  doc.save(`${name}-${timestamp()}.pdf`);
}

/**
 * Parses a pasted or uploaded CSV into row objects keyed by header.
 * Handles quoted fields, escaped quotes and CRLF — enough for the
 * Import Excel flow, which asks for CSV or an Excel "Save as CSV".
 */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const clean = text.replace(/^﻿/, '');

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i]!;

    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!header) return [];

  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}
