import { IMPORT_FIELDS, IMPORT_FIELD_MAP, ImportField, ImportType } from './fields';

type Synonyms = Record<string, string[]>;

// Lowercase trim everything before comparing.
const SYNONYMS: Synonyms = {
  container_no: ['container #','container no','container','cntr','cntr no','cntr#','container number'],
  bl_number: ['bl','b/l','bill of lading','hbl','hawb', 'bol'],
  pol: ['pol','load port','port of loading','origin port','load'],
  pod: ['pod','discharge port','port of discharge','destination port','discharge','dest'],
  arrival_date: ['eta','arrival','arrival date','eta date'],
  free_days: ['free days','free time','freetime'],
  carrier: ['carrier','line','shipping line','steamship line'],
  container_size: ['size','container size','20','40','45'],
  assigned_to: ['owner','assigned','assigned to','assignee','ops owner','op'],
  milestone: ['milestone','status','stage','state'],
  gate_out_date: ['gate out','gate-out','outgate','out gate','departed terminal'],
  empty_return_date: ['empty return','empty returned','return empty','empty in','emptied'],
  notes: ['notes','remarks','comments','memo'],
};

// A small score: exact match highest, contains middle, synonym set match good.
function scoreHeaderMatch(header: string, target: string, synonyms: string[]): number {
  const h = header.trim().toLowerCase();
  const t = target.trim().toLowerCase();
  if (h === t) return 100;
  if (synonyms.includes(h)) return 90;
  if (h.replace(/\s+/g, '') === t.replace(/\s+/g, '')) return 85;
  // partial contains
  if (h.includes(t) || synonyms.some(s => h.includes(s))) return 60;
  return 0;
}

export function autoSuggestMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedTargets = new Set<string>();

  for (const header of headers) {
    let bestKey = '';
    let bestScore = 0;

    for (const field of IMPORT_FIELDS) {
      const syns = SYNONYMS[field.key as keyof typeof SYNONYMS] ?? [];
      const s = scoreHeaderMatch(header, field.label, syns.concat(field.key));
      if (s > bestScore && !usedTargets.has(field.key)) {
        bestScore = s;
        bestKey = field.key;
      }
    }
    if (bestKey && bestScore >= 60) {
      mapping[header] = bestKey;
      usedTargets.add(bestKey);
    }
  }
  return mapping;
}

// Convert Excel date serial number to ISO string
function excelSerialToISO(n: number, keepTime: boolean): string | null {
  if (!Number.isFinite(n)) return null;
  const ms = (n - 25569) * 86400 * 1000; // Excel epoch offset
  const d = new Date(ms);
  const iso = d.toISOString();
  return keepTime ? iso : iso.slice(0, 10);
}

// Coercion guards (never treat text fields like dates!)
export function coerceByType(value: any, t: ImportType): any {
  if (value === undefined || value === null) return null;
  
  // For string type: never parse as date/number
  if (t === 'string') {
    if (typeof value === 'string') {
      const s = value.trim();
      return s === '' ? null : s;
    }
    if (typeof value === 'number') {
      // Preserve leading zeros by converting to string directly
      return String(value);
    }
    if (value instanceof Date) {
      // Return as ISO string text, not parsed
      return value.toISOString();
    }
    return String(value);
  }
  
  if (typeof value === 'string') {
    const s = value.trim();
    if (s === '') return null;

    if (t === 'boolean') {
      const low = s.toLowerCase();
      if (['true','yes','y','1'].includes(low)) return true;
      if (['false','no','n','0'].includes(low)) return false;
      return null;
    }

    if (t === 'number') {
      const num = Number(s.replace(/,/g, ''));
      return Number.isFinite(num) ? num : null;
    }

    if (t === 'date' || t === 'datetime') {
      const iso = tryParseDateToISO(s, t === 'datetime');
      return iso ?? null;
    }

    return s;
  }

  if (typeof value === 'number') {
    if (t === 'number') return Number.isFinite(value) ? value : null;
    if (t === 'boolean') return value === 1 ? true : value === 0 ? false : null;
    if (t === 'date' || t === 'datetime') {
      // Check if it's an Excel serial number (typically > 1 and < 1000000 for reasonable dates)
      // Excel dates start at 1 (Jan 1, 1900), so values > 1 and < 1000000 are likely Excel serials
      if (value > 1 && value < 1000000) {
        return excelSerialToISO(value, t === 'datetime');
      }
      // Otherwise treat as Unix timestamp (milliseconds)
      return new Date(value).toISOString();
    }
  }

  if (value instanceof Date) {
    if (t === 'date' || t === 'datetime') {
      return t === 'datetime' ? value.toISOString() : value.toISOString().slice(0, 10);
    }
    return value.toISOString();
  }

  return value;
}

// Accept multiple date styles; when datetime=false, truncate to YYYY-MM-DD
function tryParseDateToISO(input: string, keepTime: boolean): string | null {
  const s = input.replace(/\s+/g, ' ').trim();

  // Native
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return keepTime ? d.toISOString() : d.toISOString().slice(0, 10);
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY [optional time & AM/PM]
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*(AM|PM)?)?$/i);
  if (m) {
    let [, dd, mm, yy, time, ap] = m;
    if (yy.length === 2) yy = String(2000 + Number(yy));
    const composed = `${yy}-${pad(mm)}-${pad(dd)}${time ? ` ${time}${ap ? ' ' + ap : ''}` : ''}`;
    const d = new Date(composed);
    return keepTime ? d.toISOString() : d.toISOString().slice(0, 10);
  }

  // MM/DD/YYYY
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [, mm, dd, yy] = m;
    if (yy.length === 2) yy = String(2000 + Number(yy));
    const d = new Date(`${yy}-${pad(mm)}-${pad(dd)}`);
    return keepTime ? d.toISOString() : d.toISOString().slice(0, 10);
  }

  return null;
}

function pad(n: string | number) { return String(n).padStart(2, '0'); }

