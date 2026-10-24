import assert from 'node:assert/strict';
import test from 'node:test';
import { BillItem, InsuranceApproval } from '../types';
import { applyApprovedInsuranceBreakdown, applyDiscountBreakdown } from './insuranceInvoice';

const invoiceItem: BillItem = {
  id: 'line-1',
  sourceServiceId: 'service-1',
  description: 'Complete blood count',
  category: 'Lab Test',
  unitCost: 100,
  quantity: 1,
  amount: 100,
};

const approval: InsuranceApproval = {
  id: 'approval-1',
  patientId: 'patient-1',
  patientName: 'Example Patient',
  patientMrn: 'MRN-1',
  insuranceProvider: 'Example Health',
  policyNumber: 'POL-1',
  approvalNumber: 'AUTH-1',
  doctorId: 'doctor-1',
  doctorName: 'Dr. Example',
  department: 'Laboratory',
  serviceCategory: 'Lab Test',
  serviceName: invoiceItem.description,
  estimatedCost: 100,
  approvedAmount: 80,
  copayPercentage: 20,
  copayAmount: 20,
  approvalStatus: 'Approved',
  approvalDate: '2026-10-24',
  validUntil: '2026-11-24',
  authorisedBy: 'Reviewer',
  serviceRecordId: 'service-1',
};

test('approved authorization credits only the approved insurer amount', () => {
  const [item] = applyApprovedInsuranceBreakdown(
    [{ ...invoiceItem, insuranceApprovalId: approval.id }],
    [approval]
  );

  assert.equal(item.insuranceAmount, 80);
  assert.equal(item.copayAmount, 20);
  assert.equal(item.netAmount, 100);
});

test('pending authorization does not reduce the patient balance', () => {
  const [item] = applyApprovedInsuranceBreakdown(
    [{ ...invoiceItem, insuranceApprovalId: approval.id }],
    [{ ...approval, approvalStatus: 'Pending', approvedAmount: 0, copayAmount: 0 }]
  );

  assert.equal(item.insuranceAmount, 0);
  assert.equal(item.copayAmount, 0);
});

test('approved coverage and copay are capped at the line total', () => {
  const [item] = applyApprovedInsuranceBreakdown(
    [{ ...invoiceItem, insuranceApprovalId: approval.id, unitCost: 50, amount: 50 }],
    [{ ...approval, approvedAmount: 80, copayAmount: 30 }]
  );

  assert.equal(item.insuranceAmount, 50);
  assert.equal(item.copayAmount, 0);
});

test('one authorization is not credited more than once across invoice lines', () => {
  const items = applyApprovedInsuranceBreakdown(
    [
      { ...invoiceItem, id: 'line-1', insuranceApprovalId: approval.id },
      { ...invoiceItem, id: 'line-2', insuranceApprovalId: approval.id },
    ],
    [approval]
  );

  assert.equal(items.reduce((sum, item) => sum + (item.insuranceAmount || 0), 0), 80);
  assert.equal(items.reduce((sum, item) => sum + (item.copayAmount || 0), 0), 20);
});

test('discount-card reduction is calculated per service line', () => {
  const [item] = applyDiscountBreakdown([invoiceItem], 15);

  assert.equal(item.amount, 100);
  assert.equal(item.discountAmount, 15);
  assert.equal(item.netAmount, 85);
  assert.equal(item.insuranceAmount, 0);
});