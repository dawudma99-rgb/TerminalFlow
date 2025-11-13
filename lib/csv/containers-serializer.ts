// lib/csv/containers-serializer.ts

export type ContainerForExport = {
  container_no: string;
  bl_number?: string | null;
  pol?: string | null;
  pod?: string | null;
  carrier?: string | null;
  container_size?: string | null;
  assigned_to?: string | null;
  arrival_date?: string | null;           // ISO or human date; we normalize
  free_days?: number | null;
  days_left?: number | null;              // computed upstream (optional)
  status?: 'Safe' | 'Warning' | 'Overdue' | 'Closed' | string | null;
  demurrage_fee_if_late?: number | null;
  demurrage_fees?: number | null;         // computed upstream (optional)
  has_detention?: boolean | null;
  gate_out_date?: string | null;
  empty_return_date?: string | null;
  detention_free_days?: number | null;
  detention_fee_rate?: number | null;
  detention_fees?: number | null;         // computed upstream (optional)
  milestone?: string | null;
  notes?: string | null;
  list_id?: string | null;
  updated_at?: string | null;             // ISO
};

type Column = { key: keyof ContainerForExport; header: string; formatter?: (v: any) => string };

const COLUMNS: Column[] = [
  { key: 'container_no', header: 'Container Number' },
  { key: 'bl_number', header: 'B/L Number' },
  { key: 'pol', header: 'POL' },
  { key: 'pod', header: 'POD' },
  { key: 'carrier', header: 'Carrier' },
  { key: 'container_size', header: 'Container Size' },
  { key: 'assigned_to', header: 'Assigned To' },
  { key: 'arrival_date', header: 'Arrival Date', formatter: isoDate },
  { key: 'free_days', header: 'Free Days', formatter: num },
  { key: 'days_left', header: 'Days Left', formatter: num },
  { key: 'status', header: 'Status' },
  { key: 'demurrage_fee_if_late', header: 'Demurrage Flat Rate', formatter: num },
  { key: 'demurrage_fees', header: 'Demurrage Fees', formatter: num },
  { key: 'has_detention', header: 'Has Detention', formatter: bool },
  { key: 'gate_out_date', header: 'Gate Out', formatter: isoDate },
  { key: 'empty_return_date', header: 'Empty Return', formatter: isoDate },
  { key: 'detention_free_days', header: 'Detention Free Days', formatter: num },
  { key: 'detention_fee_rate', header: 'Detention Rate', formatter: num },
  { key: 'detention_fees', header: 'Detention Fees', formatter: num },
  { key: 'milestone', header: 'Milestone' },
  { key: 'notes', header: 'Notes' },
  { key: 'list_id', header: 'List ID' },
  { key: 'updated_at', header: 'Updated At', formatter: isoDateTime },
];

export function serializeContainersToCSV(rows: ContainerForExport[]): string {
  // UTF-8 BOM ensures Excel opens as UTF-8
  const BOM = '\uFEFF';
  const header = COLUMNS.map(c => csvEscape(c.header)).join(',') + '\r\n';

  const body = rows.map(r => {
    const cells = COLUMNS.map(c => {
      const raw = r[c.key];
      const val = c.formatter ? c.formatter(raw) : toStr(raw);
      return csvEscape(val);
    });
    return cells.join(',');
  }).join('\r\n');

  return BOM + header + body + (rows.length ? '\r\n' : '');
}

/* ---------- helpers (pure) ---------- */

function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' && !Number.isFinite(v)) return '';
  return String(v);
}

function csvEscape(s: string): string {
  // RFC 4180: fields with comma, quote, CR or LF must be quoted; quotes doubled
  const mustQuote = /[",\r\n]/.test(s);
  if (!mustQuote) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function isoDate(v: unknown): string {
  const d = parseDate(v);
  return d ? d.toISOString().slice(0, 10) : '';
}

function isoDateTime(v: unknown): string {
  const d = parseDate(v);
  return d ? d.toISOString() : '';
}

function num(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '';
}

function bool(v: unknown): string {
  if (v === true) return 'true';
  if (v === false) return 'false';
  return '';
}

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  if (typeof v === 'string') {
    // Try native parse first
    const ts = Date.parse(v);
    if (!Number.isNaN(ts)) return new Date(ts);
    // Try DD/MM/YYYY
    const parts = v.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const [d, m, y] = parts.map(Number);
      if (!Number.isNaN(d) && !Number.isNaN(m) && !Number.isNaN(y)) {
        return new Date(y, (m - 1), d);
      }
    }
    return null;
  }
  if (v instanceof Date && !Number.isNaN(v.valueOf())) return v;
  return null;
}

