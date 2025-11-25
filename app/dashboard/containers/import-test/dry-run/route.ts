// app/dashboard/containers/import-test/dry-run/route.ts
// Internal import API route used by the Containers import modal.
// This route performs validation (dry-run) on mapped data without writing to the database.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { parseFile } from '@/lib/import/parser';
import { IMPORT_FIELD_MAP } from '@/lib/import/fields';
import { autoSuggestMapping, coerceByType } from '@/lib/import/header-map';
import { validateBatch } from '@/lib/import/validate';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const mappingJson = form.get('mapping');

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = file instanceof File ? file.name : undefined;
    const parsed = await parseFile(file as Blob, fileName);
    const headers = parsed.headers ?? Object.keys(parsed.rows[0] || {});
    const mapping = mappingJson 
      ? (JSON.parse(String(mappingJson)) as Record<string, string>)
      : autoSuggestMapping(headers);

    const displayRows = parsed.displayRows || parsed.rows;

    // Apply mapping + type locks to ALL rows (cap to 5000 for UI perf)
    const limit = Math.min((parsed.rows || []).length, 5000);
    const mapped: Record<string, unknown>[] = [];
    for (let i = 0; i < limit; i++) {
      const rawRow = parsed.rows[i] || {};
      const dispRow = displayRows[i] || rawRow;
      const out: Record<string, unknown> = {};
      for (const [sourceHeader, targetKey] of Object.entries(mapping)) {
        const field = IMPORT_FIELD_MAP.get(targetKey);
        if (!field) continue;
        const rawVal = rawRow[sourceHeader] ?? null;
        const dispVal = dispRow ? (dispRow[sourceHeader] ?? null) : rawVal;
        const chosen = field.type === 'string' ? dispVal : rawVal;
        out[targetKey] = coerceByType(chosen, field.type);
      }
      mapped.push(out);
    }

    const { results, counts } = validateBatch(mapped);

    return NextResponse.json({
      counts,
      sample: results.slice(0, 20),
      hasErrors: counts.error > 0,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Dry-run failed';
    const errorStack = err instanceof Error ? err.stack : null;
    return NextResponse.json({ error: errorMessage, stack: errorStack }, { status: 500 });
  }
}

