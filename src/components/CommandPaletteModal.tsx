import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  User,
  Activity,
  UserPlus,
  CalendarPlus,
  ReceiptText,
  DollarSign,
  BedDouble,
  FlaskConical,
  Pill,
  LayoutDashboard,
  Calendar,
  CreditCard,
  BarChart3,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Database,
  Download,
  Droplet,
} from 'lucide-react';
import { useHospital, NavigationTab } from '../context/HospitalContext';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewPatient: () => void;
  onOpenNewAppointment: () => void;
  onOpenNewInvoice: () => void;
  onOpenTriage: () => void;
  onOpenPriceList: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onOpenNewPatient,
  onOpenNewAppointment,
  onOpenNewInvoice,
  onOpenTriage,
  onOpenPriceList,
}) => {
  const {
    patients,
    currentRole,
    setActiveTab,
    setSelectedPatientId,
    departmentPortal,
    setShowBackupReminderModal,
    performDatabaseBackup,
  } = useHospital();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const matchingPatients = query.trim()
    ? patients.filter(
        (p) =>
          p.firstName.toLowerCase().includes(query.toLowerCase()) ||
          p.lastName.toLowerCase().includes(query.toLowerCase()) ||
          p.id.toLowerCase().includes(query.toLowerCase()) ||
          p.phone.includes(query) ||
          p.chronicConditions.some((c) => c.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 5)
    : patients.slice(0, 4);

  const quickActions = [
    {
      id: 'action-triage',
      title: 'Rapid Emergency Triage (STAT Assessment)',
      category: 'Quick Action',
      icon: Activity,
      color: 'text-rose-600 bg-rose-50',
      action: () => {
        onClose();
        onOpenTriage();
      },
    },
    {
      id: 'action-admit',
      title: 'Admit New Patient (IPD / OPD Registration)',
      category: 'Quick Action',
      icon: UserPlus,
      color: 'text-blue-600 bg-blue-50',
      action: () => {
        onClose();
        onOpenNewPatient();
      },
    },
    {
      id: 'action-appointment',
      title: 'Book Doctor Appointment Slot',
      category: 'Quick Action',
      icon: CalendarPlus,
      color: 'text-emerald-600 bg-emerald-50',
      action: () => {
        onClose();
        onOpenNewAppointment();
      },
    },
    {
      id: 'action-invoice',
      title: 'Generate Billing Invoice & Claim',
      category: 'Quick Action',
      icon: ReceiptText,
      color: 'text-amber-600 bg-amber-50',
      action: () => {
        onClose();
        onOpenNewInvoice();
      },
    },
    {
      id: 'action-pricelist',
      title: 'Hospital Tariff & Price List (IPD / OPD Fees)',
      category: 'Quick Action',
      icon: DollarSign,
      color: 'text-indigo-600 bg-indigo-50',
      action: () => {
        onClose();
        onOpenPriceList();
      },
    },
    {
      id: 'action-backup-reminder',
      title: '24-Hour Database Backup & Compliance Reminder (Admin)',
      category: 'Database Backup',
      icon: Database,
      color: 'text-blue-600 bg-blue-50',
      action: () => {
        onClose();
        setShowBackupReminderModal(true);
      },
    },
    {
      id: 'action-backup-export-json',
      title: 'Export Full Database Snapshot (.JSON)',
      category: 'Database Backup',
      icon: Download,
      color: 'text-emerald-600 bg-emerald-50',
      action: () => {
        onClose();
        performDatabaseBackup('json');
      },
    },
  ].filter(
    (action) =>
      (currentRole !== 'doctor' || action.id !== 'action-admit') &&
      (action.title.toLowerCase().includes(query.toLowerCase()) ||
        action.category.toLowerCase().includes(query.toLowerCase()))
  );

  const navShortcuts = [
    { id: 'overview' as NavigationTab, label: 'Dashboard Operations', icon: LayoutDashboard },
    { id: 'registration' as NavigationTab, label: 'Patient Registration & Intake', icon: UserPlus },
    { id: 'medical-records' as NavigationTab, label: 'Patient Medical Record (Master Dossier)', icon: User },
    { id: 'certificates' as NavigationTab, label: 'Medical Certificates & Sick Leave Attestations', icon: User },
    { id: 'ot-schedule' as NavigationTab, label: 'Operating Theatre (OT) & Surgery Board', icon: Activity },
    { id: 'blood-bank' as NavigationTab, label: 'Blood Bank & Crossmatch Registry', icon: Droplet },
    { id: 'triage' as NavigationTab, label: 'Nurse Triage Station (STAT / NEWS2)', icon: Activity },
    { id: 'patients' as NavigationTab, label: 'Doctor EMR & Clinical Records', icon: User },
    { id: 'inpatient' as NavigationTab, label: 'Inpatient Department (IPD)', icon: BedDouble },
    { id: 'outpatient' as NavigationTab, label: 'Outpatient Clinic (OPD)', icon: User },
    { id: 'appointments' as NavigationTab, label: 'Appointment Scheduling & Queue', icon: Calendar },
    { id: 'pricelist' as NavigationTab, label: 'Hospital Price Schedule & Tariffs', icon: DollarSign },
    { id: 'billing' as NavigationTab, label: 'Billing, Invoicing & Claims', icon: CreditCard },
    { id: 'labs' as NavigationTab, label: 'Laboratory Diagnostics & Findings', icon: FlaskConical },
    { id: 'pharmacy' as NavigationTab, label: 'Pharmacy Dispensary & eRx Queue', icon: Pill },
    { id: 'reports' as NavigationTab, label: 'Analytical Reports & Audits', icon: BarChart3 },
    { id: 'admin' as NavigationTab, label: 'Administration & Compliance', icon: ShieldCheck },
  ]
    .filter((n) => departmentPortal !== 'outpatient' || (n.id !== 'inpatient'))
    .filter((n) => n.label.toLowerCase().includes(query.toLowerCase()));

  const allItems: Array<{
    type: 'patient' | 'action' | 'nav';
    id: string;
    onSelect: () => void;
  }> = [
    ...matchingPatients.map((p) => ({
      type: 'patient' as const,
      id: p.id,
      onSelect: () => {
        setSelectedPatientId(p.id);
        setActiveTab('patients');
        onClose();
      },
    })),
    ...quickActions.map((a) => ({
      type: 'action' as const,
      id: a.id,
      onSelect: a.action,
    })),
    ...navShortcuts.map((n) => ({
      type: 'nav' as const,
      id: n.id,
      onSelect: () => {
        setActiveTab(n.id);
        onClose();
      },
    })),
  ];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < allItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : allItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].onSelect();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 p-4 z-50 animate-in fade-in duration-100 select-none"
    >
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[80vh]"
        onKeyDown={handleKeyDown}
      >
        <div className="p-3 border-b border-slate-200 flex items-center gap-3 bg-slate-50/70">
          <Search className="w-5 h-5 text-blue-600 shrink-0 ml-1" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a patient name, MRN, procedure, or action (e.g., 'triage', 'admit', 'billing')..."
            className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          {query ? (
            <button onClick={() => setQuery('')} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded text-slate-500 shadow-2xs">
              ESC
            </kbd>
          )}
        </div>

        <div className="p-3 overflow-y-auto space-y-4 divide-y divide-slate-100 flex-1">
          {matchingPatients.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-slate-400 px-2 tracking-wider flex items-center justify-between">
                <span>Matching Patients ({matchingPatients.length})</span>
                <span className="text-[9px] lowercase font-normal text-slate-400">jump to EMR</span>
              </div>
              <div className="space-y-1">
                {matchingPatients.map((patient, idx) => {
                  const globalIdx = idx;
                  const isHighlighted = selectedIndex === globalIdx;
                  return (
                    <div
                      key={patient.id}
                      onClick={() => {
                        setSelectedPatientId(patient.id);
                        setActiveTab('patients');
                        onClose();
                      }}
                      className={`p-2.5 rounded-lg cursor-pointer transition flex items-center justify-between ${
                        isHighlighted ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center font-mono">
                          {patient.bloodGroup}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <span>{patient.firstName} {patient.lastName}</span>
                            <span className="font-mono text-[10px] text-blue-600 font-semibold">{patient.id}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {patient.gender} · {patient.age}y · Dr. {patient.primaryPhysicianName} · {patient.phone}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                            patient.status === 'Emergency'
                              ? 'bg-rose-100 text-rose-700'
                              : patient.status === 'Inpatient'
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {patient.status}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {quickActions.length > 0 && (
            <div className="pt-3 space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-slate-400 px-2 tracking-wider">
                Quick Actions
              </div>
              <div className="space-y-1">
                {quickActions.map((action, idx) => {
                  const globalIdx = matchingPatients.length + idx;
                  const isHighlighted = selectedIndex === globalIdx;
                  const Icon = action.icon;
                  return (
                    <div
                      key={action.id}
                      onClick={action.action}
                      className={`p-2.5 rounded-lg cursor-pointer transition flex items-center justify-between ${
                        isHighlighted ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-md ${action.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold text-slate-800">{action.title}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">Trigger</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {navShortcuts.length > 0 && (
            <div className="pt-3 space-y-1.5">
              <div className="text-[10px] uppercase font-bold text-slate-400 px-2 tracking-wider">
                Hospital Navigation Modules
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {navShortcuts.map((nav, idx) => {
                  const globalIdx = matchingPatients.length + quickActions.length + idx;
                  const isHighlighted = selectedIndex === globalIdx;
                  const Icon = nav.icon;
                  return (
                    <div
                      key={nav.id}
                      onClick={() => {
                        setActiveTab(nav.id);
                        onClose();
                      }}
                      className={`p-2 rounded-lg cursor-pointer transition flex items-center gap-2.5 ${
                        isHighlighted ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-xs font-medium text-slate-700 truncate">{nav.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-mono">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px]">↓</kbd> to navigate
            </span>
          </div>
          <div className="flex items-center gap-1 text-blue-600 font-semibold">
            <Sparkles className="w-3 h-3" />
            <span>Fast Clinical Access</span>
          </div>
        </div>
      </div>
    </div>
  );
};
