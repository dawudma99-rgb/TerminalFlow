export type ImportType = 'string' | 'date' | 'datetime' | 'number' | 'boolean';

export type ImportField = {
  key: string;          // DB/app field
  label: string;        // user label
  type: ImportType;     // how to coerce values
  required?: boolean;   // import-time requirement
  notes?: string;
};

// Canonical target fields we support in import (aligned with UI + DB)
export const IMPORT_FIELDS: ImportField[] = [
  { key: 'container_no', label: 'Container Number', type: 'string', required: true, notes: 'e.g., MSCU1234567' },
  { key: 'bl_number', label: 'B/L Number', type: 'string' },
  { key: 'pol', label: 'POL (Load Port)', type: 'string' },
  { key: 'pod', label: 'POD (Discharge Port)', type: 'string' },
  { key: 'arrival_date', label: 'Arrival (ETA)', type: 'date', required: true },
  { key: 'free_days', label: 'Free Days', type: 'number' },
  { key: 'carrier', label: 'Carrier', type: 'string' },
  { key: 'container_size', label: 'Container Size', type: 'string' }, // 20ft/40ft/45ft
  { key: 'assigned_to', label: 'Owner / Assigned To', type: 'string' },
  { key: 'milestone', label: 'Milestone', type: 'string' },           // validated later by milestones.ts
  { key: 'gate_out_date', label: 'Gate Out', type: 'date' },
  { key: 'empty_return_date', label: 'Empty Return', type: 'date' },
  { key: 'notes', label: 'Notes', type: 'string' },
  { key: 'list_name', label: 'List Name (optional)', type: 'string', notes: 'If provided, import will resolve/create and use this list' },
];

// Quick index by key
export const IMPORT_FIELD_MAP = new Map(IMPORT_FIELDS.map(f => [f.key, f]));

