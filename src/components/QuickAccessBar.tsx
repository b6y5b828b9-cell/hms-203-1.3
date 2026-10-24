import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  UserPlus,
  CalendarPlus,
  CalendarClock,
  ReceiptText,
  DollarSign,
  Search,
  Palette,
  BedDouble,
  UserCheck,
  ArrowLeftRight,
  ShieldCheck,
  Stethoscope,
  Database,
  RotateCcw,
  ChevronDown,
  Plus,
  HeartPulse,
  CreditCard,
  FlaskConical,
  Pill,
  Clock,
  Sparkles,
  FileCheck2,
  FileText,
  Droplet,
} from 'lucide-react';
import { useHospital, NavigationTab } from '../context/HospitalContext';
import { getThemeClasses, normalizeTheme } from '../utils/theme';

interface QuickAccessBarProps {
  onOpenNewPatient: () => void;
  onOpenNewAppointment: () => void;
  onOpenNewInvoice: () => void;
  onOpenTriage: () => void;
  onOpenPriceList: () => void;
  onOpenThemeModal: () => void;
  onOpenCommandPalette: () => void;
}

export const QuickAccessBar: React.FC<QuickAccessBarProps> = ({
  onOpenNewPatient,
  onOpenNewAppointment,
  onOpenNewInvoice,
  onOpenTriage,
  onOpenPriceList,
  onOpenThemeModal,
  onOpenCommandPalette,
}) => {
  const {
    activeTab,
    setActiveTab,
    currentRole,
    departmentPortal,
    setShowPortalSelect,
    appTheme,
    patients,
    isBackupOverdue,
    setShowBackupReminderModal,
  } = useHospital();

  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setIsActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const themeClasses = getThemeClasses(appTheme);
  const isDark = normalizeTheme(appTheme) === 'dark';
  const emergencyCount = patients.filter((p) => p.status === 'Emergency').length;

  const tabMeta: Partial<
    Record<
      NavigationTab,
      { category: string; title: string; subtitle: string; icon: React.ElementType }
    >
  > = {
    registration: {
      category: 'Patient Care',
      title: 'Patient Registration',
      subtitle: 'Patient demographic intake and registration records',
      icon: UserPlus,
    },
    'medical-records': {
      category: 'Patient Care',
      title: 'Patient Medical Record',
      subtitle: 'Permanent medical record, personal details, insurance & clinical history management',
      icon: FileText,
    },
    certificates: {
      category: 'Patient Care',
      title: 'Medical Certificates & Sick Leave',
      subtitle: 'Certified sick leave attestations, fitness to resume work, and official exemptions',
      icon: FileText,
    },
    'ot-schedule': {
      category: 'Clinical Services',
      title: 'Operating Theatre & Surgery Board',
      subtitle: 'Surgical suite schedule, anesthesia readiness, and WHO surgical safety checklists',
      icon: Activity,
    },
    'blood-bank': {
      category: 'Clinical Services',
      title: 'Blood Bank & Crossmatch Registry',
      subtitle: 'Donor component inventory (PRBC, FFP, Platelets) and compatibility testing',
      icon: Droplet,
    },
    'billing-dues': {
      category: 'Billing',
      title: 'Due Settlement',
      subtitle: 'Review and settle outstanding patient balances',
      icon: CreditCard,
    },
    'billing-advance': {
      category: 'Billing',
      title: 'Advance Payment',
      subtitle: 'Record and manage advance deposits',
      icon: DollarSign,
    },
    'billing-refunds': {
      category: 'Billing',
      title: 'Refund',
      subtitle: 'Process approved patient refunds',
      icon: RotateCcw,
    },
    'billing-pos': {
      category: 'Billing',
      title: 'POS Transactions',
      subtitle: 'Review payment terminals, cash drawer activity, and settlement records',
      icon: CreditCard,
    },
    'insurance-approvals': {
      category: 'Billing',
      title: 'Insurance Approval',
      subtitle: 'Review insurance claims and authorization status',
      icon: ShieldCheck,
    },
    overview: {
      category: 'Patient Care',
      title: 'Operations Dashboard',
      subtitle: 'Hospital-wide bed capacity, patient flow, and clinical telemetry indicators',
      icon: Activity,
    },
    triage: {
      category: 'Patient Care',
      title: 'Nurse Emergency Triage Station',
      subtitle: 'Rapid intake acuity stratification, physiological telemetry, and clinical disposition',
      icon: Activity,
    },
    patients: {
      category: 'Patient Care',
      title: 'Patient Electronic Medical Records (EMR)',
      subtitle: 'Attending physician notes, vital telemetry trends, laboratory findings, and prescriptions',
      icon: Stethoscope,
    },
    inpatient: {
      category: 'Patient Care',
      title: 'Inpatient Department (IPD)',
      subtitle: 'Ward room allocations, continuous telemetry monitoring, and inpatient care roster',
      icon: BedDouble,
    },
    outpatient: {
      category: 'Patient Care',
      title: 'Outpatient Clinic (OPD)',
      subtitle: 'Consultation scheduling, ambulatory patient flow, and specialty clinic visits',
      icon: UserCheck,
    },
    appointments: {
      category: 'Appointments & Duty',
      title: 'Appointment Management',
      subtitle: 'Physician consultation calendar, check-in queue, and waiting room scheduling',
      icon: CalendarPlus,
    },
    'doctor-rota': {
      category: 'Appointments & Duty',
      title: 'Doctor Duty Roster',
      subtitle: 'Physician duty days, clinic hours, and bookable consultation slots',
      icon: CalendarClock,
    },
    enquiry: {
      category: 'Patient Care',
      title: 'Patient Facility Enquiry',
      subtitle: 'Centralized patient lookup: EMR diagnoses, attending doctors, test reports, and invoices',
      icon: Search,
    },
    labs: {
      category: 'Diagnostics & Pharmacy',
      title: 'Diagnostic Laboratory',
      subtitle: 'Pathology findings, reference ranges, specimen turnaround, and critical alerts',
      icon: FlaskConical,
    },
    coder: {
      category: 'Diagnostics & Pharmacy',
      title: 'Medical Coder Desk',
      subtitle: 'Insurance authorization review and patient report publication',
      icon: FileCheck2,
    },
    radiology: {
      category: 'Diagnostics & Pharmacy',
      title: 'Radiology & Imaging',
      subtitle: 'CT, MRI, X-Ray diagnostic modalities and radiologist reports',
      icon: FlaskConical,
    },
    pharmacy: {
      category: 'Diagnostics & Pharmacy',
      title: 'Pharmacy Dispensary',
      subtitle: 'Formulary inventory, prescription dispensing, and stock threshold tracking',
      icon: Pill,
    },
    billing: {
      category: 'Billing',
      title: 'Invoicing',
      subtitle: 'Generate and manage outpatient & inpatient medical billing invoices',
      icon: ReceiptText,
    },
    pricelist: {
      category: 'Billing & Facilities',
      title: 'Hospital Price Schedule & Tariffs',
      subtitle: 'Standard procedure codes, diagnostic lab fees, bed charges, and insurance tariffs',
      icon: DollarSign,
    },
    wards: {
      category: 'Billing & Facilities',
      title: 'Inpatient Wards & Bed Capacity',
      subtitle: 'Real-time bed telemetry, ICU occupancy, and bed turnover status',
      icon: BedDouble,
    },
    staff: {
      category: 'Staff & Governance',
      title: 'Clinical Staff & Specialists',
      subtitle: 'On-duty physicians, nursing shifts, credentials, and specialty duty rosters',
      icon: Stethoscope,
    },
    reports: {
      category: 'Staff & Governance',
      title: 'Executive Analytics & Reports',
      subtitle: 'Census statistics, revenue cycle, diagnostic workload, and quality audits',
      icon: Activity,
    },
    admin: {
      category: 'Staff & Governance',
      title: 'System Governance & Compliance',
      subtitle: 'HIPAA access audits, role permissions, encryption status, and safety compliance logs',
      icon: ShieldCheck,
    },
  };

  const defaultMeta = {
    category: 'Clinical Suite',
    title: 'Hospital Dashboard',
    subtitle: 'Clinical overview and management portal',
    icon: Activity,
  };
  const currentInfo = tabMeta[activeTab] || tabMeta.overview || defaultMeta;
  const ActiveIcon = currentInfo.icon;

  return (
    <div
      className={`px-4 lg:px-6 py-2 border-b transition-colors flex flex-wrap items-center justify-between gap-3 shrink-0 select-none ${
        themeClasses.quickActionBar
      }`}
    >
      {/* Current Location & Scope Breadcrumb */}
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-2xs shrink-0 ${
            isDark
              ? 'bg-slate-800 text-sky-400 border border-slate-700'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}
        >
          <ActiveIcon className="w-4.5 h-4.5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {currentInfo.category}
            </span>
            <span className="text-slate-300">/</span>
            <h1 className={`text-sm font-bold tracking-tight ${themeClasses.textPrimary}`}>
              {currentInfo.title}
            </h1>
            <span
              className={`hidden md:inline-flex text-[9px] font-bold uppercase tracking-wider px-2 py-0.2 rounded ${themeClasses.accentBadge}`}
            >
              {departmentPortal === 'outpatient'
                ? 'OPD Division'
                : departmentPortal === 'inpatient'
                ? 'IPD Division'
                : 'Full Suite'}
            </span>
          </div>
          <p className={`text-[11px] line-clamp-1 ${themeClasses.textSecondary}`}>
            {currentInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Action Controls: Compact, Categorized, Non-Duplicated */}
      <div className="flex items-center gap-2">
        {/* Quick Jump / Command Palette Search */}
        <button
          onClick={onOpenCommandPalette}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition shadow-2xs cursor-pointer ${
            isDark
              ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
          title="Quick Jump & Search Palette (⌘K)"
        >
          <Search className="w-3.5 h-3.5 text-blue-500" />
          <span className="hidden sm:inline text-[11px]">Quick Jump</span>
          <kbd
            className={`px-1.5 py-0.2 rounded font-mono text-[9px] ${
              isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500'
            }`}
          >
            ⌘K
          </kbd>
        </button>

        {/* Categorized Actions Dropdown */}
        <div className="relative" ref={actionsRef}>
          <button
            onClick={() => setIsActionsOpen(!isActionsOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            id="btn-quick-actions-menu"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create / Action</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isActionsOpen ? 'rotate-180' : ''}`} />
          </button>

          {isActionsOpen && (
            <div
              className={`absolute right-0 mt-1.5 w-64 rounded-xl border shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              {/* Category: Clinical Care */}
              <div className="mb-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-2 py-0.5 block">
                  Clinical Care
                </span>
                <div className="space-y-0.5">
                  {currentRole !== 'doctor' && (
                    <button
                      onClick={() => {
                        setIsActionsOpen(false);
                        onOpenNewPatient();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-left text-xs font-medium cursor-pointer transition"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <div>
                        <span className="block font-semibold">Admit New Patient</span>
                        <span className="text-[10px] text-slate-400">Register OPD or admit IPD</span>
                      </div>
                    </button>
                  )}

                  {(currentRole === 'admin' || currentRole === 'nurse' || currentRole === 'doctor') && (
                    <button
                      onClick={() => {
                        setIsActionsOpen(false);
                        onOpenTriage();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-slate-800 text-left text-xs font-medium cursor-pointer transition"
                    >
                      <Activity className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <div>
                        <span className="block font-semibold text-rose-600">STAT Emergency Triage</span>
                        <span className="text-[10px] text-slate-400">Assess acuity score</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Category: Scheduling & Billing */}
              <div className="mb-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-2 py-0.5 block">
                  Schedule & Billing
                </span>
                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      setIsActionsOpen(false);
                      onOpenNewAppointment();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-xs font-medium cursor-pointer transition"
                  >
                    <CalendarPlus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="block font-semibold">Book Appointment</span>
                      <span className="text-[10px] text-slate-400">Doctor consultation slot</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsActionsOpen(false);
                      onOpenNewInvoice();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-xs font-medium cursor-pointer transition"
                  >
                    <ReceiptText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <div>
                      <span className="block font-semibold">Generate Invoice</span>
                      <span className="text-[10px] text-slate-400">Bill services or medications</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsActionsOpen(false);
                      onOpenPriceList();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-xs font-medium cursor-pointer transition"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <div>
                      <span className="block font-semibold">Tariff & Price List</span>
                      <span className="text-[10px] text-slate-400">IPD/OPD procedure charges</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Category: System Backup */}
              {currentRole === 'admin' && (
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setIsActionsOpen(false);
                      setShowBackupReminderModal(true);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium cursor-pointer transition ${
                      isBackupOverdue ? 'bg-amber-50 text-amber-900 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <div>
                      <span className="block font-semibold">
                        {isBackupOverdue ? 'Backup Overdue (Export)' : 'Database Backup Utility'}
                      </span>
                      <span className="text-[10px] text-slate-400">24-hour HIPAA compliance export</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

