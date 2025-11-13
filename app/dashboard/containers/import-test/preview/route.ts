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

    const parsed = await parseFile(file as Blob, (file as any)?.name);
    const headers = parsed.headers ?? Object.keys(parsed.rows[0] || {});
    const suggested = mappingJson
      ? JSON.parse(String(mappingJson) || '{}')
      : autoSuggestMapping(headers);

    // Build normalized preview using mapping and target type locks.
    const displayRows = (parsed as any).displayRows || parsed.rows;
    const previewRows = (parsed.rows || []).slice(0, 10).map((row, idx) => {
      const show: Record<string, any> = {};
      for (const [sourceHeader, targetKey] of Object.entries(suggested)) {
        const field = IMPORT_FIELD_MAP.get(targetKey);
        if (!field) continue;
        const rawVal = row?.[sourceHeader] ?? null;
        const dispVal = displayRows?.[idx]?.[sourceHeader] ?? rawVal;
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
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Preview failed', stack: err?.stack || null },
      { status: 500 }
    );
  }
}

