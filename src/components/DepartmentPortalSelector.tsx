import React from 'react';
import {
  Stethoscope,
  BedDouble,
  UserCheck,
  Phone,
  Calendar,
  Layers,
  ArrowRight,
  LogOut,
  ShieldCheck,
  HeartPulse,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { DepartmentPortal } from '../types';

interface DepartmentPortalSelectorProps {
  onPortalSelected?: (portal: DepartmentPortal) => void;
}

export const DepartmentPortalSelector: React.FC<DepartmentPortalSelectorProps> = ({
  onPortalSelected,
}) => {
  const {
    currentUser,
    patients,
    appointments,
    wardBeds,
    selectDepartmentPortal,
    logout,
  } = useHospital();

  const handleSelect = (portal: DepartmentPortal) => {
    selectDepartmentPortal(portal);
    if (onPortalSelected) onPortalSelected(portal);
  };

  const outpatientPatients = patients.filter((p) => p.status === 'Outpatient');
  const inpatientPatients = patients.filter((p) => p.status === 'Inpatient');
  const occupiedBeds = wardBeds.filter((b) => b.status === 'Occupied').length;
  const totalBeds = wardBeds.length;
  const bedPercent = Math.round((occupiedBeds / totalBeds) * 100);
  const activeConsultations = appointments.filter(
    (a) => a.status === 'In Consultation' || a.status === 'Checked-In'
  ).length;

  return (
    <div className="min-h-screen w-screen flex flex-col bg-slate-900 font-sans text-slate-100 antialiased relative overflow-y-auto">
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/80 backdrop-blur z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-blue-500/20">
            +
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">
                MEDCORE<span className="text-blue-500">OS</span>
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800/60 uppercase">
                Division Gateway
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              ApexHealth Hospital Information & Clinical Operations System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end text-xs">
            <span className="font-bold text-slate-200">{currentUser.name}</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
              {currentUser.role} · {currentUser.department}
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/50 text-blue-300 font-bold text-xs flex items-center justify-center">
            {currentUser.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)}
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            title="Log out from session"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-5xl mx-auto w-full z-10 my-auto">
        <div className="text-center mb-8 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-800/80 text-blue-300 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Authorized Clinical Session Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Select Hospital Care Division
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
            Choose your clinical workstation portal to manage Outpatient consultations or Inpatient admissions and ward beds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-8">
          {/* OPTION 1: CLINIC OUTPATIENT (OPD) */}
          <div
            id="portal-card-outpatient"
            onClick={() => handleSelect('outpatient')}
            className="group relative bg-slate-800/80 hover:bg-slate-800 border-2 border-emerald-500/30 hover:border-emerald-500 rounded-2xl p-6 sm:p-7 flex flex-col justify-between cursor-pointer transition-all duration-300 shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1"
          >
            <div className="absolute top-5 right-5">
              <span className="px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-700/60 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                OPD CLINIC
              </span>
            </div>
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Stethoscope className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors flex items-center gap-2">
                <span>Clinic Outpatient Department</span>
              </h2>
              <p className="text-xs font-semibold text-emerald-400 mt-0.5 mb-3">
                OPD Consultations, Doctor Queues & Patient Tokens
              </p>
              <p className="text-xs text-slate-300 leading-relaxed mb-5">
                Specialist doctor suites, outpatient walk-in tokens, rapid prescriptions, patient phone contacts, and scheduled consultations.
              </p>
              <div className="space-y-2 mb-6 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>Patient Token # with Doctor</strong> (Live consultation queue)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>Patient Phone Directory</strong> (Direct contact & SMS alerts)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span><strong>Specialist Slot Scheduling</strong> (Wait times & triage)</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-slate-900/80 border border-slate-700/60 mb-6 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Active OPD Queue</span>
                  <span className="text-base font-bold font-mono text-emerald-400">
                    {activeConsultations} In Waiting / Seen
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Outpatient Records</span>
                  <span className="text-base font-bold font-mono text-white">
                    {outpatientPatients.length} Patients
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="w-full py-3 px-4 bg-emerald-600 group-hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              <span>Launch Clinic Outpatient (OPD)</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* OPTION 2: HOSPITAL INPATIENT (IPD) */}
          <div
            id="portal-card-inpatient"
            onClick={() => handleSelect('inpatient')}
            className="group relative bg-slate-800/80 hover:bg-slate-800 border-2 border-indigo-500/30 hover:border-indigo-500 rounded-2xl p-6 sm:p-7 flex flex-col justify-between cursor-pointer transition-all duration-300 shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1"
          >
            <div className="absolute top-5 right-5">
              <span className="px-2.5 py-1 rounded-full bg-indigo-950 border border-indigo-700/60 text-indigo-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                IPD INPATIENT
              </span>
            </div>
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <BedDouble className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center gap-2">
                <span>Hospital Inpatient Department</span>
              </h2>
              <p className="text-xs font-semibold text-indigo-400 mt-0.5 mb-3">
                IPD Ward Admissions, Bed Allocations & Clinical Care
              </p>
              <p className="text-xs text-slate-300 leading-relaxed mb-5">
                Inpatient ward beds, assigned attending doctors, daily nursing shifts, telemetry vitals monitoring, and inpatient admission records.
              </p>
              <div className="space-y-2 mb-6 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <BedDouble className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span><strong>Ward Bed & Room Allocation</strong> (ICU, Cardio, Surgery)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span><strong>Attending Specialist Rounds</strong> (Assigned lead physician)</span>
                </div>
                <div className="flex items-center gap-2">
                  <HeartPulse className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span><strong>Continuous Nursing Telemetry</strong> (SpO2, BP, Vitals)</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-slate-900/80 border border-slate-700/60 mb-6 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Bed Occupancy</span>
                  <span className="text-base font-bold font-mono text-indigo-400">
                    {occupiedBeds} / {totalBeds} ({bedPercent}%)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Admitted Inpatients</span>
                  <span className="text-base font-bold font-mono text-white">
                    {inpatientPatients.length} Admitted
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="w-full py-3 px-4 bg-indigo-600 group-hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              <span>Launch Hospital Inpatient (IPD)</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <span className="font-bold text-slate-200 block">Need full hospital administrative access?</span>
              <span className="text-[11px] text-slate-400">
                View cross-department analytics, billing, pharmacy stock, and compliance.
              </span>
            </div>
          </div>
          <button
            onClick={() => handleSelect('overview')}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-lg font-bold text-xs transition shrink-0 cursor-pointer"
          >
            Open Full Hospital Overview →
          </button>
        </div>
      </main>

      <footer className="w-full py-3 text-center text-xs text-slate-500 border-t border-slate-800 bg-slate-900/90 z-20">
        ApexHealth MedCore Medical Center · Division Gateway Portal · Real-time HIPAA Compliant Session
      </footer>
    </div>
  );
};
