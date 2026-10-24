import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Patient,
  Doctor,
  Appointment,
  Invoice,
  BillItem,
  WardBed,
  LiveNotification,
  AppointmentStatus,
  Vitals,
  Medication,
  ClinicalNote,
  LabResult,
  PaymentTransaction,
  PaymentMethod,
  UserRole,
  StaffMember,
  DepartmentPortal,
  PharmacyItem,
  AuditLog,
  SystemCompliance,
  AppTheme,
  TriageAssessment,
  RoleDefinition,
  FacilityVisit,
  AdvancePayment,
  RefundPayment,
  InsuranceApproval,
  InsuranceGatewayLineItemResponse,
  PosTransaction,
  ReceptionToken,
  TokenWorkflowStage,
  TokenPaymentScheme,
  TokenVitalsRecord,
  TokenDoctorOrder,
  TokenBillingSummary,
  TokenDiagnosticReport,
  TokenServiceItem,
  TokenLineItem,
  EncounterDocumentAttachment,
  DoctorDutyChangeRequest,
  DoctorDutySchedule,
  StaffDutySchedule,
  HospitalPriceItem,
  MedicalCertificate,
  SurgicalCase,
  SurgicalStatus,
  BloodUnit,
  PharmacyDispenseRecord,
  BedTransferRecord,
} from '../types';
import { getPatientPhoto } from '../utils/patientImages';
import { parseInsuranceDeductible, sumInvoiceItemField } from '../utils/insuranceInvoice';
import { initialHospitalPriceCatalog } from '../data/hospitalPriceCatalog';
import { getTabInfo } from '../utils/workspaceTabs';
import { supabaseClient } from '../lib/supabase';
import {
  aggregateTokenLineItemBilling,
  appendTokenLineItems,
  canDispenseMedicationLineItem,
  canExecuteDiagnosticLineItem,
  createDoctorOrderLineItems,
  createServiceLineItems,
  getEffectiveLineItemStatus,
  isSelfPayToken,
  getTokenLineItemBillingBreakdown,
} from '../utils/tokenStateMachine';
import {
  classifyInsuranceEligibility,
  createInsuranceAppealDraft,
  extractRejectionCode,
  getRejectionMissingFields,
  loadInsuranceCodeMappings,
  validateInsuranceRequestPayload,
} from '../utils/insuranceAuthorization';
import {
  initialPatients,
  initialDoctors,
  initialAppointments,
  initialInvoices,
  initialWardBeds,
  initialStaff,
  initialPharmacy,
  initialAuditLogs,
  initialCompliance,
  initialAdvancePayments,
  initialRefundPayments,
  initialInsuranceApprovals,
  initialPosTransactions,
  initialReceptionTokens,
  initialMedicalCertificates,
  initialSurgicalCases,
  initialBloodUnits,
  initialPharmacyDispenseRecords,
  initialBedTransfers,
} from '../mockData';

export type NavigationTab =
  | 'overview'
  | 'registration'
  | 'medical-records'
  | 'patients'
  | 'enquiry'
  | 'inpatient'
  | 'outpatient'
  | 'triage'
  | 'appointments'
  | 'doctor-rota'
  | 'billing'
  | 'billing-dues'
  | 'billing-advance'
  | 'billing-refunds'
  | 'billing-pos'
  | 'insurance-approvals'
  | 'pharmacy'
  | 'lab-orders'
  | 'labs'
  | 'lab'
  | 'radiology'
  | 'wards'
  | 'ot-schedule'
  | 'blood-bank'
  | 'certificates'
  | 'pricelist'
  | 'tariffs'
  | 'telehealth'
  | 'compliance'
  | 'staff'
  | 'coder'
  | 'reports'
  | 'admin';

export interface WorkspaceTab {
  id: string;
  tabKey: NavigationTab;
  title: string;
  closable: boolean;
}

export type RegistrationMode = 'new' | 'existing' | 'appointment' | 'edit';

export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  admin: {
    role: 'admin',
    label: 'Hospital Administrator',
    description: 'Full supervisory authority across clinical, financial, and compliance modules.',
    permissions: {
      canRegisterPatients: true,
      canEditEMR: true,
      canPrescribeMeds: true,
      canDispenseMeds: true,
      canRunLabTests: true,
      canReviewRadiology: true,
      canManageBilling: true,
      canAccessAuditLogs: true,
    },
  },
  doctor: {
    role: 'doctor',
    label: 'Attending Physician',
    description: 'Diagnose patients, write clinical notes, prescribe meds, review diagnostics.',
    permissions: {
      canRegisterPatients: true,
      canEditEMR: true,
      canPrescribeMeds: true,
      canDispenseMeds: false,
      canRunLabTests: true,
      canReviewRadiology: true,
      canManageBilling: false,
      canAccessAuditLogs: false,
    },
  },
  physiotherapist: {
    role: 'physiotherapist',
    label: 'Physiotherapist',
    description: 'Provide rehabilitation and physical therapy services.',
    permissions: {
      canRegisterPatients: false,
      canEditEMR: false,
      canPrescribeMeds: false,
      canDispenseMeds: false,
      canRunLabTests: false,
      canReviewRadiology: false,
      canManageBilling: false,
      canAccessAuditLogs: false,
    },
  },
  nurse: {
    role: 'nurse',
    label: 'Registered Nurse',
    description: 'Record vitals, administer medications, manage ward bed allocations.',
    permissions: {
      canRegisterPatients: true,
      canEditEMR: true,
      canPrescribeMeds: false,
      canDispenseMeds: true,
      canRunLabTests: true,
      canReviewRadiology: true,
      canManageBilling: false,
      canAccessAuditLogs: false,
    },
  },
  pharmacist: {
    role: 'pharmacist',
    label: 'Clinical Pharmacist',
    description: 'Formulary inventory management, dispense meds, safety screening.',
    permissions: {
      canRegisterPatients: false,
      canEditEMR: false,
      canPrescribeMeds: false,
      canDispenseMeds: true,
      canRunLabTests: false,
      canReviewRadiology: false,
      canManageBilling: true,
      canAccessAuditLogs: false,
    },
  },
  receptionist: {
    role: 'receptionist',
    label: 'Patient Registrar',
    description: 'Patient check-in, schedule appointments, queue triage, invoicing.',
    permissions: {
      canRegisterPatients: true,
      canEditEMR: false,
      canPrescribeMeds: false,
      canDispenseMeds: false,
      canRunLabTests: false,
      canReviewRadiology: false,
      canManageBilling: true,
      canAccessAuditLogs: false,
    },
  },
  lab: {
    role: 'lab',
    label: 'Lab Technologist',
    description: 'Pathology specimen processing, biochemistry assays, critical flag verification.',
    permissions: {
      canRegisterPatients: false,
      canEditEMR: false,
      canPrescribeMeds: false,
      canDispenseMeds: false,
      canRunLabTests: true,
      canReviewRadiology: false,
      canManageBilling: false,
      canAccessAuditLogs: false,
    },
  },
  radiology: {
    role: 'radiology',
    label: 'Diagnostic Radiologist',
    description: 'DICOM imaging reviews, PACS modality triage, radiologic diagnostic reports.',
    permissions: {
      canRegisterPatients: false,
      canEditEMR: true,
      canPrescribeMeds: false,
      canDispenseMeds: false,
      canRunLabTests: false,
      canReviewRadiology: true,
      canManageBilling: false,
      canAccessAuditLogs: false,
    },
  },
  'medical-coder': {
    role: 'medical-coder',
    label: 'Medical Coder',
    description: 'Review insurance pre-authorizations and publish approved diagnostic reports to patient records.',
    permissions: {
      canRegisterPatients: false,
      canEditEMR: false,
      canPrescribeMeds: false,
      canDispenseMeds: false,
      canRunLabTests: false,
      canReviewRadiology: false,
      canManageBilling: false,
      canAccessAuditLogs: false,
    },
  },
};

interface HospitalContextType {
  patients: Patient[];
  doctors: Doctor[];
  doctorDutySchedules: DoctorDutySchedule[];
  staffDutySchedules: StaffDutySchedule[];
  doctorDutyChangeRequests: DoctorDutyChangeRequest[];
  appointments: Appointment[];
  invoices: Invoice[];
  advancePayments: AdvancePayment[];
  refundPayments: RefundPayment[];
  insuranceApprovals: InsuranceApproval[];
  posTransactions: PosTransaction[];
  receptionTokens: ReceptionToken[];
  wardBeds: WardBed[];
  staff: StaffMember[];
  pharmacy: PharmacyItem[];
  medicalCertificates: MedicalCertificate[];
  surgicalCases: SurgicalCase[];
  bloodUnits: BloodUnit[];
  pharmacyDispenseRecords: PharmacyDispenseRecord[];
  bedTransfers: BedTransferRecord[];
  hospitalPriceCatalog: HospitalPriceItem[];
  saveHospitalPriceItem: (item: HospitalPriceItem) => void;
  deactivateHospitalPriceItem: (itemId: string) => void;
  auditLogs: AuditLog[];
  compliance: SystemCompliance;
  notifications: LiveNotification[];
  selectedPatient: Patient | null;
  selectedPatientId: string | null;
  activeTab: NavigationTab;
  openTabs: WorkspaceTab[];
  closeWorkspaceTab: (tabId: string) => void;
  closeOtherWorkspaceTabs: (tabId: string) => void;
  closeAllWorkspaceTabs: () => void;
  openWorkspaceTab: (tabKey: NavigationTab, title?: string) => void;
  registrationMode: RegistrationMode;
  currentRole: UserRole;
  currentUser: StaffMember;
  currentRoleDefinition: RoleDefinition;
  isAuthenticated: boolean;
  authenticatedUser: StaffMember | null;
  departmentPortal: DepartmentPortal | null;
  appTheme: AppTheme;
  setAppTheme: (theme: AppTheme) => void;
  showPortalSelect: boolean;
  setShowPortalSelect: (show: boolean) => void;
  login: (userId: string, password?: string) => { success: boolean; message?: string };
  logout: () => void;
  selectDepartmentPortal: (portal: DepartmentPortal) => void;
  setCurrentRole: (role: UserRole) => void;
  setCurrentUserId: (id: string) => void;
  setActiveTab: (tab: NavigationTab) => void;
  setRegistrationMode: (mode: RegistrationMode) => void;
  setSelectedPatientId: (id: string | null) => void;
  // Patient Actions
  addPatient: (patientData: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'vitals' | 'medications' | 'labResults' | 'clinicalNotes'>, registrationType?: 'Consultation' | 'Non-Consultation' | 'Technician') => { patient: Patient; token: ReceptionToken };
  updatePatient: (id: string, updates: Partial<Patient>) => void;
  updatePatientStatus: (id: string, status: Patient['status']) => void;
  addVitals: (patientId: string, vitals: Omit<Vitals, 'recordedAt'>) => void;
  addTriageAssessment: (patientId: string, assessment: Omit<TriageAssessment, 'id' | 'assessedAt'>) => TriageAssessment;
  recordTriageAssessment: (patientId: string, assessment: any) => TriageAssessment;
  addMedication: (patientId: string, medication: Omit<Medication, 'id'>) => Medication;
  addPrescription: (patientId: string, prescription: any) => void;
  addClinicalNote: (patientId: string, note: Omit<ClinicalNote, 'id' | 'date'>) => void;
  addLabResult: (patientId: string, lab: Omit<LabResult, 'id'>) => void;
  updateLabResult: (patientId: string, labId: string, updates: Partial<LabResult>) => void;
  dischargePatient: (patientId: string) => void;
  // Appointment Actions
  bookAppointment: (aptData: Omit<Appointment, 'id' | 'queueNumber' | 'createdAt'>) => Appointment;
  addAppointment: (aptData: any) => Appointment;
  updateAppointmentStatus: (aptId: string, status: AppointmentStatus, cancellation?: { reason: string; details?: string }) => void;
  callNextAppointment: (doctorId?: string) => void;
  // Billing Actions
  createInvoice: (invData: Omit<Invoice, 'id' | 'subtotal' | 'patientPayable' | 'amountPaid' | 'balanceDue' | 'transactions'>) => Invoice | null;
  issueInvoice: (invoiceId: string) => void;
  processPayment: (invoiceId: string, paymentData: { amount: number; method: PaymentMethod; cardLast4?: string }) => Promise<{ success: boolean; transaction: PaymentTransaction }>;
  processSplitPayments: (
    invoiceId: string,
    payments: Array<{ amount: number; method: PaymentMethod; pointsAuthorizationToken?: string; advanceId?: string }>,
    settlementDate?: string
  ) => Promise<PaymentTransaction[]>;
  addAdvancePayment: (data: Omit<AdvancePayment, 'id' | 'receiptNumber'>) => AdvancePayment;
  addRefundPayment: (data: Omit<RefundPayment, 'id' | 'voucherNumber'>) => RefundPayment;
  reviewRefundPayment: (id: string, decision: 'Approved' | 'Rejected') => void;
  addInsuranceApproval: (data: Omit<InsuranceApproval, 'id'>) => InsuranceApproval | null;
  addCoderInsuranceApproval: (data: Omit<InsuranceApproval, 'id'>) => InsuranceApproval | null;
  updateInsuranceApprovalStatus: (id: string, status: Exclude<InsuranceApproval['approvalStatus'], 'Approved' | 'Pending'>, remarks?: string) => void;
  recordEmergencyStabilization: (id: string, stabilizedAt: string) => boolean;
  saveInsuranceAppealDraft: (id: string, appealDraft: string) => boolean;
  publishInsuranceApproval: (id: string, details: Pick<InsuranceApproval, 'approvalNumber' | 'approvedAmount' | 'copayPercentage' | 'validUntil'>) => boolean;
  recordInsuranceGatewayResponse: (id: string, response: InsuranceGatewayLineItemResponse) => boolean;
  addPosTransaction: (data: Omit<PosTransaction, 'id' | 'rrnNumber'>) => PosTransaction;
  createReceptionToken: (data: Omit<ReceptionToken, 'id' | 'tokenNumber' | 'createdTime'>) => ReceptionToken;
  updateReceptionTokenStatus: (id: string, status: ReceptionToken['status']) => void;
  advanceTokenWorkflow: (tokenId: string, nextStage: TokenWorkflowStage, updates?: Partial<ReceptionToken>) => void;
  updateTokenVitals: (tokenId: string, vitals: TokenVitalsRecord, serviceItems?: TokenServiceItem[]) => void;
  updateTokenDoctorOrders: (tokenId: string, orders: TokenDoctorOrder) => void;
  recordTokenLineItemInsuranceResponse: (
    tokenId: string,
    lineItemId: string,
    response: InsuranceGatewayLineItemResponse
  ) => boolean;
  submitTokenLineItemAppeal: (tokenId: string, lineItemId: string, reason: string) => boolean;
  addTokenLineItem: (
    tokenId: string,
    item: Omit<TokenLineItem, 'insuranceStatus' | 'insuranceApprovalId' | 'insuranceApprovedAmount' | 'copayAmount' | 'paymentOverride' | 'fulfillmentStatus'>
  ) => boolean;
  overrideTokenLineItemToSelfPay: (tokenId: string, lineItemId: string, reason: string) => boolean;
  settleTokenBilling: (tokenId: string, billing: TokenBillingSummary) => void;
  completeTokenDiagnosticReport: (tokenId: string, report: TokenDiagnosticReport) => void;
  updateLabOrderStatus: (
    tokenId: string,
    requestId: string,
    status: 'Ordered' | 'Sample Collected' | 'Completed',
    notes?: string
  ) => void;
  recordLabTestResult: (
    tokenId: string,
    requestId: string,
    resultData: {
      testName: string;
      category?: string;
      value: string;
      referenceRange?: string;
      status: 'Normal' | 'Elevated' | 'Critical';
      findings?: string;
      notes?: string;
      technicianName?: string;
    }
  ) => void;
  addEncounterDocument: (tokenId: string, document: Pick<EncounterDocumentAttachment, 'fileName' | 'mimeType' | 'dataUrl'>) => boolean;
  // Ward Actions
  assignBedToPatient: (bedId: string, patientId: string) => void;
  releaseBed: (bedId: string) => void;
  updateBedStatus: (bedId: string, status: WardBed['status']) => void;
  transferPatientBed: (patientId: string, toBedId: string, reason: string, handoverNotes?: string) => boolean;
  admitPatientToBed: (patientId: string, bedId: string, doctorName?: string) => boolean;
  // Staff Actions
  addStaff: (member: Omit<StaffMember, 'id' | 'isActive'>) => StaffMember | null;
  deactivateStaff: (id: string) => boolean;
  updateStaff: (id: string, updates: Partial<StaffMember>) => void;
  setDoctorDutySchedule: (data: Omit<DoctorDutySchedule, 'id' | 'updatedAt' | 'updatedBy'>) => boolean;
  setStaffDutySchedule: (data: Omit<StaffDutySchedule, 'id' | 'updatedAt' | 'updatedBy'>) => boolean;
  submitDoctorDutyChangeRequest: (
    doctorId: string,
    updates: { availableDays: string[]; availableHours: string; reason: string }
  ) => DoctorDutyChangeRequest | null;
  reviewDoctorDutyChangeRequest: (requestId: string, decision: 'Approved' | 'Rejected') => void;
  // Pharmacy Actions
  dispensePharmacyItem: (itemId: string, quantity: number, patientId: string) => void;
  dispenseMedication: (itemId: string, quantity: number, patientId?: string) => void;
  restockPharmacyItem: (itemId: string, quantity: number) => void;
  restockMedication: (itemId: string, quantity: number) => void;
  addPharmacyItem: (item: Omit<PharmacyItem, 'id'>) => void;
  dispensePrescriptionOrder: (
    prescriptionId: string,
    patientId: string,
    quantity: number,
    pharmacistName: string,
    overrideWarning?: boolean,
    encounterTokenId?: string
  ) => { success: boolean; error?: string; record?: PharmacyDispenseRecord };
  // Medical Certificates
  issueMedicalCertificate: (data: Omit<MedicalCertificate, 'id' | 'certificateNumber' | 'issueDate' | 'status'>) => MedicalCertificate;
  revokeMedicalCertificate: (id: string, reason?: string) => void;
  // Surgical & OT Cases
  addSurgicalCase: (data: Omit<SurgicalCase, 'id'>) => SurgicalCase;
  updateSurgicalStatus: (id: string, status: SurgicalStatus, updates?: Partial<SurgicalCase>) => void;
  updateWhoChecklist: (id: string, checklist: Partial<SurgicalCase['whoSafetyChecklist']>) => void;
  // Blood Bank
  reserveBloodUnit: (unitId: string, patientId: string, patientName: string) => boolean;
  releaseBloodUnit: (unitId: string) => boolean;
  addBloodUnit: (data: Omit<BloodUnit, 'unitId'>) => BloodUnit;
  // Compliance & Audit
  logAuditEvent: (
    action: AuditLog['action'],
    resourceType: AuditLog['resourceType'],
    resourceId: string,
    details: string,
    complianceFlag?: AuditLog['complianceFlag']
  ) => void;
  updateCompliance: (updates: Partial<SystemCompliance>) => void;
  // Notifications
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;
  addNotification: (
    titleOrObj: string | { title: string; message: string; type?: LiveNotification['type']; relatedEntityId?: string; recipient?: { userId?: string; userName?: string } },
    message?: string,
    type?: LiveNotification['type'],
    relatedEntityId?: string,
    recipient?: { userId?: string; userName?: string }
  ) => void;
  // Database Backup Utility
  lastBackupTimestamp: number | null;
  backupReminderSnoozedUntil: number | null;
  isBackupOverdue: boolean;
  showBackupReminderModal: boolean;
  setShowBackupReminderModal: (show: boolean) => void;
  performDatabaseBackup: (format?: 'json' | 'csv') => { success: boolean; filename: string; recordCounts: Record<string, number> };
  snoozeBackupReminder: (hours?: number) => void;
  dismissBackupReminder: () => void;
  triggerTestBackupReminder: () => void;
  // Utilities
  resetHospitalData: () => void;
}

const HospitalContext = createContext<HospitalContextType | undefined>(undefined);
const sharedClinicId = import.meta.env.VITE_HMS_CLINIC_ID as string | undefined;

const STORAGE_KEYS = {
  PATIENTS: 'medcore_patients_v3',
  DOCTORS: 'medcore_doctors_v3',
  DOCTOR_DUTY_SCHEDULES: 'medcore_doctor_duty_schedules_v1',
  STAFF_DUTY_SCHEDULES: 'medcore_staff_duty_schedules_v1',
  DOCTOR_DUTY_CHANGE_REQUESTS: 'medcore_doctor_duty_change_requests_v1',
  APPOINTMENTS: 'medcore_appointments_v3',
  INVOICES: 'medcore_invoices_v3',
  ADVANCE_PAYMENTS: 'medcore_advance_payments_v1',
  REFUND_PAYMENTS: 'medcore_refund_payments_v1',
  INSURANCE_APPROVALS: 'medcore_insurance_approvals_v1',
  POS_TRANSACTIONS: 'medcore_pos_transactions_v1',
  RECEPTION_TOKENS: 'medcore_reception_tokens_v1',
  WARD_BEDS: 'medcore_ward_beds_v3',
  STAFF: 'medcore_staff_v3',
  PHARMACY: 'medcore_pharmacy_v3',
  HOSPITAL_PRICE_CATALOG: 'medcore_hospital_price_catalog_v1',
  AUDIT_LOGS: 'medcore_audit_logs_v3',
  COMPLIANCE: 'medcore_compliance_v3',
  NOTIFICATIONS: 'medcore_notifications_v3',
  ROLE: 'medcore_current_role_v3',
  IS_AUTHENTICATED: 'medcore_is_authenticated_v3',
  AUTH_USER_ID: 'medcore_auth_user_id_v3',
  DEPARTMENT_PORTAL: 'medcore_department_portal_v3',
  APP_THEME: 'medcore_app_theme_v3',
  LAST_BACKUP_TIMESTAMP: 'medcore_last_backup_timestamp_v3',
  BACKUP_SNOOZE_TIMESTAMP: 'medcore_backup_snooze_timestamp_v3',
  MEDICAL_CERTIFICATES: 'medcore_medical_certificates_v1',
  SURGICAL_CASES: 'medcore_surgical_cases_v1',
  BLOOD_UNITS: 'medcore_blood_units_v1',
  PHARMACY_DISPENSES: 'medcore_pharmacy_dispenses_v1',
  BED_TRANSFERS: 'medcore_bed_transfers_v1',
  WORKSPACE_TABS: 'medcore_workspace_tabs_v1',
};

export const HospitalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tokenSyncReady = useRef(false);
  const dirtyTokenIds = useRef(new Set<string>());
  const [patients, setPatients] = useState<Patient[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PATIENTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Patient[];
        return parsed.map((p) => ({
          ...p,
          rgNo: p.rgNo || p.id,
          avatar: p.avatar || getPatientPhoto(p.id, `${p.firstName} ${p.lastName}`, p.gender),
        }));
      } catch (e) {
        return initialPatients;
      }
    }
    return initialPatients.map((patient) => ({
      ...patient,
      rgNo: patient.rgNo || patient.id,
    }));
  });

  const [doctors, setDoctors] = useState<Doctor[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DOCTORS);
    return saved ? JSON.parse(saved) : initialDoctors;
  });

  const [doctorDutySchedules, setDoctorDutySchedules] = useState<DoctorDutySchedule[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DOCTOR_DUTY_SCHEDULES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [staffDutySchedules, setStaffDutySchedules] = useState<StaffDutySchedule[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STAFF_DUTY_SCHEDULES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [doctorDutyChangeRequests, setDoctorDutyChangeRequests] = useState<DoctorDutyChangeRequest[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DOCTOR_DUTY_CHANGE_REQUESTS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
    return saved ? JSON.parse(saved) : initialAppointments;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INVOICES);
      const rawList = saved ? JSON.parse(saved) : initialInvoices;
      if (!Array.isArray(rawList)) return initialInvoices;
      return rawList.map((inv: any) => {
        const subtotal = Number(inv.subtotal) || 0;
        const totalAmount = Number(inv.totalAmount ?? inv.subtotal ?? 0);
        const insuranceCoveredAmount = Number(inv.insuranceCoveredAmount ?? inv.insuranceCovered ?? 0);
        const amountPaid = Number(inv.amountPaid ?? inv.paidAmount ?? 0);
        const patientPayable = Number(inv.patientPayable ?? Math.max(0, totalAmount - insuranceCoveredAmount));
        const balanceDue = Number(inv.balanceDue ?? Math.max(0, patientPayable - amountPaid));
        return {
          ...inv,
          subtotal,
          totalAmount,
          insuranceCoveredAmount,
          insuranceCovered: insuranceCoveredAmount,
          patientPayable,
          amountPaid,
          balanceDue,
          items: Array.isArray(inv.items)
            ? inv.items.map((item: any) => ({
              ...item,
              unitCost: Number(item.unitCost) || 0,
              amount: Number(item.amount ?? item.totalPrice) || 0,
              totalPrice: Number(item.totalPrice ?? item.amount) || 0,
            }))
            : [],
        };
      });
    } catch {
      return initialInvoices;
    }
  });

  const [advancePayments, setAdvancePayments] = useState<AdvancePayment[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ADVANCE_PAYMENTS);
      return saved ? JSON.parse(saved) : initialAdvancePayments;
    } catch {
      return initialAdvancePayments;
    }
  });

  const [refundPayments, setRefundPayments] = useState<RefundPayment[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.REFUND_PAYMENTS);
      return saved ? JSON.parse(saved) : initialRefundPayments;
    } catch {
      return initialRefundPayments;
    }
  });

  const [insuranceApprovals, setInsuranceApprovals] = useState<InsuranceApproval[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INSURANCE_APPROVALS);
      return saved ? JSON.parse(saved) : initialInsuranceApprovals;
    } catch {
      return initialInsuranceApprovals;
    }
  });

  const [posTransactions, setPosTransactions] = useState<PosTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.POS_TRANSACTIONS);
      return saved ? JSON.parse(saved) : initialPosTransactions;
    } catch {
      return initialPosTransactions;
    }
  });

  const [receptionTokens, setReceptionTokensState] = useState<ReceptionToken[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RECEPTION_TOKENS);
      return saved ? JSON.parse(saved) : initialReceptionTokens;
    } catch {
      return initialReceptionTokens;
    }
  });
  const initialLocalTokenIds = useRef(new Set(receptionTokens.map((token) => token.id)));
  const sharedTokenIds = useRef(new Set<string>());
  const setReceptionTokens: React.Dispatch<React.SetStateAction<ReceptionToken[]>> = (update) => {
    setReceptionTokensState((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      const previousById = new Map(current.map((token) => [token.id, token]));
      next.forEach((token) => {
        if (
          JSON.stringify(previousById.get(token.id)) !== JSON.stringify(token) &&
          (!initialLocalTokenIds.current.has(token.id) || sharedTokenIds.current.has(token.id))
        ) {
          dirtyTokenIds.current.add(token.id);
        }
      });
      return next;
    });
  };

  const [wardBeds, setWardBeds] = useState<WardBed[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.WARD_BEDS);
    return saved ? JSON.parse(saved) : initialWardBeds;
  });

  const [staff, setStaff] = useState<StaffMember[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STAFF);
    if (!saved) return initialStaff;
    const savedStaff: StaffMember[] = JSON.parse(saved);
    return savedStaff.some((member) => member.id === 'STF-08')
      ? savedStaff
      : [...savedStaff, ...initialStaff.filter((member) => member.id === 'STF-08')];
  });

  const [pharmacy, setPharmacy] = useState<PharmacyItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PHARMACY);
    return saved ? JSON.parse(saved) : initialPharmacy;
  });

  const [hospitalPriceCatalog, setHospitalPriceCatalog] = useState<HospitalPriceItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.HOSPITAL_PRICE_CATALOG);
    if (!saved) return initialHospitalPriceCatalog;
    try {
      const parsed = JSON.parse(saved) as HospitalPriceItem[];
      return Array.isArray(parsed) ? parsed : initialHospitalPriceCatalog;
    } catch {
      return initialHospitalPriceCatalog;
    }
  });

  const [medicalCertificates, setMedicalCertificates] = useState<MedicalCertificate[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MEDICAL_CERTIFICATES);
      return saved ? JSON.parse(saved) : initialMedicalCertificates;
    } catch {
      return initialMedicalCertificates;
    }
  });

  const [surgicalCases, setSurgicalCases] = useState<SurgicalCase[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SURGICAL_CASES);
      return saved ? JSON.parse(saved) : initialSurgicalCases;
    } catch {
      return initialSurgicalCases;
    }
  });

  const [bloodUnits, setBloodUnits] = useState<BloodUnit[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BLOOD_UNITS);
      return saved ? JSON.parse(saved) : initialBloodUnits;
    } catch {
      return initialBloodUnits;
    }
  });

  const [pharmacyDispenseRecords, setPharmacyDispenseRecords] = useState<PharmacyDispenseRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PHARMACY_DISPENSES);
      return saved ? JSON.parse(saved) : initialPharmacyDispenseRecords;
    } catch {
      return initialPharmacyDispenseRecords;
    }
  });

  const [bedTransfers, setBedTransfers] = useState<BedTransferRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BED_TRANSFERS);
      return saved ? JSON.parse(saved) : initialBedTransfers;
    } catch {
      return initialBedTransfers;
    }
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    return saved ? JSON.parse(saved) : initialAuditLogs;
  });

  const [compliance, setCompliance] = useState<SystemCompliance>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.COMPLIANCE);
    return saved ? JSON.parse(saved) : initialCompliance;
  });

  const [currentRole, setCurrentRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ROLE);
    return (saved as UserRole) || 'admin';
  });

  const [notifications, setNotifications] = useState<LiveNotification[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'NOTIF-1',
        title: 'Emergency Admission',
        message: 'Patient Amara Okonkwo admitted to ER Triage Bay 2 with acute RLQ abdominal pain.',
        type: 'critical',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
        relatedEntityId: 'PT-10494',
      },
      {
        id: 'NOTIF-2',
        title: 'Low Pharmacy Inventory Alert',
        message: 'Metformin HCl 850mg stock (28 units) fell below minimum safe threshold (75 units).',
        type: 'warning',
        timestamp: new Date(Date.now() - 1000 * 60 * 10).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
        relatedEntityId: 'PHARM-02',
      },
      {
        id: 'NOTIF-3',
        title: 'Live Appointment Queue',
        message: 'Dr. Sarah Jenkins has started consultation with Eleanor Pemberton.',
        timestamp: new Date(Date.now() - 1000 * 60 * 20).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
        relatedEntityId: 'APT-2026-001',
      },
    ];
  });

  const [activeTab, setActiveTabState] = useState<NavigationTab>('overview');
  const [openTabs, setOpenTabs] = useState<WorkspaceTab[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WORKSPACE_TABS);
      if (saved) {
        const parsed = JSON.parse(saved) as WorkspaceTab[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [
      { id: 'overview', tabKey: 'overview', title: 'Dashboard', closable: false },
    ];
  });
  const [registrationMode, setRegistrationModeState] = useState<RegistrationMode>('new');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const [appTheme, setAppThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.APP_THEME) as AppTheme;
    if (saved) return saved;
    return 'clinical';
  });

  const setAppTheme = (theme: AppTheme) => {
    setAppThemeState(theme);
    localStorage.setItem(STORAGE_KEYS.APP_THEME, theme);
  };

  const activateAndOpenTab = (targetTab: NavigationTab) => {
    setActiveTabState(targetTab);
    setOpenTabs((prev) => {
      const exists = prev.some((t) => t.id === targetTab || t.tabKey === targetTab);
      if (exists) return prev;
      const meta = getTabInfo(targetTab);
      return [
        ...prev,
        {
          id: targetTab,
          tabKey: targetTab,
          title: meta.title,
          closable: targetTab !== 'overview',
        },
      ];
    });
  };

  const setActiveTab = (tab: NavigationTab) => {
    if (currentRole === 'receptionist') {
      const receptionistTabs: NavigationTab[] = [
        'overview',
        'registration',
        'medical-records',
        'certificates',
        'appointments',
        'enquiry',
        'billing',
        'billing-dues',
        'billing-advance',
        'billing-refunds',
        'billing-pos',
        'insurance-approvals',
        'reports',
        'pricelist',
        'ot-schedule',
        'blood-bank',
        'lab-orders',
      ];
      if (!receptionistTabs.includes(tab)) {
        addNotification('Reception Portal Policy', 'Reception users have access to Dashboard, Registration, Medical Records, Certificates, Appointments, Patient Enquiry, Billing operations, Reports, Price List, and Care Schedules.', 'warning');
        activateAndOpenTab('overview');
        return;
      }
    }
    if (departmentPortal === 'outpatient' && (tab === 'inpatient' || tab === 'wards')) {
      addNotification('Access Locked', 'Inpatient wards and bed telemetry are restricted in Outpatient Clinic mode.', 'warning');
      activateAndOpenTab('outpatient');
      return;
    }
    activateAndOpenTab(tab);
  };

  const closeWorkspaceTab = (tabId: string) => {
    setOpenTabs((prev) => {
      const index = prev.findIndex((t) => t.id === tabId);
      if (index === -1) return prev;

      const newTabs = prev.filter((t) => t.id !== tabId);

      // If we closed the active tab, switch to adjacent tab
      if (activeTab === tabId) {
        if (newTabs.length > 0) {
          const nextIndex = Math.min(index, newTabs.length - 1);
          setActiveTabState(newTabs[nextIndex].tabKey);
        } else {
          const fallbackTab: WorkspaceTab = {
            id: 'overview',
            tabKey: 'overview',
            title: 'Dashboard',
            closable: false,
          };
          setActiveTabState('overview');
          return [fallbackTab];
        }
      }
      return newTabs.length > 0 ? newTabs : [
        { id: 'overview', tabKey: 'overview', title: 'Dashboard', closable: false }
      ];
    });
  };

  const closeOtherWorkspaceTabs = (tabId: string) => {
    setOpenTabs((prev) => {
      const target = prev.find((t) => t.id === tabId);
      if (!target) return prev;
      setActiveTabState(target.tabKey);
      return [target];
    });
  };

  const closeAllWorkspaceTabs = () => {
    const dashboardTab: WorkspaceTab = {
      id: 'overview',
      tabKey: 'overview',
      title: 'Dashboard',
      closable: false,
    };
    setOpenTabs([dashboardTab]);
    setActiveTabState('overview');
  };

  const openWorkspaceTab = (tabKey: NavigationTab, _title?: string) => {
    setActiveTab(tabKey);
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.WORKSPACE_TABS, JSON.stringify(openTabs));
    } catch {
      // ignore
    }
  }, [openTabs]);

  const setRegistrationMode = (mode: RegistrationMode) => {
    setRegistrationModeState(mode);
    setActiveTab('registration');
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
  }, [patients]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(doctors));
  }, [doctors]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DOCTOR_DUTY_SCHEDULES, JSON.stringify(doctorDutySchedules));
  }, [doctorDutySchedules]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STAFF_DUTY_SCHEDULES, JSON.stringify(staffDutySchedules));
  }, [staffDutySchedules]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DOCTOR_DUTY_CHANGE_REQUESTS, JSON.stringify(doctorDutyChangeRequests));
  }, [doctorDutyChangeRequests]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
  }, [appointments]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
  }, [invoices]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ADVANCE_PAYMENTS, JSON.stringify(advancePayments));
  }, [advancePayments]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REFUND_PAYMENTS, JSON.stringify(refundPayments));
  }, [refundPayments]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INSURANCE_APPROVALS, JSON.stringify(insuranceApprovals));
  }, [insuranceApprovals]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.POS_TRANSACTIONS, JSON.stringify(posTransactions));
  }, [posTransactions]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECEPTION_TOKENS, JSON.stringify(receptionTokens));
  }, [receptionTokens]);
  useEffect(() => {
    const client = supabaseClient;
    if (!client || !sharedClinicId) return;
    let disposed = false;
    let channel: ReturnType<typeof client.channel> | undefined;
    tokenSyncReady.current = false;

    const serializeToken = (token: ReceptionToken) => {
      const { lineItems, ...tokenData } = token;
      return {
        clinic_id: sharedClinicId,
        token_id: token.id,
        token_data: tokenData,
        line_items: lineItems || [],
      };
    };
    const deserializeToken = (value: unknown): ReceptionToken | null => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      const row = value as Record<string, unknown>;
      const data = row.token_data;
      if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(row.line_items)) return null;
      const tokenData = data as Record<string, unknown>;
      if (
        typeof row.token_id !== 'string' ||
        tokenData.id !== row.token_id ||
        typeof tokenData.tokenNumber !== 'string' ||
        typeof tokenData.patientId !== 'string' ||
        typeof tokenData.patientName !== 'string'
      ) return null;
      return { ...tokenData, lineItems: row.line_items } as ReceptionToken;
    };
    const loadAndSyncTokens = async () => {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (disposed) return;
      if (sessionError) {
        console.error('Unable to verify the Supabase session for visit-token synchronization.', sessionError);
        return;
      }
      if (!sessionData.session) {
        console.info('Shared visit-token synchronization is disabled until a Supabase session is authenticated.');
        return;
      }
      channel = client
        .channel(`hms-visit-tokens:${sharedClinicId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'hms_visit_tokens', filter: `clinic_id=eq.${sharedClinicId}` },
          (payload) => {
            if (payload.eventType === 'DELETE') return;
            const token = deserializeToken(payload.new);
            if (!token) {
              console.error('Received an invalid visit token from Supabase Realtime.', payload.new);
              return;
            }
            sharedTokenIds.current.add(token.id);
            setReceptionTokensState((current) => {
              if (dirtyTokenIds.current.has(token.id)) return current;
              const existing = current.find((item) => item.id === token.id);
              if (existing && JSON.stringify(existing) === JSON.stringify(token)) return current;
              return existing
                ? current.map((item) => item.id === token.id ? token : item)
                : [token, ...current];
            });
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`Supabase visit-token realtime channel entered ${status}.`);
          }
        });
      const { data, error } = await client
        .from('hms_visit_tokens')
        .select('token_id, token_data, line_items')
        .eq('clinic_id', sharedClinicId);
      if (disposed) return;
      if (error) {
        console.error('Unable to load shared visit tokens from Supabase.', error);
        return;
      }
      const remoteTokens = (data || []).map(deserializeToken);
      if (remoteTokens.some((token) => token === null)) {
        console.error('Supabase returned one or more malformed visit token records.');
      }
      const merged = new Map(receptionTokens.map((token) => [token.id, token]));
      remoteTokens.forEach((token) => {
        if (token) {
          sharedTokenIds.current.add(token.id);
          if (!dirtyTokenIds.current.has(token.id)) merged.set(token.id, token);
        }
      });
      const tokens = [...merged.values()];
      tokenSyncReady.current = true;
      setReceptionTokensState(tokens);
    };

    void loadAndSyncTokens();
    return () => {
      disposed = true;
      tokenSyncReady.current = false;
      if (channel) void client.removeChannel(channel);
    };
  }, []);
  useEffect(() => {
    const client = supabaseClient;
    const tokensToSync = receptionTokens.filter((token) => dirtyTokenIds.current.has(token.id));
    if (!client || !sharedClinicId || !tokenSyncReady.current || tokensToSync.length === 0) return;
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const { error } = await client
          .from('hms_visit_tokens')
          .upsert(tokensToSync.map((token) => {
            const { lineItems, ...tokenData } = token;
            return {
              clinic_id: sharedClinicId,
              token_id: token.id,
              token_data: tokenData,
              line_items: lineItems || [],
            };
          }), { onConflict: 'clinic_id,token_id' });
        if (error) console.error('Unable to persist live visit-token changes to Supabase.', error);
        else tokensToSync.forEach((token) => {
          sharedTokenIds.current.add(token.id);
          const current = receptionTokens.find((item) => item.id === token.id);
          if (current && JSON.stringify(current) === JSON.stringify(token)) dirtyTokenIds.current.delete(token.id);
        });
      })();
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, [receptionTokens]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.WARD_BEDS, JSON.stringify(wardBeds));
  }, [wardBeds]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
  }, [staff]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PHARMACY, JSON.stringify(pharmacy));
  }, [pharmacy]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HOSPITAL_PRICE_CATALOG, JSON.stringify(hospitalPriceCatalog));
  }, [hospitalPriceCatalog]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MEDICAL_CERTIFICATES, JSON.stringify(medicalCertificates));
  }, [medicalCertificates]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SURGICAL_CASES, JSON.stringify(surgicalCases));
  }, [surgicalCases]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BLOOD_UNITS, JSON.stringify(bloodUnits));
  }, [bloodUnits]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PHARMACY_DISPENSES, JSON.stringify(pharmacyDispenseRecords));
  }, [pharmacyDispenseRecords]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BED_TRANSFERS, JSON.stringify(bedTransfers));
  }, [bedTransfers]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
  }, [auditLogs]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COMPLIANCE, JSON.stringify(compliance));
  }, [compliance]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ROLE, currentRole);
  }, [currentRole]);

  // Auth & Session
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.IS_AUTHENTICATED);
    const savedUserId = localStorage.getItem(STORAGE_KEYS.AUTH_USER_ID);
    return saved === 'true' && staff.some((member) => member.id === savedUserId && member.isActive !== false);
  });
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(() => {
    const savedUserId = localStorage.getItem(STORAGE_KEYS.AUTH_USER_ID);
    return staff.some((member) => member.id === savedUserId && member.isActive !== false) ? savedUserId : null;
  });
  const [departmentPortal, setDepartmentPortalState] = useState<DepartmentPortal | null>(() => {
    return (localStorage.getItem(STORAGE_KEYS.DEPARTMENT_PORTAL) as DepartmentPortal) || null;
  });
  const [showPortalSelect, setShowPortalSelect] = useState<boolean>(false);

  const currentUser: StaffMember =
    (authenticatedUserId ? staff.find((s) => s.id === authenticatedUserId && s.isActive !== false) : null) ||
    staff.find((s) => s.role === currentRole && s.isActive !== false) ||
    staff[0] || {
      id: 'STF-ADMIN',
      name: 'System Administrator',
      role: 'admin',
      department: 'Clinical Governance',
      shift: 'Morning (07:00 - 15:00)',
      phone: '+1 (555) 912-1001',
      email: 'admin@apexhealth.org',
      roomOrStation: 'Control Center',
      licenseNumber: 'FACHE-9921',
      status: 'On Duty',
    };

  const currentRoleDefinition: RoleDefinition = ROLE_DEFINITIONS[currentRole] || ROLE_DEFINITIONS.admin;
  const authenticatedUser = isAuthenticated ? currentUser : null;

  const setCurrentRole = (role: UserRole) => {
    setCurrentRoleState(role);
    logAuditEvent('AUTHENTICATE', 'Security Settings', role, `Switched active session view to role: ${role.toUpperCase()}`, 'HIPAA Access Log');
    addNotification('Role Switched', `Active session switched to ${role.toUpperCase()} profile permissions.`, 'info');
  };

  const setCurrentUserId = (id: string) => {
    const matched = staff.find((s) => s.id === id && s.isActive !== false);
    if (matched) {
      setAuthenticatedUserId(matched.id);
      setCurrentRoleState(matched.role);
      localStorage.setItem(STORAGE_KEYS.AUTH_USER_ID, matched.id);
      localStorage.setItem(STORAGE_KEYS.ROLE, matched.role);
      addNotification('User Profile Switched', `Active session profile set to ${matched.name}.`, 'info');
    }
  };

  const login = (userId: string, _password?: string): { success: boolean; message?: string } => {
    const trimmed = userId.trim().toLowerCase();
    if (!trimmed) {
      return { success: false, message: 'Please select or enter your Staff ID' };
    }
    const matchedStaff = staff.find(
      (s) => s.isActive !== false && (
        s.id.toLowerCase() === trimmed ||
        s.email.toLowerCase() === trimmed ||
        s.name.toLowerCase().includes(trimmed)
      )
    );
    if (!matchedStaff) {
      return { success: false, message: 'Staff ID not found in hospital directory' };
    }
    setIsAuthenticated(true);
    setAuthenticatedUserId(matchedStaff.id);
    setCurrentRoleState(matchedStaff.role);
    setShowPortalSelect(true);
    localStorage.setItem(STORAGE_KEYS.IS_AUTHENTICATED, 'true');
    localStorage.setItem(STORAGE_KEYS.AUTH_USER_ID, matchedStaff.id);
    localStorage.setItem(STORAGE_KEYS.ROLE, matchedStaff.role);
    logAuditEvent(
      'AUTHENTICATE',
      'Security Settings',
      matchedStaff.id,
      `Staff ${matchedStaff.name} (${matchedStaff.role.toUpperCase()}) authenticated via clinical portal.`,
      'HIPAA Access Log'
    );
    addNotification('Portal Login', `Welcome back, ${matchedStaff.name}.`, 'success');
    return { success: true };
  };

  const logout = () => {
    const prevUser = currentUser;
    setIsAuthenticated(false);
    setAuthenticatedUserId(null);
    setDepartmentPortalState(null);
    setShowPortalSelect(false);
    localStorage.removeItem(STORAGE_KEYS.IS_AUTHENTICATED);
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER_ID);
    localStorage.removeItem(STORAGE_KEYS.DEPARTMENT_PORTAL);
    if (prevUser) {
      logAuditEvent(
        'AUTHENTICATE',
        'Security Settings',
        prevUser.id,
        `Staff ${prevUser.name} logged out from session.`,
        'HIPAA Access Log'
      );
    }
  };

  const selectDepartmentPortal = (portal: DepartmentPortal) => {
    setDepartmentPortalState(portal);
    setShowPortalSelect(false);
    localStorage.setItem(STORAGE_KEYS.DEPARTMENT_PORTAL, portal);
    if (portal === 'outpatient') {
      setActiveTabState('outpatient');
      setAppTheme('emerald');
      addNotification('Outpatient Clinic (OPD)', 'Switched to OPD Clinic Queue & Consultations division. Inpatient IPD access locked.', 'info');
    } else if (portal === 'inpatient') {
      setActiveTabState('inpatient');
      setAppTheme('indigo');
      addNotification('Inpatient Hospital (IPD)', 'Switched to IPD Ward Beds & Admissions division.', 'info');
    } else {
      setActiveTabState('overview');
    }
    logAuditEvent(
      'READ',
      'Security Settings',
      portal,
      `Navigated to hospital division portal: ${portal.toUpperCase()}`,
      'HIPAA Access Log'
    );
  };

  const logAuditEvent = (
    action: AuditLog['action'],
    resourceType: AuditLog['resourceType'],
    resourceId: string,
    details: string,
    complianceFlag: AuditLog['complianceFlag'] = 'HIPAA Access Log'
  ) => {
    if (!compliance.hipaaAuditLogEnabled) return;
    const newLog: AuditLog = {
      id: `LOG-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      userName: currentUser.name,
      userRole: currentRole,
      action,
      resourceType,
      resourceId,
      details,
      complianceFlag,
    };
    setAuditLogs((prev) => [newLog, ...prev.slice(0, 49)]);
  };

  const updateCompliance = (updates: Partial<SystemCompliance>) => {
    setCompliance((prev) => ({ ...prev, ...updates }));
    logAuditEvent('UPDATE', 'Security Settings', 'SYS-CONF', `Compliance governance parameters updated`, 'HIPAA Access Log');
    addNotification('Security Settings Updated', 'System compliance settings synchronized successfully.', 'info');
  };

  const addNotification = (
    titleOrObj: string | { title: string; message: string; type?: LiveNotification['type']; relatedEntityId?: string; recipient?: { userId?: string; userName?: string } },
    message?: string,
    type: LiveNotification['type'] = 'info',
    relatedEntityId?: string,
    recipient?: { userId?: string; userName?: string }
  ) => {
    let resolvedTitle = '';
    let resolvedMessage = '';
    let resolvedType: LiveNotification['type'] = type;
    let resolvedEntityId = relatedEntityId;
    let resolvedRecipient = recipient;

    if (typeof titleOrObj === 'object' && titleOrObj !== null) {
      resolvedTitle = titleOrObj.title;
      resolvedMessage = titleOrObj.message;
      resolvedType = titleOrObj.type || 'info';
      resolvedEntityId = titleOrObj.relatedEntityId;
      resolvedRecipient = titleOrObj.recipient;
    } else {
      resolvedTitle = titleOrObj;
      resolvedMessage = message || '';
      resolvedType = type;
    }

    const newNotif: LiveNotification = {
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: resolvedTitle,
      message: resolvedMessage,
      type: resolvedType,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
      relatedEntityId: resolvedEntityId,
      recipientUserId: resolvedRecipient?.userId,
      recipientUserName: resolvedRecipient?.userName,
    };
    setNotifications((prev) => [newNotif, ...prev.slice(0, 24)]);
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const appendPatientVisit = (patientId: string, visitDetails: Partial<FacilityVisit>) => {
    setPatients((prev) =>
      prev.map((patient) => {
        if (patient.id !== patientId) return patient;

        const latestVitals = Array.isArray(patient.vitals) ? patient.vitals[0] : undefined;
        const visitTimestamp = new Date().toISOString();
        const visit: FacilityVisit = {
          id: `VIS-${Date.now().toString().slice(-5)}`,
          visitDate: visitDetails.visitDate || visitTimestamp.split('T')[0],
          doctorName: visitDetails.doctorName || patient.primaryPhysicianName || 'Attending Physician',
          doctorSpecialty: visitDetails.doctorSpecialty || patient.department || 'General Medicine',
          department: visitDetails.department || patient.department || 'General Medicine',
          clinicRoom: visitDetails.clinicRoom || patient.wardOrRoom || 'OPD / Consultation',
          visitType: visitDetails.visitType || 'Outpatient Follow-up',
          chiefComplaint: visitDetails.chiefComplaint || patient.purposeOfVisit || 'Clinical review',
          clinicalAssessment: visitDetails.clinicalAssessment || 'Clinical review completed.',
          primaryDiagnosis: visitDetails.primaryDiagnosis || { code: 'Z00.00', description: 'General medical examination' },
          vitalsSnapshot: visitDetails.vitalsSnapshot || {
            bloodPressure: latestVitals ? `${latestVitals.bloodPressureSys}/${latestVitals.bloodPressureDia}` : 'N/A',
            heartRate: latestVitals?.heartRate ?? 0,
            spO2: latestVitals?.spO2 ?? 0,
            temperature: latestVitals?.temperature ?? 0,
            respiratoryRate: latestVitals?.respiratoryRate ?? 0,
          },
          medicationsPrescribed: visitDetails.medicationsPrescribed || [],
          diagnosticOrders: visitDetails.diagnosticOrders || [],
          disposition: visitDetails.disposition || 'Follow-up Scheduled',
          signedAt: visitDetails.signedAt || visitTimestamp,
        };

        return {
          ...patient,
          facilityVisits: [visit, ...(patient.facilityVisits || [])],
          updatedAt: visitTimestamp,
        };
      })
    );
  };

  const addPatient = (
    patientData: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'vitals' | 'medications' | 'labResults' | 'clinicalNotes'>,
    registrationType: 'Consultation' | 'Non-Consultation' | 'Technician' = 'Consultation'
  ): { patient: Patient; token: ReceptionToken } => {
    const highestIssuedNumber = patients.reduce((highest, patient) => {
      const patientNumber = Number(patient.id.match(/^PT-(\d+)$/)?.[1]) || 0;
      const registrationNumber = Number(patient.rgNo?.match(/^RG(\d+)$/i)?.[1]) || 0;
      return Math.max(highest, patientNumber, registrationNumber);
    }, 10492);
    let nextNum = highestIssuedNumber + 1;
    while (patients.some((patient) => patient.id === `PT-${nextNum}` || patient.rgNo === `RG${nextNum}`)) {
      nextNum += 1;
    }
    const newId = `PT-${nextNum}`;
    const now = new Date();
    const nowIso = now.toISOString();
    const nowDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const newPatient: Patient = {
      ...patientData,
      id: newId,
      rgNo: patientData.rgNo?.trim() || `RG${nextNum}`,
      facilityVisits: patientData.facilityVisits || [
        {
          id: `VIS-${Date.now().toString().slice(-5)}`,
          visitDate: nowDate,
          doctorName: patientData.primaryPhysicianName || 'Attending Physician',
          doctorSpecialty: patientData.department || 'General Medicine',
          department: patientData.department || 'General Medicine',
          clinicRoom: registrationType === 'Consultation' ? (patientData.status === 'Emergency' ? 'ER Triage Desk' : 'Registration Counter 1') : 'Cashier Desk',
          visitType: registrationType === 'Consultation' ? (patientData.status === 'Emergency' ? 'Emergency Triage' : 'Specialist Consultation') : registrationType === 'Technician' ? 'Lab & Imaging Review' : 'Billing & Claims',
          chiefComplaint: patientData.purposeOfVisit || 'New patient registration',
          clinicalAssessment: 'Initial registration and intake encounter workflow started.',
          primaryDiagnosis: { code: 'Z00.00', description: 'General medical examination' },
          vitalsSnapshot: {
            bloodPressure: '120/80',
            heartRate: 72,
            spO2: 98,
            temperature: 98.6,
            respiratoryRate: 16,
          },
          medicationsPrescribed: [],
          diagnosticOrders: [],
          disposition: 'Follow-up Scheduled',
          signedAt: nowIso,
        },
      ],
      vitals: [],
      medications: [],
      labResults: [],
      clinicalNotes: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setPatients((prev) => [newPatient, ...prev]);

    const registrationToken = createReceptionToken({
      patientId: newPatient.id,
      patientName: `${newPatient.firstName} ${newPatient.lastName}`,
      patientPhone: newPatient.phone,
      doctorId: registrationType === 'Consultation' ? newPatient.primaryPhysicianId : undefined,
      doctorName: registrationType === 'Technician' ? newPatient.technicianName || 'Technician Desk' : newPatient.primaryPhysicianName || 'Registration Desk',
      department: registrationType === 'Technician' ? 'Physiotherapy' : newPatient.department || 'General Medicine',
      serviceType: registrationType === 'Consultation' ? 'Consultation' : registrationType === 'Technician' ? 'Physio Technician' : 'Billing & Cashier',
      visitCode: registrationType === 'Consultation' ? 'C' : registrationType === 'Technician' ? 'TEC' : 'NC',
      priority: newPatient.status === 'Emergency' ? 'Urgent' : 'Normal',
      status: 'Waiting',
      estimatedWaitMins: newPatient.status === 'Emergency' ? 10 : 20,
      counterOrRoom: registrationType === 'Consultation' ? (newPatient.status === 'Emergency' ? 'ER Triage Desk' : 'Registration Counter 1') : registrationType === 'Technician' ? 'Physiotherapy Technician Desk' : 'Cashier Desk',
      currentStage: '1_REGISTRATION',
      visitType: registrationType === 'Consultation' ? (newPatient.purposeOfVisit ? 'Consultation' : 'Walk-in') : registrationType === 'Technician' ? 'Technician' : 'Billing',
      visitPurpose: registrationType === 'Consultation' ? (newPatient.purposeOfVisit || 'New patient assessment') : registrationType === 'Technician' ? (newPatient.purposeOfVisit || 'Technician service') : 'Administrative registration & billing',
      visitComplaint: registrationType === 'Consultation' ? (newPatient.purposeOfVisit || 'Initial clinical assessment') : registrationType === 'Technician' ? (newPatient.purposeOfVisit || 'Technician service') : 'Registration and billing review',
      registrationSource: 'New Registration',
      patientAge: newPatient.age,
      patientGender: newPatient.gender,
      patientDetails: {
        registrationNumber: newPatient.rgNo || newPatient.id,
        title: newPatient.title,
        middleName: newPatient.middleName,
        dateOfBirth: newPatient.dob,
        nationality: newPatient.nationality,
        maritalStatus: newPatient.maritalStatus,
        bloodGroup: newPatient.bloodGroup,
        email: newPatient.email,
        address: newPatient.address,
        nationalId: newPatient.emiratesId,
        passportNumber: newPatient.passportNo,
        allergies: newPatient.allergies,
        chronicConditions: newPatient.chronicConditions,
        emergencyContact: newPatient.emergencyContact,
        consentSigned: newPatient.consentSigned,
        consentTimestamp: newPatient.consentTimestamp,
        consentSignature: newPatient.consentSignature,
        consentSignerRole: newPatient.consentSignerRole,
        consentSignerRelationship: newPatient.consentSignerRelationship,
        insurancePolicyNumber: newPatient.insurance?.policyNumber,
        insuranceMemberId: newPatient.insurance?.memberId,
        insuranceProvider: newPatient.insurance?.provider,
        insuranceTpa: newPatient.insurance?.tpa,
        insuranceRegulator: newPatient.insurance?.regulator,
        insuranceNetwork: newPatient.insurance?.network,
        insurancePlanName: newPatient.insurance?.planName,
        insuranceCardNumber: newPatient.insurance?.cardNumber,
        insuranceCertificateNumber: newPatient.insurance?.certificateNumber,
        insuranceDependentNumber: newPatient.insurance?.dependentNumber,
        insuranceClaimFormNo: newPatient.insurance?.claimFormNo,
        insurancePreAuthorizationRequired: newPatient.insurance?.requiresPreAuthorization,
        insuranceDailyClinicLimitAed: newPatient.insurance?.dailyClinicLimitAed,
        insurancePreExistingWaitingPeriod: newPatient.insurance?.preExistingWaitingPeriod,
        insuranceVerificationReference: newPatient.insurance?.verificationReference,
        insuranceStatus: newPatient.insurance?.status,
        insuranceExpiryDate: newPatient.insurance?.expiryDate,
        insuranceCards: newPatient.insuranceList,
      },
      insuranceProvider: newPatient.insurance?.provider || 'Self-Pay',
      payMode: newPatient.payMode || 'Self',
      paymentScheme: newPatient.payMode === 'Insurance'
        ? {
            schemeType: 'Insurance',
            insuranceProvider: newPatient.insurance.provider,
            policyNumber: newPatient.insurance.policyNumber,
            network: newPatient.insurance.network,
            coveragePercent: newPatient.insurance.coveragePercentage,
            serviceCopay: newPatient.insurance.serviceCopay,
            deductibleAmount: newPatient.insurance.deductibleAmount ||
              parseInsuranceDeductible(newPatient.insuranceList?.find((record) => record.isPrimary)?.copayDeductible),
            preAuthStatus: newPatient.insurance.requiresPreAuthorization ? 'Pending' : 'Not Required',
          }
        : newPatient.payMode === 'Discount Card'
          ? {
              schemeType: 'Discount Card',
              discountCardName: newPatient.discountCardName,
              discountCardNumber: newPatient.discountCardNumber,
              discountPercent: newPatient.discountPercent,
            }
          : { schemeType: 'Self-Pay' },
      visitDate: nowDate,
      patientVisitSummary: registrationType === 'Consultation'
        ? `${newPatient.department || 'General Medicine'} • ${newPatient.primaryPhysicianName || 'Attending Physician'} • ${newPatient.purposeOfVisit || 'Initial consultation'}`
        : `${newPatient.department || 'General Medicine'} • Registration & billing • ${newPatient.purposeOfVisit || 'Administrative review'}`,
      historyLogs: [
        {
          stage: '1_REGISTRATION',
          timestamp: nowIso,
          action: registrationType === 'Consultation'
            ? `New registration token created for ${newPatient.firstName} ${newPatient.lastName}. Visit: ${newPatient.purposeOfVisit || 'Initial consultation'} • Department: ${newPatient.department || 'General Medicine'} • Doctor: ${newPatient.primaryPhysicianName || 'To be assigned'}`
            : `New non-consultation registration created for ${newPatient.firstName} ${newPatient.lastName}. Route: Registration & Cashier • Department: ${newPatient.department || 'General Medicine'}`,
          actor: 'Patient Registrar',
        },
      ],
    });
    if (newPatient.wardOrRoom) {
      setWardBeds((prev) =>
        prev.map((bed) =>
          bed.bedNumber.toLowerCase() === newPatient.wardOrRoom?.toLowerCase() ||
            bed.wardName.toLowerCase().includes(newPatient.wardOrRoom?.toLowerCase() || '___')
            ? {
              ...bed,
              status: 'Occupied',
              patientId: newId,
              patientName: `${newPatient.firstName} ${newPatient.lastName}`,
              assignedDoctor: newPatient.primaryPhysicianName,
              admissionDate: nowIso.split('T')[0],
            }
            : bed
        )
      );
    }
    logAuditEvent(
      'CREATE',
      'Patient Record',
      newId,
      `Registered ${newPatient.firstName} ${newPatient.lastName} (${newPatient.status}) and issued token ${registrationToken.tokenNumber}.`,
      'HIPAA Access Log'
    );
    addNotification(
      `Registration Complete — Reception Token ${registrationToken.tokenNumber}`,
      `${newPatient.firstName} ${newPatient.lastName}, please proceed to ${registrationToken.counterOrRoom}.`,
      newPatient.status === 'Emergency' ? 'critical' : 'success',
      newId
    );
    addNotification(
      'SMS Notification Sent',
      `Registration SMS sent to ${newPatient.phone || 'patient mobile'} for ${newPatient.firstName} ${newPatient.lastName}.`,
      'info',
      newId
    );
    return { patient: newPatient, token: registrationToken };
  };

  const updatePatient = (id: string, updates: Partial<Patient>) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return {
            ...p,
            ...updates,
            rgNo: p.rgNo || p.id,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      })
    );
    setReceptionTokens((prev) =>
      prev.map((token) => {
        if (token.patientId !== id) return token;
        const existing = patients.find((patient) => patient.id === id);
        return {
          ...token,
          patientName:
            updates.firstName || updates.lastName
              ? `${updates.firstName || existing?.firstName || ''} ${updates.lastName || existing?.lastName || ''}`.trim()
              : token.patientName,
          patientPhone: updates.phone || token.patientPhone,
          doctorId: updates.primaryPhysicianId || token.doctorId,
          doctorName: updates.primaryPhysicianName || token.doctorName,
          department: updates.department || token.department,
        };
      })
    );
    logAuditEvent('UPDATE', 'Patient Record', id, `Updated patient clinical and demographic info`, 'HIPAA Access Log');
  };

  const addVitals = (patientId: string, vitalsData: Omit<Vitals, 'recordedAt'>) => {
    const recordedAt = new Date().toISOString();
    const newVitals: Vitals = { ...vitalsData, recordedAt };
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === patientId) {
          return {
            ...p,
            vitals: [newVitals, ...p.vitals],
            updatedAt: recordedAt,
          };
        }
        return p;
      })
    );
    const patient = patients.find((p) => p.id === patientId);
    const pName = patient ? `${patient.firstName} ${patient.lastName}` : patientId;
    logAuditEvent('UPDATE', 'Patient Record', patientId, `Recorded vitals: HR ${vitalsData.heartRate}, BP ${vitalsData.bloodPressureSys}/${vitalsData.bloodPressureDia}, SpO2 ${vitalsData.spO2}%`);
    if (vitalsData.spO2 < 92 || vitalsData.bloodPressureSys > 160 || vitalsData.heartRate > 120) {
      addNotification(
        'Critical Vitals Alert',
        `Telemetry alert for ${pName}: HR ${vitalsData.heartRate} bpm, BP ${vitalsData.bloodPressureSys}/${vitalsData.bloodPressureDia}, SpO2 ${vitalsData.spO2}%.`,
        'critical',
        patientId
      );
    } else {
      addNotification(
        'Vitals Synchronized',
        `Logged vitals for ${pName}: SpO2 ${vitalsData.spO2}%, Pulse ${vitalsData.heartRate} bpm.`,
        'info',
        patientId
      );
    }
  };

  const addTriageAssessment = (
    patientId: string,
    assessmentData: Omit<TriageAssessment, 'id' | 'assessedAt'>
  ): TriageAssessment => {
    const assessedAt = new Date().toISOString();
    const newAssessment: TriageAssessment = {
      ...assessmentData,
      id: `TRG-${Date.now().toString().slice(-4)}`,
      assessedAt,
    };
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === patientId) {
          const updatedVitals = [newAssessment.vitals, ...p.vitals];
          const isCritical =
            newAssessment.urgencyLevel.includes('Level 1') ||
            newAssessment.urgencyLevel.includes('Level 2') ||
            newAssessment.acuityColor === 'red' ||
            newAssessment.acuityColor === 'orange';
          return {
            ...p,
            status: isCritical ? 'Emergency' : p.status === 'Inpatient' ? 'Inpatient' : 'Outpatient',
            vitals: updatedVitals,
            latestTriage: newAssessment,
            triageAssessments: [newAssessment, ...(p.triageAssessments || [])],
            updatedAt: assessedAt,
          };
        }
        return p;
      })
    );
    const targetPatient = patients.find((p) => p.id === patientId);
    const pName = targetPatient ? `${targetPatient.firstName} ${targetPatient.lastName}` : patientId;
    logAuditEvent(
      'CREATE',
      'Patient Record',
      patientId,
      `Triage assessment completed by ${newAssessment.assessedBy}: ${newAssessment.urgencyLevel} [${newAssessment.disposition}]`,
      'HIPAA Access Log'
    );
    const isStatAlert =
      newAssessment.urgencyLevel.includes('Level 1') ||
      newAssessment.urgencyLevel.includes('Level 2') ||
      newAssessment.vitals.spO2 < 90 ||
      newAssessment.vitals.bloodPressureSys > 180;
    if (isStatAlert) {
      addNotification(
        'CRITICAL TRIAGE STAT',
        `STAT: ${pName} assessed at ${newAssessment.urgencyLevel}. Routed to ${newAssessment.disposition}. SpO2 ${newAssessment.vitals.spO2}%, BP ${newAssessment.vitals.bloodPressureSys}/${newAssessment.vitals.bloodPressureDia}, HR ${newAssessment.vitals.heartRate}.`,
        'critical',
        patientId
      );
    } else {
      addNotification(
        'Triage Assessment Logged',
        `Triage logged for ${pName}: ${newAssessment.urgencyLevel}. Acuity: ${newAssessment.acuityColor.toUpperCase()}.`,
        'success',
        patientId
      );
    }
    return newAssessment;
  };

  const addMedication = (patientId: string, medData: Omit<Medication, 'id'>): Medication => {
    const newMed: Medication = {
      ...medData,
      id: `MED-${Date.now().toString().slice(-4)}`,
    };
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === patientId) {
          const updatedMeds = [newMed, ...(p.medications || [])];
          return {
            ...p,
            medications: updatedMeds,
            prescriptions: updatedMeds,
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      })
    );
    logAuditEvent('CREATE', 'Prescription', newMed.id, `Prescribed ${newMed.name} (${newMed.dosage}) by ${newMed.prescribedBy}`);
    addNotification('Prescription Added', `${newMed.name} added to medication chart by ${newMed.prescribedBy}.`, 'info', patientId);
    return newMed;
  };

  const addClinicalNote = (patientId: string, noteData: Omit<ClinicalNote, 'id' | 'date'>) => {
    const author = noteData.authorName || noteData.doctorName || currentUser.name || 'Attending Physician';
    const role = noteData.authorRole || noteData.doctorSpecialty || currentUser.role || 'Clinical Staff';
    const newNote: ClinicalNote = {
      ...noteData,
      id: `NOTE-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
      authorName: author,
      doctorName: author,
      authorRole: role,
      doctorSpecialty: role,
      content: noteData.content || noteData.assessment || noteData.chiefComplaint || 'Clinical encounter recorded.',
      assessment: noteData.assessment || noteData.content || 'Assessment completed.',
      treatmentPlan: noteData.treatmentPlan || 'Continue management.',
      diagnosisCode: noteData.diagnosisCode || (noteData.diagnoses && noteData.diagnoses[0]) || 'Z00.00',
    };
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === patientId) {
          return {
            ...p,
            clinicalNotes: [newNote, ...(p.clinicalNotes || [])],
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      })
    );
    appendPatientVisit(patientId, {
      visitDate: newNote.date,
      doctorName: author,
      doctorSpecialty: role,
      department: newNote.category || 'General Medicine',
      clinicRoom: 'OPD / Consultation',
      visitType: 'Outpatient Follow-up',
      chiefComplaint: newNote.chiefComplaint || 'Clinical review',
      clinicalAssessment: newNote.assessment || newNote.content || 'Assessment completed.',
      primaryDiagnosis: {
        code: newNote.diagnosisCode || 'Z00.00',
        description: newNote.assessment || 'Clinical review',
      },
      medicationsPrescribed: [],
      diagnosticOrders: [],
      disposition: 'Follow-up Scheduled',
      signedAt: new Date().toISOString(),
    });
    logAuditEvent('CREATE', 'Patient Record', patientId, `Encounter clinical note recorded by ${author}`);
    addNotification('Clinical Note Logged', `Note by ${author} (${newNote.diagnosisCode}).`, 'info', patientId);
  };

  const normalizeClinicianName = (name: string) =>
    name
      .toLowerCase()
      .replace(/^dr\.?\s*/, '')
      .replace(/,?\s*(md|facs|do|phd)\b/g, '')
      .replace(/[.,]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const notifyOrderingDoctor = (patientId: string, lab: LabResult) => {
    const patient = patients.find((item) => item.id === patientId);
    const orderingDoctor =
      lab.orderedBy && lab.orderedBy !== 'Attending Physician'
        ? lab.orderedBy
        : patient?.primaryPhysicianName;
    if (!orderingDoctor) return;

    const recipient = staff.find(
      (member) =>
        member.role === 'doctor' && normalizeClinicianName(member.name) === normalizeClinicianName(orderingDoctor)
    );
    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'Patient';
    const alertType: LiveNotification['type'] =
      lab.status === 'Critical' ? 'critical' : lab.status === 'Elevated' ? 'warning' : 'info';

    addNotification(
      'Diagnostic Report Ready',
      `${lab.testName} for ${patientName} is ready to review. Result: ${lab.value} (${lab.status}).`,
      alertType,
      patientId,
      { userId: recipient?.id, userName: orderingDoctor }
    );
  };

  const addLabResult = (patientId: string, labData: Omit<LabResult, 'id'>) => {
    const newLab: LabResult = {
      ...labData,
      id: `LAB-${Date.now().toString().slice(-4)}`,
    };
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === patientId) {
          return {
            ...p,
            labResults: [newLab, ...(p.labResults || [])],
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      })
    );
    appendPatientVisit(patientId, {
      visitDate: newLab.resultDate || newLab.orderedDate,
      doctorName: newLab.orderedBy,
      doctorSpecialty: newLab.department || 'Laboratory',
      department: newLab.department || 'Laboratory',
      clinicRoom: 'Diagnostics Lab',
      visitType: 'Lab & Imaging Review',
      chiefComplaint: `Diagnostic review: ${newLab.testName}`,
      clinicalAssessment: newLab.impression || newLab.notes || `${newLab.testName} result recorded.`,
      primaryDiagnosis: {
        code: 'LAB-RESULT',
        description: newLab.testName,
      },
      diagnosticOrders: [newLab.testName],
      medicationsPrescribed: [],
      disposition: 'Follow-up Scheduled',
      signedAt: new Date().toISOString(),
    });
    logAuditEvent('CREATE', 'Lab Result', newLab.id, `Diagnostics verified: ${newLab.testName} (${newLab.value})`);
    if (newLab.status !== 'Pending') {
      notifyOrderingDoctor(patientId, newLab);
    }
  };

  const updateLabResult = (patientId: string, labId: string, updates: Partial<LabResult>) => {
    const patient = patients.find((item) => item.id === patientId);
    const existingLab = patient?.labResults.find((item) => item.id === labId);
    const updatedLab = existingLab ? { ...existingLab, ...updates } : null;
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === patientId) {
          return {
            ...p,
            labResults: p.labResults.map((l) => (l.id === labId ? { ...l, ...updates } : l)),
            updatedAt: new Date().toISOString(),
          };
        }
        return p;
      })
    );
    logAuditEvent('UPDATE', 'Lab Result', labId, `Diagnostic assay updated: ${JSON.stringify(updates)}`);
    const reportFinalized = existingLab?.status === 'Pending' && updatedLab?.status !== 'Pending';
    const reportDispatched =
      updates.sentToDoctor === true && existingLab?.sentToDoctor !== true && updatedLab?.status !== 'Pending';
    if (updatedLab && (reportFinalized || reportDispatched)) {
      notifyOrderingDoctor(patientId, updatedLab);
    }
  };

  const dischargePatient = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return;
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? {
            ...p,
            status: 'Discharged',
            wardOrRoom: undefined,
            updatedAt: new Date().toISOString(),
          }
          : p
      )
    );
    setWardBeds((prev) =>
      prev.map((bed) =>
        bed.patientId === patientId
          ? {
            ...bed,
            status: 'Available',
            patientId: undefined,
            patientName: undefined,
            assignedDoctor: undefined,
            admissionDate: undefined,
          }
          : bed
      )
    );
    logAuditEvent('UPDATE', 'Patient Record', patientId, `Discharged patient ${patient.firstName} ${patient.lastName}`);
    addNotification(
      'Patient Discharged',
      `${patient.firstName} ${patient.lastName} discharged. Bed sanitization protocol initialized.`,
      'success',
      patientId
    );
  };

  const updatePatientStatus = (id: string, status: Patient['status']) => {
    updatePatient(id, { status });
  };

  const addPrescription = (patientId: string, rx: any) => {
    const medication = addMedication(patientId, {
      name: rx.medicationName || rx.name,
      dosage: rx.dosage || 'Standard',
      frequency: rx.frequency || 'Daily',
      route: rx.route || 'Oral',
      duration: rx.duration,
      instructions: rx.instructions,
      prescribedBy: rx.prescribedBy || currentUser.name,
      encounterTokenId: rx.encounterTokenId,
      startDate: new Date().toISOString().split('T')[0],
      status: 'Active',
    });
    if (rx.encounterTokenId) {
      const stockItem = pharmacy.find((item) =>
        medication.name.toLowerCase().includes(item.name.toLowerCase()) ||
        medication.name.toLowerCase().includes(item.genericName.toLowerCase())
      );
      const quantity = Math.max(1, Number(rx.quantity) || 1);
      const unitPrice = Math.max(0, Number(rx.unitPrice) || stockItem?.unitPrice || 0);
      addTokenLineItem(rx.encounterTokenId, {
        id: medication.id,
        kind: 'Medication',
        name: medication.name,
        department: 'Pharmacy',
        code: medication.catalogCode || stockItem?.sku,
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
        orderedBy: medication.prescribedBy,
        orderedAt: new Date().toISOString(),
      });
    }
    appendPatientVisit(patientId, {
      visitDate: new Date().toISOString().split('T')[0],
      doctorName: rx.prescribedBy || currentUser.name,
      doctorSpecialty: 'Pharmacy / Prescribing',
      department: 'Pharmacy',
      clinicRoom: 'eRx / Pharmacy',
      visitType: 'Prescription / eRx',
      chiefComplaint: rx.reason || 'Medication refill',
      clinicalAssessment: `Prescription issued for ${rx.medicationName || rx.name}.`,
      primaryDiagnosis: { code: 'PRESC-RX', description: 'Medication prescribed' },
      medicationsPrescribed: [rx.medicationName || rx.name],
      diagnosticOrders: [],
      disposition: 'Follow-up Scheduled',
      signedAt: new Date().toISOString(),
    });
  };

  const bookAppointment = (
    aptData: Omit<Appointment, 'id' | 'queueNumber' | 'createdAt'>
  ): Appointment => {
    const queueNum = appointments.filter((a) => a.date === aptData.date).length + 1;
    const newApt: Appointment = {
      ...aptData,
      id: `APT-2026-${String(appointments.length + 1).padStart(3, '0')}`,
      queueNumber: queueNum,
      estimatedWaitMinutes: queueNum * 15,
      createdAt: new Date().toISOString(),
    };
    setAppointments((prev) => [...prev, newApt]);
    logAuditEvent('CREATE', 'Appointment', newApt.id, `Booked slot for ${newApt.patientName} with ${newApt.doctorName}`);
    addNotification(
      'Appointment Confirmed',
      `Live slot confirmed for ${newApt.patientName} with ${newApt.doctorName} on ${newApt.date} at ${newApt.timeSlot}.`,
      'info',
      newApt.id
    );
    return newApt;
  };

  const addAppointment = (aptData: any): Appointment => {
    const patient = patients.find((p) => p.id === aptData.patientId);
    const doctor = doctors.find((d) => d.id === aptData.doctorId);

    const fullData: Omit<Appointment, 'id' | 'queueNumber' | 'createdAt'> = {
      patientId: aptData.patientId,
      patientName:
        aptData.patientName ||
        (patient ? `${patient.firstName} ${patient.lastName}` : 'Patient'),
      patientPhone: aptData.patientPhone || patient?.phone || patient?.mobile || undefined,
      patientNationalId: aptData.patientNationalId || patient?.emiratesId || undefined,
      patientPassportNo: aptData.patientPassportNo || patient?.passportNo || undefined,
      patientRegistrationNo: aptData.patientRegistrationNo || patient?.rgNo || patient?.id || undefined,
      bookingChannel: aptData.bookingChannel,
      patientAge: aptData.patientAge ?? (patient ? patient.age : 35),
      patientGender: aptData.patientGender || (patient ? patient.gender : 'Unknown'),
      doctorId: aptData.doctorId,
      doctorName: aptData.doctorName || (doctor ? doctor.name : 'Attending Physician'),
      department: aptData.department || (doctor ? doctor.department : 'General OPD'),
      roomNumber: aptData.roomNumber || (doctor ? doctor.roomNumber : 'Room 101'),
      date: aptData.date || new Date().toISOString().split('T')[0],
      timeSlot: aptData.timeSlot || '10:00 AM',
      type: aptData.type || 'General Consultation',
      status: aptData.status || 'Scheduled',
      priority: aptData.priority || 'Normal',
      reason:
        aptData.reason ||
        aptData.reasonForVisit ||
        aptData.chiefComplaint ||
        'Clinical Review',
      notes: aptData.notes || '',
      estimatedWaitMinutes:
        aptData.estimatedWaitMinutes ??
        (aptData.priority === 'Emergency' ? 0 : aptData.priority === 'Urgent' ? 5 : 15),
      isTelehealth: aptData.isTelehealth ?? false,
      telehealthDetails: aptData.telehealthDetails,
    };

    return bookAppointment(fullData);
  };

  const updateAppointmentStatus = (
    aptId: string,
    status: AppointmentStatus,
    cancellation?: { reason: string; details?: string }
  ) => {
    if (status === 'Cancelled' && !cancellation?.reason.trim()) return;
    let affectedApt: Appointment | undefined;
    setAppointments((prev) =>
      prev.map((apt) => {
        if (apt.id === aptId) {
          affectedApt = {
            ...apt,
            status,
            cancellationReason: status === 'Cancelled' ? cancellation?.reason.trim() : apt.cancellationReason,
            cancellationNotes: status === 'Cancelled' ? cancellation?.details?.trim() : apt.cancellationNotes,
          };
          return affectedApt;
        }
        return apt;
      })
    );
    if (affectedApt) {
      logAuditEvent(
        'UPDATE',
        'Appointment',
        aptId,
        status === 'Cancelled'
          ? `Status updated to Cancelled. Reason: ${affectedApt.cancellationReason}${affectedApt.cancellationNotes ? ` · ${affectedApt.cancellationNotes}` : ''}`
          : `Status updated to ${status}`
      );
      if (status === 'In Consultation') {
        setDoctors((prev) =>
          prev.map((d) => (d.id === affectedApt?.doctorId ? { ...d, status: 'In Consultation' } : d))
        );
        addNotification(
          'Consultation Started',
          `${affectedApt.doctorName} started session with ${affectedApt.patientName}.`,
          'info',
          affectedApt.id
        );
      } else if (status === 'Completed') {
        setDoctors((prev) =>
          prev.map((d) => (d.id === affectedApt?.doctorId ? { ...d, status: 'Available' } : d))
        );
        addNotification(
          'Consultation Finished',
          `Session complete for ${affectedApt.patientName}.`,
          'success',
          affectedApt.id
        );
      }
    }
  };

  const callNextAppointment = (doctorId?: string) => {
    const queue = appointments.filter(
      (a) =>
        (doctorId ? a.doctorId === doctorId : true) &&
        (a.status === 'Checked-In' || a.status === 'Scheduled')
    );
    if (queue.length === 0) {
      addNotification('Queue Empty', 'No waiting patients in queue for this physician.', 'info');
      return;
    }
    const nextPatient = queue[0];
    updateAppointmentStatus(nextPatient.id, 'In Consultation');
  };

  const applyInvoiceServiceDispositions = (invoice: Invoice) => {
    if (invoice.status === 'Draft') return;
    const dispositionByServiceId = new Map<string, 'Billed' | 'Deferred'>();
    invoice.items.forEach((item) => {
      if (item.sourceServiceId) dispositionByServiceId.set(item.sourceServiceId, 'Billed');
    });
    (invoice.deferredItems || []).forEach((item) => {
      if (item.sourceServiceId) dispositionByServiceId.set(item.sourceServiceId, 'Deferred');
    });
    if (!dispositionByServiceId.size) return;

    const updatedAt = new Date().toISOString();
    setPatients((prev) => prev.map((patient) => patient.id !== invoice.patientId ? patient : {
      ...patient,
      services: patient.services?.map((service) => {
        const status = dispositionByServiceId.get(service.id);
        return status ? {
          ...service,
          billingStatus: status,
          invoiceId: status === 'Billed' ? invoice.id : undefined,
          deferredAt: status === 'Deferred' ? updatedAt : undefined,
        } : service;
      }),
      updatedAt,
    }));

    if (invoice.encounterTokenId) {
      setReceptionTokens((prev) => prev.map((token) => {
        if (token.id !== invoice.encounterTokenId) return token;
        const existingStates = token.serviceBillingStates || [];
        const nextStates = [...existingStates.filter((state) => !dispositionByServiceId.has(state.serviceId))];
        dispositionByServiceId.forEach((status, serviceId) => nextStates.push({
          serviceId,
          status,
          invoiceId: status === 'Billed' ? invoice.id : undefined,
          updatedAt,
          updatedBy: currentUser.name,
        }));
        return { ...token, serviceBillingStates: nextStates };
      }));
    }
  };

  const createInvoice = (
    invData: Omit<Invoice, 'id' | 'subtotal' | 'patientPayable' | 'amountPaid' | 'balanceDue' | 'transactions'>
  ): Invoice | null => {
    const createdAt = invData.createdAt || new Date().toISOString();
    const linkedToken = invData.encounterTokenId
      ? receptionTokens.find((token) => token.id === invData.encounterTokenId)
      : undefined;
    if (invData.encounterTokenId && !linkedToken) {
      addNotification('Invoice Not Created', 'The selected visit token could not be found.', 'warning', invData.encounterTokenId);
      return null;
    }
    const tokenLineItems = linkedToken
      ? linkedToken.lineItems?.length ? linkedToken.lineItems : appendTokenLineItems(
          createServiceLineItems(linkedToken, linkedToken.serviceItems || []),
          linkedToken.doctorOrders ? createDoctorOrderLineItems(linkedToken, linkedToken.doctorOrders) : []
        )
      : [];
    let invoiceItems = invData.items;
    let tokenBillingTotals: ReturnType<typeof aggregateTokenLineItemBilling> | undefined;
    if (linkedToken) {
      const requestedIds = new Set(invData.items.map((item) => item.sourceServiceId || item.id));
      const billedLineItems = tokenLineItems.filter((item) => requestedIds.has(item.id));
      const unmatchedItems = invData.items.filter((item) =>
        !tokenLineItems.some((lineItem) => lineItem.id === (item.sourceServiceId || item.id))
      );
      if (!billedLineItems.length || unmatchedItems.length) {
        addNotification(
          'Invoice Not Created',
          'Every charge on a token-linked invoice must match a line item on that visit token.',
          'warning',
          linkedToken.id
        );
        return null;
      }
      const unresolvedItems = billedLineItems.filter((item) => getEffectiveLineItemStatus(item) === 'Pending_Auth');
      if (unresolvedItems.length && invData.status !== 'Draft') {
        addNotification(
          'Invoice Not Created: Authorization Pending',
          `Resolve authorization for ${unresolvedItems.map((item) => item.name).join(', ')} before issuing this invoice.`,
          'warning',
          linkedToken.id
        );
        return null;
      }
      tokenBillingTotals = aggregateTokenLineItemBilling(billedLineItems);
      invoiceItems = invData.items.map((item) => {
        const lineItem = billedLineItems.find((entry) => entry.id === (item.sourceServiceId || item.id));
        if (!lineItem) return item;
        const breakdown = getTokenLineItemBillingBreakdown(lineItem);
        return {
          ...item,
          id: lineItem.id,
          description: lineItem.name,
          unitCost: lineItem.unitPrice,
          quantity: lineItem.quantity,
          amount: breakdown.total,
          totalPrice: breakdown.total,
          netAmount: breakdown.total,
          discountAmount: 0,
          insuranceAmount: breakdown.insuranceCoveredAmount,
          copayAmount: breakdown.copayAmount,
        };
      });
    }
    const subtotal = invoiceItems.reduce(
      (sum, item) => sum + (Number(item.amount ?? item.totalPrice) || 0),
      0
    );
    const hasInsuranceBreakdown = invoiceItems.some((item) => item.insuranceAmount !== undefined);
    const netTotal = invoiceItems.reduce(
      (sum, item) => sum + (Number(item.netAmount ?? item.amount ?? item.totalPrice) || 0),
      0
    );
    const insuranceCovered = tokenBillingTotals?.insuranceCoveredAmount ??
      (Number(invData.insuranceCoveredAmount ?? invData.insuranceCovered) || 0);
    const copay = tokenBillingTotals?.copayAmount ?? (Number(invData.copayAmount) || 0);
    const patientPayable = hasInsuranceBreakdown
      ? Math.max(0, netTotal - insuranceCovered)
      : Math.max(0, netTotal - insuranceCovered + copay);
    const sanitizedItems: BillItem[] = invoiceItems.map((it) => {
      const amt = Number(it.amount ?? it.totalPrice) || 0;
      return {
        ...it,
        unitCost: Number(it.unitCost) || amt,
        amount: amt,
        totalPrice: Number(it.totalPrice) || amt,
      };
    });

    const newInvoice: Invoice = {
      ...invData,
      id: `INV-2026-${String(invoices.length + 82).padStart(4, '0')}`,
      invoiceTime:
        invData.invoiceTime ||
        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      createdAt,
      items: sanitizedItems,
      subtotal,
      tax: 0,
      totalAmount: netTotal,
      discountAmount: tokenBillingTotals ? 0 : Number(invData.discountAmount) || sumInvoiceItemField(invoiceItems, 'discountAmount'),
      paidAmount: 0,
      insuranceCoveredAmount: insuranceCovered,
      insuranceCovered,
      copayAmount: copay,
      deductibleAmount: Number(invData.deductibleAmount) || 0,
      patientPayable,
      amountPaid: 0,
      balanceDue: patientPayable,
      dueRecordedAt: patientPayable > 0 && invData.status !== 'Draft' ? createdAt : undefined,
      dueRecordedBy: patientPayable > 0 && invData.status !== 'Draft' ? currentUser.name : undefined,
      dueRemarks: patientPayable > 0 && invData.status !== 'Draft' ? invData.dueRemarks?.trim() : undefined,
      transactions: [],
    };
    setInvoices((prev) => [newInvoice, ...prev]);
    applyInvoiceServiceDispositions(newInvoice);
    const primaryDiagnosis = newInvoice.diagnoses?.[0];
    appendPatientVisit(newInvoice.patientId, {
      visitDate: newInvoice.issueDate,
      doctorName: primaryDiagnosis?.doctorName || newInvoice.patientName,
      doctorSpecialty: 'Billing & Finance',
      department: 'Billing & Claims',
      clinicRoom: 'Cashier / Billing Desk',
      visitType: 'Billing & Claims',
      chiefComplaint: primaryDiagnosis?.description || 'Invoice generated',
      clinicalAssessment: `Billing record created for ${newInvoice.items.length} service entries${newInvoice.encounterTokenId ? ` from visit ${newInvoice.encounterTokenId}` : ''}.`,
      primaryDiagnosis: primaryDiagnosis
        ? { code: primaryDiagnosis.code, description: primaryDiagnosis.description }
        : { code: 'BILL-ISSUED', description: 'Invoice generated without a doctor-entered diagnosis' },
      diagnosticOrders: newInvoice.items.map((item) => item.description),
      medicationsPrescribed: [],
      disposition: 'Follow-up Scheduled',
      signedAt: new Date().toISOString(),
    });
    logAuditEvent(
      'CREATE',
      'Billing Invoice',
      newInvoice.id,
      `Created ${newInvoice.status.toLowerCase()} ${newInvoice.encounterType || ''} invoice for ${newInvoice.patientName}, total $${subtotal}; services: ${newInvoice.items.map((item) => item.description).join('; ')}; diagnoses: ${(newInvoice.diagnoses || []).map((diagnosis) => `${diagnosis.code} ${diagnosis.description}`).join('; ') || 'none recorded by doctor'}.`,
      'PCI-DSS Payment Log'
    );
    addNotification(
      'Medical Invoice Created',
      `Invoice ${newInvoice.id} generated for ${newInvoice.patientName} ($${(patientPayable || 0).toFixed(2)} due).`,
      'info',
      newInvoice.id
    );
    return newInvoice;
  };

  const issueInvoice = (invoiceId: string) => {
    if (currentRole !== 'admin' && currentRole !== 'receptionist') return;
    const invoice = invoices.find((item) => item.id === invoiceId && item.status === 'Draft');
    if (!invoice) return;
    if (invoice.balanceDue > 0 && !invoice.dueRemarks?.trim()) {
      addNotification(
        'Due remark required',
        `Add a reason for the patient balance before issuing invoice ${invoiceId}.`,
        'warning',
        invoice.patientId
      );
      return;
    }
    const hasPendingAuthorization = invoice.items.some((item) => insuranceApprovals.some((approval) =>
      approval.id === item.insuranceApprovalId && approval.approvalStatus !== 'Approved'
    ));
    const status: Invoice['status'] = invoice.insuranceCoveredAmount > 0 || hasPendingAuthorization
      ? 'Pending Insurance'
      : invoice.balanceDue <= 0
      ? 'Paid'
      : 'Pending';
    const issuedAt = new Date().toISOString();
    setInvoices((prev) => prev.map((item) => item.id === invoiceId ? {
      ...item,
      status,
      issueDate: issuedAt.slice(0, 10),
      invoiceTime: new Date(issuedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      dueRecordedAt: item.balanceDue > 0 ? issuedAt : undefined,
      dueRecordedBy: item.balanceDue > 0 ? currentUser.name : undefined,
      dueRemarks: item.balanceDue > 0 ? item.dueRemarks?.trim() : undefined,
    } : item));
    applyInvoiceServiceDispositions({ ...invoice, status });
    logAuditEvent('UPDATE', 'Billing Invoice', invoiceId, `Invoice issued by ${currentUser.name}. Status set to ${status}.`, 'PCI-DSS Payment Log');
    addNotification('Invoice Issued', `Invoice ${invoiceId} is now available for settlement.`, 'success', invoiceId);
  };

  const processPayment = async (
    invoiceId: string,
    paymentData: { amount: number; method: PaymentMethod; cardLast4?: string }
  ): Promise<{ success: boolean; transaction: PaymentTransaction }> => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const payAmt = Number(paymentData.amount) || 0;
    const authCode = `AUTH-${Math.floor(100000 + Math.random() * 900000)}-SEC`;
    const newTxn: PaymentTransaction = {
      transactionId: `TXN-SEC-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: new Date().toISOString(),
      amountPaid: payAmt,
      method: paymentData.method,
      cardLast4: paymentData.cardLast4 || (paymentData.method === 'Credit/Debit Card' ? '4242' : undefined),
      authCode,
      gatewayStatus: 'Success',
    };
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          const prevPaid = Number(inv.amountPaid) || 0;
          const payable = Number(inv.patientPayable ?? inv.totalAmount ?? inv.subtotal) || 0;
          const totalPaid = prevPaid + payAmt;
          const newBalance = Math.max(0, payable - (totalPaid - (Number(inv.refundedAmount) || 0)));
          const newStatus = newBalance <= 0 ? 'Paid' : 'Partially Paid';
          return {
            ...inv,
            amountPaid: totalPaid,
            paidAmount: totalPaid,
            balanceDue: newBalance,
            status: newStatus,
            paymentMethod: paymentData.method,
            transactions: [...(inv.transactions || []), newTxn],
          };
        }
        return inv;
      })
    );
    logAuditEvent(
      'UPDATE',
      'Billing Invoice',
      invoiceId,
      `Payment of $${payAmt.toFixed(2)} settled via ${paymentData.method} (${authCode})`,
      'PCI-DSS Payment Log'
    );
    addNotification(
      'Payment Processed Successfully',
      `Secure payment of $${payAmt.toFixed(2)} approved via ${paymentData.method}.`,
      'success',
      invoiceId
    );
    return { success: true, transaction: newTxn };
  };

  const processSplitPayments = async (
    invoiceId: string,
    payments: Array<{ amount: number; method: PaymentMethod; pointsAuthorizationToken?: string; advanceId?: string }>,
    settlementDate?: string
  ): Promise<PaymentTransaction[]> => {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice || payments.length === 0) {
      throw new Error('Select a valid invoice and at least one payment method.');
    }
    const normalizedDate = settlementDate?.slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    if (normalizedDate && (normalizedDate > today || Number.isNaN(new Date(normalizedDate).getTime()))) {
      throw new Error('Settlement date cannot be in the future or invalid.');
    }
    const total = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    if (
      payments.some((payment) =>
        !Number.isFinite(Number(payment.amount)) ||
        Number(payment.amount) <= 0 ||
        Math.abs(Number(payment.amount) * 100 - Math.round(Number(payment.amount) * 100)) > 0.000001
      ) ||
      total > Number(invoice.balanceDue) + 0.001
    ) {
      throw new Error('Payment amounts must be positive and cannot exceed the outstanding invoice balance.');
    }
    const pointsPayment = payments.filter((payment) => payment.method === 'Loyalty Points');
    const totalPoints = pointsPayment.reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0);
    const advancePaymentAmount = payments
      .filter((payment) => payment.method === 'Patient Advance')
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const patientAdvances = advancePayments
      .filter((advance) => advance.patientId === invoice.patientId && advance.remainingBalance > 0)
      .sort((first, second) =>
        first.date.localeCompare(second.date) ||
        first.time.localeCompare(second.time) ||
        first.id.localeCompare(second.id)
      );
    const availableAdvanceBalance = patientAdvances.reduce(
      (sum, advance) => sum + Math.max(0, Number(advance.remainingBalance) || 0),
      0
    );
    if (advancePaymentAmount > availableAdvanceBalance + 0.001) {
      throw new Error(`The patient has only $${availableAdvanceBalance.toFixed(2)} available in advance deposits.`);
    }
    const requestedByAdvanceId = new Map<string, number>();
    payments.filter((payment) => payment.method === 'Patient Advance').forEach((payment) => {
      if (!payment.advanceId) {
        throw new Error('Select the advance receipt to apply each deposit amount from.');
      }
      requestedByAdvanceId.set(
        payment.advanceId,
        (requestedByAdvanceId.get(payment.advanceId) || 0) + Number(payment.amount)
      );
    });
    for (const [advanceId, requestedAmount] of requestedByAdvanceId) {
      const advance = patientAdvances.find((item) => item.id === advanceId);
      if (!advance || requestedAmount > Number(advance.remainingBalance) + 0.001) {
        throw new Error('An advance amount exceeds the available balance for its selected receipt.');
      }
    }
    const patient = patients.find((item) => item.id === invoice.patientId);
    if (pointsPayment.length && pointsPayment.some((payment) => !payment.pointsAuthorizationToken)) {
      throw new Error('Verify the registered mobile OTP before redeeming loyalty points.');
    }
    if (totalPoints > (patient?.loyaltyPoints || 0)) {
      throw new Error('The patient does not have enough loyalty points for this payment.');
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
    const remainingByAdvanceId = new Map<string, number>(
      patientAdvances.map((advance): [string, number] => [advance.id, Number(advance.remainingBalance) || 0])
    );
    const transactions: PaymentTransaction[] = payments.map((payment) => {
      const authCode = `AUTH-${Math.floor(100000 + Math.random() * 900000)}-SEC`;
      const advanceAllocations: NonNullable<PaymentTransaction['advanceAllocations']> = [];
      const paymentTimestamp = new Date(normalizedDate ? `${normalizedDate}T12:00:00` : new Date().toISOString());
      if (payment.method === 'Patient Advance') {
        const advance = patientAdvances.find((item) => item.id === payment.advanceId);
        if (advance) {
          const remainingBalance = remainingByAdvanceId.get(advance.id) || 0;
          const allocatedAmount = Number(payment.amount);
          advanceAllocations.push({
            advanceId: advance.id,
            receiptNumber: advance.receiptNumber,
            amount: allocatedAmount,
            utilizedAt: paymentTimestamp.toISOString(),
          });
          remainingByAdvanceId.set(advance.id, remainingBalance - allocatedAmount);
        }
      }
      return {
        transactionId: `TXN-SEC-${Math.floor(10000 + Math.random() * 90000)}`,
        timestamp: paymentTimestamp.toISOString(),
        amountPaid: Number(payment.amount),
        method: payment.method,
        loyaltyPointsRedeemed: payment.method === 'Loyalty Points' ? Math.round(payment.amount * 100) : undefined,
        advanceAllocations: payment.method === 'Patient Advance' ? advanceAllocations : undefined,
        authCode,
        gatewayStatus: 'Success',
      };
    });
    const totalPaid = transactions.reduce((sum, transaction) => sum + transaction.amountPaid, 0);
    if (advancePaymentAmount > 0) {
      setAdvancePayments((prev) => prev.map((advance) => {
        const remainingBalance = remainingByAdvanceId.get(advance.id);
        if (remainingBalance === undefined) return advance;
        const utilizationHistory = transactions.flatMap((transaction) =>
          (transaction.advanceAllocations || [])
            .filter((allocation) => allocation.advanceId === advance.id)
            .map((allocation) => ({
              invoiceId,
              transactionId: transaction.transactionId,
              date: allocation.utilizedAt,
              amount: allocation.amount,
            }))
        );
        return {
          ...advance,
          remainingBalance: Math.max(0, remainingBalance),
          utilizationHistory: [...(advance.utilizationHistory || []), ...utilizationHistory],
          status: remainingBalance <= 0 ? 'Utilized' : 'Partially Utilized',
        };
      }));
    }
    if (totalPoints > 0) {
      setPatients((prev) => prev.map((item) => item.id === invoice.patientId
        ? { ...item, loyaltyPoints: Math.max(0, (item.loyaltyPoints || 0) - totalPoints) }
        : item
      ));
    }
    setInvoices((prev) =>
      prev.map((item) => {
        if (item.id !== invoiceId) return item;
        const paid = (Number(item.amountPaid) || 0) + totalPaid;
        const balanceDue = Math.max(0, (Number(item.patientPayable) || 0) - (paid - (Number(item.refundedAmount) || 0)));
        return {
          ...item,
          amountPaid: paid,
          paidAmount: paid,
          balanceDue,
          status: balanceDue <= 0 ? 'Paid' : 'Partially Paid',
          paymentMethod: transactions[transactions.length - 1].method,
          transactions: [...(item.transactions || []), ...transactions],
        };
      })
    );
    transactions.forEach((transaction) => {
      logAuditEvent(
        'UPDATE',
        'Billing Invoice',
        invoiceId,
        `Payment of $${transaction.amountPaid.toFixed(2)} settled via ${transaction.method} (${transaction.authCode})${transaction.advanceAllocations?.length ? `; advance receipts applied: ${transaction.advanceAllocations.map((allocation) => `${allocation.receiptNumber} $${allocation.amount.toFixed(2)}`).join(', ')}` : ''}`,
        'PCI-DSS Payment Log'
      );
    });
    addNotification(
      'Payment Processed Successfully',
      `Split payment of $${totalPaid.toFixed(2)} recorded for invoice ${invoiceId}${advancePaymentAmount ? `; $${advancePaymentAmount.toFixed(2)} applied from advance deposits` : ''}${totalPoints ? `; ${totalPoints} loyalty points redeemed` : ''}.`,
      'success',
      invoiceId
    );
    return transactions;
  };

  const addAdvancePayment = (data: Omit<AdvancePayment, 'id' | 'receiptNumber'>): AdvancePayment => {
    const seq = advancePayments.length + 1;
    const newId = `ADV-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`;
    const receiptNumber = `RCP-ADV-${Math.floor(1000 + Math.random() * 9000)}`;
    const newRecord: AdvancePayment = {
      ...data,
      id: newId,
      receiptNumber,
    };
    setAdvancePayments((prev) => [newRecord, ...prev]);
    setPatients((prev) => prev.map((patient) => {
      if (patient.id !== data.patientId) return patient;
      const existingBalance = Number(patient.advanceBalance || 0);
      return {
        ...patient,
        advanceBalance: Number((existingBalance + Number(data.amount)).toFixed(2)),
        updatedAt: new Date().toISOString(),
      };
    }));

    // Auto-record POS transaction for card or cash
    const isCard = data.paymentMethod === 'Credit/Debit Card';
    const isCash = data.paymentMethod === 'Cash';
    if (isCard || isCash) {
      const posTx: PosTransaction = {
        id: `POS-TX-${Date.now().toString().slice(-6)}`,
        terminalId: data.terminalId || (isCard ? 'POS-TERM-01' : 'CASH-DRAWER-01'),
        terminalName: isCard ? 'Desk A - Verifone V200c' : 'Front Desk Cash POS',
        batchNumber: 'BATCH-4092',
        advanceId: newId,
        patientId: data.patientId,
        patientName: data.patientName,
        cardType: isCard ? 'Visa' : 'Cash / POS Drawer',
        cardLast4: isCard ? '8841' : undefined,
        authCode: `APPR-${Math.floor(10000 + Math.random() * 90000)}`,
        rrnNumber: `RRN-${Date.now()}`,
        amount: data.amount,
        status: 'Approved & Settled',
        transactionDate: data.date,
        transactionTime: data.time,
        cashierName: data.cashierName,
      };
      setPosTransactions((prev) => [posTx, ...prev]);
    }

    addNotification(
      'Advance Payment Recorded',
      `Advance receipt ${receiptNumber} generated for ${data.patientName}: $${data.amount.toFixed(2)} (${data.purpose}).`,
      'success'
    );
    logAuditEvent(
      'CREATE',
      'Billing Invoice',
      newId,
      `Advance deposit $${data.amount} collected for ${data.patientName} (${receiptNumber})`,
      'PCI-DSS Payment Log'
    );
    return newRecord;
  };

  const addRefundPayment = (data: Omit<RefundPayment, 'id' | 'voucherNumber'>): RefundPayment => {
    const seq = refundPayments.length + 1;
    const newId = `REF-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`;
    const voucherNumber = `RFND-VOUCH-${Math.floor(100 + Math.random() * 900)}`;
    const newRecord: RefundPayment = {
      ...data,
      id: newId,
      voucherNumber,
    };
    setRefundPayments((prev) => [newRecord, ...prev]);

    addNotification(
      'Refund Submitted for Approval',
      `Refund request ${voucherNumber} for ${data.patientName}: $${data.amount.toFixed(2)} is awaiting manager approval.`,
      'info'
    );
    logAuditEvent(
      'CREATE',
      'Billing Invoice',
      newId,
      `Refund request of $${data.amount} submitted for ${data.patientName}. Voucher ${voucherNumber} is pending manager approval.`,
      'PCI-DSS Payment Log'
    );
    return newRecord;
  };

  const reviewRefundPayment = (id: string, decision: 'Approved' | 'Rejected') => {
    if (currentRole !== 'admin') return;
    const refund = refundPayments.find((item) => item.id === id && item.status === 'Pending Approval');
    if (!refund) return;
    const sourceAdvance = refund.originalReferenceType === 'Advance Deposit'
      ? advancePayments.find((item) => item.id === refund.originalReferenceId || item.receiptNumber === refund.originalReferenceId)
      : undefined;
    const sourceInvoice = refund.originalReferenceType !== 'Advance Deposit'
      ? invoices.find((item) => item.id === refund.originalReferenceId)
      : undefined;
    if (decision === 'Approved' && refund.originalReferenceType === 'Advance Deposit' && (!sourceAdvance || sourceAdvance.remainingBalance < refund.amount)) {
      addNotification(
        'Refund Approval Blocked',
        `Voucher ${refund.voucherNumber} exceeds the remaining advance balance and cannot be approved.`,
        'warning'
      );
      return;
    }
    if (
      decision === 'Approved' &&
      refund.originalReferenceType !== 'Advance Deposit' &&
      (!sourceInvoice || (Number(sourceInvoice.amountPaid) || 0) - (Number(sourceInvoice.refundedAmount) || 0) < refund.amount)
    ) {
      addNotification(
        'Refund Approval Blocked',
        `Voucher ${refund.voucherNumber} exceeds the refundable paid balance and cannot be approved.`,
        'warning'
      );
      return;
    }
    setRefundPayments((prev) => prev.map((item) =>
      item.id === id
        ? { ...item, status: decision === 'Approved' ? 'Completed' : 'Rejected', authorizedBy: currentUser.name }
        : item
    ));
    if (decision === 'Approved' && refund.originalReferenceType === 'Advance Deposit') {
      setAdvancePayments((prev) => prev.map((advance) => {
        if (advance.id !== refund.originalReferenceId && advance.receiptNumber !== refund.originalReferenceId) return advance;
        const remainingBalance = Math.max(0, advance.remainingBalance - refund.amount);
        return {
          ...advance,
          remainingBalance,
          status: remainingBalance === 0 ? 'Refunded' : 'Partially Utilized',
        };
      }));
    }
    if (decision === 'Approved' && sourceInvoice) {
      setInvoices((prev) => prev.map((invoice) => {
        if (invoice.id !== sourceInvoice.id) return invoice;
        const refundedAmount = (Number(invoice.refundedAmount) || 0) + refund.amount;
        const cancelledService = refund.originalReferenceType === 'Service Cancellation';
        const patientPayable = Math.max(
          0,
          (Number(invoice.patientPayable) || 0) - (cancelledService ? refund.amount : 0)
        );
        const balanceDue = Math.max(0, patientPayable - ((Number(invoice.amountPaid) || 0) - refundedAmount));
        return {
          ...invoice,
          refundedAmount,
          ...(cancelledService ? {
            patientPayable,
            subtotal: Math.max(0, invoice.subtotal - refund.amount),
            totalAmount: Math.max(0, (Number(invoice.totalAmount) || invoice.subtotal) - refund.amount),
          } : {}),
          balanceDue,
          status: patientPayable === 0 && refundedAmount >= (Number(invoice.amountPaid) || 0)
            ? 'Refunded'
            : balanceDue === 0
            ? 'Paid'
            : 'Partially Paid',
        };
      }));
    }
    logAuditEvent(
      'UPDATE',
      'Billing Invoice',
      id,
      `Finance manager ${currentUser.name} ${decision.toLowerCase()} refund voucher ${refund.voucherNumber}.`,
      'PCI-DSS Payment Log'
    );
    addNotification(
      `Refund ${decision}`,
      `${refund.voucherNumber} was ${decision.toLowerCase()} by ${currentUser.name}.`,
      decision === 'Approved' ? 'success' : 'warning'
    );
  };

  const syncTokenLineItemAuthorization = (
    approval: InsuranceApproval,
    status: TokenLineItem['insuranceStatus']
  ) => {
    if (!approval.encounterTokenId) return;
    setReceptionTokens((prev) => prev.map((token) => {
      if (token.id !== approval.encounterTokenId) return token;
      const existingItems = token.lineItems?.length
        ? token.lineItems
        :
        appendTokenLineItems(
          createServiceLineItems(token, token.serviceItems || []),
          token.doctorOrders ? createDoctorOrderLineItems(token, token.doctorOrders) : []
        );
      const byServiceId = approval.serviceRecordId
        ? existingItems.filter((item) => item.id === approval.serviceRecordId)
        : [];
      const byCode = !byServiceId.length && approval.serviceCode
        ? existingItems.filter((item) => item.code === approval.serviceCode)
        : [];
      const matchingItems = byServiceId.length
        ? byServiceId
        : byCode.length
          ? byCode
          : existingItems.filter((item) => item.name.trim().toLowerCase() === approval.serviceName.trim().toLowerCase());
      if (!matchingItems.length) return token;
      const matchingIds = new Set(matchingItems.map((item) => item.id));
      const updatedLineItems = existingItems.map((item) => matchingIds.has(item.id)
        ? {
            ...item,
            insuranceStatus: status,
            insuranceApprovalId: approval.id,
            insuranceApprovedAmount: status === 'Approved' || status === 'Partially_Approved'
              ? approval.approvedAmount
              : undefined,
            copayAmount: status === 'Approved' || status === 'Partially_Approved'
              ? approval.copayAmount
              : undefined,
            insuranceRemarks: approval.remarks,
          }
        : item);
      const logItem = {
        stage: token.currentStage || '3_DOCTOR_EMR',
        timestamp: new Date().toISOString(),
        action: `Insurance response updated ${matchingItems.map((item) => item.name).join(', ')} to ${status}.`,
        actor: currentUser.name,
      };
      return {
        ...token,
        lineItems: updatedLineItems,
        historyLogs: [...(token.historyLogs || []), logItem],
      };
    }));
  };

  const addInsuranceApproval = (data: Omit<InsuranceApproval, 'id'>): InsuranceApproval | null => {
    if (
      currentRole !== 'doctor' ||
      (data.approvalStatus !== 'Pending' && data.approvalStatus !== 'Waiver Notification Due')
    ) return null;
    const missingFields = validateInsuranceRequestPayload(data);
    if (missingFields.length && !data.emergencyWaiver) {
      addNotification(
        'Authorization Request Not Recorded',
        `Complete the required UAE payer payload fields: ${missingFields.join(', ')}.`,
        'warning',
        data.patientId
      );
      return null;
    }
    const seq = insuranceApprovals.length + 1;
    const newId = `APP-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`;
    const newRecord: InsuranceApproval = {
      ...data,
      id: newId,
    };
    setInsuranceApprovals((prev) => [newRecord, ...prev]);
    addNotification(
      data.emergencyWaiver ? 'Emergency Waiver Recorded' : 'Insurance Authorization Request Recorded',
      data.emergencyWaiver
        ? `Immediate treatment waiver recorded for ${data.patientName}; post-stabilization payer notification is due within 24 hours.`
        : `Internal authorization request recorded for ${data.patientName} under ${data.doctorName} (${data.serviceCategory}: ${data.serviceName}).`,
      data.emergencyWaiver ? 'warning' : 'info'
    );
    logAuditEvent(
      'CREATE',
      'Billing Invoice',
      newId,
      `${data.emergencyWaiver ? 'Recorded emergency waiver for' : 'Recorded pre-authorisation request for'} ${data.patientName} under ${data.doctorName}`,
      'HIPAA Access Log'
    );
    return newRecord;
  };

  const addCoderInsuranceApproval = (data: Omit<InsuranceApproval, 'id'>): InsuranceApproval | null => {
    if (
      currentRole !== 'medical-coder' ||
      data.approvalStatus !== 'Approved' ||
      !data.approvalNumber.trim() ||
      !patients.some((patient) => patient.id === data.patientId)
    ) {
      return null;
    }
    const seq = insuranceApprovals.length + 1;
    const newId = `APP-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`;
    const newRecord: InsuranceApproval = { ...data, id: newId };
    setInsuranceApprovals((prev) => [newRecord, ...prev]);
    syncTokenLineItemAuthorization(
      newRecord,
      newRecord.approvedAmount >= newRecord.estimatedCost ? 'Approved' : 'Partially_Approved'
    );
    addNotification(
      'Insurance Approval Recorded',
      `Authorization ${data.approvalNumber} recorded for ${data.patientName} under ${data.department}.`,
      'success'
    );
    logAuditEvent(
      'CREATE',
      'Billing Invoice',
      newId,
      `Medical coder ${currentUser.name} recorded insurer approval ${data.approvalNumber} for ${data.patientName} under ${data.department}.`,
      'HIPAA Access Log'
    );
    return newRecord;
  };

  const updateInsuranceApprovalStatus = (
    id: string,
    status: Exclude<InsuranceApproval['approvalStatus'], 'Approved' | 'Pending'>,
    remarks?: string
  ) => {
    if (currentRole !== 'medical-coder') return;
    if (status === 'Waiver Notified') {
      const approval = insuranceApprovals.find((item) => item.id === id);
      if (!approval?.emergencyWaiver?.stabilizedAt || !approval.emergencyWaiver.postStabilizationNotificationDueAt) {
        addNotification('Emergency Notification Not Recorded', 'Record the stabilization time before logging the 24-hour post-stabilization notice.', 'warning', approval?.patientId);
        return;
      }
    }
    setInsuranceApprovals((prev) =>
      prev.map((app) =>
        app.id === id
          ? (() => {
            const response = remarks !== undefined ? remarks : app.remarks || '';
            const rejectionCode = extractRejectionCode(response) || app.rejectionCode;
            const isResponseRequiringAppeal = status === 'Pending Info' || status === 'Query Raised' || status === 'Rejected';
            const missingFields = isResponseRequiringAppeal
              ? [...new Set([
                  ...(app.missingFields || []),
                  ...getRejectionMissingFields(rejectionCode, app),
                ])]
              : app.missingFields;
            const updated = {
              ...app,
              approvalStatus: status,
              remarks: response,
              rejectionCode,
              missingFields,
              emergencyWaiver: status === 'Waiver Notified' && app.emergencyWaiver
                ? { ...app.emergencyWaiver, notifiedAt: new Date().toISOString() }
                : app.emergencyWaiver,
            };
            return isResponseRequiringAppeal
              ? { ...updated, appealDraft: createInsuranceAppealDraft(updated) }
              : updated;
          })()
          : app
      )
    );
    const linkedApproval = insuranceApprovals.find((item) => item.id === id);
    if (linkedApproval) {
      syncTokenLineItemAuthorization(linkedApproval, status === 'Rejected' ? 'Denied' : 'Pending_Auth');
    }
    addNotification('Insurance Pre-Auth Status Updated', `Authorisation ${id} status set to ${status}.`, 'info');
  };

  const recordEmergencyStabilization = (id: string, stabilizedAt: string): boolean => {
    if (currentRole !== 'doctor') return false;
    const approval = insuranceApprovals.find((item) => item.id === id);
    const stabilizationTime = new Date(stabilizedAt);
    if (approval && approval.doctorId !== currentUser.id && approval.doctorName !== currentUser.name) {
      addNotification('Stabilization Time Not Recorded', 'Only the treating physician recorded on this emergency request can record stabilization.', 'warning', approval.patientId);
      return false;
    }
    if (
      !approval?.emergencyWaiver ||
      !Number.isFinite(stabilizationTime.getTime()) ||
      stabilizationTime.getTime() > Date.now() ||
      (approval.requestedAt && stabilizationTime.toISOString() < approval.requestedAt)
    ) {
      addNotification('Stabilization Time Not Recorded', 'Enter a valid stabilization time after emergency care began.', 'warning', approval?.patientId);
      return false;
    }
    const notificationDueAt = new Date(stabilizationTime.getTime() + 24 * 60 * 60 * 1000).toISOString();
    setInsuranceApprovals((prev) => prev.map((item) => item.id === id
      ? {
          ...item,
          emergencyWaiver: item.emergencyWaiver
            ? {
                ...item.emergencyWaiver,
                stabilizedAt: stabilizationTime.toISOString(),
                stabilizedBy: currentUser.name,
                postStabilizationNotificationDueAt: notificationDueAt,
              }
            : undefined,
          remarks: 'Emergency waiver recorded. 24-hour post-stabilization notification target is active.',
        }
      : item
    ));
    addNotification('Post-Stabilization SLA Started', `Emergency payer notification due by ${new Date(notificationDueAt).toLocaleString()}.`, 'info', approval.patientId);
    logAuditEvent('UPDATE', 'Billing Invoice', id, `Treating physician ${currentUser.name} recorded stabilization time ${stabilizationTime.toISOString()}; post-stabilization notification due ${notificationDueAt}.`, 'HIPAA Access Log');
    return true;
  };

  const saveInsuranceAppealDraft = (id: string, appealDraft: string): boolean => {
    if (currentRole !== 'doctor') return false;
    const approval = insuranceApprovals.find((item) => item.id === id);
    if (
      !approval ||
      (approval.doctorId !== currentUser.id && approval.doctorName !== currentUser.name) ||
      !['Pending Info', 'Query Raised', 'Rejected'].includes(approval.approvalStatus) ||
      !appealDraft.trim()
    ) {
      addNotification('Appeal Draft Not Saved', 'Only the treating physician can save a non-empty appeal for a query or denied request.', 'warning', approval?.patientId);
      return false;
    }
    const savedDraft = appealDraft.trim();
    setInsuranceApprovals((prev) => prev.map((item) => item.id === id
      ? { ...item, appealDraft: savedDraft }
      : item
    ));
    addNotification('Appeal Draft Saved', 'The physician appeal draft is saved for manual payer submission; no external gateway submission occurred.', 'success', approval.patientId);
    logAuditEvent('UPDATE', 'Billing Invoice', id, `Treating physician ${currentUser.name} saved an appeal draft for manual submission; no external gateway submission occurred.`, 'HIPAA Access Log');
    return true;
  };

  const publishInsuranceApproval = (
    id: string,
    details: Pick<InsuranceApproval, 'approvalNumber' | 'approvedAmount' | 'copayPercentage' | 'validUntil'>
  ): boolean => {
    if (currentRole !== 'medical-coder') return false;
    const approval = insuranceApprovals.find((item) => item.id === id);
    if (!approval || !['Pending', 'Pending Info', 'Query Raised'].includes(approval.approvalStatus)) return false;
    const currentEligibility = approval.eligibilityClassification
      ? classifyInsuranceEligibility({
          payerId: approval.payerId || '',
          cptCode: approval.serviceCode || '',
          icd10Code: approval.icd10Code || '',
          isExcluded: approval.eligibilityClassification === 'Excluded',
          isPreExisting: approval.eligibilityClassification === 'Pre-Existing',
        }, loadInsuranceCodeMappings())
      : undefined;
    if (currentEligibility && currentEligibility !== 'Pre-Authorization Required') {
      addNotification('Approval Not Published', `The current payer rule classifies this item as ${currentEligibility}; only mapped pre-authorization requests can be published.`, 'warning', approval.patientId);
      return false;
    }
    if (
      !details.approvalNumber.trim() ||
      !Number.isFinite(details.approvedAmount) ||
      details.approvedAmount <= 0 ||
      details.approvedAmount > approval.estimatedCost ||
      !Number.isFinite(details.copayPercentage) ||
      details.copayPercentage < 0 ||
      details.copayPercentage > 100 ||
      !details.validUntil ||
      details.validUntil < new Date().toISOString().slice(0, 10)
    ) {
      addNotification('Approval Not Published', 'Enter a valid payer authorization, amount not exceeding the request, copay from 0–100%, and a valid expiry date.', 'warning', approval.patientId);
      return false;
    }
    const copayAmount = (details.approvedAmount * details.copayPercentage) / 100;
    setInsuranceApprovals((prev) => prev.map((item) => item.id === id
      ? {
          ...item,
          ...details,
          copayAmount,
          approvalStatus: 'Approved',
          approvalDate: new Date().toISOString().slice(0, 10),
          authorisedBy: currentUser.name,
          remarks: `Approval published by ${currentUser.name}.`,
          eligibilityClassification: currentEligibility || item.eligibilityClassification,
          financialBreakdown: item.financialBreakdown
            ? {
                ...item.financialBreakdown,
                approvedAmount: details.approvedAmount,
                copayPercentage: details.copayPercentage,
                copayAmount,
                patientPayable: Math.max(0, item.estimatedCost - details.approvedAmount) + copayAmount,
              }
            : undefined,
        }
      : item
    ));
    syncTokenLineItemAuthorization(
      { ...approval, ...details, copayAmount },
      details.approvedAmount >= approval.estimatedCost ? 'Approved' : 'Partially_Approved'
    );
    addNotification('Insurance Approval Published', `Authorization ${details.approvalNumber} for ${approval.patientName} is approved and available to billing.`, 'success');
    logAuditEvent('UPDATE', 'Billing Invoice', id, `Medical coder ${currentUser.name} published insurance authorization ${details.approvalNumber}.`, 'HIPAA Access Log');
    return true;
  };

  const recordInsuranceGatewayResponse = (
    id: string,
    response: InsuranceGatewayLineItemResponse
  ): boolean => {
    if (currentRole !== 'medical-coder') return false;
    const approval = insuranceApprovals.find((item) => item.id === id);
    if (!approval || !approval.encounterTokenId) {
      addNotification('Payer Response Not Applied', 'The authorization request is not linked to a visit token.', 'warning', approval?.patientId);
      return false;
    }
    if (
      (response.status === 'Approved' || response.status === 'Partially_Approved') &&
      (!Number.isFinite(response.approvedAmount) || Number(response.approvedAmount) <= 0 || Number(response.approvedAmount) > approval.estimatedCost)
    ) {
      addNotification('Payer Response Not Applied', 'The approved amount must be positive and cannot exceed the requested amount.', 'warning', approval.patientId);
      return false;
    }
    if (
      response.copayAmount !== undefined &&
      (!Number.isFinite(response.copayAmount) || response.copayAmount < 0 || response.copayAmount > Number(response.approvedAmount || 0))
    ) {
      addNotification('Payer Response Not Applied', 'The returned copay must be non-negative and no greater than the approved amount.', 'warning', approval.patientId);
      return false;
    }
    const lineItemStatus: TokenLineItem['insuranceStatus'] =
      response.status === 'Approved' && Number(response.approvedAmount) < approval.estimatedCost
        ? 'Partially_Approved'
        : response.status;
    const approvalStatus: InsuranceApproval['approvalStatus'] =
      lineItemStatus === 'Denied' ? 'Rejected' :
      lineItemStatus === 'Pending_Auth' ? 'Pending' : 'Approved';
    const updatedApproval: InsuranceApproval = {
      ...approval,
      approvalStatus,
      approvedAmount: response.approvedAmount ?? approval.approvedAmount,
      copayAmount: response.copayAmount ?? approval.copayAmount,
      approvalNumber: response.approvalNumber?.trim() || approval.approvalNumber,
      remarks: response.remarks?.trim() || approval.remarks,
      gatewayStatus: 'Response Received',
      approvalDate: approvalStatus === 'Approved' ? new Date().toISOString().slice(0, 10) : approval.approvalDate,
      authorisedBy: currentUser.name,
    };
    setInsuranceApprovals((prev) => prev.map((item) => item.id === id ? updatedApproval : item));
    syncTokenLineItemAuthorization(updatedApproval, lineItemStatus);
    addNotification(
      'Payer Response Applied',
      `${updatedApproval.serviceName} for token ${approval.encounterTokenId} is ${lineItemStatus}.`,
      lineItemStatus === 'Denied' ? 'warning' : 'success',
      approval.encounterTokenId
    );
    logAuditEvent(
      'UPDATE',
      'Billing Invoice',
      id,
      `Insurance gateway response recorded as ${lineItemStatus} for visit token ${approval.encounterTokenId}.`,
      'HIPAA Access Log'
    );
    return true;
  };

  const recordTokenLineItemInsuranceResponse = (
    tokenId: string,
    lineItemId: string,
    response: InsuranceGatewayLineItemResponse
  ): boolean => {
    if (currentRole !== 'medical-coder') {
      addNotification('Payer Response Not Applied', 'Only Medical Coding / Insurance Approval can update token authorization statuses.', 'warning', tokenId);
      return false;
    }
    const token = receptionTokens.find((item) => item.id === tokenId);
    const lineItem = token?.lineItems?.find((item) => item.id === lineItemId);
    if (!token || !lineItem || (token.paymentScheme?.schemeType !== 'Insurance' && token.payMode !== 'Insurance')) {
      addNotification('Payer Response Not Applied', 'The insured visit token or requested line item could not be found.', 'warning', tokenId);
      return false;
    }
    if (
      ['Approved', 'Partially_Approved'].includes(response.status) &&
      (!Number.isFinite(response.approvedAmount) || Number(response.approvedAmount) <= 0 || Number(response.approvedAmount) > lineItem.totalPrice)
    ) {
      addNotification('Payer Response Not Applied', 'The approved amount must be positive and cannot exceed the token line-item total.', 'warning', tokenId);
      return false;
    }
    if (
      response.copayAmount !== undefined &&
      (!Number.isFinite(response.copayAmount) || response.copayAmount < 0 || response.copayAmount > Number(response.approvedAmount || 0))
    ) {
      addNotification('Payer Response Not Applied', 'The payer copay must be non-negative and no greater than the approved amount.', 'warning', tokenId);
      return false;
    }
    const status: TokenLineItem['insuranceStatus'] =
      response.status === 'Approved' && Number(response.approvedAmount) < lineItem.totalPrice
        ? 'Partially_Approved'
        : response.status;
    const responseAt = new Date().toISOString();
    setReceptionTokens((prev) => prev.map((item) => item.id !== tokenId ? item : {
      ...item,
      lineItems: item.lineItems?.map((entry) => entry.id !== lineItemId ? entry : {
        ...entry,
        insuranceStatus: status,
        insuranceApprovalId: response.approvalNumber?.trim() || entry.insuranceApprovalId,
        insuranceApprovedAmount: ['Approved', 'Partially_Approved'].includes(status)
          ? Number(response.approvedAmount)
          : undefined,
        copayAmount: ['Approved', 'Partially_Approved'].includes(status)
          ? Number(response.copayAmount) || 0
          : undefined,
        insuranceRemarks: response.remarks?.trim() || undefined,
        appealRequest: undefined,
      }),
      historyLogs: [
        ...(item.historyLogs || []),
        {
          stage: item.currentStage || '3_DOCTOR_EMR',
          timestamp: responseAt,
          action: `Payer response recorded for ${lineItem.name}: ${status}${response.remarks?.trim() ? ` — ${response.remarks.trim()}` : ''}.`,
          actor: currentUser.name,
        },
      ],
    }));
    addNotification(
      'Payer Response Applied',
      `${lineItem.name} on Token ${token.tokenNumber} is now ${status}.`,
      status === 'Denied' ? 'warning' : 'success',
      tokenId
    );
    logAuditEvent('UPDATE', 'Billing Invoice', lineItemId, `Medical coder ${currentUser.name} recorded a payer response (${status}) for visit token ${tokenId}.`, 'HIPAA Access Log');
    return true;
  };

  const submitTokenLineItemAppeal = (tokenId: string, lineItemId: string, reason: string): boolean => {
    if (currentRole !== 'doctor' || !reason.trim()) {
      addNotification('Appeal Not Submitted', 'Only the treating doctor can submit a non-empty appeal for a denied token item.', 'warning', tokenId);
      return false;
    }
    const token = receptionTokens.find((item) => item.id === tokenId);
    const lineItem = token?.lineItems?.find((item) => item.id === lineItemId);
    if (!token || !lineItem || lineItem.insuranceStatus !== 'Denied') {
      addNotification('Appeal Not Submitted', 'Select a denied line item on the current visit token.', 'warning', tokenId);
      return false;
    }
    const requestedAt = new Date().toISOString();
    setReceptionTokens((previous) => previous.map((item) => item.id !== tokenId ? item : {
      ...item,
      lineItems: item.lineItems?.map((entry) => entry.id !== lineItemId ? entry : {
        ...entry,
        appealRequest: { reason: reason.trim(), requestedBy: currentUser.name, requestedAt },
      }),
      historyLogs: [
        ...(item.historyLogs || []),
        {
          stage: item.currentStage || '3_DOCTOR_EMR',
          timestamp: requestedAt,
          action: `Appeal requested for ${lineItem.name}: ${reason.trim()}.`,
          actor: currentUser.name,
        },
      ],
    }));
    addNotification('Token Item Appeal Queued', `${lineItem.name} from Token ${token.tokenNumber} was sent to Medical Coding for appeal review.`, 'info', tokenId);
    logAuditEvent('UPDATE', 'Billing Invoice', lineItemId, `Treating doctor ${currentUser.name} submitted a payer appeal request for token ${tokenId}: ${reason.trim()}.`, 'HIPAA Access Log');
    return true;
  };

  const addPosTransaction = (data: Omit<PosTransaction, 'id' | 'rrnNumber'>): PosTransaction => {
    const newId = `POS-TX-${Date.now().toString().slice(-6)}`;
    const rrnNumber = `RRN-${Date.now()}`;
    const newRecord: PosTransaction = {
      ...data,
      id: newId,
      rrnNumber,
    };
    setPosTransactions((prev) => [newRecord, ...prev]);
    addNotification(
      'POS Transaction Recorded',
      `Card/Drawer transaction of $${data.amount.toFixed(2)} logged at ${data.terminalName}.`,
      'success'
    );
    return newRecord;
  };

  const createReceptionToken = (data: Omit<ReceptionToken, 'id' | 'tokenNumber' | 'createdDate' | 'createdTime'>): ReceptionToken => {
    const now = new Date();
    const nowDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const todaysTokens = receptionTokens.filter((token) => (token.createdDate || token.visitDate) === nowDate);

    const highestTodayToken = todaysTokens.reduce((highest, token) => {
      const parsedNumber = Number(token.tokenNumber.match(/\d+/)?.[0]);
      return Number.isFinite(parsedNumber) ? Math.max(highest, parsedNumber) : highest;
    }, 0);
    const tokenNumber = String(highestTodayToken + 1).padStart(2, '0');
    const id = `TOK-${nowDate.replace(/-/g, '')}-${tokenNumber}`;
    const patient = patients.find((item) => item.id === data.patientId);
    const insuranceScheme = data.paymentScheme?.schemeType === 'Insurance'
      ? data.paymentScheme
      : !data.paymentScheme && (data.payMode === 'Insurance' || (!data.payMode && patient?.payMode === 'Insurance'))
        ? {
            schemeType: 'Insurance' as const,
            insuranceProvider: data.insuranceProvider || patient?.insurance.provider,
            policyNumber: patient?.insurance.policyNumber,
            network: patient?.insurance.network,
            coverageTier: patient?.insurance.network,
            coveragePercent: patient?.insurance.coveragePercentage ?? 80,
            copayPercent: 100 - (patient?.insurance.coveragePercentage ?? 80),
            copayAmount: patient?.insurance.copayAmount,
            serviceCopay: patient?.insurance.serviceCopay,
            deductibleAmount: patient?.insurance.deductibleAmount,
          }
        : undefined;
    const normalizedPaymentScheme = insuranceScheme
      ? {
          ...insuranceScheme,
          coverageTier: insuranceScheme.coverageTier || insuranceScheme.network || data.patientDetails?.insuranceNetwork,
          copayPercent: insuranceScheme.copayPercent ??
            (insuranceScheme.coveragePercent === undefined ? undefined : 100 - insuranceScheme.coveragePercent),
        }
      : data.paymentScheme;
    const newRecord: ReceptionToken = {
      ...data,
      patientPhone: data.patientPhone || patient?.phone,
      patientAge: data.patientAge ?? patient?.age,
      patientGender: data.patientGender || patient?.gender,
      insuranceProvider: data.insuranceProvider || patient?.insurance?.provider || 'Self-Pay',
      payMode: data.payMode || patient?.payMode || 'Self',
      paymentScheme: normalizedPaymentScheme,
      department: data.department || patient?.department || 'General Medicine',
      patientDetails: {
        ...(patient ? {
          registrationNumber: patient.rgNo || patient.id,
          title: patient.title,
          middleName: patient.middleName,
          dateOfBirth: patient.dob,
          nationality: patient.nationality,
          maritalStatus: patient.maritalStatus,
          bloodGroup: patient.bloodGroup,
          email: patient.email,
          address: patient.address,
          nationalId: patient.emiratesId,
          passportNumber: patient.passportNo,
          allergies: patient.allergies,
          chronicConditions: patient.chronicConditions,
          emergencyContact: patient.emergencyContact,
          consentSigned: patient.consentSigned,
          consentTimestamp: patient.consentTimestamp,
          consentSignature: patient.consentSignature,
          consentSignerRole: patient.consentSignerRole,
          consentSignerRelationship: patient.consentSignerRelationship,
          insurancePolicyNumber: patient.insurance?.policyNumber,
          insuranceMemberId: patient.insurance?.memberId,
          insuranceProvider: patient.insurance?.provider,
          insuranceTpa: patient.insurance?.tpa,
          insuranceRegulator: patient.insurance?.regulator,
          insuranceNetwork: patient.insurance?.network,
          insurancePlanName: patient.insurance?.planName,
          insuranceCardNumber: patient.insurance?.cardNumber,
          insuranceCertificateNumber: patient.insurance?.certificateNumber,
          insuranceDependentNumber: patient.insurance?.dependentNumber,
          insuranceClaimFormNo: patient.insurance?.claimFormNo,
          insurancePreAuthorizationRequired: patient.insurance?.requiresPreAuthorization,
          insuranceDailyClinicLimitAed: patient.insurance?.dailyClinicLimitAed,
          insurancePreExistingWaitingPeriod: patient.insurance?.preExistingWaitingPeriod,
          insuranceVerificationReference: patient.insurance?.verificationReference,
          insuranceStatus: patient.insurance?.status,
          insuranceExpiryDate: patient.insurance?.expiryDate,
          insuranceCards: patient.insuranceList,
        } : {}),
        ...data.patientDetails,
        registrationNumber:
          patient?.rgNo || patient?.id || data.patientDetails?.registrationNumber || data.patientId,
      },
      id,
      tokenNumber,
      createdDate: nowDate,
      createdTime: nowTime,
      historyLogs: data.historyLogs || [
        {
          stage: '1_REGISTRATION',
          timestamp: now.toISOString(),
          action: 'Patient registered and queued for consultation',
          actor: 'Registration Desk',
        },
      ],
      lineItems: data.lineItems || [],
      visitCode: data.visitCode || (data.serviceType === 'Consultation' ? 'C' : data.serviceType === 'Physio Technician' ? 'TEC' : 'NC'),
      registeredBy: data.registeredBy || currentUser?.name || 'Hospital Staff',
    };
    setReceptionTokens((prev) => [newRecord, ...prev]);

    if (data.patientId && data.patientId !== 'WALK-IN') {
      appendPatientVisit(data.patientId, {
        visitDate: data.visitDate || nowDate,
        doctorName: data.doctorName || patient?.primaryPhysicianName || 'Attending Physician',
        doctorSpecialty: data.department || patient?.department || 'General Medicine',
        department: data.department || patient?.department || 'General Medicine',
        clinicRoom: data.counterOrRoom || 'Consultation Room',
        visitType: (data.visitType === 'Consultation' ? 'Specialist Consultation' : data.visitType === 'Technician' ? 'Lab & Imaging Review' : data.visitType === 'Billing' ? 'Billing & Claims' : 'Outpatient Follow-up') as FacilityVisit['visitType'],
        chiefComplaint: data.visitComplaint || data.visitPurpose || 'Clinical Consultation',
        clinicalAssessment: `Encounter registered with Queue Token ${tokenNumber} for ${data.department}.`,
        primaryDiagnosis: { code: 'ENC-DAY', description: `${data.serviceType || 'Consultation'} Visit` },
        diagnosticOrders: [],
        medicationsPrescribed: [],
        disposition: 'Follow-up Scheduled',
        signedAt: now.toISOString(),
      });
    }

    addNotification(
      'Queue Token Generated',
      `Token ${tokenNumber} issued to ${data.patientName} for ${data.department} (${data.counterOrRoom}).`,
      'success'
    );
    return newRecord;
  };

  const updateReceptionTokenStatus = (id: string, status: ReceptionToken['status']) => {
    const timestamp = new Date();
    const now = timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    setReceptionTokens((prev) =>
      prev.map((tok) => {
        if (tok.id === id) {
          const logItem = {
            stage: tok.currentStage || '1_REGISTRATION',
            timestamp: timestamp.toISOString(),
            action: `Visit status changed to ${status}`,
            actor: currentUser?.name || 'Hospital Staff',
          };
          return {
            ...tok,
            status,
            calledAt: status === 'In Consultation' ? now : tok.calledAt,
            completedAt: status === 'Completed' ? now : tok.completedAt,
            historyLogs: [...(tok.historyLogs || []), logItem],
          };
        }
        return tok;
      })
    );
    addNotification('Queue Status Updated', `Token ${id} is now ${status}.`, 'info');
  };

  const advanceTokenWorkflow = (
    tokenId: string,
    nextStage: TokenWorkflowStage,
    updates?: Partial<ReceptionToken>
  ) => {
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    setReceptionTokens((prev) =>
      prev.map((tok) => {
        if (tok.id === tokenId) {
          const newStatus: ReceptionToken['status'] =
            nextStage === '6_COMPLETED_REPORTS'
              ? 'Completed'
              : nextStage === '3_DOCTOR_EMR' || nextStage === '5_DIAGNOSTICS_PROCEDURES'
                ? 'In Consultation'
                : 'Waiting';

          const stageLabel =
            nextStage === '1_REGISTRATION'
              ? '1. Registration'
              : nextStage === '2_NURSING_VITALS'
                ? '2. Nursing Vitals'
                : nextStage === '3_DOCTOR_EMR'
                  ? '3. Doctor EMR'
                  : nextStage === '4_CASHIER_BILLING'
                    ? '4. Cashier Billing'
                    : nextStage === '5_DIAGNOSTICS_PROCEDURES'
                      ? '5. Diagnostics & Procedures'
                      : '6. Reports Dispatched';

          const logItem = {
            stage: nextStage,
            timestamp: now,
            action: `Advanced to ${stageLabel}`,
            actor: currentUser?.name || 'Hospital Staff',
          };

          return {
            ...tok,
            ...updates,
            currentStage: nextStage,
            status: newStatus,
            historyLogs: tok.historyLogs ? [...tok.historyLogs, logItem] : [logItem],
            completedAt: nextStage === '6_COMPLETED_REPORTS' ? now : tok.completedAt,
          };
        }
        return tok;
      })
    );
    addNotification('Token Workflow Advanced', `Token ${tokenId} moved to next clinical stage.`, 'info');
  };

  const updateTokenVitals = (tokenId: string, vitals: TokenVitalsRecord, serviceItems?: TokenServiceItem[]) => {
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    setReceptionTokens((prev) =>
      prev.map((tok) => {
        if (tok.id === tokenId) {
          const needsCashier = tok.serviceType === 'Billing & Cashier' || tok.serviceType === 'Physio Technician';
          const logItem = {
            stage: '2_NURSING_VITALS' as TokenWorkflowStage,
            timestamp: now,
            action: `Vitals recorded: BP ${vitals.bpSystolic}/${vitals.bpDiastolic}, HR ${vitals.heartRate}, SpO2 ${vitals.spO2}%, Triage ${vitals.triageLevel}${serviceItems?.length ? `. ${serviceItems.length} billable service(s) added.` : ''}`,
            actor: vitals.nurseName,
          };
          return {
            ...tok,
            vitals,
            ...(serviceItems ? { serviceItems } : {}),
            ...(serviceItems
              ? { lineItems: appendTokenLineItems(tok.lineItems, createServiceLineItems(tok, serviceItems)) }
              : {}),
            currentStage: needsCashier ? '4_CASHIER_BILLING' : '3_DOCTOR_EMR',
            status: 'Waiting',
            counterOrRoom: needsCashier ? 'Cashier Counter' : 'Doctor Consultation Suite',
            historyLogs: tok.historyLogs ? [...tok.historyLogs, logItem] : [logItem],
          };
        }
        return tok;
      })
    );

    const targetToken = receptionTokens.find((t) => t.id === tokenId);
    if (targetToken && targetToken.patientId && targetToken.patientId !== 'WALK-IN') {
      addVitals(targetToken.patientId, {
        bloodPressureSys: vitals.bpSystolic,
        bloodPressureDia: vitals.bpDiastolic,
        heartRate: vitals.heartRate,
        spO2: vitals.spO2,
        temperature: vitals.temperature,
        respiratoryRate: vitals.respiratoryRate,
      });
    }

    addNotification(
      'Nursing Vitals Recorded',
      `Vitals captured for Token ${tokenId}. Patient forwarded to Doctor EMR queue.`,
      'success'
    );
  };

  const updateTokenDoctorOrders = (tokenId: string, orders: TokenDoctorOrder) => {
    if (currentRole !== 'doctor') {
      addNotification('Doctor Orders Not Saved', 'Only the treating doctor can append orders to a visit token.', 'warning', tokenId);
      return;
    }
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    setReceptionTokens((prev) =>
      prev.map((tok) => {
        if (tok.id === tokenId) {
          const logItem = {
            stage: '3_DOCTOR_EMR' as TokenWorkflowStage,
            timestamp: now,
            action: `Doctor orders entered: ${orders.diagnoses.map((d) => d.code).join(', ')}. ${orders.labRequests.length} labs, ${orders.radiologyRequests.length} radiology, ${orders.procedureRequests.length} CPT procedures`,
            actor: orders.orderedByDoctorName,
          };
          return {
            ...tok,
            doctorOrders: orders,
            lineItems: appendTokenLineItems(tok.lineItems, createDoctorOrderLineItems(tok, orders)),
            currentStage: '4_CASHIER_BILLING', // Auto-advances to Cashier!
            status: 'Waiting',
            counterOrRoom: 'Cashier Counter',
            historyLogs: tok.historyLogs ? [...tok.historyLogs, logItem] : [logItem],
          };
        }
        return tok;
      })
    );

    const targetToken = receptionTokens.find((t) => t.id === tokenId);
    if (targetToken && targetToken.patientId && targetToken.patientId !== 'WALK-IN') {
      if (orders.clinicalAssessment || orders.healthSummary) {
        addClinicalNote(targetToken.patientId, {
          doctorName: orders.orderedByDoctorName,
          doctorSpecialty: targetToken.department,
          encounterTokenId: tokenId,
          chiefComplaint: orders.chiefComplaint || 'Clinical Consultation',
          assessment: orders.clinicalAssessment || orders.healthSummary || 'Encounter documented',
          treatmentPlan: `Orders: ${[
            ...orders.labRequests.map((l) => l.testName),
            ...orders.radiologyRequests.map((r) => r.studyName),
            ...orders.procedureRequests.map((p) => p.procedureName),
          ].join(', ')}`,
          diagnosisCode: orders.diagnoses[0]?.code ? `ICD-10 ${orders.diagnoses[0].code}` : undefined,
          diagnoses: orders.diagnoses.map((diagnosis) => `${diagnosis.code} ${diagnosis.description}`),
        });
      }
    }

    addNotification(
      'Doctor EMR Orders Finalized',
      `Consultation & diagnostic requests saved for Token ${tokenId}. Patient forwarded to Cashier.`,
      'success'
    );
  };

  const addTokenLineItem = (
    tokenId: string,
    item: Omit<TokenLineItem, 'insuranceStatus' | 'insuranceApprovalId' | 'insuranceApprovedAmount' | 'copayAmount' | 'paymentOverride' | 'fulfillmentStatus'>
  ): boolean => {
    if (currentRole !== 'doctor') {
      addNotification('Token Order Not Added', 'Only a doctor can append a clinical order to a visit token.', 'warning', tokenId);
      return false;
    }
    const token = receptionTokens.find((existing) => existing.id === tokenId);
    if (!token) {
      addNotification('Token Order Not Added', 'The visit token could not be found.', 'warning', tokenId);
      return false;
    }
    const insuranceStatus: TokenLineItem['insuranceStatus'] =
      token.paymentScheme?.schemeType === 'Insurance' || token.payMode === 'Insurance'
        ? 'Pending_Auth'
        : 'Cash_Only';
    const orderedLineItem: TokenLineItem = {
      ...item,
      insuranceStatus,
      fulfillmentStatus: 'Ordered',
      paymentOverride: isSelfPayToken(token)
        ? {
            mode: 'Self_Pay',
            reason: 'Visit registered under a self-pay payment scheme.',
            overriddenBy: 'Reception',
            overriddenAt: item.orderedAt,
          }
        : undefined,
    };
    setReceptionTokens((prev) => prev.map((existing) => {
      if (existing.id !== tokenId) return existing;
      const orders: TokenDoctorOrder = existing.doctorOrders || {
        diagnoses: [],
        labRequests: [],
        radiologyRequests: [],
        procedureRequests: [],
        consultationFee: 0,
        orderedByDoctorId: currentUser.id,
        orderedByDoctorName: currentUser.name,
        orderedAt: item.orderedAt,
      };
      const doctorOrders = item.kind === 'Lab' && !orders.labRequests.some((order) => order.id === item.id)
        ? {
            ...orders,
            labRequests: [...orders.labRequests, {
              id: item.id,
              testName: item.name,
              category: item.department,
              cptCode: item.code,
              price: item.totalPrice,
              status: 'Ordered' as const,
            }],
          }
        : item.kind === 'Radiology' && !orders.radiologyRequests.some((order) => order.id === item.id)
          ? {
              ...orders,
              radiologyRequests: [...orders.radiologyRequests, {
                id: item.id,
                studyName: item.name,
                modality: item.department,
                cptCode: item.code,
                price: item.totalPrice,
                status: 'Ordered' as const,
              }],
            }
          : item.kind === 'Procedure' && !orders.procedureRequests.some((order) => order.id === item.id)
            ? {
                ...orders,
                procedureRequests: [...orders.procedureRequests, {
                  id: item.id,
                  procedureName: item.name,
                  cptCode: item.code || '',
                  price: item.totalPrice,
                  status: 'Scheduled' as const,
                }],
              }
            : orders;
      return {
        ...existing,
        lineItems: appendTokenLineItems(existing.lineItems, [orderedLineItem]),
        ...(item.kind === 'Lab' || item.kind === 'Radiology' || item.kind === 'Procedure'
          ? { doctorOrders }
          : {}),
      };
    }));
    return true;
  };

  const overrideTokenLineItemToSelfPay = (tokenId: string, lineItemId: string, reason: string): boolean => {
    if (!['admin', 'medical-coder', 'receptionist'].includes(currentRole) || !reason.trim()) {
      addNotification(
        'Self-Pay Override Not Applied',
        'Only an administrator, insurance approver, or cashier/receptionist with documented patient consent can apply a self-pay override.',
        'warning',
        tokenId
      );
      return false;
    }
    const token = receptionTokens.find((item) => item.id === tokenId);
    const lineItem = token?.lineItems?.find((item) => item.id === lineItemId);
    if (!lineItem) {
      addNotification('Self-Pay Override Not Applied', 'The requested token line item was not found.', 'warning', tokenId);
      return false;
    }
    if (currentRole === 'receptionist' && lineItem.insuranceStatus !== 'Denied') {
      addNotification('Self-Pay Override Not Applied', 'Cashiers can record a self-pay override only after a payer denial.', 'warning', tokenId);
      return false;
    }
    const overriddenAt = new Date().toISOString();
    setReceptionTokens((prev) => prev.map((item) => item.id !== tokenId ? item : {
      ...item,
      lineItems: item.lineItems?.map((lineItem) => lineItem.id === lineItemId
        ? {
            ...lineItem,
            paymentOverride: {
              mode: 'Self_Pay',
              reason: reason.trim(),
              overriddenBy: currentUser.name,
              overriddenAt,
            },
          }
        : lineItem),
      historyLogs: [
        ...(item.historyLogs || []),
        {
          stage: item.currentStage || '3_DOCTOR_EMR',
          timestamp: overriddenAt,
          action: `Line item ${lineItemId} overridden to Self_Pay: ${reason.trim()}`,
          actor: currentUser.name,
        },
      ],
    }));
    logAuditEvent('UPDATE', 'Billing Invoice', lineItemId, `Self-pay override applied to token ${tokenId}: ${reason.trim()}.`, 'HIPAA Access Log');
    return true;
  };

  const settleTokenBilling = (tokenId: string, billing: TokenBillingSummary) => {
    const token = receptionTokens.find((item) => item.id === tokenId);
    if (!token) {
      addNotification('Billing Not Settled', 'The visit token could not be found.', 'warning', tokenId);
      return;
    }
    const lineItems = token.lineItems?.length ? token.lineItems : appendTokenLineItems(
      createServiceLineItems(token, token.serviceItems || []),
      token.doctorOrders ? createDoctorOrderLineItems(token, token.doctorOrders) : []
    );
    const totals = aggregateTokenLineItemBilling(lineItems);
    if (totals.pendingItemIds.length) {
      addNotification(
        'Billing Blocked: Authorization Pending',
        `Resolve authorization for line item(s) ${totals.pendingItemIds.join(', ')} before settling this token.`,
        'warning',
        tokenId
      );
      return;
    }
    const finalizedBilling: TokenBillingSummary = {
      ...billing,
      subtotal: totals.subtotal,
      insuranceCoveredAmount: totals.insuranceCoveredAmount,
      copayOrSelfPayAmount: totals.patientShare,
      copayAmount: totals.copayAmount,
      totalPaid: totals.patientShare,
      balanceDue: 0,
      paymentStatus: 'Paid',
    };
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    setReceptionTokens((prev) =>
      prev.map((tok) => {
        if (tok.id === tokenId) {
          const logItem = {
            stage: '4_CASHIER_BILLING' as TokenWorkflowStage,
            timestamp: now,
            action: `Invoice settled from finalized token line items. Subtotal: AED ${finalizedBilling.subtotal.toFixed(2)}, Insurer share: AED ${finalizedBilling.insuranceCoveredAmount.toFixed(2)}, Patient share: AED ${finalizedBilling.copayOrSelfPayAmount.toFixed(2)} (${finalizedBilling.paymentMethod}).${finalizedBilling.dailyInsuranceLimitApplied ? ` Daily insurance cap enforced: AED ${finalizedBilling.dailyInsuranceUsedAfterAed?.toFixed(2)} / AED ${finalizedBilling.dailyInsuranceLimitAed?.toFixed(2)}.` : ''}`,
            actor: finalizedBilling.cashierName,
          };

          const hasDiagnostics =
            (tok.doctorOrders?.labRequests && tok.doctorOrders.labRequests.length > 0) ||
            (tok.doctorOrders?.radiologyRequests && tok.doctorOrders.radiologyRequests.length > 0) ||
            (tok.doctorOrders?.procedureRequests && tok.doctorOrders.procedureRequests.length > 0);

          const nextStage: TokenWorkflowStage = hasDiagnostics ? '5_DIAGNOSTICS_PROCEDURES' : '6_COMPLETED_REPORTS';

          return {
            ...tok,
            lineItems,
            billingSummary: finalizedBilling,
            currentStage: nextStage,
            status: hasDiagnostics ? 'Waiting' : 'Completed',
            counterOrRoom: hasDiagnostics ? 'Diagnostics & Imaging Wing' : 'Discharge Complete',
            historyLogs: tok.historyLogs ? [...tok.historyLogs, logItem] : [logItem],
            completedAt: hasDiagnostics ? tok.completedAt : now,
          };
        }
        return tok;
      })
    );

    addNotification(
      'Cashier Invoice Settled',
      `Services invoiced for Token ${tokenId}. Receipt: ${finalizedBilling.receiptNumber || 'RCP-' + Date.now().toString().slice(-5)}. Forwarded to Diagnostics.`,
      'success'
    );
  };

  const completeTokenDiagnosticReport = (tokenId: string, report: TokenDiagnosticReport) => {
    const tokenForReport = receptionTokens.find((item) => item.id === tokenId);
    const reportLineItem = tokenForReport?.lineItems?.find((item) =>
      item.name.trim().toLowerCase() === report.testOrStudyName.trim().toLowerCase()
    ) || (tokenForReport?.doctorOrders
      ? createDoctorOrderLineItems(tokenForReport, tokenForReport.doctorOrders).find((item) =>
          item.name.trim().toLowerCase() === report.testOrStudyName.trim().toLowerCase()
        )
      : undefined);
    if (!canExecuteDiagnosticLineItem(reportLineItem)) {
      addNotification(
        'Diagnostic Execution Blocked',
        `The token line item for ${report.testOrStudyName} is not authorized for execution.`,
        'warning',
        tokenId
      );
      return;
    }
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    setReceptionTokens((prev) =>
      prev.map((tok) => {
        if (tok.id === tokenId) {
          const updatedReports = tok.diagnosticReports ? [...tok.diagnosticReports, report] : [report];
          const logItem = {
            stage: '5_DIAGNOSTICS_PROCEDURES' as TokenWorkflowStage,
            timestamp: now,
            action: `Diagnostic report verified: ${report.testOrStudyName} (${report.department}). Sent to Patient & Doctor.`,
            actor: report.technicianOrRadiologist,
          };
          return {
            ...tok,
            diagnosticReports: updatedReports,
            lineItems: (tok.lineItems?.length ? tok.lineItems : (tok.doctorOrders
              ? createDoctorOrderLineItems(tok, tok.doctorOrders)
              : [])).map((item) => item.name.trim().toLowerCase() === report.testOrStudyName.trim().toLowerCase()
              ? { ...item, fulfillmentStatus: 'Completed' }
              : item),
            currentStage: '6_COMPLETED_REPORTS',
            status: 'Completed',
            completedAt: now,
            historyLogs: tok.historyLogs ? [...tok.historyLogs, logItem] : [logItem],
          };
        }
        return tok;
      })
    );

    const targetToken = receptionTokens.find((t) => t.id === tokenId);
    if (targetToken && targetToken.patientId && targetToken.patientId !== 'WALK-IN') {
      const newLabResult: Omit<LabResult, 'id'> = {
        encounterTokenId: targetToken.id,
        testName: report.testOrStudyName,
        category: report.department === 'Radiology' ? 'Radiology' : report.department === 'Cardiology / Procedures' ? 'Cardiology' : 'Biochemistry',
        department: report.department === 'Radiology' ? 'Radiology & Imaging' : report.department,
        cptCode: report.cptOrCode,
        orderedDate: new Date().toISOString().split('T')[0],
        resultDate: new Date().toISOString().split('T')[0],
        status: report.status === 'Completed' ? 'Normal' : report.status,
        value: report.resultValue || report.impression || 'Completed',
        referenceRange: report.referenceRange || 'Reference range normal',
        orderedBy: targetToken.doctorName || 'Attending Physician',
        findings: report.findings,
        impression: report.impression,
        technicianOrRadiologist: report.technicianOrRadiologist,
        sentToPatient: true,
        sentToDoctor: true,
        sentDate: `${new Date().toISOString().split('T')[0]} ${now}`,
      };
      addLabResult(targetToken.patientId, newLabResult);
    }

    if (!targetToken?.patientId || targetToken.patientId === 'WALK-IN') {
      addNotification(
        'Diagnostic Report Dispatched',
        `Report for ${report.testOrStudyName} sent to Patient and Doctor EMR.`,
        'success'
      );
    }
  };

  const updateLabOrderStatus = (
    tokenId: string,
    requestId: string,
    status: 'Ordered' | 'Sample Collected' | 'Completed',
    notes?: string
  ) => {
    const token = receptionTokens.find((item) => item.id === tokenId);
    const lineItem = token?.lineItems?.find((item) => item.id === requestId) ||
      (token?.doctorOrders
        ? createDoctorOrderLineItems(token, token.doctorOrders).find((item) => item.id === requestId)
        : undefined);
    if (!canExecuteDiagnosticLineItem(lineItem)) {
      addNotification(
        'Lab Execution Blocked',
        `Authorization for ${lineItem?.name || 'this test'} is ${lineItem?.insuranceStatus || 'missing'}. Approval or a documented self-pay override is required.`,
        'warning',
        tokenId
      );
      return;
    }
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    let testName = 'Lab test';

    setReceptionTokens((prev) =>
      prev.map((tok) => {
        if (tok.id === tokenId && tok.doctorOrders?.labRequests) {
          const updatedRequests = tok.doctorOrders.labRequests.map((req) => {
            if (req.id === requestId) {
              testName = req.testName;
              return { ...req, status };
            }
            return req;
          });

          const logItem = {
            stage: tok.currentStage || ('5_DIAGNOSTICS_PROCEDURES' as TokenWorkflowStage),
            timestamp: nowTime,
            action: `${testName} status updated to ${status}${notes ? `: ${notes}` : ''}`,
            actor: currentUser?.name || 'Lab Technician',
          };

          return {
            ...tok,
            doctorOrders: {
              ...tok.doctorOrders,
              labRequests: updatedRequests,
            },
            lineItems: (tok.lineItems?.length ? tok.lineItems : createDoctorOrderLineItems(tok, tok.doctorOrders)).map((item) =>
              item.id === requestId
                ? { ...item, fulfillmentStatus: status === 'Completed' ? 'Completed' : status === 'Sample Collected' ? 'In Progress' : 'Ordered' }
                : item
            ),
            historyLogs: tok.historyLogs ? [...tok.historyLogs, logItem] : [logItem],
          };
        }
        return tok;
      })
    );

    addNotification(
      'Lab Order Status Updated',
      `${testName} is now marked as "${status}" for Token ${tokenId}.`,
      status === 'Completed' ? 'success' : 'info'
    );
  };

  const recordLabTestResult = (
    tokenId: string,
    requestId: string,
    resultData: {
      testName: string;
      category?: string;
      value: string;
      referenceRange?: string;
      status: 'Normal' | 'Elevated' | 'Critical';
      findings?: string;
      notes?: string;
      technicianName?: string;
    }
  ) => {
    const token = receptionTokens.find((item) => item.id === tokenId);
    const lineItem = token?.lineItems?.find((item) => item.id === requestId) ||
      (token?.doctorOrders
        ? createDoctorOrderLineItems(token, token.doctorOrders).find((item) => item.id === requestId)
        : undefined);
    if (!canExecuteDiagnosticLineItem(lineItem)) {
      addNotification(
        'Lab Result Blocked',
        `Authorization for ${lineItem?.name || resultData.testName} is ${lineItem?.insuranceStatus || 'missing'}. Approval or a documented self-pay override is required.`,
        'warning',
        tokenId
      );
      return;
    }
    const nowDate = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const diagnosticReport: TokenDiagnosticReport = {
      id: `REP-${Date.now().toString().slice(-6)}`,
      testOrStudyName: resultData.testName,
      department: 'Laboratory',
      category: resultData.category || 'Biochemistry',
      date: nowDate,
      time: nowTime,
      findings: resultData.findings || `Specimen value: ${resultData.value}`,
      impression: resultData.notes || `${resultData.testName}: ${resultData.value} (${resultData.status})`,
      resultValue: resultData.value,
      referenceRange: resultData.referenceRange || 'Reference range normal',
      status: resultData.status === 'Critical' ? 'Critical' : resultData.status === 'Elevated' ? 'Elevated' : 'Normal',
      technicianOrRadiologist: resultData.technicianName || currentUser?.name || 'Lab Technician',
      completedAt: `${nowDate} ${nowTime}`,
      sentToPatient: true,
      sentToDoctor: true,
      sentTimestamp: `${nowDate} ${nowTime}`,
    };

    setReceptionTokens((prev) =>
      prev.map((tok) => {
        if (tok.id === tokenId) {
          const updatedLabRequests = (tok.doctorOrders?.labRequests || []).map((req) =>
            req.id === requestId ? { ...req, status: 'Completed' as const } : req
          );

          const existingReports = tok.diagnosticReports || [];
          const updatedReports = [
            ...existingReports.filter((r) => r.testOrStudyName !== resultData.testName),
            diagnosticReport,
          ];

          const logItem = {
            stage: '6_COMPLETED_REPORTS' as TokenWorkflowStage,
            timestamp: nowTime,
            action: `Lab result recorded for ${resultData.testName}: ${resultData.value} (${resultData.status})`,
            actor: resultData.technicianName || currentUser?.name || 'Lab Technician',
          };

          return {
            ...tok,
            doctorOrders: tok.doctorOrders
              ? { ...tok.doctorOrders, labRequests: updatedLabRequests }
              : undefined,
            lineItems: (tok.lineItems?.length ? tok.lineItems : createDoctorOrderLineItems(tok, tok.doctorOrders || {
              diagnoses: [],
              labRequests: [],
              radiologyRequests: [],
              procedureRequests: [],
              consultationFee: 0,
              orderedByDoctorId: '',
              orderedByDoctorName: '',
              orderedAt: nowTime,
            })).map((item) => item.id === requestId ? { ...item, fulfillmentStatus: 'Completed' } : item),
            diagnosticReports: updatedReports,
            historyLogs: tok.historyLogs ? [...tok.historyLogs, logItem] : [logItem],
          };
        }
        return tok;
      })
    );

    const targetToken = receptionTokens.find((t) => t.id === tokenId);
    if (targetToken?.patientId && targetToken.patientId !== 'WALK-IN') {
      const newLabResult: Omit<LabResult, 'id'> = {
        encounterTokenId: targetToken.id,
        testName: resultData.testName,
        category: (resultData.category as any) || 'Biochemistry',
        department: 'Laboratory',
        orderedDate: targetToken.visitDate || nowDate,
        resultDate: nowDate,
        status: resultData.status,
        value: resultData.value,
        referenceRange: resultData.referenceRange || 'Normal',
        orderedBy: targetToken.doctorName || 'Attending Physician',
        findings: resultData.findings,
        technicianOrRadiologist: resultData.technicianName || currentUser?.name || 'Lab Technician',
        notes: resultData.notes,
        sentToPatient: true,
        sentToDoctor: true,
        sentDate: `${nowDate} ${nowTime}`,
      };
      addLabResult(targetToken.patientId, newLabResult);
    }

    addNotification(
      'Lab Result Published',
      `${resultData.testName} result recorded (${resultData.value}) for Token ${tokenId}.`,
      resultData.status === 'Critical' ? 'critical' : 'success'
    );
  };

  const addEncounterDocument = (
    tokenId: string,
    document: Pick<EncounterDocumentAttachment, 'fileName' | 'mimeType' | 'dataUrl'>
  ): boolean => {
    if (!['admin', 'doctor', 'nurse'].includes(currentRole)) return false;
    const token = receptionTokens.find((item) => item.id === tokenId);
    if (!token) return false;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(document.mimeType)) return false;

    const uploadedAt = new Date().toISOString();
    const attachment: EncounterDocumentAttachment = {
      ...document,
      id: `DOC-${Date.now()}`,
      uploadedAt,
      uploadedBy: currentUser.name,
    };
    const historyLog = {
      stage: token.currentStage || '1_REGISTRATION',
      timestamp: uploadedAt,
      action: `Visit document attached: ${document.fileName}`,
      actor: currentUser.name,
    };

    setReceptionTokens((previousTokens) => previousTokens.map((item) => item.id === tokenId
      ? { ...item, visitDocuments: [...(item.visitDocuments || []), attachment], historyLogs: [...(item.historyLogs || []), historyLog] }
      : item
    ));
    logAuditEvent('UPDATE', 'Patient Record', token.patientId, `Attached ${document.fileName} to visit token ${token.tokenNumber}.`);
    addNotification('Visit Document Added', `${document.fileName} attached to token ${token.tokenNumber}.`, 'success', token.patientId);
    return true;
  };

  const assignBedToPatient = (bedId: string, patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return;
    setWardBeds((prev) =>
      prev.map((bed) => {
        if (bed.id === bedId) {
          return {
            ...bed,
            status: 'Occupied',
            patientId,
            patientName: `${patient.firstName} ${patient.lastName}`,
            assignedDoctor: patient.primaryPhysicianName,
            admissionDate: new Date().toISOString().split('T')[0],
          };
        }
        return bed;
      })
    );
    const bed = wardBeds.find((b) => b.id === bedId);
    updatePatient(patientId, {
      status: 'Inpatient',
      wardOrRoom: `${bed?.wardName} - ${bed?.bedNumber}`,
    });
    logAuditEvent('UPDATE', 'Patient Record', patientId, `Assigned to ${bed?.wardName} (${bed?.bedNumber})`);
    addNotification('Ward Bed Assigned', `${patient.firstName} ${patient.lastName} transferred to ${bed?.bedNumber}.`, 'info', patientId);
  };

  const releaseBed = (bedId: string) => {
    const targetBed = wardBeds.find((b) => b.id === bedId);
    if (!targetBed) return;
    setWardBeds((prev) =>
      prev.map((bed) =>
        bed.id === bedId
          ? {
            ...bed,
            status: 'Available',
            patientId: undefined,
            patientName: undefined,
            assignedDoctor: undefined,
            admissionDate: undefined,
          }
          : bed
      )
    );
    addNotification('Bed Cleared', `Bed ${targetBed.bedNumber} sanitized and available.`, 'info');
  };

  const transferPatientBed = (patientId: string, toBedId: string, reason: string, handoverNotes?: string): boolean => {
    const patient = patients.find((p) => p.id === patientId);
    const toBed = wardBeds.find((b) => b.id === toBedId);
    if (!patient || !toBed || toBed.status === 'Occupied') return false;

    const fromBed = wardBeds.find((b) => b.patientId === patientId);
    const fromBedNumber = fromBed?.bedNumber || patient.wardOrRoom || 'Admissions Desk';
    const fromWard = fromBed?.wardName || 'Emergency / Ambulatory';

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    if (fromBed) {
      setWardBeds((prev) =>
        prev.map((b) =>
          b.id === fromBed.id
            ? { ...b, status: 'Maintenance', patientId: undefined, patientName: undefined, assignedDoctor: undefined, admissionDate: undefined }
            : b
        )
      );
    }

    setWardBeds((prev) =>
      prev.map((b) =>
        b.id === toBed.id
          ? {
              ...b,
              status: 'Occupied',
              patientId: patient.id,
              patientName: `${patient.firstName} ${patient.lastName}`,
              assignedDoctor: patient.primaryPhysicianName,
              admissionDate: date,
            }
          : b
      )
    );

    updatePatient(patientId, {
      status: 'Inpatient',
      wardOrRoom: `${toBed.wardName} - ${toBed.bedNumber}`,
    });

    const transferRecord: BedTransferRecord = {
      id: `TRF-${Date.now().toString().slice(-6)}`,
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      fromBedId: fromBed?.id || 'UNASSIGNED',
      fromBedNumber,
      fromWard,
      toBedId: toBed.id,
      toBedNumber: toBed.bedNumber,
      toWard: toBed.wardName,
      transferReason: reason,
      transferDate: date,
      transferTime: time,
      attendingDoctor: patient.primaryPhysicianName,
      transferredBy: currentUser.name,
      clinicalHandoverNotes: handoverNotes,
    };

    setBedTransfers((prev) => [transferRecord, ...prev]);

    logAuditEvent(
      'UPDATE',
      'Patient Record',
      patient.id,
      `Bed transfer: ${patient.firstName} ${patient.lastName} moved from ${fromWard} (${fromBedNumber}) to ${toBed.wardName} (${toBed.bedNumber}). Reason: ${reason}`
    );

    addNotification(
      'Bed Transfer Complete',
      `${patient.firstName} ${patient.lastName} transferred to ${toBed.wardName} - ${toBed.bedNumber}. Sanitization ordered for prior bay.`,
      'info',
      patient.id
    );

    return true;
  };

  const admitPatientToBed = (patientId: string, bedId: string, doctorName?: string): boolean => {
    const patient = patients.find((p) => p.id === patientId);
    const targetBed = wardBeds.find((b) => b.id === bedId);
    if (!patient || !targetBed || targetBed.status === 'Occupied') return false;

    const todayStr = new Date().toISOString().slice(0, 10);
    const assignedDoctor = doctorName || patient.primaryPhysicianName || 'Attending Physician';

    setWardBeds((prev) =>
      prev.map((b) =>
        b.id === bedId
          ? {
              ...b,
              status: 'Occupied',
              patientId: patient.id,
              patientName: `${patient.firstName} ${patient.lastName}`,
              assignedDoctor,
              admissionDate: todayStr,
            }
          : b
      )
    );

    updatePatient(patientId, {
      status: 'Inpatient',
      wardOrRoom: `${targetBed.wardName} - ${targetBed.bedNumber}`,
      primaryPhysicianName: assignedDoctor,
    });

    logAuditEvent(
      'UPDATE',
      'Patient Record',
      patient.id,
      `Admitted to ${targetBed.wardName} (${targetBed.bedNumber}) under ${assignedDoctor}`
    );

    addNotification(
      'Patient Admitted to Ward Bed',
      `${patient.firstName} ${patient.lastName} admitted to ${targetBed.wardName} - ${targetBed.bedNumber}.`,
      'success',
      patient.id
    );

    return true;
  };

  const addStaff = (memberData: Omit<StaffMember, 'id' | 'isActive'>): StaffMember | null => {
    const doctorManagedRoles: UserRole[] = ['doctor', 'nurse', 'physiotherapist', 'lab', 'radiology'];
    const canAdd = currentRole === 'admin' || (
      currentRole === 'doctor' &&
      doctorManagedRoles.includes(memberData.role) &&
      memberData.department === currentUser.department
    );
    if (!canAdd) return null;

    const nextId = staff.reduce((maxId, member) => {
      const sequence = member.id.startsWith('STF-') ? Number(member.id.slice(4)) : 0;
      return Number.isInteger(sequence) ? Math.max(maxId, sequence) : maxId;
    }, 0) + 1;
    const newStaffMember: StaffMember = {
      ...memberData,
      id: `STF-${String(nextId).padStart(2, '0')}`,
      isActive: true,
    };
    setStaff((prev) => [...prev, newStaffMember]);
    logAuditEvent('CREATE', 'Security Settings', newStaffMember.id, `Staff member added: ${newStaffMember.name} (${newStaffMember.role})`);
    addNotification('Staff Registered', `Added ${newStaffMember.name} to ${newStaffMember.department}.`, 'info');
    return newStaffMember;
  };

  const deactivateStaff = (id: string): boolean => {
    const target = staff.find((member) => member.id === id && member.isActive !== false);
    if (!target || target.id === currentUser.id) return false;

    const activeAdminCount = staff.filter((member) => member.role === 'admin' && member.isActive !== false).length;
    const isLastAdmin = target.role === 'admin' && activeAdminCount <= 1;
    const doctorManagedRoles: UserRole[] = ['doctor', 'nurse', 'physiotherapist', 'lab', 'radiology'];
    const canDeactivate = currentRole === 'admin'
      ? !isLastAdmin
      : currentRole === 'doctor' &&
        target.department === currentUser.department &&
        doctorManagedRoles.includes(target.role);
    if (!canDeactivate) return false;

    setStaff((prev) => prev.map((member) => member.id === id
      ? { ...member, isActive: false, status: 'Off Duty' }
      : member
    ));
    logAuditEvent('UPDATE', 'Security Settings', id, `Staff account deactivated: ${target.name} (${target.role}).`);
    addNotification('Staff Account Deactivated', `${target.name}'s account was deactivated.`, 'warning');
    return true;
  };

  const updateStaff = (id: string, updates: Partial<StaffMember>) => {
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    logAuditEvent('UPDATE', 'Security Settings', id, `Updated staff duty profile`);
  };

  const setDoctorDutySchedule = (
    data: Omit<DoctorDutySchedule, 'id' | 'updatedAt' | 'updatedBy'>
  ): boolean => {
    if (currentRole !== 'admin' || data.date < new Date().toISOString().slice(0, 10)) return false;
    if (!doctors.some((doctor) => doctor.id === data.doctorId)) return false;
    if (data.intervalMinutes !== undefined && (!Number.isInteger(data.intervalMinutes) || data.intervalMinutes < 5 || data.intervalMinutes > 240 || data.intervalMinutes % 5 !== 0)) return false;
    if (data.isOnDuty) {
      const isValidTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
      if (!isValidTime(data.startTime) || !isValidTime(data.endTime) || data.endTime <= data.startTime) return false;
    }

    const id = `${data.doctorId}-${data.date}`;
    const schedule: DoctorDutySchedule = {
      ...data,
      startTime: data.isOnDuty ? data.startTime : '',
      endTime: data.isOnDuty ? data.endTime : '',
      id,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.name,
    };
    setDoctorDutySchedules((previous) => [
      schedule,
      ...previous.filter((item) => item.id !== id),
    ]);
    logAuditEvent(
      'UPDATE',
      'Appointment',
      id,
      `${currentUser.name} set ${data.isOnDuty ? `${data.startTime}-${data.endTime}` : 'off duty'} for ${doctors.find((doctor) => doctor.id === data.doctorId)?.name} on ${data.date}.${data.remark ? ` Remark: ${data.remark}` : ''}`
    );
    return true;
  };

  const setStaffDutySchedule = (
    data: Omit<StaffDutySchedule, 'id' | 'updatedAt' | 'updatedBy'>
  ): boolean => {
    if (currentRole !== 'admin' || data.date < new Date().toISOString().slice(0, 10)) return false;
    const member = staff.find((item) => item.id === data.staffId && item.isActive !== false);
    if (!member) return false;
    if (data.intervalMinutes !== undefined && (!Number.isInteger(data.intervalMinutes) || data.intervalMinutes < 5 || data.intervalMinutes > 240 || data.intervalMinutes % 5 !== 0)) return false;
    if (data.isOnDuty) {
      const isValidTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
      if (!isValidTime(data.startTime) || !isValidTime(data.endTime) || data.startTime === data.endTime) return false;
    }

    const id = `${data.staffId}-${data.date}`;
    const schedule: StaffDutySchedule = {
      ...data,
      startTime: data.isOnDuty ? data.startTime : '',
      endTime: data.isOnDuty ? data.endTime : '',
      id,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.name,
    };
    setStaffDutySchedules((previous) => [schedule, ...previous.filter((item) => item.id !== id)]);
    logAuditEvent(
      'UPDATE',
      'Security Settings',
      id,
      `${currentUser.name} set ${data.isOnDuty ? `${data.startTime}-${data.endTime}` : 'off duty'} for ${member.name} on ${data.date}.${data.remark ? ` Remark: ${data.remark}` : ''}`
    );
    return true;
  };

  const submitDoctorDutyChangeRequest = (
    doctorId: string,
    updates: { availableDays: string[]; availableHours: string; reason: string }
  ): DoctorDutyChangeRequest | null => {
    if (currentRole !== 'doctor' || updates.availableDays.length === 0 || !updates.reason.trim()) return null;
    const doctor = doctors.find((item) => item.id === doctorId);
    if (!doctor || normalizeClinicianName(doctor.name) !== normalizeClinicianName(currentUser.name)) return null;
    if (doctorDutyChangeRequests.some((request) => request.doctorId === doctorId && request.status === 'Pending')) return null;

    const request: DoctorDutyChangeRequest = {
      id: `ROTA-${Date.now()}`,
      doctorId,
      doctorName: doctor.name,
      requesterUserId: currentUser.id,
      requesterUserName: currentUser.name,
      currentDays: [...doctor.availableDays],
      currentHours: doctor.availableHours,
      requestedDays: updates.availableDays,
      requestedHours: updates.availableHours,
      reason: updates.reason.trim(),
      status: 'Pending',
      requestedAt: new Date().toISOString(),
    };
    setDoctorDutyChangeRequests((previous) => [request, ...previous]);

    const administrators = staff.filter((member) => member.role === 'admin');
    if (administrators.length > 0) {
      administrators.forEach((administrator) =>
        addNotification(
          'Doctor Rota Change Requested',
          `${doctor.name} requested a duty change: ${updates.availableDays.join(', ')} · ${updates.availableHours}.`,
          'warning',
          request.id,
          { userId: administrator.id, userName: administrator.name }
        )
      );
    } else {
      addNotification('Doctor Rota Change Requested', `${doctor.name} submitted a duty change request.`, 'warning', request.id);
    }
    logAuditEvent('CREATE', 'Security Settings', request.id, `Doctor ${doctor.name} requested a rota change.`);
    return request;
  };

  const reviewDoctorDutyChangeRequest = (requestId: string, decision: 'Approved' | 'Rejected') => {
    if (currentRole !== 'admin') return;
    const request = doctorDutyChangeRequests.find((item) => item.id === requestId && item.status === 'Pending');
    if (!request) return;

    setDoctorDutyChangeRequests((previous) =>
      previous.map((item) => item.id === requestId
        ? { ...item, status: decision, reviewedAt: new Date().toISOString(), reviewedBy: currentUser.name }
        : item)
    );

    if (decision === 'Approved') {
      setDoctors((previous) => previous.map((doctor) => doctor.id === request.doctorId
        ? { ...doctor, availableDays: request.requestedDays, availableHours: request.requestedHours }
        : doctor));
    }

    const requester = staff.find((member) => member.id === request.requesterUserId);
    addNotification(
      `Doctor Rota Change ${decision}`,
      `${request.doctorName}'s duty change request was ${decision.toLowerCase()} by ${currentUser.name}.`,
      decision === 'Approved' ? 'success' : 'info',
      request.id,
      { userId: requester?.id, userName: request.requesterUserName }
    );
    logAuditEvent('UPDATE', 'Security Settings', request.id, `Rota request ${decision.toLowerCase()} by ${currentUser.name}.`);
  };

  const dispensePharmacyItem = (itemId: string, quantity: number, patientId: string) => {
    let dispensedItem: PharmacyItem | undefined;
    setPharmacy((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const newStock = Math.max(0, item.stockQuantity - quantity);
          dispensedItem = { ...item, stockQuantity: newStock };
          return dispensedItem;
        }
        return item;
      })
    );
    if (dispensedItem) {
      logAuditEvent('DISPENSE', 'Prescription', itemId, `Dispensed ${quantity} units of ${dispensedItem.name} to patient ${patientId}`);
      if (dispensedItem.stockQuantity <= dispensedItem.minThreshold) {
        addNotification(
          'Low Stock Warning',
          `${dispensedItem.name} has only ${dispensedItem.stockQuantity} units left (Min threshold: ${dispensedItem.minThreshold}).`,
          'warning',
          itemId
        );
      } else {
        addNotification('Medication Dispensed', `Dispensed ${quantity} units of ${dispensedItem.name}.`, 'success', itemId);
      }
    }
  };

  const restockPharmacyItem = (itemId: string, quantity: number) => {
    setPharmacy((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, stockQuantity: item.stockQuantity + quantity } : item
      )
    );
    logAuditEvent('UPDATE', 'Prescription', itemId, `Restocked +${quantity} units to inventory`);
    addNotification('Stock Replenished', `Added +${quantity} units to pharmacy inventory.`, 'info', itemId);
  };

  const addPharmacyItem = (itemData: Omit<PharmacyItem, 'id'>) => {
    const newItem: PharmacyItem = {
      ...itemData,
      id: `PHARM-${String(pharmacy.length + 1).padStart(2, '0')}`,
    };
    setPharmacy((prev) => [...prev, newItem]);
    logAuditEvent('CREATE', 'Prescription', newItem.id, `Cataloged new medicine: ${newItem.name}`);
    addNotification('Catalog Updated', `Added ${newItem.name} to pharmacy stock.`, 'info');
  };

  const dispensePrescriptionOrder = (
    prescriptionId: string,
    patientId: string,
    quantity: number,
    pharmacistName: string,
    overrideWarning: boolean = false,
    encounterTokenId?: string
  ): { success: boolean; error?: string; record?: PharmacyDispenseRecord } => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return { success: false, error: 'Patient record not found.' };

    const rx =
      (patient.prescriptions || []).find((p) => p.id === prescriptionId) ||
      (patient.medications || []).find((m) => m.id === prescriptionId);
    const token = receptionTokens.find((item) =>
      item.patientId === patientId &&
      (item.id === encounterTokenId || item.doctorOrders?.medicationRequests?.some((medication) => medication.id === prescriptionId))
    );
    const tokenMedication = token?.doctorOrders?.medicationRequests?.find((item) => item.id === prescriptionId);
    const tokenLineItem = token?.lineItems?.find((item) => item.id === prescriptionId);
    if ((tokenMedication || encounterTokenId) && !canDispenseMedicationLineItem(tokenLineItem)) {
      return {
        success: false,
        error: `Dispensing blocked: ${tokenLineItem?.insuranceStatus || 'authorization status missing'}. Pharmacy requires Approved status or a documented Self_Pay override.`,
      };
    }
    const rxName = rx?.name || tokenMedication?.medicationName || tokenLineItem?.name || 'Medication';

    // Allergy cross-screening check
    const patientAllergiesList = patient.allergies.map((a) => (typeof a === 'string' ? a : a.allergen).toLowerCase());
    let allergyAlert: string | undefined;

    const lowerRx = rxName.toLowerCase();
    if (patientAllergiesList.some((a) => a.includes('penicillin')) && (lowerRx.includes('amox') || lowerRx.includes('penicillin') || lowerRx.includes('ampicillin'))) {
      allergyAlert = 'Patient has documented Severe Penicillin Allergy! Cross-reactivity with beta-lactam class.';
    } else if (patientAllergiesList.some((a) => a.includes('sulfa')) && (lowerRx.includes('sulfa') || lowerRx.includes('bactrim') || lowerRx.includes('septra'))) {
      allergyAlert = 'Patient has documented Sulfa allergy! Potential hypersensitivity reaction.';
    } else if (patientAllergiesList.some((a) => a.includes('aspirin') || a.includes('nsaid')) && (lowerRx.includes('ibuprofen') || lowerRx.includes('aspirin') || lowerRx.includes('naproxen') || lowerRx.includes('ketorolac'))) {
      allergyAlert = 'Patient has documented NSAID/Aspirin Allergy! Risk of bronchospasm or anaphylaxis.';
    } else if (patientAllergiesList.some((a) => a.includes('codeine') || a.includes('opioid')) && (lowerRx.includes('codeine') || lowerRx.includes('tramadol') || lowerRx.includes('morphine'))) {
      allergyAlert = 'Patient has documented Opioid/Codeine Allergy!';
    }

    if (allergyAlert && !overrideWarning) {
      return {
        success: false,
        error: `ALLERGY SAFETY WARNING: ${allergyAlert} A licensed pharmacist override is required to proceed.`,
      };
    }

    const pharmItem =
      pharmacy.find((item) => lowerRx.includes(item.name.toLowerCase()) || lowerRx.includes(item.genericName.toLowerCase())) ||
      pharmacy[0];

    if (!pharmItem) {
      return { success: false, error: 'No matching stock item found in hospital formulary.' };
    }

    if (pharmItem.stockQuantity < quantity) {
      return { success: false, error: `Insufficient inventory: only ${pharmItem.stockQuantity} units available (requested ${quantity}).` };
    }

    dispensePharmacyItem(pharmItem.id, quantity, patient.id);

    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        const updatedPrescriptions = (p.prescriptions || []).map((item) =>
          item.id === prescriptionId ? { ...item, status: 'Completed' as const } : item
        );
        const updatedMeds = (p.medications || []).map((item) =>
          item.id === prescriptionId ? { ...item, status: 'Completed' as const } : item
        );
        return {
          ...p,
          prescriptions: updatedPrescriptions,
          medications: updatedMeds,
          updatedAt: new Date().toISOString(),
        };
      })
    );

    const record: PharmacyDispenseRecord = {
      id: `DISP-${Date.now().toString().slice(-6)}`,
      prescriptionId,
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientMrn: patient.rgNo || patient.id,
      medicationName: rxName,
      sku: pharmItem.sku,
      dosage: rx?.dosage || pharmItem.dosage || 'Standard dose',
      quantityDispensed: quantity,
      unitPrice: pharmItem.unitPrice,
      totalCost: pharmItem.unitPrice * quantity,
      dispensedBy: pharmacistName || currentUser.name,
      dispensedAt: `${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })} ${new Date().toISOString().slice(0, 10)}`,
      batchNumber: pharmItem.batchNumber,
      instructions: rx?.instructions || 'Take as directed by prescribing physician.',
      allergyScreeningStatus: allergyAlert ? 'Warning Overridden' : patient.allergies.length === 0 ? 'No Known Allergies' : 'Cleared',
      warningNote: allergyAlert,
    };

    setPharmacyDispenseRecords((prev) => [record, ...prev]);
    if (token && tokenLineItem) {
      setReceptionTokens((prev) => prev.map((item) => item.id !== token.id ? item : {
        ...item,
        lineItems: item.lineItems?.map((lineItem) => lineItem.id === prescriptionId
          ? { ...lineItem, fulfillmentStatus: 'Dispensed' }
          : lineItem),
      }));
    }

    logAuditEvent(
      'DISPENSE',
      'Prescription',
      prescriptionId,
      `Pharmacist ${record.dispensedBy} dispensed ${quantity} units of ${rxName} (Batch: ${pharmItem.batchNumber}) to ${patient.firstName} ${patient.lastName}. Allergy screening: ${record.allergyScreeningStatus}.`
    );

    addNotification(
      'e-Prescription Dispensed',
      `${quantity} units of ${rxName} verified & dispensed for ${patient.firstName} ${patient.lastName}.`,
      'success',
      patient.id
    );

    return { success: true, record };
  };

  const issueMedicalCertificate = (
    data: Omit<MedicalCertificate, 'id' | 'certificateNumber' | 'issueDate' | 'status'>
  ): MedicalCertificate => {
    const certNum = `DHA-MC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const newCert: MedicalCertificate = {
      ...data,
      id: `MC-${Date.now().toString().slice(-6)}`,
      certificateNumber: certNum,
      issueDate: new Date().toISOString().slice(0, 10),
      status: 'Active',
    };

    setMedicalCertificates((prev) => [newCert, ...prev]);

    logAuditEvent(
      'CREATE',
      'Patient Record',
      newCert.patientId,
      `Issued official medical certificate ${certNum} (${newCert.certificateType}) for ${newCert.patientName}: ${newCert.durationDays} days rest under Dr. ${newCert.doctorName}.`
    );

    addNotification(
      'Medical Certificate Issued',
      `Certificate ${certNum} generated for ${newCert.patientName} (${newCert.certificateType}).`,
      'success',
      newCert.patientId
    );

    return newCert;
  };

  const revokeMedicalCertificate = (id: string, reason: string = 'Administrative review') => {
    setMedicalCertificates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'Revoked' } : c))
    );
    logAuditEvent('UPDATE', 'Patient Record', id, `Revoked medical certificate ${id}. Reason: ${reason}`);
    addNotification('Medical Certificate Revoked', `Certificate ${id} was marked Revoked.`, 'warning');
  };

  const addSurgicalCase = (data: Omit<SurgicalCase, 'id'>): SurgicalCase => {
    const newCase: SurgicalCase = {
      ...data,
      id: `SURG-${new Date().getFullYear()}-${String(surgicalCases.length + 1).padStart(3, '0')}`,
    };

    setSurgicalCases((prev) => [newCase, ...prev]);

    logAuditEvent(
      'CREATE',
      'Appointment',
      newCase.id,
      `Booked surgical case: ${newCase.procedureName} in ${newCase.operatingRoom} by ${newCase.leadSurgeonName} for ${newCase.patientName}`
    );

    addNotification(
      'Surgical Procedure Scheduled',
      `${newCase.procedureName} booked in ${newCase.operatingRoom} on ${newCase.scheduledDate} at ${newCase.startTime}.`,
      'info',
      newCase.patientId
    );

    return newCase;
  };

  const updateSurgicalStatus = (id: string, status: SurgicalStatus, updates?: Partial<SurgicalCase>) => {
    setSurgicalCases((prev) =>
      prev.map((sc) => {
        if (sc.id !== id) return sc;
        const updated = { ...sc, ...updates, status };
        return updated;
      })
    );

    const sc = surgicalCases.find((c) => c.id === id);
    const patientName = sc?.patientName || 'Patient';

    logAuditEvent('UPDATE', 'Appointment', id, `Surgical case status changed to: ${status} for ${patientName}`);

    if (status === 'In OR / Surgery') {
      addNotification(
        'Surgery Commenced',
        `${patientName} is now in ${sc?.operatingRoom || 'OR Suite'} with ${sc?.leadSurgeonName}.`,
        'info',
        sc?.patientId
      );
    } else if (status === 'Recovery PACU') {
      addNotification(
        'Surgery Complete - In Recovery (PACU)',
        `${patientName} transferred to Post-Anesthesia Care Unit (PACU). Monitoring recovery.`,
        'success',
        sc?.patientId
      );
    } else if (status === 'Discharged to Ward') {
      addNotification(
        'Patient Transferred from PACU to Ward',
        `${patientName} cleared post-op anesthesia recovery and dispatched to inpatient ward.`,
        'success',
        sc?.patientId
      );
    }
  };

  const updateWhoChecklist = (id: string, checklist: Partial<SurgicalCase['whoSafetyChecklist']>) => {
    setSurgicalCases((prev) =>
      prev.map((sc) => (sc.id === id ? { ...sc, whoSafetyChecklist: { ...sc.whoSafetyChecklist, ...checklist } } : sc))
    );
    logAuditEvent('UPDATE', 'Appointment', id, `WHO Surgical Safety Checklist verified.`);
  };

  const reserveBloodUnit = (unitId: string, patientId: string, patientName: string): boolean => {
    const unit = bloodUnits.find((u) => u.unitId === unitId);
    if (!unit || unit.status !== 'Available') return false;

    setBloodUnits((prev) =>
      prev.map((u) =>
        u.unitId === unitId
          ? { ...u, status: 'Reserved', reservedForPatientId: patientId, reservedForPatientName: patientName }
          : u
      )
    );

    logAuditEvent(
      'UPDATE',
      'Patient Record',
      patientId,
      `Reserved blood unit ${unit.unitId} (${unit.bloodGroup} ${unit.component}) for ${patientName}`
    );

    addNotification(
      'Blood Unit Reserved',
      `Unit ${unit.unitId} (${unit.bloodGroup} ${unit.component}) locked for ${patientName}.`,
      'info',
      patientId
    );

    return true;
  };

  const releaseBloodUnit = (unitId: string): boolean => {
    const unit = bloodUnits.find((u) => u.unitId === unitId);
    if (!unit) return false;

    setBloodUnits((prev) =>
      prev.map((u) =>
        u.unitId === unitId
          ? { ...u, status: 'Available', reservedForPatientId: undefined, reservedForPatientName: undefined }
          : u
      )
    );

    addNotification('Blood Unit Released', `Unit ${unit.unitId} returned to available inventory.`, 'info');
    return true;
  };

  const addBloodUnit = (data: Omit<BloodUnit, 'unitId'>): BloodUnit => {
    const newId = `BLD-${data.bloodGroup.replace(/[^A-Za-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
    const newUnit: BloodUnit = {
      ...data,
      unitId: newId,
    };

    setBloodUnits((prev) => [newUnit, ...prev]);

    logAuditEvent('CREATE', 'Patient Record', newId, `Registered donor blood unit: ${newUnit.bloodGroup} ${newUnit.component} (${newUnit.volumeMl}mL)`);
    addNotification('Blood Unit Cataloged', `New unit ${newId} (${newUnit.bloodGroup}) added to blood bank inventory.`, 'success');

    return newUnit;
  };

  const saveHospitalPriceItem = (item: HospitalPriceItem) => {
    const duplicate = hospitalPriceCatalog.find((entry) =>
      entry.id !== item.id &&
      (entry.code.trim().toLowerCase() === item.code.trim().toLowerCase() ||
        (item.cptCode && entry.cptCode?.trim().toLowerCase() === item.cptCode.trim().toLowerCase()))
    );
    if (duplicate) {
      addNotification('Duplicate Catalog Code', `${duplicate.name} already uses this service or CPT code.`, 'warning');
      return;
    }
    if (!item.name.trim() || !item.code.trim() || !Number.isFinite(item.standardPrice) || item.standardPrice < 0) {
      addNotification('Invalid Catalog Item', 'Enter a service name, unique service code, and a valid non-negative price.', 'warning');
      return;
    }
    const exists = hospitalPriceCatalog.some((entry) => entry.id === item.id);
    setHospitalPriceCatalog((current) => exists
      ? current.map((entry) => entry.id === item.id ? { ...item, name: item.name.trim(), code: item.code.trim(), cptCode: item.cptCode?.trim() || undefined } : entry)
      : [...current, { ...item, name: item.name.trim(), code: item.code.trim(), cptCode: item.cptCode?.trim() || undefined }]);
    logAuditEvent(exists ? 'UPDATE' : 'CREATE', 'Billing Invoice', item.id, `${exists ? 'Updated' : 'Added'} tariff item ${item.code} — ${item.name}, AED ${item.standardPrice.toFixed(2)}.`);
  };

  const deactivateHospitalPriceItem = (itemId: string) => {
    const item = hospitalPriceCatalog.find((catalogItem) => catalogItem.id === itemId);
    if (!item) {
      addNotification('Catalog Item Not Found', 'The selected tariff item could not be found.', 'warning');
      return;
    }
    setHospitalPriceCatalog((current) => current.filter((catalogItem) => catalogItem.id !== itemId));
    logAuditEvent('DELETE', 'Billing Invoice', itemId, `Removed tariff item ${item.code} — ${item.name}.`);
  };

  const resetHospitalData = () => {
    setPatients(initialPatients);
    setDoctors(initialDoctors);
    setDoctorDutySchedules([]);
    setStaffDutySchedules([]);
    setDoctorDutyChangeRequests([]);
    setAppointments(initialAppointments);
    setInvoices(initialInvoices);
    setWardBeds(initialWardBeds);
    setStaff(initialStaff);
    setPharmacy(initialPharmacy);
    setMedicalCertificates(initialMedicalCertificates);
    setSurgicalCases(initialSurgicalCases);
    setBloodUnits(initialBloodUnits);
    setPharmacyDispenseRecords(initialPharmacyDispenseRecords);
    setBedTransfers(initialBedTransfers);
    setHospitalPriceCatalog(initialHospitalPriceCatalog);
    setAuditLogs(initialAuditLogs);
    setCompliance(initialCompliance);
    setAdvancePayments(initialAdvancePayments);
    setRefundPayments(initialRefundPayments);
    setInsuranceApprovals(initialInsuranceApprovals);
    setPosTransactions(initialPosTransactions);
    dirtyTokenIds.current.clear();
    setReceptionTokensState(initialReceptionTokens);
    localStorage.clear();
    setLastBackupTimestampState(Date.now() - 26 * 60 * 60 * 1000);
    setBackupReminderSnoozedUntilState(null);
    addNotification('System Reset', 'Restored pristine MedCore OS clinical dataset.', 'info');
  };

  const [lastBackupTimestamp, setLastBackupTimestampState] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LAST_BACKUP_TIMESTAMP);
    if (saved) {
      const num = Number(saved);
      return isNaN(num) ? null : num;
    }
    return Date.now() - 26 * 60 * 60 * 1000;
  });

  const [backupReminderSnoozedUntil, setBackupReminderSnoozedUntilState] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BACKUP_SNOOZE_TIMESTAMP);
    if (saved) {
      const num = Number(saved);
      return isNaN(num) ? null : num;
    }
    return null;
  });

  const [showBackupReminderModal, setShowBackupReminderModal] = useState<boolean>(false);
  const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

  const isBackupOverdue = React.useMemo(() => {
    if (currentRole !== 'admin') return false;
    if (backupReminderSnoozedUntil && Date.now() < backupReminderSnoozedUntil) {
      return false;
    }
    if (!lastBackupTimestamp) return true;
    return Date.now() - lastBackupTimestamp >= BACKUP_INTERVAL_MS;
  }, [currentRole, backupReminderSnoozedUntil, lastBackupTimestamp]);

  useEffect(() => {
    if (isBackupOverdue && currentRole === 'admin' && isAuthenticated && !showPortalSelect) {
      setShowBackupReminderModal(true);
    }
  }, [isBackupOverdue, currentRole, isAuthenticated, showPortalSelect]);

  const performDatabaseBackup = (format: 'json' | 'csv' = 'json') => {
    const now = new Date();
    const recordCounts = {
      patients: patients.length,
      doctors: doctors.length,
      doctorDutySchedules: doctorDutySchedules.length,
      appointments: appointments.length,
      invoices: invoices.length,
      wardBeds: wardBeds.length,
      staff: staff.length,
      staffDutySchedules: staffDutySchedules.length,
      pharmacy: pharmacy.length,
      auditLogs: auditLogs.length,
    };
    let filename = '';
    if (format === 'json') {
      const hoursStr = String(now.getHours()).padStart(2, '0');
      const minsStr = String(now.getMinutes()).padStart(2, '0');
      filename = `medcore_apexhealth_backup_${now.toISOString().split('T')[0]}_${hoursStr}${minsStr}.json`;
      const exportPayload = {
        hospitalName: 'Apex Health Systems & Clinical Care',
        systemName: 'MedCore OS',
        version: '4.4.0',
        exportTimestamp: now.toISOString(),
        exportedBy: {
          id: currentUser.id,
          name: currentUser.name,
          role: currentUser.role,
          department: currentUser.department,
        },
        compliance,
        recordCounts,
        database: {
          patients,
          doctors,
          doctorDutySchedules,
          staffDutySchedules,
          appointments,
          invoices,
          wardBeds,
          staff,
          pharmacy,
          hospitalPriceCatalog,
          saveHospitalPriceItem,
          deactivateHospitalPriceItem,
          auditLogs,
        },
        checksum: `CRC32-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      };
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else {
      filename = `medcore_apexhealth_patients_archive_${now.toISOString().split('T')[0]}.csv`;
      const headers = 'ID,FirstName,LastName,Gender,Age,BloodGroup,Status,Phone,Email,PrimaryPhysician,ChronicConditions\n';
      const rows = patients
        .map(
          (p) =>
            `"${p.id}","${p.firstName}","${p.lastName}","${p.gender}",${p.age},"${p.bloodGroup}","${p.status}","${p.phone}","${p.email}","${p.primaryPhysicianName}","${p.chronicConditions.join(';')}"`
        )
        .join('\n');
      const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', url);
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
    }
    const timestamp = Date.now();
    setLastBackupTimestampState(timestamp);
    localStorage.setItem(STORAGE_KEYS.LAST_BACKUP_TIMESTAMP, timestamp.toString());
    setBackupReminderSnoozedUntilState(null);
    localStorage.removeItem(STORAGE_KEYS.BACKUP_SNOOZE_TIMESTAMP);
    setShowBackupReminderModal(false);
    logAuditEvent(
      'BACKUP_EXPORT',
      'Security Settings',
      'SYS-BACKUP-01',
      `Exported full 24h disaster recovery database dump (${format.toUpperCase()}) containing ${patients.length} patients and ${auditLogs.length} audit entries.`,
      'HIPAA Access Log'
    );
    addNotification(
      'Database Backup Saved',
      `Local ${format.toUpperCase()} archive downloaded. 24-hour backup reminder schedule renewed.`,
      'info'
    );
    return { success: true, filename, recordCounts };
  };

  const snoozeBackupReminder = (hours: number = 4) => {
    const snoozeUntil = Date.now() + hours * 60 * 60 * 1000;
    setBackupReminderSnoozedUntilState(snoozeUntil);
    localStorage.setItem(STORAGE_KEYS.BACKUP_SNOOZE_TIMESTAMP, snoozeUntil.toString());
    setShowBackupReminderModal(false);
    addNotification(
      'Backup Reminder Snoozed',
      `Administrator 24h backup prompt deferred for ${hours} hours.`,
      'info'
    );
  };

  const dismissBackupReminder = () => {
    setShowBackupReminderModal(false);
  };

  const triggerTestBackupReminder = () => {
    setShowBackupReminderModal(true);
  };

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || null;

  return (
    <HospitalContext.Provider
      value={{
        patients,
        doctors,
        doctorDutySchedules,
        doctorDutyChangeRequests,
        appointments,
        invoices,
        advancePayments,
        refundPayments,
        insuranceApprovals,
        posTransactions,
        receptionTokens,
        wardBeds,
        staff,
        pharmacy,
        auditLogs,
        compliance,
        notifications,
        selectedPatient,
        selectedPatientId,
        activeTab,
        openTabs,
        closeWorkspaceTab,
        closeOtherWorkspaceTabs,
        closeAllWorkspaceTabs,
        openWorkspaceTab,
        registrationMode,
        currentRole,
        currentUser,
        currentRoleDefinition,
        isAuthenticated,
        authenticatedUser,
        departmentPortal,
        appTheme,
        setAppTheme,
        showPortalSelect,
        setShowPortalSelect,
        login,
        logout,
        selectDepartmentPortal,
        setCurrentRole,
        setCurrentUserId,
        setActiveTab,
        setRegistrationMode,
        setSelectedPatientId,
        addPatient,
        updatePatient,
        updatePatientStatus,
        addVitals,
        addTriageAssessment,
        addMedication,
        addPrescription,
        addClinicalNote,
        addLabResult,
        updateLabResult,
        dischargePatient,
        bookAppointment,
        addAppointment,
        updateAppointmentStatus,
        callNextAppointment,
        createInvoice,
        issueInvoice,
        processPayment,
        processSplitPayments,
        addAdvancePayment,
        addRefundPayment,
        reviewRefundPayment,
        addInsuranceApproval,
        addCoderInsuranceApproval,
        updateInsuranceApprovalStatus,
        recordEmergencyStabilization,
        saveInsuranceAppealDraft,
        addPosTransaction,
        createReceptionToken,
        updateReceptionTokenStatus,
        advanceTokenWorkflow,
        updateTokenVitals,
        updateTokenDoctorOrders,
        recordTokenLineItemInsuranceResponse,
        submitTokenLineItemAppeal,
        addTokenLineItem,
        overrideTokenLineItemToSelfPay,
        settleTokenBilling,
        completeTokenDiagnosticReport,
        updateLabOrderStatus,
        recordLabTestResult,
        addEncounterDocument,
        assignBedToPatient,
        releaseBed,
        transferPatientBed,
        admitPatientToBed,
        medicalCertificates,
        issueMedicalCertificate,
        revokeMedicalCertificate,
        surgicalCases,
        addSurgicalCase,
        updateSurgicalStatus,
        updateWhoChecklist,
        bloodUnits,
        reserveBloodUnit,
        releaseBloodUnit,
        addBloodUnit,
        pharmacyDispenseRecords,
        dispensePrescriptionOrder,
        bedTransfers,
        setDoctorDutySchedule,
        setStaffDutySchedule,
        addStaff,
        deactivateStaff,
        updateStaff,
        submitDoctorDutyChangeRequest,
        reviewDoctorDutyChangeRequest,
        staffDutySchedules,
        hospitalPriceCatalog,
        saveHospitalPriceItem,
        deactivateHospitalPriceItem,
        publishInsuranceApproval,
        recordInsuranceGatewayResponse,
        recordTriageAssessment: (patientId: string, assessment: any) => addTriageAssessment(patientId, assessment),
        updateBedStatus: (bedId: string, status: WardBed['status']) => setWardBeds((prev) => prev.map((b) => (b.id === bedId ? { ...b, status } : b))),
        dispenseMedication: (itemId: string, quantity: number, patientId?: string) => dispensePharmacyItem(itemId, quantity, patientId || ''),
        restockMedication: (itemId: string, quantity: number) => restockPharmacyItem(itemId, quantity),
        dispensePharmacyItem,
        restockPharmacyItem,
        addPharmacyItem,
        logAuditEvent,
        updateCompliance,
        markNotificationRead,
        clearAllNotifications,
        addNotification,
        resetHospitalData,
        lastBackupTimestamp,
        backupReminderSnoozedUntil,
        isBackupOverdue,
        showBackupReminderModal,
        setShowBackupReminderModal,
        performDatabaseBackup,
        snoozeBackupReminder,
        dismissBackupReminder,
        triggerTestBackupReminder,
      }}
    >
      {children}
    </HospitalContext.Provider>
  );
};

export const useHospital = () => {
  const context = useContext(HospitalContext);
  if (!context) {
    throw new Error('useHospital must be used within a HospitalProvider');
  }
  return context;
};
