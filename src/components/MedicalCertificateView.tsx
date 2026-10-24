import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  AlertCircle,
  X,
  User,
  Clock,
  Building,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { MedicalCertificate, CertificateType } from '../types';
import { ICD10_COMMON_CODES } from '../data/icd10Codes';

export const MedicalCertificateView: React.FC = () => {
  const {
    patients,
    doctors,
    medicalCertificates,
    issueMedicalCertificate,
    revokeMedicalCertificate,
    currentUser,
    currentRole,
    addNotification,
  } = useHospital();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [printingCert, setPrintingCert] = useState<MedicalCertificate | null>(null);

  // Form State
  const [patientId, setPatientId] = useState(patients[0]?.id || '');
  const [certType, setCertType] = useState<CertificateType>('Sick Leave Attestation');
  const [selectedIcd, setSelectedIcd] = useState(ICD10_COMMON_CODES[0]?.code || 'I10');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [durationDays, setDurationDays] = useState(3);
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([
    'Strict Bed Rest',
    'Avoid Strenuous Activity',
  ]);
  const [clinicalNotes, setClinicalNotes] = useState(
    'Patient evaluated in consultation. Medically unfit to attend professional duties during the specified rest duration.'
  );
  const [doctorId, setDoctorId] = useState(doctors[0]?.id || 'DOC-101');
  const [formError, setFormError] = useState('');

  const commonRestrictions = [
    'Strict Bed Rest',
    'Light Desk Duties Only',
    'No Heavy Lifting (>10kg)',
    'Avoid Strenuous Activity',
    'Avoid Prolonged Standing',
    'Excused from Physical Education / Sports',
    'Frequent Rest Breaks Required',
    'Restricted Driving / Machinery Operation',
  ];

  const selectedPatient = patients.find((p) => p.id === patientId) || patients[0];
  const selectedDoctor = doctors.find((d) => d.id === doctorId) || doctors[0];
  const selectedDiagnosisObj = ICD10_COMMON_CODES.find((c) => c.code === selectedIcd) || {
    code: selectedIcd,
    description: 'Clinical condition evaluated',
  };

  const calculatedEndDate = useMemo(() => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + Math.max(1, durationDays) - 1);
    return d.toISOString().slice(0, 10);
  }, [startDate, durationDays]);

  const filteredCertificates = useMemo(() => {
    return medicalCertificates.filter((cert) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        cert.certificateNumber.toLowerCase().includes(q) ||
        cert.patientName.toLowerCase().includes(q) ||
        cert.patientMrn.toLowerCase().includes(q) ||
        cert.doctorName.toLowerCase().includes(q) ||
        cert.diagnosisCode.toLowerCase().includes(q);

      const matchesType = typeFilter === 'all' || cert.certificateType === typeFilter;
      const matchesStatus = statusFilter === 'all' || cert.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [medicalCertificates, searchQuery, typeFilter, statusFilter]);

  const handleToggleRestriction = (item: string) => {
    if (selectedRestrictions.includes(item)) {
      setSelectedRestrictions(selectedRestrictions.filter((r) => r !== item));
    } else {
      setSelectedRestrictions([...selectedRestrictions, item]);
    }
  };

  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!patientId || !selectedPatient) {
      setFormError('Please select a valid patient.');
      return;
    }

    if (durationDays < 1 || durationDays > 90) {
      setFormError('Duration must be between 1 and 90 days.');
      return;
    }

    const cert = issueMedicalCertificate({
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
      patientMrn: selectedPatient.rgNo || selectedPatient.id,
      patientDob: selectedPatient.dob,
      patientGender: selectedPatient.gender,
      patientPhone: selectedPatient.phone,
      certificateType: certType,
      diagnosisCode: selectedDiagnosisObj.code,
      diagnosisDescription: selectedDiagnosisObj.description,
      startDate,
      endDate: calculatedEndDate,
      durationDays,
      workRestrictions: selectedRestrictions,
      clinicalNotes: clinicalNotes.trim(),
      doctorName: selectedDoctor.name,
      doctorSpecialty: selectedDoctor.specialty,
      doctorLicense: 'MD-DHA-LIC-78942',
      hospitalStampRef: `MEDCORE-STAMP-${Math.floor(1000 + Math.random() * 9000)}`,
    });

    setIsIssueModalOpen(false);
    setPrintingCert(cert);
  };

  const handlePrintCertificate = (cert: MedicalCertificate) => {
    setPrintingCert(cert);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Medical Certificates &amp; Sick Leave Attestations
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-bold uppercase">
              DHA / MOHAP FORMAT
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Generate and manage certified medical certificates, employee sick leave attestations, fitness to resume work reports, and official medical leaves with institutional stamps and verification QR badges.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsIssueModalOpen(true)}
            className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Issue New Certificate</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Certificates Issued
          </span>
          <div className="text-2xl font-black font-mono text-slate-900 mt-1">
            {medicalCertificates.length}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Official Attestations</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
            Active Sick Leaves
          </span>
          <div className="text-2xl font-black font-mono text-emerald-700 mt-1">
            {medicalCertificates.filter((c) => c.status === 'Active').length}
          </div>
          <span className="text-[10px] text-emerald-700 mt-0.5 block">Currently Under Rest</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 shadow-sm">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
            Fitness Cleared
          </span>
          <div className="text-2xl font-black font-mono text-blue-600 mt-1">
            {medicalCertificates.filter((c) => c.certificateType === 'Fitness to Return to Work').length}
          </div>
          <span className="text-[10px] text-blue-600 mt-0.5 block">Cleared for Duty</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Avg Leave Duration
          </span>
          <div className="text-2xl font-black font-mono text-slate-900 mt-1">
            {medicalCertificates.length > 0
              ? Math.round(
                  medicalCertificates.reduce((sum, c) => sum + c.durationDays, 0) /
                    medicalCertificates.length
                )
              : 0}{' '}
            <span className="text-xs font-normal text-slate-500">Days</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Per Physician Attestation</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search certificate #, patient, MRN, doctor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-teal-500/20 text-slate-800"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 text-xs font-medium text-slate-700"
          >
            <option value="all">All Certificate Types</option>
            <option value="Sick Leave Attestation">Sick Leave Attestation</option>
            <option value="Fitness to Return to Work">Fitness to Return to Work</option>
            <option value="Medical Exemption">Medical Exemption</option>
            <option value="Inpatient Admission Attestation">Inpatient Admission</option>
            <option value="School Absence Certificate">School Absence</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 text-xs font-medium text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Revoked">Revoked</option>
            <option value="Expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Certificates Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Medical Certificates Registry ({filteredCertificates.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">DHA / MOHAP Certified Serial Tracking</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-2.5 px-3">Certificate No.</th>
                <th className="py-2.5 px-3">Patient</th>
                <th className="py-2.5 px-3">Certificate Type</th>
                <th className="py-2.5 px-3">Diagnosis (ICD-10)</th>
                <th className="py-2.5 px-3">Leave Duration</th>
                <th className="py-2.5 px-3">Attending Physician</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredCertificates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No medical certificates matching the filter. Click "+ Issue New Certificate" to create one.
                  </td>
                </tr>
              ) : (
                filteredCertificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-teal-800">
                      <div>{cert.certificateNumber}</div>
                      <div className="text-[10px] text-slate-400 font-normal">Issued: {cert.issueDate}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{cert.patientName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">MRN: {cert.patientMrn}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-800">{cert.certificateType}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <span className="font-mono text-blue-700 bg-blue-50 px-1 rounded text-[10px]">
                          {cert.diagnosisCode}
                        </span>
                        <span className="truncate max-w-xs">{cert.diagnosisDescription}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                      <div className="font-bold text-slate-900">{cert.durationDays} Day(s)</div>
                      <div className="text-[10px] text-slate-500">
                        {cert.startDate} to {cert.endDate}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">{cert.doctorName}</div>
                      <div className="text-[10px] text-slate-400">{cert.doctorSpecialty}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          cert.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {cert.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-right space-x-1">
                      <button
                        onClick={() => handlePrintCertificate(cert)}
                        title="Print Official Certificate"
                        className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Print</span>
                      </button>
                      {cert.status === 'Active' && currentRole === 'admin' && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Revoke certificate ${cert.certificateNumber}?`)) {
                              revokeMedicalCertificate(cert.id, 'Administrative cancellation');
                            }
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 rounded text-xs font-semibold cursor-pointer transition"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ISSUE MEDICAL CERTIFICATE */}
      {isIssueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Issue Official Medical Certificate</h3>
                  <p className="text-[10px] text-slate-300">
                    Certified Sick Leave, Fitness Assessment &amp; Exemption Attestation
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsIssueModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleIssueSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Patient and Certificate Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Patient *</label>
                  <select
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                    required
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} (MRN: {p.rgNo || p.id}) — {p.age}y {p.gender}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Attestation Classification *</label>
                  <select
                    value={certType}
                    onChange={(e) => setCertType(e.target.value as CertificateType)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                    required
                  >
                    <option value="Sick Leave Attestation">Sick Leave Attestation (Medical Rest)</option>
                    <option value="Fitness to Return to Work">Fitness to Return to Work (Duty Clearance)</option>
                    <option value="Medical Exemption">Medical Exemption / Activity Waiver</option>
                    <option value="Inpatient Admission Attestation">Inpatient Admission Hospital Stay</option>
                    <option value="School Absence Certificate">School Absence / Academic Exemption</option>
                  </select>
                </div>
              </div>

              {/* Diagnosis and ICD-10 */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Clinical Diagnosis (ICD-10 Standard) *</label>
                <select
                  value={selectedIcd}
                  onChange={(e) => setSelectedIcd(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                >
                  {ICD10_COMMON_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.description} ({c.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Leave Timing & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Leave Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    required
                    value={durationDays}
                    onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Resumption / End Date</label>
                  <input
                    type="text"
                    readOnly
                    value={calculatedEndDate}
                    className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-xs font-mono font-semibold text-slate-700"
                  />
                </div>
              </div>

              {/* Work Restrictions */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Work / Activity Restrictions &amp; Accommodations
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {commonRestrictions.map((item) => {
                    const isChecked = selectedRestrictions.includes(item);
                    return (
                      <button
                        type="button"
                        key={item}
                        onClick={() => handleToggleRestriction(item)}
                        className={`p-2 rounded-lg text-left text-[11px] border transition cursor-pointer flex items-center justify-between ${
                          isChecked
                            ? 'bg-teal-50 border-teal-500 text-teal-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>{item}</span>
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Attending Doctor */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Certifying Physician *</label>
                <select
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.specialty} ({d.department})
                    </option>
                  ))}
                </select>
              </div>

              {/* Clinical Notes */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Physician Clinical Remarks</label>
                <textarea
                  rows={2}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Additional medical explanation or return-to-work instructions..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Issue &amp; Preview Certificate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW / OFFICIAL CERTIFICATE MODAL */}
      {printingCert && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrintingCert(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs select-none"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-300 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
              <span className="font-bold text-xs">Official Certificate Print Preview</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded text-xs font-bold flex items-center gap-1 shadow-sm transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() => setPrintingCert(null)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Official Certificate Paper Document */}
            <div className="p-8 sm:p-10 overflow-y-auto bg-slate-50 flex-1 flex justify-center">
              <div className="bg-white border-2 border-slate-800 rounded-xl p-8 sm:p-10 max-w-xl w-full text-slate-900 font-sans shadow-md relative print:shadow-none print:border-none print:p-0">
                {/* Header */}
                <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center relative">
                  <div className="flex items-center justify-center gap-2.5 mb-1">
                    <div className="w-8 h-8 rounded-lg bg-teal-700 text-white font-bold text-lg flex items-center justify-center">
                      +
                    </div>
                    <div>
                      <h1 className="text-lg font-black tracking-tight uppercase text-slate-900">
                        Apex Health Systems &amp; Clinical Care
                      </h1>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                        Licensed Healthcare Facility · Medical Records &amp; Clinical Governance
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 inline-block bg-slate-900 text-white px-4 py-1 rounded-full text-xs font-black tracking-wider uppercase">
                    {printingCert.certificateType}
                  </div>
                  <div className="absolute top-0 right-0 text-right">
                    <span className="text-[9px] font-mono text-slate-400 block">SERIAL NO.</span>
                    <span className="font-mono font-bold text-xs text-teal-800">{printingCert.certificateNumber}</span>
                  </div>
                </div>

                {/* Patient Information Table */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs mb-6">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Patient Name:</span>
                      <p className="font-bold text-sm text-slate-900">{printingCert.patientName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Patient MRN:</span>
                      <p className="font-mono font-bold text-slate-900">{printingCert.patientMrn}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Date of Birth / Gender:</span>
                      <p className="font-medium text-slate-800">{printingCert.patientDob} · {printingCert.patientGender}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Contact Phone:</span>
                      <p className="font-medium text-slate-800">{printingCert.patientPhone || '+1 (555) 234-8901'}</p>
                    </div>
                  </div>
                </div>

                {/* Medical Attestation Body */}
                <div className="space-y-4 text-xs leading-relaxed text-slate-800 mb-6">
                  <p>
                    This is to officially certify that the above-named patient was clinically evaluated on{' '}
                    <strong>{printingCert.issueDate}</strong> by <strong>{printingCert.doctorName}</strong> (
                    {printingCert.doctorSpecialty}).
                  </p>

                  <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-lg">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-900 block mb-1">
                      Certified Clinical Diagnosis &amp; ICD-10 Coding:
                    </span>
                    <p className="font-bold text-sm text-teal-950 font-mono">
                      {printingCert.diagnosisCode} — {printingCert.diagnosisDescription}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
                      Authorized Medical Leave Duration:
                    </span>
                    <p className="text-sm font-black text-slate-900">
                      {printingCert.durationDays} Consecutive Day(s){' '}
                      <span className="text-xs font-normal text-slate-600">
                        (From <strong>{printingCert.startDate}</strong> through <strong>{printingCert.endDate}</strong>)
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      The patient is scheduled to resume regular activity on the next business day following leave completion.
                    </p>
                  </div>

                  {printingCert.workRestrictions.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block mb-1.5">
                        Mandatory Workplace Accommodations / Physical Restrictions:
                      </span>
                      <ul className="list-disc pl-5 space-y-0.5 text-xs text-slate-700 font-medium">
                        {printingCert.workRestrictions.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {printingCert.clinicalNotes && (
                    <div className="text-[11px] text-slate-600 italic border-l-2 border-teal-600 pl-3">
                      "{printingCert.clinicalNotes}"
                    </div>
                  )}
                </div>

                {/* Sign-off & Hospital Seal Stamp */}
                <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-4 items-end text-xs">
                  <div>
                    <div className="w-20 h-20 rounded-full border-2 border-teal-700/60 flex flex-col items-center justify-center text-center p-1 text-teal-800 rotate-[-8deg] shadow-2xs bg-teal-50/40">
                      <ShieldCheck className="w-4 h-4 text-teal-700" />
                      <span className="text-[7px] font-bold uppercase tracking-wider">OFFICIAL SEAL</span>
                      <span className="text-[8px] font-mono font-bold leading-none">APEX HEALTH</span>
                      <span className="text-[6px] text-slate-500">{printingCert.hospitalStampRef}</span>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="border-b border-slate-400 w-44 ml-auto mb-1"></div>
                    <p className="font-bold text-xs text-slate-900">{printingCert.doctorName}</p>
                    <p className="text-[10px] text-slate-500">{printingCert.doctorSpecialty}</p>
                    <p className="font-mono text-[9px] text-slate-400">License: {printingCert.doctorLicense}</p>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-200 text-[9px] text-slate-400 text-center flex items-center justify-between">
                  <span>Authorized DHA / MOHAP Clinical Verification Document</span>
                  <span className="font-mono">MEDCORE EMR AUTHENTICATED</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
