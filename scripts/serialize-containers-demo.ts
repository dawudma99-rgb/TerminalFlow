// scripts/serialize-containers-demo.ts

import { writeFileSync } from 'node:fs';
import { serializeContainersToCSV, type ContainerForExport } from '../lib/csv/containers-serializer';

const sample: ContainerForExport[] = [
  {
    container_no: 'MSCU1234567',
    bl_number: 'BL-001',
    pol: 'Shanghai',
    pod: 'Felixstowe',
    carrier: 'MSC',
    container_size: '40ft',
    assigned_to: 'Alice',
    arrival_date: '2025-11-10',
    free_days: 7,
    days_left: 2,
    status: 'Warning',
    demurrage_fee_if_late: 100,
    demurrage_fees: 0,
    has_detention: true,
    gate_out_date: '11/11/2025',           // DD/MM/YYYY test
    empty_return_date: null,
    detention_free_days: 5,
    detention_fee_rate: 50,
    detention_fees: 100,
    milestone: 'Gate Out',
    notes: 'Handle with care, "fragile"',
    list_id: 'list-1',
    updated_at: '2025-11-12T09:30:00Z',
  },
  {
    container_no: 'CMAU7654321',
    bl_number: 'BL-002',
    pol: 'São Paulo',                       // unicode test
    pod: 'London Gateway',
    carrier: 'CMA CGM',
    container_size: '20ft',
    assigned_to: 'Bob, Jr.',                // comma test
    arrival_date: '12-11-2025',             // DD-MM-YYYY (should fail and become empty)
    free_days: 10,
    days_left: -3,
    status: 'Overdue',
    demurrage_fee_if_late: 200,
    demurrage_fees: 1300,
    has_detention: false,
    gate_out_date: '',
    empty_return_date: '',
    detention_free_days: 0,
    detention_fee_rate: 0,
    detention_fees: 0,
    milestone: 'In Demurrage',
    notes: 'Requires customs inspection',
    list_id: 'list-2',
    updated_at: '2025-11-12T10:05:00Z',
  },
  {
    container_no: 'MAEU9876543',
    bl_number: null,
    pol: '',
    pod: 'Hamburg',
    carrier: 'Maersk',
    container_size: '45ft',
    assigned_to: null,
    arrival_date: '2025/11/09',             // YYYY/MM/DD (native parse ok)
    free_days: 5,
    days_left: 10,
    status: 'Safe',
    demurrage_fee_if_late: 0,
    demurrage_fees: 0,
    has_detention: true,
    gate_out_date: '2025-11-11T14:00:00Z',
    empty_return_date: null,
    detention_free_days: 7,
    detention_fee_rate: 75.5,
    detention_fees: 0,
    milestone: 'At Port',
    notes: '—',
    list_id: 'list-1',
    updated_at: new Date('2025-11-12T10:10:00Z').toISOString(),
  },
];

const csv = serializeContainersToCSV(sample);

// Preview: show first 6 lines in console
const preview = csv.split('\r\n').slice(0, 6).join('\n');
console.log('--- CSV PREVIEW (first 6 lines) ---\n' + preview);

// Write file for Excel verification (repo root)
writeFileSync('../containers-demo.csv', csv, { encoding: 'utf8' });
console.log('\nWrote containers-demo.csv to repo root (' + Buffer.byteLength(csv, 'utf8') + ' bytes)');

