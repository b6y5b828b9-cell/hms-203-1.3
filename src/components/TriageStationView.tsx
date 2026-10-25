import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Heart,
  PhoneCall,
  User,
  ShieldCheck,
  Stethoscope,
  Search,
  ReceiptText,
  Save,
  Syringe,
  ChevronDown,
  IdCard,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { ReceptionToken, TokenLineItem, TokenVitalsRecord } from '../types';
import {
  advanceOutpatientNurseToken,
  completeOutpatientNurseService,
  saveOutpatientNurseTriage,
} from '../utils/outpatientNurseApi';
import { canExecuteOutpatientTreatment, isOutpatientTreatmentReady } from '../utils/tokenStateMachine';

interface TriageStationViewProps {
  onSelectPatient: (id: string) => void;
}

export const TriageStationView: React.FC<TriageStationViewProps> = ({ onSelectPatient }) => {
  const {
    patients,
    receptionTokens,
    medicalCertificates,
    insuranceApprovals,
    invoices,
    setActiveTab,
    updatePatientStatus,
    addNotification,
    currentRole,
    currentUser,
    updateTokenVitals,
    addTokenNursingNote,
    updateReceptionTokenStatus,
    markOutpatientServiceExecuted,
  } = useHospital();
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [visitSearch, setVisitSearch] = useState('');
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [patientInfoOpenId, setPatientInfoOpenId] = useState<string | null>(null);
  const [visitWorkspaceTab, setVisitWorkspaceTab] = useState<'clinical' | 'services' | 'treatment' | 'discharge' | 'reports' | 'insurance'>('clinical');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const patientsWithTriage = patients.filter((p) => p.latestTriage);

  const filteredPatients = patientsWithTriage.filter((p) => {
    if (filterLevel === 'all') return true;
    if (filterLevel === 'stat') {
      return (
        p.latestTriage?.urgencyLevel.includes('Level 1') ||
        p.latestTriage?.urgencyLevel.includes('Level 2')
      );
    }
    return p.latestTriage?.urgencyLevel.toLowerCase().includes(filterLevel.toLowerCase());
  });

  const normalizeDoctorName = (name: string) =>
    name.toLowerCase().replace(/^dr\.?\s*/, '').replace(/,?\s*(md|facs|do|phd)\b/g, '').replace(/[.,]/g, '').trim();
  const doctorOptions = [...new Set(receptionTokens.map((token) => token.doctorName).filter((name): name is string => Boolean(name)))].sort();
  const departmentOptions = [...new Set(receptionTokens.map((token) => token.department).filter(Boolean))].sort();
  const registeredVisitTokens = receptionTokens
    .filter((token) => token.patientId !== 'WALK-IN' && token.patientId)
    .filter((token) => currentRole !== 'nurse' || !['Completed', 'Cancelled'].includes(token.status))
    .filter((token) => currentRole !== 'doctor' ||
      token.doctorId === currentUser.id ||
      normalizeDoctorName(token.doctorName || '') === normalizeDoctorName(currentUser.name))
    .filter((token) => doctorFilter === 'all' || token.doctorName === doctorFilter)
    .filter((token) => departmentFilter === 'all' || token.department === departmentFilter)
    .filter((token) => {
      const query = visitSearch.trim().toLowerCase();
      return !query || `${token.tokenNumber} ${token.patientName} ${token.patientId} ${token.department} ${token.doctorName || ''}`.toLowerCase().includes(query);
    })
    .sort((first, second) =>
      (second.visitDate || second.createdDate || '').localeCompare(first.visitDate || first.createdDate || '') ||
      second.createdTime.localeCompare(first.createdTime)
    );
  const waitingVisitCount = registeredVisitTokens.filter((token) => getOutpatientQueueStatus(token) === 'Waiting').length;
  const triageVisitCount = registeredVisitTokens.filter((token) => getOutpatientQueueStatus(token) === 'In Triage').length;
  const treatmentVisitCount = registeredVisitTokens.filter((token) => getOutpatientQueueStatus(token) === 'Ready for Treatment').length;
  const getVisitApprovals = (token: ReceptionToken) => {
    const visitDate = token.visitDate || token.createdDate;
    const approvals = insuranceApprovals
      .filter((approval) => approval.patientId === token.patientId)
      .sort((first, second) => second.approvalDate.localeCompare(first.approvalDate));
    return {
      current: approvals.filter((approval) => approval.encounterTokenId === token.id || approval.approvalDate === visitDate),
      past: approvals.filter((approval) => approval.encounterTokenId !== token.id && approval.approvalDate !== visitDate),
    };
  };

  const getVisitServices = (token: ReceptionToken) => {
    const patient = patients.find((item) => item.id === token.patientId);
    const visitDate = token.visitDate || token.createdDate;
    const patientServices = (patient?.services || []).filter((service) =>
      service.encounterTokenId === token.id || (!service.encounterTokenId && service.addedAt.slice(0, 10) === visitDate)
    );
    return {
      doctorOrders: [
        ...(token.doctorOrders?.labRequests || []).map((order) => ({ name: order.testName, category: order.category, status: order.status })),
        ...(token.doctorOrders?.radiologyRequests || []).map((order) => ({ name: order.studyName, category: order.modality, status: order.status })),
        ...(token.doctorOrders?.procedureRequests || []).map((order) => ({ name: order.procedureName, category: order.cptCode, status: order.status })),
      ],
      patientServices,
    };
  };

  const getVisitInvoices = (token: ReceptionToken) => invoices
    .filter((invoice) => invoice.patientId === token.patientId)
    .sort((first, second) => second.issueDate.localeCompare(first.issueDate));

  const handleEscalateToER = (patientId: string, patientName: string) => {
    updatePatientStatus(patientId, 'Emergency');
    addNotification(
      `STAT ER Escalation: ${patientName}`,
      `${patientName} escalated to ER Trauma Bay. Immediate MD bedside attendance dispatched.`,
      'critical',
      patientId
    );
  };

  const handleQueueTransition = async (
    token: ReceptionToken,
    status: 'In Triage' | 'Ready for Treatment'
  ): Promise<boolean> => {
    try {
      const persisted = await advanceOutpatientNurseToken(token.id, status);
      if (!persisted) updateReceptionTokenStatus(token.id, status);
      return true;
    } catch (error) {
      addNotification(
        'Queue Status Not Updated',
        error instanceof Error ? error.message : 'The outpatient token status could not be updated.',
        'warning',
        token.id
      );
      return false;
    }
  };

  const handleTreatmentCompletion = async (tokenId: string, lineItemId: string, notes: string) => {
    try {
      const persisted = await completeOutpatientNurseService(tokenId, lineItemId, notes, currentUser.name);
      return persisted || markOutpatientServiceExecuted(tokenId, lineItemId, notes);
    } catch (error) {
      addNotification(
        'Treatment Not Completed',
        error instanceof Error ? error.message : 'The treatment could not be marked complete.',
        'warning',
        tokenId
      );
      return false;
    }
  };

  const handleSaveAndDispatch = async (token: ReceptionToken, vitals: TokenVitalsRecord, progressNote: string) => {
    try {
      const persisted = await saveOutpatientNurseTriage(token.id, vitals, progressNote, currentUser.name);
      if (persisted) return true;
      if (!updateTokenVitals(token.id, vitals)) return false;
      if (progressNote && !addTokenNursingNote(token.id, progressNote, 'Progress')) return false;
      updateReceptionTokenStatus(token.id, 'In Consultation');
      return true;
    } catch (error) {
      addNotification(
        'Triage Not Dispatched',
        error instanceof Error ? error.message : 'The triage record could not be saved and dispatched.',
        'warning',
        token.id
      );
      return false;
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-screen-2xl mx-auto">
      {/* Outpatient Nurse Dashboard */}
      <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <h2 className="text-base font-bold text-white tracking-wide">
              Outpatient Clinic Nurse Dashboard
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold uppercase">
              VISIT TOKEN WORKFLOW
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl">
            Patient call-in, triage, approved treatment execution, and discharge instructions for active outpatient visits.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700 font-mono text-xs">
            <span className="text-slate-400">Queue:</span>
            <span className="text-slate-100 font-bold">{waitingVisitCount} waiting</span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-300 font-bold">{triageVisitCount} in triage</span>
            <span className="text-slate-600">|</span>
            <span className="text-violet-300 font-bold">{treatmentVisitCount} ready</span>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Outpatient nurse queue</h3>
            <p className="mt-1 text-[11px] text-slate-500">Call patients into triage, complete token-based assessment, review orders and perform approved or settled treatments.</p>
          </div>
          <label className="relative block w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={visitSearch}
              onChange={(event) => setVisitSearch(event.target.value)}
              placeholder="Search token, patient, department, doctor"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs"
            />
          </label>
          {(currentRole === 'nurse' || currentRole === 'admin') && (
            <>
            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              aria-label="Filter registered visits by department"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:w-48"
            >
              <option value="all">All departments</option>
              {departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
            <select
              value={doctorFilter}
              onChange={(event) => setDoctorFilter(event.target.value)}
              aria-label="Filter registered visits by doctor"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:w-56"
            >
              <option value="all">All doctors</option>
              {doctorOptions.map((doctorName) => <option key={doctorName} value={doctorName}>{doctorName}</option>)}
            </select>
            </>
          )}
        </div>

        {registeredVisitTokens.length === 0 ? (
          <p className="p-5 text-center text-xs text-slate-500">No registered patient visit tokens match this search.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {registeredVisitTokens.map((token) => {
              const isExpanded = expandedVisitId === token.id;
              const patient = patients.find((item) => item.id === token.patientId);
              const approvals = getVisitApprovals(token);
              const services = getVisitServices(token);
              const visitInvoices = getVisitInvoices(token);
              const visitInvoice = visitInvoices.find((invoice) =>
                invoice.encounterTokenId === token.id || invoice.issueDate === (token.visitDate || token.createdDate)
              );
              const tokenDate = token.visitDate || token.createdDate || 'Date not recorded';
              const vitals = token.vitals;
              const queueStatus = getOutpatientQueueStatus(token);
              const hasReadyTreatment = (token.lineItems || []).some((item) => isReadyForNurseTreatment(token, item));
              const medicalReports = [...(patient?.clinicalNotes || [])]
                .sort((first, second) => second.date.localeCompare(first.date));
              const currentMedicalReports = medicalReports.filter((report) =>
                report.encounterTokenId === token.id || (!report.encounterTokenId && report.date === tokenDate)
              );
              const pastMedicalReports = medicalReports.filter((report) =>
                report.encounterTokenId !== token.id && (report.encounterTokenId || report.date !== tokenDate)
              );
              return (
                <article key={token.id} className="p-3 sm:p-4">
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                    <button type="button" onClick={() => setExpandedVisitId(isExpanded ? null : token.id)} className="min-w-0 flex-1 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-teal-50 px-2 py-1 font-mono text-xs font-bold text-teal-800">{token.tokenNumber}</span>
                        <span className="text-xs font-bold text-slate-900">{token.patientName}</span>
                        <span className="font-mono text-[10px] text-slate-500">{token.patientId}</span>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${queueStatus === 'Completed' ? 'bg-emerald-100 text-emerald-800' : queueStatus === 'Cancelled' ? 'bg-rose-100 text-rose-800' : queueStatus === 'Ready for Treatment' ? 'bg-violet-100 text-violet-800' : queueStatus === 'In Consultation' ? 'bg-sky-100 text-sky-800' : queueStatus === 'In Triage' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{queueStatus}</span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-600">{tokenDate} · {token.department} · {token.doctorName || 'Doctor not assigned'} · {token.insuranceProvider || token.paymentScheme?.insuranceProvider || 'Self-Pay'}</p>
                      <p className="mt-1 text-[10px] text-slate-500">Vitals: {vitals ? `BP ${vitals.bpSystolic}/${vitals.bpDiastolic}, HR ${vitals.heartRate}, SpO₂ ${vitals.spO2}%${vitals.bmi ? `, BMI ${vitals.bmi}` : ''}` : 'Not entered'} · Invoice: {visitInvoice ? `${visitInvoice.id} · ${visitInvoice.status} · AED ${Number(visitInvoice.balanceDue).toFixed(2)} due` : 'Not issued'}</p>
                    </button>
                    <div className="flex shrink-0 gap-2">
                      {(currentRole === 'nurse' || currentRole === 'admin') && token.status === 'Waiting' && (
                        <button type="button" onClick={() => void handleQueueTransition(token, 'In Triage')} className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-2 text-[10px] font-bold text-white hover:bg-teal-800">
                          <PhoneCall className="h-3 w-3" /> Call patient
                        </button>
                      )}
                      {(currentRole === 'nurse' || currentRole === 'admin') && hasReadyTreatment && token.status !== 'Ready for Treatment' && (
                        <button type="button" onClick={() => void handleQueueTransition(token, 'Ready for Treatment')} className="rounded-md bg-violet-700 px-3 py-2 text-[10px] font-bold text-white hover:bg-violet-800">
                          Ready for treatment
                        </button>
                      )}
                      <button type="button" onClick={() => setExpandedVisitId(isExpanded ? null : token.id)} className="rounded-md border border-slate-300 px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50">
                        {isExpanded ? 'Close token workspace' : 'Open token workspace'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-5 space-y-5 border-t border-slate-100 pt-4">
                      <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <button
                          type="button"
                          aria-expanded={patientInfoOpenId === token.id}
                          onClick={() => setPatientInfoOpenId(patientInfoOpenId === token.id ? null : token.id)}
                          className="flex min-h-16 w-full items-center justify-between gap-4 p-4 text-left hover:bg-slate-100"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-100 text-base font-bold text-teal-800">{token.patientName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
                            <span className="min-w-0">
                              <span className="block truncate text-base font-bold text-slate-900">{token.patientName}</span>
                              <span className="mt-1 block truncate text-sm text-slate-600">MRN {token.patientId} · {token.patientPhone || patient?.phone || 'Phone not recorded'} · {token.patientGender || patient?.gender || 'Gender not recorded'}</span>
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-teal-800">
                            {patientInfoOpenId === token.id ? 'Hide patient information' : 'View patient information'}
                            <ChevronDown className={`h-4 w-4 transition-transform ${patientInfoOpenId === token.id ? 'rotate-180' : ''}`} />
                          </span>
                        </button>
                        {patientInfoOpenId === token.id && (
                          <dl className="grid gap-3 border-t border-slate-200 bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                            <div><dt className="text-slate-500">Visit / department</dt><dd className="font-semibold text-slate-800">{token.visitPurpose || token.visitType || 'Visit'} · {token.department}</dd></div>
                            <div><dt className="text-slate-500">Assigned doctor</dt><dd className="font-semibold text-slate-800">{token.doctorName || 'Not assigned'}</dd></div>
                            <div><dt className="text-slate-500">Date of birth</dt><dd className="font-semibold text-slate-800">{token.patientDetails?.dateOfBirth || patient?.dob || '—'}</dd></div>
                            <div><dt className="text-slate-500">Email</dt><dd className="break-all font-semibold text-slate-800">{token.patientDetails?.email || patient?.email || '—'}</dd></div>
                            <div><dt className="text-slate-500">Emirates ID</dt><dd className="font-semibold text-slate-800">{token.patientDetails?.nationalId || patient?.emiratesId || 'Not recorded'}</dd></div>
                            <div><dt className="text-slate-500">Passport</dt><dd className="font-semibold text-slate-800">{token.patientDetails?.passportNumber || patient?.passportNo || 'Not recorded'}</dd></div>
                            <div className="sm:col-span-2"><dt className="text-slate-500">Address</dt><dd className="font-semibold text-slate-800">{token.patientDetails?.address || patient?.address || '—'}</dd></div>
                          </dl>
                        )}
                      </section>

                      <div role="tablist" aria-label={`Visit ${token.tokenNumber} workspace`} className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                        {([
                          ['clinical', 'Nurse clinical review', Stethoscope],
                          ['services', 'Doctor services & insurance status · read only', ShieldCheck],
                          ['treatment', 'Outpatient treatment execution', Syringe],
                          ['discharge', 'Discharge & instructions', ReceiptText],
                          ['reports', 'Medical reports', FileText],
                          ['insurance', 'Insurance & ID documents', IdCard],
                        ] as const).map(([tab, label, Icon]) => (
                          <button
                            key={tab}
                            id={`visit-workspace-tab-${token.id}-${tab}`}
                            type="button"
                            role="tab"
                            aria-controls={`visit-workspace-panel-${token.id}`}
                            aria-selected={visitWorkspaceTab === tab}
                            onClick={() => setVisitWorkspaceTab(tab)}
                            className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border px-3 py-3 text-center text-sm font-bold leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 ${visitWorkspaceTab === tab ? 'border-teal-700 bg-teal-700 text-white shadow-md' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50'}`}
                          >
                            <Icon className="h-5 w-5 shrink-0" /> <span>{label}</span>
                          </button>
                        ))}
                      </div>

                      <div
                        role="tabpanel"
                        id={`visit-workspace-panel-${token.id}`}
                        aria-labelledby={`visit-workspace-tab-${token.id}-${visitWorkspaceTab}`}
                        className="min-h-64 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-5"
                      >
                      {visitWorkspaceTab === 'services' && <section className="rounded-lg border border-slate-200 p-3">
                        <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-700"><Stethoscope className="h-3.5 w-3.5" /> Doctor-added services & orders</h4>
                        {services.doctorOrders.length === 0 && services.patientServices.length === 0 ? (
                          <p className="text-[10px] text-slate-500">No doctor services or diagnostic orders recorded for this visit.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {services.doctorOrders.map((service, index) => <li key={`${service.name}-${index}`} className="flex justify-between gap-2 text-[10px]"><span className="font-semibold text-slate-800">{service.name}<span className="ml-1 font-normal text-slate-500">{service.category}</span></span><span className="shrink-0 text-slate-600">{service.status}</span></li>)}
                            {services.patientServices.map((service) => <li key={service.id} className="flex justify-between gap-2 text-[10px]"><span className="font-semibold text-slate-800">{service.name}<span className="ml-1 font-normal text-slate-500">{service.category}</span></span><span className="shrink-0 text-slate-600">{new Date(service.addedAt).toLocaleDateString()}</span></li>)}
                          </ul>
                        )}
                        {token.doctorOrders?.diagnoses.length ? <p className="mt-2 border-t border-slate-100 pt-2 text-[10px]"><span className="font-bold text-slate-600">Diagnosis: </span>{token.doctorOrders.diagnoses.map((diagnosis) => `${diagnosis.code} ${diagnosis.description}`).join(' · ')}</p> : null}
                        {(token.doctorOrders?.healthSummary || token.doctorOrders?.chiefComplaint || token.doctorOrders?.clinicalAssessment) && (
                          <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[10px] text-slate-700">
                            {token.doctorOrders.chiefComplaint && <p><span className="font-bold">Doctor complaint: </span>{token.doctorOrders.chiefComplaint}</p>}
                            {token.doctorOrders.healthSummary && <p><span className="font-bold">Doctor history: </span>{token.doctorOrders.healthSummary}</p>}
                            {token.doctorOrders.clinicalAssessment && <p><span className="font-bold">Clinical assessment: </span>{token.doctorOrders.clinicalAssessment}</p>}
                          </div>
                        )}
                      </section>}

                      {visitWorkspaceTab === 'services' && <section className="rounded-lg border border-slate-200 p-3">
                        <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-700"><ShieldCheck className="h-3.5 w-3.5" /> Insurance approvals · current visit</h4>
                        {approvals.current.length ? <ul className="space-y-1.5">{approvals.current.map((approval) => <li key={approval.id} className="flex flex-wrap justify-between gap-x-3 text-[10px]"><span className="font-semibold text-slate-800">{approval.serviceName} · {approval.approvalNumber}</span><span>{approval.approvalDate} · {approval.approvalStatus}</span></li>)}</ul> : <p className="text-[10px] text-slate-500">No approval recorded for this visit date.</p>}
                        <h5 className="mb-1 mt-3 text-[9px] font-bold uppercase text-slate-500">Past approvals</h5>
                        {approvals.past.length ? <ul className="max-h-36 space-y-1 overflow-y-auto">{approvals.past.map((approval) => <li key={approval.id} className="flex flex-wrap justify-between gap-x-3 text-[10px] text-slate-600"><span>{approval.serviceName} · {approval.approvalNumber}</span><span>{approval.approvalDate} · {approval.approvalStatus}</span></li>)}</ul> : <p className="text-[10px] text-slate-500">No past approvals on file.</p>}
                      </section>}

                      {visitWorkspaceTab === 'services' && <section className="rounded-lg border border-slate-200 p-3">
                        <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-700"><ReceiptText className="h-3.5 w-3.5" /> Invoice status</h4>
                        {visitInvoices.length ? <ul className="max-h-36 space-y-1.5 overflow-y-auto">{visitInvoices.map((invoice) => <li key={invoice.id} className="flex flex-wrap justify-between gap-x-3 text-[10px]"><span className="font-semibold text-slate-800">{invoice.id} · {invoice.encounterTokenId === token.id || invoice.issueDate === tokenDate ? 'Current visit' : invoice.issueDate}</span><span className="font-semibold text-slate-700">{invoice.status} · ${Number(invoice.balanceDue).toFixed(2)} due</span></li>)}</ul> : <p className="text-[10px] text-slate-500">No invoice has been issued for this patient.</p>}
                      </section>}

                      {visitWorkspaceTab === 'reports' && <section className="rounded-lg border border-slate-200 p-3">
                        <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-700"><FileText className="h-3.5 w-3.5" /> Doctor medical reports</h4>
                        <h5 className="mb-1 text-[9px] font-bold uppercase text-teal-700">Current visit · {token.tokenNumber}</h5>
                        {currentMedicalReports.length ? (
                          <ul className="space-y-1.5">
                            {currentMedicalReports.map((report) => (
                              <li key={report.id} className="rounded bg-teal-50/70 p-2 text-[10px] text-slate-700">
                                <p className="font-semibold text-slate-900">{report.date} · {report.doctorName || report.authorName || 'Doctor'} · {report.category || 'Medical report'}</p>
                                {report.chiefComplaint && <p>Chief complaint: {report.chiefComplaint}</p>}
                                <p>{report.assessment || report.content || 'No summary recorded.'}</p>
                                {report.treatmentPlan && <p>Plan: {report.treatmentPlan}</p>}
                                {(report.diagnoses?.length || report.diagnosisCode) && <p>Diagnosis: {report.diagnoses?.join(', ') || report.diagnosisCode}</p>}
                              </li>
                            ))}
                          </ul>
                        ) : <p className="text-[10px] text-slate-500">No doctor medical report saved for this visit.</p>}
                        <h5 className="mb-1 mt-3 text-[9px] font-bold uppercase text-slate-500">Past visit medical reports</h5>
                        {pastMedicalReports.length ? (
                          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                            {pastMedicalReports.map((report) => (
                              <li key={report.id} className="rounded bg-slate-50 p-2 text-[10px] text-slate-700">
                                <p className="font-semibold text-slate-900">{report.date} · {report.doctorName || report.authorName || 'Doctor'} · {report.category || 'Medical report'}</p>
                                <p>{report.assessment || report.content || report.chiefComplaint || 'No summary recorded.'}</p>
                                {(report.diagnoses?.length || report.diagnosisCode) && <p>Diagnosis: {report.diagnoses?.join(', ') || report.diagnosisCode}</p>}
                              </li>
                            ))}
                          </ul>
                        ) : <p className="text-[10px] text-slate-500">No past visit medical reports recorded.</p>}
                      </section>}

                      {visitWorkspaceTab === 'insurance' && (
                        <section className="rounded-lg border border-slate-200 bg-white p-3">
                          <h4 className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-700"><IdCard className="h-3.5 w-3.5" /> Insurance & identity documents</h4>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <h5 className="mb-2 text-[10px] font-bold text-slate-800">Patient ID proof</h5>
                              <dl className="space-y-1.5 text-[10px]">
                                <div><dt className="text-slate-500">Emirates ID</dt><dd className="font-semibold text-slate-800">{token.patientDetails?.nationalId || patient?.emiratesId || 'Not recorded'}</dd></div>
                                <div><dt className="text-slate-500">Passport</dt><dd className="font-semibold text-slate-800">{token.patientDetails?.passportNumber || patient?.passportNo || 'Not recorded'}</dd></div>
                              </dl>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <h5 className="mb-2 text-[10px] font-bold text-slate-800">Insurance card</h5>
                              <p className="mb-2 text-[10px] text-slate-600">
                                {token.insuranceProvider || token.paymentScheme?.insuranceProvider || 'Payer not recorded'}
                                {token.patientDetails?.insurancePolicyNumber || token.paymentScheme?.policyNumber ? ` · Policy ${token.patientDetails?.insurancePolicyNumber || token.paymentScheme?.policyNumber}` : ''}
                                {token.patientDetails?.insuranceMemberId ? ` · Member ${token.patientDetails.insuranceMemberId}` : ''}
                              </p>
                              {(token.patientDetails?.insuranceCards || []).length ? (
                                <ul className="space-y-2 text-[10px]">
                                  {token.patientDetails?.insuranceCards?.map((card) => (
                                    <li key={`${card.policyNumber}-${card.cardNumber}`} className="rounded border border-slate-200 bg-white p-2">
                                      <p className="font-bold text-slate-800">{card.payerName} · {card.plan}{card.isPrimary ? ' · Primary' : ''}</p>
                                      <p className="mt-1 text-slate-600">Card {card.cardNumber} · Policy {card.policyNumber}</p>
                                      <p className="text-slate-600">Network {card.network} · Expires {card.expiryDate}</p>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-[10px] text-slate-500">{token.insuranceProvider || token.paymentScheme?.insuranceProvider || 'No insurance card recorded for this visit.'}</p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 border-t border-slate-100 pt-3">
                            <h5 className="mb-2 text-[10px] font-bold text-slate-800">Visit documents</h5>
                            {token.visitDocuments?.length ? (
                              <ul className="space-y-1.5">
                                {token.visitDocuments.map((document) => (
                                  <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 px-2.5 py-2 text-[10px]">
                                    <span className="font-medium text-slate-700">{document.fileName} · {new Date(document.uploadedAt).toLocaleDateString()}</span>
                                    <a href={document.dataUrl} target="_blank" rel="noreferrer" className="font-bold text-teal-700 underline">View / download</a>
                                  </li>
                                ))}
                              </ul>
                            ) : <p className="text-[10px] text-slate-500">No ID or insurance documents are attached to this visit token.</p>}
                          </div>
                        </section>
                      )}

                      {visitWorkspaceTab === 'reports' && (
                        <section className="rounded-lg border border-slate-200 bg-white p-3">
                          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-700"><FileText className="h-3.5 w-3.5" /> Laboratory & radiology results</h4>
                          {(token.diagnosticReports?.length || patient?.labResults?.length || token.lineItems?.some((item) => item.resultPayload)) ? (
                            <ul className="space-y-2 text-[10px]">
                              {token.diagnosticReports?.map((report) => (
                                <li key={report.id} className="rounded bg-slate-50 p-2">
                                  <p className="font-semibold text-slate-800">{report.date} · {report.testOrStudyName} · {report.status}</p>
                                  {report.reportPdfUrl && <a href={report.reportPdfUrl} target="_blank" rel="noreferrer" className="text-teal-700 underline">View report</a>}
                                  {report.reportFiles?.map((file) => <p key={file.id}><a href={file.dataUrl} target="_blank" rel="noreferrer" className="text-teal-700 underline">{file.fileName}</a></p>)}
                                </li>
                              ))}
                              {(patient?.labResults || []).filter((result) => result.encounterTokenId === token.id).map((result) => (
                                <li key={result.id} className="rounded bg-slate-50 p-2">
                                  <p className="font-semibold text-slate-800">{result.resultDate || result.orderedDate} · {result.testName} · {result.status}</p>
                                  {result.value && <p>Result: {result.value}{result.referenceRange ? ` · Reference: ${result.referenceRange}` : ''}</p>}
                                  {result.findings && <p>Findings: {result.findings}</p>}
                                  {result.impression && <p>Impression: {result.impression}</p>}
                                </li>
                              ))}
                              {(token.lineItems || []).filter((item) => item.resultPayload).map((item) => (
                                <li key={item.id} className="rounded bg-slate-50 p-2">
                                  <p className="font-semibold text-slate-800">{item.name} · {item.resultPayload?.status || 'Result uploaded'}</p>
                                  {item.resultPayload?.value && <p>Result: {item.resultPayload.value}{item.resultPayload.referenceRange ? ` · Reference: ${item.resultPayload.referenceRange}` : ''}</p>}
                                  {item.resultPayload?.findings && <p>Findings: {item.resultPayload.findings}</p>}
                                  {item.resultPayload?.reportFiles?.map((file) => <p key={file.id}><a href={file.dataUrl} target="_blank" rel="noreferrer" className="text-teal-700 underline">{file.fileName}</a></p>)}
                                </li>
                              ))}
                            </ul>
                          ) : <p className="text-[10px] text-slate-500">No diagnostic findings or result reports are available for this visit.</p>}
                          <div className="mt-3 border-t border-slate-100 pt-3">
                            <h5 className="mb-2 text-[10px] font-bold text-slate-800">Visit attachments</h5>
                            {token.visitDocuments?.length ? (
                              <ul className="space-y-1.5">
                                {token.visitDocuments.map((document) => (
                                  <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 px-2.5 py-2">
                                    <span className="text-slate-700">{document.fileName} · {new Date(document.uploadedAt).toLocaleDateString()}</span>
                                    <a href={document.dataUrl} target="_blank" rel="noreferrer" className="font-bold text-teal-700 underline">View / download</a>
                                  </li>
                                ))}
                              </ul>
                            ) : <p className="text-[10px] text-slate-500">No visit attachments are linked to this token.</p>}
                          </div>
                        </section>
                      )}

                      <NurseVisitWorkspace
                        key={token.id}
                        token={token}
                        patient={patient}
                        activeTab={visitWorkspaceTab}
                        certificates={medicalCertificates.filter((certificate) =>
                          certificate.encounterTokenId === token.id &&
                          certificate.certificateType === 'Sick Leave Attestation'
                        )}
                        canEdit={currentRole === 'nurse' || currentRole === 'admin'}
                        approvals={approvals.current}
                        currentUser={currentUser}
                        addTokenNursingNote={addTokenNursingNote}
                        onMarkExecuted={handleTreatmentCompletion}
                        onSaveAndDispatch={(vitals, note) => handleSaveAndDispatch(token, vitals, note)}
                      />
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Main Triage Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Emergency Acuity Monitor ({filteredPatients.length})
            </h3>
          </div>

          <div className="flex items-center gap-1">
            {[
              { id: 'all', label: 'All Assessed' },
              { id: 'stat', label: 'Level 1 & 2 STAT' },
              { id: 'urgent', label: 'Urgent' },
              { id: 'non-urgent', label: 'Ambulatory' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterLevel(tab.id)}
                className={`px-2.5 py-1 text-[11px] rounded font-medium transition cursor-pointer ${
                  filterLevel === tab.id
                    ? 'bg-rose-600 text-white font-semibold'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-2.5 px-3">Acuity Tier</th>
                <th className="py-2.5 px-3">Patient</th>
                <th className="py-2.5 px-3">Vitals Telemetry</th>
                <th className="py-2.5 px-3">NEWS2</th>
                <th className="py-2.5 px-3">Zone & Disposition</th>
                <th className="py-2.5 px-3">Assessed By</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No patients match the selected triage filter. Record triage details from an active Visit Token above.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((p) => {
                  const t = p.latestTriage!;
                  const isCritical = t.urgencyLevel.includes('Level 1') || t.urgencyLevel.includes('Level 2');
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCritical ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.urgencyLevel.includes('Level 1')
                              ? 'bg-rose-600 text-white animate-pulse'
                              : t.urgencyLevel.includes('Level 2')
                              ? 'bg-rose-100 text-rose-800'
                              : t.urgencyLevel.includes('Level 3')
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {t.urgencyLevel.split(' - ')[0]}
                        </span>
                        <span className="block text-[9px] text-slate-400 font-mono mt-0.5">
                          {(t.timestamp || t.assessedAt || '').split('T')[1]?.slice(0, 5) || 'Recent'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <button
                          onClick={() => {
                            onSelectPatient(p.id);
                            setActiveTab('patients');
                          }}
                          className="text-left group cursor-pointer"
                        >
                          <span className="font-semibold text-slate-900 group-hover:text-blue-600 block">
                            {p.firstName} {p.lastName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {p.id} · {p.age}y {p.gender} · {p.bloodGroup}
                          </span>
                        </button>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                        <div className="text-slate-800">
                          BP: <span className="font-bold">{t.bloodPressure}</span> · HR: <span className="font-bold">{t.heartRate}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          SpO2: {t.oxygenSaturation}% · RR: {t.respiratoryRate} · Temp: {t.temperatureF}°F
                        </div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                            (t.newsScore ?? 0) >= 7
                              ? 'bg-rose-100 text-rose-700'
                              : (t.newsScore ?? 0) >= 5
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {t.newsScore ?? 0} pts
                        </span>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{t.assignedZone}</div>
                        <div className="text-[10px] text-slate-500">{t.disposition}</div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                        <div>{t.assessedBy}</div>
                        <div className="text-[10px] text-slate-400">{t.assessorRole}</div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap text-right space-x-1.5">
                        {p.status !== 'Emergency' && (
                          <button
                            onClick={() => handleEscalateToER(p.id, `${p.firstName} ${p.lastName}`)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded text-[10px] cursor-pointer"
                            title="Escalate to Emergency Care"
                          >
                            Escalate ER
                          </button>
                        )}
                        <button
                          onClick={() => {
                            onSelectPatient(p.id);
                            setActiveTab('patients');
                          }}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded text-[10px] cursor-pointer"
                        >
                          View EMR
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface NurseVisitWorkspaceProps {
  token: ReceptionToken;
  patient: ReturnType<typeof useHospital>['patients'][number] | undefined;
  activeTab: 'clinical' | 'services' | 'treatment' | 'discharge' | 'reports' | 'insurance';
  certificates: ReturnType<typeof useHospital>['medicalCertificates'];
  approvals: ReturnType<typeof useHospital>['insuranceApprovals'];
  canEdit: boolean;
  currentUser: ReturnType<typeof useHospital>['currentUser'];
  addTokenNursingNote: ReturnType<typeof useHospital>['addTokenNursingNote'];
  onMarkExecuted: (tokenId: string, lineItemId: string, notes: string) => Promise<boolean>;
  onSaveAndDispatch: (vitals: TokenVitalsRecord, progressNote: string) => Promise<boolean>;
}

const isReadyForNurseTreatment = (token: ReceptionToken, item: TokenLineItem): boolean =>
  isOutpatientTreatmentReady(token, item);

const getOutpatientQueueStatus = (token: ReceptionToken): ReceptionToken['status'] => {
  if (['Completed', 'Cancelled'].includes(token.status)) return token.status;
  if ((token.lineItems || []).some((item) => isReadyForNurseTreatment(token, item))) return 'Ready for Treatment';
  return token.status;
};

const NurseVisitWorkspace: React.FC<NurseVisitWorkspaceProps> = ({
  token,
  patient,
  activeTab,
  certificates,
  approvals,
  canEdit,
  currentUser,
  addTokenNursingNote,
  onMarkExecuted,
  onSaveAndDispatch,
}) => {
  const initialVitals = token.vitals;
  const [systolic, setSystolic] = useState(initialVitals?.bpSystolic?.toString() || '');
  const [diastolic, setDiastolic] = useState(initialVitals?.bpDiastolic?.toString() || '');
  const [heartRate, setHeartRate] = useState(initialVitals?.heartRate?.toString() || '');
  const [temperatureC, setTemperatureC] = useState(
    initialVitals ? ((initialVitals.temperature - 32) * 5 / 9).toFixed(1) : ''
  );
  const [respiratoryRate, setRespiratoryRate] = useState(initialVitals?.respiratoryRate?.toString() || '');
  const [heightCm, setHeightCm] = useState(initialVitals?.heightCm?.toString() || '');
  const [weightKg, setWeightKg] = useState(initialVitals?.weightKg?.toString() || '');
  const [spO2, setSpO2] = useState(initialVitals?.spO2?.toString() || '');
  const [painScore, setPainScore] = useState(initialVitals?.painScale?.toString() || '0');
  const [allergyUpdates, setAllergyUpdates] = useState(initialVitals?.allergyUpdates || '');
  const [chiefComplaint, setChiefComplaint] = useState(
    initialVitals?.chiefComplaint || token.visitComplaint || token.doctorOrders?.chiefComplaint || ''
  );
  const [triageLevel, setTriageLevel] = useState<TokenVitalsRecord['triageLevel']>(
    initialVitals?.triageLevel || 'Level 3 - Urgent'
  );
  const [nursingNotes, setNursingNotes] = useState(initialVitals?.nursingNotes || '');
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [savingTriage, setSavingTriage] = useState(false);
  const [dischargeNote, setDischargeNote] = useState('');
  const [dischargeMessage, setDischargeMessage] = useState('');
  const [treatmentNotes, setTreatmentNotes] = useState<Record<string, string>>({});
  const [executingLineItemId, setExecutingLineItemId] = useState<string | null>(null);
  const [treatmentMessage, setTreatmentMessage] = useState('');
  const canEditVitals = canEdit && token.status === 'In Triage';
  const bpHigh = Number(systolic) >= 140 || Number(diastolic) >= 90;

  const parsedHeight = Number(heightCm);
  const parsedWeight = Number(weightKg);
  const bmi = parsedHeight > 0 && parsedWeight > 0
    ? parsedWeight / ((parsedHeight / 100) ** 2)
    : null;
  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveError('');
    setSaved(false);
    if (!canEditVitals) {
      setSaveError('Vitals can only be edited by nursing staff during the triage stage.');
      return;
    }
    const numbers = [systolic, diastolic, heartRate, temperatureC, respiratoryRate, heightCm, weightKg, spO2].map(Number);
    if (numbers.some((value) => !Number.isFinite(value) || value <= 0)) {
      setSaveError('Enter a valid positive value for every vital sign.');
      return;
    }
    if (Number(systolic) < 20 || Number(systolic) > 300 || Number(diastolic) < 10 ||
      Number(diastolic) > 200 || Number(systolic) <= Number(diastolic) ||
      Number(heartRate) > 300 || Number(respiratoryRate) > 100 ||
      Number(heightCm) < 20 || Number(heightCm) > 250 ||
      Number(weightKg) < 0.5 || Number(weightKg) > 500 || Number(spO2) > 100) {
      setSaveError('Check blood pressure, pulse, respiratory rate, height, weight, and SpO₂ ranges before saving.');
      return;
    }
    if (Number(painScore) < 0 || Number(painScore) > 10 || Number(temperatureC) < 25 || Number(temperatureC) > 45) {
      setSaveError('Pain score must be 0–10 and temperature must be between 25°C and 45°C.');
      return;
    }
    const recordedAt = new Date().toISOString();
    const vitals: TokenVitalsRecord = {
      bpSystolic: Number(systolic),
      bpDiastolic: Number(diastolic),
      heartRate: Number(heartRate),
      temperature: Number(temperatureC) * 9 / 5 + 32,
      respiratoryRate: Number(respiratoryRate),
      heightCm: parsedHeight,
      weightKg: parsedWeight,
      bmi: bmi ? Number(bmi.toFixed(2)) : undefined,
      spO2: Number(spO2),
      painScale: Number(painScore),
      allergyUpdates: allergyUpdates.trim(),
      triageLevel,
      chiefComplaint: chiefComplaint.trim(),
      nursingNotes: nursingNotes.trim(),
      nurseName: currentUser.name,
      recordedAt,
    };
    setSavingTriage(true);
    try {
      if (!await onSaveAndDispatch(vitals, nursingNotes.trim())) {
        setSaveError('The visit vitals could not be saved and dispatched. Check your access and try again.');
        return;
      }
      setSaved(true);
    } finally {
      setSavingTriage(false);
    }
  };

  const handleSaveDischargeNote = () => {
    setDischargeMessage('');
    if (!canEdit || !dischargeNote.trim()) {
      setDischargeMessage('Enter discharge instructions; only nursing staff can save them.');
      return;
    }
    if (addTokenNursingNote(token.id, dischargeNote, 'Discharge')) {
      setDischargeNote('');
      setDischargeMessage('Discharge note saved to this visit.');
    }
  };

  const handleMarkExecuted = async (item: TokenLineItem) => {
    setTreatmentMessage('');
    if (!window.confirm(`Confirm ${item.name} was administered or performed?`)) return;
    setExecutingLineItemId(item.id);
    const success = await onMarkExecuted(token.id, item.id, treatmentNotes[item.id] || '');
    setExecutingLineItemId(null);
    if (success) {
      setTreatmentNotes((current) => ({ ...current, [item.id]: '' }));
      setTreatmentMessage(`${item.name} marked completed.`);
    } else {
      setTreatmentMessage(`Could not complete ${item.name}. Check authorization and settlement status.`);
    }
  };

  const printCertificate = (certificate: (typeof certificates)[number]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setSaveError('Allow pop-ups to print the sick leave certificate.');
      return;
    }
    const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character] || character);
    printWindow.document.write(`<!doctype html><html><head><title>${escape(certificate.certificateNumber)}</title><style>body{font:14px Arial,sans-serif;margin:40px;color:#0f172a}h1{font-size:22px}p{margin:12px 0}.meta{color:#475569}</style></head><body><h1>Medical Sick Leave Certificate</h1><p class="meta">${escape(certificate.certificateNumber)} · ${escape(certificate.status)}</p><p>Patient: ${escape(certificate.patientName)} · MRN ${escape(certificate.patientMrn)}</p><p>Diagnosis: ${escape(certificate.diagnosisCode)} — ${escape(certificate.diagnosisDescription)}</p><p>Leave period: ${escape(certificate.startDate)} to ${escape(certificate.endDate)} (${certificate.durationDays} days)</p><p>Clinical notes: ${escape(certificate.clinicalNotes)}</p><p>Physician: ${escape(certificate.doctorName)} · ${escape(certificate.doctorLicense)}</p><p>Issued: ${escape(certificate.issueDate)} · ${escape(certificate.hospitalStampRef)}</p><script>window.onload=()=>window.print()</script></body></html>`);
    printWindow.document.close();
  };

  const printTreatmentPlan = () => {
    const plan = token.doctorOrders?.soapNotes?.plan || token.doctorOrders?.doctorNotes;
    if (!plan) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setSaveError('Allow pop-ups to print the doctor treatment plan.');
      return;
    }
    const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character] || character);
    printWindow.document.write(`<!doctype html><html><head><title>Visit ${escape(token.tokenNumber)} treatment plan</title><style>body{font:14px Arial,sans-serif;margin:40px;color:#0f172a}h1{font-size:22px}p{white-space:pre-wrap;margin:12px 0}.meta{color:#475569}</style></head><body><h1>Outpatient Treatment Plan</h1><p class="meta">Visit ${escape(token.tokenNumber)} · ${escape(token.visitDate || token.createdDate || '')}</p><p>Patient: ${escape(token.patientName)} · MRN ${escape(token.patientId)}</p><p>Physician: ${escape(token.doctorOrders?.orderedByDoctorName || token.doctorName || 'Treating doctor')}</p><h2>Plan and instructions</h2><p>${escape(plan)}</p><script>window.onload=()=>window.print()</script></body></html>`);
    printWindow.document.close();
  };

  const serviceRows = (token.lineItems || []).length
    ? token.lineItems || []
    : [
        ...(token.doctorOrders?.labRequests || []).map((order) => ({
          id: order.id, code: order.cptCode, name: order.testName, quantity: 1,
          insuranceStatus: 'Pending_Auth' as const, executionStatus: undefined,
        })),
        ...(token.doctorOrders?.radiologyRequests || []).map((order) => ({
          id: order.id, code: order.cptCode, name: order.studyName, quantity: 1,
          insuranceStatus: 'Pending_Auth' as const, executionStatus: undefined,
        })),
        ...(token.doctorOrders?.procedureRequests || []).map((order) => ({
          id: order.id, code: order.cptCode, name: order.procedureName, quantity: 1,
          insuranceStatus: 'Pending_Auth' as const, executionStatus: undefined,
        })),
      ].map((item) => {
        const approval = approvals.find((record) =>
          record.encounterTokenId === token.id &&
          (record.serviceCode === item.code || record.serviceName.toLowerCase() === item.name.toLowerCase())
        );
        const status = approval?.approvalStatus === 'Approved'
          ? 'Approved' as const
          : approval?.approvalStatus === 'Rejected'
            ? 'Denied' as const
            : 'Pending_Auth' as const;
        return { ...item, insuranceStatus: status };
      });

  return (
    <section className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h4 className="text-lg font-bold tracking-tight text-teal-900">{activeTab === 'clinical' ? 'Nurse clinical review' : activeTab === 'services' ? 'Doctor services & insurance status · read only' : activeTab === 'treatment' ? 'Outpatient treatment execution' : activeTab === 'discharge' ? 'Discharge & instructions' : activeTab === 'reports' ? 'Medical reports' : 'Insurance & ID documents'}</h4>
          <p className="mt-1 text-sm text-slate-600">Visit {token.tokenNumber} · Patient {token.patientName} · {token.department}</p>
          {activeTab === 'clinical' && <p className="mt-1 text-sm text-slate-500">Vitals are editable only during triage. Temperature is entered in °C and stored in the existing token format.</p>}
        </div>
        <span className="rounded-md bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600">Token ID: {token.id}</span>
      </div>

      <div className="space-y-6">
        {activeTab === 'clinical' && <form onSubmit={handleSave} className="space-y-5">
          <h5 className="text-base font-bold text-slate-800">Patient triage & vitals</h5>
          <label className="block text-sm font-semibold text-slate-700">
            Chief complaint
            <input disabled={!canEditVitals} value={chiefComplaint} onChange={(event) => setChiefComplaint(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal disabled:bg-slate-100" placeholder="Reason for today's visit" />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {[
              ['Systolic BP (mmHg)', systolic, setSystolic],
              ['Diastolic BP (mmHg)', diastolic, setDiastolic],
              ['Heart rate (bpm)', heartRate, setHeartRate],
              ['Temperature (°C)', temperatureC, setTemperatureC],
              ['Respiratory rate (/min)', respiratoryRate, setRespiratoryRate],
              ['Height (cm)', heightCm, setHeightCm],
              ['Weight (kg)', weightKg, setWeightKg],
              ['SpO₂ (%)', spO2, setSpO2],
            ].map(([label, value, setter]) => (
              <label key={label as string} className="text-sm font-semibold text-slate-700">
                {label as string}
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  disabled={!canEditVitals}
                  value={value as string}
                  onChange={(event) => (setter as React.Dispatch<React.SetStateAction<string>>)(event.target.value)}
                  className={`mt-1 w-full rounded-lg border px-3 py-2.5 text-sm font-normal text-slate-800 disabled:bg-slate-100 ${bpHigh && (label === 'Systolic BP (mmHg)' || label === 'Diastolic BP (mmHg)') ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-slate-300'}`}
                />
              </label>
            ))}
            <label className="text-sm font-semibold text-slate-700">
              Pain score (0–10)
              <input type="number" min="0" max="10" step="1" required disabled={!canEditVitals} value={painScore} onChange={(event) => setPainScore(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              BMI (kg/m²)
              <input readOnly value={bmi ? bmi.toFixed(2) : ''} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm" />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Triage level
              <select disabled={!canEditVitals} value={triageLevel} onChange={(event) => setTriageLevel(event.target.value as TokenVitalsRecord['triageLevel'])} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm disabled:bg-slate-100">
                {['Level 1 - Resuscitation', 'Level 2 - Emergent', 'Level 3 - Urgent', 'Level 4 - Less Urgent', 'Level 5 - Non-Urgent'].map((level) => <option key={level}>{level}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Triage / nursing notes
            <textarea rows={4} disabled={!canEditVitals} value={nursingNotes} onChange={(event) => setNursingNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm font-normal disabled:bg-slate-100" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Allergy review / updates
            <textarea rows={3} disabled={!canEditVitals} value={allergyUpdates} onChange={(event) => setAllergyUpdates(event.target.value)} placeholder="Record new allergy/reaction or confirm no changes" className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm font-normal disabled:bg-slate-100" />
          </label>
          {bpHigh && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">Elevated blood pressure reading — BP {systolic || '—'}/{diastolic || '—'} mmHg. Recheck and follow facility escalation protocol.</p>}
          {saveError && <p role="alert" className="text-sm font-semibold text-rose-700">{saveError}</p>}
          {saved && <p role="status" className="text-sm font-semibold text-emerald-700">Vitals saved to this visit token and dispatched to the doctor.</p>}
          {canEditVitals && <button type="submit" disabled={savingTriage} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"><Save className="h-4 w-4" /> {savingTriage ? 'Saving…' : 'Save & Dispatch'}</button>}
          {!canEditVitals && <p className="text-sm text-slate-500">{token.vitals ? `Vitals locked after triage dispatch · recorded ${new Date(token.vitals.recordedAt).toLocaleString()} by ${token.vitals.nurseName}.` : 'Call the patient into triage before entering vitals.'}</p>}
        </form>}

        <div className="space-y-4">
          {activeTab === 'services' && <section>
            <h5 className="mb-2 text-[10px] font-bold uppercase text-slate-700">Doctor services & insurance status · read only</h5>
            {serviceRows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px]">
                  <thead><tr className="border-b text-slate-500"><th className="py-1">CPT / code</th><th>Service</th><th>Qty</th><th>Insurance</th><th>Execution</th></tr></thead>
                  <tbody>{serviceRows.map((item) => <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-1 font-mono">{item.code || '—'}</td><td>{item.name}</td><td>{item.quantity}</td>
                    <td><span className={`rounded px-1.5 py-0.5 ${item.insuranceStatus === 'Approved' ? 'bg-emerald-50 text-emerald-800' : item.insuranceStatus === 'Denied' ? 'bg-rose-50 text-rose-800' : 'bg-blue-50 text-blue-800'}`}>{item.insuranceStatus.replaceAll('_', ' ')}</span></td>
                    <td>{item.executionStatus || 'Not started'}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            ) : <p className="text-[10px] text-slate-500">No services are linked to this visit token.</p>}
          </section>}

          {activeTab === 'clinical' && <section className="border-t border-slate-100 pt-3">
            <h5 className="mb-1 text-[10px] font-bold uppercase text-slate-700">Diagnosis & doctor notes · read only</h5>
            {token.doctorOrders?.diagnoses.length ? <ul className="mb-2 space-y-1 text-[10px]">{token.doctorOrders.diagnoses.map((diagnosis) => <li key={diagnosis.code}><span className="font-mono font-bold">{diagnosis.code}</span> · {diagnosis.description}</li>)}</ul> : <p className="text-[10px] text-slate-500">No diagnosis has been added.</p>}
            <div className="space-y-1 rounded bg-slate-50 p-2 text-[10px] text-slate-700">
              {token.doctorOrders?.chiefComplaint && <p><b>Chief complaint:</b> {token.doctorOrders.chiefComplaint}</p>}
              {token.doctorOrders?.soapNotes?.subjective && <p><b>Subjective:</b> {token.doctorOrders.soapNotes.subjective}</p>}
              {token.doctorOrders?.soapNotes?.objective && <p><b>Objective:</b> {token.doctorOrders.soapNotes.objective}</p>}
              {token.doctorOrders?.soapNotes?.assessment && <p><b>Assessment:</b> {token.doctorOrders.soapNotes.assessment}</p>}
              {token.doctorOrders?.soapNotes?.plan && <p><b>Plan:</b> {token.doctorOrders.soapNotes.plan}</p>}
              {!token.doctorOrders?.chiefComplaint && !token.doctorOrders?.soapNotes && !token.doctorOrders?.doctorNotes && <p>No consultation notes are available.</p>}
              {token.doctorOrders?.doctorNotes && <p><b>Doctor notes:</b> {token.doctorOrders.doctorNotes}</p>}
            </div>
            <p className="mt-2 text-[10px]"><b>Allergies:</b> {(token.patientDetails?.allergies || patient?.allergies || []).length ? (token.patientDetails?.allergies || patient?.allergies || []).map((allergy) => `${allergy.allergen} (${allergy.severity})`).join(', ') : 'None recorded'}</p>
            {token.vitals?.allergyUpdates && <p className="mt-1 rounded bg-amber-50 p-2 text-[10px]"><b>Nurse allergy update:</b> {token.vitals.allergyUpdates}</p>}
          </section>}

          {activeTab === 'treatment' && <section className="border-t border-slate-100 pt-3">
            <h5 className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase text-slate-700"><Syringe className="h-3 w-3" /> Outpatient treatment execution</h5>
            {(token.lineItems || []).filter((item) => ['Procedure', 'Service'].includes(item.kind)).length ? (
              <ul className="space-y-2">
                {(token.lineItems || []).filter((item) => ['Procedure', 'Service'].includes(item.kind)).map((item) => {
                  const cashSettled = token.billingSummary?.paymentStatus === 'SETTLED' &&
                    (item.insuranceStatus === 'Cash_Only' || item.paymentOverride?.mode === 'Self_Pay');
                  const eligible = isReadyForNurseTreatment(token, item);
                  const allowed = canExecuteOutpatientTreatment(token, item);
                  return (
                    <li key={item.id} className="rounded border border-slate-200 p-2 text-[10px]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">{item.code ? `${item.code} · ` : ''}{item.name}</span>
                        <span className={`rounded px-1.5 py-0.5 font-bold ${item.executionStatus === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800' : allowed ? 'bg-violet-50 text-violet-800' : 'bg-slate-100 text-slate-600'}`}>
                          {item.executionStatus === 'COMPLETED' ? 'COMPLETED' : cashSettled ? 'CASH_SETTLED' : item.insuranceStatus.replaceAll('_', ' ')}
                        </span>
                      </div>
                      {item.treatmentExecution && <p className="mt-1 text-slate-600">Completed {new Date(item.treatmentExecution.executedAt).toLocaleString()} · {item.treatmentExecution.executedByName || item.treatmentExecution.executedBy}{item.treatmentExecution.notes ? ` · ${item.treatmentExecution.notes}` : ''}</p>}
                      {item.executionStatus === 'COMPLETED' ? null : allowed ? (
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <input value={treatmentNotes[item.id] || ''} onChange={(event) => setTreatmentNotes((current) => ({ ...current, [item.id]: event.target.value }))} aria-label={`Execution note for ${item.name}`} placeholder="Optional treatment note" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5" />
                          <button type="button" disabled={!canEdit || executingLineItemId === item.id} onClick={() => void handleMarkExecuted(item)} className="rounded bg-teal-700 px-3 py-1.5 font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400">{executingLineItemId === item.id ? 'Saving…' : 'Mark executed'}</button>
                        </div>
                      ) : <p className="mt-1 text-slate-500">{eligible ? 'Set the token to Ready for Treatment before execution.' : 'Execution blocked until the service is approved or cash-settled and released for execution.'}</p>}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-[10px] text-slate-500">No outpatient nursing treatment services are ordered on this token.</p>}
            {treatmentMessage && <p role="status" className="mt-2 text-[10px] font-semibold text-teal-800">{treatmentMessage}</p>}
          </section>}

          {activeTab === 'discharge' && <section className="border-t border-slate-100 pt-3">
            <h5 className="mb-2 text-[10px] font-bold uppercase text-slate-700">Sick leave certificate · current visit</h5>
            {certificates.length ? certificates.map((certificate) => (
              <div key={certificate.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 p-2 text-[10px]">
                <span><b>{certificate.certificateNumber}</b> · {certificate.startDate} to {certificate.endDate} · {certificate.status}</span>
                <button type="button" onClick={() => printCertificate(certificate)} className="rounded border border-slate-300 px-2 py-1 font-bold text-slate-700 hover:bg-white">Print certificate</button>
              </div>
            )) : <p className="text-[10px] text-slate-500">No sick leave certificate is linked to this visit.</p>}
          </section>}

          {activeTab === 'discharge' && <section className="border-t border-slate-100 pt-3">
            <h5 className="mb-2 text-[10px] font-bold uppercase text-slate-700">Discharge & instructions</h5>
            <div className="rounded bg-slate-50 p-2 text-[10px] text-slate-700">
              <b>Doctor treatment plan:</b>
              <p className="mt-1 whitespace-pre-wrap">{token.doctorOrders?.soapNotes?.plan || token.doctorOrders?.doctorNotes || 'No doctor plan recorded for this visit.'}</p>
            </div>
            <button type="button" disabled={!token.doctorOrders?.soapNotes?.plan && !token.doctorOrders?.doctorNotes} onClick={printTreatmentPlan} className="mt-2 rounded border border-slate-300 px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Print doctor treatment plan</button>
            <label className="mt-2 block text-[9px] font-semibold text-slate-600">
              Nurse discharge instructions
              <textarea rows={3} disabled={!canEdit} value={dischargeNote} onChange={(event) => setDischargeNote(event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2 text-xs font-normal disabled:bg-slate-100" placeholder="Follow-up, medication reminders, and return precautions" />
            </label>
            {canEdit && <button type="button" onClick={handleSaveDischargeNote} className="mt-2 rounded bg-slate-800 px-3 py-2 text-[10px] font-bold text-white hover:bg-slate-700">Save discharge note</button>}
            {dischargeMessage && <p role="status" className="mt-2 text-[10px] font-semibold text-teal-800">{dischargeMessage}</p>}
            {(token.nursingNotes || []).filter((note) => note.noteType === 'Discharge').map((note) => (
              <div key={note.id} className="mt-2 rounded border border-slate-100 p-2 text-[10px]">
                <b>{new Date(note.recordedAt).toLocaleString()} · {note.nurseName}</b><p className="mt-1 whitespace-pre-wrap">{note.note}</p>
              </div>
            ))}
          </section>}
        </div>
      </div>
    </section>
  );
};
