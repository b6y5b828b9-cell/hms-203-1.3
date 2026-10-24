import { InsuranceApproval } from '../types';

export interface InsuranceCodeMapping {
  payerId: string;
  cptCode: string;
  icd10Code: string;
  source: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  classification: Exclude<NonNullable<InsuranceApproval['eligibilityClassification']>, 'Mapping Review Required'>;
}

export interface InsuranceEligibilityInput {
  payerId: string;
  cptCode: string;
  icd10Code: string;
  isExcluded: boolean;
  isPreExisting: boolean;
}

export const INSURANCE_CODE_MAPPINGS: InsuranceCodeMapping[] = [];
const INSURANCE_CODE_MAPPING_STORAGE_KEY = 'medcore_insurance_code_mappings_v1';

export const loadInsuranceCodeMappings = (): InsuranceCodeMapping[] => {
  const saved = localStorage.getItem(INSURANCE_CODE_MAPPING_STORAGE_KEY);
  if (!saved) return INSURANCE_CODE_MAPPINGS;
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new Error('Insurance code mapping storage must contain an array.');
    return parsed.filter((entry): entry is InsuranceCodeMapping =>
      Boolean(
        entry &&
        typeof entry.payerId === 'string' &&
        typeof entry.cptCode === 'string' &&
        typeof entry.icd10Code === 'string' &&
        typeof entry.source === 'string' &&
        typeof entry.effectiveFrom === 'string' &&
        ['Direct Billing', 'Pre-Authorization Required', 'Excluded', 'Pre-Existing'].includes(entry.classification)
      )
    );
  } catch (error) {
    console.error('Unable to read payer CPT/ICD-10 mappings from local storage.', error);
    return INSURANCE_CODE_MAPPINGS;
  }
};

export const saveInsuranceCodeMappings = (mappings: InsuranceCodeMapping[]): void => {
  localStorage.setItem(INSURANCE_CODE_MAPPING_STORAGE_KEY, JSON.stringify(mappings));
};

const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/[.\s-]/g, '');

export const classifyInsuranceEligibility = (
  input: InsuranceEligibilityInput,
  mappings: InsuranceCodeMapping[] = INSURANCE_CODE_MAPPINGS
): NonNullable<InsuranceApproval['eligibilityClassification']> => {
  if (input.isExcluded) return 'Excluded';
  if (input.isPreExisting) return 'Pre-Existing';

  const mapping = mappings.find((item) =>
    item.payerId.trim().toLowerCase() === input.payerId.trim().toLowerCase() &&
    normalizeCode(item.cptCode) === normalizeCode(input.cptCode) &&
    normalizeCode(item.icd10Code) === normalizeCode(input.icd10Code) &&
    item.source.trim() !== '' &&
    item.effectiveFrom <= new Date().toISOString().slice(0, 10) &&
    (!item.effectiveUntil || item.effectiveUntil >= new Date().toISOString().slice(0, 10))
  );

  return mapping?.classification || 'Mapping Review Required';
};

export const validateInsuranceRequestPayload = (
  payload: Pick<
    InsuranceApproval,
    'emiratesId' | 'payerId' | 'facilityDhaLicense' | 'doctorLicense' | 'icd10Code' | 'serviceCode' | 'estimatedCost'
  >
): string[] => {
  const missing: string[] = [];
  if (!payload.emiratesId?.trim()) missing.push('Emirates ID');
  if (!payload.payerId?.trim()) missing.push('Payer ID');
  if (!payload.facilityDhaLicense?.trim()) missing.push('Facility DHA License');
  if (!payload.doctorLicense?.trim()) missing.push('Doctor License');
  if (!payload.icd10Code?.trim()) missing.push('ICD-10 diagnosis');
  if (!payload.serviceCode?.trim()) missing.push('CPT/service code');
  if (!Number.isFinite(payload.estimatedCost) || payload.estimatedCost <= 0) missing.push('Valid itemized cost');
  return missing;
};

export const getInsuranceRequestDueAt = (
  requestType: NonNullable<InsuranceApproval['requestType']>,
  requestedAt = new Date()
): string => {
  const hours = requestType === 'Elective Outpatient' ? 6 : 24;
  return new Date(requestedAt.getTime() + hours * 60 * 60 * 1000).toISOString();
};

export const extractRejectionCode = (response: string): string | undefined => {
  const match = response.match(/\b(?:(?:rejection|denial|reason)\s*)?code\s*[:#-]?\s*([A-Z0-9][A-Z0-9._-]{1,30})\b/i) ||
    response.trim().match(/^([A-Z]{1,5}[-_.]?\d{1,8})$/i);
  return match?.[1]?.toUpperCase();
};

export const getRejectionMissingFields = (
  rejectionCode: string | undefined,
  approval: Pick<InsuranceApproval, 'icd10Code' | 'clinicalRationale' | 'supportingDocuments' | 'serviceCategory'>
): string[] => {
  const code = rejectionCode?.toUpperCase() || '';
  const missing = new Set<string>();

  if (!approval.icd10Code?.trim() || /DIAG|DX|ICD/.test(code)) missing.add('Linked ICD-10 diagnosis');
  if (!approval.clinicalRationale?.trim() || /RATIONALE|CLINICAL|MEDICAL/.test(code)) missing.add('Clinical rationale');
  if (/REPORT|IMAGING|LAB|DOCUMENT/.test(code)) {
    if (!approval.supportingDocuments?.labReport) missing.add('Relevant laboratory report');
    if (!approval.supportingDocuments?.imagingReport) missing.add('Relevant imaging report');
  }
  if (approval.serviceCategory === 'Lab Test' && !approval.supportingDocuments?.labReport) {
    missing.add('Relevant laboratory report');
  }
  if (approval.serviceCategory === 'Radiology' && !approval.supportingDocuments?.imagingReport) {
    missing.add('Relevant imaging report');
  }

  return [...missing];
};

export const createInsuranceAppealDraft = (
  approval: Pick<
    InsuranceApproval,
    'patientName' | 'patientMrn' | 'insuranceProvider' | 'payerId' | 'serviceName' | 'serviceCode' | 'icd10Code' | 'clinicalRationale' | 'rejectionCode' | 'missingFields'
  >
): string => [
  `To: ${approval.insuranceProvider} (${approval.payerId || '[PAYER ID]'})`,
  `Subject: Appeal / reconsideration — ${approval.serviceName}`,
  `Patient: ${approval.patientName} · MRN ${approval.patientMrn}`,
  `Rejection code: ${approval.rejectionCode || '[ENTER PAYER REJECTION CODE]'}`,
  `Requested service: ${approval.serviceName} · CPT ${approval.serviceCode || '[CPT CODE]'}`,
  `Linked diagnosis: ${approval.icd10Code || '[LINK ICD-10 DIAGNOSIS]'}`,
  `Clinical rationale: ${approval.clinicalRationale || '[TREATING PHYSICIAN TO COMPLETE]'}`,
  `Information to attach: ${approval.missingFields?.length ? approval.missingFields.join(', ') : '[ATTACH RELEVANT CLINICAL RECORDS]'}`,
].join('\n');
