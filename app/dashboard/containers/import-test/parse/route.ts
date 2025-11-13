// app/dashboard/containers/import-test/parse/route.ts
// Internal import API route used by the Containers import modal.
// This route handles initial file parsing (CSV/XLSX) and returns headers, stats, and sample rows.

import { NextResponse } from 'next/server';
import { parseFile } from '@/lib/import/parser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    // ~10MB cap (adjust later)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 413 });
    }

    const parsed = await parseFile(file, file.name);
    const sampleRows = parsed.rows.slice(0, 5);

    return NextResponse.json({
      headers: parsed.headers,
      stats: parsed.stats,
      sampleRows,
    });
  } catch (err: any) {
    // Enhanced error logging for debugging
    const errorMessage = err?.message || 'Parse failed';
    const errorStack = err?.stack || 'No stack trace available';
    const errorName = err?.name || 'UnknownError';
    
    console.error('[import-test] Error details:', {
      name: errorName,
      message: errorMessage,
      stack: errorStack,
      file: err?.file,
      line: err?.line,
      column: err?.column,
    });

    return NextResponse.json(
      {
        error: errorMessage,
        errorName,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
        details: process.env.NODE_ENV === 'development' ? {
          name: errorName,
          message: errorMessage,
          stack: errorStack,
        } : undefined,
      },
      { status: 500 }
    );
  }
}

