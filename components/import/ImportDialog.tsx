'use client';

import { useRef, useState, useEffect } from 'react';
import { IMPORT_FIELDS } from '@/lib/import/fields';
import { Button } from '@/components/ui/button';
import { downloadCsv } from '@/lib/utils/download-csv';
import { buildErrorsCsv } from '@/lib/import/error-report';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ChevronDown, ChevronRight, AlertCircle, AlertTriangle, CheckCircle, Loader2, Upload, FileSpreadsheet, X } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

type SuggestedMap = Record<string, string>;

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ImportDialog({ open, onOpenChange, onSuccess }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<any>(null);
  const [mapping, setMapping] = useState<SuggestedMap | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [dryRun, setDryRun] = useState<any>(null);
  const [commitResult, setCommitResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [developerPreviewOpen, setDeveloperPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const validationRef = useRef<HTMLDivElement>(null);

  // Format date as dd/MM/yyyy
  const formatPreviewDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  // Handle file selection - parse immediately
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Reset previous state
    setFile(selectedFile);
    setError(null);
    setParsed(null);
    setPreview(null);
    setDryRun(null);
    setCommitResult(null);
    setHasValidated(false);
    setMapping(null);
    setHeaders([]);

    // Immediately parse the file
    await handleAutoParse(selectedFile);
  };

  // Scroll to validation results when errors appear
  useEffect(() => {
    if (hasValidated && dryRun?.counts?.error > 0 && validationRef.current) {
      setTimeout(() => {
        validationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [hasValidated, dryRun]);

  async function handleAutoParse(fileToParse: File | null) {
    if (!fileToParse) return;
    
    setError(null);
    setPreview(null);
    setDryRun(null);
    setCommitResult(null);
    setHasValidated(false);
    setBusy(true);
    
    try {
      // Parse file
      const fd = new FormData();
      fd.append('file', fileToParse, fileToParse.name);
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
      
      // Get preview and suggested mapping
      const fd2 = new FormData();
      fd2.append('file', fileToParse, fileToParse.name);
      const res2 = await fetch('/dashboard/containers/import-test/preview', { method: 'POST', body: fd2 });
      const data2 = await res2.json();
      if (!res2.ok) throw new Error(data2?.error || 'Preview failed');
      setMapping(data2?.suggestedMapping || {});
      setPreview(data2);
    } catch (err: any) {
      setError(err.message || 'Error');
      logger.error('[import-dialog] Parse error:', err);
      // Reset file state on error so user can try again
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
      logger.error('[import-dialog] Preview error:', err);
    } finally {
      setBusy(false);
    }
  }

  function setTargetForHeader(sourceHeader: string, targetKey: string) {
    setMapping(prev => ({ ...(prev || {}), [sourceHeader]: targetKey }));
  }

  async function handleValidateAndImport() {
    if (!file || !mapping) {
      setError('Please select a file first.');
      return;
    }

    setError(null);
    setCommitResult(null);
    setBusy(true);
    
    const loadingToast = toast.loading('Validating containers...');
    
    try {
      // Step 1: Dry-run validation
      const fd = new FormData();
      fd.append('file', file, file.name);
      fd.append('mapping', JSON.stringify(mapping));
      
      const dryRunRes = await fetch('/dashboard/containers/import-test/dry-run', { method: 'POST', body: fd });
      const dryRunData = await dryRunRes.json();
      
      if (!dryRunRes.ok) {
        toast.error(dryRunData?.error || 'Validation failed', { id: loadingToast });
        setError(dryRunData?.error || 'Validation failed');
        setBusy(false);
        return;
      }

      setDryRun(dryRunData);
      setHasValidated(true);

      // Step 2: Check for errors - if errors exist, don't commit
      if (dryRunData.counts?.error > 0) {
        toast.error(`Validation failed: ${dryRunData.counts.error} error${dryRunData.counts.error !== 1 ? 's' : ''} found`, { id: loadingToast });
        setBusy(false);
        // Scroll to validation results (handled by useEffect)
        return;
      }

      // Step 3: If no errors, proceed with commit
      toast.loading('Importing containers...', { id: loadingToast });
      
      const commitRes = await fetch('/dashboard/containers/import-test/commit', { method: 'POST', body: fd });
      const commitData = await commitRes.json();
      
      if (!commitRes.ok) {
        toast.error(commitData?.error || 'Import failed', { id: loadingToast });
        setError(commitData?.error || 'Commit failed');
        setCommitResult(commitData);
        setBusy(false);
        return;
      }
      
      setCommitResult(commitData);
      
      // If commit was successful and not blocked
      if (!commitData.blocked && commitData.commit) {
        const inserted = commitData.commit.inserted || 0;
        const updated = commitData.commit.updated || 0;
        
        // Show success toast with new format
        if (inserted > 0 || updated > 0) {
          toast.success(
            `Imported ${inserted} container${inserted !== 1 ? 's' : ''}${updated > 0 ? ` (updated ${updated})` : ''}`,
            { id: loadingToast }
          );
          
          // Banner will show automatically via state update (commitResult is already set)
          // Auto-close modal after 1.5 seconds (banner shows first)
          setTimeout(() => {
            handleOpenChange(false);
            if (onSuccess) {
              onSuccess();
            }
          }, 1500);
          // Note: setBusy(false) is NOT called here to keep the button disabled during auto-close
          // The dialog closing will reset all state anyway
        } else {
          toast.error('No containers were imported', { id: loadingToast });
          setBusy(false);
        }
      } else {
        toast.error(commitData?.message || 'Import blocked due to validation errors', { id: loadingToast });
        setBusy(false);
      }
    } catch (e: any) {
      toast.error(e.message || 'Import failed', { id: loadingToast });
      setError(e.message || 'Import failed');
      logger.error('[import-dialog] Import error:', e);
      setBusy(false);
    }
  }

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
      setAdvancedOpen(false);
      setHasValidated(false);
      setDeveloperPreviewOpen(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    onOpenChange(newOpen);
  };

  const nonEmptyRows = parsed?.stats?.nonEmptyRows || 0;
  const hasErrors = dryRun?.counts?.error > 0;
  const hasWarnings = dryRun?.counts?.warn > 0 && !hasErrors;
  const buttonDisabled = busy || !parsed || !mapping || hasErrors;
  const buttonText = busy 
    ? 'Validating & Importing...' 
    : hasErrors 
      ? 'Fix errors above to continue'
      : `Validate & Import ${nonEmptyRows} container${nonEmptyRows !== 1 ? 's' : ''}`;

  // Determine banner state
  const getBannerState = () => {
    // Error state: validation has errors and commit was not executed
    if (hasValidated && hasErrors && !commitResult?.commit) {
      return {
        type: 'error' as const,
        title: 'Import blocked',
        body: `${dryRun.counts.error} row${dryRun.counts.error !== 1 ? 's have' : ' has'} errors. Nothing was imported. Download the error report, fix the file, and try again.`,
        hasDownloadButton: true,
      };
    }

    // Success state: commit succeeded with no errors and no warnings
    if (commitResult?.commit && !commitResult.blocked && !hasErrors && !hasWarnings) {
      const inserted = commitResult.commit.inserted || 0;
      const updated = commitResult.commit.updated || 0;
      const skipped = commitResult.commit.skipped || 0;
      let body = `Imported ${inserted} container${inserted !== 1 ? 's' : ''}`;
      if (updated > 0) body += ` (updated ${updated}`;
      if (skipped > 0) body += updated > 0 ? `, skipped ${skipped}` : ` (skipped ${skipped}`;
      if (updated > 0 || skipped > 0) body += ')';
      body += '.';
      
      return {
        type: 'success' as const,
        title: 'Import complete',
        body,
      };
    }

    // Warning state: commit succeeded but there were warnings (no errors)
    if (commitResult?.commit && !commitResult.blocked && !hasErrors && dryRun?.counts?.warn > 0) {
      const inserted = commitResult.commit.inserted || 0;
      const warningCount = dryRun.counts.warn || 0;
      return {
        type: 'warning' as const,
        title: 'Imported with warnings',
        body: `Imported ${inserted} container${inserted !== 1 ? 's' : ''} with ${warningCount} warning${warningCount !== 1 ? 's' : ''}. Review the warnings if needed.`,
      };
    }

    return null;
  };

  const bannerState = getBannerState();

  const handleDropzoneClick = () => {
    if (!busy && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDropzoneKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && !busy && fileInputRef.current) {
      e.preventDefault();
      fileInputRef.current.click();
    }
  };

  const handleDropzoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDropzoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.xlsx'))) {
      const syntheticEvent = {
        target: { files: [droppedFile] },
      } as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(syntheticEvent);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        aria-describedby="import-dialog-description"
        className={`${!parsed ? 'max-w-xl' : 'max-w-5xl'} max-h-[90vh] flex flex-col`}
      >
        <DialogHeader>
          <DialogTitle>Import Containers</DialogTitle>
          <DialogDescription id="import-dialog-description">
            Upload a CSV or Excel file to validate and import container data into this list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Empty State - Before file is selected */}
          {!parsed && !busy && (
            <Card className="border rounded-xl bg-slate-50 dark:bg-slate-900/40">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <h3 className="text-base font-semibold text-foreground">Import Containers</h3>
                    <p className="text-sm text-muted-foreground">
                      Drop a file from your forwarding spreadsheet. We'll auto-detect columns and highlight any issues.
                    </p>
                  </div>

                  {/* Dropzone */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={handleDropzoneClick}
                    onKeyDown={handleDropzoneKeyDown}
                    onDragOver={handleDropzoneDragOver}
                    onDrop={handleDropzoneDrop}
                    className={`
                      relative flex flex-col items-center justify-center gap-3 p-12
                      border-2 border-dashed rounded-lg
                      bg-white dark:bg-slate-800/50
                      border-slate-300 dark:border-slate-700
                      hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10
                      transition-colors cursor-pointer
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                      ${busy ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    aria-label="Click to choose a file or drag and drop"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={handleFileChange}
                      disabled={busy}
                      className="sr-only"
                      aria-label="File input"
                    />
                    
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-full bg-primary/10 p-3">
                        <FileSpreadsheet className="h-8 w-8 text-primary" />
                      </div>
                      
                      <div className="text-center space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          Click to choose a file
                        </p>
                        <p className="text-xs text-muted-foreground">
                          or drag & drop a .xlsx or .csv file here
                        </p>
                      </div>
                      
                      <p className="text-xs text-muted-foreground/70 mt-2">
                        We validate every row before import. Nothing is saved until you confirm.
                      </p>
                    </div>
                  </div>

                  {/* Selected file info (if file selected but not yet parsed - shown only when not busy) */}
                  {file && !parsed && !busy && (
                    <div className="flex items-center justify-between gap-2 p-3 rounded-md bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-foreground truncate">{file.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        aria-label="Clear selected file"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Loading state while parsing */}
          {busy && !parsed && (
            <Card className="border rounded-xl bg-slate-50 dark:bg-slate-900/40">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center gap-3 p-12">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm font-medium text-foreground">Parsing file...</p>
                  <p className="text-xs text-muted-foreground">Please wait while we analyze your spreadsheet</p>
                </div>
              </CardContent>
            </Card>
          )}

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

          {/* Advanced Import UI - After file is parsed */}
          {parsed && (
            <>
              {/* File info bar */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                    <span className="font-medium text-foreground truncate">{file?.name}</span>
                    <span>•</span>
                    <span>{parsed?.stats?.fileType || 'Unknown'}</span>
                    <span>•</span>
                    <span>{parsed?.stats?.totalRows || 0} rows</span>
                    {parsed?.stats?.nonEmptyRows !== undefined && (
                      <>
                        <span>•</span>
                        <span>{parsed?.stats?.nonEmptyRows} non-empty</span>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setParsed(null);
                    setMapping(null);
                    setHeaders([]);
                    setPreview(null);
                    setDryRun(null);
                    setCommitResult(null);
                    setHasValidated(false);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Change file
                </Button>
              </div>

              {/* Status Banner */}
              {bannerState && (
                <div
                  className={`rounded-md border p-4 ${
                    bannerState.type === 'error'
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                      : bannerState.type === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                      : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {bannerState.type === 'error' && (
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    {bannerState.type === 'warning' && (
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    )}
                    {bannerState.type === 'success' && (
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4
                        className={`font-semibold text-sm mb-1 ${
                          bannerState.type === 'error'
                            ? 'text-red-900 dark:text-red-100'
                            : bannerState.type === 'warning'
                            ? 'text-amber-900 dark:text-amber-100'
                            : 'text-green-900 dark:text-green-100'
                        }`}
                      >
                        {bannerState.title}
                      </h4>
                      <div className="flex flex-col gap-2">
                        <p
                          className={`text-sm ${
                            bannerState.type === 'error'
                              ? 'text-red-800 dark:text-red-200'
                              : bannerState.type === 'warning'
                              ? 'text-amber-800 dark:text-amber-200'
                              : 'text-green-800 dark:text-green-200'
                          }`}
                        >
                          {bannerState.body}
                        </p>
                        {bannerState.hasDownloadButton && hasValidated && dryRun && (
                          <Button
                            type="button"
                            onClick={() => downloadCsv(`import-errors-${Date.now()}.csv`, buildErrorsCsv(dryRun.sample))}
                            disabled={busy}
                            variant="outline"
                            size="sm"
                            className="w-fit h-7 text-xs text-red-600 border-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
                          >
                            Download errors.csv
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Primary Action Button */}
              <div className="flex justify-center">
                <Button
                  type="button"
                  onClick={handleValidateAndImport}
                  disabled={buttonDisabled}
                  size="lg"
                  variant="default"
                  className="min-w-[280px]"
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {buttonText}
                </Button>
              </div>

              {/* Advanced Options Accordion */}
              <div className="rounded-md border">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen(!advancedOpen)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                  disabled={busy}
                >
                  <h3 className="font-medium text-sm">Advanced: Review Column Mapping</h3>
                  {advancedOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                
                {advancedOpen && (
                  <div className="border-t p-4 space-y-4">
                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        onClick={refreshPreview}
                        disabled={busy || !mapping}
                        variant="outline"
                        size="sm"
                      >
                        Refresh Preview
                      </Button>
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
                )}
              </div>

              {/* Preview Table */}
              {preview && (
                <div className="space-y-3">
                  <h3 className="font-medium text-sm">Preview (first 10 rows)</h3>
                  {preview.previewRows && preview.previewRows.length > 0 ? (
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Container Number</TableHead>
                            <TableHead className="text-xs">B/L Number</TableHead>
                            <TableHead className="text-xs">POL</TableHead>
                            <TableHead className="text-xs">POD</TableHead>
                            <TableHead className="text-xs">Arrival Date</TableHead>
                            <TableHead className="text-xs">Free Days</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Carrier</TableHead>
                            <TableHead className="text-xs">Assigned To</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.previewRows.slice(0, 10).map((row: any, index: number) => {
                            // Get status (use milestone if status not available)
                            const status = row.status || row.milestone || null;

                            return (
                              <TableRow key={index}>
                                <TableCell className="text-xs font-mono">{row.container_no || '—'}</TableCell>
                                <TableCell className="text-xs">{row.bl_number || '—'}</TableCell>
                                <TableCell className="text-xs">{row.pol || '—'}</TableCell>
                                <TableCell className="text-xs">{row.pod || '—'}</TableCell>
                                <TableCell className="text-xs">{formatPreviewDate(row.arrival_date)}</TableCell>
                                <TableCell className="text-xs">{row.free_days ?? '—'}</TableCell>
                                <TableCell className="text-xs">
                                  {status ? (
                                    <Badge variant="outline" className="text-xs">
                                      {status}
                                    </Badge>
                                  ) : (
                                    '—'
                                  )}
                                </TableCell>
                                <TableCell className="text-xs">{row.carrier || '—'}</TableCell>
                                <TableCell className="text-xs">{row.assigned_to || '—'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No rows to preview</p>
                  )}

                  {/* Developer Preview - Collapsible JSON */}
                  <div className="rounded-md border">
                    <button
                      type="button"
                      onClick={() => setDeveloperPreviewOpen(!developerPreviewOpen)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                      disabled={busy}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Developer preview (JSON)</span>
                        <span className="text-xs text-muted-foreground/70">— for developers only</span>
                      </div>
                      {developerPreviewOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    
                    {developerPreviewOpen && (
                      <div className="border-t p-3">
                        <pre className="text-xs bg-muted/30 p-3 rounded overflow-auto max-h-64 border border-muted font-mono">
                          {JSON.stringify(preview.previewRows ?? [], null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Validation Results - Only shown after clicking Validate & Import */}
              {hasValidated && dryRun && (
                <div ref={validationRef} className="space-y-2 rounded-md border p-4">
                  <h3 className="font-medium text-sm">Validation Results</h3>
                  <p className="text-xs">
                    <strong>Totals:</strong> OK {dryRun.counts.ok} • Warn {dryRun.counts.warn} • Error {dryRun.counts.error} • Duplicates {dryRun.counts.duplicates} • Total {dryRun.counts.total}
                  </p>
                  {dryRun.counts.error > 0 && (
                    <div className="flex items-center gap-2 mt-2">
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
                    </div>
                  )}
                  <div className="max-h-48 overflow-auto mt-2">
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
                            <tr key={r.index} className={`border-t ${!r.ok ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
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
    </Dialog>
  );
}
