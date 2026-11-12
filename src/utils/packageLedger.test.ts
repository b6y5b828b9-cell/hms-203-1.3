import test from 'node:test';
import assert from 'node:assert/strict';
import { DoctorPackage, ReceptionToken, TokenLineItem } from '../types';
import { buildPackageLedger, getPackageRetailValue } from './packageLedger';

const service: DoctorPackage['includedServices'][number] = {
  tariffItemId: 'TAR-LAB-01',
  code: 'LAB-CBC',
  cptCode: '85025',
  name: 'Complete Blood Count',
  category: 'Diagnostic Lab',
  department: 'Laboratory',
  unitPrice: 65,
  insuranceCoveredPercent: 90,
  quota: 2,
};

const packageItem: DoctorPackage = {
  id: 'PKG-1',
  doctorId: 'DOC-1',
  packageName: 'Wellness',
  packageNumber: 'W-001',
  coveragePercent: 80,
  validFrom: '2026-11-01',
  validUntil: '2026-11-30',
  basePrice: 100,
  includedServices: [service],
  isActive: true,
  createdAt: '2026-11-01T00:00:00Z',
  createdBy: 'Admin',
};

const lineItem = (
  id: string,
  code: string,
  name: string,
  quantity: number,
  unitPrice = 65
): TokenLineItem => ({
  id,
  kind: 'Lab',
  name,
  department: 'Laboratory',
  code,
  quantity,
  unitPrice,
  totalPrice: quantity * unitPrice,
  orderedBy: 'Doctor',
  orderedAt: `2026-11-12T10:${id === 'old-line' ? '00' : '30'}:00Z`,
  insuranceStatus: 'Pending_Auth',
  fulfillmentStatus: 'Ordered',
});

const token = (
  id: string,
  visitDate: string,
  lineItems: TokenLineItem[],
  packageId?: string
): ReceptionToken => ({
  id,
  tokenNumber: id,
  patientId: 'PT-1',
  patientName: 'Patient One',
  department: 'Laboratory',
  serviceType: 'Consultation',
  priority: 'Normal',
  status: 'Waiting',
  createdDate: visitDate,
  visitDate,
  createdTime: '10:00 AM',
  estimatedWaitMins: 0,
  counterOrRoom: 'Reception',
  paymentScheme: packageId ? {
    schemeType: 'Package',
    packageId,
    packageName: packageItem.packageName,
  } : undefined,
  lineItems,
});

test('counts linked package usage and bills only quota overflow plus uncovered services', () => {
  const priorVisit = token('TOK-1', '2026-11-10', [lineItem('old-line', '85025', 'Complete Blood Count', 1)], 'PKG-1');
  const currentVisit = token('TOK-2', '2026-11-12', [
    lineItem('current-line', '85025', 'Complete Blood Count', 2),
    lineItem('extra-line', '71020', 'Chest X-ray', 1, 120),
  ], 'PKG-1');

  const ledger = buildPackageLedger(packageItem, [priorVisit, currentVisit], 'TOK-2');

  assert.equal(ledger.usage[0].usedCount, 3);
  assert.equal(ledger.unbundledCharges.length, 2);
  assert.deepEqual(ledger.unbundledCharges.map((charge) => charge.extraQuantity), [1, 1]);
  assert.deepEqual(ledger.unbundledCharges.map((charge) => charge.totalPrice), [65, 120]);
});

test('does not count services from visits without the package applied', () => {
  const currentVisit = token('TOK-2', '2026-11-12', [lineItem('line', '85025', 'Complete Blood Count', 1)]);

  const ledger = buildPackageLedger(packageItem, [currentVisit], 'TOK-2');

  assert.equal(ledger.usage[0].usedCount, 0);
  assert.equal(ledger.unbundledCharges.length, 0);
});

test('calculates the retail value from tariff snapshots and quotas', () => {
  assert.equal(getPackageRetailValue([service]), 130);
});
