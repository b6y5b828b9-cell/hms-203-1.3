export type PatientStatus = 'Inpatient' | 'Outpatient' | 'Emergency' | 'Discharged' | 'Pending';

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Unknown';

export interface Vitals {
  heartRate: number; // bpm
  bloodPressureSys: number; // mmHg
  bloodPressureDia: number; // mmHg
  spO2: number; // %
  temperature: number; // °F
  respiratoryRate: number; // breaths/min
  recordedAt: string;
  painScore?: number; // 0-10 scale
  bloodGlucose?: number; // mg/dL
  avpu?: 'Alert' | 'Verbal' | 'Pain' | 'Unresponsive';
}

export type TriageUrgencyLevel =
  | 'Level 1 - Resuscitation (Immediate)'
  | 'Level 2 - Emergent (High Risk / <15m)'
  | 'Level 3 - Urgent (<30m)'
  | 'Level 4 - Less Urgent (<60m)'
  | 'Level 5 - Non-Urgent (Routine)'
  | 'Level 1 - Resuscitation'
  | 'Level 2 - Emergent'
  | 'Level 3 - Urgent'
  | 'Level 4 - Less Urgent'
  | 'Level 5 - Non-Urgent';

export type TriageAcuityColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue';

export interface TriageAssessment {
  id: string; // e.g. TRG-2026-001
  patientId: string;
  patientName: string;
  urgencyLevel: TriageUrgencyLevel;
  acuityColor: TriageAcuityColor;
  chiefComplaint: string;
  symptoms: string[];
  vitals: Vitals;
  consciousness: 'Alert' | 'Verbal' | 'Pain' | 'Unresponsive';
  painScore: number; // 0-10
  bloodGlucose?: number; // mg/dL
  arrivalMode: 'Walk-in' | 'Ambulance / EMS' | 'Wheelchair' | 'Stretcher' | 'Caregiver / Police';
  isolationPrecautions: 'None' | 'Airborne' | 'Droplet' | 'Contact';
  fallRisk: 'Low' | 'Moderate' | 'High';
  triageNotes?: string;
  disposition: string;
  assessedBy: string;
  assessedAt: string;
  timestamp?: string;
  bloodPressure?: string;
  heartRate?: number;
  oxygenSaturation?: number;
  respiratoryRate?: number;
  temperatureF?: number;
  assignedZone?: string;
  assessorRole?: string;
  nurseName?: string;
  assignedDisposition?: string;
  isolationRequired?: boolean;
  newsScore?: number;
}

export interface HospitalPriceItem {
  id: string;
  code: string;
  name: string;
  category: 'Consultation' | 'Diagnostic Lab' | 'Radiology & Imaging' | 'Ward & Nursing' | 'Surgical Procedure' | 'Dermatology Procedure' | 'Injection & Administration' | 'Physiotherapy' | 'Emergency Care' | 'Medication';
  department: string;
  applicableType: 'Both IPD & OPD' | 'Outpatient Only' | 'Inpatient Only';
  standardPrice: number;
  insuranceCoveredApprox: number; // e.g. 80 means 80%
  copayEst: number;
  cptCode?: string;
  description: string;
}

export interface Medication {
  id: string;
  catalogCode?: string;
  unitPrice?: number;
  encounterTokenId?: string;
  name: string;
  medicationName?: string;
  dosage: string;
  frequency: string;
  route: string; // Oral, IV, Topical, etc.
  duration?: string;
  instructions?: string;
  prescribedBy: string;
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Completed' | 'Discontinued';
}

export type Prescription = Medication;

export interface LabResult {
  id: string;
  encounterTokenId?: string;
  testName: string;
  category: 'Hematology' | 'Radiology' | 'Biochemistry' | 'Pathology' | 'Cardiology';
  orderedDate: string;
  resultDate?: string;
  status: 'Pending' | 'Normal' | 'Elevated' | 'Critical';
  value: string;
  referenceRange: string;
  orderedBy: string;
  notes?: string;
  department?: 'Laboratory' | 'Radiology & Imaging' | 'Cardiology / Procedures';
  cptCode?: string;
  modality?: string;
  findings?: string;
  impression?: string;
  technicianOrRadiologist?: string;
  sentToPatient?: boolean;
  sentToDoctor?: boolean;
  sentDate?: string;
  insuranceApprovalId?: string;
  publishedBy?: string;
  criticalEscalation?: {
    doctorNotified: boolean;
    notifiedDoctorName?: string;
    notifiedAt?: string;
    callNotes?: string;
    readBackConfirmed?: boolean;
    technicianName?: string;
  };
}

export interface PatientService {
  id: string;
  name: string;
  category: InsuranceApproval['serviceCategory'];
  serviceCode?: string;
  estimatedCost: number;
  addedAt: string;
  addedBy: string;
  encounterTokenId?: string;
  insuranceApprovalId?: string;
  billingStatus?: ServiceBillingStatus;
  invoiceId?: string;
  deferredAt?: string;
}

export type ServiceBillingStatus = 'Pending' | 'Billed' | 'Deferred' | 'Cancelled';

export interface EncounterServiceBillingState {
  serviceId: string;
  status: ServiceBillingStatus;
  invoiceId?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ClinicalNote {
  id: string;
  date: string;
  patientId?: string;
  encounterTokenId?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  chiefComplaint?: string;
  assessment?: string;
  treatmentPlan?: string;
  diagnosisCode?: string; // e.g. ICD-10 code
  authorName?: string;
  authorRole?: string;
  content?: string;
  diagnoses?: string[];
  category?: string;
}

export type DiagnosisSeverity = 'Mild' | 'Moderate' | 'Severe' | 'Acute on Chronic';
export type DiagnosisStatus = 'Active' | 'Chronic' | 'In Remission' | 'Resolved' | 'Rule Out';
export type DiagnosisType = 'Primary' | 'Secondary' | 'Differential' | 'Admitting' | 'Discharge';

export interface PatientDiagnosis {
  id: string;
  icdCode: string; // ICD-10-CM Standard
  description: string;
  category: string;
  type: DiagnosisType;
  status: DiagnosisStatus;
  severity: DiagnosisSeverity;
  onsetDate: string;
  diagnosedDate: string;
  diagnosedBy: string;
  doctorSpecialty: string;
  clinicalNotes?: string;
  hipaaStandard: 'ICD-10-CM' | 'ICD-11' | 'SNOMED-CT';
  billable: boolean;
  hipaaAuditStamp?: string;
}

export interface FacilityVisit {
  id: string;
  visitDate: string;
  doctorName: string;
  doctorSpecialty: string;
  department: string;
  clinicRoom: string;
  visitType: 'Emergency Triage' | 'Specialist Consultation' | 'Inpatient Ward Round' | 'Outpatient Follow-up' | 'Surgical Review' | 'Lab & Imaging Review' | 'Prescription / eRx' | 'Billing & Claims';
  chiefComplaint: string;
  clinicalAssessment: string;
  primaryDiagnosis: {
    code: string;
    description: string;
  };
  vitalsSnapshot: {
    bloodPressure: string;
    heartRate: number;
    spO2: number;
    temperature: number;
    respiratoryRate: number;
  };
  medicationsPrescribed: string[];
  diagnosticOrders: string[];
  disposition: 'Admitted to Ward' | 'Discharged to Home' | 'Follow-up Scheduled' | 'Referred to Specialist' | 'Transferred to ICU';
  signedAt: string;
  signatureHash?: string;
}

export interface InsurancePolicy {
  provider: string;
  policyNumber: string;
  tpa?: string;
  regulator?: 'DHA' | 'DOH' | 'MOHAP' | 'Other';
  network?: string;
  planName?: string;
  cardNumber?: string;
  certificateNumber?: string;
  dependentNumber?: string;
  claimFormNo?: string;
  requiresPreAuthorization?: boolean;
  preExistingWaitingPeriod?: string;
  verificationReference?: string;
  dailyClinicLimitAed?: number;
  verifiedAt?: string;
  verifiedBy?: string;
  memberId?: string;
  dhaMemberId?: string;
  clientNumber?: string;
  serviceCopay?: {
    consultation: number;
    dental?: number;
    procedure?: number;
    laboratory?: number;
    lab?: number;
    radiology: number;
    pharmacy: number;
    procedures?: number;
    surgicalProcedure?: number;
    emergency: number;
  };
  deductibleAmount?: number;
  groupNumber: string;
  coveragePercentage: number; // e.g. 80 means 80% covered
  copayAmount: number;
  status: 'Verified' | 'Pending' | 'Expired';
  expiryDate: string;
}

export interface DetailedInsuranceRecord {
  id: string;
  partyName: string; // TPA, e.g. NAS ADMINISTRATION SERVICES
  subPartyName?: string;
  payerName: string; // e.g. QATAR INSURANCE COMPANY
  network: string; // e.g. QIC - Gulfcare RN / QIC RN
  plan: string;
  cardNumber: string; // e.g. M363-NMJF-LFL3-2LED
  expiryDate: string; // e.g. 27/11/2026
  policyNumber: string;
  certificateNumber?: string;
  dependentNumber?: string;
  claimFormNo?: string;
  copayDeductible?: string;
  isPrimary: boolean;
  requiresApproval?: boolean;
  preExistingWaitingPeriod?: string;
  isDubaiPolicy?: boolean;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Patient {
  id: string; // e.g. PT-10492
  rgNo?: string; // e.g. RG3325481
  avatar?: string;
  photo?: string;
  title?: string; // Mrs., Mr., Ms., Dr., Master
  firstName: string;
  middleName?: string;
  lastName: string;
  surName?: string;
  age: number;
  dob: string;
  ageBreakdown?: { days: number; months: number; years: number };
  gender: 'Male' | 'Female' | 'Other';
  maritalStatus?: 'Single' | 'Married' | 'Divorced' | 'Widowed';
  bloodGroup: BloodGroup;
  phone: string;
  mobile?: string;
  smsMobile?: string;
  mobileCountryCode?: string;
  hasWhatsApp?: boolean;
  email: string;
  hasNoEmail?: boolean;
  address: string;
  nationality?: string;
  language?: string;
  religion?: string;
  visaCategory?: string;
  countryOfResidence?: string;
  stayingIn?: string;
  area?: string;
  district?: string;
  emiratesId?: string;
  passportNo?: string;
  dlNo?: string;
  mothersEid?: string;
  motherPassportNo?: string;
  gccId?: string;
  occupation?: string;
  company?: string;
  occupationArea?: string;
  occupationDistrict?: string;
  peopleOfDetermination?: boolean;
  isTelehealthPatient?: boolean;
  isHomeCarePatient?: boolean;
  loyaltyPoints?: number;
  isPriority?: boolean;
  painScale?: { hasPain: boolean; score?: number };
  riskOfFall?: boolean;
  hasPackage?: boolean;
  selectedPackage?: string;
  advanceBalance?: number;
  purposeOfVisit?: string;
  department?: string;
  consultantId?: string;
  consultantName?: string;
  technicianName?: string;
  visitBillingType?: 'Cosmetic -5%' | 'Treatment 0%';
  payMode?: 'Self' | 'Insurance' | 'Discount Card' | 'Company';
  discountCardName?: string;
  discountCardNumber?: string;
  discountPercent?: number;
  insuranceCardImage?: string;
  supportDocumentImage?: string;
  hasTravelHistory?: boolean;
  consentSigned?: boolean;
  consentTimestamp?: string;
  consentSignature?: string;
  consentSignerRole?: 'Patient' | 'Legal guardian';
  consentSignerRelationship?: string;
  insuranceList?: DetailedInsuranceRecord[];
  insuranceDetails?: {
    provider?: string;
    policyNumber?: string;
    [key: string]: any;
  };
  referral?: {
    type: 'Internal' | 'External Center' | 'Walk-In' | 'Corporate' | 'Online Booking';
    referrerName?: string;
    documentAttached?: boolean;
  };
  emergencyContact: EmergencyContact;
  medicalHistory?: string[];
  surgicalHistory?: string[];
  familyHistory?: string;
  lifestyleHabits?: {
    smoking: string;
    alcohol: string;
    exerciseFrequency: string;
  };
  status: PatientStatus;
  wardOrRoom?: string; // e.g., "ICU Bed 02" or "Cardiology Unit - Bed 304"
  primaryPhysicianId: string;
  primaryPhysicianName: string;
  allergies: Array<{ allergen: string; severity: 'Mild' | 'Moderate' | 'Severe' }>;
  chronicConditions: string[];
  vitals: Vitals[];
  latestTriage?: TriageAssessment;
  triageAssessments?: TriageAssessment[];
  medications: Medication[];
  prescriptions?: Medication[];
  labResults: LabResult[];
  services?: PatientService[];
  clinicalNotes: ClinicalNote[];
  diagnoses?: PatientDiagnosis[];
  facilityVisits?: FacilityVisit[];
  insurance: InsurancePolicy;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus = 
  | 'Scheduled' 
  | 'Checked-In' 
  | 'In Consultation' 
  | 'Completed' 
  | 'Cancelled' 
  | 'No-Show';

export type AppointmentPriority = 'Normal' | 'Urgent' | 'Emergency';

export type AppointmentType =
  | 'General Consultation' 
  | 'Follow-up' 
  | 'Specialist Review' 
  | 'Emergency Triage' 
  | 'Lab Review'
  | 'Telehealth Consultation'
  | 'Remote Follow-up';

export interface TelehealthDetails {
  platform: 'WebRTC Clinical Room' | 'Secure Portal' | 'HIPAA Video Bridge';
  roomId: string;
  meetingLink: string;
  patientStatus: 'Waiting in Room' | 'Scheduled / Not Joined' | 'Connected' | 'Completed';
  patientJoinedAt?: string;
  deviceInfo?: string;
  connectionQuality?: 'Excellent (HD 1080p)' | 'Good (720p)' | 'Fair';
  telehealthConsentSigned: boolean;
}

export interface Appointment {
  id: string; // APT-2026-001
  patientId: string;
  patientName: string;
  patientPhone?: string;
  patientNationalId?: string;
  patientPassportNo?: string;
  patientRegistrationNo?: string;
  bookingChannel?: 'Clinic' | 'Call Center' | 'Application';
  patientAge: number;
  patientGender: string;
  doctorId: string;
  doctorName: string;
  department: string;
  roomNumber: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "09:30 AM"
  type: string;
  status: AppointmentStatus;
  priority: AppointmentPriority;
  reason: string;
  cancellationReason?: string;
  cancellationNotes?: string;
  queueNumber: number;
  estimatedWaitMinutes?: number;
  notes?: string;
  createdAt: string;
  isTelehealth?: boolean;
  telehealthDetails?: TelehealthDetails;
  chiefComplaint?: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  department: string;
  roomNumber: string;
  avatar: string;
  availableDays: string[];
  availableHours: string;
  consultationFee: number;
  status: 'Available' | 'In Consultation' | 'In Surgery' | 'Off Duty';
  isAvailable?: boolean;
  telehealthEnabled?: boolean;
  shift?: string;
  rating?: number;
}

export interface DoctorDutySchedule {
  id: string;
  doctorId: string;
  date: string;
  isOnDuty: boolean;
  startTime: string;
  endTime: string;
  intervalMinutes?: number;
  remark?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface StaffDutySchedule {
  id: string;
  staffId: string;
  date: string;
  isOnDuty: boolean;
  startTime: string;
  endTime: string;
  intervalMinutes?: number;
  remark?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface DoctorDutyChangeRequest {
  id: string;
  doctorId: string;
  doctorName: string;
  requesterUserId: string;
  requesterUserName: string;
  currentDays: string[];
  currentHours: string;
  requestedDays: string[];
  requestedHours: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface BillItem {
  id: string;
  serviceCode?: string;
  cptCode?: string;
  sourceServiceId?: string;
  sourceEncounterTokenId?: string;
  sourceType?: 'Doctor Order' | 'Patient Service' | 'Nursing Service' | 'Manual';
  insuranceApprovalId?: string;
  billingStatus?: ServiceBillingStatus;
  description: string;
  category: 'Consultation' | 'Lab Test' | 'Radiology' | 'Pharmacy' | 'Room & Nursing' | 'Surgical Procedure' | 'Technician Service' | 'Cardiology';
  unitCost: number;
  quantity: number;
  amount: number;
  totalPrice?: number;
  discountAmount?: number;
  netAmount?: number;
  deductibleAmount?: number;
  copayPercentage?: number;
  copayAmount?: number;
  insuranceAmount?: number;
}

export type PaymentStatus =
  | 'Draft'
  | 'Pending'
  | 'Pending Insurance'
  | 'Partially Paid'
  | 'Paid'
  | 'Overdue'
  | 'Insurance Processing'
  | 'Refunded';
export type PaymentMethod =
  | 'Credit/Debit Card'
  | 'HSA/FSA'
  | 'Direct Insurance'
  | 'ACH/Bank Transfer'
  | 'Cash'
  | 'Loyalty Points'
  | 'Patient Advance'
  | 'Wire Transfer';

export interface PaymentTransaction {
  transactionId: string;
  timestamp: string;
  amountPaid: number;
  method: PaymentMethod;
  cardLast4?: string;
  loyaltyPointsRedeemed?: number;
  advanceAllocations?: Array<{ advanceId: string; receiptNumber: string; amount: number; utilizedAt: string }>;
  authCode: string;
  gatewayStatus: 'Success' | 'Declined' | 'Pending Verification';
  receiptUrl?: string;
}

export interface AdvancePayment {
  id: string; // e.g. ADV-2026-001
  receiptNumber: string; // e.g. RCP-ADV-8841
  patientId: string;
  patientName: string;
  patientMrn: string;
  amount: number;
  paymentMethod: PaymentMethod;
  date: string; // YYYY-MM-DD
  time: string;
  purpose:
    | 'Inpatient Bed Admission'
    | 'OT / Surgical Deposit'
    | 'Maternity Package Advance'
    | 'OPD Retainer'
    | 'ICU High-Acuity Deposit'
    | 'General'
    | 'Diagnostic Workup'
    | 'Emergency Deposit';
  remainingBalance: number;
  utilizationHistory?: Array<{ invoiceId: string; transactionId: string; date: string; amount: number }>;
  status: 'Active' | 'Utilized' | 'Partially Utilized' | 'Refunded';
  cashierName: string;
  terminalId?: string;
  notes?: string;
}

export interface RefundPayment {
  id: string; // e.g. REF-2026-001
  voucherNumber: string; // e.g. RFND-VOUCH-102
  patientId: string;
  patientName: string;
  originalReferenceType: 'Invoice Overpayment' | 'Advance Deposit' | 'Service Cancellation' | 'Discharge Clearance';
  originalReferenceId: string;
  amount: number;
  refundMethod: 'Cash' | 'Card Reversal' | 'Bank Transfer' | 'Cheque';
  reason:
    | 'Doctor Unavailable'
    | 'Procedure Cancelled'
    | 'Excess Advance Deposit'
    | 'Duplicate Charge'
    | 'Patient Request'
    | 'Service Cancelled'
    | 'Insurance Overpayment';
  date: string;
  time: string;
  authorizedBy: string;
  cashierName: string;
  status: 'Completed' | 'Pending Approval' | 'Rejected';
  notes?: string;
}

export interface InsuranceApproval {
  id: string; // e.g. APP-2026-001
  patientId: string;
  patientName: string;
  patientMrn: string;
  insuranceProvider: string;
  policyNumber: string;
  approvalNumber: string; // Pre-Authorization Approval Number e.g. AUTH-BUPA-99214
  doctorId: string;
  doctorName: string;
  department: string;
  serviceCategory: 'Procedure' | 'Lab Test' | 'Radiology' | 'Consultation' | 'IPD Admission';
  serviceName: string;
  serviceCode?: string;
  estimatedCost: number;
  approvedAmount: number;
  copayPercentage: number;
  copayAmount: number;
  approvalStatus: 'Approved' | 'Pending' | 'Pending Info' | 'Query Raised' | 'Rejected' | 'Waiver Notification Due' | 'Waiver Notified';
  serviceRecordId?: string;
  encounterTokenId?: string;
  approvalDate: string;
  validUntil: string;
  authorisedBy: string;
  remarks?: string;
  requestType?: 'Elective Outpatient' | 'Elective Inpatient' | 'Emergency';
  eligibilityClassification?: 'Direct Billing' | 'Pre-Authorization Required' | 'Excluded' | 'Pre-Existing' | 'Mapping Review Required';
  emiratesId?: string;
  payerId?: string;
  facilityDhaLicense?: string;
  doctorLicense?: string;
  icd10Code?: string;
  clinicalRationale?: string;
  supportingDocuments?: {
    labReport: boolean;
    imagingReport: boolean;
  };
  requestedAt?: string;
  slaDueAt?: string;
  gatewayStatus?: 'Not Connected' | 'Ready for Manual Submission' | 'Submitted' | 'Response Received';
  emergencyWaiver?: {
    immediateTreatment: boolean;
    postStabilizationNotificationDueAt: string;
    notifiedAt?: string;
  };
  rejectionCode?: string;
  missingFields?: string[];
  appealDraft?: string;
  financialBreakdown?: {
    currency: 'AED';
    requestedAmount: number;
    approvedAmount: number;
    copayPercentage: number;
    copayAmount: number;
    patientPayable: number;
  };
}

export interface PosTransaction {
  id: string; // e.g. POS-TX-2026-0091
  terminalId: string;
  terminalName: string;
  batchNumber: string;
  invoiceId?: string;
  advanceId?: string;
  patientId: string;
  patientName: string;
  cardType: 'Visa' | 'MasterCard' | 'American Express' | 'Apple Pay' | 'Debit' | 'Cash / POS Drawer';
  cardLast4?: string;
  authCode: string;
  rrnNumber: string;
  amount: number;
  status: 'Approved & Settled' | 'Authorized' | 'Voided' | 'Refunded';
  transactionDate: string;
  transactionTime: string;
  cashierName: string;
}

export type TokenWorkflowStage =
  | '1_REGISTRATION'
  | '2_NURSING_VITALS'
  | '3_DOCTOR_EMR'
  | '4_CASHIER_BILLING'
  | '5_DIAGNOSTICS_PROCEDURES'
  | '6_COMPLETED_REPORTS';

export type PaymentSchemeType = 'Insurance' | 'Self-Pay' | 'Discount Card' | 'Corporate' | 'Package';

export interface TokenPaymentScheme {
  schemeType: PaymentSchemeType;
  // Insurance
  insuranceProvider?: string;
  policyNumber?: string;
  network?: string;
  coveragePercent?: number; // e.g. 80
  copayAmount?: number; // e.g. 25
  deductibleAmount?: number;
  serviceCopay?: InsurancePolicy['serviceCopay'];
  preAuthStatus?: 'Approved' | 'Pending' | 'Not Required';
  // Discount Card
  discountCardName?: string; // e.g. "Senior Citizen Card (20%)", "Hospital Employee Staff Card (30%)", "Corporate Partner (15%)"
  discountCardNumber?: string;
  discountPercent?: number;
  corporateName?: string;
  corporateNumber?: string;
  packageName?: string;
  packageNumber?: string;
  notes?: string;
}

export interface TokenVitalsRecord {
  bpSystolic: number;
  bpDiastolic: number;
  heartRate: number;
  spO2: number;
  temperature: number;
  respiratoryRate: number;
  bloodGlucose?: number;
  painScale?: number;
  triageLevel: 'Level 1 - Resuscitation' | 'Level 2 - Emergent' | 'Level 3 - Urgent' | 'Level 4 - Less Urgent' | 'Level 5 - Non-Urgent';
  nursingNotes?: string;
  nurseName: string;
  recordedAt: string;
}

export interface TokenDoctorOrder {
  healthSummary?: string;
  chiefComplaint?: string;
  clinicalAssessment?: string;
  diagnoses: Array<{ code: string; description: string; notes?: string }>;
  labRequests: Array<{ id: string; testName: string; category: string; cptCode?: string; price: number; status: 'Ordered' | 'Sample Collected' | 'Completed' }>;
  radiologyRequests: Array<{ id: string; studyName: string; modality: string; cptCode?: string; price: number; status: 'Ordered' | 'In Progress' | 'Completed' }>;
  procedureRequests: Array<{ id: string; cptCode: string; procedureName: string; price: number; status: 'Scheduled' | 'Completed' }>;
  medicationRequests?: Array<{ id: string; sku: string; medicationName: string; quantity: number; unitPrice: number; price: number }>;
  consultationFee: number;
  doctorNotes?: string;
  orderedByDoctorId: string;
  orderedByDoctorName: string;
  orderedAt: string;
}

export interface TokenBillingSummary {
  invoiceId?: string;
  invoiceNumber?: string;
  subtotal: number;
  items?: BillItem[];
  schemeType: PaymentSchemeType;
  insuranceCoveredAmount: number;
  discountAmount: number;
  copayOrSelfPayAmount: number;
  copayAmount?: number;
  deductibleAmount?: number;
  totalPaid: number;
  balanceDue: number;
  paymentMethod: 'Cash' | 'Credit/Debit Card' | 'HSA/FSA' | 'Direct Insurance' | 'Online Gateway';
  paymentStatus: 'Paid' | 'Pending' | 'Waived';
  receiptNumber?: string;
  cashierName: string;
  billedAt: string;
  insuranceAuthorizationStatus?: 'Required' | 'Approved' | 'Not Required';
  dailyInsuranceLimitApplied?: boolean;
  dailyInsuranceLimitAed?: number;
  dailyInsuranceUsedBeforeAed?: number;
  dailyInsuranceUsedAfterAed?: number;
}

export interface TokenServiceItem {
  id: string;
  name: string;
  category: 'Test' | 'Procedure' | 'Technician Service';
  price: number;
  addedBy: string;
  addedAt: string;
}

export interface TokenDiagnosticReport {
  id: string;
  testOrStudyName: string;
  department: 'Laboratory' | 'Radiology' | 'Cardiology / Procedures';
  category?: string;
  cptOrCode?: string;
  date: string;
  time?: string;
  findings: string;
  impression?: string;
  resultValue?: string;
  referenceRange?: string;
  status: 'Normal' | 'Elevated' | 'Critical' | 'Completed';
  technicianOrRadiologist: string;
  completedAt: string;
  sentToPatient: boolean;
  sentToDoctor: boolean;
  sentTimestamp?: string;
  reportPdfUrl?: string;
}

export interface EncounterDocumentAttachment {
  id: string;
  fileName: string;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  dataUrl: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ReceptionToken {
  id: string; // e.g. TOK-101
  tokenNumber: string; // e.g. "T-101"
  patientId: string;
  patientName: string;
  patientPhone?: string;
  doctorId?: string;
  doctorName?: string;
  department: string;
  serviceType: 'Consultation' | 'Billing & Cashier' | 'Insurance Authorisation' | 'Lab Sample' | 'Report Collection' | 'Physio Technician';
  priority: 'Normal' | 'Urgent' | 'VIP / Elderly';
  status: 'Waiting' | 'In Consultation' | 'Completed' | 'Cancelled';
  createdDate?: string;
  createdTime: string;
  estimatedWaitMins: number;
  calledAt?: string;
  completedAt?: string;
  counterOrRoom: string;
  // Patient visit metadata for doctor / nurse / lab / cashier visibility
  visitType?: 'Consultation' | 'Walk-in' | 'Follow-up' | 'Emergency' | 'Lab Review' | 'Billing' | 'Technician';
  visitCode?: 'C' | 'NC' | 'TEC';
  registeredBy?: string;
  visitPurpose?: string;
  visitComplaint?: string;
  registrationSource?: 'New Registration' | 'Existing Patient' | 'Walk-in' | 'Appointment';
  patientAge?: number;
  patientGender?: string;
  patientDetails?: {
    registrationNumber?: string;
    title?: string;
    middleName?: string;
    dateOfBirth?: string;
    nationality?: string;
    maritalStatus?: string;
    bloodGroup?: BloodGroup;
    email?: string;
    address?: string;
    nationalId?: string;
    passportNumber?: string;
    allergies?: Patient['allergies'];
    chronicConditions?: string[];
    emergencyContact?: Patient['emergencyContact'];
    consentSigned?: boolean;
    consentTimestamp?: string;
    consentSignature?: string;
    consentSignerRole?: Patient['consentSignerRole'];
    consentSignerRelationship?: string;
    insurancePolicyNumber?: string;
    insuranceMemberId?: string;
    insuranceProvider?: string;
    insuranceTpa?: string;
    insuranceRegulator?: InsurancePolicy['regulator'];
    insuranceNetwork?: string;
    insurancePlanName?: string;
    insuranceCardNumber?: string;
    insuranceCertificateNumber?: string;
    insuranceDependentNumber?: string;
    insuranceClaimFormNo?: string;
    insurancePreAuthorizationRequired?: boolean;
    insurancePreExistingWaitingPeriod?: string;
    insuranceVerificationReference?: string;
    insuranceDailyClinicLimitAed?: number;
    insuranceStatus?: InsurancePolicy['status'];
    insuranceExpiryDate?: string;
    insuranceCards?: DetailedInsuranceRecord[];
  };
  insuranceProvider?: string;
  payMode?: 'Self' | 'Insurance' | 'Discount Card' | 'Company';
  visitDate?: string;
  patientVisitSummary?: string;
  appointmentId?: string;
  bookingChannel?: 'Clinic' | 'Call Center' | 'Application';
  // 6-Step Workflow Tracking
  currentStage?: TokenWorkflowStage;
  paymentScheme?: TokenPaymentScheme;
  vitals?: TokenVitalsRecord;
  serviceItems?: TokenServiceItem[];
  pendingServiceIds?: string[];
  doctorOrders?: TokenDoctorOrder;
  serviceBillingStates?: EncounterServiceBillingState[];
  billingSummary?: TokenBillingSummary;
  diagnosticReports?: TokenDiagnosticReport[];
  visitDocuments?: EncounterDocumentAttachment[];
  historyLogs?: Array<{ stage: TokenWorkflowStage; timestamp: string; action: string; actor: string }>;
}

export interface Invoice {
  id: string; // INV-2026-0081
  patientId: string;
  patientName: string;
  encounterType?: 'OPD' | 'IPD';
  patientPhone: string;
  patientEmail: string;
  appointmentId?: string;
  encounterTokenId?: string;
  insuranceProvider?: string;
  diagnoses?: Array<{ code: string; description: string; doctorName: string; orderedAt: string }>;
  issueDate: string;
  invoiceTime?: string; // e.g. "10:15:30 AM"
  createdAt?: string; // ISO timestamp string
  dueDate: string;
  items: BillItem[];
  deferredItems?: BillItem[];
  subtotal: number;
  tax: number;
  totalAmount?: number;
  discountAmount?: number;
  paidAmount?: number;
  refundedAmount?: number;
  insuranceCoveredAmount: number;
  insuranceCovered?: number;
  copayAmount: number;
  deductibleAmount?: number;
  patientPayable: number;
  amountPaid: number;
  balanceDue: number;
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  transactions: PaymentTransaction[];
  notes?: string;
  dueRecordedAt?: string;
  dueRecordedBy?: string;
  dueRemarks?: string;
  insuranceClaimNumber?: string;
}

export interface WardBed {
  id: string;
  wardName: string; // ICU, General Ward A, Cardiology Unit, Pediatric Wing
  bedNumber: string;
  roomNumber?: string;
  roomType?: string;
  status: 'Available' | 'Occupied' | 'Maintenance' | 'Reserved';
  patientId?: string;
  patientName?: string;
  assignedDoctor?: string;
  admissionDate?: string;
}

export interface LiveNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'critical';
  timestamp: string;
  read: boolean;
  relatedEntityId?: string;
  recipientUserId?: string;
  recipientUserName?: string;
}

export type UserRole =
  | 'admin'
  | 'doctor'
  | 'nurse'
  | 'physiotherapist'
  | 'receptionist'
  | 'pharmacist'
  | 'lab'
  | 'radiology'
  | 'medical-coder';

export interface RolePermissions {
  canRegisterPatients: boolean;
  canEditEMR: boolean;
  canPrescribeMeds: boolean;
  canDispenseMeds: boolean;
  canRunLabTests: boolean;
  canReviewRadiology: boolean;
  canManageBilling: boolean;
  canAccessAuditLogs: boolean;
}

export interface RoleDefinition {
  role: UserRole;
  label: string;
  description: string;
  permissions: RolePermissions;
}

export type DepartmentPortal = 'outpatient' | 'inpatient' | 'overview';

export interface StaffMember {
  id: string;
  isActive?: boolean;
  name: string;
  role: UserRole;
  department: string;
  shift: 'Morning (07:00 - 15:00)' | 'Evening (15:00 - 23:00)' | 'Night (23:00 - 07:00)' | 'On-Call';
  phone: string;
  email: string;
  roomOrStation: string;
  licenseNumber: string;
  status: 'On Duty' | 'In Consultation' | 'In Surgery' | 'On Break' | 'Off Duty';
}

export interface PharmacyItem {
  id: string;
  sku: string;
  code?: string;
  name: string;
  genericName: string;
  category: 'Antibiotics' | 'Cardiovascular' | 'Analgesics' | 'Respiratory' | 'Endocrine' | 'Emergency IV' | string;
  dosageForm: 'Tablet' | 'Capsule' | 'Injection IV' | 'Syrup' | 'Inhaler';
  dosage?: string;
  form?: string;
  stockQuantity: number;
  minThreshold: number;
  unitPrice: number;
  batchNumber: string;
  expiryDate: string;
  storageCondition: 'Room Temp (20-25 C)' | 'Refrigerated (2-8 C)' | 'Controlled Substance Vault';
  manufacturer: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: UserRole;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'DISPENSE' | 'AUTHENTICATE' | 'CLAIM_EXPORT' | 'BACKUP_EXPORT';
  resourceType: 'Patient Record' | 'Prescription' | 'Billing Invoice' | 'Lab Result' | 'Appointment' | 'Security Settings';
  resourceId: string;
  targetEntity?: string;
  targetId?: string;
  details: string;
  ipAddress?: string;
  complianceFlag?: 'HIPAA Access Log' | 'GDPR Data Processing' | 'PCI-DSS Payment Log';
}

export interface DatabaseBackupMetadata {
  exportTimestamp: string;
  hospitalName: string;
  systemVersion: string;
  recordCounts: {
    patients: number;
    doctors: number;
    appointments: number;
    invoices: number;
    wardBeds: number;
    staff: number;
    pharmacy: number;
    auditLogs: number;
  };
  checksum: string;
}

export interface SystemCompliance {
  hipaaAuditLogEnabled: boolean;
  aes256EncryptionAtRest: boolean;
  hl7FhirInteropEnabled: boolean;
  roleBasedAccessActive: boolean;
  gdprConsentTracking: boolean;
  offlineSyncCache: boolean;
  sessionTimeoutMinutes: number;
  backupFrequencyHours: number;
}

export type AppTheme = 'clinical' | 'ocean' | 'indigo' | 'dark' | 'emerald' | 'cyan' | 'slate';

export type CertificateType =
  | 'Sick Leave Attestation'
  | 'Fitness to Return to Work'
  | 'Medical Exemption'
  | 'Inpatient Admission Attestation'
  | 'School Absence Certificate';

export interface MedicalCertificate {
  id: string; // e.g. MC-2026-001
  certificateNumber: string; // e.g. DHA-MC-90812
  patientId: string;
  patientName: string;
  patientMrn: string;
  patientDob: string;
  patientGender: string;
  patientPhone?: string;
  certificateType: CertificateType;
  diagnosisCode: string; // ICD-10
  diagnosisDescription: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  durationDays: number;
  workRestrictions: string[];
  clinicalNotes: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorLicense: string;
  hospitalStampRef: string;
  issueDate: string;
  status: 'Active' | 'Revoked' | 'Expired';
}

export type OperatingRoom =
  | 'OR 1 - Cardiothoracic Suite'
  | 'OR 2 - Orthopedic & Trauma'
  | 'OR 3 - General & Laparoscopy'
  | 'OR 4 - Day Surgery & Endoscopy';

export type SurgicalStatus =
  | 'Scheduled'
  | 'Pre-Op Checklist'
  | 'In OR / Surgery'
  | 'Recovery PACU'
  | 'Discharged to Ward'
  | 'Postponed';

export interface SurgicalCase {
  id: string; // SURG-2026-001
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  bloodGroup: BloodGroup;
  operatingRoom: OperatingRoom;
  procedureName: string;
  cptCode: string;
  leadSurgeonId: string;
  leadSurgeonName: string;
  anesthesiologistName: string;
  anesthesiaType: 'General Anesthesia' | 'Spinal / Epidural' | 'Regional Block' | 'MAC / Conscious Sedation' | 'Local Anesthesia';
  scrubNurseName: string;
  scheduledDate: string;
  startTime: string;
  estimatedDurationMins: number;
  priority: 'Elective' | 'Urgent' | 'Emergency STAT';
  status: SurgicalStatus;
  preOpChecklist: {
    npoConfirmed: boolean;
    consentSigned: boolean;
    bloodUnitsReserved: number;
    surgicalSiteMarked: boolean;
    anesthesiaCleared: boolean;
    allergiesReviewed: boolean;
  };
  whoSafetyChecklist: {
    signInCompleted: boolean;
    timeOutCompleted: boolean;
    signOutCompleted: boolean;
    spongeInstrumentCountVerified: boolean;
    specimenLabeled: boolean;
  };
  surgicalNotes?: string;
  pacuDischargeVitals?: {
    bp: string;
    pulse: number;
    spo2: number;
    aldreteScore: number; // 0-10
  };
}

export type BloodComponent =
  | 'Packed Red Blood Cells (PRBC)'
  | 'Fresh Frozen Plasma (FFP)'
  | 'Platelet Concentrate (RDP)'
  | 'Cryoprecipitate';

export interface BloodUnit {
  unitId: string; // e.g. BLD-2026-A01
  bloodGroup: BloodGroup;
  component: BloodComponent;
  volumeMl: number;
  collectionDate: string;
  expiryDate: string;
  storageLocation: string;
  status: 'Available' | 'Reserved' | 'Crossmatched' | 'Transfused' | 'Quarantine';
  reservedForPatientId?: string;
  reservedForPatientName?: string;
  donorId: string;
}

export interface PharmacyDispenseRecord {
  id: string; // e.g. DISP-2026-001
  prescriptionId: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  medicationName: string;
  sku: string;
  dosage: string;
  quantityDispensed: number;
  unitPrice: number;
  totalCost: number;
  dispensedBy: string;
  dispensedAt: string;
  batchNumber: string;
  instructions: string;
  allergyScreeningStatus: 'Cleared' | 'Warning Overridden' | 'No Known Allergies';
  warningNote?: string;
}

export interface BedTransferRecord {
  id: string;
  patientId: string;
  patientName: string;
  fromBedId: string;
  fromBedNumber: string;
  fromWard: string;
  toBedId: string;
  toBedNumber: string;
  toWard: string;
  transferReason: string;
  transferDate: string;
  transferTime: string;
  attendingDoctor: string;
  transferredBy: string;
  clinicalHandoverNotes?: string;
}
