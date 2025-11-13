/**
 * Tier Utilities - Pure TypeScript module for tiered rate calculations
 * Migrated from js/utils/fees.ts and js/form-manager.ts tier functions
 * 
 * This module provides all tiered demurrage and detention fee calculation logic
 * without any DOM dependencies or side effects.
 */

const DEBUG = false

import { logger } from '@/lib/utils/logger'

/**
 * Represents a single tier in a tiered rate structure
 */
export interface Tier {
  /** Starting day for this tier (1-based) */
  from_day: number;
  /** Ending day for this tier (null = unlimited) */
  to_day: number | null;
  /** Rate per day in this tier */
  rate: number;
}

/**
 * Validation result for tier configuration
 */
export interface TierValidationResult {
  /** Whether the tier configuration is valid */
  valid: boolean;
  /** Array of error messages if validation fails */
  errors: string[];
}

/**
 * Calculate tiered fees based on days overdue and tier configuration
 * 
 * @param daysOverdue - Number of days overdue
 * @param tiers - Array of tier configurations
 * @param flatRate - Fallback flat rate if no tiers provided
 * @returns Total fee amount
 */
export function calculateTieredFees(
  daysOverdue: number, 
  tiers?: Tier[], 
  flatRate?: number
): number {
  // Debug: Log initial inputs
  if (DEBUG && process.env.NODE_ENV === 'development') {
    logger.debug('[TierCalc]', {
      daysOverdue,
      tiers,
      flatRate,
      hasTiers: Array.isArray(tiers) && tiers.length > 0,
      tiersLength: Array.isArray(tiers) ? tiers.length : 0
    })
  }

  // If no tiers, fallback to flat rate
  if (!Array.isArray(tiers) || tiers.length === 0) {
    const flatRateTotal = (daysOverdue > 0 && flatRate) ? daysOverdue * flatRate : 0
    if (DEBUG && process.env.NODE_ENV === 'development') {
      logger.debug('[TierCalc] Using flat rate', { daysOverdue, flatRate, total: flatRateTotal })
    }
    return flatRateTotal
  }

  // Sort tiers by from_day to ensure proper processing order
  const sortedTiers = sortTiers(tiers)
  // Removed verbose sorted tiers log - redundant information
  // if (DEBUG && process.env.NODE_ENV === 'development') {
  //   console.log('[TierCalc] Sorted tiers', sortedTiers)
  // }

  let total = 0
  let remainingDays = daysOverdue

  for (const tier of sortedTiers) {
    if (remainingDays <= 0) break

    const from = tier.from_day ?? 1
    const to = tier.to_day ?? Infinity
    const rate = Number(tier.rate ?? 0)

    // Calculate overlap between this tier range and remaining overdue days
    const tierStart = Math.max(from, 1)
    const tierEnd = Math.min(to, daysOverdue)
    const daysInThisTier = Math.max(0, tierEnd - tierStart + 1)
    const subtotal = daysInThisTier * rate

    // Removed verbose per-tier log - use DEBUG flag to re-enable if needed
    // if (DEBUG && process.env.NODE_ENV === 'development') {
    //   console.log('[TierCalc:each-tier]', {
    //     from,
    //     to: to === Infinity ? 'Infinity' : to,
    //     rate,
    //     tierStart,
    //     tierEnd,
    //     daysInThisTier,
    //     subtotal,
    //     remainingDaysBefore: remainingDays
    //   })
    // }

    total += subtotal
    remainingDays -= daysInThisTier
  }

  if (DEBUG && process.env.NODE_ENV === 'development') {
    logger.debug('[TierCalc] TOTAL =', { total, daysOverdue, remainingDays })
  }
  return total
}

/**
 * Validate tier configuration for data integrity
 * 
 * @param tiers - Array of tier configurations to validate
 * @param label - Label for error messages (e.g., "Demurrage", "Detention")
 * @returns Validation result with errors if any
 */
export function validateTierConfiguration(
  tiers: Tier[], 
  label: string
): TierValidationResult {
  const errors: string[] = [];
  
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return { valid: true, errors: [] };
  }
  
  const sorted = sortTiers(tiers);
  
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    
    // Check for valid numbers
    if (isNaN(t.from_day) || isNaN(t.rate) || t.from_day < 1 || t.rate < 0) {
      errors.push(`${label} tier ${i + 1}: Invalid day or rate value.`);
    }
    
    // Check to_day validity
    if (t.to_day !== null && (isNaN(t.to_day) || t.to_day < t.from_day)) {
      errors.push(`${label} tier ${i + 1}: "To Day" must be greater than or equal to "From Day".`);
    }
    
    // Check for overlaps with previous tier
    if (i > 0) {
      const prev = sorted[i - 1];
      const prevEnd = prev.to_day ?? Infinity;
      if (t.from_day <= prevEnd) {
        errors.push(`${label} tier ${i + 1}: Overlaps with previous tier (days ${prev.from_day}-${prevEnd}).`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Sort tiers by from_day in ascending order
 * 
 * @param tiers - Array of tiers to sort
 * @returns New sorted array (original array is not modified)
 */
export function sortTiers(tiers: Tier[]): Tier[] {
  return [...tiers].sort((a, b) => a.from_day - b.from_day);
}

/**
 * Check if container has tiered rates configured
 * 
 * @param tiers - Array of tier configurations
 * @returns True if tiers are configured and valid
 */
export function hasTieredRates(tiers?: Tier[]): boolean {
  return Array.isArray(tiers) && tiers.length > 0;
}

/**
 * Get tier summary text for display
 * 
 * @param tiers - Array of tier configurations
 * @returns Human-readable summary of tiers
 */
export function getTierSummary(tiers?: Tier[]): string {
  if (!hasTieredRates(tiers)) {
    return 'No tiered rates configured.';
  }
  
  const sorted = sortTiers(tiers!);
  const parts = sorted.map(t => {
    const toTxt = t.to_day ? `–${t.to_day}` : '+';
    return `Days ${t.from_day}${toTxt} → £${t.rate}/day`;
  });
  
  return `📈 Tiered rates: ${parts.join(', ')}`;
}

/**
 * Format fee amount for display
 * 
 * @param amount - Fee amount to format
 * @param showCurrency - Whether to include currency symbol
 * @returns Formatted fee string
 */
export function formatFee(amount: number, showCurrency: boolean = true): string {
  if (!Number.isFinite(amount) || amount < 0) return '—';
  
  const formatted = amount.toLocaleString();
  return showCurrency ? `£${formatted}` : formatted;
}

/**
 * Add a new tier step to the tier list
 * 
 * @param tiers - Current tier list
 * @param newTier - New tier to add
 * @returns New tier list with the added tier
 */
export function addTierStep(tiers: Tier[], newTier: Tier): Tier[] {
  const validation = validateTierConfiguration([newTier], 'New Tier');
  if (!validation.valid) {
    throw new Error(`Invalid tier: ${validation.errors.join(', ')}`);
  }

  const updatedTiers = [...tiers, newTier];
  const fullValidation = validateTierConfiguration(updatedTiers, 'Tier List');
  if (!fullValidation.valid) {
    throw new Error(`Tier conflicts: ${fullValidation.errors.join(', ')}`);
  }

  return sortTiers(updatedTiers);
}

/**
 * Edit an existing tier step in the tier list
 * 
 * @param tiers - Current tier list
 * @param index - Index of tier to edit
 * @param updatedTier - Updated tier data
 * @returns New tier list with the edited tier
 */
export function editTierStep(tiers: Tier[], index: number, updatedTier: Tier): Tier[] {
  if (index < 0 || index >= tiers.length) {
    throw new Error(`Invalid tier index: ${index}`);
  }

  const validation = validateTierConfiguration([updatedTier], 'Updated Tier');
  if (!validation.valid) {
    throw new Error(`Invalid tier: ${validation.errors.join(', ')}`);
  }

  const updatedTiers = [...tiers];
  updatedTiers[index] = updatedTier;
  
  const fullValidation = validateTierConfiguration(updatedTiers, 'Tier List');
  if (!fullValidation.valid) {
    throw new Error(`Tier conflicts: ${fullValidation.errors.join(', ')}`);
  }

  return sortTiers(updatedTiers);
}

/**
 * Delete a tier step from the tier list
 * 
 * @param tiers - Current tier list
 * @param index - Index of tier to delete
 * @returns New tier list without the deleted tier
 */
export function deleteTierStep(tiers: Tier[], index: number): Tier[] {
  if (index < 0 || index >= tiers.length) {
    throw new Error(`Invalid tier index: ${index}`);
  }

  const updatedTiers = [...tiers];
  updatedTiers.splice(index, 1);
  
  return sortTiers(updatedTiers);
}

/**
 * Get a tier at a specific index
 * 
 * @param tiers - Tier list
 * @param index - Index of tier to retrieve
 * @returns Tier at the specified index
 */
export function getTierAt(tiers: Tier[], index: number): Tier | null {
  if (index < 0 || index >= tiers.length) {
    return null;
  }
  return tiers[index];
}

/**
 * Merge existing tiers with new tiers, resolving conflicts
 * 
 * @param existing - Current tier list
 * @param newTiers - New tiers to merge
 * @returns Merged and sorted tier list
 */
export function mergeTiers(existing: Tier[], newTiers: Tier[]): Tier[] {
  const merged = [...existing, ...newTiers];
  const validation = validateTierConfiguration(merged, 'Merged Tiers');
  
  if (!validation.valid) {
    // If there are conflicts, try to resolve them by removing overlapping tiers
    const resolved = resolveTierConflicts(merged);
    return sortTiers(resolved);
  }
  
  return sortTiers(merged);
}

/**
 * Resolve tier conflicts by removing overlapping tiers
 * 
 * @param tiers - Tier list with potential conflicts
 * @returns Resolved tier list without conflicts
 */
function resolveTierConflicts(tiers: Tier[]): Tier[] {
  const sorted = sortTiers(tiers);
  const resolved: Tier[] = [];
  
  for (const tier of sorted) {
    const hasConflict = resolved.some(existing => {
      const existingEnd = existing.to_day ?? Infinity;
      const tierEnd = tier.to_day ?? Infinity;
      return (
        (tier.from_day >= existing.from_day && tier.from_day <= existingEnd) ||
        (tierEnd >= existing.from_day && tierEnd <= existingEnd) ||
        (tier.from_day <= existing.from_day && tierEnd >= existingEnd)
      );
    });
    
    if (!hasConflict) {
      resolved.push(tier);
    }
  }
  
  return resolved;
}

/**
 * Create a default tier configuration for common scenarios
 * 
 * @param type - Type of default tier ('demurrage' | 'detention')
 * @returns Default tier configuration
 */
export function createDefaultTiers(type: 'demurrage' | 'detention'): Tier[] {
  if (type === 'demurrage') {
    return [
      { from_day: 1, to_day: 7, rate: 100 },
      { from_day: 8, to_day: 14, rate: 200 },
      { from_day: 15, to_day: null, rate: 300 }
    ];
  } else {
    return [
      { from_day: 1, to_day: 5, rate: 50 },
      { from_day: 6, to_day: null, rate: 100 }
    ];
  }
}

/**
 * Calculate the effective rate for a given number of days overdue
 * 
 * @param daysOverdue - Number of days overdue
 * @param tiers - Tier configuration
 * @returns Effective rate per day
 */
export function getEffectiveRate(daysOverdue: number, tiers: Tier[]): number {
  if (!hasTieredRates(tiers)) {
    return 0;
  }

  const sortedTiers = sortTiers(tiers);
  
  for (const tier of sortedTiers) {
    const from = tier.from_day ?? 1;
    const to = tier.to_day ?? Infinity;
    
    if (daysOverdue >= from && daysOverdue <= to) {
      return tier.rate;
    }
  }
  
  // If no tier matches, return the rate from the last tier
  const lastTier = sortedTiers[sortedTiers.length - 1];
  return lastTier?.rate ?? 0;
}

/**
 * Get tier information for a specific day
 * 
 * @param day - Day number to check
 * @param tiers - Tier configuration
 * @returns Tier information for the specified day
 */
export function getTierForDay(day: number, tiers: Tier[]): Tier | null {
  if (!hasTieredRates(tiers)) {
    return null;
  }

  const sortedTiers = sortTiers(tiers);
  
  for (const tier of sortedTiers) {
    const from = tier.from_day ?? 1;
    const to = tier.to_day ?? Infinity;
    
    if (day >= from && day <= to) {
      return tier;
    }
  }
  
  return null;
}

/**
 * Calculate total fees for a range of days
 * 
 * @param startDay - Starting day
 * @param endDay - Ending day
 * @param tiers - Tier configuration
 * @returns Total fees for the range
 */
export function calculateFeesForRange(
  startDay: number, 
  endDay: number, 
  tiers: Tier[]
): number {
  if (startDay > endDay) {
    return 0;
  }

  let total = 0;
  
  for (let day = startDay; day <= endDay; day++) {
    const tier = getTierForDay(day, tiers);
    if (tier) {
      total += tier.rate;
    }
  }
  
  return total;
}

// Re-export commonly used functions for convenience
export {
  calculateTieredFees as calculateFees,
  validateTierConfiguration as validateTiers,
  getTierSummary as getSummary,
  hasTieredRates as hasTiers
};
