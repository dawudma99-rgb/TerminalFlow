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

  // Cache for list_name -> list_id lookups
  const listCache = new Map<string, string | null>();

  async function resolveListId(listName: string | null | undefined): Promise<string | null> {
    // Log raw input from Excel
    const rawListName = listName;
    console.log('[import-commit] resolveListId called:', {
      rawListName,
      rawType: typeof rawListName,
      rawValue: rawListName === null ? 'null' : rawListName === undefined ? 'undefined' : `"${rawListName}"`,
    });

    if (!listName) {
      console.log('[import-commit] No list_name provided, using defaultListId:', defaultListId);
      return defaultListId;
    }
    
    // TODO: Case-sensitivity issue - .eq('name', trimmed) is case-sensitive
    // "Main List" vs "main list" vs "MAIN LIST" will be treated as different lists
    // Consider using case-insensitive comparison or normalizing to lowercase
    const trimmed = String(listName).trim();
    
    // TODO: Whitespace issue - .trim() only removes standard spaces
    // Excel may contain non-breaking spaces (U+00A0), tabs, or other Unicode whitespace
    // Consider using a more aggressive normalization (e.g., replace all whitespace with spaces)
    console.log('[import-commit] Normalized list name:', {
      raw: `"${rawListName}"`,
      trimmed: `"${trimmed}"`,
      length: trimmed.length,
      charCodes: Array.from(trimmed).map(c => c.charCodeAt(0)),
    });

    if (!trimmed) {
      console.log('[import-commit] List name is empty after trim, using defaultListId:', defaultListId);
      return defaultListId;
    }

    // Check cache
    if (listCache.has(trimmed)) {
      const cachedId = listCache.get(trimmed) ?? null;
      console.log('[import-commit] Found in cache:', {
        listName: trimmed,
        listId: cachedId,
        source: 'cache',
      });
      return cachedId;
    }

    // TODO: Organization scoping - verify this query correctly filters by organization_id
    // The .eq('organization_id', orgId) should prevent cross-org matches, but double-check
    // that orgId is correctly set and the query is actually filtering
    console.log('[import-commit] Looking up existing list:', {
      listName: trimmed,
      organizationId: orgId,
      query: { name: trimmed, organization_id: orgId },
    });

    // Try to find existing list
    // TODO: Case-sensitivity - this .eq('name', trimmed) is case-sensitive
    // If the UI created "Main List" but Excel has "main list", this won't find it
    const { data: existing, error: findError } = await supabase
      .from('container_lists')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('name', trimmed)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's expected, log other errors
      console.error('[import-commit] Error looking up list:', {
        listName: trimmed,
        error: findError.message,
        errorCode: findError.code,
      });
    }

    if (existing) {
      console.log('[import-commit] Found existing list:', {
        listName: trimmed,
        foundName: existing.name,
        listId: existing.id,
        namesMatch: existing.name === trimmed,
        source: 'database',
      });
      listCache.set(trimmed, existing.id);
      return existing.id;
    }

    // TODO: Name mismatch - the existing list might have a different name format
    // (e.g., "Main List" in DB vs "main list" in Excel, or extra spaces)
    // Consider querying all lists for the org and doing a case-insensitive match
    console.log('[import-commit] No existing list found, creating new list:', {
      listName: trimmed,
      organizationId: orgId,
    });

    // Create new list if not found
    const { data: created, error: createError } = await supabase
      .from('container_lists')
      .insert({
        name: trimmed,
        organization_id: orgId,
      })
      .select('id, name')
      .single();

    if (createError || !created) {
      logger.error('Failed to create list', { name: trimmed, error: createError });
      console.error('[import-commit] Failed to create list:', {
        listName: trimmed,
        error: createError?.message,
        errorCode: createError?.code,
      });
      listCache.set(trimmed, null);
      return defaultListId;
    }

    console.log('[import-commit] Created new list:', {
      listName: trimmed,
      createdName: created.name,
      listId: created.id,
      source: 'new_creation',
    });

    listCache.set(trimmed, created.id);
    return created.id;
  }

  // Build payloads
  const payloads = [];
  const errors: Array<{ index: number; message: string }> = [];

  // Log batch-level info
  console.log('[import-commit] Starting batch processing:', {
    totalRows: rows.length,
    organizationId: orgId,
    defaultListId,
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // Log row-level list_name handling
      if (i === 0 || i < 5 || (i % 100 === 0)) {
        console.log('[import-commit] Processing row:', {
          index: i,
          rawListName: row.list_name,
          hasListName: !!row.list_name,
        });
      }
      const listId = await resolveListId(row.list_name);

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

