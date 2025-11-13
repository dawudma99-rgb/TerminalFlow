// app/dashboard/containers/import-test/commit/route.ts
// Internal import API route used by the Containers import modal.
// This route validates and commits imported container data to the database.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { parseFile } from '@/lib/import/parser';
import { IMPORT_FIELD_MAP } from '@/lib/import/fields';
import { autoSuggestMapping, coerceByType } from '@/lib/import/header-map';
import { validateBatch } from '@/lib/import/validate';
import { commitImport } from '@/lib/data/import-commit';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const mappingJson = form.get('mapping');

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const parsed = await parseFile(file as Blob, (file as any)?.name);
    const headers = parsed.headers ?? Object.keys(parsed.rows[0] || {});
    const mapping = mappingJson ? JSON.parse(String(mappingJson)) : autoSuggestMapping(headers);

    const displayRows = (parsed as any).displayRows || parsed.rows;

    // Apply mapping + type locks to ALL rows (cap to 5000 for safety)
    const limit = Math.min((parsed.rows || []).length, 5000);
    const mapped = [];
    for (let i = 0; i < limit; i++) {
      const rawRow = parsed.rows[i] || {};
      const dispRow = displayRows[i] || rawRow;
      const out: Record<string, any> = {};
      for (const [sourceHeader, targetKey] of Object.entries(mapping)) {
        const field = IMPORT_FIELD_MAP.get(targetKey);
        if (!field) continue;
        const rawVal = rawRow?.[sourceHeader] ?? null;
        const dispVal = dispRow?.[sourceHeader] ?? rawVal;
        const chosen = field.type === 'string' ? dispVal : rawVal;
        out[targetKey] = coerceByType(chosen, field.type);
      }
      mapped.push(out);
    }

    // Validate all rows
    const { results, counts } = validateBatch(mapped);

    // Block if any errors
    if (counts.error > 0) {
      return NextResponse.json({
        counts,
        blocked: true,
        message: 'Import blocked due to validation errors',
      });
    }

    // Build rows to commit (only normalized valid rows)
    const rowsToCommit = results
      .filter(r => r.ok)
      .map(r => r.normalized);

    // Commit to database
    const commit = await commitImport(rowsToCommit);

    return NextResponse.json({
      counts,
      commit,
    });
  } catch (err: any) {
    console.error('[import-commit] Unexpected error:', err);
    return NextResponse.json(
      { 
        error: 'Unexpected server error', 
        details: err instanceof Error ? err.message : String(err) 
      },
      { status: 500 }
    );
  }
}

