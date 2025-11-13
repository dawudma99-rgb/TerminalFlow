'use client';

import { useRef, useState, useMemo } from 'react';
import { IMPORT_FIELDS } from '@/lib/import/fields';
import { Button } from '@/components/ui/button';
import { downloadCsv } from '@/lib/utils/download-csv';
import { buildErrorsCsv } from '@/lib/import/error-report';
import { toast } from 'sonner';
import { useListsContext } from '@/components/providers/ListsProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type SuggestedMap = Record<string, string>;

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportDialog({ open, onOpenChange, onSuccess }: ImportDialogProps) {
  const { lists, activeListId } = useListsContext();
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<any>(null);
  const [mapping, setMapping] = useState<SuggestedMap | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [dryRun, setDryRun] = useState<any>(null);
  const [commitResult, setCommitResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine target list name for confirmation
  const targetListName = useMemo(() => {
    // Check if any preview rows have list_name mapped
    if (preview?.previewRows && preview.previewRows.length > 0) {
      const firstRow = preview.previewRows[0];
      if (firstRow.list_name) {
        return String(firstRow.list_name);
      }
    }
    // Otherwise use active list name
    if (activeListId) {
      const activeList = lists.find(l => l.id === activeListId);
      return activeList?.name || 'the active list';
    }
    return 'the default list';
  }, [preview, activeListId, lists]);

  // Count valid rows for import
  const importCount = useMemo(() => {
    if (!dryRun) return 0;
    return dryRun.counts.total - dryRun.counts.error;
  }, [dryRun]);

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset all state when closing
      setFile(null);
      setParsed(null);
      setMapping(null);
      setHeaders([]);
      setPreview(null);
      setDryRun(null);
      setCommitResult(null);
      setError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    onOpenChange(newOpen);
  };

  async function handleParse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPreview(null);
    setDryRun(null);
    setCommitResult(null);
    const f = file || fileInputRef.current?.files?.[0];
    if (!f) {
      setError('Please choose a .csv or .xlsx file.');
      return;
    }

    const fd = new FormData();
    fd.append('file', f, f.name);
    setBusy(true);
    try {
      const res = await fetch('/dashboard/containers/import-test/parse', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data?.error || `Import test failed (${res.status})`;
        const errorDetails = data.details 
          ? `\n\nError Name: ${data.errorName}\nMessage: ${data.error}\nStack:\n${data.stack}`
          : '';
        throw new Error(errorMsg + errorDetails);
      }
      setParsed(data);
      setHeaders(data?.headers || []);
      // Immediately fetch suggested mapping + typed preview
      const fd2 = new FormData();
      fd2.append('file', f, f.name);
      const res2 = await fetch('/dashboard/containers/import-test/preview', { method: 'POST', body: fd2 });
      const data2 = await res2.json();
      if (!res2.ok) throw new Error(data2?.error || 'Preview failed');
      setMapping(data2?.suggestedMapping || {});
      setPreview(data2);
    } catch (err: any) {
      setError(err.message || 'Error');
      console.error('[import-dialog] Client error:', err);
    } finally {
      setBusy(false);
    }
  }

  async function refreshPreview() {
    if (!file || !mapping) return;
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('mapping', JSON.stringify(mapping));
    setBusy(true);
    try {
      const res = await fetch('/dashboard/containers/import-test/preview', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Preview failed');
      setPreview(data);
    } catch (err: any) {
      setError(err.message || 'Error');
      console.error('[import-dialog] Preview error:', err);
    } finally {
      setBusy(false);
    }
  }

  function setTargetForHeader(sourceHeader: string, targetKey: string) {
    setMapping(prev => ({ ...(prev || {}), [sourceHeader]: targetKey }));
  }

  async function handleDryRun() {
    if (!file || !mapping) return;
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('mapping', JSON.stringify(mapping));
    setBusy(true);
    try {
      const res = await fetch('/dashboard/containers/import-test/dry-run', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Dry-run failed');
      setDryRun(data);
    } catch (e: any) {
      setError(e.message || 'Dry-run failed');
      console.error('[import-dialog] Dry-run error:', e);
    } finally {
      setBusy(false);
    }
  }

  function handleImportClick() {
    if (!dryRun || dryRun.counts.error > 0) return;
    setShowConfirmDialog(true);
  }

  async function handleCommit() {
    if (!file || !mapping) return;
    setShowConfirmDialog(false);
    
    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('mapping', JSON.stringify(mapping));
    setBusy(true);
    
    const loadingToast = toast.loading('Importing containers...');
    
    try {
      const res = await fetch('/dashboard/containers/import-test/commit', { method: 'POST', body: fd });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data?.error || 'Import failed', { id: loadingToast });
        setError(data?.error || 'Commit failed');
        setCommitResult(data);
        return;
      }
      
      setCommitResult(data);
      
      // If commit was successful and not blocked
      if (!data.blocked && data.commit) {
        const inserted = data.commit.inserted || 0;
        const skipped = data.commit.skipped || 0;
        const errors = data.commit.errors || [];
        
        // Show success toast if any containers were inserted
        if (inserted > 0) {
          toast.success(
            `Import complete: ${inserted} container${inserted !== 1 ? 's' : ''} imported${skipped > 0 ? `, ${skipped} skipped` : ''}`,
            { id: loadingToast }
          );
        } else {
          toast.error('No containers were imported', { id: loadingToast });
        }
        
        // If there are commit errors, show separate error toast with download option
        if (errors.length > 0) {
          const errorCsv = buildErrorsCsv(
            errors.map((e: any) => ({
              index: e.index,
              ok: false,
              errors: [e.message],
              warnings: [],
              normalized: { container_no: `Row ${e.index + 1}` },
            }))
          );
          
          // Show error toast separately (don't replace success toast)
          toast.error(
            `${errors.length} error${errors.length !== 1 ? 's' : ''} occurred during import`,
            {
              action: {
                label: 'Download errors.csv',
                onClick: () => downloadCsv(`commit-errors-${Date.now()}.csv`, errorCsv),
              },
              duration: 10000,
            }
          );
        }
        
        // Close and reload on success (if any containers were inserted)
        if (inserted > 0) {
          setTimeout(() => {
            handleOpenChange(false);
            if (onSuccess) {
              onSuccess();
            }
          }, 1500);
        }
      } else {
        toast.error(data?.message || 'Import blocked due to validation errors', { id: loadingToast });
      }
    } catch (e: any) {
      toast.error(e.message || 'Import failed', { id: loadingToast });
      setError(e.message || 'Commit failed');
      console.error('[import-dialog] Commit error:', e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Containers</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Upload + parse */}
          <form onSubmit={handleParse} className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file" 
              accept=".csv,.xlsx" 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={busy}
              className="text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button
              type="submit"
              disabled={busy}
              size="sm"
            >
              {busy ? 'Parsing…' : 'Parse File'}
            </Button>
          </form>

          {error && (
            <div className="space-y-2">
              <p className="text-red-600 font-semibold text-sm">Error: {error.split('\n')[0]}</p>
              {error.includes('\n') && (
                <pre className="text-xs bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 rounded overflow-auto max-h-32 text-red-800 dark:text-red-200">
                  {error}
                </pre>
              )}
            </div>
          )}

          {parsed && (
            <>
              <p className="text-sm">
                <strong>File type:</strong> {parsed?.stats?.fileType} •{' '}
                <strong>Total rows:</strong> {parsed?.stats?.totalRows} •{' '}
                <strong>Non-empty:</strong> {parsed?.stats?.nonEmptyRows}
              </p>

              {/* Mapping UI */}
              <div className="rounded-md border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-sm">Header Mapping</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={refreshPreview}
                      disabled={busy || !mapping}
                      variant="outline"
                      size="sm"
                    >
                      Refresh Preview
                    </Button>
                    <Button
                      type="button"
                      onClick={handleDryRun}
                      disabled={busy || !mapping}
                      variant="outline"
                      size="sm"
                    >
                      Validate (Dry-Run)
                    </Button>
                    {dryRun?.hasErrors && (
                      <Button
                        type="button"
                        onClick={() => downloadCsv(`import-errors-${Date.now()}.csv`, buildErrorsCsv(dryRun.sample))}
                        disabled={busy}
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-300"
                      >
                        Download errors.csv
                      </Button>
                    )}
                    {dryRun && !dryRun.hasErrors && dryRun.counts.error === 0 && (
                      <Button
                        type="button"
                        onClick={handleImportClick}
                        disabled={busy}
                        variant="default"
                        size="sm"
                      >
                        Import (Write to DB)
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                  {headers.map((h) => (
                    <div key={h} className="flex items-center gap-2">
                      <div className="min-w-[140px] text-xs font-mono truncate">{h}</div>
                      <select
                        value={mapping?.[h] || ''}
                        onChange={(e) => setTargetForHeader(h, e.target.value)}
                        disabled={busy}
                        className="flex-1 rounded-md border px-2 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">— Ignore —</option>
                        {IMPORT_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {preview?.requiredMissing?.length > 0 && (
                  <p className="text-amber-600 text-xs mt-3">
                    Missing required fields in mapping: {preview.requiredMissing.join(', ')}
                  </p>
                )}
              </div>

              {/* Normalized preview */}
              {preview && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">Normalized Preview (first 10)</h3>
                  <pre className="text-xs bg-muted/50 p-3 rounded overflow-auto max-h-48">
                    {JSON.stringify(preview.previewRows ?? [], null, 2)}
                  </pre>
                </div>
              )}

              {/* Dry-run validation results */}
              {dryRun && (
                <div className="space-y-2">
                  <p className="text-xs">
                    <strong>Totals:</strong> OK {dryRun.counts.ok} • Warn {dryRun.counts.warn} • Error {dryRun.counts.error} • Duplicates {dryRun.counts.duplicates} • Total {dryRun.counts.total}
                  </p>
                  <div className="max-h-48 overflow-auto">
                    <table className="w-full text-xs border">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left p-2">#</th>
                          <th className="text-left p-2">Status</th>
                          <th className="text-left p-2">container_no</th>
                          <th className="text-left p-2">message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dryRun.sample.map((r: any) => {
                          const status = !r.ok ? 'ERROR' : (r.warnings?.length ? 'WARN' : 'OK');
                          const msg = (!r.ok ? r.errors?.[0] : r.warnings?.[0]) || '';
                          return (
                            <tr key={r.index} className="border-t">
                              <td className="p-2">{r.index + 1}</td>
                              <td className="p-2">{status}</td>
                              <td className="p-2">{r.normalized?.container_no || '—'}</td>
                              <td className="p-2">{msg}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Commit results */}
              {commitResult && (
                <div className="space-y-2 rounded-md border p-4">
                  <h3 className="font-medium text-sm">Import Complete</h3>
                  {commitResult.blocked ? (
                    <p className="text-amber-600 text-xs">
                      Import blocked: {commitResult.message || 'Validation errors detected'}
                    </p>
                  ) : (
                    <>
                      <p className="text-xs">
                        <strong>Inserted:</strong> {commitResult.commit?.inserted || 0} •{' '}
                        <strong>Updated:</strong> {commitResult.commit?.updated || 0} •{' '}
                        <strong>Skipped:</strong> {commitResult.commit?.skipped || 0}
                      </p>
                      {commitResult.commit?.errors && commitResult.commit.errors.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-red-600 font-semibold mb-2">
                            Commit Errors ({commitResult.commit.errors.length}):
                          </p>
                          <ul className="text-xs space-y-1 mb-2 max-h-32 overflow-y-auto">
                            {commitResult.commit.errors.slice(0, 10).map((e: any, i: number) => (
                              <li key={i}>
                                Row {e.index + 1}: {e.message}
                              </li>
                            ))}
                            {commitResult.commit.errors.length > 10 && (
                              <li className="text-muted-foreground">
                                ... and {commitResult.commit.errors.length - 10} more
                              </li>
                            )}
                          </ul>
                          <Button
                            type="button"
                            onClick={() => {
                              const csv = buildErrorsCsv(
                                commitResult.commit.errors.map((e: any) => ({
                                  index: e.index,
                                  ok: false,
                                  errors: [e.message],
                                  warnings: [],
                                  normalized: { container_no: `Row ${e.index + 1}` },
                                }))
                              );
                              downloadCsv(`commit-errors-${Date.now()}.csv`, csv);
                            }}
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300"
                          >
                            Download commit-errors.csv
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={busy}
          >
            {commitResult && !commitResult.blocked ? 'Close' : 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Confirmation Dialog */}
      <AlertDialog 
        open={showConfirmDialog} 
        onOpenChange={(open) => {
          if (!busy) {
            setShowConfirmDialog(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Import</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to import {importCount} container{importCount !== 1 ? 's' : ''} into list "{targetListName}". Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCommit}
              disabled={busy}
            >
              {busy ? 'Importing...' : 'Confirm Import'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

