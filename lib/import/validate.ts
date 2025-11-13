import { z } from 'zod';
import { resolveMilestone } from '@/lib/utils/milestones';

const ISO_DATE = z.string().refine(s => /^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{4}-\d{2}-\d{2}T/.test(s), 'Invalid date');
const toDateOnly = (v?: string | null) => (v ? String(v).slice(0,10) : null);

const ContainerNoRegex = /^[A-Za-z]{4}\d{7}$/; // relaxed: four letters + 7 digits

export type RowValidation = {
  ok: boolean;
  warnings: string[];
  errors: string[];
  normalized: Record<string, any>;
};

export function validateRow(input: Record<string, any>): RowValidation {
  const warnings: string[] = [];
  const errors: string[] = [];

  const norm: Record<string, any> = {};

  // Required: container_no
  let container_no = (input.container_no ?? '').toString().trim().toUpperCase();
  if (!container_no) errors.push('Missing container number');
  else if (!ContainerNoRegex.test(container_no)) warnings.push('Container number looks unusual (expected 4 letters + 7 digits)');
  norm.container_no = container_no || null;

  // Required: arrival_date (date-only)
  let arrival_date = input.arrival_date ?? null;
  if (!arrival_date) errors.push('Missing arrival date');
  else {
    try {
      ISO_DATE.parse(String(arrival_date));
      arrival_date = toDateOnly(String(arrival_date));
    } catch {
      errors.push('Arrival date is not a valid date');
    }
  }
  norm.arrival_date = arrival_date;

  // Optional text
  const str = (v: any) => (v === null || v === undefined || String(v).trim()==='' ? null : String(v).trim());
  norm.bl_number = str(input.bl_number);         // always text
  norm.pol = str(input.pol);
  norm.pod = str(input.pod);
  norm.carrier = str(input.carrier);
  norm.container_size = str(input.container_size);
  norm.assigned_to = str(input.assigned_to);
  norm.notes = str(input.notes);
  norm.list_name = str(input.list_name);

  // Optional numbers
  const num = (v: any) => (v === null || v === undefined || v === '' ? null : Number(v));
  let free_days = num(input.free_days);
  if (free_days === null || !Number.isFinite(free_days) || free_days < 0) free_days = 7;
  norm.free_days = free_days;

  // Dates (optional): gate_out_date, empty_return_date
  const handleOptDate = (k: string) => {
    const val = input[k];
    if (val === null || val === undefined || String(val).trim()==='') return null;
    const s = String(val);
    try {
      ISO_DATE.parse(s);
      return toDateOnly(s);
    } catch {
      warnings.push(`${k} is not a valid date (kept as null)`);
      return null;
    }
  };
  norm.gate_out_date = handleOptDate('gate_out_date');
  norm.empty_return_date = handleOptDate('empty_return_date');

  // Milestone normalize (optional)
  if (input.milestone != null) {
    const resolved = resolveMilestone(String(input.milestone), {
      gate_out_date: norm.gate_out_date,
      empty_return_date: norm.empty_return_date,
    });
    norm.milestone = resolved ?? null;
  } else {
    norm.milestone = null;
  }

  // Heuristic warnings
  if (!norm.pol) warnings.push('POL missing');
  if (!norm.pod) warnings.push('POD missing');
  try {
    if (norm.arrival_date) {
      const d = new Date(norm.arrival_date);
      const now = new Date();
      const delta = (d.getTime() - now.getTime()) / (1000*60*60*24);
      if (delta > 365) warnings.push('Arrival date is far in the future');
    }
  } catch {}

  const ok = errors.length === 0;
  return { ok, warnings, errors, normalized: norm };
}

export function validateBatch(rows: Record<string, any>[]) {
  const results = rows.map((r, i) => ({ index: i, ...validateRow(r) }));
  // in-file duplicates by container_no
  const seen = new Map<string, number[]>();
  for (const r of results) {
    const key = r.normalized.container_no || '';
    if (!key) continue;
    const arr = seen.get(key) || [];
    arr.push(r.index);
    seen.set(key, arr);
  }
  let duplicates = 0;
  for (const [key, idxs] of seen) {
    if (idxs.length > 1) {
      duplicates += idxs.length;
      for (const i of idxs) {
        results[i].warnings.push('Duplicate container number in file');
      }
    }
  }

  const counts = {
    total: results.length,
    ok: results.filter(r => r.ok && r.errors.length===0 && r.warnings.length===0).length,
    warn: results.filter(r => r.ok && r.warnings.length>0).length,
    error: results.filter(r => !r.ok).length,
    duplicates,
  };
  return { results, counts };
}

