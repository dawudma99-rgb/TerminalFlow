import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export type ParsedResult = {
  headers: string[];
  rows: Record<string, any>[];
  stats: {
    totalRows: number;
    nonEmptyRows: number;
    fileType: 'csv' | 'xlsx';
  };
};

const TRUE_LIKE = new Set(['true', 'yes', 'y', '1']);
const FALSE_LIKE = new Set(['false', 'no', 'n', '0']);

export async function parseFile(file: Blob, filename?: string): Promise<ParsedResult> {
  const ext = (filename || '').toLowerCase();
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  const isXlsx = looksLikeXlsx(u8) || ext.endsWith('.xlsx');
  const isCsv = !isXlsx; // default to CSV otherwise

  if (isXlsx) {
    return parseXlsx(buf);
  }
  return parseCsv(new TextDecoder('utf-8').decode(u8));
}

function looksLikeXlsx(u8: Uint8Array): boolean {
  // XLSX is a ZIP (PK\x03\x04)
  return u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4B && u8[2] === 0x03 && u8[3] === 0x04;
}

function parseXlsx(ab: ArrayBuffer): ParsedResult {
  try {
    const wb = XLSX.read(ab, { type: 'array', dense: true });
    
    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      throw new Error('Excel file has no sheets');
    }
    
    const first = wb.SheetNames[0];
    const ws = wb.Sheets[first];
    
    if (!ws) {
      throw new Error(`Sheet "${first}" not found in workbook`);
    }
    
    // raw values for dates/numbers
    const rowsRaw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: null, raw: true });
    // display text exactly as Excel shows (for string fields like B/L)
    const rowsDisplay = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: null, raw: false });

    const rows = rowsRaw.map(normalizeRow);
    const headers = inferHeaders(rowsDisplay.length ? rowsDisplay : rows);
    const nonEmptyRows = rows.filter(anyValuePresent).length;

    return {
      headers,
      rows,
      stats: { totalRows: rows.length, nonEmptyRows, fileType: 'xlsx' },
      // @ts-expect-error - extend type to include displayRows
      displayRows: rowsDisplay,
    };
  } catch (err: any) {
    // Re-throw with context
    throw new Error(`XLSX parsing failed: ${err?.message || String(err)}`);
  }
}

function parseCsv(text: string): ParsedResult {
  const result = Papa.parse<Record<string, any>>(text, {
    header: true,
    dynamicTyping: false,
    skipEmptyLines: 'greedy',
  });
  const rawRows = (result.data || []) as Record<string, any>[];
  const rows = rawRows.map(normalizeRow);
  const headers = result.meta.fields?.map((h) => h ?? '').filter(Boolean) ?? inferHeaders(rows);
  const nonEmptyRows = rows.filter(anyValuePresent).length;

  return {
    headers,
    rows,
    stats: { totalRows: rows.length, nonEmptyRows, fileType: 'csv' },
    // @ts-expect-error - extend type to include displayRows
    displayRows: rows, // CSV doesn't have raw/display distinction
  };
}

/* ---------- normalization ---------- */

function normalizeRow(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = (k || '').toString().trim();
    out[key] = normalizeValue(v);
  }
  return out;
}

function normalizeValue(v: any): any {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s === '') return null;

    // boolean
    const low = s.toLowerCase();
    if (TRUE_LIKE.has(low)) return true;
    if (FALSE_LIKE.has(low)) return false;

    // number (keep plain integers/decimals)
    const num = Number(s.replace(/,/g, '')); // tolerate thousand separators
    if (
      !Number.isNaN(num) &&
      /^-?\d{1,3}(\d{3})*(\.\d+)?$|^-?\d+(\.\d+)?$/.test(s.replace(/,/g, ''))
    ) {
      return num;
    }

    // date/time
    const iso = tryParseDateToISO(s);
    if (iso) return iso;

    return s; // plain string
  }

  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null;
    return v;
  }
  if (v instanceof Date && !Number.isNaN(v.valueOf())) {
    return v.toISOString();
  }
  return v;
}

function tryParseDateToISO(s: string): string | null {
  // Accept: YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, MM-DD-YYYY, DD.MM.YYYY, plus with time
  const clean = s.replace(/\s+/g, ' ').trim();
  // Native parse for ISO-like
  const native = Date.parse(clean);
  if (!Number.isNaN(native)) return new Date(native).toISOString();

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const m1 = clean.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i
  );
  if (m1) {
    let [, d, m, y, h, min, sec, ap] = m1;
    if (y.length === 2) y = String(2000 + Number(y)); // 2-digit year → 20xx
    let hour = h ? Number(h) : 0;
    if (ap) {
      const isPM = ap.toUpperCase() === 'PM';
      if (isPM && hour !== 12) hour += 12;
      if (!isPM && hour === 12) hour = 0;
    }
    const timeStr = h
      ? ` ${pad(hour)}:${pad(min)}${sec ? ':' + pad(sec) : ':00'}`
      : ' 00:00:00';
    const dt = new Date(`${y}-${pad(m)}-${pad(d)}${timeStr}`);
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }

  // MM/DD/YYYY variant
  const m2 = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m2) {
    let [, mm, dd, yy] = m2;
    if (yy.length === 2) yy = String(2000 + Number(yy));
    const dt = new Date(`${yy}-${pad(mm)}-${pad(dd)} 00:00`);
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }

  return null;
}

function pad(n: string | number): string {
  return String(n).padStart(2, '0');
}

function anyValuePresent(row: Record<string, any>): boolean {
  return Object.values(row).some(
    (v) => !(v === null || v === '' || (typeof v === 'string' && v.trim() === ''))
  );
}

function inferHeaders(rows: Record<string, any>[]): string[] {
  const first = rows[0] || {};
  return Object.keys(first);
}

