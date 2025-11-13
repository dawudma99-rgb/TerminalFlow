// app/dashboard/containers/export/route.ts

import { NextResponse } from 'next/server';
import { exportContainersCSV } from '@/lib/data/export-actions';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') as any; // validated in action
  const { filename, csv } = await exportContainersCSV({ status });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

