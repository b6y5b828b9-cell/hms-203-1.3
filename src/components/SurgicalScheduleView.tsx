import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Activity,
  User,
  Stethoscope,
  ShieldCheck,
  CheckSquare,
  Square,
  X,
  Droplet,
  Layers,
  ArrowRight,
  Printer,
  Sparkles,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { SurgicalCase, OperatingRoom, SurgicalStatus, BloodGroup } from '../types';

export const SurgicalScheduleView: React.FC = () => {
  const {
    patients,
    doctors,
    surgicalCases,
    addSurgicalCase,
    updateSurgicalStatus,
    updateWhoChecklist,
    currentRole,
    currentUser,
    addNotification,
  } = useHospital();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOr, setSelectedOr] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [activeChecklistCase, setActiveChecklistCase] = useState<SurgicalCase | null>(null);

  // New Case Form State
  const [patientId, setPatientId] = useState(patients[0]?.id || '');
  const [operatingRoom, setOperatingRoom] = useState<OperatingRoom>('OR 2 - Orthopedic & Trauma');
  const [procedureName, setProcedureName] = useState('Total Knee Arthroplasty (TKA)');
  const [cptCode, setCptCode] = useState('27447');
  const [leadSurgeonId, setLeadSurgeonId] = useState(doctors[1]?.id || 'DOC-102');
  const [anesthesiologistName, setAnesthesiologistName] = useState('Dr. Raymond Scott, MD (Anesthesiology)');
  const [anesthesiaType, setAnesthesiaType] = useState<SurgicalCase['anesthesiaType']>('General Anesthesia');
  const [scrubNurseName, setScrubNurseName] = useState('Nurse Jacqueline Chen, RN');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('08:30 AM');
  const [estimatedDurationMins, setEstimatedDurationMins] = useState(120);
  const [priority, setPriority] = useState<SurgicalCase['priority']>('Elective');
  const [bloodUnitsReserved, setBloodUnitsReserved] = useState(2);
  const [formError, setFormError] = useState('');

  const operatingRooms: OperatingRoom[] = [
    'OR 1 - Cardiothoracic Suite',
    'OR 2 - Orthopedic & Trauma',
    'OR 3 - General & Laparoscopy',
    'OR 4 - Day Surgery & Endoscopy',
  ];

  const selectedPatient = patients.find((p) => p.id === patientId) || patients[0];
  const selectedSurgeon = doctors.find((d) => d.id === leadSurgeonId) || doctors[0];

  const filteredCases = useMemo(() => {
    return surgicalCases.filter((sc) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        sc.procedureName.toLowerCase().includes(q) ||
        sc.cptCode.toLowerCase().includes(q) ||
        sc.patientName.toLowerCase().includes(q) ||
        sc.leadSurgeonName.toLowerCase().includes(q);

      const matchesOr = selectedOr === 'all' || sc.operatingRoom === selectedOr;
      const matchesStatus = selectedStatus === 'all' || sc.status === selectedStatus;
      return matchesSearch && matchesOr && matchesStatus;
    });
  }, [surgicalCases, searchQuery, selectedOr, selectedStatus]);

  const stats = useMemo(() => {
    return {
      total: surgicalCases.length,
      inOr: surgicalCases.filter((c) => c.status === 'In OR / Surgery').length,
      preOp: surgicalCases.filter((c) => c.status === 'Pre-Op Checklist').length,
      pacu: surgicalCases.filter((c) => c.status === 'Recovery PACU').length,
      completed: surgicalCases.filter((c) => c.status === 'Discharged to Ward').length,
    };
  }, [surgicalCases]);

  const handleCreateCaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!patientId || !selectedPatient) {
      setFormError('Please select a patient.');
      return;
    }
    if (!procedureName.trim()) {
      setFormError('Procedure name is required.');
      return;
    }

    addSurgicalCase({
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
      patientAge: selectedPatient.age,
      patientGender: selectedPatient.gender,
      bloodGroup: selectedPatient.bloodGroup,
      operatingRoom,
      procedureName: procedureName.trim(),
      cptCode: cptCode.trim() || 'SURG-PROC',
      leadSurgeonId: selectedSurgeon.id,
      leadSurgeonName: selectedSurgeon.name,
      anesthesiologistName,
      anesthesiaType,
      scrubNurseName,
      scheduledDate,
      startTime,
      estimatedDurationMins,
      priority,
      status: 'Scheduled',
      preOpChecklist: {
        npoConfirmed: false,
        consentSigned: true,
        bloodUnitsReserved,
        surgicalSiteMarked: false,
        anesthesiaCleared: true,
        allergiesReviewed: true,
      },
      whoSafetyChecklist: {
        signInCompleted: false,
        timeOutCompleted: false,
        signOutCompleted: false,
        spongeInstrumentCountVerified: false,
        specimenLabeled: false,
      },
      surgicalNotes: `Case scheduled in ${operatingRoom}. Attending surgeon: ${selectedSurgeon.name}.`,
    });

    setIsNewCaseModalOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Activity className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Operation Theatre (OT) &amp; Surgical Schedule Board
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold uppercase">
              WHO SAFETY PROTOCOL
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Live surgical suite scheduling, anesthesia readiness, WHO surgical safety checklists (Sign-In, Time-Out, Sign-Out), and Post-Anesthesia Care Unit (PACU) recovery tracking.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print OT Board</span>
          </button>
          <button
            onClick={() => setIsNewCaseModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Schedule Surgery</span>
          </button>
        </div>
      </div>

      {/* Live Status Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Scheduled Cases
          </span>
          <div className="text-2xl font-black font-mono text-slate-900 mt-1">{stats.total}</div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Across 4 Suites</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
            Pre-Op Checklist
          </span>
          <div className="text-2xl font-black font-mono text-amber-700 mt-1">{stats.preOp}</div>
          <span className="text-[10px] text-amber-700 mt-0.5 block">NPO &amp; Site Marking</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm">
          <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
            In OR / Active Surgery
          </span>
          <div className="text-2xl font-black font-mono text-rose-600 mt-1 flex items-center gap-1.5">
            <span>{stats.inOr}</span>
            {stats.inOr > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />}
          </div>
          <span className="text-[10px] text-rose-700 mt-0.5 block">Under Anesthesia</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 shadow-sm">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
            PACU Recovery
          </span>
          <div className="text-2xl font-black font-mono text-blue-600 mt-1">{stats.pacu}</div>
          <span className="text-[10px] text-blue-600 mt-0.5 block">Post-Op Telemetry</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
            Ward Discharged
          </span>
          <div className="text-2xl font-black font-mono text-emerald-600 mt-1">{stats.completed}</div>
          <span className="text-[10px] text-emerald-700 mt-0.5 block">Safe Recovery</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search procedure, CPT, patient, surgeon..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={selectedOr}
            onChange={(e) => setSelectedOr(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 text-xs font-medium text-slate-700"
          >
            <option value="all">All Operating Rooms (4 Suites)</option>
            {operatingRooms.map((room) => (
              <option key={room} value={room}>{room}</option>
            ))}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 text-xs font-medium text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Pre-Op Checklist">Pre-Op Checklist</option>
            <option value="In OR / Surgery">In OR / Active</option>
            <option value="Recovery PACU">Recovery (PACU)</option>
            <option value="Discharged to Ward">Discharged to Ward</option>
          </select>
        </div>
      </div>

      {/* Surgical Cases Cards / Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCases.length === 0 ? (
          <div className="md:col-span-2 bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400 text-xs">
            No surgical cases found for this query or theatre filter. Click "+ Schedule Surgery" to book a case.
          </div>
        ) : (
          filteredCases.map((sc) => {
            const isSurgeryActive = sc.status === 'In OR / Surgery';
            const isPacu = sc.status === 'Recovery PACU';
            const whoCompleted =
              sc.whoSafetyChecklist.signInCompleted &&
              sc.whoSafetyChecklist.timeOutCompleted &&
              sc.whoSafetyChecklist.signOutCompleted;

            return (
              <div
                key={sc.id}
                className={`bg-white rounded-xl border p-4 shadow-sm flex flex-col justify-between transition-all ${
                  isSurgeryActive
                    ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/10'
                    : isPacu
                    ? 'border-blue-400 bg-blue-50/10'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Top Suite & Status Bar */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {sc.operatingRoom.split(' - ')[0]}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600 truncate">
                        {sc.operatingRoom.split(' - ')[1]}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        sc.status === 'In OR / Surgery'
                          ? 'bg-rose-600 text-white animate-pulse'
                          : sc.status === 'Recovery PACU'
                          ? 'bg-blue-600 text-white'
                          : sc.status === 'Pre-Op Checklist'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : sc.status === 'Discharged to Ward'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {sc.status}
                    </span>
                  </div>

                  {/* Procedure Title & CPT */}
                  <div className="my-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-sm text-slate-900">{sc.procedureName}</h3>
                      <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-600 font-bold">
                        CPT {sc.cptCode}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          sc.priority === 'Emergency STAT'
                            ? 'bg-rose-100 text-rose-800'
                            : sc.priority === 'Urgent'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {sc.priority}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                      <span>
                        Patient: <strong className="text-slate-800">{sc.patientName}</strong> ({sc.patientAge}y {sc.patientGender})
                      </span>
                      <span>
                        Blood: <strong className="text-rose-600 font-mono">{sc.bloodGroup}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Clinical Team & Schedule Box */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs mb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Lead Surgeon:</span>
                      <span className="font-bold text-slate-800 truncate block">{sc.leadSurgeonName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Anesthesia:</span>
                      <span className="font-medium text-slate-700 truncate block">{sc.anesthesiaType}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Schedule / Slot:</span>
                      <span className="font-medium text-slate-800 font-mono text-[11px]">
                        {sc.scheduledDate} at {sc.startTime} ({sc.estimatedDurationMins}m)
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Blood Reserved:</span>
                      <span className="font-bold font-mono text-emerald-700 flex items-center gap-1">
                        <Droplet className="w-3 h-3 text-rose-500" />
                        {sc.preOpChecklist.bloodUnitsReserved} Units Crossmatched
                      </span>
                    </div>
                  </div>

                  {/* WHO Surgical Safety Checklist Indicator */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50/60 border border-indigo-200 text-xs">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-700" />
                      <div>
                        <span className="font-bold text-indigo-900 block text-[11px]">WHO Surgical Safety Checklist</span>
                        <div className="flex items-center gap-2 text-[10px] text-indigo-800 mt-0.5">
                          <span className={sc.whoSafetyChecklist.signInCompleted ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                            ✓ Sign-In
                          </span>
                          <span>·</span>
                          <span className={sc.whoSafetyChecklist.timeOutCompleted ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                            ✓ Time-Out
                          </span>
                          <span>·</span>
                          <span className={sc.whoSafetyChecklist.signOutCompleted ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                            ✓ Sign-Out
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveChecklistCase(sc)}
                      className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-300 rounded text-[11px] font-bold transition cursor-pointer"
                    >
                      Inspect / Check
                    </button>
                  </div>
                </div>

                {/* Workflow Progression Controls */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">ID: {sc.id}</span>
                  <div className="flex items-center gap-1.5">
                    {sc.status === 'Scheduled' && (
                      <button
                        onClick={() => updateSurgicalStatus(sc.id, 'Pre-Op Checklist')}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold transition cursor-pointer"
                      >
                        Start Pre-Op Check
                      </button>
                    )}
                    {sc.status === 'Pre-Op Checklist' && (
                      <button
                        onClick={() => updateSurgicalStatus(sc.id, 'In OR / Surgery')}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Activity className="w-3 h-3" />
                        <span>Send to OR (Commence)</span>
                      </button>
                    )}
                    {sc.status === 'In OR / Surgery' && (
                      <button
                        onClick={() => updateSurgicalStatus(sc.id, 'Recovery PACU')}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition cursor-pointer"
                      >
                        Complete OR → PACU
                      </button>
                    )}
                    {sc.status === 'Recovery PACU' && (
                      <button
                        onClick={() => updateSurgicalStatus(sc.id, 'Discharged to Ward')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Clear PACU to Ward</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: WHO SURGICAL SAFETY CHECKLIST MODAL */}
      {activeChecklistCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">WHO Surgical Safety Checklist</h3>
                  <p className="text-[10px] text-slate-300">
                    {activeChecklistCase.procedureName} · {activeChecklistCase.patientName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveChecklistCase(null)}
                className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* STAGE 1: SIGN IN (Before Induction of Anesthesia) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                    <span>Stage 1: Sign-In (Before Anesthesia Induction)</span>
                  </h4>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeChecklistCase.whoSafetyChecklist.signInCompleted}
                      onChange={(e) =>
                        updateWhoChecklist(activeChecklistCase.id, {
                          signInCompleted: e.target.checked,
                        })
                      }
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span className="font-bold text-[11px] text-indigo-900">Mark Completed</span>
                  </label>
                </div>
                <div className="space-y-1 text-slate-600 pl-5 text-[11px]">
                  <p>• Patient identity, surgical site, and operative consent confirmed</p>
                  <p>• Operative site marked / Not applicable</p>
                  <p>• Anesthesia machine and medication safety check complete</p>
                  <p>• Pulse oximeter on patient and functioning</p>
                  <p>• Patient known allergy status actively reviewed by team</p>
                  <p>• Airway risk / aspiration evaluation complete; equipment available</p>
                </div>
              </div>

              {/* STAGE 2: TIME OUT (Before Skin Incision) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                    <span>Stage 2: Time-Out (Immediately Before Skin Incision)</span>
                  </h4>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeChecklistCase.whoSafetyChecklist.timeOutCompleted}
                      onChange={(e) =>
                        updateWhoChecklist(activeChecklistCase.id, {
                          timeOutCompleted: e.target.checked,
                        })
                      }
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span className="font-bold text-[11px] text-indigo-900">Mark Completed</span>
                  </label>
                </div>
                <div className="space-y-1 text-slate-600 pl-5 text-[11px]">
                  <p>• Entire surgical team introduced by name and clinical role</p>
                  <p>• Surgeon, Anesthetist &amp; Nurse verbally confirm patient, site, &amp; procedure</p>
                  <p>• Anticipated critical events, operative duration, &amp; blood loss reviewed</p>
                  <p>• Antibiotic prophylaxis administered within previous 60 minutes</p>
                  <p>• Essential diagnostic imaging displayed in theatre suite</p>
                </div>
              </div>

              {/* STAGE 3: SIGN OUT (Before Patient Leaves Operating Room) */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Stage 3: Sign-Out (Before Patient Leaves OR Suite)</span>
                  </h4>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeChecklistCase.whoSafetyChecklist.signOutCompleted}
                      onChange={(e) =>
                        updateWhoChecklist(activeChecklistCase.id, {
                          signOutCompleted: e.target.checked,
                        })
                      }
                      className="rounded border-slate-300 text-indigo-600"
                    />
                    <span className="font-bold text-[11px] text-indigo-900">Mark Completed</span>
                  </label>
                </div>
                <div className="space-y-1 text-slate-600 pl-5 text-[11px]">
                  <p>• Nurse verbally confirms: Name of the procedure recorded</p>
                  <p>• Instrument, sponge, and needle counts verified complete &amp; correct</p>
                  <p>• Surgical specimen labeled (including patient name &amp; tissue origin)</p>
                  <p>• Surgeon &amp; Anesthetist review key recovery and PACU management concerns</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveChecklistCase(null)}
                className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg font-bold text-xs cursor-pointer"
              >
                Save &amp; Close Checklist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SCHEDULE NEW SURGERY */}
      {isNewCaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center font-bold">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Schedule Surgical Procedure</h3>
                  <p className="text-[10px] text-slate-300">Reserve Operating Theatre Suite &amp; Surgical Team</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewCaseModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCaseSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Patient and Theatre */}
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
                        {p.firstName} {p.lastName} ({p.id}) — {p.age}y {p.gender} (Blood: {p.bloodGroup})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Operating Theatre Suite *</label>
                  <select
                    value={operatingRoom}
                    onChange={(e) => setOperatingRoom(e.target.value as OperatingRoom)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                    required
                  >
                    {operatingRooms.map((or) => (
                      <option key={or} value={or}>{or}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Procedure Name and CPT */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Procedure Name *</label>
                  <input
                    type="text"
                    required
                    value={procedureName}
                    onChange={(e) => setProcedureName(e.target.value)}
                    placeholder="e.g. Laparoscopic Cholecystectomy"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">CPT Code</label>
                  <input
                    type="text"
                    value={cptCode}
                    onChange={(e) => setCptCode(e.target.value)}
                    placeholder="e.g. 47562"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Surgical Team */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lead Surgeon *</label>
                  <select
                    value={leadSurgeonId}
                    onChange={(e) => setLeadSurgeonId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.specialty})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Anesthesiologist</label>
                  <input
                    type="text"
                    value={anesthesiologistName}
                    onChange={(e) => setAnesthesiologistName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Anesthesia Modality</label>
                  <select
                    value={anesthesiaType}
                    onChange={(e) => setAnesthesiaType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                  >
                    <option value="General Anesthesia">General Anesthesia</option>
                    <option value="Spinal / Epidural">Spinal / Epidural</option>
                    <option value="Regional Block">Regional Block</option>
                    <option value="MAC / Conscious Sedation">MAC / Conscious Sedation</option>
                    <option value="Local Anesthesia">Local Anesthesia</option>
                  </select>
                </div>
              </div>

              {/* Schedule, Duration & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Surgery Date</label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="text"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="e.g. 09:30 AM"
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Est. Duration (Mins)</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={estimatedDurationMins}
                    onChange={(e) => setEstimatedDurationMins(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Blood Units Reserved</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={bloodUnitsReserved}
                    onChange={(e) => setBloodUnitsReserved(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono font-bold text-rose-600"
                  />
                </div>
              </div>

              {/* Priority Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Case Urgency Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Elective', 'Urgent', 'Emergency STAT'] as const).map((pr) => (
                    <button
                      type="button"
                      key={pr}
                      onClick={() => setPriority(pr)}
                      className={`py-2 rounded-lg font-bold text-center border transition cursor-pointer ${
                        priority === pr
                          ? pr === 'Emergency STAT'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : pr === 'Urgent'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {pr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewCaseModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Schedule Case</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
