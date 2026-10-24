import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Clock,
  User,
  HeartPulse,
  Stethoscope,
  Receipt,
  FlaskConical,
  FileCheck2,
  AlertTriangle,
  ArrowRight,
  Printer,
  Send,
  Plus,
  Trash2,
  ShieldCheck,
  CreditCard,
  Building2,
  Phone,
  FileText,
  Activity,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useHospital } from '../../context/HospitalContext';
import {
  ReceptionToken,
  TokenWorkflowStage,
  PaymentSchemeType,
  TokenVitalsRecord,
  TokenDoctorOrder,
  TokenBillingSummary,
  TokenDiagnosticReport,
  TokenServiceItem,
  BillItem,
} from '../../types';
import { applyInsuranceBreakdown, sumInvoiceItemField } from '../../utils/insuranceInvoice';
import {
  aggregateTokenLineItemBilling,
  appendTokenLineItems,
  createDoctorOrderLineItems,
  createServiceLineItems,
  getEffectiveLineItemStatus,
  getTokenLineItemBillingBreakdown,
} from '../../utils/tokenStateMachine';

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character] || character));

const downloadTokenClaimFile = (token: ReceptionToken) => {
  const claim = {
    format: 'HMS visit-token claim summary',
    generatedAt: new Date().toISOString(),
    tokenId: token.id,
    tokenNumber: token.tokenNumber,
    patient: {
      id: token.patientId,
      name: token.patientName,
      emiratesId: token.patientDetails?.nationalId,
      insuranceProvider: token.paymentScheme?.insuranceProvider || token.insuranceProvider,
      policyNumber: token.paymentScheme?.policyNumber || token.patientDetails?.insurancePolicyNumber,
      coverageTier: token.paymentScheme?.coverageTier || token.paymentScheme?.network,
      coveragePercent: token.paymentScheme?.coveragePercent,
      copayPercent: token.paymentScheme?.copayPercent,
    },
    diagnoses: token.doctorOrders?.diagnoses || [],
    vitals: token.vitals,
    lineItems: token.lineItems || [],
    billingSummary: token.billingSummary,
  };
  const blob = new Blob([JSON.stringify(claim, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `token-${token.tokenNumber}-claim.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const printTokenReceipt = (token: ReceptionToken) => {
  if (!token.billingSummary) return false;
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return false;
  const rows = (token.lineItems || []).map((item) => {
    const breakdown = getTokenLineItemBillingBreakdown(item);
    return `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(getEffectiveLineItemStatus(item))}</td><td>AED ${breakdown.total.toFixed(2)}</td><td>AED ${breakdown.insuranceCoveredAmount.toFixed(2)}</td><td>AED ${breakdown.patientShare.toFixed(2)}</td></tr>`;
  }).join('');
  printWindow.document.write(`<!doctype html><html><head><title>Receipt ${escapeHtml(token.billingSummary.receiptNumber || token.tokenNumber)}</title><style>body{font:14px Arial,sans-serif;max-width:900px;margin:32px auto;color:#172033}h1{font-size:22px}p{margin:6px 0}table{width:100%;border-collapse:collapse;margin:22px 0}th,td{text-align:left;padding:9px;border-bottom:1px solid #d8dee8}th{background:#f1f5f9}.totals{margin-left:auto;width:320px}.totals p{display:flex;justify-content:space-between}.total{font-weight:bold;border-top:1px solid #172033;padding-top:10px}</style></head><body><h1>Visit Receipt</h1><p>Token #${escapeHtml(token.tokenNumber)} · Receipt ${escapeHtml(token.billingSummary.receiptNumber || 'Not assigned')}</p><p>${escapeHtml(token.patientName)} · Patient ID ${escapeHtml(token.patientId)} · ${escapeHtml(token.department)}</p><p>Insurer: ${escapeHtml(token.paymentScheme?.insuranceProvider || token.insuranceProvider || 'Self-Pay')} · Coverage tier: ${escapeHtml(token.paymentScheme?.coverageTier || token.paymentScheme?.network || 'Not recorded')}</p><table><thead><tr><th>Service</th><th>Final status</th><th>Charge</th><th>Insurer</th><th>Patient</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><p><span>Subtotal</span><span>AED ${token.billingSummary.subtotal.toFixed(2)}</span></p><p><span>Insurer share</span><span>AED ${token.billingSummary.insuranceCoveredAmount.toFixed(2)}</span></p><p class="total"><span>Patient paid</span><span>AED ${token.billingSummary.totalPaid.toFixed(2)}</span></p><p><span>Cashier</span><span>${escapeHtml(token.billingSummary.cashierName)}</span></p><p><span>Invoice</span><span>${escapeHtml(token.billingSummary.invoiceNumber || 'Not assigned')}</span></p></div><script>window.onload=()=>window.print()</script></body></html>`);
  printWindow.document.close();
  return true;
};

interface TokenWorkflowModalProps {
  token: ReceptionToken | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPatientFile?: (patientId: string) => void;
  initialStage?: TokenWorkflowStage;
}

const STAGES: Array<{
  id: TokenWorkflowStage;
  stepNumber: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    id: '1_REGISTRATION',
    stepNumber: 1,
    label: 'Registration',
    icon: User,
    description: 'Patient intake & payment scheme',
  },
  {
    id: '2_NURSING_VITALS',
    stepNumber: 2,
    label: 'Nursing Vitals',
    icon: HeartPulse,
    description: 'Vitals & triage score',
  },
  {
    id: '3_DOCTOR_EMR',
    stepNumber: 3,
    label: 'Doctor EMR',
    icon: Stethoscope,
    description: 'Health summary, diagnosis & CPT orders',
  },
  {
    id: '4_CASHIER_BILLING',
    stepNumber: 4,
    label: 'Cashier Invoicing',
    icon: Receipt,
    description: 'Invoice services & collect payment',
  },
  {
    id: '5_DIAGNOSTICS_PROCEDURES',
    stepNumber: 5,
    label: 'Lab & Radiology',
    icon: FlaskConical,
    description: 'Execute diagnostics & procedures',
  },
  {
    id: '6_COMPLETED_REPORTS',
    stepNumber: 6,
    label: 'Reports Dispatched',
    icon: FileCheck2,
    description: 'Reports sent to doctor EMR & patient',
  },
];

export const TokenWorkflowModal: React.FC<TokenWorkflowModalProps> = ({
  token,
  isOpen,
  onClose,
  onOpenPatientFile,
  initialStage,
}) => {
  const {
    updateTokenVitals,
    updateTokenDoctorOrders,
    settleTokenBilling,
    completeTokenDiagnosticReport,
    advanceTokenWorkflow,
    currentUser,
    patients,
    receptionTokens,
    hospitalPriceCatalog,
    pharmacy,
    addNotification,
    overrideTokenLineItemToSelfPay,
    submitTokenLineItemAppeal,
    currentRole,
  } = useHospital();

  const [activeTab, setActiveTab] = useState<TokenWorkflowStage>('1_REGISTRATION');

  // Step 2: Nurse Vitals Form State
  const [bpSystolic, setBpSystolic] = useState<number>(120);
  const [bpDiastolic, setBpDiastolic] = useState<number>(80);
  const [heartRate, setHeartRate] = useState<number>(75);
  const [spO2, setSpO2] = useState<number>(98);
  const [temperature, setTemperature] = useState<number>(98.6);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(16);
  const [bloodGlucose, setBloodGlucose] = useState<number>(95);
  const [painScale, setPainScale] = useState<number>(0);
  const [triageLevel, setTriageLevel] = useState<TokenVitalsRecord['triageLevel']>('Level 3 - Urgent');
  const [nursingNotes, setNursingNotes] = useState<string>('Patient oriented x3. Ambulatory.');
  const [serviceItems, setServiceItems] = useState<TokenServiceItem[]>([]);
  const [serviceItemName, setServiceItemName] = useState('');
  const [serviceItemPrice, setServiceItemPrice] = useState('');
  const [serviceItemCategory, setServiceItemCategory] = useState<TokenServiceItem['category']>('Test');
  const [serviceItemError, setServiceItemError] = useState('');

  // Step 3: Doctor EMR Form State
  const [healthSummary, setHealthSummary] = useState<string>('');
  const [chiefComplaint, setChiefComplaint] = useState<string>('');
  const [clinicalAssessment, setClinicalAssessment] = useState<string>('');
  const [diagnoses, setDiagnoses] = useState<Array<{ code: string; description: string }>>([]);
  const [selectedDiagnosisCode, setSelectedDiagnosisCode] = useState('');
  const [doctorFormError, setDoctorFormError] = useState('');
  const [appealReasons, setAppealReasons] = useState<Record<string, string>>({});
  const [consultationFee, setConsultationFee] = useState<number>(200);

  // Diagnostic Orders in EMR
  const [labOrders, setLabOrders] = useState<TokenDoctorOrder['labRequests']>([]);
  const [radiologyOrders, setRadiologyOrders] = useState<TokenDoctorOrder['radiologyRequests']>([]);
  const [procedureOrders, setProcedureOrders] = useState<TokenDoctorOrder['procedureRequests']>([]);
  const [medicationRequests, setMedicationRequests] = useState<NonNullable<TokenDoctorOrder['medicationRequests']>>([]);
  const [catalogSearch, setCatalogSearch] = useState('');

  // Step 4: Cashier Form State
  const [paymentMethod, setPaymentMethod] = useState<TokenBillingSummary['paymentMethod']>('Credit/Debit Card');
  const [insuranceAuthorizationStatus, setInsuranceAuthorizationStatus] = useState<NonNullable<TokenBillingSummary['insuranceAuthorizationStatus']>>('Not Required');
  const [applyDailyInsuranceLimit, setApplyDailyInsuranceLimit] = useState(false);

  // Step 5: Diagnostics Execution State
  const [diagnosticType, setDiagnosticType] = useState<'Laboratory' | 'Radiology'>('Laboratory');
  const [testOrStudyName, setTestOrStudyName] = useState('Complete Blood Count (CBC with Diff)');
  const [diagnosticFindings, setDiagnosticFindings] = useState('WBC: 6.5 K/uL, Hemoglobin: 14.2 g/dL, Platelets: 245 K/uL. Normal morphology.');
  const [diagnosticImpression, setDiagnosticImpression] = useState('Parameters within normal physiologic limits. No leukocytosis.');
  const [diagnosticResultValue, setDiagnosticResultValue] = useState('WBC 6.5 | Hb 14.2');
  const [diagnosticStatus, setDiagnosticStatus] = useState<TokenDiagnosticReport['status']>('Normal');

  useEffect(() => {
    if (token) {
      setActiveTab(initialStage || token.currentStage || '1_REGISTRATION');
      setInsuranceAuthorizationStatus(
        token.billingSummary?.insuranceAuthorizationStatus ||
        (token.paymentScheme?.preAuthStatus === 'Pending' ? 'Required' : token.paymentScheme?.preAuthStatus) ||
        (token.patientDetails?.insurancePreAuthorizationRequired ? 'Required' : 'Not Required')
      );
      setApplyDailyInsuranceLimit(token.billingSummary?.dailyInsuranceLimitApplied || false);
      if (token.vitals) {
        setBpSystolic(token.vitals.bpSystolic);
        setBpDiastolic(token.vitals.bpDiastolic);
        setHeartRate(token.vitals.heartRate);
        setSpO2(token.vitals.spO2);
        setTemperature(token.vitals.temperature);
        setRespiratoryRate(token.vitals.respiratoryRate);
        if (token.vitals.bloodGlucose) setBloodGlucose(token.vitals.bloodGlucose);
        if (token.vitals.painScale !== undefined) setPainScale(token.vitals.painScale);
        setTriageLevel(token.vitals.triageLevel);
        if (token.vitals.nursingNotes) setNursingNotes(token.vitals.nursingNotes);
      }
      setServiceItems(token.serviceItems || []);
      setServiceItemName('');
      setServiceItemPrice('');
      setServiceItemCategory(token.serviceType === 'Physio Technician' ? 'Technician Service' : 'Test');
      setServiceItemError('');
      if (token.doctorOrders) {
        setHealthSummary(token.doctorOrders.healthSummary || '');
        setChiefComplaint(token.doctorOrders.chiefComplaint || '');
        setClinicalAssessment(token.doctorOrders.clinicalAssessment || '');
        setDiagnoses(token.doctorOrders.diagnoses || []);
        setConsultationFee(token.doctorOrders.consultationFee || 200);
        setLabOrders(token.doctorOrders.labRequests || []);
        setRadiologyOrders(token.doctorOrders.radiologyRequests || []);
        setProcedureOrders(token.doctorOrders.procedureRequests || []);
        setMedicationRequests(token.doctorOrders.medicationRequests || []);
      } else {
        setHealthSummary('');
        setChiefComplaint('');
        setClinicalAssessment('');
        setDiagnoses([]);
        setSelectedDiagnosisCode('');
        setConsultationFee(200);
        setLabOrders([]);
        setRadiologyOrders([]);
        setProcedureOrders([]);
        setMedicationRequests([]);
      }
      setDoctorFormError('');
    }
  }, [token?.id, isOpen, initialStage]);

  if (!isOpen || !token) return null;

  const currentStageIndex = STAGES.findIndex((s) => s.id === (token.currentStage || '1_REGISTRATION'));

  // Calculate Cashier Totals
  const currentConsult = token.serviceType === 'Consultation'
    ? token.doctorOrders?.consultationFee ?? consultationFee
    : 0;
  const currentLabOrders = token.serviceType === 'Consultation' ? token.doctorOrders?.labRequests || labOrders : [];
  const currentRadiologyOrders = token.serviceType === 'Consultation' ? token.doctorOrders?.radiologyRequests || radiologyOrders : [];
  const currentProcedureOrders = token.serviceType === 'Consultation' ? token.doctorOrders?.procedureRequests || procedureOrders : [];
  const currentServiceItems = token.serviceType === 'Consultation' ? [] : serviceItems;
  const scheme = token.paymentScheme || { schemeType: 'Self-Pay' as PaymentSchemeType };
  const fallbackBillingItems: BillItem[] = [
    ...(currentConsult > 0 ? [{
      id: `${token.id}-consultation`,
      description: `Physician Consultation — ${token.doctorName || 'Attending Physician'}`,
      category: 'Consultation' as const,
      unitCost: currentConsult,
      quantity: 1,
      amount: currentConsult,
    }] : []),
    ...currentServiceItems.map((item) => ({
      id: item.id,
      description: item.name,
      category: item.category === 'Test' ? 'Lab Test' as const : item.category === 'Procedure' ? 'Surgical Procedure' as const : 'Technician Service' as const,
      unitCost: item.price,
      quantity: 1,
      amount: item.price,
    })),
    ...currentLabOrders.map((item) => ({
      id: item.id,
      serviceCode: item.id,
      cptCode: item.cptCode,
      description: item.testName,
      category: 'Lab Test' as const,
      unitCost: item.price,
      quantity: 1,
      amount: item.price,
    })),
    ...currentRadiologyOrders.map((item) => ({
      id: item.id,
      serviceCode: item.id,
      cptCode: item.cptCode,
      description: item.studyName,
      category: 'Radiology' as const,
      unitCost: item.price,
      quantity: 1,
      amount: item.price,
    })),
    ...currentProcedureOrders.map((item) => ({
      id: item.id,
      cptCode: item.cptCode,
      description: item.procedureName,
      category: 'Surgical Procedure' as const,
      unitCost: item.price,
      quantity: 1,
      amount: item.price,
    })),
    ...(token.serviceType === 'Consultation' ? token.doctorOrders?.medicationRequests || [] : []).map((item) => ({
      id: item.id,
      serviceCode: item.sku,
      description: `${item.medicationName} (${item.sku})`,
      category: 'Pharmacy' as const,
      unitCost: item.unitPrice,
      quantity: item.quantity,
      amount: item.price,
    })),
  ];
  const tokenLineItems = token.lineItems?.length ? token.lineItems : appendTokenLineItems(
    createServiceLineItems(token, token.serviceItems || []),
    token.doctorOrders ? createDoctorOrderLineItems(token, token.doctorOrders) : []
  );
  const tokenLineItemBilling = tokenLineItems.map((item): BillItem => {
    const breakdown = getTokenLineItemBillingBreakdown(item);
    return {
      id: item.id,
      serviceCode: item.code,
      description: item.name,
      category: item.kind === 'Consultation'
        ? 'Consultation'
        : item.kind === 'Lab'
          ? 'Lab Test'
          : item.kind === 'Radiology'
            ? 'Radiology'
            : item.kind === 'Medication'
              ? 'Pharmacy'
              : item.kind === 'Procedure'
                ? 'Surgical Procedure'
                : 'Technician Service',
      unitCost: item.unitPrice,
      quantity: item.quantity,
      amount: breakdown.total,
      totalPrice: breakdown.total,
      netAmount: breakdown.total,
      insuranceAmount: breakdown.insuranceCoveredAmount,
      copayAmount: breakdown.copayAmount,
    };
  });
  const billingItems = tokenLineItems.length ? tokenLineItemBilling : fallbackBillingItems;
  let subtotal = billingItems.reduce((total, item) => total + item.amount, 0);
  let insuranceBillingItems = scheme.schemeType === 'Insurance'
    ? applyInsuranceBreakdown(
        billingItems,
        scheme.serviceCopay,
        100 - (scheme.coveragePercent ?? 80),
        scheme.deductibleAmount
      )
    : billingItems;
  const dailyInsuranceLimitAed = token.patientDetails?.insuranceDailyClinicLimitAed;
  const visitDate = token.visitDate || token.createdDate;
  const usedInsuranceTodayAed = receptionTokens
    .filter((visitToken) =>
      visitToken.id !== token.id &&
      visitToken.patientId === token.patientId &&
      (visitToken.visitDate || visitToken.createdDate) === visitDate &&
      visitToken.billingSummary?.schemeType === 'Insurance'
    )
    .reduce((total, visitToken) => total + (visitToken.billingSummary?.insuranceCoveredAmount || 0), 0);
  const dailyLimitRemainingAed = dailyInsuranceLimitAed === undefined
    ? undefined
    : Math.max(0, dailyInsuranceLimitAed - usedInsuranceTodayAed);
  let insuranceCovered = 0;
  let discountAmount = 0;
  let patientPortion = subtotal;

  if (scheme.schemeType === 'Insurance') {
    insuranceCovered = sumInvoiceItemField(insuranceBillingItems, 'insuranceAmount');
    discountAmount = sumInvoiceItemField(insuranceBillingItems, 'discountAmount');
    patientPortion = Math.max(0, sumInvoiceItemField(insuranceBillingItems, 'netAmount') - insuranceCovered);
  } else if (scheme.schemeType === 'Corporate' || scheme.schemeType === 'Package') {
    const cov = scheme.coveragePercent || 80;
    insuranceCovered = Math.round(subtotal * (cov / 100));
    patientPortion = Math.max(0, subtotal - insuranceCovered);
    if (scheme.copayAmount && scheme.copayAmount > 0) {
      patientPortion = scheme.copayAmount;
      insuranceCovered = Math.max(0, subtotal - scheme.copayAmount);
    }
  } else if (scheme.schemeType === 'Discount Card') {
    const disc = scheme.discountPercent || 20;
    discountAmount = Math.round(subtotal * (disc / 100));
    patientPortion = Math.max(0, subtotal - discountAmount);
  }
  const tokenBillingTotals = aggregateTokenLineItemBilling(tokenLineItems);
  const tokenAuthorizationStatus: TokenBillingSummary['insuranceAuthorizationStatus'] =
    tokenLineItems.length === 0
      ? insuranceAuthorizationStatus
      : tokenLineItems.some((item) => getEffectiveLineItemStatus(item) === 'Pending_Auth')
        ? 'Required'
        : tokenLineItems.some((item) => ['Approved', 'Partially_Approved'].includes(getEffectiveLineItemStatus(item)))
          ? 'Approved'
          : 'Not Required';
  if (tokenLineItems.length) {
    subtotal = tokenBillingTotals.subtotal;
    insuranceCovered = tokenBillingTotals.insuranceCoveredAmount;
    discountAmount = 0;
    patientPortion = tokenBillingTotals.patientShare;
    insuranceBillingItems = tokenLineItemBilling;
  }
  const projectedInsuranceTodayAed = usedInsuranceTodayAed + insuranceCovered;
  const dailyInsuranceLimitExceeded = applyDailyInsuranceLimit &&
    dailyInsuranceLimitAed !== undefined &&
    projectedInsuranceTodayAed > dailyInsuranceLimitAed;

  // Handle Step 2 Submission (Nursing Vitals)
  const handleSaveVitals = (e: React.FormEvent) => {
    e.preventDefault();
    const isNurseServiceToken = token.serviceType === 'Billing & Cashier' || token.serviceType === 'Physio Technician';
    if (isNurseServiceToken && serviceItems.length === 0) {
      setServiceItemError(token.serviceType === 'Physio Technician'
        ? 'Add at least one technician service before sending this token to cashier.'
        : 'Add at least one test or procedure before sending this token to cashier.');
      return;
    }
    setServiceItemError('');
    const vitalsRecord: TokenVitalsRecord = {
      bpSystolic,
      bpDiastolic,
      heartRate,
      spO2,
      temperature,
      respiratoryRate,
      bloodGlucose,
      painScale,
      triageLevel,
      nursingNotes,
      nurseName: currentUser?.name || 'Triage Nurse Staff, RN',
      recordedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
    updateTokenVitals(token.id, vitalsRecord, isNurseServiceToken ? serviceItems : undefined);
    setActiveTab(isNurseServiceToken ? '4_CASHIER_BILLING' : '3_DOCTOR_EMR');
  };

  const handleSaveTechnicianServices = () => {
    if (serviceItems.length === 0) {
      setServiceItemError('Add at least one technician service before sending this token to cashier.');
      return;
    }
    setServiceItemError('');
    advanceTokenWorkflow(token.id, '4_CASHIER_BILLING', { serviceItems });
    setActiveTab('4_CASHIER_BILLING');
  };

  const addServiceItem = () => {
    if (!serviceItemName.trim() || !Number.isFinite(Number(serviceItemPrice)) || Number(serviceItemPrice) <= 0) {
      setServiceItemError('Enter a service name and a price greater than zero.');
      return;
    }
    setServiceItems((items) => [...items, {
      id: `TS-${Date.now()}-${items.length}`,
      name: serviceItemName.trim(),
      category: token?.serviceType === 'Physio Technician' ? 'Technician Service' : serviceItemCategory,
      price: Number(serviceItemPrice),
      addedBy: currentUser?.name || 'Clinical Staff',
      addedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    }]);
    setServiceItemName('');
    setServiceItemPrice('');
    setServiceItemError('');
  };

  const addCatalogOrder = (entry: { id: string; code: string; cptCode?: string; name: string; category: string; price: number; department?: string; dosageForm?: string; sku?: string }) => {
    const id = `${entry.id}-${Date.now()}`;
    if (entry.sku || entry.category === 'Medication') {
      setMedicationRequests((items) => [...items, {
        id,
        sku: entry.sku || entry.code,
        medicationName: entry.name,
        quantity: 1,
        unitPrice: entry.price,
        price: entry.price,
      }]);
    } else if (entry.category === 'Diagnostic Lab') {
      setLabOrders((items) => [...items, {
        id,
        testName: entry.name,
        category: entry.department || 'Laboratory',
        cptCode: entry.cptCode,
        price: entry.price,
        status: 'Ordered',
      }]);
    } else if (entry.category === 'Radiology & Imaging') {
      setRadiologyOrders((items) => [...items, {
        id,
        studyName: entry.name,
        modality: entry.department || 'Imaging',
        cptCode: entry.cptCode,
        price: entry.price,
        status: 'Ordered',
      }]);
    } else {
      setProcedureOrders((items) => [...items, {
        id,
        cptCode: entry.cptCode || entry.code,
        procedureName: entry.name,
        price: entry.price,
        status: 'Scheduled',
      }]);
    }
    setCatalogSearch('');
  };

  // Handle Step 3 Submission (Doctor EMR)
  const handleSaveDoctorOrders = (e: React.FormEvent) => {
    e.preventDefault();
    if (!healthSummary.trim() || !clinicalAssessment.trim() || diagnoses.length === 0) {
      setDoctorFormError('Enter the patient health summary, clinical assessment, and at least one diagnosis before saving.');
      return;
    }
    setDoctorFormError('');
    const doctorOrder: TokenDoctorOrder = {
      healthSummary: healthSummary.trim(),
      chiefComplaint: chiefComplaint.trim(),
      clinicalAssessment: clinicalAssessment.trim(),
      diagnoses,
      labRequests: labOrders,
      radiologyRequests: radiologyOrders,
      procedureRequests: procedureOrders,
      medicationRequests,
      consultationFee,
      orderedByDoctorId: token.doctorId || currentUser?.id || 'DOC-DEFAULT',
      orderedByDoctorName: token.doctorName || currentUser?.name || 'Attending Physician, MD',
      orderedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
    updateTokenDoctorOrders(token.id, doctorOrder);
    setActiveTab('4_CASHIER_BILLING');
  };

  // Handle Step 4 Submission (Cashier Billing)
  const handleSettleCashier = () => {
    if (tokenBillingTotals.pendingItemIds.length) {
      addNotification(
        'Billing Blocked: Authorization Pending',
        `Resolve authorization for ${tokenBillingTotals.pendingItemIds.join(', ')} before settling this token.`,
        'warning',
        token.id
      );
      return;
    }
    if (dailyInsuranceLimitExceeded) {
      addNotification(
        'Daily Insurance Limit Exceeded',
        `This invoice would bring the patient’s insurer-covered total to AED ${projectedInsuranceTodayAed.toFixed(2)}, above the daily limit of AED ${dailyInsuranceLimitAed?.toFixed(2)}. Adjust the invoice or disable the optional limit only when appropriate.`,
        'warning',
        token.patientId
      );
      return;
    }
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const billingSummary: TokenBillingSummary = {
      invoiceNumber: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      subtotal,
      items: tokenLineItems.length
        ? tokenLineItemBilling
        : scheme.schemeType === 'Insurance' ? insuranceBillingItems : billingItems,
      schemeType: scheme.schemeType,
      insuranceCoveredAmount: insuranceCovered,
      discountAmount,
      copayOrSelfPayAmount: patientPortion,
      copayAmount: scheme.schemeType === 'Insurance' ? sumInvoiceItemField(insuranceBillingItems, 'copayAmount') : undefined,
      deductibleAmount: scheme.schemeType === 'Insurance' ? sumInvoiceItemField(insuranceBillingItems, 'deductibleAmount') : undefined,
      totalPaid: patientPortion,
      balanceDue: 0,
      paymentMethod,
      paymentStatus: 'Paid',
      receiptNumber: `RCP-${Math.floor(10000 + Math.random() * 90000)}`,
      cashierName: currentUser?.name || 'Cashier Desk Terminal',
      billedAt: now,
      insuranceAuthorizationStatus: scheme.schemeType === 'Insurance' ? tokenAuthorizationStatus : undefined,
      dailyInsuranceLimitApplied: scheme.schemeType === 'Insurance' ? applyDailyInsuranceLimit : undefined,
      dailyInsuranceLimitAed: scheme.schemeType === 'Insurance' && applyDailyInsuranceLimit ? dailyInsuranceLimitAed : undefined,
      dailyInsuranceUsedBeforeAed: scheme.schemeType === 'Insurance' && applyDailyInsuranceLimit ? usedInsuranceTodayAed : undefined,
      dailyInsuranceUsedAfterAed: scheme.schemeType === 'Insurance' && applyDailyInsuranceLimit ? projectedInsuranceTodayAed : undefined,
    };
    settleTokenBilling(token.id, billingSummary);
    const hasDiagnostics = token.serviceType === 'Consultation' && (
      currentLabOrders.length > 0 ||
      currentRadiologyOrders.length > 0 ||
      currentProcedureOrders.length > 0
    );
    setActiveTab(hasDiagnostics ? '5_DIAGNOSTICS_PROCEDURES' : '6_COMPLETED_REPORTS');
  };

  // Handle Step 5 Submission (Diagnostics Execution)
  const handleDispatchReport = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const today = new Date().toISOString().split('T')[0];
    const report: TokenDiagnosticReport = {
      id: `REP-${Date.now().toString().slice(-5)}`,
      testOrStudyName,
      department: diagnosticType === 'Radiology' ? 'Radiology' : 'Laboratory',
      category: diagnosticType === 'Radiology' ? 'Radiology & Imaging' : 'Biochemistry / Hematology',
      cptOrCode: diagnosticType === 'Radiology' ? 'CPT 71046' : 'CPT 85025',
      date: today,
      time: now,
      findings: diagnosticFindings,
      impression: diagnosticImpression,
      resultValue: diagnosticResultValue,
      referenceRange: 'Normal reference limits verified',
      status: diagnosticStatus,
      technicianOrRadiologist: currentUser?.name || (diagnosticType === 'Radiology' ? 'Dr. Katherine Cole, MD (Radiology)' : 'Alex Mercer, MLS(ASCP)'),
      completedAt: now,
      sentToPatient: true,
      sentToDoctor: true,
      sentTimestamp: `${today} ${now}`,
    };
    completeTokenDiagnosticReport(token.id, report);
    setActiveTab('6_COMPLETED_REPORTS');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl my-4 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-400 font-bold text-lg">
              {token.tokenNumber}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold tracking-tight text-white">{token.patientName}</h3>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {token.patientId}
                </span>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-teal-900/50 text-teal-300 border border-teal-700/50">
                  {token.paymentScheme?.schemeType || 'Self-Pay'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {token.department} • Room/Counter: {token.counterOrRoom} • Doctor: {token.doctorName || 'Assigned on Queue'} • Time: {token.createdTime}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 6-Stage Interactive Workflow Stepper Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[700px] gap-2">
            {STAGES.map((s, idx) => {
              const isPast = idx < currentStageIndex;
              const isCurrent = s.id === token.currentStage;
              const isSelected = s.id === activeTab;
              const Icon = s.icon;

              return (
                <button
                  key={s.id}
                  onClick={() => setActiveTab(s.id)}
                  className={`flex-1 flex items-center gap-2 p-2 rounded-lg text-left transition-all border ${
                    isSelected
                      ? 'bg-teal-50/70 border-teal-600 shadow-xs'
                      : isCurrent
                      ? 'bg-amber-50/70 border-amber-400'
                      : isPast
                      ? 'bg-emerald-50/40 border-emerald-300 hover:bg-slate-100'
                      : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isPast
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-4 h-4" /> : s.stepNumber}
                  </div>
                  <div className="min-w-0 pr-1">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{s.label}</p>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{s.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Main Body (Stage specific content) */}
        <div className="flex-1 p-6 overflow-y-auto bg-white">
          <section className="mb-6 rounded-xl border border-blue-200 bg-blue-50/60 p-4" aria-label="Shared patient and visit details">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Shared Patient & Visit Record</h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  Token {token.tokenNumber} · {token.registrationSource || 'Registration'} · {token.status}
                  {token.bookingChannel ? ` · ${token.bookingChannel}` : ''}
                </p>
              </div>
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-blue-800">
                {token.currentStage || '1_REGISTRATION'}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Patient / MRN</dt><dd className="mt-0.5 font-medium text-slate-900">{[token.patientDetails?.title, token.patientName].filter(Boolean).join(' ')} · {token.patientId}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Registration no.</dt><dd className="mt-0.5 text-slate-800">{token.patientDetails?.registrationNumber || token.patientId}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Phone</dt><dd className="mt-0.5 text-slate-800">{token.patientPhone || 'Not recorded'}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Age / Gender / Date of birth</dt><dd className="mt-0.5 text-slate-800">{token.patientAge ?? 'Not recorded'} · {token.patientGender || 'Not recorded'} · {token.patientDetails?.dateOfBirth || 'Not recorded'}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Blood group / Nationality / Marital status</dt><dd className="mt-0.5 text-slate-800">{token.patientDetails?.bloodGroup || 'Not recorded'} · {token.patientDetails?.nationality || 'Not recorded'} · {token.patientDetails?.maritalStatus || 'Not recorded'}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase text-slate-500">National ID / Passport</dt><dd className="mt-0.5 text-slate-800">{token.patientDetails?.nationalId || 'Not recorded'} / {token.patientDetails?.passportNumber || 'Not recorded'}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Email</dt><dd className="mt-0.5 text-slate-800">{token.patientDetails?.email || 'Not recorded'}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Address</dt><dd className="mt-0.5 text-slate-800">{token.patientDetails?.address || 'Not recorded'}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Department / clinician</dt><dd className="mt-0.5 text-slate-800">{token.department} · {token.doctorName || 'Not assigned'}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Visit reason</dt><dd className="mt-0.5 text-slate-800">{token.visitPurpose || token.visitComplaint || 'Not recorded'}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Insurance / payment</dt><dd className="mt-0.5 text-slate-800">{token.insuranceProvider || 'Not recorded'} · {token.payMode || token.paymentScheme?.schemeType || 'Not recorded'}</dd></div>
              {token.patientDetails?.insuranceProvider && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-[10px] font-semibold uppercase text-slate-500">UAE insurance verification details</dt>
                  <dd className="mt-0.5 text-slate-800">
                    Payer: {token.patientDetails.insuranceProvider}
                    {token.patientDetails.insuranceTpa ? ` · TPA: ${token.patientDetails.insuranceTpa}` : ''}
                    {token.patientDetails.insuranceRegulator ? ` · ${token.patientDetails.insuranceRegulator}` : ''}
                    {token.patientDetails.insuranceNetwork ? ` · Network: ${token.patientDetails.insuranceNetwork}` : ''}
                    {token.patientDetails.insurancePlanName ? ` · Plan: ${token.patientDetails.insurancePlanName}` : ''}
                    {token.patientDetails.insuranceCardNumber ? ` · Card: ${token.patientDetails.insuranceCardNumber}` : ''}
                    {token.patientDetails.insurancePolicyNumber ? ` · Policy: ${token.patientDetails.insurancePolicyNumber}` : ''}
                    {token.patientDetails.insuranceMemberId ? ` · Member: ${token.patientDetails.insuranceMemberId}` : ''}
                    {token.patientDetails.insuranceStatus ? ` · Status: ${token.patientDetails.insuranceStatus}` : ''}
                    {token.patientDetails.insuranceVerificationReference ? ` · Verification ref: ${token.patientDetails.insuranceVerificationReference}` : ''}
                    {token.patientDetails.insuranceDailyClinicLimitAed !== undefined ? ` · Daily clinic limit: AED ${token.patientDetails.insuranceDailyClinicLimitAed.toFixed(2)}` : ''}
                    {token.patientDetails.insurancePreAuthorizationRequired ? ' · Pre-authorization required by policy' : ''}
                  </dd>
                </div>
              )}
              <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Allergies</dt><dd className="mt-0.5 text-slate-800">{token.patientDetails?.allergies?.map((allergy) => `${allergy.allergen} (${allergy.severity})`).join(', ') || 'None recorded'}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Chronic conditions</dt><dd className="mt-0.5 text-slate-800">{token.patientDetails?.chronicConditions?.join(', ') || 'None recorded'}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Emergency contact</dt><dd className="mt-0.5 text-slate-800">{token.patientDetails?.emergencyContact ? `${token.patientDetails.emergencyContact.name} · ${token.patientDetails.emergencyContact.relationship} · ${token.patientDetails.emergencyContact.phone}` : 'Not recorded'}</dd></div>
              <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Registration consent</dt><dd className="mt-0.5 text-slate-800">{token.patientDetails?.consentSigned ? `Signed by ${token.patientDetails.consentSignature || 'patient'} (${token.patientDetails.consentSignerRole || 'Patient'}) · ${token.patientDetails.consentTimestamp || 'time not recorded'}` : 'Not recorded'}</dd></div>
              {token.appointmentId && <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Appointment</dt><dd className="mt-0.5 text-slate-800">{token.appointmentId}</dd></div>}
            </dl>
            {token.patientDetails?.insuranceCards?.length ? (
              <div className="mt-3 border-t border-blue-200 pt-3 text-xs">
                <h4 className="text-[10px] font-semibold uppercase text-slate-500">Insurance cards</h4>
                <ul className="mt-1 space-y-1 text-slate-800">
                  {token.patientDetails.insuranceCards.map((card) => (
                    <li key={card.id}>{card.payerName} · {card.plan} · Card {card.cardNumber} · Expires {card.expiryDate}{card.isPrimary ? ' · Primary' : ''}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {/* STAGE 1: REGISTRATION */}
          {activeTab === '1_REGISTRATION' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-teal-600" />
                    Step 1: Patient Intake & Payment Scheme Registration
                  </h4>
                  <p className="text-sm text-slate-500">
                    Patient demographic check-in, token generation, and payment scheme classification.
                  </p>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                  Registered Successfully
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Patient Profile Card */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Patient Details</h5>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Full Name:</span>
                      <span className="font-medium text-slate-900">{token.patientName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Patient MRN:</span>
                      <span className="font-mono text-slate-900">{token.patientId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phone Contact:</span>
                      <span className="text-slate-900">{token.patientPhone || 'Not recorded'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Assigned Department:</span>
                      <span className="font-medium text-slate-900">{token.department}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Target Physician:</span>
                      <span className="text-slate-900">{token.doctorName || 'Assigned by Queue'}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Scheme Details */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Selected Payment Scheme</h5>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-teal-100 text-teal-800">
                      {scheme.schemeType}
                    </span>
                  </div>

                  {scheme.schemeType === 'Insurance' && (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Payer / Provider:</span>
                        <span className="font-medium text-slate-900">{scheme.insuranceProvider || 'Blue Cross Blue Shield'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Policy Number:</span>
                        <span className="font-mono text-slate-900">{scheme.policyNumber || 'BCBS-991204'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Network Tier:</span>
                        <span className="text-slate-900">{scheme.coverageTier || scheme.network || 'Not recorded'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Coverage Level:</span>
                        <span className="font-semibold text-emerald-700">{scheme.coveragePercent ?? 80}% Insurer Paid</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Configured Co-pay:</span>
                        <span className="font-semibold text-slate-900">{scheme.copayPercent ?? (100 - (scheme.coveragePercent ?? 80))}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Copay Payable:</span>
                        <span className="font-semibold text-slate-900">AED {scheme.copayAmount || 25}</span>
                      </div>
                    </div>
                  )}

                  {scheme.schemeType === 'Corporate' && (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Corporate Payer:</span><span className="font-medium text-slate-900">{scheme.corporateName || 'Corporate Account'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Corporate Number:</span><span className="font-mono text-slate-900">{scheme.corporateNumber || 'Not provided'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Coverage Level:</span><span className="font-semibold text-emerald-700">{scheme.coveragePercent || 80}% Corporate Paid</span></div>
                    </div>
                  )}

                  {scheme.schemeType === 'Package' && (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Package:</span><span className="font-medium text-slate-900">{scheme.packageName || 'Hospital Package'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Package Number:</span><span className="font-mono text-slate-900">{scheme.packageNumber || 'Not provided'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Coverage Level:</span><span className="font-semibold text-emerald-700">{scheme.coveragePercent || 80}% Package Covered</span></div>
                    </div>
                  )}

                  {scheme.schemeType === 'Discount Card' && (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Discount Scheme:</span>
                        <span className="font-medium text-slate-900">{scheme.discountCardName || 'Senior Citizen Card (20%)'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Card Identifier:</span>
                        <span className="font-mono text-slate-900">{scheme.discountCardNumber || 'SNR-2026-8891'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Applied Discount:</span>
                        <span className="font-bold text-emerald-700">{scheme.discountPercent || 20}% OFF Total Bill</span>
                      </div>
                    </div>
                  )}

                  {scheme.schemeType === 'Self-Pay' && (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Billing Responsibility:</span>
                        <span className="font-medium text-slate-900">100% Patient Payable</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Payment Modes Accepted:</span>
                        <span className="text-slate-900">Cash, Debit/Credit Card, HSA, POS</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Estimate Clearance:</span>
                        <span className="text-slate-900">Payable at Step 4 Cashier</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Next Step Action Prompt */}
              <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-teal-900">Next Action: Step 2 Nursing Staff Vitals</p>
                  <p className="text-xs text-teal-700">Patient has been directed to the Nursing Station for vital signs and initial triage assessment.</p>
                </div>
                <button
                  onClick={() => setActiveTab('2_NURSING_VITALS')}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  Proceed to Step 2 (Vitals) <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: NURSING STAFF VITALS */}
          {activeTab === '2_NURSING_VITALS' && (
            <form onSubmit={handleSaveVitals} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    {token.serviceType === 'Physio Technician'
                      ? <Activity className="w-5 h-5 text-teal-600" />
                      : <HeartPulse className="w-5 h-5 text-rose-600" />}
                    {token.serviceType === 'Physio Technician' ? 'Step 2: Physiotherapy Services' : 'Step 2: Nursing Staff Triage & Vitals Acquisition'}
                  </h4>
                  <p className="text-sm text-slate-500">
                    {token.serviceType === 'Physio Technician'
                      ? 'Record the technician services and their charges before sending this token to the cashier.'
                      : 'Document comprehensive patient vitals, pain index, and clinical urgency score before physician review.'}
                  </p>
                </div>
                {token.serviceType === 'Physio Technician' ? (
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${serviceItems.length ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {serviceItems.length ? `${serviceItems.length} service(s) added` : 'Services pending'}
                  </span>
                ) : token.vitals ? (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                    Vitals Recorded
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                    Pending Entry
                  </span>
                )}
              </div>

              {token.serviceType !== 'Physio Technician' && (
              <>
              {/* Vitals Form Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Blood Pressure (mmHg)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={bpSystolic}
                      onChange={(e) => setBpSystolic(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                      placeholder="Sys"
                      required
                    />
                    <span className="text-slate-400">/</span>
                    <input
                      type="number"
                      value={bpDiastolic}
                      onChange={(e) => setBpDiastolic(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                      placeholder="Dia"
                      required
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={heartRate}
                    onChange={(e) => setHeartRate(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                    required
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">SpO2 Oxygen (%)</label>
                  <input
                    type="number"
                    value={spO2}
                    onChange={(e) => setSpO2(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                    required
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Temperature (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                    required
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Respiratory Rate (/min)</label>
                  <input
                    type="number"
                    value={respiratoryRate}
                    onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                    required
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Blood Glucose (mg/dL)</label>
                  <input
                    type="number"
                    value={bloodGlucose}
                    onChange={(e) => setBloodGlucose(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Pain Scale (0-10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={painScale}
                    onChange={(e) => setPainScale(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Triage Acuity</label>
                  <select
                    value={triageLevel}
                    onChange={(e) => setTriageLevel(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md font-semibold text-slate-900"
                  >
                    <option value="Level 1 - Resuscitation">Level 1 - Resuscitation</option>
                    <option value="Level 2 - Emergent">Level 2 - Emergent</option>
                    <option value="Level 3 - Urgent">Level 3 - Urgent</option>
                    <option value="Level 4 - Less Urgent">Level 4 - Less Urgent</option>
                    <option value="Level 5 - Non-Urgent">Level 5 - Non-Urgent</option>
                  </select>
                </div>
              </div>
              </>
              )}

              {(token.serviceType === 'Billing & Cashier' || token.serviceType === 'Physio Technician') && (
                <section className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/50 p-4">
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">
                      {token.serviceType === 'Physio Technician' ? 'Technician services' : 'Tests and procedures'}
                    </h5>
                    <p className="mt-1 text-xs text-slate-600">
                      Add billable items and their prices. The cashier will receive these items on this token.
                    </p>
                  </div>
                  <div className={`grid gap-2 ${token.serviceType === 'Physio Technician' ? 'sm:grid-cols-[1fr_160px_auto]' : 'sm:grid-cols-[1fr_160px_130px_auto]'}`}>
                    {token.serviceType !== 'Physio Technician' && (
                      <select
                        value={serviceItemCategory}
                        onChange={(event) => setServiceItemCategory(event.target.value as TokenServiceItem['category'])}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                      >
                        <option value="Test">Test</option>
                        <option value="Procedure">Procedure</option>
                      </select>
                    )}
                    <input
                      value={serviceItemName}
                      onChange={(event) => setServiceItemName(event.target.value)}
                      placeholder={token.serviceType === 'Physio Technician' ? 'Physiotherapy service' : 'Test or procedure name'}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={serviceItemPrice}
                      onChange={(event) => setServiceItemPrice(event.target.value)}
                      placeholder="Price (AED)"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                    <button type="button" onClick={addServiceItem} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800">
                      <Plus className="mr-1 inline h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                  {serviceItemError && <p role="alert" className="text-xs font-semibold text-rose-700">{serviceItemError}</p>}
                  {serviceItems.length > 0 && (
                    <ul className="divide-y divide-teal-100 rounded-lg border border-teal-100 bg-white">
                      {serviceItems.map((item) => (
                        <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                          <span className="min-w-0">
                            <span className="font-semibold text-slate-800">{item.name}</span>
                            <span className="ml-2 text-slate-500">{item.category} · Added by {item.addedBy}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3 font-semibold text-slate-800">
                            AED {item.price.toFixed(2)}
                            <button type="button" aria-label={`Remove ${item.name}`} onClick={() => setServiceItems((items) => items.filter((service) => service.id !== item.id))} className="text-slate-400 hover:text-rose-600">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {/* Nursing Notes */}
              {token.serviceType !== 'Physio Technician' && <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nursing Observations & Allergy Check</label>
                <textarea
                  rows={2}
                  value={nursingNotes}
                  onChange={(e) => setNursingNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white text-slate-900"
                  placeholder="Note ambulatory status, distress level, allergy confirmation..."
                />
              </div>}

              {/* Submit Vitals Button */}
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  type={token.serviceType === 'Physio Technician' ? 'button' : 'submit'}
                  onClick={token.serviceType === 'Physio Technician' ? handleSaveTechnicianServices : undefined}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 shadow-xs transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {token.serviceType === 'Physio Technician'
                    ? 'Save Technician Services & Forward to Cashier (Step 4)'
                    : token.serviceType === 'Consultation'
                    ? 'Save Vitals & Forward to Doctor EMR (Step 3)'
                    : 'Save Vitals & Tests/Procedures; Forward to Cashier (Step 4)'}
                </button>
              </div>
            </form>
          )}

          {/* STAGE 3: DOCTOR EMR */}
          {activeTab === '3_DOCTOR_EMR' && (
            <form onSubmit={handleSaveDoctorOrders} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-indigo-600" />
                    Step 3: Doctor EMR Consultation & Orders Entry
                  </h4>
                  <p className="text-sm text-slate-500">
                    Document clinical assessment, ICD-10 diagnoses, and order diagnostic labs, radiology scans, and procedure CPT codes.
                  </p>
                </div>
                {token.doctorOrders ? (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                    Orders Configured
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                    Consultation Active
                  </span>
                )}
              </div>

              {/* Display Patient's Nursing Vitals Summary right inside Doctor EMR */}
              {token.vitals && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <HeartPulse className="w-3.5 h-3.5 text-rose-500" /> Vitals Recorded by Nursing Staff ({token.vitals.nurseName})
                    </span>
                    <span className="text-xs font-semibold text-slate-600">{token.vitals.recordedAt}</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-400 block">BP</span>
                      <span className="font-bold text-slate-800">{token.vitals.bpSystolic}/{token.vitals.bpDiastolic}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-400 block">Heart Rate</span>
                      <span className="font-bold text-slate-800">{token.vitals.heartRate} bpm</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-400 block">SpO2</span>
                      <span className="font-bold text-slate-800">{token.vitals.spO2}%</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-400 block">Temp</span>
                      <span className="font-bold text-slate-800">{token.vitals.temperature}°F</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-400 block">Triage Acuity</span>
                      <span className="font-bold text-amber-700">{token.vitals.triageLevel}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-400 block">Pain</span>
                      <span className="font-bold text-slate-800">{token.vitals.painScale ?? 0}/10</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Clinical Notes & Diagnosis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Chief Complaint & History</label>
                  <input
                    type="text"
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                    placeholder="e.g. Retrosternal chest discomfort on exertion..."
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Consultation Charge ($)</label>
                  <input
                    type="number"
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Clinical Assessment & Health Summary</label>
                <textarea
                  rows={2}
                  value={clinicalAssessment}
                  onChange={(e) => setClinicalAssessment(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  placeholder="Document physician findings, systemic review, and differential diagnoses..."
                />
              </div>

              {/* Diagnosis ICD-10 */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Assigned Diagnoses (ICD-10)</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedDiagnosisCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        setSelectedDiagnosisCode(code);
                        if (!code) return;
                        const library: Record<string, string> = {
                          'I10': 'Essential (primary) hypertension',
                          'I20.9': 'Angina pectoris, unspecified',
                          'E11.9': 'Type 2 diabetes mellitus without complications',
                          'J06.9': 'Acute upper respiratory infection, unspecified',
                          'K30': 'Functional dyspepsia',
                          'R51.9': 'Headache, unspecified',
                          'M54.5': 'Low back pain, unspecified',
                        };
                        if (!diagnoses.some((d) => d.code === code)) {
                          setDiagnoses([...diagnoses, { code, description: library[code] || 'Clinical diagnosis' }]);
                        }
                      }}
                      className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md text-slate-800"
                    >
                      <option value="">Select diagnosis</option>
                      <option value="I10">ICD-10 I10 (Hypertension)</option>
                      <option value="I20.9">ICD-10 I20.9 (Angina Pectoris)</option>
                      <option value="E11.9">ICD-10 E11.9 (Type 2 Diabetes)</option>
                      <option value="J06.9">ICD-10 J06.9 (Upper Resp Infection)</option>
                      <option value="K30">ICD-10 K30 (Dyspepsia)</option>
                      <option value="R51.9">ICD-10 R51.9 (Headache)</option>
                      <option value="M54.5">ICD-10 M54.5 (Low Back Pain)</option>
                    </select>
                  </div>
                </div>

                {doctorFormError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{doctorFormError}</p>}

                <div className="flex flex-wrap gap-2">
                  {diagnoses.map((d, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800"
                    >
                      <span className="font-bold">{d.code}</span> - {d.description}
                      <button
                        type="button"
                        onClick={() => setDiagnoses(diagnoses.filter((_, i) => i !== idx))}
                        className="text-indigo-400 hover:text-indigo-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Diagnostic Orders: Labs, Radiology & Procedure CPT */}
              <section className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5">
                <div>
                  <h5 className="text-xs font-bold text-indigo-950">Add from service &amp; medicine catalog</h5>
                      <p className="text-[10px] text-indigo-800">Search by service name, internal code, CPT code, or medicine SKU. Catalog price is loaded into this visit’s order.</p>
                </div>
                <input
                  type="search"
                  value={catalogSearch}
                  onChange={(event) => setCatalogSearch(event.target.value)}
                  placeholder="Search name, service code, CPT, or medication SKU..."
                  className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs"
                />
                {catalogSearch.trim() && (
                  <div className="max-h-52 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    {[
                      ...hospitalPriceCatalog
                        .filter((item) => `${item.name} ${item.code} ${item.cptCode || ''} ${item.department}`.toLowerCase().includes(catalogSearch.trim().toLowerCase()))
                        .map((item) => ({ id: item.id, code: item.code, cptCode: item.cptCode, name: item.name, category: item.category, price: item.standardPrice, department: item.department })),
                      ...pharmacy
                        .filter((item) => `${item.name} ${item.genericName} ${item.sku}`.toLowerCase().includes(catalogSearch.trim().toLowerCase()))
                        .map((item) => ({ id: item.id, code: item.sku, sku: item.sku, cptCode: undefined, name: `${item.name} — ${item.genericName}`, category: 'Medication', price: item.unitPrice, dosageForm: item.dosageForm })),
                    ].slice(0, 10).map((entry) => (
                      <button
                        key={`${entry.id}-${entry.code}`}
                        type="button"
                        onClick={() => addCatalogOrder(entry)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-indigo-50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-slate-800">{entry.name}</span>
                          <span className="text-[10px] text-slate-500">{entry.code}{entry.cptCode ? ` · CPT ${entry.cptCode}` : ''} · {entry.category}</span>
                        </span>
                        <span className="shrink-0 text-xs font-mono font-bold text-slate-800">AED {entry.price.toFixed(2)}</span>
                      </button>
                    ))}
                    {hospitalPriceCatalog.filter((item) => `${item.name} ${item.code} ${item.cptCode || ''} ${item.department}`.toLowerCase().includes(catalogSearch.trim().toLowerCase())).length === 0 &&
                      pharmacy.filter((item) => `${item.name} ${item.genericName} ${item.sku}`.toLowerCase().includes(catalogSearch.trim().toLowerCase())).length === 0 && (
                        <p className="p-3 text-xs text-slate-500">No matching service, CPT, or stocked medicine found.</p>
                      )}
                  </div>
                )}
                {medicationRequests.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-slate-600">Ordered medications</p>
                    {medicationRequests.map((medication) => (
                      <div key={medication.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                        <span>{medication.medicationName} · {medication.sku} · Qty {medication.quantity}</span>
                        <span className="flex items-center gap-3"><strong>AED {medication.price.toFixed(2)}</strong><button type="button" onClick={() => setMedicationRequests((items) => items.filter((item) => item.id !== medication.id))} className="text-rose-600">Remove</button></span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Labs Column */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <FlaskConical className="w-3.5 h-3.5 text-teal-600" /> Lab Requests ({labOrders.length})
                    </h5>
                    <button
                      type="button"
                      onClick={() => {
                        const newId = `L-${Date.now().toString().slice(-4)}`;
                        setLabOrders([
                          ...labOrders,
                          { id: newId, testName: 'Lipid Panel Profile', category: 'Biochemistry', price: 65, status: 'Ordered' },
                        ]);
                      }}
                      className="text-[11px] font-semibold text-teal-700 hover:text-teal-800"
                    >
                      + Add Lab
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {labOrders.map((l) => (
                      <div key={l.id} className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                        <div className="truncate pr-2">
                          <p className="font-medium text-slate-800 truncate">{l.testName}</p>
                          <p className="text-[10px] text-slate-500">AED {l.price} • {l.category}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLabOrders(labOrders.filter((item) => item.id !== l.id))}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Radiology Column */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" /> Radiology Scans ({radiologyOrders.length})
                    </h5>
                    <button
                      type="button"
                      onClick={() => {
                        const newId = `R-${Date.now().toString().slice(-4)}`;
                        setRadiologyOrders([
                          ...radiologyOrders,
                          { id: newId, studyName: 'CT Brain Non-Contrast', modality: 'Computed Tomography', price: 280, status: 'Ordered' },
                        ]);
                      }}
                      className="text-[11px] font-semibold text-blue-700 hover:text-blue-800"
                    >
                      + Add Scan
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {radiologyOrders.map((r) => (
                      <div key={r.id} className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                        <div className="truncate pr-2">
                          <p className="font-medium text-slate-800 truncate">{r.studyName}</p>
                          <p className="text-[10px] text-slate-500">AED {r.price} • {r.modality}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRadiologyOrders(radiologyOrders.filter((item) => item.id !== r.id))}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Procedure CPT Column */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-purple-600" /> Procedure CPT ({procedureOrders.length})
                    </h5>
                    <button
                      type="button"
                      onClick={() => {
                        const newId = `P-${Date.now().toString().slice(-4)}`;
                        setProcedureOrders([
                          ...procedureOrders,
                          { id: newId, cptCode: 'CPT 94640', procedureName: 'Nebulizer Therapy Treatment', price: 65, status: 'Scheduled' },
                        ]);
                      }}
                      className="text-[11px] font-semibold text-purple-700 hover:text-purple-800"
                    >
                      + Add CPT
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {procedureOrders.map((p) => (
                      <div key={p.id} className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                        <div className="truncate pr-2">
                          <p className="font-medium text-slate-800 truncate">
                            <span className="font-mono text-purple-700 font-bold">{p.cptCode}</span> {p.procedureName}
                          </p>
                          <p className="text-[10px] text-slate-500">AED {p.price}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setProcedureOrders(procedureOrders.filter((item) => item.id !== p.id))}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Forward to Cashier Button */}
              {currentRole === 'doctor' && tokenLineItems.some((item) => item.insuranceStatus === 'Denied') && (
                <section className="space-y-3 rounded-xl border border-orange-200 bg-orange-50/60 p-4">
                  <div>
                    <h5 className="text-xs font-bold text-orange-950">Denied orders · appeal review</h5>
                    <p className="mt-1 text-[10px] text-orange-900">Send a clinical justification to Medical Coding. This queues an appeal request; payer submission remains a manual step until a gateway is configured.</p>
                  </div>
                  {tokenLineItems.filter((item) => item.insuranceStatus === 'Denied').map((item) => (
                    <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{item.name}</p>
                        <p className="text-[10px] text-slate-500">{item.insuranceRemarks || 'Payer denial recorded'}{item.appealRequest ? ' · Appeal already queued' : ''}</p>
                      </div>
                      <label className="text-[10px] font-semibold text-slate-600">
                        Clinical appeal justification
                        <input
                          value={appealReasons[item.id] || ''}
                          onChange={(event) => setAppealReasons((current) => ({ ...current, [item.id]: event.target.value }))}
                          placeholder="Explain clinical necessity or additional evidence"
                          className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={!appealReasons[item.id]?.trim() || Boolean(item.appealRequest)}
                        onClick={() => {
                          if (submitTokenLineItemAppeal(token.id, item.id, appealReasons[item.id])) {
                            setAppealReasons((current) => ({ ...current, [item.id]: '' }));
                          }
                        }}
                        className="rounded-md bg-orange-700 px-3 py-2 text-[10px] font-bold text-white hover:bg-orange-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        {item.appealRequest ? 'Appeal queued' : 'Queue appeal'}
                      </button>
                    </div>
                  ))}
                </section>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 shadow-xs transition-colors"
                >
                  <Receipt className="w-4 h-4" /> Save Orders & Forward to Cashier for Invoicing (Step 4)
                </button>
              </div>
            </form>
          )}

          {/* STAGE 4: CASHIER BILLING & INVOICING */}
          {activeTab === '4_CASHIER_BILLING' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-600" />
                    Step 4: Cashier Counter & Invoice Clearance
                  </h4>
                  <p className="text-sm text-slate-500">
                    Itemize all services ordered by the physician, apply insurance coverage or discount card, and issue payment receipt.
                  </p>
                </div>
                {token.billingSummary ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                      Paid & Cleared
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!printTokenReceipt(token)) {
                          addNotification('Receipt Not Opened', 'Allow pop-ups to print the token receipt.', 'warning', token.id);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Printer className="h-3.5 w-3.5" /> Print receipt
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadTokenClaimFile(token)}
                      className="inline-flex items-center gap-1 rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100"
                    >
                      <FileText className="h-3.5 w-3.5" /> Download claim file
                    </button>
                  </div>
                ) : (
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                    Payment Awaiting
                  </span>
                )}
              </div>

              {scheme.schemeType === 'Insurance' && (
                <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                  <div>
                    <h5 className="text-xs font-bold text-amber-950">Insurance authorization & daily patient limit</h5>
                    <p className="mt-1 text-[10px] text-amber-900">
                      Daily cap applies to this patient’s cumulative insurer-covered charges for {visitDate || 'this visit date'}. Cashier may choose whether to enforce the configured cap.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-3 text-[10px]">
                      <span className="block font-semibold uppercase text-slate-500">Authorization status</span>
                      <strong className={`mt-1 block text-xs ${tokenAuthorizationStatus === 'Required' ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {tokenAuthorizationStatus === 'Required'
                          ? `Pending payer decision: ${tokenBillingTotals.pendingItemIds.join(', ')}`
                          : tokenAuthorizationStatus === 'Not Required'
                            ? 'No insurer-funded items remain pending; denied services are excluded unless the patient opts into self-pay.'
                            : 'Final payer decisions recorded on token'}
                      </strong>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px]">
                      <span className="block text-[10px] font-semibold uppercase text-slate-500">Configured daily clinic limit</span>
                      <strong className="mt-1 block text-sm text-slate-900">
                        {dailyInsuranceLimitAed === undefined ? 'No limit configured' : `AED ${dailyInsuranceLimitAed.toFixed(2)}`}
                      </strong>
                      {dailyLimitRemainingAed !== undefined && (
                        <span className="mt-1 block text-slate-600">
                          Used today: AED {usedInsuranceTodayAed.toFixed(2)} · Remaining: AED {dailyLimitRemainingAed.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  {dailyInsuranceLimitAed !== undefined && dailyInsuranceLimitAed > 0 && (
                    <label className={`flex items-start gap-2 rounded-lg border bg-white p-3 text-[11px] ${insuranceAuthorizationStatus === 'Required' ? 'border-slate-200 text-slate-400' : 'border-amber-200 text-slate-800'}`}>
                      <input
                        type="checkbox"
                        checked={applyDailyInsuranceLimit}
                        disabled={insuranceAuthorizationStatus === 'Required'}
                        onChange={(event) => setApplyDailyInsuranceLimit(event.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-700"
                      />
                      <span>
                        <strong>Enforce the daily insurance limit for this invoice</strong>
                        <span className="mt-0.5 block text-[10px] font-normal">
                          {insuranceAuthorizationStatus === 'Required'
                            ? 'Unavailable while approval is required or pending. Select Approved or Not Required only after confirming with the payer.'
                            : 'When selected, settlement is blocked if this visit would exceed the patient’s remaining daily insurer-covered limit.'}
                        </span>
                      </span>
                    </label>
                  )}
                  {applyDailyInsuranceLimit && dailyInsuranceLimitAed !== undefined && (
                    <div className={`rounded-lg p-3 text-[11px] font-semibold ${dailyInsuranceLimitExceeded ? 'border border-rose-300 bg-rose-50 text-rose-800' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                      {dailyInsuranceLimitExceeded
                        ? `Limit exceeded: today’s insurer-covered total would be AED ${projectedInsuranceTodayAed.toFixed(2)} against AED ${dailyInsuranceLimitAed.toFixed(2)}. Reduce billable services before settlement.`
                        : `Within limit: today’s insurer-covered total will be AED ${projectedInsuranceTodayAed.toFixed(2)} of AED ${dailyInsuranceLimitAed.toFixed(2)}.`}
                    </div>
                  )}
                </section>
              )}

              {/* Itemized Services Breakdown */}
              {scheme.schemeType === 'Insurance' && (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <h5 className="text-sm font-bold text-slate-900">Insurance invoice ledger</h5>
                      <p className="text-[10px] text-slate-500">Copay percentages follow the service settings saved on the patient’s insurance registration.</p>
                    </div>
                    <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-right">
                      <span className="block text-[9px] font-bold uppercase tracking-wide text-blue-700">Patient amount due</span>
                      <strong className="font-mono text-base text-blue-950">AED {patientPortion.toFixed(2)}</strong>
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-[10px]">
                      <thead className="bg-white text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-2 py-2">Sr. no.</th>
                          <th className="px-2 py-2">Service name</th>
                          <th className="px-2 py-2">Token status</th>
                          <th className="px-2 py-2 text-center">Unit</th>
                          <th className="px-2 py-2 text-right">Rate</th>
                          <th className="px-2 py-2 text-right">Discount</th>
                          <th className="px-2 py-2 text-right">Net</th>
                          <th className="px-2 py-2 text-right">Deductible</th>
                          <th className="px-2 py-2 text-right">Co-pay</th>
                          <th className="px-2 py-2 text-right">Insurance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {insuranceBillingItems.map((item, index) => (
                          <tr key={item.id}>
                            <td className="px-2 py-2 text-slate-500">{index + 1}</td>
                            <td className="px-2 py-2 font-medium text-slate-800">{item.description}</td>
                            <td className="px-2 py-2 font-semibold text-slate-700">
                              {(() => {
                                const lineItem = tokenLineItems.find((entry) => entry.id === item.id);
                                if (!lineItem) return 'Pending_Auth';
                                return (
                                  <div>
                                    <span>{lineItem.insuranceStatus}</span>
                                    {lineItem.paymentOverride && (
                                      <span className="ml-1 rounded bg-teal-100 px-1 py-0.5 text-[9px] text-teal-800">Self_Pay</span>
                                    )}
                                    {lineItem.insuranceRemarks && (
                                      <p className="mt-1 max-w-48 whitespace-normal font-normal text-rose-700">{lineItem.insuranceRemarks}</p>
                                    )}
                                    {lineItem.insuranceStatus === 'Denied' &&
                                      !lineItem.paymentOverride &&
                                      ['receptionist', 'admin', 'medical-coder'].includes(currentRole) && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (window.confirm(`Confirm that ${token.patientName} agrees to pay AED ${lineItem.totalPrice.toFixed(2)} out of pocket for ${lineItem.name}?`)) {
                                              overrideTokenLineItemToSelfPay(
                                                token.id,
                                                lineItem.id,
                                                'Patient agreed to self-pay after insurance denial at cashier.'
                                              );
                                            }
                                          }}
                                          className="mt-1 block text-left text-[10px] font-semibold text-teal-700 underline"
                                        >
                                          Patient agrees to cash pay · AED {lineItem.totalPrice.toFixed(2)}
                                        </button>
                                      )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-2 py-2 text-center">{item.quantity}</td>
                            <td className="px-2 py-2 text-right font-mono">AED {item.unitCost.toFixed(2)}</td>
                            <td className="px-2 py-2 text-right font-mono">AED {(item.discountAmount || 0).toFixed(2)}</td>
                            <td className="px-2 py-2 text-right font-mono font-semibold">AED {(item.netAmount || 0).toFixed(2)}</td>
                            <td className="px-2 py-2 text-right font-mono">AED {(item.deductibleAmount || 0).toFixed(2)}</td>
                            <td className="px-2 py-2 text-right font-mono">{item.copayPercentage}% / AED {(item.copayAmount || 0).toFixed(2)}</td>
                            <td className="px-2 py-2 text-right font-mono text-emerald-700">AED {(item.insuranceAmount || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-1 border-t border-slate-200 bg-slate-50 p-4 text-xs">
                    <div className="flex justify-between"><span>Gross charges</span><span className="font-mono">AED {subtotal.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Discount</span><span className="font-mono">-AED {sumInvoiceItemField(insuranceBillingItems, 'discountAmount').toFixed(2)}</span></div>
                    <div className="flex justify-between font-medium"><span>Net charges</span><span className="font-mono">AED {sumInvoiceItemField(insuranceBillingItems, 'netAmount').toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Patient deductible</span><span className="font-mono">AED {sumInvoiceItemField(insuranceBillingItems, 'deductibleAmount').toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Patient co-pay</span><span className="font-mono">AED {sumInvoiceItemField(insuranceBillingItems, 'copayAmount').toFixed(2)}</span></div>
                    <div className="flex justify-between text-emerald-700"><span>Insurance share</span><span className="font-mono">AED {insuranceCovered.toFixed(2)}</span></div>
                    <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-bold"><span>Total patient responsibility</span><span className="font-mono text-blue-900">AED {patientPortion.toFixed(2)}</span></div>
                  </div>
                </div>
              )}
              {scheme.schemeType !== 'Insurance' && <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <span>Service Description</span>
                  <span>Fee (AED)</span>
                </div>
                <div className="divide-y divide-slate-100 text-sm">
                  {currentConsult > 0 && <div className="px-4 py-2.5 flex justify-between">
                    <div>
                      <p className="font-medium text-slate-800">Physician Consultation</p>
                      <p className="text-xs text-slate-500">{token.doctorName || 'Attending Physician'}</p>
                    </div>
                    <span className="font-semibold text-slate-900">AED {currentConsult.toFixed(2)}</span>
                  </div>}

                  {currentServiceItems.map((item) => (
                    <div key={item.id} className="px-4 py-2.5 flex justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.category} · Added by {item.addedBy}</p>
                      </div>
                      <span className="font-semibold text-slate-900">AED {item.price.toFixed(2)}</span>
                    </div>
                  ))}

                  {currentLabOrders.map((l, i) => (
                    <div key={i} className="px-4 py-2.5 flex justify-between">
                      <div>
                        <p className="font-medium text-slate-800">{l.testName}</p>
                        <p className="text-xs text-slate-500">Diagnostic Laboratory ({l.category})</p>
                      </div>
                      <span className="font-semibold text-slate-900">AED {l.price.toFixed(2)}</span>
                    </div>
                  ))}

                  {currentRadiologyOrders.map((r, i) => (
                    <div key={i} className="px-4 py-2.5 flex justify-between">
                      <div>
                        <p className="font-medium text-slate-800">{r.studyName}</p>
                        <p className="text-xs text-slate-500">Radiology & Imaging ({r.modality})</p>
                      </div>
                      <span className="font-semibold text-slate-900">AED {r.price.toFixed(2)}</span>
                    </div>
                  ))}

                  {currentProcedureOrders.map((p, i) => (
                    <div key={i} className="px-4 py-2.5 flex justify-between">
                      <div>
                        <p className="font-medium text-slate-800">{p.procedureName}</p>
                        <p className="text-xs text-purple-700 font-mono font-bold">{p.cptCode}</p>
                      </div>
                      <span className="font-semibold text-slate-900">AED {p.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Subtotal & Scheme Calculations */}
                <div className="bg-slate-50/80 p-4 border-t border-slate-200 space-y-2">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Gross Services Subtotal:</span>
                    <span className="font-semibold text-slate-800">AED {subtotal.toFixed(2)}</span>
                  </div>

                  {(scheme.schemeType as string) === 'Insurance' && (
                    <div className="flex justify-between text-sm text-emerald-700 font-medium">
                      <span>Insurance Approved Share ({scheme.insuranceProvider}):</span>
                      <span>-AED {insuranceCovered.toFixed(2)}</span>
                    </div>
                  )}

                  {scheme.schemeType === 'Discount Card' && (
                    <div className="flex justify-between text-sm text-emerald-700 font-medium">
                      <span>Discount Card Benefit ({scheme.discountCardName}):</span>
                      <span>-AED {discountAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Net Patient Responsibility:</span>
                    <span className="text-teal-700 text-lg">AED {patientPortion.toFixed(2)}</span>
                  </div>
                </div>
              </div>}

              {/* Payment Mode Selector & Execution */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-slate-600" />
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block">Select Tender / Payment Mode</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="mt-0.5 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-medium"
                    >
                      <option value="Credit/Debit Card">Credit/Debit Card (POS)</option>
                      <option value="Cash">Cash at Counter</option>
                      <option value="HSA/FSA">HSA / FSA Card</option>
                      <option value="Direct Insurance">Direct Insurance Claim</option>
                      <option value="Online Gateway">Online Patient Portal</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleSettleCashier}
                  disabled={dailyInsuranceLimitExceeded || tokenBillingTotals.pendingItemIds.length > 0}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs transition-colors disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  <Receipt className="w-4 h-4" /> Collect AED {patientPortion.toFixed(2)} & Settle Token
                </button>
              </div>
            </div>
          )}

          {/* STAGE 5: DIAGNOSTICS & PROCEDURES EXECUTION */}
          {activeTab === '5_DIAGNOSTICS_PROCEDURES' && (
            <form onSubmit={handleDispatchReport} className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <FlaskConical className="w-5 h-5 text-teal-600" />
                    Step 5: Diagnostic Laboratory & Radiology Execution
                  </h4>
                  <p className="text-sm text-slate-500">
                    Laboratory specimen processing, radiology scan reading, and report generation.
                  </p>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-800">
                  Diagnostics Terminal
                </span>
              </div>

              {/* Department & Test Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Diagnostic Department</label>
                  <select
                    value={diagnosticType}
                    onChange={(e) => {
                      const type = e.target.value as 'Laboratory' | 'Radiology';
                      setDiagnosticType(type);
                      if (type === 'Radiology') {
                        setTestOrStudyName('Chest X-Ray PA & Lateral View');
                        setDiagnosticFindings('No focal consolidation or pleural effusion. Cardiomediastinal silhouette normal.');
                        setDiagnosticImpression('Clear lung fields. No acute cardiopulmonary process.');
                        setDiagnosticResultValue('Clear, normal anatomy');
                      } else {
                        setTestOrStudyName('Complete Blood Count (CBC with Diff)');
                        setDiagnosticFindings('WBC: 6.5 K/uL, Hemoglobin: 14.2 g/dL, Platelets: 245 K/uL. Normal morphology.');
                        setDiagnosticImpression('Parameters within normal physiologic limits. No leukocytosis.');
                        setDiagnosticResultValue('WBC 6.5 | Hb 14.2');
                      }
                    }}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  >
                    <option value="Laboratory">Laboratory (Hematology / Biochemistry / Pathology)</option>
                    <option value="Radiology">Radiology & Imaging (X-Ray / CT / MRI / Ultrasound)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Test or Study Title</label>
                  <input
                    type="text"
                    value={testOrStudyName}
                    onChange={(e) => setTestOrStudyName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Clinical Finding Status</label>
                  <select
                    value={diagnosticStatus}
                    onChange={(e) => setDiagnosticStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  >
                    <option value="Normal">Normal (Within Reference Limits)</option>
                    <option value="Elevated">Elevated (Mild / Moderate deviation)</option>
                    <option value="Critical">Critical (Stat Alert Notification)</option>
                    <option value="Completed">Completed Study</option>
                  </select>
                </div>
              </div>

              {/* Detailed Findings & Impression */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Analytical Findings & Measurements</label>
                  <textarea
                    rows={2}
                    value={diagnosticFindings}
                    onChange={(e) => setDiagnosticFindings(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                    placeholder="Enter specimen assay numbers, radiographic views, density, structural margins..."
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Diagnostic Impression / Conclusion</label>
                  <textarea
                    rows={2}
                    value={diagnosticImpression}
                    onChange={(e) => setDiagnosticImpression(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                    placeholder="Clinical conclusion for treating physician..."
                    required
                  />
                </div>
              </div>

              {/* Submit and Dispatch Button */}
              <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-teal-900">Immediate Automated Dispatch Rule</p>
                  <p className="text-[11px] text-teal-700">
                    Publishing verifies the report and instantly delivers digital copies to the Patient Portal and Doctor EMR Patient File.
                  </p>
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg flex items-center gap-2 shadow-xs transition-colors shrink-0"
                >
                  <Send className="w-4 h-4" /> Verify & Dispatch to Doctor EMR & Patient (Step 6)
                </button>
              </div>
            </form>
          )}

          {/* STAGE 6: COMPLETED REPORTS (Date & Department Wise) */}
          {activeTab === '6_COMPLETED_REPORTS' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h4 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-emerald-600" />
                    Step 6: Diagnostic Reports Dispatched to Patient & Doctor
                  </h4>
                  <p className="text-sm text-slate-500">
                    Official reports verified, delivered to patient, and visible date- and department-wise inside the Doctor EMR file.
                  </p>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Workflow Complete
                </span>
              </div>

              {/* Delivery Receipt Notification Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-900">Sent to Patient File & SMS Portal</p>
                    <p className="text-[11px] text-emerald-700">Status: Delivered • Encrypted PDF Available</p>
                  </div>
                </div>

                <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-indigo-900">Synchronized with Doctor EMR</p>
                    <p className="text-[11px] text-indigo-700">
                      Categorized Date-Wise & Department-Wise in Patient File
                    </p>
                  </div>
                </div>
              </div>

              {/* List of Published Reports */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Published Reports for this Visit ({token.diagnosticReports?.length || 0})
                </h5>

                {(!token.diagnosticReports || token.diagnosticReports.length === 0) ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <FlaskConical className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">No diagnostic reports published yet</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Return to Step 5 to sign off laboratory or radiology findings for this token.
                    </p>
                    <button
                      onClick={() => setActiveTab('5_DIAGNOSTICS_PROCEDURES')}
                      className="mt-3 px-3 py-1.5 text-xs font-semibold bg-teal-600 text-white rounded-md hover:bg-teal-700"
                    >
                      Enter Step 5 Diagnostics
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {token.diagnosticReports.map((rep) => (
                      <div
                        key={rep.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                                {rep.department}
                              </span>
                              <h6 className="text-sm font-bold text-slate-900">{rep.testOrStudyName}</h6>
                              {rep.cptOrCode && (
                                <span className="text-xs text-slate-500 font-mono">[{rep.cptOrCode}]</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Date: <strong className="text-slate-700">{rep.date}</strong> at {rep.time || '08:45 AM'} • Specialist: {rep.technicianOrRadiologist}
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                              rep.status === 'Normal'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rep.status === 'Critical'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {rep.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <div>
                            <span className="font-bold text-slate-700 block mb-0.5">Findings:</span>
                            <p className="text-slate-600">{rep.findings}</p>
                          </div>
                          <div>
                            <span className="font-bold text-slate-700 block mb-0.5">Clinical Impression:</span>
                            <p className="text-slate-600">{rep.impression || 'Normal study.'}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                          <span className="flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Sent to Patient & Doctor: {rep.sentTimestamp}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button to Open Patient File EMR */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">View Patient's Full Diagnostic Timeline</p>
                  <p className="text-xs text-slate-500">
                    Open {token.patientName}'s Medical Record to inspect all diagnostic reports organized date-wise and department-wise.
                  </p>
                </div>
                {onOpenPatientFile && token.patientId && (
                  <button
                    onClick={() => {
                      onOpenPatientFile(token.patientId);
                      onClose();
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-xs shrink-0"
                  >
                    Open Patient File (EMR) <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span>Token #{token.tokenNumber} • Current Active Stage: <strong className="text-slate-700">{token.currentStage || '1_REGISTRATION'}</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
