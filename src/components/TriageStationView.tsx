import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Heart,
  Thermometer,
  Wind,
  Plus,
  Clock,
  CheckCircle2,
  PhoneCall,
  User,
  ShieldCheck,
  Stethoscope,
  Search,
  ReceiptText,
  FileText,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { ReceptionToken } from '../types';
import { TriageAssessmentForm } from './TriageAssessmentForm';
import { TokenWorkflowModal } from './tokens/TokenWorkflowModal';

interface TriageStationViewProps {
  onSelectPatient: (id: string) => void;
}

export const TriageStationView: React.FC<TriageStationViewProps> = ({ onSelectPatient }) => {
  const {
    patients,
    receptionTokens,
    insuranceApprovals,
    invoices,
    setActiveTab,
    updatePatientStatus,
    addNotification,
    currentRole,
    currentUser,
  } = useHospital();
  const [selectedPatientForForm, setSelectedPatientForForm] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [visitSearch, setVisitSearch] = useState('');
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [workflowTokenId, setWorkflowTokenId] = useState<string | null>(null);
  const [doctorFilter, setDoctorFilter] = useState('all');

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

  const level1Count = patients.filter((p) => p.latestTriage?.urgencyLevel.includes('Level 1')).length;
  const level2Count = patients.filter((p) => p.latestTriage?.urgencyLevel.includes('Level 2')).length;
  const emergencyCount = patients.filter((p) => p.status === 'Emergency').length;
  const normalizeDoctorName = (name: string) =>
    name.toLowerCase().replace(/^dr\.?\s*/, '').replace(/,?\s*(md|facs|do|phd)\b/g, '').replace(/[.,]/g, '').trim();
  const doctorOptions = [...new Set(receptionTokens.map((token) => token.doctorName).filter((name): name is string => Boolean(name)))].sort();
  const registeredVisitTokens = receptionTokens
    .filter((token) => token.patientId !== 'WALK-IN' && token.patientId)
    .filter((token) => currentRole !== 'doctor' ||
      token.doctorId === currentUser.id ||
      normalizeDoctorName(token.doctorName || '') === normalizeDoctorName(currentUser.name))
    .filter((token) => doctorFilter === 'all' || token.doctorName === doctorFilter)
    .filter((token) => {
      const query = visitSearch.trim().toLowerCase();
      return !query || `${token.tokenNumber} ${token.patientName} ${token.patientId} ${token.department} ${token.doctorName || ''}`.toLowerCase().includes(query);
    })
    .sort((first, second) =>
      (second.visitDate || second.createdDate || '').localeCompare(first.visitDate || first.createdDate || '') ||
      second.createdTime.localeCompare(first.createdTime)
    );
  const workflowToken = receptionTokens.find((token) => token.id === workflowTokenId) || null;

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

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Triage Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <h2 className="text-base font-bold text-white tracking-wide">
              Emergency Intake & Nurse Triage Desk
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 font-bold uppercase">
              ESI PROTOCOL ACTIVE
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl">
            Real-time physiological stratification, continuous vitals telemetry tracking, and immediate clinical disposition.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700 font-mono text-xs">
            <span className="text-slate-400">STAT Acuity:</span>
            <span className="text-rose-400 font-bold">{level1Count + level2Count} Critical</span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-400 font-bold">{emergencyCount} in ER</span>
          </div>
          <button
            onClick={() => setSelectedPatientForForm(patients[0]?.id || '')}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Assessment</span>
          </button>
        </div>
      </div>

      {selectedPatientForForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xl p-5 mb-4 animate-in fade-in">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-600" />
              <h3 className="font-bold text-sm text-slate-800">Record Triage Assessment</h3>
            </div>
            <button
              onClick={() => setSelectedPatientForForm(null)}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
            >
              Close Form ✕
            </button>
          </div>
          <TriageAssessmentForm
            initialPatientId={selectedPatientForForm}
            onAssessmentCompleted={() => setSelectedPatientForForm(null)}
            onCancel={() => setSelectedPatientForForm(null)}
          />
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Registered patient visit EMR</h3>
            <p className="mt-1 text-[11px] text-slate-500">Open the registration token to record vitals and review visit services, reports, insurance approvals, and invoice status.</p>
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
            <select
              value={doctorFilter}
              onChange={(event) => setDoctorFilter(event.target.value)}
              aria-label="Filter registered visits by doctor"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:w-56"
            >
              <option value="all">All doctors</option>
              {doctorOptions.map((doctorName) => <option key={doctorName} value={doctorName}>{doctorName}</option>)}
            </select>
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
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${token.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : token.status === 'Cancelled' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{token.status}</span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-600">{tokenDate} · {token.department} · {token.doctorName || 'Doctor not assigned'} · {token.insuranceProvider || token.paymentScheme?.insuranceProvider || 'Self-Pay'}</p>
                      <p className="mt-1 text-[10px] text-slate-500">Vitals: {vitals ? `BP ${vitals.bpSystolic}/${vitals.bpDiastolic}, HR ${vitals.heartRate}, SpO₂ ${vitals.spO2}%` : 'Not entered'} · Invoice: {visitInvoice ? `${visitInvoice.id} · ${visitInvoice.status} · $${Number(visitInvoice.balanceDue).toFixed(2)} due` : 'Not issued'}</p>
                    </button>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => setExpandedVisitId(isExpanded ? null : token.id)} className="rounded-md border border-slate-300 px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50">
                        {isExpanded ? 'Hide visit details' : 'View visit details'}
                      </button>
                      <button type="button" onClick={() => setWorkflowTokenId(token.id)} className="rounded-md bg-teal-700 px-3 py-2 text-[10px] font-bold text-white hover:bg-teal-800">
                        {vitals ? 'Review / update vitals' : 'Enter vitals'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 lg:grid-cols-2">
                      <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-700"><User className="h-3.5 w-3.5" /> Registration & insurance details</h4>
                        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
                          <div><dt className="text-slate-500">Department / visit</dt><dd className="font-semibold text-slate-800">{token.department} · {token.visitPurpose || token.visitType || 'Visit'}</dd></div>
                          <div><dt className="text-slate-500">Assigned doctor</dt><dd className="font-semibold text-slate-800">{token.doctorName || 'Not assigned'}</dd></div>
                          <div><dt className="text-slate-500">Phone · DOB · gender</dt><dd className="font-semibold text-slate-800">{token.patientPhone || patient?.phone || '—'} · {token.patientDetails?.dateOfBirth || patient?.dob || '—'} · {token.patientGender || patient?.gender || '—'}</dd></div>
                          <div><dt className="text-slate-500">National ID · passport</dt><dd className="font-semibold text-slate-800">{token.patientDetails?.nationalId || patient?.emiratesId || '—'} · {token.patientDetails?.passportNumber || patient?.passportNo || '—'}</dd></div>
                          <div><dt className="text-slate-500">Email</dt><dd className="break-all font-semibold text-slate-800">{token.patientDetails?.email || patient?.email || '—'}</dd></div>
                          <div><dt className="text-slate-500">Insurance / payment</dt><dd className="font-semibold text-slate-800">{token.insuranceProvider || token.paymentScheme?.insuranceProvider || 'Self-Pay'} · {token.payMode || token.paymentScheme?.schemeType}</dd></div>
                          <div><dt className="text-slate-500">Policy · member</dt><dd className="font-semibold text-slate-800">{token.patientDetails?.insurancePolicyNumber || token.paymentScheme?.policyNumber || '—'} · {token.patientDetails?.insuranceMemberId || '—'}</dd></div>
                          <div><dt className="text-slate-500">Insurance status · expiry</dt><dd className="font-semibold text-slate-800">{token.patientDetails?.insuranceStatus || '—'} · {token.patientDetails?.insuranceExpiryDate || '—'}</dd></div>
                          {token.patientDetails?.insuranceCards?.map((card) => (
                            <div key={`${card.policyNumber}-${card.cardNumber}`} className="col-span-2 rounded bg-white px-2 py-1.5">
                              <dt className="text-slate-500">{card.payerName} · {card.plan}</dt>
                              <dd className="font-semibold text-slate-800">Policy {card.policyNumber} · Card {card.cardNumber} · Expires {card.expiryDate}</dd>
                            </div>
                          ))}
                          <div className="col-span-2"><dt className="text-slate-500">Address</dt><dd className="font-semibold text-slate-800">{token.patientDetails?.address || patient?.address || '—'}</dd></div>
                        </dl>
                      </section>

                      <section className="rounded-lg border border-slate-200 p-3">
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
                      </section>

                      <section className="rounded-lg border border-slate-200 p-3">
                        <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-700"><ShieldCheck className="h-3.5 w-3.5" /> Insurance approvals · current visit</h4>
                        {approvals.current.length ? <ul className="space-y-1.5">{approvals.current.map((approval) => <li key={approval.id} className="flex flex-wrap justify-between gap-x-3 text-[10px]"><span className="font-semibold text-slate-800">{approval.serviceName} · {approval.approvalNumber}</span><span>{approval.approvalDate} · {approval.approvalStatus}</span></li>)}</ul> : <p className="text-[10px] text-slate-500">No approval recorded for this visit date.</p>}
                        <h5 className="mb-1 mt-3 text-[9px] font-bold uppercase text-slate-500">Past approvals</h5>
                        {approvals.past.length ? <ul className="max-h-36 space-y-1 overflow-y-auto">{approvals.past.map((approval) => <li key={approval.id} className="flex flex-wrap justify-between gap-x-3 text-[10px] text-slate-600"><span>{approval.serviceName} · {approval.approvalNumber}</span><span>{approval.approvalDate} · {approval.approvalStatus}</span></li>)}</ul> : <p className="text-[10px] text-slate-500">No past approvals on file.</p>}
                      </section>

                      <section className="rounded-lg border border-slate-200 p-3">
                        <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-700"><ReceiptText className="h-3.5 w-3.5" /> Invoice status</h4>
                        {visitInvoices.length ? <ul className="max-h-36 space-y-1.5 overflow-y-auto">{visitInvoices.map((invoice) => <li key={invoice.id} className="flex flex-wrap justify-between gap-x-3 text-[10px]"><span className="font-semibold text-slate-800">{invoice.id} · {invoice.encounterTokenId === token.id || invoice.issueDate === tokenDate ? 'Current visit' : invoice.issueDate}</span><span className="font-semibold text-slate-700">{invoice.status} · ${Number(invoice.balanceDue).toFixed(2)} due</span></li>)}</ul> : <p className="text-[10px] text-slate-500">No invoice has been issued for this patient.</p>}
                        <div className="mt-3 border-t border-slate-100 pt-2">
                          <h5 className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase text-slate-500"><FileText className="h-3 w-3" /> Diagnostic reports</h5>
                          {token.diagnosticReports?.map((report) => <p key={report.id} className="text-[10px] text-slate-700">{report.date} · {report.testOrStudyName} · {report.status}</p>)}
                          {(patient?.labResults || []).map((report) => <p key={report.id} className="text-[10px] text-slate-700">{report.resultDate || report.orderedDate} · {report.testName} · {report.status}{report.impression ? ` · ${report.impression}` : ''}</p>)}
                          {!token.diagnosticReports?.length && !patient?.labResults?.length && <p className="text-[10px] text-slate-500">No diagnostic reports on file.</p>}
                        </div>
                      </section>

                      <section className="rounded-lg border border-slate-200 p-3 lg:col-span-2">
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
                      </section>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <TokenWorkflowModal
        token={workflowToken}
        isOpen={Boolean(workflowToken)}
        initialStage="2_NURSING_VITALS"
        onClose={() => setWorkflowTokenId(null)}
      />

      {/* Main Triage Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Active Triage Queue ({filteredPatients.length})
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
                    No patients matching the selected triage filter. Click "+ New Assessment" to log intake.
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
