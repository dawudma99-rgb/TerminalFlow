// lib/utils/download.ts

export async function downloadFromUrl(url: string, suggestedName?: string) {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Download failed (${res.status}): ${text || res.statusText}`);
  }

  // Try to read filename from header
  const cd = res.headers.get('Content-Disposition') || '';
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
  const headerName = decodeURIComponent((match?.[1] || match?.[2] || '').trim());
  const filename = headerName || suggestedName || 'download.csv';

  const blob = await res.blob();
  const urlObj = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = urlObj;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(urlObj);
  return filename;
}

