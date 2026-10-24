import React, { useState } from 'react';
import {
  Search,
  User,
  Activity,
  ReceiptText,
  Calendar,
  FileText,
  Clock,
  Printer,
  ChevronRight,
  Stethoscope,
  ShieldCheck,
  CreditCard,
  Building,
  Pill,
  FolderOpen,
  Ticket,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { Patient } from '../types';
import { ReprintInvoiceModal } from './billing/ReprintInvoiceModal';

export const PatientEnquiryView: React.FC = () => {
  const { patients, appointments, invoices, receptionTokens, currentUser, setActiveTab, setSelectedPatientId } = useHospital();
  const [searchQuery, setSearchQuery] = useState('');
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'visit' | 'appointment' | 'invoice' | 'lab' | 'prescription'>('all');
  const [detailTab, setDetailTab] = useState<'clinical' | 'reports' | 'erx' | 'invoice' | 'lab'>('clinical');
  const [selectedPatientIdInternal, setSelectedPatientIdInternal] = useState<string>(
    patients[0]?.id || ''
  );
  const [invoiceToPrintId, setInvoiceToPrintId] = useState<string | undefined>(undefined);

  const selectedPatient =
    patients.find((p) => p.id === selectedPatientIdInternal) || patients[0];

  const matchingPatients = searchQuery.trim()
    ? patients.filter(
        (p) =>
          p.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.phone.includes(searchQuery) ||
          p.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : patients;

  const patientAppointments = appointments.filter((a) => a.patientId === selectedPatient?.id);
  const patientInvoices = invoices.filter((i) => i.patientId === selectedPatient?.id);
  const patientTokens = receptionTokens
    .filter((token) => token.patientId === selectedPatient?.id)
    .sort((first, second) =>
      `${second.visitDate || second.createdDate || ''} ${second.createdTime}`.localeCompare(
        `${first.visitDate || first.createdDate || ''} ${first.createdTime}`
      )
    );
  const latestToken = patientTokens[0] || null;
  const visitEntries = [
    ...(selectedPatient?.facilityVisits || []).map((visit) => ({
      date: visit.visitDate,
      title: visit.visitType,
      detail: visit.chiefComplaint,
      meta: `${visit.doctorName} • ${visit.department}`,
      kind: 'Visit' as const,
    })),
    ...patientTokens.map((token) => ({
      date: token.visitDate || token.createdDate || '',
      title: `Token ${token.tokenNumber} · ${token.registrationSource || 'Visit'} · ${token.status}`,
      detail: token.visitPurpose || token.visitComplaint || token.patientVisitSummary || 'Patient encounter',
      meta: `${token.doctorName || 'Clinician not assigned'} • ${token.department} • ${token.createdTime}`,
      kind: 'Visit' as const,
    })),
  ].sort((first, second) => second.date.localeCompare(first.date));

  const appointmentEntries = patientAppointments.map((apt) => ({
    date: apt.date,
    title: apt.type || 'Appointment',
    detail: apt.reason || 'Follow-up visit',
    meta: `${apt.doctorName} • ${apt.status} • ${apt.timeSlot}`,
    kind: 'Appointment' as const,
  }));

  const invoiceEntries = patientInvoices.map((inv) => ({
    date: inv.issueDate,
    title: 'Invoice',
    detail: `${inv.id} • ${inv.items.length} services`,
    meta: `Balance due $${(Number(inv.balanceDue) || 0).toFixed(2)}`,
    kind: 'Invoice' as const,
  }));

  const labEntries = (selectedPatient?.labResults || []).map((lab) => ({
    date: lab.resultDate || lab.orderedDate,
    title: 'Lab Report',
    detail: `${lab.testName} • ${lab.value}`,
    meta: `${lab.status} • ${lab.orderedBy}`,
    kind: 'Lab' as const,
  }));

  const prescriptionEntries = ((selectedPatient?.prescriptions || []) as any[]).map((rx) => ({
    date: rx.startDate || new Date().toISOString().split('T')[0],
    title: 'eRx / Prescription',
    detail: `${rx.name || rx.medicationName} • ${rx.dosage || ''}`.trim(),
    meta: `${rx.prescribedBy || 'Doctor'} • ${rx.status || 'Active'}`,
    kind: 'Prescription' as const,
  }));

  const activityGroups = {
    visit: visitEntries,
    appointment: appointmentEntries,
    invoice: invoiceEntries,
    lab: labEntries,
    prescription: prescriptionEntries,
  };

  const patientVisitTimeline = [
    ...visitEntries,
    ...appointmentEntries,
    ...invoiceEntries,
    ...labEntries,
    ...prescriptionEntries,
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalBilled = patientInvoices.reduce(
    (sum, inv) => sum + (Number(inv.totalAmount ?? inv.subtotal) || 0),
    0
  );
  const totalPaid = patientInvoices.reduce(
    (sum, inv) => sum + (Number(inv.amountPaid) || 0),
    0
  );
  const totalOutstanding = patientInvoices.reduce(
    (sum, inv) => sum + (Number(inv.balanceDue) || 0),
    0
  );

  const latestInvoice = [...patientInvoices].sort((a, b) => {
    const aTime = new Date(a.createdAt || `${a.issueDate}T${a.invoiceTime || '00:00:00'}`).getTime();
    const bTime = new Date(b.createdAt || `${b.issueDate}T${b.invoiceTime || '00:00:00'}`).getTime();
    return bTime - aTime;
  })[0] ?? null;

  const formatDateTime = (value?: string) => {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const patientFullName = [selectedPatient?.title, selectedPatient?.firstName, selectedPatient?.middleName, selectedPatient?.lastName]
    .filter(Boolean)
    .join(' ');

  const medicalReports = [
    ...(selectedPatient?.facilityVisits || []).map((visit) => ({
      id: visit.id,
      date: visit.visitDate,
      doctorName: visit.doctorName,
      department: visit.department,
      category: 'Doctor Visit Report',
      title: visit.visitType,
      summary: visit.chiefComplaint,
      details: visit.clinicalAssessment,
      diagnosis: visit.primaryDiagnosis?.description || 'No diagnosis recorded',
      procedure: visit.diagnosticOrders?.join(', ') || 'No procedure documented',
    })),
    ...(selectedPatient?.clinicalNotes || []).map((note) => ({
      id: note.id,
      date: note.date,
      doctorName: note.doctorName || note.authorName || 'Doctor',
      department: note.authorRole || 'Clinic',
      category: 'Clinical Note',
      title: note.category || 'Clinical Summary',
      summary: note.chiefComplaint || note.content || 'Clinical note',
      details: note.assessment || note.content || 'No assessment details',
      diagnosis: note.diagnoses?.join(', ') || 'No diagnosis recorded',
      procedure: note.treatmentPlan || 'No procedure documented',
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const insuranceCardNo = selectedPatient?.insuranceList?.[0]?.cardNumber || selectedPatient?.insurance?.policyNumber || 'N/A';
  const policyName = selectedPatient?.insurance?.provider || selectedPatient?.insuranceList?.[0]?.payerName || 'N/A';

  const handlePrintLabReport = (lab: any) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      window.print();
      return;
    }

    const content = `
      <html>
        <head>
          <title>${lab.testName} - ${selectedPatient?.firstName || 'Patient'} ${selectedPatient?.lastName || ''}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
            .header { border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 20px; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; font-size: 13px; }
            .box { border: 1px solid #d1d5db; border-radius: 10px; padding: 12px; margin-bottom: 16px; }
            .label { font-weight: bold; color: #374151; text-transform: uppercase; font-size: 10px; }
            .value { margin-top: 4px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            td, th { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0; font-size: 24px;">${selectedPatient?.firstName || 'Patient'} ${selectedPatient?.lastName || ''}</h2>
            <div style="font-size: 12px; color: #4b5563; margin-top: 4px;">MRN: ${selectedPatient?.id || 'N/A'} • ${selectedPatient?.gender || 'N/A'} • ${selectedPatient?.age || 'N/A'} years</div>
          </div>
          <div class="meta">
            <div class="box">
              <div class="label">Test</div>
              <div class="value">${lab.testName}</div>
            </div>
            <div class="box">
              <div class="label">Date</div>
              <div class="value">${lab.resultDate || lab.orderedDate}</div>
            </div>
          </div>
          <div class="box">
            <div class="label">Clinical Notes</div>
            <div class="value">${lab.notes || 'No additional notes'}</div>
          </div>
          <table>
            <tr><th>Category</th><td>${lab.category || 'Laboratory'}</td></tr>
            <tr><th>Status</th><td>${lab.status || 'Completed'}</td></tr>
            <tr><th>Result</th><td>${lab.value || 'Not available'}</td></tr>
            <tr><th>Reference Range</th><td>${lab.referenceRange || 'N/A'}</td></tr>
            <tr><th>Ordered By</th><td>${lab.orderedBy || 'Doctor'}</td></tr>
            <tr><th>Findings</th><td>${lab.findings || 'No findings recorded'}</td></tr>
            <tr><th>Impression</th><td>${lab.impression || 'No impression recorded'}</td></tr>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 350);
  };

  const detailTabs: Array<{ id: 'clinical' | 'reports' | 'erx' | 'invoice' | 'lab'; label: string; icon: React.ReactNode }> = [
    { id: 'clinical', label: 'Clinical History', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'reports', label: 'Medical Reports', icon: <FolderOpen className="w-3.5 h-3.5" /> },
    { id: 'erx', label: 'eRx / Prescriptions', icon: <Pill className="w-3.5 h-3.5" /> },
    { id: 'lab', label: 'Lab / Radiology', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'invoice', label: 'Invoices', icon: <ReceiptText className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Search className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Patient Facility Enquiry & Master Profile
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold uppercase">
              RECORDS DESK
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Single-pane inspection for patient admission logs, EMR chart diagnoses, assigned physician rounds, diagnostic reports, and itemized billing ledger.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Patient Summary</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Col: Patient Search Directory */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col max-h-[750px]">
          <div className="mb-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search MRN, Name, Phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-900"
              />
            </div>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100 flex-1 space-y-1">
            {matchingPatients.map((p) => {
              const isSelected = p.id === selectedPatient?.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPatientIdInternal(p.id)}
                  className={`p-2.5 rounded-lg cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-50 border border-blue-200 text-blue-900'
                      : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs truncate flex items-center gap-1.5">
                      <span>{p.firstName} {p.lastName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({p.id})</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {p.age}y · {p.gender} · {p.phone}
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      p.status === 'Emergency'
                        ? 'bg-rose-100 text-rose-700'
                        : p.status === 'Inpatient'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Comprehensive Patient Details Dossier */}
        {selectedPatient ? (
          <div className="lg:col-span-8 space-y-4">
            {/* Header Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center font-mono">
                    {selectedPatient.bloodGroup}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>{patientFullName || `${selectedPatient.firstName} ${selectedPatient.lastName}`}</span>
                      <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                        {selectedPatient.id}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      DOB: {selectedPatient.dob || `${selectedPatient.age} years old`} · {selectedPatient.gender} · Phone: {selectedPatient.phone}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedPatientId(selectedPatient.id);
                      setActiveTab('patients');
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open Clinical EMR</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Vitals Summary Strip */}
              {(() => {
                const vitalsList = selectedPatient.vitals as any;
                const latest = Array.isArray(vitalsList) ? vitalsList[vitalsList.length - 1] || vitalsList[0] : vitalsList;
                const bp = latest?.bloodPressureSys && latest?.bloodPressureDia
                  ? `${latest.bloodPressureSys}/${latest.bloodPressureDia}`
                  : latest?.bloodPressure || '120/80';
                const hr = latest?.heartRate ?? 72;
                const spo2 = latest?.spO2 ?? latest?.oxygenSaturation ?? 98;

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
                    <div className="p-2 bg-slate-50 rounded border border-slate-100 text-xs">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Blood Pressure</span>
                      <span className="font-bold text-slate-800 font-mono text-sm">
                        {bp}
                      </span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-100 text-xs">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Heart Rate</span>
                      <span className="font-bold text-slate-800 font-mono text-sm">
                        {hr} bpm
                      </span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-100 text-xs">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">SpO2 Oxygen</span>
                      <span className="font-bold text-slate-800 font-mono text-sm">
                        {spo2}%
                      </span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-100 text-xs">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Attending Doctor</span>
                      <span className="font-bold text-slate-800 truncate block">
                        {selectedPatient.primaryPhysicianName}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Medical History & Diagnoses */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Documented Clinical History & Chronic Conditions</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Known Drug Allergies
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(selectedPatient.allergies || []).length > 0 ? (
                      (selectedPatient.allergies || []).map((a, idx) => {
                        const label = typeof a === 'string' ? a : `${a.allergen}${a.severity ? ` (${a.severity})` : ''}`;
                        const key = typeof a === 'string' ? `${a}-${idx}` : `${a.allergen}-${idx}`;
                        return (
                          <span
                            key={key}
                            className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[11px]"
                          >
                            {label}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-slate-400">No known allergies (NKDA)</span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Chronic Pathologies
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(selectedPatient.chronicConditions || []).length > 0 ? (
                      (selectedPatient.chronicConditions || []).map((c, idx) => (
                        <span
                          key={`${c}-${idx}`}
                          className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[11px]"
                        >
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400">No chronic conditions logged</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Patient Activity Timeline
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold uppercase text-slate-500">Type</label>
                  <select
                    value={recordTypeFilter}
                    onChange={(event) => setRecordTypeFilter(event.target.value as typeof recordTypeFilter)}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white text-slate-700 focus:ring-2 focus:ring-indigo-200 outline-none"
                  >
                    <option value="all">All records</option>
                    <option value="visit">Visits</option>
                    <option value="appointment">Appointments</option>
                    <option value="invoice">Invoices</option>
                    <option value="lab">Lab reports</option>
                    <option value="prescription">Prescriptions</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {detailTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDetailTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                      detailTab === tab.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              {detailTab === 'clinical' && (
                <div className="space-y-3 pt-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      Registration & Invoice Audit
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-700">
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Registration User</span>
                        <span className="font-bold text-slate-800">{currentUser?.name || 'System'}</span>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Registration Date & Time</span>
                        <span className="font-bold text-slate-800">{formatDateTime(selectedPatient?.createdAt)}</span>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Invoice User</span>
                        <span className="font-bold text-slate-800">{currentUser?.name || 'System'}</span>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                        <span className="block text-[10px] uppercase font-bold text-slate-400">Invoice Date & Time</span>
                        <span className="font-bold text-slate-800">{latestInvoice ? formatDateTime(latestInvoice.createdAt || `${latestInvoice.issueDate}T${latestInvoice.invoiceTime || '00:00:00'}`) : 'No invoice recorded'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">Token Visit History</h5>
                      <span className="text-[10px] font-bold text-indigo-700">{patientTokens.length} visits</span>
                    </div>
                    {patientTokens.length === 0 ? (
                      <p className="text-xs text-slate-500">No token visits recorded for this patient.</p>
                    ) : (
                      <div className="space-y-2">
                        {patientTokens.map((token) => {
                          const tokenNotes = (selectedPatient?.clinicalNotes || []).filter((note) => note.encounterTokenId === token.id);
                          const tokenServices = (selectedPatient?.services || []).filter((service) => service.encounterTokenId === token.id);
                          const tokenLabs = (selectedPatient?.labResults || []).filter((lab) => lab.encounterTokenId === token.id);
                          const tokenPrescriptions = (selectedPatient?.prescriptions || []).filter((rx) => rx.encounterTokenId === token.id);
                          const tokenInvoices = patientInvoices.filter(
                            (invoice) => invoice.encounterTokenId === token.id || invoice.id === token.billingSummary?.invoiceId
                          );
                          const visitDate = token.visitDate || token.createdDate || 'Date not recorded';

                          return (
                            <details key={token.id} className="rounded-lg border border-indigo-200 bg-white">
                              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-3">
                                <span className="font-bold text-[11px] text-slate-800">
                                  Token {token.tokenNumber} · {token.visitCode || token.visitType || token.serviceType}
                                </span>
                                <span className="text-[10px] text-slate-600">{visitDate} · {token.status}</span>
                              </summary>
                              <div className="space-y-3 border-t border-slate-100 p-3 text-[11px] text-slate-700">
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <div><span className="font-bold">Purpose / complaint:</span> {token.visitPurpose || token.visitComplaint || token.patientVisitSummary || token.doctorOrders?.chiefComplaint || 'Not recorded'}</div>
                                  <div><span className="font-bold">Department / doctor:</span> {token.department} · {token.doctorName || token.doctorOrders?.orderedByDoctorName || 'Not assigned'}</div>
                                  <div><span className="font-bold">Registered:</span> {token.createdTime} · {token.registeredBy || 'User not recorded'}</div>
                                  <div><span className="font-bold">Workflow:</span> {token.currentStage?.replace(/^\d_/, '').replaceAll('_', ' ') || token.status} · {token.counterOrRoom}</div>
                                </div>

                                {token.vitals && (
                                  <section className="rounded-lg bg-emerald-50 p-2.5">
                                    <h6 className="mb-1 font-bold text-emerald-800">Nursing notes & vitals · {token.vitals.nurseName}</h6>
                                    <p>
                                      BP {token.vitals.bpSystolic}/{token.vitals.bpDiastolic} · HR {token.vitals.heartRate} · SpO₂ {token.vitals.spO2}% · Temp {token.vitals.temperature}° · RR {token.vitals.respiratoryRate}
                                      {token.vitals.bloodGlucose !== undefined ? ` · Glucose ${token.vitals.bloodGlucose}` : ''}
                                      {token.vitals.painScale !== undefined ? ` · Pain ${token.vitals.painScale}/10` : ''}
                                      {' · '}{token.vitals.triageLevel}
                                    </p>
                                    {token.vitals.nursingNotes && <p className="mt-1 whitespace-pre-wrap">{token.vitals.nursingNotes}</p>}
                                  </section>
                                )}

                                {token.doctorOrders && (
                                  <section className="rounded-lg bg-blue-50 p-2.5">
                                    <h6 className="mb-1 font-bold text-blue-800">Doctor consultation · {token.doctorOrders.orderedByDoctorName} · {token.doctorOrders.orderedAt}</h6>
                                    {token.doctorOrders.healthSummary && <p><span className="font-semibold">Summary:</span> {token.doctorOrders.healthSummary}</p>}
                                    {token.doctorOrders.clinicalAssessment && <p><span className="font-semibold">Assessment:</span> {token.doctorOrders.clinicalAssessment}</p>}
                                    {token.doctorOrders.doctorNotes && <p className="whitespace-pre-wrap"><span className="font-semibold">Doctor notes:</span> {token.doctorOrders.doctorNotes}</p>}
                                    <p className="mt-1 font-semibold">Diagnoses</p>
                                    {token.doctorOrders.diagnoses.length ? (
                                      <ul className="list-inside list-disc">{token.doctorOrders.diagnoses.map((diagnosis, index) => <li key={`${diagnosis.code}-${index}`}>{diagnosis.code} · {diagnosis.description}{diagnosis.notes ? ` — ${diagnosis.notes}` : ''}</li>)}</ul>
                                    ) : <p>No diagnoses recorded.</p>}
                                    {token.doctorOrders.labRequests.length > 0 && <p className="mt-1"><span className="font-semibold">Lab orders:</span> {token.doctorOrders.labRequests.map((order) => `${order.testName} (${order.status})`).join(', ')}</p>}
                                    {token.doctorOrders.radiologyRequests.length > 0 && <p><span className="font-semibold">Radiology orders:</span> {token.doctorOrders.radiologyRequests.map((order) => `${order.studyName} (${order.status})`).join(', ')}</p>}
                                    {token.doctorOrders.procedureRequests.length > 0 && <p><span className="font-semibold">Procedures:</span> {token.doctorOrders.procedureRequests.map((order) => `${order.procedureName} (${order.status})`).join(', ')}</p>}
                                  </section>
                                )}

                                {tokenNotes.length > 0 && (
                                  <section className="rounded-lg bg-slate-50 p-2.5">
                                    <h6 className="mb-1 font-bold text-slate-800">Medical notes & reports</h6>
                                    {tokenNotes.map((note) => <div key={note.id} className="mb-2 last:mb-0">
                                      <p className="font-semibold">{note.category || 'Clinical note'} · {note.date} · {note.authorName || note.doctorName || 'Clinician'}</p>
                                      {note.chiefComplaint && <p>Complaint: {note.chiefComplaint}</p>}
                                      {(note.content || note.assessment) && <p className="whitespace-pre-wrap">Assessment: {note.content || note.assessment}</p>}
                                      {note.diagnoses?.length ? <p>Diagnoses: {note.diagnoses.join(', ')}</p> : null}
                                      {note.treatmentPlan && <p className="whitespace-pre-wrap">Plan: {note.treatmentPlan}</p>}
                                    </div>)}
                                  </section>
                                )}

                                {(token.diagnosticReports?.length || tokenLabs.length) ? (
                                  <section className="rounded-lg bg-violet-50 p-2.5">
                                    <h6 className="mb-1 font-bold text-violet-800">Laboratory & radiology reports</h6>
                                    {(token.diagnosticReports || []).map((report) => (
                                      <div key={report.id} className="mb-2 last:mb-0">
                                        <p className="font-semibold">{report.department} · {report.testOrStudyName} · {report.status} · {report.date} {report.time || ''}</p>
                                        {report.findings && <p className="whitespace-pre-wrap">Findings: {report.findings}</p>}
                                        {report.impression && <p>Impression: {report.impression}</p>}
                                        {report.resultValue && <p>Result: {report.resultValue}{report.referenceRange ? ` (Reference: ${report.referenceRange})` : ''}</p>}
                                        <p>Reported by {report.technicianOrRadiologist}</p>
                                      </div>
                                    ))}
                                    {tokenLabs.map((lab) => (
                                      <div key={lab.id} className="mb-2 last:mb-0">
                                        <p className="font-semibold">{lab.department || lab.category} · {lab.testName} · {lab.status} · {lab.resultDate || lab.orderedDate}</p>
                                        <p>Result: {lab.value}{lab.referenceRange ? ` (Reference: ${lab.referenceRange})` : ''}</p>
                                        {lab.findings && <p>Findings: {lab.findings}</p>}
                                        {lab.impression && <p>Impression: {lab.impression}</p>}
                                      </div>
                                    ))}
                                  </section>
                                ) : null}

                                {(tokenServices.length > 0 || tokenInvoices.length > 0 || token.billingSummary) && (
                                  <section className="rounded-lg bg-amber-50 p-2.5">
                                    <h6 className="mb-1 font-bold text-amber-800">Services & billing</h6>
                                    {tokenServices.map((service) => <p key={service.id}>{service.name} · {service.category} · AED {Number(service.estimatedCost).toFixed(2)} · added by {service.addedBy}</p>)}
                                    {tokenInvoices.map((invoice) => <div key={invoice.id}>
                                      <p className="font-semibold">Invoice {invoice.id} · {invoice.status} · AED {Number(invoice.totalAmount ?? invoice.subtotal ?? 0).toFixed(2)}</p>
                                      <p>{invoice.items.map((item) => `${item.description} × ${item.quantity}`).join(', ') || 'No invoice items'}</p>
                                    </div>)}
                                    {token.billingSummary && <p className="mt-1">Payment: {token.billingSummary.paymentStatus} · {token.billingSummary.paymentMethod} · Paid AED {Number(token.billingSummary.totalPaid).toFixed(2)} · Balance AED {Number(token.billingSummary.balanceDue).toFixed(2)} · Cashier {token.billingSummary.cashierName}</p>}
                                  </section>
                                )}

                                {tokenPrescriptions.length > 0 && (
                                  <section className="rounded-lg bg-cyan-50 p-2.5">
                                    <h6 className="mb-1 font-bold text-cyan-800">Prescriptions</h6>
                                    {tokenPrescriptions.map((rx) => <p key={rx.id}>{rx.name} · {rx.dosage} · {rx.frequency} · {rx.route}{rx.duration ? ` · ${rx.duration}` : ''}{rx.instructions ? ` · ${rx.instructions}` : ''} · {rx.status} · prescribed by {rx.prescribedBy}</p>)}
                                  </section>
                                )}

                                {token.historyLogs && token.historyLogs.length > 0 && (
                                  <section className="rounded-lg bg-slate-50 p-2.5">
                                    <h6 className="mb-1 font-bold text-slate-800">Visit activity</h6>
                                    <ul className="space-y-1">{token.historyLogs.map((log, index) => <li key={`${log.timestamp}-${index}`}>{log.timestamp} · {log.stage.replace(/^\d_/, '').replaceAll('_', ' ')} · {log.action} · {log.actor}</li>)}</ul>
                                  </section>
                                )}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-700">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      Patient Identity & Demographics
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-700">
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5"><span className="block text-[10px] uppercase font-bold text-slate-400">Full Name</span><span className="font-bold text-slate-800">{patientFullName || `${selectedPatient.firstName} ${selectedPatient.lastName}`}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5"><span className="block text-[10px] uppercase font-bold text-slate-400">Age / Gender</span><span className="font-bold text-slate-800">{selectedPatient.age} yrs • {selectedPatient.gender}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5"><span className="block text-[10px] uppercase font-bold text-slate-400">Language</span><span className="font-bold text-slate-800">{selectedPatient.language || 'Not recorded'}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5"><span className="block text-[10px] uppercase font-bold text-slate-400">Nationality</span><span className="font-bold text-slate-800">{selectedPatient.nationality || 'Not recorded'}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5"><span className="block text-[10px] uppercase font-bold text-slate-400">Phone Number</span><span className="font-bold text-slate-800">{selectedPatient.phone || 'Not recorded'}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5"><span className="block text-[10px] uppercase font-bold text-slate-400">Email Address</span><span className="font-bold text-slate-800">{selectedPatient.email || 'Not recorded'}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5"><span className="block text-[10px] uppercase font-bold text-slate-400">National ID No.</span><span className="font-bold text-slate-800">{selectedPatient.emiratesId || selectedPatient.id || 'Not recorded'}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5"><span className="block text-[10px] uppercase font-bold text-slate-400">Passport No.</span><span className="font-bold text-slate-800">{selectedPatient.passportNo || 'Not recorded'}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5"><span className="block text-[10px] uppercase font-bold text-slate-400">Insurance Card No.</span><span className="font-bold text-slate-800">{insuranceCardNo}</span></div>
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5"><span className="block text-[10px] uppercase font-bold text-slate-400">Policy Name</span><span className="font-bold text-slate-800">{policyName}</span></div>
                    </div>
                  </div>

                  {(selectedPatient.insuranceCardImage || selectedPatient.supportDocumentImage) && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-700">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                        Insurance & Supporting Documents
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedPatient.insuranceCardImage && (
                          <div className="rounded-lg border border-slate-200 bg-white p-2">
                            <div className="mb-1 text-[10px] uppercase font-bold text-slate-500">Insurance Card</div>
                            <img src={selectedPatient.insuranceCardImage} alt="Insurance card" className="h-28 w-full object-cover rounded-lg border border-slate-200" />
                          </div>
                        )}
                        {selectedPatient.supportDocumentImage && (
                          <div className="rounded-lg border border-slate-200 bg-white p-2">
                            <div className="mb-1 text-[10px] uppercase font-bold text-slate-500">Supporting Document</div>
                            <img src={selectedPatient.supportDocumentImage} alt="Supporting document" className="h-28 w-full object-cover rounded-lg border border-slate-200" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-700">
                        <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                        Clinical History
                      </div>
                      <div className="space-y-2 text-[11px] text-slate-600">
                        {(selectedPatient.facilityVisits || []).slice(0, 4).map((visit, idx) => (
                          <div key={`${visit.id || idx}`} className="rounded-lg border border-slate-200 bg-white p-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-800">{visit.visitType}</span>
                              <span className="font-mono text-[10px] text-slate-500">{visit.visitDate}</span>
                            </div>
                            <div className="mt-1">{visit.chiefComplaint}</div>
                            <div className="mt-1 text-[10px] text-slate-500">{visit.doctorName} • {visit.department}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase text-slate-700">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Chronic Conditions
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(selectedPatient.chronicConditions || []).length > 0 ? (
                          (selectedPatient.chronicConditions || []).map((condition, idx) => (
                            <span key={`${condition}-${idx}`} className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              {condition}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400">No chronic conditions recorded.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'reports' && (
                <div className="pt-2 space-y-2">
                  {medicalReports.length > 0 ? (
                    medicalReports.map((report, idx) => (
                      <div key={`${report.id || idx}`} className="rounded-lg border border-violet-200 bg-violet-50 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-800 text-[11px]">{report.title}</span>
                          <span className="font-mono text-[10px] text-slate-500">{report.date}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-600">{report.category} • {report.doctorName}</div>
                        <div className="mt-1 text-[10px] text-slate-600">Condition: {report.summary}</div>
                        <div className="mt-1 text-[10px] text-slate-600">Diagnosis: {report.diagnosis}</div>
                        <div className="mt-1 text-[10px] text-slate-600">Procedure/Plan: {report.procedure}</div>
                        <div className="mt-1 text-[10px] text-slate-500">{report.details}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No doctor-saved medical reports are available for this patient.</div>
                  )}
                </div>
              )}

              {detailTab === 'erx' && (
                <div className="pt-2 space-y-2">
                  {prescriptionEntries.length > 0 ? (
                    prescriptionEntries.map((entry, idx) => (
                      <div key={`${entry.title}-${entry.date}-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-800 text-[11px]">{entry.title}</span>
                          <span className="font-mono text-[10px] text-slate-500">{entry.date}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-600">{entry.detail}</div>
                        <div className="mt-1 text-[10px] text-slate-500">{entry.meta}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No prior eRx or prescriptions available.</div>
                  )}
                </div>
              )}

              {detailTab === 'lab' && (
                <div className="pt-2 space-y-2">
                  {(selectedPatient?.labResults || []).length > 0 ? (
                    (selectedPatient?.labResults || []).map((lab, idx) => (
                      <div key={`${lab.id || idx}`} className="rounded-lg border border-violet-200 bg-violet-50 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-800 text-[11px]">{lab.testName}</span>
                          <button
                            type="button"
                            onClick={() => handlePrintLabReport(lab)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold"
                          >
                            <Printer className="w-3 h-3" />
                            Print Report
                          </button>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-600">{lab.category} • {lab.value} • {lab.status}</div>
                        <div className="mt-1 text-[10px] text-slate-500">{lab.resultDate || lab.orderedDate} • {lab.orderedBy} • {lab.department || 'Lab'}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No past lab or radiology reports are available for this patient.</div>
                  )}
                </div>
              )}

              {detailTab === 'invoice' && (
                <div className="pt-2 space-y-2">
                  {patientInvoices.length > 0 ? (
                    patientInvoices.map((invoice) => (
                      <div key={invoice.id} className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-800 text-[11px]">{invoice.id}</div>
                            <div className="text-[10px] text-slate-500">{invoice.issueDate}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setInvoiceToPrintId(invoice.id)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold"
                          >
                            <Printer className="w-3 h-3" />
                            Print Invoice
                          </button>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-700">
                          Amount: ${Number(invoice.totalAmount ?? invoice.subtotal ?? 0).toFixed(2)} • Status: {invoice.status}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-500">No invoice records are available for this patient.</div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="text-[10px] uppercase text-slate-400 font-bold">Visits</div>
                  <div className="text-sm font-bold text-slate-800">{visitEntries.length}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="text-[10px] uppercase text-slate-400 font-bold">Appointments</div>
                  <div className="text-sm font-bold text-slate-800">{appointmentEntries.length}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="text-[10px] uppercase text-slate-400 font-bold">Balance</div>
                  <div className="text-sm font-bold text-rose-600">${(Number(totalOutstanding) || 0).toFixed(2)}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="text-[10px] uppercase text-slate-400 font-bold">Last Activity</div>
                  <div className="text-sm font-bold text-slate-800">{patientVisitTimeline[0]?.date || 'No record'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {(recordTypeFilter === 'all' || recordTypeFilter === 'visit') && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Visits</h5>
                      <span className="text-[10px] font-bold text-emerald-700">{visitEntries.length}</span>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {visitEntries.length === 0 ? <div className="text-xs text-slate-500">No visits logged.</div> : visitEntries.map((event, index) => (
                        <div key={`visit-${event.title}-${event.date}-${index}`} className="rounded-lg border border-emerald-200 bg-white p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 text-[11px]">{event.title}</span>
                            <span className="font-mono text-[10px] text-slate-500">{event.date}</span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-600">{event.detail}</div>
                          <div className="mt-1 text-[9px] text-slate-500">{event.meta}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(recordTypeFilter === 'all' || recordTypeFilter === 'appointment') && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Appointments</h5>
                      <span className="text-[10px] font-bold text-blue-700">{appointmentEntries.length}</span>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {appointmentEntries.length === 0 ? <div className="text-xs text-slate-500">No appointments.</div> : appointmentEntries.map((event, index) => (
                        <div key={`appt-${event.title}-${event.date}-${index}`} className="rounded-lg border border-blue-200 bg-white p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 text-[11px]">{event.title}</span>
                            <span className="font-mono text-[10px] text-slate-500">{event.date}</span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-600">{event.detail}</div>
                          <div className="mt-1 text-[9px] text-slate-500">{event.meta}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(recordTypeFilter === 'all' || recordTypeFilter === 'invoice') && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Invoices</h5>
                      <span className="text-[10px] font-bold text-amber-700">{invoiceEntries.length}</span>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {invoiceEntries.length === 0 ? <div className="text-xs text-slate-500">No invoices.</div> : invoiceEntries.map((event, index) => (
                        <div key={`invoice-${event.title}-${event.date}-${index}`} className="rounded-lg border border-amber-200 bg-white p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 text-[11px]">{event.title}</span>
                            <span className="font-mono text-[10px] text-slate-500">{event.date}</span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-600">{event.detail}</div>
                          <div className="mt-1 text-[9px] text-slate-500">{event.meta}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(recordTypeFilter === 'all' || recordTypeFilter === 'lab') && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-violet-700">Lab Reports</h5>
                      <span className="text-[10px] font-bold text-violet-700">{labEntries.length}</span>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {labEntries.length === 0 ? <div className="text-xs text-slate-500">No lab reports.</div> : labEntries.map((event, index) => (
                        <div key={`lab-${event.title}-${event.date}-${index}`} className="rounded-lg border border-violet-200 bg-white p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 text-[11px]">{event.title}</span>
                            <span className="font-mono text-[10px] text-slate-500">{event.date}</span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-600">{event.detail}</div>
                          <div className="mt-1 text-[9px] text-slate-500">{event.meta}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(recordTypeFilter === 'all' || recordTypeFilter === 'prescription') && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Prescriptions</h5>
                      <span className="text-[10px] font-bold text-slate-700">{prescriptionEntries.length}</span>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {prescriptionEntries.length === 0 ? <div className="text-xs text-slate-500">No prescriptions.</div> : prescriptionEntries.map((event, index) => (
                        <div key={`rx-${event.title}-${event.date}-${index}`} className="rounded-lg border border-slate-200 bg-white p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 text-[11px]">{event.title}</span>
                            <span className="font-mono text-[10px] text-slate-500">{event.date}</span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-600">{event.detail}</div>
                          <div className="mt-1 text-[9px] text-slate-500">{event.meta}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            Select a patient from the directory to inspect their complete medical dossier.
          </div>
        )}
      </div>

      <ReprintInvoiceModal
        isOpen={Boolean(invoiceToPrintId)}
        onClose={() => setInvoiceToPrintId(undefined)}
        initialInvoiceId={invoiceToPrintId}
      />
    </div>
  );
};
