import React, { useState, useMemo } from 'react';
import {
  BedDouble,
  Search,
  CheckCircle2,
  AlertTriangle,
  User,
  Plus,
  ArrowRight,
  ShieldCheck,
  Activity,
  HeartPulse,
  ArrowLeftRight,
  Printer,
  History,
  X,
  Clock,
  Building,
  UserCheck,
  Stethoscope,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { WardBed, BedTransferRecord, Patient } from '../types';

interface WardOccupancyViewProps {
  onSelectPatient: (id: string) => void;
}

export const WardOccupancyView: React.FC<WardOccupancyViewProps> = ({ onSelectPatient }) => {
  const {
    wardBeds,
    patients,
    doctors,
    updateBedStatus,
    transferPatientBed,
    admitPatientToBed,
    dischargePatient,
    bedTransfers,
    setActiveTab,
    addNotification,
    currentUser,
  } = useHospital();

  const [activeTab, setActiveTabLocal] = useState<'census' | 'transfers'>('census');
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals State
  const [admitBed, setAdmitBed] = useState<WardBed | null>(null);
  const [admitPatientId, setAdmitPatientId] = useState('');
  const [admitDoctorName, setAdmitDoctorName] = useState(doctors[0]?.name || 'Dr. Sarah Jenkins, MD');

  const [transferBedSource, setTransferBedSource] = useState<WardBed | null>(null);
  const [transferTargetBedId, setTransferTargetBedId] = useState('');
  const [transferReason, setTransferReason] = useState('Step-down from ICU to General Ward for telemetry observation');
  const [transferNotes, setTransferNotes] = useState('Patient stable, oral medications tolerated, IV saline lock intact.');

  const [dischargeBedTarget, setDischargeBedTarget] = useState<WardBed | null>(null);
  const [dischargeVitals, setDischargeVitals] = useState('BP 122/78, Pulse 72 bpm, SpO2 99% on room air');
  const [dischargeAdvice, setDischargeAdvice] = useState('Follow up in Outpatient Cardiology Suite in 7 days. Continue prescribed oral medications.');
  const [printingSummary, setPrintingSummary] = useState<any | null>(null);

  const wards = [
    'all',
    'Intensive Care Unit (ICU)',
    'Cardiology Stepdown',
    'Surgical Post-Op',
    'General Medical Ward',
    'Emergency Observation',
  ];

  const filteredBeds = useMemo(() => {
    return wardBeds.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        b.bedNumber.toLowerCase().includes(q) ||
        b.wardName.toLowerCase().includes(q) ||
        (b.patientName && b.patientName.toLowerCase().includes(q)) ||
        (b.assignedDoctor && b.assignedDoctor.toLowerCase().includes(q));

      const matchesWard = selectedWard === 'all' || b.wardName === selectedWard;
      return matchesSearch && matchesWard;
    });
  }, [wardBeds, searchQuery, selectedWard]);

  const totalBeds = wardBeds.length;
  const occupiedBeds = wardBeds.filter((b) => b.status === 'Occupied').length;
  const availableBeds = wardBeds.filter((b) => b.status === 'Available').length;
  const maintenanceBeds = wardBeds.filter((b) => b.status === 'Maintenance').length;

  const availableBedsList = useMemo(() => {
    return wardBeds.filter((b) => b.status === 'Available');
  }, [wardBeds]);

  // Non-inpatient patients for direct admission
  const nonInpatientPatients = useMemo(() => {
    return patients.filter((p) => p.status !== 'Inpatient');
  }, [patients]);

  const handleExecuteAdmission = (e: React.FormEvent) => {
    e.preventDefault();
    if (!admitBed || !admitPatientId) return;

    admitPatientToBed(admitPatientId, admitBed.id, admitDoctorName);
    setAdmitBed(null);
    setAdmitPatientId('');
  };

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferBedSource || !transferBedSource.patientId || !transferTargetBedId) return;

    transferPatientBed(
      transferBedSource.patientId,
      transferTargetBedId,
      transferReason,
      transferNotes
    );
    setTransferBedSource(null);
  };

  const handleExecuteDischarge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dischargeBedTarget || !dischargeBedTarget.patientId) return;

    const patient = patients.find((p) => p.id === dischargeBedTarget.patientId);
    const admissionDate = dischargeBedTarget.admissionDate || new Date().toISOString().slice(0, 10);
    const dischargeDate = new Date().toISOString().slice(0, 10);

    const msPerDay = 1000 * 60 * 60 * 24;
    const stayDays = Math.max(
      1,
      Math.round(
        (new Date(dischargeDate).getTime() - new Date(admissionDate).getTime()) / msPerDay
      )
    );

    const summary = {
      patientName: dischargeBedTarget.patientName || patient?.firstName + ' ' + patient?.lastName,
      patientId: dischargeBedTarget.patientId,
      patientMrn: patient?.rgNo || dischargeBedTarget.patientId,
      patientDob: patient?.dob || 'Not recorded',
      patientGender: patient?.gender || 'Not recorded',
      wardName: dischargeBedTarget.wardName,
      bedNumber: dischargeBedTarget.bedNumber,
      admissionDate,
      dischargeDate,
      lengthOfStayDays: stayDays,
      attendingDoctor: dischargeBedTarget.assignedDoctor || 'Attending Physician',
      dischargeVitals,
      dischargeAdvice,
      dischargeMedications: (patient?.medications || []).map((m) => `${m.name} (${m.dosage})`),
    };

    dischargePatient(dischargeBedTarget.patientId);
    setPrintingSummary(summary);
    setDischargeBedTarget(null);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <BedDouble className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Hospital Ward Bed Management &amp; Room Census
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold uppercase">
              IPD CENSUS
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Real-time ICU and ward bed telemetry, direct inpatient admissions, inter-ward patient bed transfers, sanitized turn-around verification, and discharge summaries.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono">
            <span className="text-emerald-700 font-bold">{availableBeds} Ready</span>
            <span className="text-slate-300">|</span>
            <span className="text-rose-700 font-bold">{occupiedBeds} Occupied</span>
            <span className="text-slate-300">|</span>
            <span className="text-amber-700 font-bold">{maintenanceBeds} Sanitize</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTabLocal('census')}
            className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'census'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BedDouble className="w-3.5 h-3.5" />
            <span>Live Ward Beds &amp; Census</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'census' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {totalBeds}
            </span>
          </button>

          <button
            onClick={() => setActiveTabLocal('transfers')}
            className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'transfers'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Bed Transfer History Log</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'transfers' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {bedTransfers.length}
            </span>
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-mono pr-2 hidden sm:inline">
          OCCUPANCY RATE: {totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0}%
        </span>
      </div>

      {/* TAB 1: CENSUS & BED GRID */}
      {activeTab === 'census' && (
        <div className="space-y-4">
          {/* Ward Filter & Search Bar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between text-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search bed #, patient name, doctor, ward..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-[11px] font-semibold text-slate-400 shrink-0">Filter Ward:</span>
              {wards.map((w) => (
                <button
                  key={w}
                  onClick={() => setSelectedWard(w)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedWard === w
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {w === 'all' ? 'All Wards' : w.split(' (')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Bed Grid Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredBeds.map((bed) => {
              const isOccupied = bed.status === 'Occupied';
              return (
                <div
                  key={bed.id}
                  className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${
                    isOccupied
                      ? 'bg-white border-slate-200 shadow-sm'
                      : bed.status === 'Maintenance'
                      ? 'bg-amber-50/40 border-amber-200 shadow-2xs'
                      : 'bg-emerald-50/30 border-emerald-200 shadow-2xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <BedDouble className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{bed.bedNumber}</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isOccupied
                            ? 'bg-rose-100 text-rose-800'
                            : bed.status === 'Maintenance'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {bed.status}
                      </span>
                    </div>

                    <div className="text-[11px] font-semibold text-slate-700 mb-1">
                      {bed.wardName} · Room {bed.roomNumber || '101'}
                    </div>

                    {isOccupied && bed.patientName ? (
                      <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                          <span>{bed.patientName}</span>
                          <span className="text-[10px] text-slate-400 font-mono font-normal">
                            {bed.patientId}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Attending: <strong className="text-slate-700">{bed.assignedDoctor || 'Assigned MD'}</strong>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Admitted: <span className="font-mono">{bed.admissionDate}</span>
                        </div>
                        <div className="pt-1 border-t border-slate-200/80 flex items-center justify-between gap-1">
                          {bed.patientId && (
                            <button
                              onClick={() => {
                                onSelectPatient(bed.patientId!);
                                setActiveTab('patients');
                              }}
                              className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              <span>EMR Chart</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setTransferBedSource(bed);
                              setTransferTargetBedId(availableBedsList[0]?.id || '');
                            }}
                            className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowLeftRight className="w-2.5 h-2.5" />
                            <span>Transfer</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 p-3 rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-400">
                        {bed.status === 'Maintenance'
                          ? 'Under sterilization & sanitizing protocol'
                          : 'Bed sanitized & ready for patient admission'}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-1.5">
                    {isOccupied ? (
                      <button
                        onClick={() => setDischargeBedTarget(bed)}
                        className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-[11px] transition cursor-pointer"
                      >
                        Discharge &amp; Summary
                      </button>
                    ) : bed.status === 'Maintenance' ? (
                      <button
                        onClick={() => updateBedStatus(bed.id, 'Available')}
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold text-[11px] transition cursor-pointer"
                      >
                        Verify Ready &amp; Available
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setAdmitBed(bed);
                          setAdmitPatientId(nonInpatientPatients[0]?.id || '');
                        }}
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Admit Patient Here</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: BED TRANSFER AUDIT LOG */}
      {activeTab === 'transfers' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Inter-Ward Patient Bed Transfer Records ({bedTransfers.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Clinical Handover Audit</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <th className="py-2.5 px-3">Transfer ID</th>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Source Bed / Ward</th>
                  <th className="py-2.5 px-3">Destination Bed</th>
                  <th className="py-2.5 px-3">Transfer Reason</th>
                  <th className="py-2.5 px-3">Attending MD</th>
                  <th className="py-2.5 px-3">Date &amp; Time</th>
                  <th className="py-2.5 px-3">Transferred By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {bedTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No patient bed transfers logged yet during this session.
                    </td>
                  </tr>
                ) : (
                  bedTransfers.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-indigo-700">
                        {rec.id}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{rec.patientName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {rec.patientId}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{rec.fromBedNumber}</div>
                        <div className="text-[10px] text-slate-500">{rec.fromWard}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-indigo-700">{rec.toBedNumber}</div>
                        <div className="text-[10px] text-slate-500">{rec.toWard}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 max-w-xs">
                        <div>{rec.transferReason}</div>
                        {rec.clinicalHandoverNotes && (
                          <div className="text-[10px] text-slate-400 italic mt-0.5">
                            Handover: {rec.clinicalHandoverNotes}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                        {rec.attendingDoctor}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        <div>{rec.transferDate}</div>
                        <div className="text-[10px] text-slate-400">{rec.transferTime}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                        {rec.transferredBy}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADMIT PATIENT TO BED */}
      {admitBed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Direct Inpatient Admission</h3>
                <p className="text-[10px] text-slate-500">
                  Assign patient to {admitBed.wardName} · Bed {admitBed.bedNumber}
                </p>
              </div>
              <button onClick={() => setAdmitBed(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteAdmission} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Patient to Admit *</label>
                <select
                  required
                  value={admitPatientId}
                  onChange={(e) => setAdmitPatientId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                >
                  <option value="">-- Choose Patient --</option>
                  {nonInpatientPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} (MRN: {p.rgNo || p.id}) · {p.status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Attending Physician Rounding</label>
                <select
                  value={admitDoctorName}
                  onChange={(e) => setAdmitDoctorName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} ({d.specialty})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px]">
                Upon admission, patient status will switch to <strong>Inpatient</strong> and bed status will transition to <strong>Occupied</strong>.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdmitBed(null)}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!admitPatientId}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-sm disabled:opacity-50"
                >
                  Confirm Inpatient Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INTER-WARD BED TRANSFER */}
      {transferBedSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Transfer Patient to New Bed / Ward</h3>
                <p className="text-[10px] text-slate-500">
                  Patient: {transferBedSource.patientName} (Current: {transferBedSource.wardName} - {transferBedSource.bedNumber})
                </p>
              </div>
              <button onClick={() => setTransferBedSource(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Destination Available Bed *</label>
                <select
                  required
                  value={transferTargetBedId}
                  onChange={(e) => setTransferTargetBedId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                >
                  <option value="">-- Choose Target Available Bed --</option>
                  {availableBedsList.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bedNumber} ({b.wardName} - Room {b.roomNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Clinical Transfer Reason *</label>
                <input
                  type="text"
                  required
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nursing Handover Notes</label>
                <textarea
                  rows={2}
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 text-[11px]">
                Prior bed {transferBedSource.bedNumber} will be marked for <strong>Sanitization</strong> protocol, and an audit transfer log will be filed.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTransferBedSource(null)}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!transferTargetBedId}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-sm disabled:opacity-50"
                >
                  Execute Bed Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DISCHARGE & SUMMARY FORM */}
      {dischargeBedTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Inpatient Discharge Summary</h3>
                <p className="text-[10px] text-slate-500">
                  Clear bed {dischargeBedTarget.bedNumber} and generate discharge instructions
                </p>
              </div>
              <button onClick={() => setDischargeBedTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteDischarge} className="space-y-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Patient:</span>
                  <strong className="text-slate-900">{dischargeBedTarget.patientName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Admitted Date:</span>
                  <span className="font-mono">{dischargeBedTarget.admissionDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Attending Physician:</span>
                  <span>{dischargeBedTarget.assignedDoctor}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Discharge Vitals Snapshot</label>
                <input
                  type="text"
                  required
                  value={dischargeVitals}
                  onChange={(e) => setDischargeVitals(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Follow-Up Care &amp; Discharge Advice</label>
                <textarea
                  rows={3}
                  required
                  value={dischargeAdvice}
                  onChange={(e) => setDischargeAdvice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDischargeBedTarget(null)}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-sm"
                >
                  Authorize Discharge &amp; Print
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISCHARGE SUMMARY PRINT MODAL */}
      {printingSummary && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrintingSummary(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs select-none"
        >
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-300 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
              <span className="font-bold text-xs">Official Inpatient Discharge Summary</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1 shadow-sm transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Summary
                </button>
                <button onClick={() => setPrintingSummary(null)} className="p-1 rounded text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-8 bg-slate-50 flex-1 flex justify-center overflow-y-auto">
              <div className="bg-white border-2 border-slate-900 rounded-xl p-8 w-full text-slate-900 font-sans shadow-md print:shadow-none print:border-none print:p-0 text-xs">
                <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center">
                  <h1 className="text-base font-black tracking-tight uppercase">
                    Apex Health Systems &amp; Clinical Care
                  </h1>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">
                    Department of Inpatient Medicine · Official Discharge Summary
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 mb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-slate-500 text-[10px]">Patient:</span> <strong className="block text-slate-900 text-sm">{printingSummary.patientName}</strong></div>
                    <div><span className="text-slate-500 text-[10px]">MRN:</span> <span className="font-mono font-bold block">{printingSummary.patientMrn}</span></div>
                    <div><span className="text-slate-500 text-[10px]">Ward / Bed:</span> <span>{printingSummary.wardName} - {printingSummary.bedNumber}</span></div>
                    <div><span className="text-slate-500 text-[10px]">Length of Stay:</span> <strong className="font-mono">{printingSummary.lengthOfStayDays} Day(s)</strong></div>
                    <div><span className="text-slate-500 text-[10px]">Admission Date:</span> <span className="font-mono">{printingSummary.admissionDate}</span></div>
                    <div><span className="text-slate-500 text-[10px]">Discharge Date:</span> <span className="font-mono">{printingSummary.dischargeDate}</span></div>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <span className="font-bold uppercase text-[10px] text-slate-500 block mb-0.5">Discharge Physiological Vitals:</span>
                    <p className="font-mono font-semibold text-slate-800 bg-slate-50 p-2 rounded border border-slate-200">{printingSummary.dischargeVitals}</p>
                  </div>
                  <div>
                    <span className="font-bold uppercase text-[10px] text-slate-500 block mb-0.5">Discharge Advice &amp; Follow-up Instructions:</span>
                    <p className="text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">{printingSummary.dischargeAdvice}</p>
                  </div>
                  {printingSummary.dischargeMedications.length > 0 && (
                    <div>
                      <span className="font-bold uppercase text-[10px] text-slate-500 block mb-0.5">Discharge Medication Regimen:</span>
                      <ul className="list-disc pl-5 text-slate-700 space-y-0.5">
                        {printingSummary.dischargeMedications.map((m: string, i: number) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t-2 border-slate-900 flex justify-between items-end">
                  <div className="text-[10px] text-slate-400">
                    <div>Sanitized Bed Cleared for Intake</div>
                    <div className="font-mono">MEDCORE-IPD-DISCHARGE</div>
                  </div>
                  <div className="text-right">
                    <div className="border-b border-slate-400 w-36 ml-auto mb-1"></div>
                    <p className="font-bold">{printingSummary.attendingDoctor}</p>
                    <p className="text-[10px] text-slate-500">Attending Physician Sign-Off</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
