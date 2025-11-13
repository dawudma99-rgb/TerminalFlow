'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/utils/logger';

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (error || !profile?.organization_id) throw new Error('User profile not found');
  return profile.organization_id;
}

async function getUserId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  return user.id;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function normalizeEmptyString(v: any): any {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    return trimmed === '' ? null : trimmed;
  }
  return v;
}

export async function commitImport(rows: Array<Record<string, any>>): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ index: number; message: string }>;
}> {
  const supabase = await createClient();
  const orgId = await getOrgId(supabase);
  const userId = await getUserId(supabase);

  // Get current_list_id from profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('current_list_id')
    .eq('id', userId)
    .single();

  if (profileError) {
    throw new Error(`Failed to fetch profile: ${profileError.message}`);
  }

  const defaultListId = profile?.current_list_id ?? null;

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

      const payload: any = {
        container_no: String(row.container_no || '').trim().toUpperCase(),
        arrival_date: row.arrival_date || null,
        free_days: row.free_days ?? 7,
        organization_id: orgId,
        list_id: listId,
        // Optional fields - normalize empty strings to null
        bl_number: normalizeEmptyString(row.bl_number),
        pol: normalizeEmptyString(row.pol),
        pod: normalizeEmptyString(row.pod),
        carrier: normalizeEmptyString(row.carrier),
        container_size: normalizeEmptyString(row.container_size),
        assigned_to: normalizeEmptyString(row.assigned_to),
        milestone: normalizeEmptyString(row.milestone),
        gate_out_date: normalizeEmptyString(row.gate_out_date),
        empty_return_date: normalizeEmptyString(row.empty_return_date),
        notes: normalizeEmptyString(row.notes),
      };

      // Validate required fields
      if (!payload.container_no) {
        errors.push({ index: i, message: 'Missing container_no' });
        continue;
      }
      if (!payload.arrival_date) {
        errors.push({ index: i, message: 'Missing arrival_date' });
        continue;
      }

      payloads.push({ index: i, payload });
    } catch (err: any) {
      errors.push({ index: i, message: err?.message || 'Failed to prepare row' });
    }
  }

  // Chunk and insert
  const chunks = chunk(payloads, 500);
  let inserted = 0;
  let updated = 0;
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
    updated: 0, // We can't easily distinguish, so set to 0
    skipped: skipped + (payloads.length - inserted - errors.length),
    errors,
  };
}

