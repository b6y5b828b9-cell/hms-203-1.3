import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Activity,
  Pill,
  FileText,
  AlertTriangle,
  CheckCircle2,
  CircleCheck,
  Calendar,
  Video,
  Printer,
  FlaskConical,
  ShieldAlert,
  Stethoscope,
  Clock,
  Send,
  ShieldCheck,
  CircleDollarSign,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { Patient, Prescription, ClinicalNote, PatientService, InsuranceApproval } from '../types';
import { ICD10_COMMON_CODES } from '../data/icd10Codes';
import { PatientDashboard } from './PatientDashboard';
import { PatientDiagnosticReportsView } from './reports/PatientDiagnosticReportsView';
import { PatientAvatar } from './PatientAvatar';
import {
  classifyInsuranceEligibility,
  createInsuranceAppealDraft,
  extractRejectionCode,
  getInsuranceRequestDueAt,
  getRejectionMissingFields,
  loadInsuranceCodeMappings,
  validateInsuranceRequestPayload,
} from '../utils/insuranceAuthorization';
import { addCptTariffToVisit, CptTariff, searchCptTariffs } from '../utils/cptTariffApi';
import {
  getEffectiveLineItemStatus,
  getTokenLineItemBillingBreakdown,
} from '../utils/tokenStateMachine';

interface PatientsEMRProps {
  onOpenTriageModal: (patientId: string) => void;
  onStartTelehealth: (patientId: string) => void;
}

export const PatientsEMR: React.FC<PatientsEMRProps> = ({
  onOpenTriageModal,
  onStartTelehealth,
}) => {
  const {
    patients,
    doctors,
    advancePayments,
    receptionTokens,
    selectedPatientId,
    setSelectedPatientId,
    updateReceptionTokenStatus,
    updatePatientStatus,
    updatePatient,
    addClinicalNote,
    addPrescription,
    addTokenLineItem,
    addEncounterDocument,
    addNotification,
    insuranceApprovals,
    addInsuranceApproval,
    recordEmergencyStabilization,
    acknowledgeTokenDiagnosticResult,
    saveInsuranceAppealDraft,
    currentUser,
    currentRole,
  } = useHospital();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [patientViewTab, setPatientViewTab] = useState<'dashboard' | 'previous' | 'notes' | 'prescriptions' | 'services' | 'reports' | 'insurance-card' | 'id-proof' | 'advances' | 'all'>('dashboard');
  const [doctorQueueFilter, setDoctorQueueFilter] = useState<'All' | 'Waiting' | 'In Consultation' | 'Pending Results'>('All');
  const [selectedEncounterTokenId, setSelectedEncounterTokenId] = useState<string | null>(null);
  const [selectedHistoryTokenId, setSelectedHistoryTokenId] = useState<string | null>(null);
  const [historicalEmrTab, setHistoricalEmrTab] = useState<'doctor' | 'nurse' | 'lab' | 'erx' | 'medical' | 'documents'>('doctor');
  const [stabilizationTimes, setStabilizationTimes] = useState<Record<string, string>>({});
  const [appealDrafts, setAppealDrafts] = useState<Record<string, string>>({});

  // New Note Form State
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [selectedIcd10, setSelectedIcd10] = useState('');
  const [subjectiveText, setSubjectiveText] = useState('');
  const [objectiveText, setObjectiveText] = useState('');
  const [assessmentText, setAssessmentText] = useState('');
  const [planText, setPlanText] = useState('');
  const [rosText, setRosText] = useState('');
  const [actionItemsText, setActionItemsText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // New Prescription Form State
  const [isAddingRx, setIsAddingRx] = useState(false);
  const [rxDrugName, setRxDrugName] = useState('');
  const [rxDosage, setRxDosage] = useState('');
  const [rxFrequency, setRxFrequency] = useState('');
  const [rxRoute, setRxRoute] = useState('Oral');
  const [rxDuration, setRxDuration] = useState('');
  const [rxInstructions, setRxInstructions] = useState('');
  const [serviceQuantity, setServiceQuantity] = useState(1);
  const [tariffSearchQuery, setTariffSearchQuery] = useState('');
  const [tariffResults, setTariffResults] = useState<CptTariff[]>([]);
  const [selectedTariff, setSelectedTariff] = useState<CptTariff | null>(null);
  const [isSearchingTariffs, setIsSearchingTariffs] = useState(false);
  const [tariffSearchError, setTariffSearchError] = useState('');
  const [serviceIcd10Code, setServiceIcd10Code] = useState('');
  const [servicePayerId, setServicePayerId] = useState('');
  const [serviceFacilityDhaLicense, setServiceFacilityDhaLicense] = useState(import.meta.env.VITE_FACILITY_DHA_LICENSE || '');
  const [serviceRequestType, setServiceRequestType] = useState<NonNullable<InsuranceApproval['requestType']>>('Elective Outpatient');
  const [serviceClinicalRationale, setServiceClinicalRationale] = useState('');
  const [serviceIsExcluded, setServiceIsExcluded] = useState(false);
  const [serviceIsPreExisting, setServiceIsPreExisting] = useState(false);

  useEffect(() => {
    const query = tariffSearchQuery.trim();
    if (query.length < 2 || selectedTariff) {
      setTariffResults([]);
      setIsSearchingTariffs(false);
      setTariffSearchError('');
      return;
    }
    let isCurrent = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearchingTariffs(true);
      setTariffSearchError('');
      try {
        const results = await searchCptTariffs(query, controller.signal);
        if (isCurrent) setTariffResults(results);
      } catch (error) {
        if (!isCurrent || (error instanceof DOMException && error.name === 'AbortError')) return;
        setTariffResults([]);
        setTariffSearchError(error instanceof Error ? error.message : 'Tariff search failed.');
      } finally {
        if (isCurrent) setIsSearchingTariffs(false);
      }
    }, 250);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [tariffSearchQuery, selectedTariff]);

  const normalizeClinicianName = (name: string) =>
    name.toLowerCase().replace(/^dr\.?\s*/, '').replace(/,?\s*(md|facs|do|phd)\b/g, '').replace(/[.,]/g, '').trim();
  const loggedDoctorProfile = doctors.find((doctor) =>
    doctor.id === currentUser.id ||
    normalizeClinicianName(doctor.name) === normalizeClinicianName(currentUser.name)
  );
  const isAssignedDoctorToken = (token: (typeof receptionTokens)[number]) =>
    token.doctorId
      ? token.doctorId === (loggedDoctorProfile?.id || currentUser.id)
      : normalizeClinicianName(token.doctorName || '') === normalizeClinicianName(currentUser.name);
  const doctorVisitTokens = currentRole === 'doctor'
    ? receptionTokens.filter((token) => token.patientId !== 'WALK-IN' && isAssignedDoctorToken(token))
      .sort((first, second) =>
        (second.visitDate || second.createdDate || '').localeCompare(first.visitDate || first.createdDate || '') ||
        second.createdTime.localeCompare(first.createdTime)
      )
    : [];
  const getDoctorQueueStatus = (token: (typeof receptionTokens)[number]): 'Waiting' | 'In Consultation' | 'Pending Results' => {
    if (token.status === 'In Consultation' || token.currentStage === '3_DOCTOR_EMR') return 'In Consultation';
    const diagnosticItems = (token.lineItems || []).filter((item) => ['Lab', 'Radiology', 'Procedure', 'Service'].includes(item.kind));
    if (diagnosticItems.some((item) => item.executionStatus !== 'COMPLETED') ||
      diagnosticItems.some((item) => item.executionStatus === 'COMPLETED' && !item.resultPayload?.acknowledgedAt)) {
      return 'Pending Results';
    }
    return 'Waiting';
  };
  const activeDoctorQueue = doctorVisitTokens
    .filter((token) => token.status !== 'Completed' && token.status !== 'Cancelled')
    .filter((token) => doctorQueueFilter === 'All' || getDoctorQueueStatus(token) === doctorQueueFilter);
  const doctorPatientIds = new Set(doctorVisitTokens.map((token) => token.patientId));
  const doctorResultInbox = doctorVisitTokens.flatMap((token) =>
    (token.lineItems || [])
      .filter((item) => item.executionStatus === 'COMPLETED' && item.resultPayload && !item.resultPayload.acknowledgedAt)
      .map((item) => ({ token, item }))
  );
  const assignedPatients = currentRole === 'doctor'
    ? patients.filter((patient) => doctorPatientIds.has(patient.id))
    : patients;
  const selectedPatient = assignedPatients.find((p) => p.id === selectedPatientId) || assignedPatients[0];

  const latestVitals =
    selectedPatient && Array.isArray(selectedPatient.vitals) && selectedPatient.vitals.length > 0
      ? selectedPatient.vitals[0]
      : null;

  const patientAllergies = selectedPatient?.allergies || [];
  const patientConditions = selectedPatient?.chronicConditions || [];
  const patientNotes = selectedPatient?.clinicalNotes || [];
  const previousDoctorNotes = [...patientNotes].filter((note) => !note.encounterTokenId).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const patientVisits = [...(selectedPatient?.facilityVisits || [])].sort(
    (a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
  );
  const patientEncounterTokens = receptionTokens
    .filter((token) => token.patientId === selectedPatient?.id)
    .filter((token) => currentRole !== 'doctor' || isAssignedDoctorToken(token))
    .sort((first, second) =>
      (second.visitDate || second.createdDate || '').localeCompare(first.visitDate || first.createdDate || '') ||
      second.createdTime.localeCompare(first.createdTime)
    );
  const visitServiceRows = patientEncounterTokens.flatMap((token) =>
    (token.lineItems || [])
      .filter((item) => ['Consultation', 'Service', 'Lab', 'Radiology', 'Procedure'].includes(item.kind))
      .map((item) => {
        const patientService = (selectedPatient?.services || []).find((service) => service.id === item.id);
        const isInvoiced = patientService?.billingStatus === 'Billed' ||
          Boolean(
            token.billingSummary?.invoiceNumber &&
            ['Paid', 'SETTLED'].includes(token.billingSummary.paymentStatus) &&
            token.billingSummary.items?.some((billItem) =>
              billItem.id === item.id || billItem.sourceServiceId === item.id
            )
          );
        return {
          id: `${token.id}-${item.id}`,
          token,
          item,
          patientService,
          approval: insuranceApprovals.find((approval) =>
            approval.id === patientService?.insuranceApprovalId || approval.serviceRecordId === item.id
          ),
          quantity: item.quantity || 1,
          price: item.totalPrice,
          unitPrice: item.unitPrice,
          lineStatus: getEffectiveLineItemStatus(item),
          billingBreakdown: getTokenLineItemBillingBreakdown(item),
          isInvoiced,
        };
      })
  );
  const visitServiceTotals = visitServiceRows.reduce((totals, row) => ({
    gross: totals.gross + Math.max(0, Number(row.price) || 0),
    copay: totals.copay + row.billingBreakdown.copayAmount,
    netClaim: totals.netClaim + row.billingBreakdown.insuranceCoveredAmount,
  }), { gross: 0, copay: 0, netClaim: 0 });
  const formatAed = (amount: number) => `AED ${amount.toLocaleString('en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const isNurseClinicalNote = (note: ClinicalNote) =>
    /nurse|nursing/i.test(`${note.authorRole || ''} ${note.doctorSpecialty || ''}`);
  const doctorClinicalNotes = patientNotes.filter((note) => !isNurseClinicalNote(note));
  const nurseClinicalNotes = patientNotes.filter(isNurseClinicalNote);
  const patientTokenNursingNotes = patientEncounterTokens
    .flatMap((token) => (token.nursingNotes || []).map((note) => ({ token, note })))
    .sort((first, second) => second.note.recordedAt.localeCompare(first.note.recordedAt));
  const patientNursingNotes = patientEncounterTokens.filter((token) => token.vitals?.nursingNotes?.trim());
  const patientVitalsHistory = [...(selectedPatient?.vitals || [])].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );
  const patientPrescriptions =
    (selectedPatient?.prescriptions && selectedPatient.prescriptions.length > 0
      ? selectedPatient.prescriptions
      : selectedPatient?.medications?.map((m) => ({
          id: m.id,
          medicationName: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration || 'Ongoing',
          instructions: [m.instructions, `Route: ${m.route}`, `Prescribed by ${m.prescribedBy}`]
            .filter(Boolean)
            .join(' · '),
          status: m.status,
        }))) || [];
  const selectedHistoryToken = patientEncounterTokens.find((token) => token.id === selectedHistoryTokenId);
  const selectedHistoryNotes = selectedHistoryToken
    ? patientNotes.filter((note) => note.encounterTokenId === selectedHistoryToken.id)
    : [];
  const selectedHistoryPrescriptions = selectedHistoryToken
    ? (selectedPatient?.prescriptions?.length ? selectedPatient.prescriptions : selectedPatient?.medications || []).filter((prescription) => prescription.encounterTokenId === selectedHistoryToken.id)
    : [];
  const selectedHistoryLabResults = selectedHistoryToken
    ? (selectedPatient?.labResults || []).filter((result) => result.encounterTokenId === selectedHistoryToken.id)
    : [];
  const patientServices = selectedPatient?.services || [];
  const selectedEncounterToken = receptionTokens.find((token) =>
    token.id === selectedEncounterTokenId &&
    token.patientId === selectedPatient?.id &&
    (currentRole !== 'doctor' || isAssignedDoctorToken(token))
  );
  const currentVisitToken = selectedEncounterToken || receptionTokens
    .filter((token) =>
      token.patientId === selectedPatient?.id &&
      token.status !== 'Completed' &&
      token.status !== 'Cancelled' &&
      (token.visitDate || token.createdDate) === new Date().toISOString().slice(0, 10) &&
      (currentRole !== 'doctor' || isAssignedDoctorToken(token))
    )
    .sort((first, second) => second.createdTime.localeCompare(first.createdTime))[0];
  const patientAdvancePayments = advancePayments
    .filter((advance) => advance.patientId === selectedPatient?.id)
    .sort((first, second) =>
      second.date.localeCompare(first.date) ||
      second.time.localeCompare(first.time) ||
      second.id.localeCompare(first.id)
    );
  const totalPatientAdvances = patientAdvancePayments.reduce(
    (sum, advance) => sum + Math.max(0, Number(advance.amount) || 0),
    0
  );
  const availablePatientAdvances = patientAdvancePayments.reduce(
    (sum, advance) => sum + Math.max(0, Number(advance.remainingBalance) || 0),
    0
  );
  const canViewPatientBilling = currentRole === 'admin' || currentRole === 'receptionist';
  const patientServiceApprovals = insuranceApprovals.filter((approval) => approval.patientId === selectedPatient?.id);
  const pendingServiceApprovalCount = patientServiceApprovals.filter(
    (approval) => ['Pending', 'Pending Info', 'Query Raised', 'Waiver Notification Due'].includes(approval.approvalStatus)
  ).length;
  const approvedServiceApprovalCount = patientServiceApprovals.filter(
    (approval) => approval.approvalStatus === 'Approved'
  ).length;

  const filteredPatients = assignedPatients.filter((p) => {
    const matchesSearch =
      p.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery);

    const matchesStatus =
      statusFilter === 'all' || p.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const buildSoapNote = () => {
    const cc = chiefComplaint.trim() || '[NEEDS CLARIFICATION: Chief complaint not documented]';
    const hpi = subjectiveText.trim() || '[NEEDS CLARIFICATION: HPI / patient narrative not documented]';
    const ros = rosText.trim() || '[NEEDS CLARIFICATION: Review of systems not documented]';
    const objective = objectiveText.trim() || '[NEEDS CLARIFICATION: Vitals / examination findings not documented]';
    const assessment = assessmentText.trim() || '[NEEDS CLARIFICATION: Assessment not documented]';
    const plan = planText.trim() || '[NEEDS CLARIFICATION: Plan / follow-up instructions not documented]';
    const actionItems = actionItemsText.trim() || 'Physician review required before sign-off.';

    return `## SUBJECTIVE
- **Chief Complaint (CC):** ${cc}
- **History of Present Illness (HPI):** ${hpi}
- **Review of Systems (ROS):** ${ros}

## OBJECTIVE
- ${objective}

## ASSESSMENT
- ${assessment}

## PLAN
- ${plan}

### PHYSICIAN ACTION ITEMS
> *${actionItems}*`;
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !chiefComplaint.trim()) return;

    const soapNote = buildSoapNote();
    const diagnosisCode = selectedIcd10 ? selectedIcd10.split(' ')[0] : '[NEEDS CLARIFICATION: ICD-10 diagnosis not recorded]';

    addClinicalNote(selectedPatient.id, {
      patientId: selectedPatient.id,
      authorName: currentUser.name || 'Dr. Julian Thorne, MD',
      authorRole: currentUser.role || 'Attending Physician',
      encounterTokenId: currentVisitToken?.id,
      chiefComplaint,
      content: soapNote,
      assessment: assessmentText || 'Assessment pending physician review.',
      treatmentPlan: planText || 'Plan pending physician review.',
      diagnosisCode,
      diagnoses: selectedIcd10 ? [selectedIcd10] : [],
      category: 'DHA SOAP Note',
    });

    setChiefComplaint('');
    setSelectedIcd10('');
    setSubjectiveText('');
    setObjectiveText('');
    setAssessmentText('');
    setPlanText('');
    setRosText('');
    setActionItemsText('');
    setIsAddingNote(false);
  };

  const handleCreatePrescription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !rxDrugName.trim()) return;

    addPrescription(selectedPatient.id, {
      patientId: selectedPatient.id,
      medicationName: rxDrugName,
      dosage: rxDosage,
      frequency: rxFrequency,
      route: rxRoute,
      duration: rxDuration,
      instructions: rxInstructions,
      prescribedBy: currentUser.name || 'Dr. Julian Thorne, MD',
      encounterTokenId: currentVisitToken?.id,
      status: 'Active',
    });

    setIsAddingRx(false);
  };

  const handleAddService = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPatient || !selectedTariff || serviceQuantity < 1) {
      addNotification('Tariff Selection Required', 'Search and select an active CPT tariff before adding this service.', 'warning', selectedPatient?.id);
      return;
    }
    if (!currentVisitToken) {
      addNotification('Service Not Added', 'Select a visit token before adding a service so it is attached to the patient encounter.', 'warning', selectedPatient.id);
      return;
    }
    const clinicId = import.meta.env.VITE_HMS_CLINIC_ID;
    if (!clinicId) {
      addNotification('Service Not Added', 'Configure the clinic ID and secure tariff service before adding priced services.', 'warning', selectedPatient.id);
      return;
    }
    let ledgerItem;
    try {
      ledgerItem = await addCptTariffToVisit(
        clinicId,
        currentVisitToken.id,
        selectedTariff.cpt_code,
        serviceQuantity,
        selectedTariff.standard_unit_price
      );
    } catch (error) {
      addNotification(
        'Service Not Added',
        error instanceof Error ? error.message : 'The secure tariff service could not add this service.',
        'warning',
        selectedPatient.id
      );
      return;
    }
    const unitPrice = Number(ledgerItem.unitPrice);
    const totalPrice = Number(ledgerItem.totalPrice);
    const authoritativeCategory = ledgerItem.tariffCategory;
    const eligibilityClassification = classifyInsuranceEligibility({
      payerId: servicePayerId,
      cptCode: ledgerItem.code,
      icd10Code: serviceIcd10Code,
      isExcluded: serviceIsExcluded,
      isPreExisting: serviceIsPreExisting,
    }, loadInsuranceCodeMappings());
    const service: PatientService = {
      id: ledgerItem.id,
      name: ledgerItem.name,
      category: authoritativeCategory,
      serviceCode: ledgerItem.code,
      icd10Code: serviceIcd10Code.trim() || undefined,
      payerId: servicePayerId.trim() || undefined,
      facilityDhaLicense: serviceFacilityDhaLicense.trim() || undefined,
      requestType: serviceRequestType,
      clinicalRationale: serviceClinicalRationale.trim() || undefined,
      eligibilityClassification,
      isExcluded: serviceIsExcluded,
      isPreExisting: serviceIsPreExisting,
      estimatedCost: totalPrice,
      addedAt: ledgerItem.orderedAt,
      addedBy: currentUser.name,
      encounterTokenId: currentVisitToken?.id,
      billingStatus: 'Pending',
    };
    const isSynchronized = service.encounterTokenId
      ? addTokenLineItem(service.encounterTokenId, {
          id: ledgerItem.id,
          kind: ledgerItem.kind,
          name: ledgerItem.name,
          department: ledgerItem.department,
          code: ledgerItem.code,
          quantity: ledgerItem.quantity,
          unitPrice,
          totalPrice,
          orderedBy: currentUser.name,
          orderedAt: ledgerItem.orderedAt,
          executionStatus: ledgerItem.kind === 'Consultation' ? undefined : 'PENDING_SETTLEMENT',
        })
      : false;
    updatePatient(selectedPatient.id, { services: [...patientServices, service] });
    if (!isSynchronized) {
      addNotification('Service Saved; Refresh Required', `${service.name} was added to the visit token, but the local chart did not refresh. Reload the chart before adding it again.`, 'warning', selectedPatient.id);
      return;
    }
    addNotification('Patient Service Added', `${service.name} added to ${selectedPatient.firstName} ${selectedPatient.lastName}'s record.`, 'info', selectedPatient.id);
    setServiceQuantity(1);
    setSelectedTariff(null);
    setTariffSearchQuery('');
    setTariffResults([]);
    setServiceIcd10Code('');
    setServicePayerId('');
    setServiceClinicalRationale('');
    setServiceIsExcluded(false);
    setServiceIsPreExisting(false);
  };

  const handleRequestServiceAuthorization = (service: PatientService) => {
    const existingApproval = insuranceApprovals.find((approval) => approval.id === service.insuranceApprovalId);
    if (!selectedPatient || (existingApproval && existingApproval.approvalStatus !== 'Rejected')) return;
    const requestedAt = new Date();
    const requestDate = requestedAt.toISOString().slice(0, 10);
    const payerId = service.payerId || '';
    const facilityDhaLicense = service.facilityDhaLicense || '';
    const doctorLicense = currentUser.licenseNumber || '';
    const eligibilityClassification = classifyInsuranceEligibility({
      payerId,
      cptCode: service.serviceCode || '',
      icd10Code: service.icd10Code || '',
      isExcluded: Boolean(service.isExcluded),
      isPreExisting: Boolean(service.isPreExisting),
    }, loadInsuranceCodeMappings());
    if (eligibilityClassification === 'Excluded' || eligibilityClassification === 'Pre-Existing') {
      addNotification(
        'Authorization Request Not Submitted',
        `Rule engine classified this item as ${eligibilityClassification}. Verify the payer rule and route for authorized review.`,
        'warning',
        selectedPatient.id
      );
      return;
    }
    if (eligibilityClassification === 'Direct Billing') {
      addNotification(
        'Pre-Authorization Not Required',
        'The configured payer mapping classifies this item for direct billing. Confirm benefits and patient responsibility before billing.',
        'info',
        selectedPatient.id
      );
      return;
    }
    const payloadBase = {
      emiratesId: selectedPatient.emiratesId,
      payerId,
      facilityDhaLicense,
      doctorLicense,
      icd10Code: service.icd10Code,
      serviceCode: service.serviceCode,
      estimatedCost: service.estimatedCost,
    };
    const requestType = service.requestType || (selectedPatient.status === 'Inpatient' ? 'Elective Inpatient' : 'Elective Outpatient');
    const isEmergency = requestType === 'Emergency';
    const requiredPayloadFields = validateInsuranceRequestPayload(payloadBase);
    const missingFields = [...requiredPayloadFields];
    if (!service.clinicalRationale?.trim()) missingFields.push('Clinical rationale');
    const labReport = selectedPatient.labResults.some((report) => report.category !== 'Radiology');
    const imagingReport = selectedPatient.labResults.some((report) => report.category === 'Radiology');
    if (service.category === 'Lab Test' && !labReport) missingFields.push('Relevant laboratory report');
    if (service.category === 'Radiology' && !imagingReport) missingFields.push('Relevant imaging report');
    if (!service.clinicalRationale?.trim()) requiredPayloadFields.push('Clinical rationale');
    if (requiredPayloadFields.length && !isEmergency) {
      addNotification(
        'Authorization Request Incomplete',
        `Complete required request data before submission: ${[...new Set(requiredPayloadFields)].join(', ')}.`,
        'warning',
        selectedPatient.id
      );
      return;
    }
    if (eligibilityClassification === 'Mapping Review Required') {
      missingFields.push('Configured payer CPT/ICD-10 mapping');
    }
    const copayPercentage = Math.max(0, Math.min(100, 100 - (selectedPatient.insurance.coveragePercentage || 0)));
    const copayAmount = Math.round(service.estimatedCost * copayPercentage) / 100;
    const supportingDocuments = { labReport, imagingReport };
    const remarks = eligibilityClassification === 'Mapping Review Required'
      ? 'Internal request queued for payer-specific CPT/ICD-10 mapping review. No external gateway submission has occurred.'
      : isEmergency
      ? 'Emergency waiver path: immediate treatment; 24-hour notification target starts when stabilization is recorded. No external gateway submission has occurred.'
      : 'Request prepared for payer submission. No external gateway is configured; SLA timer is an operational target, not a received-payer-response timer.';
    const request = addInsuranceApproval({
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
      patientMrn: selectedPatient.rgNo || selectedPatient.id,
      insuranceProvider: selectedPatient.insurance.provider,
      policyNumber: selectedPatient.insurance.policyNumber,
      approvalNumber: `REQ-${Date.now()}`,
      doctorId: selectedPatient.primaryPhysicianId,
      doctorName: currentUser.name,
      department: currentUser.department,
      serviceCategory: service.category,
      serviceName: service.name,
      serviceCode: service.serviceCode,
      estimatedCost: service.estimatedCost,
      approvedAmount: 0,
      copayPercentage,
      copayAmount,
      approvalStatus: isEmergency ? 'Waiver Notification Due' : 'Pending',
      approvalDate: requestDate,
      validUntil: '',
      authorisedBy: currentUser.name,
      remarks,
      serviceRecordId: service.id,
      encounterTokenId: service.encounterTokenId,
      requestType,
      eligibilityClassification,
      emiratesId: selectedPatient.emiratesId,
      payerId,
      facilityDhaLicense,
      doctorLicense,
      icd10Code: service.icd10Code,
      clinicalRationale: service.clinicalRationale,
      supportingDocuments,
      requestedAt: requestedAt.toISOString(),
      slaDueAt: getInsuranceRequestDueAt(requestType, requestedAt),
      gatewayStatus: 'Not Connected',
      emergencyWaiver: isEmergency ? {
        immediateTreatment: true,
      } : undefined,
      missingFields: [...new Set(missingFields)],
      financialBreakdown: {
        currency: 'AED',
        requestedAmount: Math.max(0, service.estimatedCost - copayAmount),
        approvedAmount: 0,
        copayPercentage,
        copayAmount,
        patientPayable: copayAmount,
      },
    });
    if (!request) {
      addNotification('Authorization Request Not Sent', 'Only an authorized treating doctor can submit an insurance authorization request.', 'warning', selectedPatient.id);
      return;
    }
    updatePatient(selectedPatient.id, {
      services: patientServices.map((item) => item.id === service.id ? { ...item, insuranceApprovalId: request.id } : item),
    });
  };

  const handlePrintChart = () => {
    window.print();
  };

  const handlePrintSelectedEncounter = () => {
    window.print();
  };

  const handleEncounterDocumentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedHistoryToken) return;

    const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png'] as const;
    if (!supportedTypes.includes(file.type as (typeof supportedTypes)[number])) {
      addNotification('Unsupported Document', 'Attach a PDF, JPG, or PNG file.', 'warning', selectedHistoryToken.patientId);
      return;
    }
    if (file.size > 1_500_000) {
      addNotification('Document Too Large', 'Visit documents must be 1.5 MB or smaller in this local record system.', 'warning', selectedHistoryToken.patientId);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const added = addEncounterDocument(selectedHistoryToken.id, {
        fileName: file.name,
        mimeType: file.type as (typeof supportedTypes)[number],
        dataUrl: reader.result,
      });
      if (!added) {
        addNotification('Document Not Added', 'You do not have permission to attach documents to this visit.', 'warning', selectedHistoryToken.patientId);
      }
    };
    reader.onerror = () => addNotification('Document Not Added', 'The selected file could not be read.', 'warning', selectedHistoryToken.patientId);
    reader.readAsDataURL(file);
  };

  if (currentRole !== 'doctor') {
    return (
      <div className="mx-auto max-w-3xl p-6 lg:p-10">
        <div className="rounded-lg border border-amber-200 bg-white p-6 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-8 w-8 text-amber-600" />
          <h2 className="mt-3 text-base font-bold text-slate-900">Doctor access required</h2>
          <p className="mt-1 text-sm text-slate-600">
            Patient EMR records are available only to the assigned doctor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-3 sm:p-4 lg:p-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase text-teal-700">Doctor EMR</p>
          <h2 className="text-lg font-bold text-slate-950">Patient medical records</h2>
        </div>
        <button
          type="button"
          onClick={handlePrintChart}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          title="Print selected patient's chart"
        >
          <Printer className="h-4 w-4" />
          <span className="hidden sm:inline">Print chart</span>
        </button>
      </header>

      <section aria-labelledby="doctor-queue-heading" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 p-3">
          <div>
            <h3 id="doctor-queue-heading" className="text-sm font-semibold text-slate-900">My active visits</h3>
            <p className="mt-0.5 text-xs text-slate-600">Visit tokens assigned to your doctor account.</p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{activeDoctorQueue.length} active</span>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          {(['All', 'Waiting', 'In Consultation', 'Pending Results'] as const).map((status) => {
            const count = doctorVisitTokens.filter((token) =>
              token.status !== 'Completed' &&
              token.status !== 'Cancelled' &&
              (status === 'All' || getDoctorQueueStatus(token) === status)
            ).length;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={doctorQueueFilter === status}
                onClick={() => setDoctorQueueFilter(status)}
                className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 ${
                  doctorQueueFilter === status ? 'bg-teal-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {status} · {count}
              </button>
            );
          })}
        </div>
        {activeDoctorQueue.length ? (
          <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeDoctorQueue.map((token) => {
              const status = getDoctorQueueStatus(token);
              const badgeClass = status === 'Waiting'
                ? 'bg-amber-100 text-amber-900'
                : status === 'In Consultation'
                  ? 'bg-sky-100 text-sky-900'
                  : 'bg-violet-100 text-violet-900';
              return (
                <article key={token.id} className="rounded-lg border border-slate-200 p-3 transition hover:border-teal-300 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{token.patientName}</p>
                      <p className="mt-1 text-xs text-slate-600">Token {token.tokenNumber} · {token.visitDate || token.createdDate}</p>
                      <p className="text-xs text-slate-500">{token.department}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${badgeClass}`}>{status}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(token.patientId);
                      setSelectedEncounterTokenId(token.id);
                      if (status === 'Waiting') updateReceptionTokenStatus(token.id, 'In Consultation');
                      setPatientViewTab('dashboard');
                    }}
                    className="mt-3 min-h-10 w-full rounded-lg bg-teal-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
                  >
                    Open patient chart
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="p-5 text-center text-xs text-slate-500">No active visit tokens match this queue filter.</p>
        )}
      </section>

      {doctorResultInbox.length > 0 && <section aria-labelledby="results-inbox-heading" className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50/70 p-3">
          <div>
            <h3 id="results-inbox-heading" className="text-sm font-semibold text-amber-950">Results awaiting review</h3>
            <p className="mt-0.5 text-xs text-amber-800">New results for your encounters. Open the patient report to review the full record.</p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-800">{doctorResultInbox.length} to review</span>
        </div>
        <div className="divide-y divide-slate-100">
          {doctorResultInbox.map(({ token, item }) => (
            <article key={`${token.id}-${item.id}`} className="flex flex-col justify-between gap-3 p-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="mt-0.5 text-xs text-slate-600">{token.patientName} · Token {token.tokenNumber} · {token.visitDate || token.createdDate}</p>
                <p className="mt-1 truncate text-xs text-slate-700">
                  {item.resultPayload?.value || item.resultPayload?.impression || item.resultPayload?.findings || 'Result submitted'}
                  {item.resultPayload?.submittedAt && ` · ${new Date(item.resultPayload.submittedAt).toLocaleString()}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatientId(token.patientId);
                    setPatientViewTab('reports');
                    setSelectedEncounterTokenId(token.id);
                  }}
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
                >
                  Open patient report
                </button>
                <button
                  type="button"
                  onClick={() => acknowledgeTokenDiagnosticResult(token.id, item.id)}
                  className="min-h-10 rounded-lg bg-teal-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
                >
                  Mark reviewed
                </button>
              </div>
              </article>
          ))}
        </div>
      </section>}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {/* Left Column: Patient Registry List */}
        <aside className="flex max-h-72 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-3 lg:col-span-3 lg:max-h-[calc(100vh-12rem)] lg:self-start">
          <div className="border-b border-slate-200 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">My patients</h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{filteredPatients.length}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">Assigned to {currentUser.name}</p>
          </div>

          {/* Search and Filter */}
          <div className="space-y-2 border-b border-slate-100 p-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Search patients by name, medical record number, or phone"
                placeholder="Search name, MRN, or phone"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-1" role="group" aria-label="Filter patients by care status">
              {[
                { id: 'all', label: 'All' },
                { id: 'inpatient', label: 'Inpatient' },
                { id: 'outpatient', label: 'Outpatient' },
                { id: 'emergency', label: 'Emergency' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={statusFilter === tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`min-h-8 rounded-md px-2 text-[11px] font-semibold transition ${
                    statusFilter === tab.id
                      ? 'bg-teal-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Patient Cards List */}
          <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto px-2">
            {filteredPatients.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-slate-500">
                {currentRole === 'doctor' && assignedPatients.length === 0
                  ? `No patients are assigned to ${currentUser.name}.`
                  : 'No patients match your search or status filter.'}
              </div>
            ) : filteredPatients.map((p) => {
              const isSelected = p.id === selectedPatient?.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedPatientId(p.id);
                    setPatientViewTab('dashboard');
                  }}
                  className={`flex w-full items-center justify-between gap-2 border-l-2 p-3 text-left transition ${
                    isSelected
                      ? 'border-l-teal-700 bg-teal-50 text-teal-950'
                      : 'border-l-transparent text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2 pr-2">
                    <PatientAvatar patientId={p.id} name={`${p.firstName} ${p.lastName}`} gender={p.gender} imageUrl={p.photo || p.avatar} size="sm" />
                    <div className="min-w-0">
                    <div className="font-bold text-xs truncate flex items-center gap-1.5">
                      <span>{p.firstName} {p.lastName}</span>
                    </div>
                    <div className="mt-1 truncate font-mono text-[10px] text-slate-500">
                      Reg. No: {p.rgNo || p.id} · {p.age}y · {p.gender}
                    </div>
                    {p.latestTriage && (
                      <div className="text-[10px] mt-1 font-semibold flex items-center gap-1">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] ${
                            p.latestTriage.urgencyLevel.includes('Level 1')
                              ? 'bg-rose-600 text-white'
                              : p.latestTriage.urgencyLevel.includes('Level 2')
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {p.latestTriage.urgencyLevel.split(' - ')[0]}
                        </span>
                        <span className="text-slate-400">NEWS2: {p.latestTriage.newsScore} pts</span>
                      </div>
                    )}
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded shrink-0 ${
                      p.status === 'Emergency'
                        ? 'bg-rose-100 text-rose-700'
                        : p.status === 'Inpatient'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {p.status}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Column: Detailed Patient EMR Dossier */}
        {selectedPatient ? (
          <div className="min-w-0 space-y-3 lg:col-span-9">
            {/* EMR Sub-Navigation Tabs */}
            <nav aria-label="Patient record sections" className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm [&>button]:shrink-0 [&>button]:whitespace-nowrap">
                <button
                  type="button"
              aria-pressed={patientViewTab === 'dashboard'}
                  onClick={() => setPatientViewTab('dashboard')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    patientViewTab === 'dashboard'
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Overview</span>
                </button>

                <button
                  type="button"
                  aria-pressed={patientViewTab === 'previous'}
                  onClick={() => setPatientViewTab('previous')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    patientViewTab === 'previous'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>History ({patientVisits.length + patientNotes.length})</span>
                </button>

                <button
                  type="button"
                  aria-pressed={patientViewTab === 'notes'}
                  onClick={() => setPatientViewTab('notes')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    patientViewTab === 'notes'
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Notes ({patientNotes.length})</span>
                </button>

                <button
                  type="button"
                  aria-pressed={patientViewTab === 'prescriptions'}
                  onClick={() => setPatientViewTab('prescriptions')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    patientViewTab === 'prescriptions'
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Pill className="w-3.5 h-3.5" />
                  <span>Meds ({patientPrescriptions.length})</span>
                </button>

                <button
                  type="button"
                  aria-pressed={patientViewTab === 'services'}
                  onClick={() => setPatientViewTab('services')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    patientViewTab === 'services'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <CircleDollarSign className="w-3.5 h-3.5" />
                  <span>Facility &amp; insurance ({patientServices.length})</span>
                </button>

                <button
                  type="button"
                  aria-pressed={patientViewTab === 'reports'}
                  onClick={() => setPatientViewTab('reports')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    patientViewTab === 'reports'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Reports ({selectedPatient?.labResults?.length || 0})</span>
                </button>

                <button
                  type="button"
                  aria-pressed={patientViewTab === 'insurance-card'}
                  onClick={() => setPatientViewTab('insurance-card')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    patientViewTab === 'insurance-card'
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Insurance Card</span>
                </button>

                <button
                  type="button"
                  aria-pressed={patientViewTab === 'id-proof'}
                  onClick={() => setPatientViewTab('id-proof')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    patientViewTab === 'id-proof'
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>ID Proof</span>
                </button>

                {canViewPatientBilling && (
                  <button
                    type="button"
                    aria-pressed={patientViewTab === 'advances'}
                    onClick={() => setPatientViewTab('advances')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      patientViewTab === 'advances'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <CircleDollarSign className="w-3.5 h-3.5" />
                    <span>Advances ({patientAdvancePayments.length})</span>
                  </button>
                )}

                <button
                  type="button"
                  aria-pressed={patientViewTab === 'all'}
                  onClick={() => setPatientViewTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    patientViewTab === 'all'
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>Full chart</span>
                </button>
            </nav>

            {patientViewTab === 'advances' && canViewPatientBilling && (
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Patient advance deposits</h3>
                      <p className="mt-0.5 text-xs text-slate-500">Receipts listed by collection date. Available funds can be applied during invoice settlement.</p>
                    </div>
                    <div className="flex gap-3">
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase text-slate-500">Total collected</p>
                        <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">${totalPatientAdvances.toFixed(2)}</p>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase text-emerald-700">Available balance</p>
                        <p className="mt-0.5 font-mono text-sm font-bold text-emerald-800">${availablePatientAdvances.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                {patientAdvancePayments.length === 0 ? (
                  <p className="p-5 text-center text-xs text-slate-500">No advance deposits have been collected for this patient.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-xs">
                      <thead className="bg-white text-[10px] font-bold uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2.5">Collection date</th>
                          <th className="px-3 py-2.5">Receipt</th>
                          <th className="px-3 py-2.5">Purpose</th>
                          <th className="px-3 py-2.5">Payment method</th>
                          <th className="px-3 py-2.5 text-right">Collected</th>
                          <th className="px-3 py-2.5 text-right">Available</th>
                          <th className="px-3 py-2.5">Utilized date & amount</th>
                          <th className="px-3 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {patientAdvancePayments.map((advance) => (
                          <tr key={advance.id}>
                            <td className="whitespace-nowrap px-3 py-2.5 font-mono text-slate-700">{advance.date}{advance.time ? ` · ${advance.time}` : ''}</td>
                            <td className="px-3 py-2.5 font-mono font-semibold text-slate-800">{advance.receiptNumber}</td>
                            <td className="px-3 py-2.5 text-slate-700">{advance.purpose}</td>
                            <td className="px-3 py-2.5 text-slate-700">{advance.paymentMethod}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">${Number(advance.amount).toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">${Number(advance.remainingBalance).toFixed(2)}</td>
                            <td className="px-3 py-2.5">
                              {advance.utilizationHistory?.length ? (
                                <div className="space-y-0.5">
                                  {[...advance.utilizationHistory]
                                    .sort((first, second) => second.date.localeCompare(first.date))
                                    .map((utilization) => (
                                      <p key={`${utilization.transactionId}-${utilization.date}`} className="whitespace-nowrap text-[10px] text-slate-700">
                                        {new Date(utilization.date).toLocaleString()} · <span className="font-mono font-semibold">${utilization.amount.toFixed(2)}</span>
                                        <span className="ml-1 font-mono text-slate-400">{utilization.invoiceId}</span>
                                      </p>
                                    ))}
                                </div>
                              ) : <span className="text-slate-400">Not utilized</span>}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700">{advance.status}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-bold">
                          <td className="px-3 py-2.5 text-slate-700" colSpan={4}>Total</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-900">${totalPatientAdvances.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-emerald-800">${availablePatientAdvances.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-slate-600" colSpan={2}>{patientAdvancePayments.length} receipts</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {patientViewTab === 'services' && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col justify-between gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Facility Services &amp; Insurance Authorizations</h3>
                    <p className="mt-0.5 text-xs text-slate-500">Add services to the selected visit and request authorization for each eligible service.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{patientServices.length} services</span>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800">{pendingServiceApprovalCount} pending / queried</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800">{approvedServiceApprovalCount} approved</span>
                  </div>
                </div>

                <div className="mb-4 flex flex-col gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 sm:flex-row sm:items-end sm:justify-between">
                  <label className="min-w-0 flex-1 text-[11px] font-semibold text-indigo-950">
                    Visit token for service orders
                    <select
                      value={currentVisitToken?.id || ''}
                      onChange={(event) => setSelectedEncounterTokenId(event.target.value || null)}
                      disabled={patientEncounterTokens.length === 0}
                      className="mt-1 w-full rounded-md border border-indigo-200 bg-white px-2.5 py-2 text-xs font-normal text-slate-800 disabled:bg-slate-100"
                    >
                      {patientEncounterTokens.length === 0 && <option value="">No visit token available</option>}
                      {patientEncounterTokens.map((token) => (
                        <option key={token.id} value={token.id}>
                          Token {token.tokenNumber} · {token.visitDate || token.createdDate} · {token.status}
                        </option>
                      ))}
                    </select>
                  </label>
                  {currentVisitToken && (
                    <p className="shrink-0 text-xs font-medium text-indigo-800">
                      Services will be added to Token {currentVisitToken.tokenNumber}
                    </p>
                  )}
                </div>

                <div className="mb-4 overflow-hidden rounded-lg border border-blue-950">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-3">
                    <h4 className="text-sm font-semibold text-slate-900">Visit services and claim summary</h4>
                    <p className="mt-0.5 text-xs text-slate-600">Amounts and authorization status are shown per token line item. Pending authorization is not included in the net claim total.</p>
                  </div>
                  {visitServiceRows.length === 0 ? (
                    <p className="px-3 py-8 text-center text-xs text-slate-600">No services are attached to this patient’s visits.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1420px] text-left text-xs">
                        <thead className="bg-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                          <tr>
                            <th className="whitespace-nowrap px-3 py-2.5">Sr. No.</th>
                            <th className="whitespace-nowrap px-3 py-2.5">CPT / Code</th>
                            <th className="px-3 py-2.5">Description</th>
                            <th className="px-3 py-2.5 text-right">Qty</th>
                            <th className="whitespace-nowrap px-3 py-2.5 text-right">Unit Price (AED)</th>
                            <th className="whitespace-nowrap px-3 py-2.5 text-right">Gross Total (AED)</th>
                            <th className="whitespace-nowrap px-3 py-2.5 text-right">Patient Copay (AED)</th>
                            <th className="whitespace-nowrap px-3 py-2.5 text-right">Net Claim (AED)</th>
                            <th className="px-3 py-2.5">Line Status</th>
                            <th className="px-3 py-2.5">Authorization</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
                          {visitServiceRows.map(({ id, token, item, patientService, approval, quantity, price, unitPrice, lineStatus, billingBreakdown, isInvoiced }, index) => (
                            <tr key={id} className="hover:bg-slate-50">
                              <td className="whitespace-nowrap px-3 py-3 font-mono text-slate-500">{String(index + 1).padStart(2, '0')}</td>
                              <td className="whitespace-nowrap px-3 py-3 font-mono font-medium">{item.code || '—'}</td>
                              <td className="px-3 py-2.5">
                                <p className="font-medium">{item.name}</p>
                                <p className="mt-0.5 text-[10px] text-slate-500">{item.kind} · Token {token.tokenNumber} · {token.visitDate || token.createdDate}</p>
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono">{quantity}</td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono">{formatAed(Number(unitPrice) || 0)}</td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-medium">{formatAed(Number(price) || 0)}</td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono">{formatAed(billingBreakdown.copayAmount)}</td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono">{formatAed(billingBreakdown.insuranceCoveredAmount)}</td>
                              <td className="px-3 py-2.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                    lineStatus === 'Approved' || lineStatus === 'Self_Pay'
                                      ? 'bg-emerald-50 text-emerald-800'
                                      : lineStatus === 'Denied'
                                        ? 'bg-rose-50 text-rose-800'
                                        : lineStatus === 'Partially_Approved'
                                          ? 'bg-sky-50 text-sky-800'
                                          : 'bg-amber-50 text-amber-800'
                                  }`}>{lineStatus.replaceAll('_', ' ')}</span>
                                  {isInvoiced && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-medium text-slate-700">
                                      <CircleCheck className="h-3 w-3" /> Invoiced
                                    </span>
                                  )}
                                  {item.executionStatus === 'COMPLETED' && <span className="text-[10px] text-teal-700">Result available</span>}
                                  {item.executionStatus === 'READY_FOR_EXECUTION' && <span className="text-[10px] text-sky-700">Ready for execution</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                {approval && !['Rejected'].includes(approval.approvalStatus) ? (
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                    approval.approvalStatus === 'Approved'
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : approval.approvalStatus === 'Pending'
                                        ? 'bg-amber-100 text-amber-900'
                                        : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {approval.approvalStatus}
                                  </span>
                                ) : patientService ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRequestServiceAuthorization(patientService)}
                                    className="min-h-8 whitespace-nowrap rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-[10px] font-semibold text-teal-900 transition hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1"
                                  >
                                    {approval?.approvalStatus === 'Rejected' ? 'Request again' : 'Request authorization'}
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400">Not available</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900">
                          <tr>
                            <td className="px-3 py-3" colSpan={5}>TOTALS</td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-mono">{formatAed(visitServiceTotals.gross)}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-mono">{formatAed(visitServiceTotals.copay)}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-mono">{formatAed(visitServiceTotals.netClaim)}</td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                <form onSubmit={handleAddService} className="mb-4 flex w-full flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="relative">
                    <label htmlFor="cpt-tariff-search" className="text-xs font-semibold text-slate-700">
                      Search approved facility CPT tariff
                    </label>
                    <input
                      id="cpt-tariff-search"
                      type="search"
                      autoComplete="off"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={!selectedTariff && tariffResults.length > 0}
                      aria-controls="cpt-tariff-suggestions"
                      value={tariffSearchQuery}
                      onChange={(event) => {
                        setTariffSearchQuery(event.target.value);
                        setSelectedTariff(null);
                      }}
                      className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
                      placeholder="Enter at least 2 characters of a CPT code or service"
                    />
                    {isSearchingTariffs && <p className="mt-1 text-xs text-slate-500" role="status">Searching active tariffs…</p>}
                    {tariffSearchError && <p className="mt-1 text-xs text-rose-700" role="alert">{tariffSearchError}</p>}
                    {tariffSearchQuery.trim().length === 1 && <p className="mt-1 text-xs text-slate-500">Type one more character to search.</p>}
                    {!selectedTariff && !isSearchingTariffs && tariffSearchQuery.trim().length >= 2 && !tariffSearchError && tariffResults.length === 0 && (
                      <p className="mt-1 text-xs text-slate-500">No active CPT tariffs found.</p>
                    )}
                    {!selectedTariff && tariffResults.length > 0 && (
                      <ul id="cpt-tariff-suggestions" role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                        {tariffResults.map((tariff) => (
                          <li key={tariff.cpt_code} role="option" aria-selected={false}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTariff(tariff);
                                setTariffSearchQuery(`${tariff.cpt_code} · ${tariff.description}`);
                                setTariffResults([]);
                              }}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-teal-50 focus:bg-teal-50 focus:outline-none"
                            >
                              <span className="min-w-0">
                                <span className="block font-mono text-xs font-semibold text-slate-900">{tariff.cpt_code}</span>
                                <span className="block truncate text-xs text-slate-600">{tariff.description} · {tariff.category}</span>
                              </span>
                              <span className="shrink-0 text-xs font-semibold text-slate-900">{formatAed(tariff.standard_unit_price)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <label className="text-xs font-semibold text-slate-700">
                    Description
                    <input readOnly value={selectedTariff?.description || ''} className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-100 px-2.5 py-2 text-xs font-normal text-slate-700" placeholder="Select an active CPT tariff" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    CPT / service code
                    <input readOnly value={selectedTariff?.cpt_code || ''} className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-100 px-2.5 py-2 font-mono text-xs font-normal text-slate-700" placeholder="Selected from tariff master" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Unit price (AED) · tariff controlled
                    <input readOnly disabled value={selectedTariff ? selectedTariff.standard_unit_price.toFixed(2) : ''} className="mt-1 block w-full rounded-md border border-slate-200 bg-slate-100 px-2.5 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed" placeholder="Select a tariff" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Quantity
                    <input required type="number" min="1" max="999" step="1" value={serviceQuantity} onChange={(event) => setServiceQuantity(Math.max(1, Math.min(999, Number(event.target.value) || 1)))} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal" />
                  </label>
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-600">Gross total</span>
                    <span className="float-right font-mono font-bold text-slate-900">
                      {formatAed(selectedTariff ? selectedTariff.standard_unit_price * serviceQuantity : 0)}
                    </span>
                  </div>
                  <label className="text-xs font-semibold text-slate-700">
                    ICD-10 diagnosis code
                    <input value={serviceIcd10Code} onChange={(event) => setServiceIcd10Code(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal" placeholder="Link the supporting diagnosis" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Payer ID
                    <input value={servicePayerId} onChange={(event) => setServicePayerId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal" placeholder="Payer identifier" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Facility DHA License
                    <input value={serviceFacilityDhaLicense} onChange={(event) => setServiceFacilityDhaLicense(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal" placeholder="Required for authorization" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Request pathway
                    <select value={serviceRequestType} onChange={(event) => setServiceRequestType(event.target.value as NonNullable<InsuranceApproval['requestType']>)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal">
                      <option value="Elective Outpatient">Elective outpatient · 6-hour target</option>
                      <option value="Elective Inpatient">Elective inpatient · 24-hour target</option>
                      <option value="Emergency">Emergency waiver · immediate treatment</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Clinical rationale
                    <input type="text" value={serviceClinicalRationale} onChange={(event) => setServiceClinicalRationale(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal" placeholder="Indication, relevant history, and medical necessity" />
                  </label>
                  <div className="flex flex-col gap-2 text-xs">
                    <label className="flex items-center gap-2 font-medium text-slate-700">
                      <input type="checkbox" checked={serviceIsExcluded} onChange={(event) => setServiceIsExcluded(event.target.checked)} />
                      Payer policy identifies service as excluded
                    </label>
                    <label className="flex items-center gap-2 font-medium text-slate-700">
                      <input type="checkbox" checked={serviceIsPreExisting} onChange={(event) => setServiceIsPreExisting(event.target.checked)} />
                      Documented pre-existing condition / waiting period applies
                    </label>
                  </div>
                  <div>
                    <button type="submit" disabled={!currentVisitToken || !selectedTariff} className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md bg-teal-800 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50">
                      <Plus className="h-3.5 w-3.5" /> Add to ledger
                    </button>
                  </div>
                </form>

                {patientServices.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-8 text-center text-xs text-slate-500">No services have been added to this patient record.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {[...patientServices].reverse().map((service) => {
                      const approval = patientServiceApprovals.find((item) => item.id === service.insuranceApprovalId);
                      return (
                        <article key={service.id} className={`flex flex-col justify-between gap-3 rounded-md border px-3 py-3 sm:flex-row sm:items-center ${service.billingStatus === 'Billed' ? 'border-emerald-100 bg-emerald-50/40' : service.billingStatus === 'Cancelled' ? 'border-slate-200 bg-slate-50' : 'border-rose-200 bg-rose-50/70'}`}>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-900">{service.name}</h4>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{service.category}</span>
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${service.billingStatus === 'Billed' ? 'bg-emerald-100 text-emerald-800' : service.billingStatus === 'Cancelled' ? 'bg-slate-200 text-slate-700' : 'bg-rose-100 text-rose-800'}`}>{service.billingStatus || 'Pending'}</span>
                              {service.serviceCode && <span className="font-mono text-[10px] text-slate-500">{service.serviceCode}</span>}
                              {service.eligibilityClassification && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-800">{service.eligibilityClassification}</span>}
                            </div>
                            <p className="mt-1 text-[11px] text-slate-600">Estimated AED {service.estimatedCost.toFixed(2)} · Added by {service.addedBy} · {new Date(service.addedAt).toLocaleDateString()}</p>
                            {service.invoiceId && <p className="mt-1 text-[10px] font-semibold text-emerald-800">Billed on invoice {service.invoiceId}</p>}
                            {approval && (
                              <div className="mt-1 space-y-0.5 text-[10px] text-slate-500">
                                <p>{approval.approvalNumber || 'Authorization pending'} · {approval.insuranceProvider} · Policy {approval.policyNumber || 'not recorded'}</p>
                                {approval.approvalStatus === 'Approved' && <p>Approved {approval.financialBreakdown ? 'AED ' : '$'}{approval.approvedAmount.toFixed(2)} · {approval.copayPercentage}% copay ({approval.financialBreakdown ? 'AED ' : '$'}{approval.copayAmount.toFixed(2)}) · Valid until {approval.validUntil || 'not specified'}</p>}
                                {approval.remarks && <p>{approval.remarks}</p>}
                                {approval.slaDueAt && <p>Operational response target: {new Date(approval.slaDueAt).toLocaleString()}</p>}
                                {approval.gatewayStatus === 'Not Connected' && <p className="font-semibold text-amber-700">External payer gateway not connected; this is an internal workflow record.</p>}
                                {approval.missingFields?.length ? <p className="font-semibold text-rose-700">Needs completion: {approval.missingFields.join(', ')}</p> : null}
                                {approval.emergencyWaiver && approval.emergencyWaiver.stabilizedAt && (
                                  <p className="font-semibold text-red-700">
                                    Stabilized {new Date(approval.emergencyWaiver.stabilizedAt).toLocaleString()}
                                    {approval.emergencyWaiver.stabilizedBy ? ` by ${approval.emergencyWaiver.stabilizedBy}` : ''}
                                    {approval.emergencyWaiver.postStabilizationNotificationDueAt
                                      ? ` · 24-hour notice target ${new Date(approval.emergencyWaiver.postStabilizationNotificationDueAt).toLocaleString()}`
                                      : ''}
                                  </p>
                                )}
                                {approval.emergencyWaiver &&
                                  currentRole === 'doctor' &&
                                  (approval.doctorId === currentUser.id || approval.doctorName === currentUser.name) &&
                                  !approval.emergencyWaiver.stabilizedAt && (
                                    <div className="flex flex-wrap items-end gap-2 rounded border border-red-100 bg-red-50 p-2">
                                      <label className="flex flex-col gap-1 text-[10px] font-semibold text-red-900">
                                        Stabilization date and time
                                        <input
                                          type="datetime-local"
                                          value={stabilizationTimes[approval.id] || ''}
                                          onChange={(event) => setStabilizationTimes((current) => ({ ...current, [approval.id]: event.target.value }))}
                                          className="rounded border border-red-200 bg-white px-2 py-1 text-slate-800"
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        disabled={!stabilizationTimes[approval.id]}
                                        onClick={() => {
                                          if (recordEmergencyStabilization(approval.id, stabilizationTimes[approval.id])) {
                                            setStabilizationTimes((current) => ({ ...current, [approval.id]: '' }));
                                          }
                                        }}
                                        className="rounded bg-red-700 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        Record stabilization
                                      </button>
                                      <p className="basis-full text-[9px] text-red-800">Immediate emergency care is not delayed. The 24-hour payer-notification target starts from this time.</p>
                                    </div>
                                  )}
                                {approval.appealDraft && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer font-semibold text-teal-800">Open pre-filled appeal for treating physician</summary>
                                    <textarea
                                      value={appealDrafts[approval.id] ?? approval.appealDraft}
                                      onChange={(event) => setAppealDrafts((current) => ({ ...current, [approval.id]: event.target.value }))}
                                      disabled={currentRole !== 'doctor' || (approval.doctorId !== currentUser.id && approval.doctorName !== currentUser.name)}
                                      rows={8}
                                      className="mt-2 w-full rounded border border-slate-300 bg-white p-2 font-mono text-[10px] text-slate-700 disabled:bg-slate-100"
                                    />
                                    {currentRole === 'doctor' && (approval.doctorId === currentUser.id || approval.doctorName === currentUser.name) && (
                                      <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => saveInsuranceAppealDraft(approval.id, appealDrafts[approval.id] ?? approval.appealDraft ?? '')}
                                          className="rounded bg-teal-700 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-teal-800"
                                        >
                                          Save appeal draft
                                        </button>
                                        <span className="text-[9px] text-slate-500">Internal draft only; submit through the payer gateway separately.</span>
                                      </div>
                                    )}
                                  </details>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {approval && approval.approvalStatus !== 'Rejected' ? (
                              <span className={`rounded border px-2.5 py-1 text-[10px] font-bold ${
                                approval.approvalStatus === 'Approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
                                approval.approvalStatus === 'Pending' ? 'border-amber-200 bg-amber-50 text-amber-800' :
                                approval.approvalStatus === 'Pending Info' || approval.approvalStatus === 'Query Raised' ? 'border-orange-200 bg-orange-50 text-orange-800' :
                                approval.approvalStatus === 'Waiver Notification Due' ? 'border-red-200 bg-red-50 text-red-800' :
                                approval.approvalStatus === 'Waiver Notified' ? 'border-cyan-200 bg-cyan-50 text-cyan-800' :
                                'border-rose-200 bg-rose-50 text-rose-800'
                              }`}>
                                {approval.approvalStatus}
                              </span>
                            ) : (
                              <button type="button" onClick={() => handleRequestServiceAuthorization(service)} className="inline-flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100">
                                <ShieldCheck className="h-3.5 w-3.5" /> {approval ? 'Request again' : 'Request authorization'}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* TAB 1: PATIENT DASHBOARD (Health Trends, Lab Results, Upcoming Appointments) */}
            {(patientViewTab === 'dashboard' || patientViewTab === 'all') && (
              <PatientDashboard
                patient={selectedPatient}
                onOpenTriageModal={onOpenTriageModal}
                onStartTelehealth={onStartTelehealth}
                onNavigateToNotes={() => setPatientViewTab('notes')}
                onNavigateToPrescriptions={() => setPatientViewTab('prescriptions')}
                onNavigateToReports={() => setPatientViewTab('reports')}
              />
            )}

            {/* TAB: DIAGNOSTIC & CLINICAL REPORTS (DATE & DEPARTMENT-WISE) */}
            {(patientViewTab === 'reports' || patientViewTab === 'all') && (
              <div className="space-y-4">
                <PatientDiagnosticReportsView patient={selectedPatient} />
              </div>
            )}

            {patientViewTab === 'insurance-card' && (
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-slate-900">Insurance Card</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {selectedPatient.insurance.provider || 'Payer not recorded'} · Policy {selectedPatient.insurance.policyNumber || 'not recorded'}
                  </p>
                </div>
                <div className="p-4">
                  {selectedPatient.insuranceCardImage ? (
                    <a href={selectedPatient.insuranceCardImage} target="_blank" rel="noreferrer" className="inline-block">
                      <img src={selectedPatient.insuranceCardImage} alt={`${selectedPatient.firstName} ${selectedPatient.lastName} insurance card`} className="max-h-[70vh] max-w-full rounded-lg border border-slate-200 object-contain" />
                    </a>
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">No insurance card is attached to this patient file.</p>
                  )}
                </div>
              </section>
            )}

            {patientViewTab === 'id-proof' && (
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-slate-900">ID Proof</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Emirates ID {selectedPatient.emiratesId || 'not recorded'} · Passport {selectedPatient.passportNo || 'not recorded'}
                  </p>
                </div>
                <div className="p-4">
                  {selectedPatient.supportDocumentImage ? (
                    <a href={selectedPatient.supportDocumentImage} target="_blank" rel="noreferrer" className="inline-block">
                      <img src={selectedPatient.supportDocumentImage} alt={`${selectedPatient.firstName} ${selectedPatient.lastName} ID proof`} className="max-h-[70vh] max-w-full rounded-lg border border-slate-200 object-contain" />
                    </a>
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">No ID proof is attached to this patient file.</p>
                  )}
                </div>
              </section>
            )}

            {patientViewTab === 'previous' && (
              <div className="space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-4 flex flex-col gap-1 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Previous Doctor EMR</h3>
                      <p className="text-xs text-slate-500">
                        {selectedPatient.firstName} {selectedPatient.lastName} · {selectedPatient.id}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-500">{patientVisits.length + patientEncounterTokens.length} encounters · {patientNotes.length} clinical notes</span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div>
                      <h4 className="mb-2 text-xs font-bold uppercase text-slate-700">Patient Visit Tokens</h4>
                      {patientEncounterTokens.length === 0 ? (
                        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">No registered visit tokens are recorded for this patient.</p>
                      ) : (
                        <div className="mb-4 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                          {patientEncounterTokens.map((token) => (
                            <article key={token.id} className={`rounded-lg border p-3 text-xs ${selectedHistoryTokenId === token.id ? 'border-indigo-300 bg-indigo-50/50 ring-1 ring-indigo-200' : 'border-blue-200 bg-blue-50/30'}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h5 className="font-bold text-slate-900">Token {token.tokenNumber} · {token.registrationSource || 'Visit'}</h5>
                                  <p className="mt-0.5 text-[11px] text-slate-600">{token.doctorName || 'Clinician not assigned'} · {token.department} · {token.serviceType}</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <span className="rounded bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">{token.status}</span>
                                  <button
                                    type="button"
                                    aria-pressed={selectedHistoryTokenId === token.id}
                                    onClick={() => {
                                      setSelectedHistoryTokenId(token.id);
                                      setHistoricalEmrTab('doctor');
                                    }}
                                    className="rounded-md bg-indigo-700 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-800"
                                  >
                                    View EMR
                                  </button>
                                </div>
                              </div>
                              <p className="mt-2 text-slate-700">{token.visitPurpose || token.visitComplaint || 'Visit reason not recorded'}</p>
                              <p className="mt-1 text-[10px] text-slate-500">
                                {token.visitDate || token.createdDate || 'Date not recorded'} · {token.createdTime} · {token.currentStage || '1_REGISTRATION'}
                                {token.bookingChannel ? ` · Booked via ${token.bookingChannel}` : ''}
                              </p>
                              {token.billingSummary && (
                                <p className="mt-2 rounded bg-white p-2 text-[11px] text-slate-700">
                                  Cashier: {token.billingSummary.cashierName} · ${token.billingSummary.totalPaid.toFixed(2)} paid · {token.billingSummary.paymentStatus}
                                </p>
                              )}
                              {token.historyLogs && token.historyLogs.length > 0 && (
                                <details className="mt-2">
                                  <summary className="cursor-pointer text-[10px] font-semibold text-blue-800">Visit activity ({token.historyLogs.length})</summary>
                                  <ol className="mt-2 space-y-1 border-l border-blue-200 pl-3">
                                    {token.historyLogs.map((log, index) => (
                                      <li key={`${token.id}-log-${index}`} className="text-[10px] text-slate-600">
                                        {log.timestamp} · {log.actor}: {log.action}
                                      </li>
                                    ))}
                                  </ol>
                                </details>
                              )}
                            </article>
                          ))}
                        </div>
                      )}

                      <h4 className="mb-2 text-xs font-bold uppercase text-slate-700">Past Doctor Visits</h4>
                      {patientVisits.length === 0 ? (
                        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">No previous doctor visits are recorded for this patient.</p>
                      ) : (
                        <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                          {patientVisits.map((visit) => (
                            <article key={visit.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h5 className="font-bold text-slate-900">{visit.visitType}</h5>
                                  <p className="mt-0.5 text-[11px] text-slate-600">{visit.doctorName} · {visit.doctorSpecialty}</p>
                                </div>
                                <time className="shrink-0 rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{visit.visitDate}</time>
                              </div>
                              <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Chief complaint</dt><dd className="mt-0.5 text-slate-800">{visit.chiefComplaint}</dd></div>
                                <div><dt className="text-[10px] font-semibold uppercase text-slate-500">Diagnosis</dt><dd className="mt-0.5 text-slate-800">{visit.primaryDiagnosis.code} · {visit.primaryDiagnosis.description}</dd></div>
                                <div className="sm:col-span-2"><dt className="text-[10px] font-semibold uppercase text-slate-500">Assessment</dt><dd className="mt-0.5 text-slate-700">{visit.clinicalAssessment}</dd></div>
                              </dl>
                              <div className="mt-3 rounded-md bg-slate-50 p-2">
                                <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Visit vitals</p>
                                <p className="text-[11px] text-slate-700">BP {visit.vitalsSnapshot.bloodPressure} · HR {visit.vitalsSnapshot.heartRate} · SpO2 {visit.vitalsSnapshot.spO2}% · Temp {visit.vitalsSnapshot.temperature}°F · RR {visit.vitalsSnapshot.respiratoryRate}</p>
                              </div>
                              {(visit.medicationsPrescribed.length > 0 || visit.diagnosticOrders.length > 0) && (
                                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  {visit.medicationsPrescribed.length > 0 && <div><p className="text-[10px] font-semibold uppercase text-slate-500">Medications</p><p className="mt-0.5 text-[11px] text-slate-700">{visit.medicationsPrescribed.join(', ')}</p></div>}
                                  {visit.diagnosticOrders.length > 0 && <div><p className="text-[10px] font-semibold uppercase text-slate-500">Diagnostic orders</p><p className="mt-0.5 text-[11px] text-slate-700">{visit.diagnosticOrders.join(', ')}</p></div>}
                                </div>
                              )}
                              <p className="mt-2 text-[10px] text-slate-500">{visit.department} · {visit.clinicRoom} · {visit.disposition}</p>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="mb-2 text-xs font-bold uppercase text-slate-700">Other Clinical Notes</h4>
                      {previousDoctorNotes.length === 0 ? (
                        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">No clinical notes outside registered visit tokens are recorded.</p>
                      ) : (
                        <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                          {previousDoctorNotes.map((note) => (
                            <article key={note.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h5 className="font-bold text-slate-900">{note.category || 'Clinical Note'}</h5>
                                  <p className="mt-0.5 text-[11px] text-slate-600">{note.authorName || note.doctorName || 'Attending Physician'} · {note.authorRole || note.doctorSpecialty || 'Clinical Staff'}</p>
                                </div>
                                <time className="shrink-0 rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{note.date}</time>
                              </div>
                              {note.chiefComplaint && <p className="mt-2"><span className="font-semibold text-slate-600">Chief complaint:</span> {note.chiefComplaint}</p>}
                              <p className="mt-2 leading-relaxed text-slate-700">{note.assessment || note.content || 'No assessment documented.'}</p>
                              {(note.diagnoses?.length || note.diagnosisCode) && <p className="mt-2 text-teal-800"><span className="font-semibold">Diagnosis:</span> {note.diagnoses?.join(', ') || note.diagnosisCode}</p>}
                              {note.treatmentPlan && <p className="mt-2 text-slate-700"><span className="font-semibold text-slate-600">Plan:</span> {note.treatmentPlan}</p>}
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedHistoryToken && (
                    <div data-historical-emr-modal className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" onClick={() => setSelectedHistoryTokenId(null)}>
                    <style>{`@media print {
                      @page { margin: 12mm; }
                      body * { visibility: hidden !important; }
                      [data-historical-emr-modal], [data-historical-emr-modal] * { visibility: visible !important; }
                      [data-historical-emr-modal] { position: absolute !important; inset: 0 !important; display: block !important; width: 100% !important; max-width: none !important; max-height: none !important; overflow: visible !important; padding: 0 !important; border: 0 !important; background: #fff !important; box-shadow: none !important; }
                      [data-historical-emr-modal] section { max-width: none !important; max-height: none !important; overflow: visible !important; border: 0 !important; box-shadow: none !important; }
                      [data-historical-emr-modal] [data-scroll-region] { overflow: visible !important; }
                      [data-print-hide] { display: none !important; }
                    }`}</style>
                    <section
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="historical-encounter-title"
                      onClick={(event) => event.stopPropagation()}
                      className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-2xl"
                    >
                      <div className="flex flex-col justify-between gap-2 border-b border-indigo-100 bg-indigo-50/70 p-4 sm:flex-row sm:items-center">
                        <div>
                          <h4 id="historical-encounter-title" className="text-sm font-bold text-slate-900">Encounter EMR · Token {selectedHistoryToken.tokenNumber}</h4>
                          <p className="mt-0.5 text-[11px] text-slate-600">
                            {selectedHistoryToken.visitDate || selectedHistoryToken.createdDate || 'Date not recorded'} · {selectedHistoryToken.doctorName || 'Doctor not recorded'} · {selectedHistoryToken.department}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2" data-print-hide>
                          <button type="button" onClick={handlePrintSelectedEncounter} className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-indigo-800 hover:bg-indigo-50">
                            <Printer className="h-3.5 w-3.5" /> Print
                          </button>
                          <button type="button" onClick={() => setSelectedHistoryTokenId(null)} className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50">
                            Close encounter
                          </button>
                        </div>
                      </div>

                      <nav role="tablist" aria-label="Historical encounter sections" data-print-hide className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 pt-2">
                        {([
                          { id: 'doctor', label: 'Doctor EMR' },
                          { id: 'nurse', label: 'Nurse’s Note' },
                          { id: 'lab', label: 'Lab Report' },
                          { id: 'erx', label: 'eRx' },
                          { id: 'medical', label: 'Medical Report' },
                          { id: 'documents', label: 'Visit Documents' },
                        ] as const).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={historicalEmrTab === tab.id}
                            onClick={() => setHistoricalEmrTab(tab.id)}
                            className={`shrink-0 border-b-2 px-3 py-2 text-xs font-semibold transition ${historicalEmrTab === tab.id ? 'border-indigo-700 text-indigo-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </nav>

                      <div data-scroll-region className="min-h-0 overflow-y-auto">
                      <div className="grid grid-cols-1 gap-4 p-4">
                        <div className="space-y-3">
                          {historicalEmrTab === 'doctor' && (
                          <section className="rounded-lg border border-slate-200 p-3">
                            <h5 className="mb-2 text-[10px] font-bold uppercase text-slate-500">Doctor EMR</h5>
                            {selectedHistoryToken.doctorOrders ? (
                              <div className="space-y-2 text-xs text-slate-700">
                                <p><strong>Entered by:</strong> {selectedHistoryToken.doctorOrders.orderedByDoctorName || 'Doctor not recorded'}</p>
                                <p><strong>Chief complaint:</strong> {selectedHistoryToken.doctorOrders.chiefComplaint || selectedHistoryToken.visitComplaint || 'Not recorded'}</p>
                                <p><strong>Health summary:</strong> {selectedHistoryToken.doctorOrders.healthSummary || 'Not recorded'}</p>
                                <p><strong>Clinical assessment:</strong> {selectedHistoryToken.doctorOrders.clinicalAssessment || 'Not recorded'}</p>
                                {selectedHistoryToken.doctorOrders.doctorNotes && <p><strong>Doctor notes:</strong> {selectedHistoryToken.doctorOrders.doctorNotes}</p>}
                                <div>
                                  <p className="font-semibold">Diagnosis</p>
                                  {selectedHistoryToken.doctorOrders.diagnoses.length ? (
                                    <ul className="mt-1 list-inside list-disc">
                                      {selectedHistoryToken.doctorOrders.diagnoses.map((diagnosis, index) => <li key={`${diagnosis.code}-${index}`}>{diagnosis.code} · {diagnosis.description}{diagnosis.notes ? ` · ${diagnosis.notes}` : ''}</li>)}
                                    </ul>
                                  ) : <p className="mt-1 text-slate-500">No diagnosis recorded.</p>}
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500">No doctor EMR entry is saved on this token.</p>
                            )}
                          </section>
                          )}

                          {historicalEmrTab === 'doctor' && selectedHistoryToken.vitals && (
                            <section className="rounded-lg border border-slate-200 p-3">
                              <h5 className="mb-2 text-[10px] font-bold uppercase text-slate-500">Visit vitals</h5>
                              <p className="text-xs text-slate-700">
                                BP {selectedHistoryToken.vitals.bpSystolic}/{selectedHistoryToken.vitals.bpDiastolic} · HR {selectedHistoryToken.vitals.heartRate} · SpO2 {selectedHistoryToken.vitals.spO2}% · Temp {selectedHistoryToken.vitals.temperature} · RR {selectedHistoryToken.vitals.respiratoryRate} · {selectedHistoryToken.vitals.triageLevel}
                              </p>
                              {selectedHistoryToken.vitals.nursingNotes && <p className="mt-1 text-xs text-slate-600">Nursing notes: {selectedHistoryToken.vitals.nursingNotes}</p>}
                            </section>
                          )}

                          {historicalEmrTab === 'nurse' && (
                            <section className="rounded-lg border border-slate-200 p-3">
                              <h5 className="mb-2 text-[10px] font-bold uppercase text-slate-500">Nurse’s Note</h5>
                              {selectedHistoryToken.vitals?.nursingNotes ? (
                                <div className="space-y-2 text-xs text-slate-700">
                                  <p><strong>Recorded by:</strong> {selectedHistoryToken.vitals.nurseName || 'Nurse not recorded'}</p>
                                  <p><strong>Recorded at:</strong> {selectedHistoryToken.vitals.recordedAt ? new Date(selectedHistoryToken.vitals.recordedAt).toLocaleString() : 'Time not recorded'}</p>
                                  <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3">{selectedHistoryToken.vitals.nursingNotes}</p>
                                  <p><strong>Visit vitals:</strong> BP {selectedHistoryToken.vitals.bpSystolic}/{selectedHistoryToken.vitals.bpDiastolic} · HR {selectedHistoryToken.vitals.heartRate} · SpO2 {selectedHistoryToken.vitals.spO2}% · Temp {selectedHistoryToken.vitals.temperature} · RR {selectedHistoryToken.vitals.respiratoryRate}</p>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500">No nurse note was recorded for this visit.</p>
                              )}
                            </section>
                          )}

                          {historicalEmrTab === 'doctor' && <section className="rounded-lg border border-slate-200 p-3">
                            <h5 className="mb-2 text-[10px] font-bold uppercase text-slate-500">Tests and procedures ordered</h5>
                            {selectedHistoryToken.doctorOrders && (
                              <div className="space-y-2 text-xs text-slate-700">
                                {[...selectedHistoryToken.doctorOrders.labRequests.map((order) => ({ name: order.testName, status: order.status, group: 'Lab' })), ...selectedHistoryToken.doctorOrders.radiologyRequests.map((order) => ({ name: order.studyName, status: order.status, group: 'Radiology' })), ...selectedHistoryToken.doctorOrders.procedureRequests.map((order) => ({ name: order.procedureName, status: order.status, group: 'Procedure' }))].map((order, index) => (
                                  <p key={`${order.group}-${order.name}-${index}`}><strong>{order.group}:</strong> {order.name} · {order.status}</p>
                                ))}
                              </div>
                            )}
                            {!selectedHistoryToken.doctorOrders?.labRequests.length && !selectedHistoryToken.doctorOrders?.radiologyRequests.length && !selectedHistoryToken.doctorOrders?.procedureRequests.length && (
                              <p className="text-xs text-slate-500">No test or procedure orders recorded.</p>
                            )}
                          </section>}

                          {historicalEmrTab === 'erx' && <section className="rounded-lg border border-slate-200 p-3">
                            <h5 className="mb-2 text-[10px] font-bold uppercase text-slate-500">Medication</h5>
                            {selectedHistoryPrescriptions.length ? (
                              <div className="space-y-2 text-xs text-slate-700">
                                {selectedHistoryPrescriptions.map((prescription) => (
                                  <p key={prescription.id}><strong>{prescription.name}</strong> · {prescription.dosage} · {prescription.frequency} · {prescription.route}{prescription.duration ? ` · ${prescription.duration}` : ''}</p>
                                ))}
                              </div>
                            ) : selectedHistoryToken.doctorOrders?.medicationRequests?.length ? (
                              <div className="space-y-2 text-xs text-slate-700">
                                {selectedHistoryToken.doctorOrders.medicationRequests.map((medication) => <p key={medication.id}><strong>{medication.medicationName}</strong> · Quantity {medication.quantity}</p>)}
                              </div>
                            ) : <p className="text-xs text-slate-500">No medication recorded for this encounter.</p>}
                          </section>}
                        </div>

                        <div className="space-y-3">
                          {historicalEmrTab === 'lab' && <section className="rounded-lg border border-slate-200 p-3">
                            <h5 className="mb-2 text-[10px] font-bold uppercase text-slate-500">Lab &amp; radiology reports</h5>
                            {selectedHistoryLabResults.length || selectedHistoryToken.diagnosticReports?.length ? (
                              <div className="space-y-2">
                                {selectedHistoryLabResults.map((report) => (
                                  <article key={report.id} className="rounded-md bg-slate-50 p-2 text-xs">
                                    <p className="font-semibold text-slate-900">{report.testName} · {report.status}</p>
                                    <p className="mt-0.5 text-[10px] text-slate-500">{report.department || report.category} · Ordered {report.orderedDate} · Result {report.resultDate || 'pending'} · Dr. {report.orderedBy}</p>
                                    <p className="mt-1 text-slate-700">{report.impression || report.findings || report.value || 'No result detail recorded.'}</p>
                                    {report.reportFiles?.map((file) => (
                                      <a key={file.id} href={file.dataUrl} download={file.fileName} className="mr-3 mt-2 inline-flex text-[10px] font-semibold text-indigo-700 underline">
                                        View {file.fileName}
                                      </a>
                                    ))}
                                  </article>
                                ))}
                                {selectedHistoryToken.diagnosticReports?.map((report) => (
                                  <article key={report.id} className="rounded-md bg-slate-50 p-2 text-xs">
                                    <p className="font-semibold text-slate-900">{report.testOrStudyName} · {report.status}</p>
                                    <p className="mt-0.5 text-[10px] text-slate-500">{report.department} · {report.date}{report.time ? ` ${report.time}` : ''} · {report.technicianOrRadiologist}</p>
                                    <p className="mt-1 text-slate-700">{report.impression || report.findings || 'No report detail recorded.'}</p>
                                    {report.reportFiles?.map((file) => (
                                      <a key={file.id} href={file.dataUrl} download={file.fileName} className="mr-3 mt-2 inline-flex text-[10px] font-semibold text-indigo-700 underline">
                                        View {file.fileName}
                                      </a>
                                    ))}
                                  </article>
                                ))}
                              </div>
                            ) : <p className="text-xs text-slate-500">No lab or radiology reports are linked to this encounter.</p>}
                          </section>}

                          {historicalEmrTab === 'medical' && <section className="rounded-lg border border-slate-200 p-3">
                            <h5 className="mb-2 text-[10px] font-bold uppercase text-slate-500">Medical reports / clinical notes</h5>
                            {selectedHistoryNotes.length ? (
                              <div className="space-y-2">
                                {selectedHistoryNotes.map((note) => (
                                  <article key={note.id} className="rounded-md bg-slate-50 p-2 text-xs">
                                    <div className="flex justify-between gap-2"><strong className="text-slate-900">{note.category || 'Clinical note'}</strong><span className="text-[10px] text-slate-500">{note.date}</span></div>
                                    {note.chiefComplaint && <p className="mt-1"><strong>Chief complaint:</strong> {note.chiefComplaint}</p>}
                                    <p className="mt-1 whitespace-pre-wrap text-slate-700">{note.content || note.assessment || 'No note content recorded.'}</p>
                                    {note.treatmentPlan && <p className="mt-1"><strong>Plan:</strong> {note.treatmentPlan}</p>}
                                  </article>
                                ))}
                              </div>
                            ) : <p className="text-xs text-slate-500">No clinical notes are linked to this encounter.</p>}
                          </section>}

                          {historicalEmrTab === 'documents' && (
                            <section className="rounded-lg border border-slate-200 p-3">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <h5 className="text-xs font-bold text-slate-900">Documents for this visit</h5>
                                  <p className="mt-0.5 text-[10px] text-slate-500">PDF, JPG, or PNG · maximum 1.5 MB per file</p>
                                </div>
                                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-indigo-700 px-3 py-2 text-[11px] font-bold text-white hover:bg-indigo-800" data-print-hide>
                                  <FileText className="h-3.5 w-3.5" /> Add document
                                  <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={handleEncounterDocumentUpload} className="sr-only" />
                                </label>
                              </div>
                              {selectedHistoryToken.visitDocuments?.length ? (
                                <div className="divide-y divide-slate-100">
                                  {selectedHistoryToken.visitDocuments.map((document) => (
                                    <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                                      <div className="min-w-0">
                                        <p className="break-all text-xs font-semibold text-slate-800">{document.fileName}</p>
                                        <p className="mt-0.5 text-[10px] text-slate-500">Added by {document.uploadedBy} · {new Date(document.uploadedAt).toLocaleString()}</p>
                                      </div>
                                      <a href={document.dataUrl} download={document.fileName} target="_blank" rel="noreferrer" className="shrink-0 rounded border border-slate-300 px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50">Open / Download</a>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">No documents are attached to this visit yet.</p>
                              )}
                            </section>
                          )}
                        </div>
                      </div>
                      </div>
                    </section>
                    </div>
                  )}
                </section>
              </div>
            )}

            {patientViewTab === 'all' && (
              <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <FileText className="h-4 w-4 text-teal-700" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Longitudinal Patient Repository</h3>
                    <p className="text-[11px] text-slate-500">Medical history, encounters, and recorded vital signs</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                    <h4 className="mb-2 text-xs font-bold text-slate-800">Medical History</h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Chronic conditions</p>
                        {patientConditions.length ? (
                          <div className="flex flex-wrap gap-1">
                            {patientConditions.map((condition) => (
                              <span key={condition} className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-900">{condition}</span>
                            ))}
                          </div>
                        ) : <p className="text-slate-500">None recorded</p>}
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Allergies</p>
                        {patientAllergies.length ? (
                          <div className="flex flex-wrap gap-1">
                            {patientAllergies.map((allergy, index) => {
                              const label = typeof allergy === 'string' ? allergy : `${allergy.allergen} (${allergy.severity})`;
                              return <span key={`${label}-${index}`} className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-800">{label}</span>;
                            })}
                          </div>
                        ) : <p className="text-slate-500">No known allergies recorded</p>}
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Diagnoses</p>
                        {selectedPatient.diagnoses?.length ? (
                          <ul className="space-y-1 text-slate-700">
                            {selectedPatient.diagnoses.map((diagnosis) => (
                              <li key={diagnosis.id}><span className="font-semibold">{diagnosis.icdCode}</span> · {diagnosis.description} <span className="text-slate-500">({diagnosis.status})</span></li>
                            ))}
                          </ul>
                        ) : <p className="text-slate-500">No structured diagnoses recorded</p>}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                    <h4 className="mb-2 text-xs font-bold text-slate-800">Past Visits ({patientVisits.length})</h4>
                    {patientVisits.length ? (
                      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                        {patientVisits.map((visit) => (
                          <article key={visit.id} className="border-l-2 border-teal-600 pl-2.5 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-slate-900">{visit.visitType}</p>
                              <time className="shrink-0 text-[10px] text-slate-500">{visit.visitDate}</time>
                            </div>
                            <p className="text-[11px] text-slate-600">{visit.department} · {visit.doctorName}</p>
                            <p className="mt-0.5 text-slate-700">{visit.chiefComplaint}</p>
                            <p className="mt-0.5 text-[11px] text-slate-600">Diagnosis: {visit.primaryDiagnosis.code} · {visit.primaryDiagnosis.description}</p>
                            {visit.clinicalAssessment && <p className="mt-0.5 text-[11px] text-slate-600">{visit.clinicalAssessment}</p>}
                          </article>
                        ))}
                      </div>
                    ) : <p className="py-2 text-xs text-slate-500">No past visits recorded.</p>}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                    <h4 className="mb-2 text-xs font-bold text-slate-800">Recorded Vitals ({patientVitalsHistory.length})</h4>
                    {patientVitalsHistory.length ? (
                      <div className="max-h-72 overflow-auto">
                        <table className="w-full text-left text-[11px]">
                          <thead className="sticky top-0 bg-slate-100 text-[9px] uppercase text-slate-500">
                            <tr>
                              <th className="p-1.5">Recorded</th>
                              <th className="p-1.5">BP</th>
                              <th className="p-1.5">HR</th>
                              <th className="p-1.5">SpO2</th>
                              <th className="p-1.5">Temp</th>
                              <th className="p-1.5">RR</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-slate-700">
                            {patientVitalsHistory.map((vital, index) => (
                              <tr key={`${vital.recordedAt}-${index}`}>
                                <td className="whitespace-nowrap p-1.5">{new Date(vital.recordedAt).toLocaleString()}</td>
                                <td className="p-1.5">{vital.bloodPressureSys}/{vital.bloodPressureDia}</td>
                                <td className="p-1.5">{vital.heartRate}</td>
                                <td className="p-1.5">{vital.spO2}%</td>
                                <td className="p-1.5">{vital.temperature}°F</td>
                                <td className="p-1.5">{vital.respiratoryRate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="py-2 text-xs text-slate-500">No recorded vital signs.</p>}
                  </div>
                </div>
              </section>
            )}

            {/* TAB 2: Clinical Encounter & Physician Progress Notes */}
            {(patientViewTab === 'notes' || patientViewTab === 'all') && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Doctor Notes ({doctorClinicalNotes.length}) · Nurse Notes ({nurseClinicalNotes.length + patientNursingNotes.length})
                    </h4>
                  </div>
                <button
                  onClick={() => setIsAddingNote(!isAddingNote)}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isAddingNote ? 'Cancel Report' : 'Create Medical Report'}</span>
                </button>
              </div>

              {isAddingNote && (
                <form onSubmit={handleCreateNote} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3 text-xs">
                  {currentVisitToken && <p className="rounded-md border border-teal-200 bg-teal-50 px-2.5 py-2 text-[10px] font-semibold text-teal-800">This note will be saved to visit token {currentVisitToken.tokenNumber} ({currentVisitToken.visitDate || currentVisitToken.createdDate}).</p>}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="font-bold text-slate-600 block mb-1">Chief Complaint (CC)</label>
                      <input
                        required
                        type="text"
                        value={chiefComplaint}
                        onChange={(e) => setChiefComplaint(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs"
                        placeholder="Primary concern in patient words or concise clinical summary"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="font-bold text-slate-600 block mb-1">Subjective / HPI</label>
                      <textarea
                        rows={3}
                        value={subjectiveText}
                        onChange={(e) => setSubjectiveText(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-2 text-xs"
                        placeholder="Document onset, location, duration, character, aggravating/relieving factors, severity, and timing. Use clinical terminology."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="font-bold text-slate-600 block mb-1">Review of Systems (ROS)</label>
                      <textarea
                        rows={2}
                        value={rosText}
                        onChange={(e) => setRosText(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-2 text-xs"
                        placeholder="Example: Constitutional: denies fever/chills. Respiratory: denies cough/SOB. Gastrointestinal: reports nausea, no vomiting."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="font-bold text-slate-600 block mb-1">Objective / Vital Signs / Exam</label>
                      <textarea
                        rows={3}
                        value={objectiveText}
                        onChange={(e) => setObjectiveText(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-2 text-xs"
                        placeholder="Document vitals, physical findings, in-office test results, and relevant exam observations."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="font-bold text-slate-600 block mb-1">Assessment / Diagnosis</label>
                      <textarea
                        rows={3}
                        value={assessmentText}
                        onChange={(e) => setAssessmentText(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-2 text-xs"
                        placeholder="Primary diagnosis and differential, with rationale tied to symptoms and exam findings."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="font-bold text-slate-600 block mb-1">Plan / Orders / Follow-Up</label>
                      <textarea
                        rows={3}
                        value={planText}
                        onChange={(e) => setPlanText(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-2 text-xs"
                        placeholder="Labs, imaging, medications, patient education, red flags, and next review date."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="font-bold text-slate-600 block mb-1">Physician Action Items / Sign-Off Reminder</label>
                      <textarea
                        rows={2}
                        value={actionItemsText}
                        onChange={(e) => setActionItemsText(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-2 text-xs"
                        placeholder="Example: verify allergy status, confirm medication dose, review follow-up plan before signing."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="font-bold text-slate-600 block mb-1">ICD-10 Diagnosis</label>
                      <select
                        value={selectedIcd10}
                        onChange={(e) => setSelectedIcd10(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-medium"
                      >
                        <option value="">Select ICD-10 Code...</option>
                        {ICD10_COMMON_CODES.map((item) => (
                          <option key={item.code} value={`${item.code} ${item.description}`}>
                            {item.code} - {item.description} ({item.category})
                          </option>
                        ))}
                      </select>
                    </div>

                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3 h-3" /> Commit Clinical Note
                    </button>
                  </div>
                </form>
              )}

              <section className="rounded-lg border border-slate-200 p-3">
                <h5 className="mb-2 text-[10px] font-bold uppercase text-slate-500">Doctor Notes</h5>
                <div className="max-h-60 space-y-2 overflow-y-auto">
                {doctorClinicalNotes.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400">No doctor notes recorded yet.</div>
                ) : (
                  doctorClinicalNotes.map((note) => {
                    const author = note.authorName || note.doctorName || 'Attending Physician';
                    const role = note.authorRole || note.doctorSpecialty || 'Clinical Staff';
                    const noteBody = note.content || note.assessment || 'Clinical encounter recorded.';
                    const diagnoses = note.diagnoses || (note.diagnosisCode ? [note.diagnosisCode] : []);
                    return (
                      <div key={note.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-bold text-slate-800">{author} ({role})</span>
                          <span className="font-mono">{note.date}</span>
                        </div>
                        {note.chiefComplaint && (
                          <p className="text-slate-600"><strong>Chief complaint:</strong> {note.chiefComplaint}</p>
                        )}
                        <p className="text-slate-700 text-xs leading-relaxed">{noteBody}</p>
                        {note.treatmentPlan && (
                          <p className="text-slate-600"><strong>Treatment plan:</strong> {note.treatmentPlan}</p>
                        )}
                        {diagnoses.length > 0 && (
                          <div className="pt-1 flex flex-wrap gap-1">
                            {diagnoses.map((dx) => (
                              <span key={dx} className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded font-mono text-[10px] font-semibold">
                                {dx}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              </section>

              <section className="rounded-lg border border-slate-200 p-3">
                <h5 className="mb-2 text-[10px] font-bold uppercase text-slate-500">Nurse Notes</h5>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {nurseClinicalNotes.map((note) => (
                    <article key={note.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="font-bold text-slate-800">{note.authorName || note.authorRole || 'Nursing staff'}</span>
                        <time className="font-mono">{note.date}</time>
                      </div>
                      {note.chiefComplaint && <p className="mt-1 text-slate-600"><strong>Reason:</strong> {note.chiefComplaint}</p>}
                      <p className="mt-1 whitespace-pre-wrap text-slate-700">{note.content || note.assessment || 'Nursing note recorded.'}</p>
                      {note.treatmentPlan && <p className="mt-1 text-slate-600"><strong>Follow-up:</strong> {note.treatmentPlan}</p>}
                    </article>
                  ))}
                  {patientTokenNursingNotes.map(({ token, note }) => (
                    <article key={note.id} className="rounded-lg border border-teal-200 bg-teal-50/40 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="font-bold text-slate-800">{note.nurseName} · Token {token.tokenNumber}</span>
                        <time className="font-mono">{new Date(note.recordedAt).toLocaleString()}</time>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-slate-700">{note.note}</p>
                    </article>
                  ))}
                  {patientNursingNotes.map((token) => (
                    <article key={token.id} className="rounded-lg border border-teal-200 bg-teal-50/40 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="font-bold text-slate-800">{token.vitals?.nurseName || 'Nursing staff'} · Token {token.tokenNumber}</span>
                        <time className="font-mono">{token.vitals?.recordedAt ? new Date(token.vitals.recordedAt).toLocaleString() : token.visitDate || token.createdDate}</time>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-slate-700">{token.vitals?.nursingNotes}</p>
                    </article>
                  ))}
                  {nurseClinicalNotes.length === 0 && patientTokenNursingNotes.length === 0 && patientNursingNotes.length === 0 && (
                    <p className="py-4 text-center text-xs text-slate-400">No nurse notes recorded yet.</p>
                  )}
                </div>
              </section>
            </div>
            )}

            {/* TAB 3: Prescriptions & CPOE */}
            {(patientViewTab === 'prescriptions' || patientViewTab === 'all') && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                    Prescriptions & Medications ({patientPrescriptions.length})
                  </h4>
                </div>
                <button
                  onClick={() => setIsAddingRx(!isAddingRx)}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isAddingRx ? 'Cancel Rx' : '+ Prescribe'}</span>
                </button>
              </div>

              {isAddingRx && (
                <form onSubmit={handleCreatePrescription} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Medication Name</label>
                      <input
                        type="text"
                        required
                        value={rxDrugName}
                        onChange={(e) => setRxDrugName(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Dosage</label>
                      <input
                        type="text"
                        required
                        value={rxDosage}
                        onChange={(e) => setRxDosage(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Frequency</label>
                      <input
                        type="text"
                        required
                        value={rxFrequency}
                        onChange={(e) => setRxFrequency(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Route</label>
                      <select
                        value={rxRoute}
                        onChange={(e) => setRxRoute(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs"
                      >
                        <option>Oral</option>
                        <option>Intravenous</option>
                        <option>Intramuscular</option>
                        <option>Topical</option>
                        <option>Inhalation</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-600 block mb-1">Duration</label>
                      <input
                        type="text"
                        required
                        value={rxDuration}
                        onChange={(e) => setRxDuration(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 block mb-1">Patient Instructions</label>
                    <input
                      type="text"
                      value={rxInstructions}
                      onChange={(e) => setRxInstructions(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3 h-3" /> Authorize & Sign E-Prescription
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {patientPrescriptions.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">No active prescriptions or medications recorded.</div>
                ) : (
                  patientPrescriptions.map((rx: any, idx: number) => (
                    <div key={rx.id || `${rx.medicationName || rx.name}-${idx}`} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{rx.medicationName || rx.name}</span>
                          <span className="font-mono text-[10px] text-slate-400 font-normal">({rx.dosage} · {rx.frequency})</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {rx.instructions || (rx.route ? `Route: ${rx.route} · Prescribed by: ${rx.prescribedBy}` : `Prescribed by: ${rx.prescribedBy}`)}
                          {rx.duration ? ` · Duration: ${rx.duration}` : (rx.startDate ? ` · Started: ${rx.startDate}` : '')}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {rx.status || 'Active'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            Select a patient from the left column to view their medical record.
          </div>
        )}
      </div>
    </div>
  );
};
