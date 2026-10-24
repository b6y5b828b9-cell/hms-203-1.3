import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  Stethoscope,
  Activity,
  ArrowRight,
  AlertCircle,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { staff, login } = useHospital();
  const [selectedUserId, setSelectedUserId] = useState<string>('STF-02');
  const [password, setPassword] = useState<string>('cardio123');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const quickProfiles = [
    {
      id: 'STF-02',
      name: 'Dr. Sarah Jenkins, MD',
      role: 'Attending Cardiologist',
      dept: 'Cardiovascular OPD & IPD',
      pass: 'cardio123',
      color: 'border-blue-500 bg-blue-50/50 text-blue-900',
      tag: 'OPD & Inpatient Doctor',
    },
    {
      id: 'STF-01',
      name: 'Dr. Julian Thorne, MD',
      role: 'Emergency Physician',
      dept: 'Trauma & Emergency (ER)',
      pass: 'doctor123',
      color: 'border-rose-500 bg-rose-50/50 text-rose-900',
      tag: 'Emergency Specialist',
    },
    {
      id: 'STF-03',
      name: 'Nurse Jacqueline Chen, RN',
      role: 'Charge Nurse',
      dept: 'Intensive Care Unit (ICU)',
      pass: 'nurse123',
      color: 'border-indigo-500 bg-indigo-50/50 text-indigo-900',
      tag: 'Inpatient Ward Nursing',
    },
    {
      id: 'STF-06',
      name: 'Chloe Bennett',
      role: 'Outpatient Receptionist',
      dept: 'OPD Admissions Desk',
      pass: 'reception123',
      color: 'border-emerald-500 bg-emerald-50/50 text-emerald-900',
      tag: 'OPD Tokens & Check-In',
    },
    {
      id: 'STF-07',
      name: 'Robert Stirling, MBA',
      role: 'Hospital Administrator',
      dept: 'Clinical Operations & Admin',
      pass: 'admin123',
      color: 'border-slate-500 bg-slate-50/50 text-slate-900',
      tag: 'Executive Access',
    },
    {
      id: 'STF-08',
      name: 'Morgan Ellis, RHIT',
      role: 'Medical Coder',
      dept: 'Medical Coding & Insurance Review',
      pass: 'coder123',
      color: 'border-teal-500 bg-teal-50/50 text-teal-900',
      tag: 'Insurance & Report Publishing',
    },
  ];

  const currentSelectedStaff = staff.find(
    (s) => s.id.toLowerCase() === selectedUserId.trim().toLowerCase()
  );

  const handleSelectQuickProfile = (profile: (typeof quickProfiles)[0]) => {
    setSelectedUserId(profile.id);
    setPassword(profile.pass);
    setErrorMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!selectedUserId.trim()) {
      setErrorMessage('Please select or input a valid Staff ID.');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('Please enter your access password.');
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      const result = login(selectedUserId, password);
      setIsLoading(false);
      if (result.success) {
        if (onLoginSuccess) onLoginSuccess();
      } else {
        setErrorMessage(result.message || 'Authentication failed. Please verify credentials.');
      }
    }, 350);
  };

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
                Enterprise v4.3
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              ApexHealth Hospital Information & Clinical Operations System
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Clinical Gateway Online
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            HIPAA & HITECH Certified
          </span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 my-auto">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-5 bg-slate-800/70 border border-slate-700/60 rounded-xl p-5 flex flex-col justify-between backdrop-blur shadow-2xl">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Stethoscope className="w-4 h-4 text-blue-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Quick Staff Directory Logins
                </h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Click any on-duty physician, nurse, or administrator profile to auto-fill verified credentials:
              </p>
              <div className="space-y-2">
                {quickProfiles.map((p) => {
                  const isSelected = selectedUserId.toLowerCase() === p.id.toLowerCase();
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectQuickProfile(p)}
                      className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-blue-950/70 border-blue-500 text-white shadow-md shadow-blue-500/10'
                          : 'bg-slate-900/60 border-slate-700/70 hover:border-slate-500 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white flex items-center gap-1.5">
                          {p.name}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {p.id}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                        <span className="truncate">{p.role}</span>
                        <span className="text-[10px] text-blue-400 font-semibold">{p.tag}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-700/70 text-[11px] text-slate-400 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
              <span>ApexHealth Medical Center · Main Hospital Campus</span>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white text-slate-900 rounded-xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl border border-slate-200">
            <div>
              <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold mb-2">
                  <Lock className="w-3 h-3 text-blue-600" />
                  <span>Secure Clinical Authorization</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Hospital Staff Sign In
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Access patient electronic health records, OPD consultation queues, and inpatient ward admissions.
                </p>
                <p className="mt-3 max-w-xl border-l-2 border-teal-600 pl-3 text-xs leading-relaxed text-teal-900">
                  Experience peace of mind with NABIDH-certified electronic medical records and a clinic management platform licensed by the Dubai Health Authority.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Staff ID / Username
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      id="input-staff-user-id"
                      value={selectedUserId}
                      onChange={(e) => {
                        setSelectedUserId(e.target.value);
                        setErrorMessage(null);
                      }}
                      placeholder="e.g. STF-01, STF-02, or STF-06"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2.5 pl-9 pr-28 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                      required
                    />
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                      <select
                        aria-label="Select registered staff"
                        value={selectedUserId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedUserId(val);
                          const matched = quickProfiles.find((q) => q.id === val);
                          if (matched) setPassword(matched.pass);
                          setErrorMessage(null);
                        }}
                        className="bg-white border border-slate-300 rounded text-[11px] py-1 px-1 text-slate-700 focus:outline-none cursor-pointer"
                      >
                        <option value="">Select ID...</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.id} ({s.name.split(' ')[0]})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {currentSelectedStaff && (
                    <div className="mt-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-[11px] text-slate-700 flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {currentSelectedStaff.name}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 uppercase">
                        {currentSelectedStaff.role} · {currentSelectedStaff.department}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Security Password
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Demo: {password || 'any text'}</span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="input-staff-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMessage(null);
                      }}
                      placeholder="Enter access password"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2.5 pl-9 pr-10 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  id="btn-submit-staff-login"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Activity className="w-4 h-4 animate-spin" />
                      <span>Authenticating Clinical Session...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Hospital System</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 text-slate-500 text-[11px] flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Encrypted 256-bit AES · Zero Trust Network</span>
              </div>
              <span className="font-mono text-[10px] text-slate-400">
                AUDIT LOG RECORDED
              </span>
            </div>
          </div>
        </div>
      </div>

      <footer className="w-full py-3 text-center text-xs text-slate-500 border-t border-slate-800 bg-slate-900/90 z-20">
        MedCore OS Enterprise Edition · Authorized Healthcare Personnel Only · Confidential Patient Health Information
      </footer>
    </div>
  );
};
