import assert from 'node:assert/strict';
import test from 'node:test';
import { ReceptionToken, TokenDoctorOrder, TokenLineItem } from '../types';
import {
  aggregateTokenLineItemBilling,
  appendTokenLineItems,
  canDispenseMedicationLineItem,
  canExecuteDiagnosticLineItem,
  createDoctorOrderLineItems,
  getEffectiveLineItemStatus,
} from './tokenStateMachine';

const createToken = (insured = true): ReceptionToken => ({
  id: 'TOK-1',
  tokenNumber: '01',
  patientId: 'PAT-1',
  patientName: 'Test Patient',
  department: 'General Medicine',
  serviceType: 'Consultation',
  priority: 'Normal',
  status: 'Waiting',
  createdTime: '09:00 AM',
  estimatedWaitMins: 10,
  counterOrRoom: 'Room 1',
  payMode: insured ? 'Insurance' : 'Self',
  paymentScheme: { schemeType: insured ? 'Insurance' : 'Self-Pay' },
});

const createOrders = (): TokenDoctorOrder => ({
  diagnoses: [],
  labRequests: [{
    id: 'LAB-1',
    testName: 'CBC',
    category: 'Hematology',
    cptCode: '85025',
    price: 100,
    status: 'Ordered',
  }],
  radiologyRequests: [{
    id: 'RAD-1',
    studyName: 'Chest X-ray',
    modality: 'X-ray',
    price: 80,
    status: 'Ordered',
  }],
  procedureRequests: [],
  medicationRequests: [{
    id: 'MED-1',
    sku: 'SKU-1',
    medicationName: 'Medication A',
    quantity: 2,
    unitPrice: 10,
    price: 20,
  }],
  consultationFee: 50,
  orderedByDoctorId: 'DOC-1',
  orderedByDoctorName: 'Dr. Test',
  orderedAt: '2026-10-24T09:00:00.000Z',
});

test('appends doctor orders to their existing token with per-item authorization defaults', () => {
  const token = createToken();
  const items = createDoctorOrderLineItems(token, createOrders());
  assert.deepEqual(items.map((item) => item.id), ['TOK-1-consult', 'LAB-1', 'RAD-1', 'MED-1']);
  assert.ok(items.every((item) => item.insuranceStatus === 'Pending_Auth'));
  assert.equal(items.find((item) => item.id === 'MED-1')?.kind, 'Medication');

  const approved = { ...items[1], insuranceStatus: 'Approved' as const };
  const appended = appendTokenLineItems([approved], items);
  assert.equal(appended.length, 4);
  assert.equal(appended.find((item) => item.id === 'LAB-1')?.insuranceStatus, 'Approved');

  const selfPayItems = createDoctorOrderLineItems(createToken(false), createOrders());
  assert.ok(selfPayItems.every((item) => item.insuranceStatus === 'Cash_Only'));
  assert.ok(selfPayItems.every((item) => getEffectiveLineItemStatus(item) === 'Self_Pay'));
});

test('department gates distinguish diagnostics from medication dispensing', () => {
  const base: TokenLineItem = {
    id: 'LI-1',
    kind: 'Lab',
    name: 'CBC',
    department: 'Laboratory',
    quantity: 1,
    unitPrice: 20,
    totalPrice: 20,
    orderedBy: 'Dr. Test',
    orderedAt: '2026-10-24T09:00:00.000Z',
    insuranceStatus: 'Pending_Auth',
    fulfillmentStatus: 'Ordered',
  };
  assert.equal(canExecuteDiagnosticLineItem(base), false);
  assert.equal(canExecuteDiagnosticLineItem({ ...base, insuranceStatus: 'Denied' }), false);
  assert.equal(canExecuteDiagnosticLineItem({ ...base, insuranceStatus: 'Cash_Only' }), true);
  assert.equal(canDispenseMedicationLineItem({ ...base, kind: 'Medication', insuranceStatus: 'Partially_Approved' }), false);
  assert.equal(canDispenseMedicationLineItem({ ...base, kind: 'Medication', insuranceStatus: 'Cash_Only' }), false);
  assert.equal(canDispenseMedicationLineItem({ ...base, kind: 'Medication', insuranceStatus: 'Approved' }), true);
  assert.equal(canDispenseMedicationLineItem({
    ...base,
    paymentOverride: {
      mode: 'Self_Pay',
      reason: 'Patient elected cash payment',
      overriddenBy: 'Insurance Approver',
      overriddenAt: '2026-10-24T09:00:00.000Z',
    },
  }), true);
  assert.equal(getEffectiveLineItemStatus({ ...base, paymentOverride: {
    mode: 'Self_Pay',
    reason: 'Patient elected cash payment',
    overriddenBy: 'Insurance Approver',
    overriddenAt: '2026-10-24T09:00:00.000Z',
  } }), 'Self_Pay');
});

test('billing totals use final line-item statuses and report unresolved authorization', () => {
  const base: TokenLineItem = {
    id: 'approved',
    kind: 'Lab',
    name: 'Approved',
    department: 'Laboratory',
    quantity: 1,
    unitPrice: 100,
    totalPrice: 100,
    orderedBy: 'Dr. Test',
    orderedAt: '2026-10-24T09:00:00.000Z',
    insuranceStatus: 'Approved',
    insuranceApprovedAmount: 100,
    copayAmount: 20,
    fulfillmentStatus: 'Ordered',
  };
  const totals = aggregateTokenLineItemBilling([
    base,
    {
      ...base,
      id: 'partial',
      totalPrice: 100,
      insuranceStatus: 'Partially_Approved',
      insuranceApprovedAmount: 60,
      copayAmount: 10,
    },
    { ...base, id: 'denied', totalPrice: 40, insuranceStatus: 'Denied' },
    { ...base, id: 'cash', totalPrice: 20, insuranceStatus: 'Cash_Only' },
  ]);
  assert.deepEqual(totals, {
    subtotal: 220,
    insuranceCoveredAmount: 130,
    patientShare: 90,
    copayAmount: 30,
    pendingItemIds: [],
  });

  const deniedItem = { ...base, id: 'denied-only', totalPrice: 40, insuranceStatus: 'Denied' as const };
  assert.deepEqual(aggregateTokenLineItemBilling([deniedItem]), {
    subtotal: 0,
    insuranceCoveredAmount: 0,
    patientShare: 0,
    copayAmount: 0,
    pendingItemIds: [],
  });
  const cashOverride = {
    ...deniedItem,
    paymentOverride: {
      mode: 'Self_Pay' as const,
      reason: 'Patient agreed to self-pay',
      overriddenBy: 'Cashier',
      overriddenAt: '2026-10-24T09:00:00.000Z',
    },
  };
  assert.deepEqual(aggregateTokenLineItemBilling([cashOverride]), {
    subtotal: 40,
    insuranceCoveredAmount: 0,
    patientShare: 40,
    copayAmount: 0,
    pendingItemIds: [],
  });

  const pending = aggregateTokenLineItemBilling([{ ...base, id: 'pending', insuranceStatus: 'Pending_Auth' }]);
  assert.deepEqual(pending.pendingItemIds, ['pending']);
});

test('token settlement excludes denied services until patient consent and totals approved copays', () => {
  const makeItem = (
    id: string,
    name: string,
    totalPrice: number,
    insuranceApprovedAmount: number,
    copayAmount: number,
    insuranceStatus: TokenLineItem['insuranceStatus'] = 'Approved'
  ): TokenLineItem => ({
    id,
    kind: id === 'med' ? 'Medication' : id === 'mri' ? 'Radiology' : 'Lab',
    name,
    department: id === 'mri' ? 'Radiology' : id === 'med' ? 'Pharmacy' : 'Laboratory',
    quantity: 1,
    unitPrice: totalPrice,
    totalPrice,
    orderedBy: 'Dr. Test',
    orderedAt: '2026-10-24T09:00:00.000Z',
    insuranceStatus,
    insuranceApprovedAmount,
    copayAmount,
    fulfillmentStatus: 'Ordered',
  });
  const settlement = aggregateTokenLineItemBilling([
    makeItem('consult', 'Consultation', 200, 200, 50),
    makeItem('cbc', 'CBC', 100, 100, 0),
    makeItem('med', 'Painkiller', 40, 40, 20),
    makeItem('mri', 'Lumbar MRI', 200, 0, 0, 'Denied'),
  ]);
  assert.deepEqual(settlement, {
    subtotal: 340,
    insuranceCoveredAmount: 270,
    patientShare: 70,
    copayAmount: 70,
    pendingItemIds: [],
  });
});
