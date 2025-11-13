export function buildErrorsCsv(sample: any[]): string {
  const headers = ['row_index','status','container_no','message'];
  const lines = [headers.join(',')];
  for (const r of sample) {
    const status = !r.ok ? 'ERROR' : (r.warnings?.length ? 'WARN' : 'OK');
    const msg = (!r.ok ? r.errors?.[0] : r.warnings?.[0]) || '';
    const row = [
      r.index,
      status,
      quote(r?.normalized?.container_no ?? ''),
      quote(msg),
    ];
    lines.push(row.join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

function quote(v: any) {
  const s = String(v ?? '');
  return `"${s.replace(/"/g,'""')}"`;
}

