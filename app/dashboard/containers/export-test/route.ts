// app/dashboard/containers/export-test/route.ts

import { NextResponse } from 'next/server';
import { exportContainersCSV } from '@/lib/data/export-actions';

// Simple GET to download CSV for verification (no UI)
export async function GET(request: Request) {
  // Optional query params: ?status=Safe|Warning|Overdue|Closed|Open|All
  const url = new URL(request.url);
  const status = url.searchParams.get('status') as any; // validated in action
  const { filename, csv } = await exportContainersCSV({ status });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Caching can be tuned later
      'Cache-Control': 'no-store',
    },
  });
}

