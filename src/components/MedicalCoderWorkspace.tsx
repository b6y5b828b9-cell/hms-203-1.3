import React, { useState } from 'react';
import { CalendarDays, CheckCircle2, Copy, FileCheck2, FileText, History, Plus, ShieldCheck, UserRound, X, XCircle } from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { InsuranceApproval, LabResult } from '../types';

const today = () => new Date().toISOString().slice(0, 10);

const approvalStatusClasses: Record<InsuranceApproval['approvalStatus'], string> = {
  Approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Pending: 'border-amber-200 bg-amber-50 text-amber-800',
  'Query Raised': 'border-orange-200 bg-orange-50 text-orange-800',
  Rejected: 'border-rose-200 bg-rose-50 text-rose-800',
};

export const MedicalCoderWorkspace: React.FC = () => {
  const {
    patients,
    insuranceApprovals,
    doctors,
    updateInsuranceApprovalStatus,
    publishInsuranceApproval,
    addCoderInsuranceApproval,
    addLabResult,
    logAuditEvent,
    currentUser,
    currentRole,
  } = useHospital();
  const canManageApprovals = currentRole === 'medical-coder';
  const [patientId, setPatientId] = useState(patients[0]?.id || '');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAddApprovalOpen, setIsAddApprovalOpen] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');
  const [newDoctorId, setNewDoctorId] = useState('');
  const [newInsuranceProvider, setNewInsuranceProvider] = useState('');
  const [newPolicyNumber, setNewPolicyNumber] = useState('');
  const [newApprovalNumber, setNewApprovalNumber] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState<InsuranceApproval['serviceCategory']>('Procedure');
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCode, setNewServiceCode] = useState('');
  const [newEstimatedCost, setNewEstimatedCost] = useState('');
  const [newApprovedAmount, setNewApprovedAmount] = useState('');
  const [newCopay, setNewCopay] = useState('0');
  const [newValidUntil, setNewValidUntil] = useState('');
  const [newRemarks, setNewRemarks] = useState('');
  const [copiedApprovalId, setCopiedApprovalId] = useState('');
  const [addApprovalError, setAddApprovalError] = useState('');
  const [approvalId, setApprovalId] = useState('');
  const [testName, setTestName] = useState('');
  const [category, setCategory] = useState<LabResult['category']>('Biochemistry');
  const [value, setValue] = useState('');
  const [referenceRange, setReferenceRange] = useState('');
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [status, setStatus] = useState<Exclude<LabResult['status'], 'Pending'>>('Normal');
  const [message, setMessage] = useState('');
  const [approvalToPublish, setApprovalToPublish] = useState<InsuranceApproval | null>(null);
  const [publishedApprovalNumber, setPublishedApprovalNumber] = useState('');
  const [publishedAmount, setPublishedAmount] = useState('');
  const [publishedCopay, setPublishedCopay] = useState('');
  const [publishedValidUntil, setPublishedValidUntil] = useState('');

  const patient = patients.find((item) => item.id === patientId);
  const patientApprovals = insuranceApprovals.filter((approval) => approval.patientId === patientId);
  const todayApprovals = patientApprovals.filter((approval) => approval.approvalDate === today());
  const pastApprovals = patientApprovals
    .filter((approval) => approval.approvalDate < today())
    .sort((a, b) => b.approvalDate.localeCompare(a.approvalDate));
  const departments = Array.from(new Set([
    ...doctors.map((doctor) => doctor.department),
    ...patientApprovals.map((approval) => approval.department),
    ...(patient?.department ? [patient.department] : []),
  ])).filter(Boolean).sort();
  const departmentDoctors = doctors.filter((doctor) => doctor.department === newDepartment);
  const departmentPastApprovals = patientApprovals.filter((approval) => approval.department === newDepartment);
  const eligibleApprovals = insuranceApprovals.filter(
    (approval) =>
      approval.patientId === patientId &&
      approval.approvalStatus === 'Approved' &&
      approval.validUntil >= today()
  );
  const selectedApproval = eligibleApprovals.find((approval) => approval.id === approvalId);

  const openAddApproval = (template?: InsuranceApproval) => {
    const defaultDepartment = patient?.department || departments[0] || '';
    const defaultDoctor = doctors.find((doctor) => doctor.department === defaultDepartment) || doctors[0];
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    const department = template?.department || defaultDepartment || defaultDoctor?.department || '';
    setNewDepartment(department);
    setNewDoctorId(template?.doctorId || doctors.find((doctor) => doctor.department === department)?.id || '');
    setNewInsuranceProvider(template?.insuranceProvider || patient?.insurance.provider || '');
    setNewPolicyNumber(template?.policyNumber || patient?.insurance.policyNumber || '');
    setNewApprovalNumber('');
    setNewServiceCategory(template?.serviceCategory || 'Procedure');
    setNewServiceName(template?.serviceName || '');
    setNewServiceCode(template?.serviceCode || '');
    setNewEstimatedCost(template ? String(template.estimatedCost) : '');
    setNewApprovedAmount(template ? String(template.approvedAmount) : '');
    setNewCopay(template ? String(template.copayPercentage) : '0');
    setNewValidUntil(validUntil.toISOString().slice(0, 10));
    setNewRemarks(template?.remarks || '');
    setCopiedApprovalId(template?.id || '');
    setAddApprovalError('');
    setIsAddApprovalOpen(true);
  };

  const copyPastApproval = (id: string) => {
    const approval = departmentPastApprovals.find((item) => item.id === id);
    if (!approval) return;
    setCopiedApprovalId(approval.id);
    setNewDepartment(approval.department);
    setNewDoctorId(approval.doctorId);
    setNewInsuranceProvider(approval.insuranceProvider);
    setNewPolicyNumber(approval.policyNumber);
    setNewServiceCategory(approval.serviceCategory);
    setNewServiceName(approval.serviceName);
    setNewServiceCode(approval.serviceCode || '');
    setNewEstimatedCost(String(approval.estimatedCost));
    setNewApprovedAmount(String(approval.approvedAmount));
    setNewCopay(String(approval.copayPercentage));
    setNewRemarks(approval.remarks || '');
  };

  const handleAddApproval = (event: React.FormEvent) => {
    event.preventDefault();
    setAddApprovalError('');
    if (!patient) {
      setAddApprovalError('Select a patient before recording an approval.');
      return;
    }
    const doctor = doctors.find((item) => item.id === newDoctorId);
    const estimatedCost = Number(newEstimatedCost);
    const approvedAmount = Number(newApprovedAmount);
    const copayPercentage = Number(newCopay);
    if (!doctor || !newDepartment || doctor.department !== newDepartment) {
      setAddApprovalError('Choose a doctor assigned to the selected department.');
      return;
    }
    if (!newInsuranceProvider.trim() || !newApprovalNumber.trim() || !newServiceName.trim()) {
      setAddApprovalError('Enter the insurer, approval number, and approved service.');
      return;
    }
    if (!Number.isFinite(estimatedCost) || estimatedCost <= 0 || !Number.isFinite(approvedAmount) || approvedAmount <= 0) {
      setAddApprovalError('Enter valid positive requested and approved amounts.');
      return;
    }
    if (!Number.isFinite(copayPercentage) || copayPercentage < 0 || copayPercentage > 100) {
      setAddApprovalError('Copay must be between 0 and 100 percent.');
      return;
    }
    if (!newValidUntil || newValidUntil < today()) {
      setAddApprovalError('Choose a valid expiration date today or later.');
      return;
    }

    const created = addCoderInsuranceApproval({
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientMrn: patient.rgNo || patient.id,
      insuranceProvider: newInsuranceProvider.trim(),
      policyNumber: newPolicyNumber.trim(),
      approvalNumber: newApprovalNumber.trim(),
      doctorId: doctor.id,
      doctorName: doctor.name,
      department: newDepartment,
      serviceCategory: newServiceCategory,
      serviceName: newServiceName.trim(),
      serviceCode: newServiceCode.trim() || undefined,
      estimatedCost,
      approvedAmount,
      copayPercentage,
      copayAmount: (approvedAmount * copayPercentage) / 100,
      approvalStatus: 'Approved',
      approvalDate: today(),
      validUntil: newValidUntil,
      authorisedBy: currentUser.name,
      remarks: newRemarks.trim() || `Insurer approval recorded by ${currentUser.name}.`,
    });
    if (!created) {
      setAddApprovalError('The approval could not be saved for this role. Refresh the desk and try again.');
      return;
    }
    setMessage(`Approval ${created.approvalNumber} recorded for ${patient.firstName} ${patient.lastName}.`);
    setIsAddApprovalOpen(false);
  };

  const reviewApproval = (approval: InsuranceApproval, decision: Exclude<InsuranceApproval['approvalStatus'], 'Approved'>) => {
    const reviewNote = `Reviewed by ${currentUser.name} on ${today()}: ${decision}.`;
    updateInsuranceApprovalStatus(approval.id, decision, reviewNote);
    logAuditEvent('UPDATE', 'Billing Invoice', approval.id, `Medical coder ${decision.toLowerCase()} insurance approval ${approval.approvalNumber}.`);
  };

  const openPublishApproval = (approval: InsuranceApproval) => {
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    setApprovalToPublish(approval);
    setPublishedApprovalNumber('');
    setPublishedAmount(approval.estimatedCost ? String(approval.estimatedCost) : '');
    setPublishedCopay('0');
    setPublishedValidUntil(validUntil.toISOString().slice(0, 10));
  };

  const handlePublishApproval = (event: React.FormEvent) => {
    event.preventDefault();
    if (!approvalToPublish || !publishedApprovalNumber.trim()) return;
    const amount = Number(publishedAmount);
    const copay = Number(publishedCopay);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(copay) || copay < 0 || copay > 100 || !publishedValidUntil) return;
    publishInsuranceApproval(approvalToPublish.id, {
      approvalNumber: publishedApprovalNumber.trim(),
      approvedAmount: amount,
      copayPercentage: copay,
      validUntil: publishedValidUntil,
    });
    setMessage(`Authorization ${publishedApprovalNumber.trim()} published for billing.`);
    setApprovalToPublish(null);
  };

  const publishReport = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (!patient || !selectedApproval || selectedApproval.validUntil < today()) {
      setMessage('Choose a patient and a currently valid approved insurance authorization before publishing.');
      return;
    }
    if (!testName.trim() || !value.trim() || !findings.trim()) {
      setMessage('Enter the report name, result, and findings before publishing.');
      return;
    }

    const date = today();
    addLabResult(patient.id, {
      testName: testName.trim(),
      category,
      orderedDate: selectedApproval.approvalDate,
      resultDate: date,
      status,
      value: value.trim(),
      referenceRange: referenceRange.trim() || 'Not specified',
      orderedBy: selectedApproval.doctorName,
      department: category === 'Radiology' ? 'Radiology & Imaging' : 'Laboratory',
      cptCode: selectedApproval.serviceCode,
      findings: findings.trim(),
      impression: impression.trim() || undefined,
      sentToPatient: true,
      sentToDoctor: true,
      sentDate: date,
      insuranceApprovalId: selectedApproval.id,
      publishedBy: currentUser.name,
      notes: `Published against insurance approval ${selectedApproval.approvalNumber}.`,
    });
    logAuditEvent('CREATE', 'Lab Result', patient.id, `Medical coder ${currentUser.name} published ${testName.trim()} under insurance approval ${selectedApproval.approvalNumber}.`);
    setMessage(`Report published to ${patient.firstName} ${patient.lastName}'s patient profile.`);
    setTestName('');
    setValue('');
    setReferenceRange('');
    setFindings('');
    setImpression('');
    setApprovalId('');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <FileCheck2 className="h-4 w-4" />
            </span>
            <h1 className="text-base font-bold text-slate-900">Medical Coder Desk</h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">Patient details and today&apos;s insurance approval status.</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <ShieldCheck className="h-4 w-4" /> Patient-linked publication
        </span>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-bold text-slate-700">
            <UserRound className="h-4 w-4 shrink-0 text-teal-700" />
            Patient / MRN
            <select value={patientId} onChange={(event) => { setPatientId(event.target.value); setApprovalId(''); setMessage(''); }} className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
              <option value="">Select patient</option>
              {patients.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} · {item.rgNo || item.id}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setIsHistoryOpen(true)} disabled={!patient} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
              <History className="h-3.5 w-3.5" /> Past approvals ({pastApprovals.length})
            </button>
            {canManageApprovals && (
              <button type="button" onClick={() => openAddApproval()} disabled={!patient} className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                <Plus className="h-3.5 w-3.5" /> Add approval
              </button>
            )}
          </div>
        </div>

        {!patient ? (
          <p className="p-5 text-xs text-slate-500">Select a patient to view their details and today&apos;s approvals.</p>
        ) : (
          <>
            <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Patient</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{patient.title ? `${patient.title} ` : ''}{patient.firstName} {patient.lastName}</p>
                <p className="font-mono text-[10px] text-slate-500">MRN: {patient.rgNo || patient.id}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Insurance</p>
                <p className="mt-1 text-xs font-semibold text-slate-800">{patient.insurance.provider}</p>
                <p className="text-[10px] text-slate-500">Policy: {patient.insurance.policyNumber || 'Not recorded'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Primary physician</p>
                <p className="mt-1 text-xs font-semibold text-slate-800">{patient.primaryPhysicianName}</p>
                <p className="text-[10px] text-slate-500">{patient.department || 'Department not recorded'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Patient status</p>
                <p className="mt-1 text-xs font-semibold text-slate-800">{patient.status}</p>
                <p className="text-[10px] text-slate-500">{patient.phone}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <CalendarDays className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-bold text-slate-900">Today&apos;s insurance approvals</h2>
              <span className="text-[10px] text-slate-500">{today()}</span>
              <span className="ml-auto text-xs text-slate-500">{todayApprovals.length} records</span>
            </div>
            {todayApprovals.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">No insurance approvals have been recorded for this patient today.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {todayApprovals.map((approval) => {
                  const expired = Boolean(approval.validUntil) && approval.validUntil < today();
                  const canReview = approval.approvalStatus === 'Pending' || approval.approvalStatus === 'Query Raised';
                  return (
                    <div key={approval.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-bold text-slate-900">{approval.serviceName}</p>
                          <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${approvalStatusClasses[approval.approvalStatus]}`}>{approval.approvalStatus}</span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-600">{approval.department} · {approval.doctorName} · {approval.insuranceProvider}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">Approval: {approval.approvalNumber || 'Pending'} · Valid until: <span className={expired ? 'font-semibold text-rose-700' : ''}>{approval.validUntil || 'Not issued'}</span></p>
                        <p className="mt-0.5 text-[10px] text-slate-500">Approved ${approval.approvedAmount.toFixed(2)} · Copay {approval.copayPercentage}%</p>
                      </div>
                      {canReview && canManageApprovals ? (
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => openPublishApproval(approval)} className="inline-flex items-center gap-1 rounded border border-emerald-200 px-2 py-1.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50">
                            <CheckCircle2 className="h-3 w-3" /> Publish
                          </button>
                          {approval.approvalStatus === 'Pending' && <button type="button" onClick={() => reviewApproval(approval, 'Query Raised')} className="rounded border border-amber-200 px-2 py-1.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-50">Query</button>}
                          <button type="button" onClick={() => reviewApproval(approval, 'Rejected')} className="inline-flex items-center gap-1 rounded border border-rose-200 px-2 py-1.5 text-[10px] font-semibold text-rose-800 hover:bg-rose-50">
                            <XCircle className="h-3 w-3" /> Reject
                          </button>
                        </div>
                      ) : <span className="text-[10px] text-slate-500">{approval.remarks || 'Reviewed'}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      {isHistoryOpen && patient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="approval-history-title">
          <section className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="approval-history-title" className="text-base font-bold text-slate-900">Past approvals &amp; records</h2>
                <p className="mt-1 text-xs text-slate-500">{patient.firstName} {patient.lastName} · {patient.rgNo || patient.id} · {pastApprovals.length} records</p>
              </div>
              <button type="button" onClick={() => setIsHistoryOpen(false)} aria-label="Close approval history" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><X className="h-4 w-4" /></button>
            </header>
            {pastApprovals.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No past approvals have been recorded for this patient.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                    <tr><th className="px-4 py-3">Date / department</th><th className="px-4 py-3">Insurer / approval</th><th className="px-4 py-3">Service / doctor</th><th className="px-4 py-3">Amounts / validity</th><th className="px-4 py-3">Status / action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pastApprovals.map((approval) => {
                      const canReview = approval.approvalStatus === 'Pending' || approval.approvalStatus === 'Query Raised';
                      return (
                        <tr key={approval.id} className="align-top">
                          <td className="px-4 py-3"><p className="font-semibold text-slate-800">{approval.approvalDate}</p><p className="mt-1 text-[10px] text-slate-500">{approval.department}</p></td>
                          <td className="px-4 py-3"><p className="font-semibold text-slate-800">{approval.insuranceProvider}</p><p className="font-mono text-[10px] text-slate-500">{approval.approvalNumber || 'No number recorded'}</p></td>
                          <td className="px-4 py-3"><p className="text-slate-800">{approval.serviceName}</p><p className="mt-1 text-[10px] text-slate-500">{approval.doctorName}</p></td>
                          <td className="px-4 py-3"><p className="text-slate-800">Approved ${approval.approvedAmount.toFixed(2)}</p><p className="mt-1 text-[10px] text-slate-500">Valid to {approval.validUntil || 'Not recorded'}</p></td>
                          <td className="px-4 py-3">
                            <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${approvalStatusClasses[approval.approvalStatus]}`}>{approval.approvalStatus}</span>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <button type="button" onClick={() => { setIsHistoryOpen(false); openAddApproval(approval); }} className="inline-flex items-center gap-1 rounded border border-teal-200 px-2 py-1 text-[10px] font-semibold text-teal-800 hover:bg-teal-50"><Copy className="h-3 w-3" /> Copy</button>
                              {canReview && canManageApprovals && <button type="button" onClick={() => { setIsHistoryOpen(false); openPublishApproval(approval); }} className="rounded border border-emerald-200 px-2 py-1 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50">Publish</button>}
                              {canReview && canManageApprovals && <button type="button" onClick={() => reviewApproval(approval, 'Rejected')} className="rounded border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-800 hover:bg-rose-50">Reject</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {isAddApprovalOpen && patient && canManageApprovals && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="add-approval-title">
          <form onSubmit={handleAddApproval} className="max-h-[92vh] w-full max-w-3xl space-y-3 overflow-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><h2 id="add-approval-title" className="text-base font-bold text-slate-900">Record insurer approval</h2><p className="mt-1 text-xs text-slate-500">{patient.firstName} {patient.lastName} · {patient.rgNo || patient.id}</p></div>
              <button type="button" onClick={() => setIsAddApprovalOpen(false)} aria-label="Close add approval form" className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            {addApprovalError && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-800">{addApprovalError}</p>}
            <label className="block text-xs font-semibold text-slate-700">
              Copy a past approval from this department
              <select value={copiedApprovalId} onChange={(event) => copyPastApproval(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                <option value="">Start a new approval</option>
                {departmentPastApprovals.map((approval) => <option key={approval.id} value={approval.id}>{approval.approvalDate} · {approval.serviceName} · {approval.approvalNumber || approval.approvalStatus}</option>)}
              </select>
            </label>
            {copiedApprovalId && <p className="flex items-center gap-1.5 text-[10px] text-teal-800"><Copy className="h-3 w-3" /> Prior details copied; the approval number and date will be new.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700">Department
                <select required value={newDepartment} onChange={(event) => { setNewDepartment(event.target.value); setNewDoctorId(doctors.find((doctor) => doctor.department === event.target.value)?.id || ''); setCopiedApprovalId(''); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                  <option value="">Select department</option>{departments.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">Doctor
                <select required value={newDoctorId} onChange={(event) => setNewDoctorId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                  <option value="">Select doctor</option>{departmentDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">Insurance provider
                <input required value={newInsuranceProvider} onChange={(event) => setNewInsuranceProvider(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Policy number
                <input value={newPolicyNumber} onChange={(event) => setNewPolicyNumber(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Approval number
                <input required value={newApprovalNumber} onChange={(event) => setNewApprovalNumber(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Service category
                <select value={newServiceCategory} onChange={(event) => setNewServiceCategory(event.target.value as InsuranceApproval['serviceCategory'])} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                  {(['Procedure', 'Lab Test', 'Radiology', 'Consultation', 'IPD Admission'] as const).map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-700">Approved service
                <input required value={newServiceName} onChange={(event) => setNewServiceName(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Service code
                <input value={newServiceCode} onChange={(event) => setNewServiceCode(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Estimated cost ($)
                <input required type="number" min="0.01" step="0.01" value={newEstimatedCost} onChange={(event) => setNewEstimatedCost(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Approved amount ($)
                <input required type="number" min="0.01" step="0.01" value={newApprovedAmount} onChange={(event) => setNewApprovedAmount(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Copay (%)
                <input required type="number" min="0" max="100" step="0.01" value={newCopay} onChange={(event) => setNewCopay(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-xs font-semibold text-slate-700">Valid until
                <input required type="date" min={today()} value={newValidUntil} onChange={(event) => setNewValidUntil(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
              </label>
            </div>
            <label className="block text-xs font-semibold text-slate-700">Remarks
              <textarea value={newRemarks} onChange={(event) => setNewRemarks(event.target.value)} rows={2} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setIsAddApprovalOpen(false)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800"><Plus className="h-3.5 w-3.5" /> Save approval</button>
            </div>
          </form>
        </div>
      )}

      {canManageApprovals && approvalToPublish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={handlePublishApproval} className="w-full max-w-lg space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div>
              <h2 className="text-base font-bold text-slate-900">Publish insurer approval</h2>
              <p className="mt-1 text-xs text-slate-600">{approvalToPublish.patientName} · {approvalToPublish.serviceName}</p>
            </div>
            <label className="block text-xs font-semibold text-slate-700">
              Insurer approval number
              <input required value={publishedApprovalNumber} onChange={(event) => setPublishedApprovalNumber(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" autoFocus />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold text-slate-700">
                Approved amount ($)
                <input required type="number" min="0.01" step="0.01" value={publishedAmount} onChange={(event) => setPublishedAmount(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Copay (%)
                <input required type="number" min="0" max="100" step="0.01" value={publishedCopay} onChange={(event) => setPublishedCopay(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-xs font-semibold text-slate-700">
                Valid until
                <input required type="date" min={today()} value={publishedValidUntil} onChange={(event) => setPublishedValidUntil(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setApprovalToPublish(null)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve & publish
              </button>
            </div>
          </form>
        </div>
      )}

      {canManageApprovals && <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <FileText className="h-4 w-4 text-teal-700" />
          <h2 className="text-sm font-bold text-slate-900">Publish report to patient file</h2>
        </div>
        <form onSubmit={publishReport} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-semibold text-slate-700">
            Patient
            <select required value={patientId} onChange={(event) => { setPatientId(event.target.value); setApprovalId(''); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
              <option value="">Select patient</option>
              {patients.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} · {item.id}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Valid approved authorization
            <select required value={approvalId} onChange={(event) => setApprovalId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal" disabled={!patient || eligibleApprovals.length === 0}>
              <option value="">{eligibleApprovals.length ? 'Select authorization' : 'No valid approval for patient'}</option>
              {eligibleApprovals.map((approval) => <option key={approval.id} value={approval.id}>{approval.approvalNumber} · {approval.serviceName}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Report name
            <input required value={testName} onChange={(event) => setTestName(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="e.g. Complete blood count" />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Report category
            <select value={category} onChange={(event) => setCategory(event.target.value as LabResult['category'])} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
              {(['Hematology', 'Biochemistry', 'Pathology', 'Radiology', 'Cardiology'] as const).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Result / value
            <input required value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Reference range
            <input value={referenceRange} onChange={(event) => setReferenceRange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="Optional" />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Result status
            <select value={status} onChange={(event) => setStatus(event.target.value as Exclude<LabResult['status'], 'Pending'>)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
              {(['Normal', 'Elevated', 'Critical'] as const).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">
            Findings
            <textarea required value={findings} onChange={(event) => setFindings(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
          </label>
          <label className="text-xs font-semibold text-slate-700 sm:col-span-2 lg:col-span-3">
            Impression
            <textarea value={impression} onChange={(event) => setImpression(event.target.value)} rows={2} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="Optional" />
          </label>
          {message && <p role="status" className="text-xs font-semibold text-teal-800 sm:col-span-2 lg:col-span-3">{message}</p>}
          <div className="flex justify-end sm:col-span-2 lg:col-span-3">
            <button type="submit" disabled={!patient || !selectedApproval} className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300">
              <FileCheck2 className="h-4 w-4" /> Publish to patient profile
            </button>
          </div>
        </form>
      </section>}
    </div>
  );
};
