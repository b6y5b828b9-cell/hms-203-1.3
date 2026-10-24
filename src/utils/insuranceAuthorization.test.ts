import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyInsuranceEligibility,
  createInsuranceAppealDraft,
  extractRejectionCode,
  getInsuranceRequestDueAt,
  getRejectionMissingFields,
  validateInsuranceRequestPayload,
} from './insuranceAuthorization';

test('requires an exact payer CPT and ICD-10 mapping before classifying coverage', () => {
  const request = {
    payerId: 'PAYER-1',
    cptCode: 'CPT-12345',
    icd10Code: 'A12.34',
    isExcluded: false,
    isPreExisting: false,
  };
  assert.equal(classifyInsuranceEligibility(request), 'Mapping Review Required');
  assert.equal(classifyInsuranceEligibility(request, [{
    payerId: 'payer-1',
    cptCode: 'CPT-12345',
    icd10Code: 'A1234',
    source: 'Payer manual 2026-1',
    effectiveFrom: '2026-01-01',
    classification: 'Pre-Authorization Required',
  }]), 'Pre-Authorization Required');
});

test('explicit exclusions and pre-existing conditions take precedence over mapped coverage', () => {
  const mapping = [{
    payerId: 'PAYER-1',
    cptCode: '12345',
    icd10Code: 'A1234',
    source: 'Payer manual',
    effectiveFrom: '2026-01-01',
    classification: 'Direct Billing' as const,
  }];
  assert.equal(classifyInsuranceEligibility({
    payerId: 'PAYER-1',
    cptCode: '12345',
    icd10Code: 'A1234',
    isExcluded: true,
    isPreExisting: false,
  }, mapping), 'Excluded');
  assert.equal(classifyInsuranceEligibility({
    payerId: 'PAYER-1',
    cptCode: '12345',
    icd10Code: 'A1234',
    isExcluded: false,
    isPreExisting: true,
  }, mapping), 'Pre-Existing');
});

test('calculates elective outpatient and inpatient response targets', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(getInsuranceRequestDueAt('Elective Outpatient', start), '2026-01-01T06:00:00.000Z');
  assert.equal(getInsuranceRequestDueAt('Elective Inpatient', start), '2026-01-02T00:00:00.000Z');
  assert.equal(getInsuranceRequestDueAt('Emergency', start), '2026-01-02T00:00:00.000Z');
});

test('validates all required gateway identity, coding, and cost fields', () => {
  assert.deepEqual(validateInsuranceRequestPayload({
    emiratesId: '',
    payerId: '',
    facilityDhaLicense: '',
    doctorLicense: '',
    icd10Code: '',
    serviceCode: '',
    estimatedCost: 0,
  }), [
    'Emirates ID',
    'Payer ID',
    'Facility DHA License',
    'Doctor License',
    'ICD-10 diagnosis',
    'CPT/service code',
    'Valid itemized cost',
  ]);
});

test('extracts rejection codes and flags missing appeal evidence', () => {
  const rejectionCode = extractRejectionCode('Payer rejection code: DX-001');
  assert.equal(rejectionCode, 'DX-001');
  assert.deepEqual(getRejectionMissingFields(rejectionCode, {
    icd10Code: '',
    clinicalRationale: '',
    serviceCategory: 'Radiology',
    supportingDocuments: { labReport: false, imagingReport: false },
  }), [
    'Linked ICD-10 diagnosis',
    'Clinical rationale',
    'Relevant imaging report',
  ]);
});

test('creates an appeal draft populated with request and rejection details', () => {
  const draft = createInsuranceAppealDraft({
    patientName: 'Ava Smith',
    patientMrn: 'MRN-1',
    insuranceProvider: 'Example Payer',
    payerId: 'PAYER-1',
    serviceName: 'MRI',
    serviceCode: 'CPT-1',
    icd10Code: 'M25.5',
    clinicalRationale: 'Persistent joint pain.',
    rejectionCode: 'DX-001',
    missingFields: ['Relevant imaging report'],
  });
  assert.match(draft, /Ava Smith/);
  assert.match(draft, /DX-001/);
  assert.match(draft, /Relevant imaging report/);
});
