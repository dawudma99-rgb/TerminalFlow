// app/dashboard/containers/import-test/preview/route.ts
// Internal import API route used by the Containers import modal.
// This route generates a preview of mapped and type-coerced data (top 10 rows).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { parseFile } from '@/lib/import/parser';
import { IMPORT_FIELDS, IMPORT_FIELD_MAP } from '@/lib/import/fields';
import { autoSuggestMapping, coerceByType } from '@/lib/import/header-map';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const mappingJson = form.get('mapping'); // optional JSON string from client

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 413 });
    }

    const fileName = file instanceof File ? file.name : undefined;
    const parsed = await parseFile(file as Blob, fileName);
    const headers = parsed.headers ?? Object.keys(parsed.rows[0] || {});
    const suggested = mappingJson
      ? JSON.parse(String(mappingJson) || '{}') as Record<string, string>
      : autoSuggestMapping(headers);

    // Build normalized preview using mapping and target type locks.
    const displayRows = parsed.displayRows || parsed.rows;
    const previewRows = (parsed.rows || []).slice(0, 10).map((row, idx) => {
      const show: Record<string, unknown> = {};
      for (const [sourceHeader, targetKey] of Object.entries(suggested)) {
        const field = IMPORT_FIELD_MAP.get(targetKey);
        if (!field) continue;
        const rawVal = row[sourceHeader] ?? null;
        const dispRow = displayRows[idx];
        const dispVal = dispRow ? (dispRow[sourceHeader] ?? null) : rawVal;
        // If the target type is string, use the display cell text; otherwise use raw.
        const chosen = field.type === 'string' ? dispVal : rawVal;
        show[targetKey] = coerceByType(chosen, field.type);
      }
      return show;
    });

    // Check required fields presence in mapping (not values yet)
    const missingRequiredTargets = IMPORT_FIELDS
      .filter(f => f.required)
      .filter(f => !Object.values(suggested).includes(f.key))
      .map(f => f.key);

    return NextResponse.json({
      headers,
      suggestedMapping: suggested,
      previewRows,
      stats: parsed.stats,
      requiredMissing: missingRequiredTargets,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Preview failed';
    const errorStack = err instanceof Error ? err.stack : null;
    return NextResponse.json(
      { error: errorMessage, stack: errorStack },
      { status: 500 }
    );
  }
}

