import React, { useState, useMemo } from 'react';
import {
  Users,
  BedDouble,
  CreditCard,
  ArrowUpRight,
  Calendar,
  ChevronRight,
  PhoneCall,
  Activity,
  Plus,
  Pill,
  Ticket,
  Building2,
  CheckCircle2,
  Clock,
  Stethoscope,
  Search,
  Filter,
  Layers,
  Volume2,
  AlertTriangle,
  HeartPulse,
  FileText,
  FileCheck2,
  BarChart3,
  ShieldCheck,
  UserPlus,
  UserCheck,
  Scan,
  CalendarClock,
  FlaskConical,
  Droplet,
} from 'lucide-react';
import { NavigationTab, useHospital } from '../context/HospitalContext';
import { PatientAvatar } from './PatientAvatar';
import { Appointment, UserRole } from '../types';

interface DashboardOverviewProps {
  onOpenNewPatient: () => void;
  onOpenNewAppointment: (preset?: { doctorId?: string; date?: string; timeSlot?: string }) => void;
  onOpenNewInvoice: () => void;
  onSelectPatient: (id: string) => void;
}

interface WorkspaceModule {
  id: NavigationTab;
  label: string;
  description: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  badge?: string | number;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  onOpenNewPatient,
  onOpenNewAppointment,
  onOpenNewInvoice,
  onSelectPatient,
}) => {
  const {
    currentRole,
    departmentPortal,
    patients,
    appointments,
    invoices,
    wardBeds,
    pharmacy,
    receptionTokens,
    updateAppointmentStatus,
    updateReceptionTokenStatus,
    setActiveTab,
    addNotification,
  } = useHospital();

  const [appointmentFilter, setAppointmentFilter] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [queueViewMode, setQueueViewMode] = useState<'grouped' | 'table'>('grouped');
  const [calledPatientId, setCalledPatientId] = useState<string | null>(null);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [expandedWorkspaceGroups, setExpandedWorkspaceGroups] = useState<string[]>(['Patient Care']);

  // Determine if Outpatient or Receptionist context
  const isOutpatientOrReception = currentRole === 'receptionist' || departmentPortal === 'outpatient';
  const isReceptionist = currentRole === 'receptionist';

  // Metrics Calculations
  // 1. Total Admissions
  const totalPatientsCount = patients.length;
  const inpatientCount = patients.filter((p) => p.status === 'Inpatient').length;
  const emergencyCount = patients.filter((p) => p.status === 'Emergency').length;
  const outpatientCount = patients.filter((p) => p.status === 'Outpatient').length;

  // 2. Bed Occupancy (for non-outpatient / non-receptionist)
  const occupiedBedsCount = wardBeds.filter((b) => b.status === 'Occupied').length;
  const totalBedsCount = wardBeds.length;
  const bedOccupancyPercent = totalBedsCount > 0 ? Math.round((occupiedBedsCount / totalBedsCount) * 100) : 0;

  // 3. Tokens (Patient Visits)
  const totalTokensCount = receptionTokens.length;
  const waitingTokens = receptionTokens.filter((t) => t.status === 'Waiting');
  const inConsultationTokens = receptionTokens.filter((t) => t.status === 'In Consultation');
  const completedTokens = receptionTokens.filter((t) => t.status === 'Completed');
  const currentDate = new Date();
  const todayDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
  const todayActiveTokens = receptionTokens.filter((token) =>
    (token.createdDate || token.visitDate) === todayDate && token.status !== 'Completed' && token.status !== 'Cancelled'
  );

  // 4. Financial & Claims
  const pendingInvoices = invoices.filter((i) => i.status === 'Pending' || i.status === 'Partially Paid');
  const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + (Number(inv.balanceDue) || 0), 0);
  const totalRevenueCollected = invoices.reduce((sum, inv) => sum + (Number(inv.amountPaid) || 0), 0);

  // 5. Pharmacy (only for clinical/admin, not receptionist)
  const lowStockMeds = pharmacy.filter((p) => p.stockQuantity <= p.minThreshold).length;

  const workspaceModules: WorkspaceModule[] = [
    { id: 'registration', label: 'Patient Registration', description: 'Register patients, create visit tokens, and manage intake.', category: 'Patient Care', icon: UserPlus, roles: ['admin', 'nurse', 'receptionist'] },
    { id: 'medical-records', label: 'Patient Medical Records', description: 'Master dossier, personal details, insurance & chronic history.', category: 'Patient Care', icon: FileText, roles: ['admin', 'doctor', 'nurse', 'receptionist'] },
    { id: 'certificates', label: 'Medical Certificates', description: 'Issue certified sick leaves, return-to-work fitness, and official exemptions.', category: 'Patient Care', icon: FileText, roles: ['admin', 'doctor', 'nurse', 'receptionist'] },
    { id: 'patients', label: 'Doctor EMR', description: 'Open assigned patients, document diagnoses, summaries, services, and reports.', category: 'Patient Care', icon: FileText, roles: ['doctor'] },
    { id: 'triage', label: 'Nurse & Visit EMR', description: 'Open registered tokens, record vitals, and review visit history.', category: 'Patient Care', icon: HeartPulse, roles: ['admin', 'nurse', 'doctor'] },
    { id: 'inpatient', label: 'Inpatient Patients', description: 'Review current inpatient encounters and admissions.', category: 'Patient Care', icon: BedDouble, roles: ['admin', 'doctor', 'nurse'], badge: inpatientCount },
    { id: 'outpatient', label: 'Outpatient Patients', description: 'Review outpatient visits and clinic encounters.', category: 'Patient Care', icon: UserCheck, roles: ['admin', 'doctor', 'nurse'], badge: outpatientCount },
    { id: 'enquiry', label: 'Patient Enquiry', description: 'Find a patient and access permitted patient details.', category: 'Patient Care', icon: Search, roles: ['admin', 'doctor', 'nurse', 'physiotherapist', 'receptionist', 'pharmacist', 'lab', 'radiology'] },
    { id: 'appointments', label: 'Appointments & Queue', description: 'Schedule visits, check patients in, and manage the queue.', category: 'Visits & Scheduling', icon: Calendar, roles: ['admin', 'receptionist', 'doctor'], badge: appointments.length },
    { id: 'doctor-rota', label: 'Doctor Duty Roster', description: 'View doctor availability and duty schedules.', category: 'Visits & Scheduling', icon: CalendarClock, roles: ['admin', 'doctor'] },
    { id: 'ot-schedule', label: 'OT & Surgery Board', description: 'Surgical schedule, operating theatres, and WHO surgical safety checklists.', category: 'Clinical Services', icon: Activity, roles: ['admin', 'doctor', 'nurse', 'receptionist'] },
    { id: 'blood-bank', label: 'Blood Bank Registry', description: 'Blood component inventory, crossmatch compatibility testing, and reservations.', category: 'Clinical Services', icon: Droplet, roles: ['admin', 'doctor', 'nurse', 'lab'] },
    { id: 'labs', label: 'Lab & Diagnostics', description: 'Manage laboratory, radiology, and diagnostic reports.', category: 'Clinical Services', icon: FlaskConical, roles: ['admin', 'doctor', 'nurse', 'lab'] },
    { id: 'radiology', label: 'Radiology', description: 'Review and manage radiology work and reports.', category: 'Clinical Services', icon: Scan, roles: ['admin', 'doctor', 'nurse', 'radiology'] },
    { id: 'pharmacy', label: 'Pharmacy Stock & eRx Dispensing', description: 'Prescription dispensing queue, allergy screening, and stock ledger.', category: 'Clinical Services', icon: Pill, roles: ['admin', 'pharmacist'], badge: lowStockMeds ? `${lowStockMeds} low` : undefined },
    { id: 'coder', label: 'Medical Coder Desk', description: 'Review diagnoses, insurance approvals, and coding records.', category: 'Clinical Services', icon: FileCheck2, roles: ['admin', 'medical-coder'] },
    { id: 'billing', label: 'Billing & Claims', description: 'Create invoices, collect payments, manage advances, refunds, and claims.', category: 'Revenue & Facilities', icon: CreditCard, roles: ['admin', 'receptionist', 'pharmacist'], badge: pendingInvoices.length ? `${pendingInvoices.length} due` : undefined },
    { id: 'pricelist', label: 'Price List & Tariffs', description: 'Review hospital charges and service prices.', category: 'Revenue & Facilities', icon: Building2, roles: ['admin', 'doctor', 'receptionist'] },
    { id: 'wards', label: 'Ward Beds & Census', description: 'Manage ward occupancy, admissions, bed transfers, and discharge summaries.', category: 'Revenue & Facilities', icon: BedDouble, roles: ['admin', 'doctor', 'nurse'] },
    { id: 'reports', label: 'Reports & Analytics', description: 'Review financial, operational, and clinical reports.', category: 'Administration', icon: BarChart3, roles: ['admin', 'receptionist'] },
    { id: 'staff', label: 'Doctors & Staff', description: 'View and manage hospital staff and clinical teams.', category: 'Administration', icon: Stethoscope, roles: ['admin', 'doctor'] },
    { id: 'admin', label: 'Administration & Compliance', description: 'Manage system settings, audit records, and compliance.', category: 'Administration', icon: ShieldCheck, roles: ['admin'] },
  ];

  const visibleWorkspaceModules = workspaceModules.filter((module) => {
    if (!module.roles.includes(currentRole)) return false;
    if (currentRole === 'doctor' && !['patients', 'medical-records', 'certificates', 'ot-schedule', 'blood-bank', 'appointments', 'doctor-rota', 'labs', 'pricelist'].includes(module.id)) return false;
    if (departmentPortal === 'outpatient' && (module.id === 'inpatient' || module.id === 'wards')) return false;
    if (departmentPortal === 'inpatient' && module.id === 'outpatient') return false;
    return true;
  });
  const normalizedWorkspaceSearch = workspaceSearch.trim().toLowerCase();
  const filteredWorkspaceModules = visibleWorkspaceModules.filter((module) =>
    !normalizedWorkspaceSearch ||
    `${module.label} ${module.description} ${module.category}`.toLowerCase().includes(normalizedWorkspaceSearch)
  );
  const workspaceGroups = [...new Set(filteredWorkspaceModules.map((module) => module.category))];

  const toggleWorkspaceGroup = (category: string) => {
    setExpandedWorkspaceGroups((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
    );
  };

  // Departments List extracted from Appointments
  const departmentList = useMemo(() => {
    const set = new Set<string>();
    appointments.forEach((a) => {
      if (a.department) set.add(a.department);
    });
    return Array.from(set).sort();
  }, [appointments]);

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      // Department filter
      if (selectedDepartment !== 'all' && a.department !== selectedDepartment) {
        return false;
      }
      // Status filter
      if (appointmentFilter === 'all') return true;
      if (appointmentFilter === 'active') return a.status === 'Checked-In' || a.status === 'In Consultation';
      return a.status.toLowerCase() === appointmentFilter.toLowerCase();
    });
  }, [appointments, selectedDepartment, appointmentFilter]);

  // Appointments grouped by Department for Department-Wise Display
  const appointmentsByDepartment = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    // Pre-populate departments
    departmentList.forEach((dept) => {
      map.set(dept, []);
    });

    filteredAppointments.forEach((appt) => {
      const dept = appt.department || 'General Practice';
      if (!map.has(dept)) {
        map.set(dept, []);
      }
      map.get(dept)!.push(appt);
    });

    return Array.from(map.entries()).filter(([_, appts]) => {
      if (selectedDepartment !== 'all') {
        return appts.length > 0;
      }
      return true; // Show all department categories
    });
  }, [filteredAppointments, departmentList, selectedDepartment]);

  const handleCallPatient = (appointmentId: string, patientName: string, doctorName: string) => {
    setCalledPatientId(appointmentId);
    updateAppointmentStatus(appointmentId, 'In Consultation');
    addNotification({
      title: `Patient Summoned: ${patientName}`,
      message: `${patientName} is requested at Consultation Room with ${doctorName}.`,
      type: 'info',
    });
    setTimeout(() => {
      setCalledPatientId(null);
    }, 2500);
  };

  const handleCallToken = (tokenId: string, tokenNum: string, name: string, room: string) => {
    updateReceptionTokenStatus(tokenId, 'In Consultation');
    addNotification({
      title: `Calling Token ${tokenNum}`,
      message: `${name} summoned to ${room}.`,
      type: 'info',
    });
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Banner with Role Context */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Activity className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              {isReceptionist
                ? 'Reception Desk Command Center'
                : departmentPortal === 'outpatient'
                ? 'Outpatient Department (OPD) Operations'
                : 'Hospital Enterprise Medical Dashboard'}
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold uppercase">
              {isReceptionist ? 'FRONT DESK' : (departmentPortal || 'OVERVIEW').toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            {isReceptionist
              ? 'Real-time patient check-ins, department-wise clinical queue tracking, token queue sequencer, and outpatient billing reconciliation.'
              : 'Live hospital census, department-wise patient queue throughput, doctor consultation pacing, and clinical workflow metrics.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {currentRole !== 'doctor' && (
            <button
              onClick={onOpenNewPatient}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Patient Intake</span>
            </button>
          )}
          <button
            onClick={() => onOpenNewAppointment()}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Book Appointment</span>
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden" aria-labelledby="workspace-heading">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="workspace-heading" className="text-sm font-bold text-slate-900">Application Workspace</h2>
            <p className="mt-0.5 text-xs text-slate-500">Find a feature by workflow and open it without leaving this dashboard.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <span className="sr-only">Search workspace features</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={workspaceSearch}
                onChange={(event) => {
                  const value = event.target.value;
                  setWorkspaceSearch(value);
                  const query = value.trim().toLowerCase();
                  if (query) {
                    setExpandedWorkspaceGroups([
                      ...new Set(
                        visibleWorkspaceModules
                          .filter((module) => `${module.label} ${module.description} ${module.category}`.toLowerCase().includes(query))
                          .map((module) => module.category)
                      ),
                    ]);
                  }
                }}
                placeholder="Search features..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:w-52"
              />
            </label>
            {currentRole !== 'doctor' && (
              <button
                onClick={onOpenNewInvoice}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                Create invoice
              </button>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {workspaceGroups.length === 0 ? (
            <p className="p-5 text-center text-xs text-slate-500">No available features match your search.</p>
          ) : workspaceGroups.map((category) => {
            const groupModules = filteredWorkspaceModules.filter((module) => module.category === category);
            const isExpanded = expandedWorkspaceGroups.includes(category);
            return (
              <div key={category}>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggleWorkspaceGroup(category)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                    <Layers className="h-3.5 w-3.5 text-blue-500" />
                    {category}
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{groupModules.length}</span>
                  </span>
                  <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="grid gap-2 px-3 pb-3 md:grid-cols-2 xl:grid-cols-3">
                    {groupModules.map((module) => {
                      const Icon = module.icon;
                      return (
                        <button
                          key={module.id}
                          type="button"
                          onClick={() => setActiveTab(module.id)}
                          className="group flex min-h-16 items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                              <span className="truncate">{module.label}</span>
                              {module.badge !== undefined && (
                                <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{module.badge}</span>
                              )}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{module.description}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-blue-600" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* METRIC RIBBON */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: TOTAL ADMISSIONS (ALWAYS SHOWN) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Admissions
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-slate-800">{totalPatientsCount}</span>
            <span className="text-xs font-semibold text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> +12.4%
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <span className="font-semibold text-slate-700">{inpatientCount}</span> Inpatients ·{' '}
            <span className="font-semibold text-rose-600">{emergencyCount}</span> ER ·{' '}
            <span className="font-semibold text-blue-600">{outpatientCount}</span> OPD
          </div>
        </div>

        {/* CARD 2: REMOVE BED OCCUPANCY FROM OUTPATIENT / SHOW NO. OF TOKENS */}
        {isOutpatientOrReception ? (
          // CARD 2 (OUTPATIENT / RECEPTION): NO OF TOKEN (PATIENT VISITS)
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                No. of Tokens (Patient Visits)
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Ticket className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-slate-800">{totalTokensCount}</span>
              <span className="text-xs font-semibold text-amber-600 flex items-center">
                {waitingTokens.length} in Waiting Queue
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span className="font-semibold text-blue-600">{inConsultationTokens.length}</span> In Service ·{' '}
              <span className="font-semibold text-emerald-600">{completedTokens.length}</span> Cleared Today
            </div>
          </div>
        ) : (
          // CARD 2 (INPATIENT / CLINICAL ONLY): BED OCCUPANCY
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Bed Occupancy
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <BedDouble className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-slate-800">{bedOccupancyPercent}%</span>
              <span className="text-xs font-semibold text-amber-600 flex items-center">
                {occupiedBedsCount}/{totalBedsCount} Units Occupied
              </span>
            </div>
            <div className="mt-2">
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    bedOccupancyPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${bedOccupancyPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* CARD 3: PENDING BILLS & CLAIMS */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Pending Bills & Claims
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-slate-800">
              ${pendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-semibold text-rose-600 flex items-center">
              {pendingInvoices.length} Unsettled
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            ${totalRevenueCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })} collected this cycle
          </div>
        </div>

        {/* CARD 4: REMOVE PHARMACY & DIAGNOSTICS FROM RECEPTION USER */}
        {isReceptionist ? (
          // CARD 4 FOR RECEPTIONIST: LIVE CLINIC QUEUE & ACTIVE CONSULTATIONS
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Appointments & Triage
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-slate-800">{appointments.length}</span>
              <span className="text-xs font-semibold text-emerald-600 flex items-center">
                {appointments.filter((a) => a.status === 'Checked-In' || a.status === 'In Consultation').length} In Clinic
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              {appointments.filter((a) => a.status === 'Scheduled').length} Scheduled arrivals pending
            </div>
          </div>
        ) : isOutpatientOrReception ? (
          // CARD 4 FOR OUTPATIENT CLINICAL: OUTPATIENT CLINICS ON DUTY
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                OPD Clinical Load
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Stethoscope className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-slate-800">{departmentList.length}</span>
              <span className="text-xs font-semibold text-blue-600 flex items-center">
                Active Specialty Suites
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              Average wait time ~14 minutes
            </div>
          </div>
        ) : (
          // CARD 4 FOR INPATIENT/ADMIN/PHARMACY: PHARMACY & DIAGNOSTICS (NOT RECEPTION)
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Pharmacy & Diagnostics
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Pill className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-slate-800">
                {lowStockMeds > 0 ? `${lowStockMeds} Alerts` : 'Optimal'}
              </span>
              <span
                className={`text-xs font-semibold flex items-center ${
                  lowStockMeds > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {lowStockMeds > 0 ? 'Requires Restock' : 'All Stock Sane'}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              Avg ER Handover: 12m | Lab turn-around: 48m
            </div>
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT 2 COLS: LIVE APPOINTMENT & TRIAGE QUEUE (DEPARTMENT-WISE) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Header & Department Filters */}
          <div className="p-3.5 border-b border-slate-200 bg-slate-50/50 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Live Appointment & Triage Queue (Department Wise)
                </h2>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-mono font-bold px-2 py-0.5 rounded-full">
                  {filteredAppointments.length} Active
                </span>
              </div>

              {/* View Mode Toggle & Status Filter */}
              <div className="flex items-center gap-1.5">
                <div className="bg-slate-200/80 p-0.5 rounded-lg flex items-center text-[10px]">
                  <button
                    onClick={() => setQueueViewMode('grouped')}
                    className={`px-2 py-1 rounded font-bold transition cursor-pointer flex items-center gap-1 ${
                      queueViewMode === 'grouped'
                        ? 'bg-white text-blue-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>By Department</span>
                  </button>
                  <button
                    onClick={() => setQueueViewMode('table')}
                    className={`px-2 py-1 rounded font-bold transition cursor-pointer flex items-center gap-1 ${
                      queueViewMode === 'table'
                        ? 'bg-white text-blue-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Filter className="w-3 h-3" />
                    <span>Table View</span>
                  </button>
                </div>

                <button
                  onClick={() => onOpenNewAppointment()}
                  className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center gap-1 shadow-2xs transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Slot
                </button>
              </div>
            </div>

            {/* Department Selector Pill Carousel */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-thin">
              <button
                onClick={() => setSelectedDepartment('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  selectedDepartment === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All Departments ({appointments.length})
              </button>

              {departmentList.map((dept) => {
                const count = appointments.filter((a) => a.department === dept).length;
                return (
                  <button
                    key={dept}
                    onClick={() => setSelectedDepartment(dept)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      selectedDepartment === dept
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {dept} ({count})
                  </button>
                );
              })}
            </div>

            {/* Status Quick Filter Bar */}
            <div className="flex items-center justify-between text-[11px] pt-1">
              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-medium mr-1">Status:</span>
                {[
                  { id: 'all', label: 'All' },
                  { id: 'active', label: 'In Clinic (Active)' },
                  { id: 'Checked-In', label: 'Checked In' },
                  { id: 'Scheduled', label: 'Scheduled' },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setAppointmentFilter(filter.id)}
                    className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${
                      appointmentFilter === filter.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                Real-time queue sequencer
              </span>
            </div>
          </div>

          {/* VIEW 1: GROUPED BY DEPARTMENT CARDS */}
          {queueViewMode === 'grouped' ? (
            <div className="p-3.5 space-y-3.5 flex-1 overflow-y-auto max-h-[580px]">
              {appointmentsByDepartment.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No appointments registered under this department filter.
                </div>
              ) : (
                appointmentsByDepartment.map(([dept, deptAppts]) => (
                  <div
                    key={dept}
                    className="bg-slate-50/70 rounded-xl border border-slate-200 p-3 space-y-2.5 shadow-2xs"
                  >
                    {/* Department Header */}
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          <Stethoscope className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-xs">{dept}</h3>
                          <span className="text-[10px] text-slate-500">
                            {deptAppts.length} patient(s) assigned
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                          {deptAppts.filter((a) => a.status === 'Checked-In' || a.status === 'In Consultation').length} In Queue
                        </span>
                        <button
                          onClick={() => onOpenNewAppointment({ doctorId: deptAppts[0]?.doctorId })}
                          className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
                        >
                          + Add Patient
                        </button>
                      </div>
                    </div>

                    {/* Department Patients List */}
                    {deptAppts.length === 0 ? (
                      <div className="py-2 text-center text-slate-400 text-[11px] italic">
                        No active patients in queue for this department.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {deptAppts.map((appt) => {
                          const patient = patients.find((p) => p.id === appt.patientId);
                          const triage = patient?.latestTriage;
                          const isCalled = calledPatientId === appt.id;

                          return (
                            <div
                              key={appt.id}
                              className={`bg-white rounded-lg border p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition ${
                                isCalled
                                  ? 'border-blue-400 bg-blue-50/50 shadow-xs'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-start sm:items-center gap-3">
                                {/* Time & Queue # */}
                                <div className="text-center shrink-0 w-16 bg-slate-50 rounded p-1 border border-slate-200">
                                  <div className="font-mono font-bold text-xs text-slate-900">
                                    {appt.timeSlot}
                                  </div>
                                  <span className="text-[9px] text-slate-400 block font-mono">
                                    Queue #{appt.queueNumber || '1'}
                                  </span>
                                </div>

                                {/* Patient & Doctor Details */}
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      onClick={() => onSelectPatient(appt.patientId)}
                                      className="font-bold text-xs text-slate-900 hover:text-blue-600 text-left cursor-pointer"
                                    >
                                      {appt.patientName}
                                    </button>
                                    <span className="text-[10px] font-mono text-slate-400">
                                      ({appt.patientId})
                                    </span>

                                    {/* Priority Badge */}
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                        appt.priority === 'Emergency'
                                          ? 'bg-rose-100 text-rose-800'
                                          : appt.priority === 'Urgent'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {appt.priority}
                                    </span>

                                    {/* Triage Level Indicator */}
                                    {triage && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-0.5">
                                        <HeartPulse className="w-2.5 h-2.5" />
                                        {triage.urgencyLevel.split(' - ')[0]}
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                    <span>Physician: <strong className="text-slate-700">{appt.doctorName}</strong></span>
                                    <span>• Room: <strong className="text-slate-700">{appt.roomNumber}</strong></span>
                                    <span>• Est. Wait: <strong className="text-blue-600">{appt.estimatedWaitMinutes || 10} min</strong></span>
                                  </div>
                                </div>
                              </div>

                              {/* Status & Actions */}
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    appt.status === 'In Consultation'
                                      ? 'bg-blue-100 text-blue-700 animate-pulse'
                                      : appt.status === 'Checked-In'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : appt.status === 'Completed'
                                      ? 'bg-slate-100 text-slate-500'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      appt.status === 'In Consultation'
                                        ? 'bg-blue-600'
                                        : appt.status === 'Checked-In'
                                        ? 'bg-emerald-600'
                                        : 'bg-amber-500'
                                    }`}
                                  />
                                  {appt.status}
                                </span>

                                {appt.status === 'Checked-In' && (
                                  <button
                                    onClick={() => handleCallPatient(appt.id, appt.patientName, appt.doctorName)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px] inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                                  >
                                    <PhoneCall className="w-3 h-3" /> Call In
                                  </button>
                                )}

                                {appt.status === 'Scheduled' && (
                                  <button
                                    onClick={() => updateAppointmentStatus(appt.id, 'Checked-In')}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px] cursor-pointer"
                                  >
                                    Check In
                                  </button>
                                )}

                                {appt.status === 'In Consultation' && (
                                  <button
                                    onClick={() => updateAppointmentStatus(appt.id, 'Completed')}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-[11px] cursor-pointer"
                                  >
                                    Done
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            /* VIEW 2: DEPARTMENT TABLE VIEW */
            <div className="overflow-x-auto flex-1 max-h-[580px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider sticky top-0 bg-slate-100">
                    <th className="py-2.5 px-3">Slot / Wait</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Patient</th>
                    <th className="py-2.5 px-3">Physician & Room</th>
                    <th className="py-2.5 px-3">Priority / Triage</th>
                    <th className="py-2.5 px-3">Queue Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No appointments matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.map((appt) => {
                      const isCalled = calledPatientId === appt.id;
                      const patient = patients.find((p) => p.id === appt.patientId);
                      const triage = patient?.latestTriage;

                      return (
                        <tr
                          key={appt.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isCalled ? 'bg-blue-50/60' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-700 font-medium">
                            <div>{appt.timeSlot}</div>
                            <span className="text-[10px] text-slate-400">
                              Est. {appt.estimatedWaitMinutes || 10}m
                            </span>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {appt.department}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <button
                              onClick={() => onSelectPatient(appt.patientId)}
                              className="text-left group cursor-pointer"
                            >
                              <span className="font-semibold text-slate-800 group-hover:text-blue-600 block">
                                {appt.patientName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {appt.patientId} · {appt.patientAge}y {appt.patientGender}
                              </span>
                            </button>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                            <div className="font-medium text-slate-800">{appt.doctorName}</div>
                            <div className="text-[10px] text-slate-400">{appt.roomNumber}</div>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="space-y-1">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold block w-fit ${
                                  appt.priority === 'Emergency'
                                    ? 'bg-red-100 text-red-700'
                                    : appt.priority === 'Urgent'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {appt.priority}
                              </span>
                              {triage && (
                                <span className="text-[9px] font-bold text-rose-600 block">
                                  {triage.urgencyLevel.split(' - ')[0]}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                appt.status === 'In Consultation'
                                  ? 'bg-blue-100 text-blue-700'
                                  : appt.status === 'Checked-In'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : appt.status === 'Completed'
                                  ? 'bg-slate-100 text-slate-500'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  appt.status === 'In Consultation'
                                    ? 'bg-blue-600 animate-pulse'
                                    : appt.status === 'Checked-In'
                                    ? 'bg-emerald-600'
                                    : 'bg-amber-600'
                                }`}
                              />
                              {appt.status}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap text-right">
                            {appt.status === 'Checked-In' ? (
                              <button
                                onClick={() => handleCallPatient(appt.id, appt.patientName, appt.doctorName)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded text-[11px] inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                              >
                                <PhoneCall className="w-3 h-3" /> Call In
                              </button>
                            ) : appt.status === 'Scheduled' ? (
                              <button
                                onClick={() => updateAppointmentStatus(appt.id, 'Checked-In')}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[11px] cursor-pointer"
                              >
                                Check-In
                              </button>
                            ) : appt.status === 'In Consultation' ? (
                              <button
                                onClick={() => updateAppointmentStatus(appt.id, 'Completed')}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-[11px] cursor-pointer"
                              >
                                Done
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">Archived</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
            <span className="text-slate-500 text-[11px]">
              Synchronized department queue for triage and specialist consultations.
            </span>
            <button
              onClick={() => setActiveTab('appointments')}
              className="text-blue-600 font-semibold hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
            >
              Full Scheduling Console <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          {/* QUICK INTAKE & ACTIONS */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 flex items-center justify-between">
              <span>{isReceptionist ? 'Reception Desk Actions' : 'Rapid Clinical Intake'}</span>
              <Activity className="w-3.5 h-3.5 text-blue-600" />
            </h3>

            {isReceptionist ? (
              // RECEPTIONIST ACTIONS (NO PHARMACY & NO DIAGNOSTICS)
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onOpenNewPatient}
                  className="p-2.5 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200 rounded-lg text-left transition cursor-pointer"
                >
                  <span className="block text-xs font-bold text-blue-900">+ Register Patient</span>
                  <span className="text-[10px] text-blue-600">New intake record</span>
                </button>
                <button
                  onClick={onOpenNewInvoice}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition cursor-pointer"
                >
                  <span className="block text-xs font-bold text-slate-800">Generate Invoice</span>
                  <span className="text-[10px] text-slate-500">Bill & cashier</span>
                </button>
                <button
                  onClick={() => setActiveTab('reports')}
                  className="p-2.5 bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200 rounded-lg text-left transition cursor-pointer"
                >
                  <span className="block text-xs font-bold text-amber-900">+ Issue Token</span>
                  <span className="text-[10px] text-amber-700">Patient visit slip</span>
                </button>
                <button
                  onClick={() => setActiveTab('enquiry')}
                  className="p-2.5 bg-purple-50/70 hover:bg-purple-100/70 border border-purple-200 rounded-lg text-left transition cursor-pointer"
                >
                  <span className="block text-xs font-bold text-purple-900">Patient Enquiry</span>
                  <span className="text-[10px] text-purple-700">Facility lookup</span>
                </button>
              </div>
            ) : (
              // NON-RECEPTIONIST ACTIONS
              <div className="grid grid-cols-2 gap-2">
                {currentRole !== 'doctor' && (
                  <button
                    onClick={onOpenNewPatient}
                    className="p-2.5 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200 rounded-lg text-left transition cursor-pointer"
                  >
                    <span className="block text-xs font-bold text-blue-900">+ Register Patient</span>
                    <span className="text-[10px] text-blue-600">New EMR intake chart</span>
                  </button>
                )}
                <button
                  onClick={onOpenNewInvoice}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition cursor-pointer"
                >
                  <span className="block text-xs font-bold text-slate-800">Generate Invoice</span>
                  <span className="text-[10px] text-slate-500">Itemize claims</span>
                </button>
                <button
                  onClick={() => setActiveTab('pharmacy')}
                  className="p-2.5 bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200 rounded-lg text-left transition cursor-pointer"
                >
                  <span className="block text-xs font-bold text-emerald-900">Dispense Rx</span>
                  <span className="text-[10px] text-emerald-700">Check medicine stocks</span>
                </button>
                <button
                  onClick={() => setActiveTab('labs')}
                  className="p-2.5 bg-purple-50/70 hover:bg-purple-100/70 border border-purple-200 rounded-lg text-left transition cursor-pointer"
                >
                  <span className="block text-xs font-bold text-purple-900">Diagnostics</span>
                  <span className="text-[10px] text-purple-700">Verify lab specimens</span>
                </button>
              </div>
            )}
          </div>

          {/* LOWER RIGHT BOX: CONDITIONAL FOR RECEPTION/OUTPATIENT (REMOVE BED OCCUPANCY) */}
          {isOutpatientOrReception ? (
            // FOR RECEPTION / OUTPATIENT: DAILY TOKEN CALLER & QUEUE STATUS (BEDS REMOVED)
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Live Reception Token Queue ({receptionTokens.length})
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab('reports')}
                  className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  Token Registry
                </button>
              </div>

              <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                {todayActiveTokens.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No tokens issued yet today.
                  </div>
                ) : (
                  todayActiveTokens.slice(0, 5).map((tok) => (
                    <div
                      key={tok.id}
                      className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-2 pr-2">
                        <PatientAvatar patientId={tok.patientId} name={tok.patientName} gender={tok.patientGender} imageUrl={patients.find((patient) => patient.id === tok.patientId)?.photo || patients.find((patient) => patient.id === tok.patientId)?.avatar} size="sm" />
                        <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-blue-700 bg-blue-100/80 px-1.5 py-0.2 rounded text-[11px]">
                            {tok.tokenNumber}
                          </span>
                          <span className="font-semibold text-slate-900 truncate">
                            {tok.patientName}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {tok.department} · {tok.counterOrRoom}
                        </div>
                        <div className="text-[9px] text-slate-500 mt-1 truncate">
                          {tok.visitPurpose || tok.visitType || 'Visit'} · {tok.doctorName || 'Doctor not assigned'}
                        </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            tok.status === 'In Consultation'
                              ? 'bg-blue-100 text-blue-700 animate-pulse'
                              : tok.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {tok.status}
                        </span>

                        {tok.status === 'Waiting' && (
                          <button
                            onClick={() => handleCallToken(tok.id, tok.tokenNumber, tok.patientName, tok.counterOrRoom)}
                            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold shadow-2xs cursor-pointer"
                          >
                            Call
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            // FOR INPATIENT/CLINICAL: WARD BED STATUS
            <>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Ward Bed Status
                  </h3>
                </div>
                <button
                  onClick={() => setActiveTab('wards')}
                  className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  Manage Wards
                </button>
              </div>
              <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                {wardBeds.map((bed) => (
                  <div
                    key={bed.id}
                    className="p-2 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-slate-800 text-[11px] truncate">
                        {bed.bedNumber} · <span className="font-normal text-slate-500">{bed.wardName}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {bed.patientName ? `Assigned: ${bed.patientName}` : 'Sanitized & Ready'}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        bed.status === 'Occupied'
                          ? 'bg-rose-100 text-rose-700'
                          : bed.status === 'Maintenance'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {bed.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 p-3">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                  <Ticket className="h-4 w-4 text-blue-600" /> Today&apos;s patient tokens ({todayActiveTokens.length})
                </h3>
                <button onClick={() => setActiveTab('reports')} className="text-[11px] font-semibold text-blue-600 hover:underline">
                  Token Registry
                </button>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto p-3">
                {todayActiveTokens.length ? todayActiveTokens.map((token) => (
                  <div key={token.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-blue-800">{token.tokenNumber}</span>
                        <span className="truncate font-semibold text-slate-900">{token.patientName}</span>
                      </div>
                      <p className="mt-1 truncate text-[10px] text-slate-500">{token.department} · {token.currentStage?.replaceAll('_', ' ') || token.serviceType}</p>
                    </div>
                    <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">{token.status}</span>
                  </div>
                )) : <p className="py-4 text-center text-xs text-slate-500">No active tokens today.</p>}
              </div>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
