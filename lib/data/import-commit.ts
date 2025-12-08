'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/utils/logger';
import { ensureMainListForCurrentOrg } from '@/lib/data/lists-actions';
import type { Database } from '@/types/database';
import { getServerAuthContext } from '@/lib/auth/serverAuthContext';

type ContainerInsert = Database['public']['Tables']['containers']['Insert'];

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function normalizeEmptyString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    return trimmed === '' ? null : trimmed;
  }
  return String(v).trim() || null;
}

// Type for import row data
type ImportRow = Record<string, unknown>;

export async function commitImport(rows: Array<ImportRow>): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ index: number; message: string }>;
}> {
  const { supabase, organizationId } = await getServerAuthContext();
  const orgId = organizationId;

  // Ensure Main List exists and get active list ID
  const { activeListId } = await ensureMainListForCurrentOrg();
  const defaultListId = activeListId;

  // Build payloads
  const payloads = [];
  const errors: Array<{ index: number; message: string }> = [];

  // Log batch-level info
  logger.info('[import-commit] Starting batch processing:', {
    totalRows: rows.length,
    organizationId: orgId,
    defaultListId,
  });

  // All rows use the same list_id (from user's active list / current_list_id)
  // list_name from input is ignored and treated as metadata only
  const listId = defaultListId;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const containerNo = String(row.container_no || '').trim().toUpperCase();
      const arrivalDateValue = row.arrival_date;
      const arrivalDate = arrivalDateValue ? String(arrivalDateValue) : '';
      
      const freeDaysValue = row.free_days;
      let freeDays = 7;
      if (typeof freeDaysValue === 'number' && Number.isFinite(freeDaysValue) && freeDaysValue >= 0) {
        freeDays = freeDaysValue;
      } else if (freeDaysValue != null) {
        const parsed = Number(freeDaysValue);
        if (Number.isFinite(parsed) && parsed >= 0) {
          freeDays = parsed;
        }
      }
      
      // Normalize pol and pod fields
      const polValue = normalizeEmptyString(row.pol);
      const podValue = normalizeEmptyString(row.pod);
      
      // Validate required fields before building payload
      if (!containerNo) {
        errors.push({ index: i, message: 'Missing container_no' });
        continue;
      }
      if (!arrivalDate) {
        errors.push({ index: i, message: 'Missing arrival_date' });
        continue;
      }
      if (!podValue || !String(podValue).trim()) {
        errors.push({ 
          index: i, 
          message: 'Missing POD (Port of Discharge). The database requires pod for all containers.' 
        });
        continue;
      }
      
      const payload: ContainerInsert = {
        container_no: containerNo,
        arrival_date: arrivalDate,
        free_days: freeDays,
        pod: podValue,
        organization_id: orgId,
        list_id: listId,
        // Optional fields - normalize empty strings to null
        pol: polValue,
        bl_number: normalizeEmptyString(row.bl_number),
        carrier: normalizeEmptyString(row.carrier),
        container_size: normalizeEmptyString(row.container_size),
        assigned_to: normalizeEmptyString(row.assigned_to),
        milestone: normalizeEmptyString(row.milestone),
        gate_out_date: normalizeEmptyString(row.gate_out_date),
        empty_return_date: normalizeEmptyString(row.empty_return_date),
        notes: normalizeEmptyString(row.notes),
      };

      payloads.push({ index: i, payload });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to prepare row';
      errors.push({ index: i, message: errorMessage });
    }
  }

  // Chunk and insert
  const chunks = chunk(payloads, 500);
  let inserted = 0;
  const updated = 0; // We can't easily distinguish, so set to 0
  let skipped = 0;

  for (const chunk of chunks) {
    const batch = chunk.map(c => c.payload);
    
    const { data, error } = await supabase
      .from('containers')
      .insert(batch)
      .select();

    if (error) {
      logger.error('Insert batch error', { error, batchSize: batch.length });
      // Mark all rows in this batch as errors
      for (const c of chunk) {
        errors.push({ index: c.index, message: `Insert failed: ${error.message}` });
      }
      skipped += chunk.length;
    } else {
      inserted += data?.length || 0;
    }
  }

  // Revalidate paths
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/containers');

  return {
    inserted,
    updated,
    skipped: skipped + (payloads.length - inserted - errors.length),
    errors,
  };
}

