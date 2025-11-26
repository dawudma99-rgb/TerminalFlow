// lib/data/export-actions.ts

'use server';

import { serializeContainersToCSV, type ContainerForExport } from '@/lib/csv/containers-serializer';
import { fetchContainers } from '@/lib/data/containers-actions'; // returns computed fields
import { getServerAuthContext } from '@/lib/auth/serverAuthContext';

type ExportStatus =
  | 'All'
  | 'Open'
  | 'Closed'
  | 'Safe'
  | 'Warning'
  | 'Overdue';

export type ExportContainersParams = {
  listId?: string | null;
  status?: ExportStatus; // optional filter
};

function toExportRow(c: any): ContainerForExport {
  // Map DB+computed fields to export shape. Serializer will normalize dates/numbers.
  return {
    container_no: c.container_no,
    bl_number: c.bl_number ?? null,
    pol: c.pol ?? null,
    pod: c.pod ?? null,
    carrier: c.carrier ?? null,
    container_size: c.container_size ?? null,
    assigned_to: c.assigned_to ?? null,
    arrival_date: c.arrival_date ?? null,
    free_days: c.free_days ?? null,
    days_left: c.days_left ?? null,
    status: c.status ?? null,
    demurrage_fee_if_late: c.demurrage_fee_if_late ?? null,
    demurrage_fees: c.demurrage_fees ?? null,
    has_detention: c.has_detention ?? null,
    gate_out_date: c.gate_out_date ?? null,
    empty_return_date: c.empty_return_date ?? null,
    detention_free_days: c.detention_free_days ?? null,
    detention_fee_rate: c.detention_fee_rate ?? null,
    detention_fees: c.detention_fees ?? null,
    milestone: c.milestone ?? null,
    notes: c.notes ?? null,
    list_id: c.list_id ?? null,
    updated_at: c.updated_at ?? null,
  };
}

function filterByStatus(rows: any[], status?: ExportStatus): any[] {
  if (!status || status === 'All') return rows;
  if (status === 'Open') return rows.filter(r => !r.is_closed);
  if (status === 'Closed') return rows.filter(r => r.is_closed);
  // Computed status: Safe | Warning | Overdue | Closed
  return rows.filter(r => r.status === status);
}

function makeFilename(orgId: string) {
  const now = new Date();
  const y = String(now.getUTCFullYear());
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `containers-${orgId}-${y}${m}${d}-${hh}${mm}.csv`;
}

/**
 * Export containers visible to the current user (RLS applies).
 * Defaults to the active list if listId is not provided.
 * Returns filename and CSV string (UTF-8 BOM included by serializer).
 */
export async function exportContainersCSV(params: ExportContainersParams = {}) {
  const { organizationId } = await getServerAuthContext();
  const listId = params.listId ?? null;

  // fetchContainers already applies org scoping via RLS
  const rows = await fetchContainers(listId);

  const filtered = filterByStatus(rows, params.status);
  const exportRows = filtered.map(toExportRow);
  const csv = serializeContainersToCSV(exportRows);
  const filename = makeFilename(organizationId);

  return { filename, csv };
}

