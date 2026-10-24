import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarClock,
  CreditCard,
  BedDouble,
  Activity,
  ShieldCheck,
  Stethoscope,
  Pill,
  FlaskConical,
  Scan,
  BarChart3,
  KeyRound,
  UserCheck,
  ArrowLeftRight,
  Layers,
  DollarSign,
  PanelLeftClose,
  PanelLeft,
  Search,
  UserPlus,
  FileCheck2,
  FileText,
  ChevronDown,
  RotateCcw,
  Terminal,
  Droplet,
} from 'lucide-react';
import { useHospital, NavigationTab } from '../context/HospitalContext';
import { getThemeClasses, normalizeTheme } from '../utils/theme';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    patients,
    appointments,
    invoices,
    insuranceApprovals,
    wardBeds,
    doctors,
    staff,
    pharmacy,
    receptionTokens,
    currentRole,
    departmentPortal,
    setShowPortalSelect,
    appTheme,
  } = useHospital();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    'Patient Registration': true,
    'Appointment': true,
    'Patient Care': true,
    'Diagnostics & Pharmacy': true,
    'Clinical Services': true,
    'Appointments & Duty': true,
    'Billing': true,
    'Duty & Roster': true,
    'Package & Wellness': true,
    'Financial Report': true,
    'Billing & Facilities': true,
    'Staff & Governance': true,
  });
  const themeClasses = getThemeClasses(appTheme);
  const isDark = normalizeTheme(appTheme) === 'dark';

  const totalPatients = patients.length;
  const activeQueueCount = appointments.filter(
    (a) => a.status === 'Checked-In' || a.status === 'In Consultation' || a.status === 'Scheduled'
  ).length;
  const pendingBillsCount = invoices.filter((i) => i.status === 'Pending').length;
  const pendingInsuranceApprovalsCount = insuranceApprovals.filter(
    (approval) => approval.approvalStatus === 'Pending' || approval.approvalStatus === 'Query Raised'
  ).length;
  const lowPharmacyCount = pharmacy.filter((p) => p.stockQuantity <= p.minThreshold).length;
  const occupiedBedsCount = wardBeds.filter((b) => b.status === 'Occupied').length;
  const totalBeds = wardBeds.length;
  const erCapacityPercent = Math.min(100, Math.round((occupiedBedsCount / totalBeds) * 100));
  const inpatientCount = patients.filter((p) => p.status === 'Inpatient' || p.status === 'Emergency').length;
  const outpatientCount = patients.filter((p) => p.status === 'Outpatient').length;
  const statTriageCount = patients.filter(
    (p) => p.latestTriage?.urgencyLevel.includes('Level 1') || p.status === 'Emergency'
  ).length;
  const pendingLabOrdersCount = receptionTokens.reduce((count, token) => {
    const pendingTests = (token.doctorOrders?.labRequests || []).filter(
      (req) => req.status === 'Ordered' || req.status === 'Sample Collected'
    );
    return count + pendingTests.length;
  }, 0);

  const navItems = [
    {
      id: 'overview' as NavigationTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
      category: 'Patient Care',
      roles: ['admin', 'doctor', 'nurse', 'physiotherapist', 'receptionist', 'pharmacist', 'lab', 'radiology'],
    },
    {
      id: 'patients' as NavigationTab,
      label: 'Patient EMR Records',
      icon: Users,
      badge: totalPatients,
      category: 'Patient Care',
      roles: ['doctor'],
    },
    {
      id: 'registration' as NavigationTab,
      label: currentRole === 'receptionist' ? '1. Patient Registration' : 'Patient Registration',
      icon: UserPlus,
      badge: null,
      category: currentRole === 'receptionist' ? 'Reception Desk Portal' : 'Patient Care',
      roles: ['admin', 'nurse', 'receptionist'],
    },
    {
      id: 'medical-records' as NavigationTab,
      label: currentRole === 'receptionist' ? 'Medical Record' : 'Medical Record',
      icon: FileText,
      badge: null,
      category: currentRole === 'receptionist' ? 'Reception Desk Portal' : 'Patient Care',
      roles: ['admin', 'nurse', 'receptionist', 'doctor'],
    },
    {
      id: 'certificates' as NavigationTab,
      label: 'Medical Certificates',
      icon: FileText,
      badge: null,
      category: currentRole === 'receptionist' ? 'Reception Desk Portal' : 'Patient Care',
      roles: ['admin', 'doctor', 'nurse', 'receptionist'],
    },
    {
      id: 'triage' as NavigationTab,
      label: 'Nurse Triage Station',
      icon: Activity,
      badge: statTriageCount > 0 ? `${statTriageCount} STAT` : null,
      category: 'Patient Care',
      roles: ['admin', 'nurse', 'doctor'],
    },
    {
      id: 'inpatient' as NavigationTab,
      label: 'Inpatients (IPD)',
      icon: BedDouble,
      badge: `${inpatientCount} Admitted`,
      category: 'Patient Care',
      roles: ['admin', 'doctor', 'nurse'],
    },
    {
      id: 'outpatient' as NavigationTab,
      label: 'Outpatients (OPD)',
      icon: UserCheck,
      badge: `${outpatientCount} Visits`,
      category: 'Patient Care',
      roles: ['admin', 'doctor', 'nurse'],
    },
    {
      id: 'appointments' as NavigationTab,
      label: currentRole === 'doctor' ? 'Doctor Appointments' : currentRole === 'receptionist' ? '2. Appointment' : 'Appointments',
      icon: Calendar,
      badge: activeQueueCount,
      category: currentRole === 'receptionist' ? 'Reception Desk Portal' : 'Appointments & Duty',
      roles: ['admin', 'receptionist', 'doctor'],
    },
    {
      id: 'doctor-rota' as NavigationTab,
      label: 'Staff Duty Roster',
      icon: CalendarClock,
      badge: null,
      category: 'Appointments & Duty',
      roles: ['admin', 'doctor', 'receptionist'],
    },
    {
      id: 'enquiry' as NavigationTab,
      label: currentRole === 'receptionist' ? '3. Patient Enquiry' : 'Patient Facility Enquiry',
      icon: Search,
      badge: 'Lookup',
      category: currentRole === 'receptionist' ? 'Reception Desk Portal' : 'Patient Care',
      roles: ['admin', 'doctor', 'nurse', 'physiotherapist', 'receptionist', 'pharmacist', 'lab', 'radiology'],
    },
    {
      id: 'lab-orders' as NavigationTab,
      label: 'Doctor Lab Orders',
      icon: FlaskConical,
      badge: pendingLabOrdersCount > 0 ? `${pendingLabOrdersCount} Orders` : null,
      category: 'Diagnostics & Pharmacy',
      roles: ['admin', 'doctor', 'nurse', 'lab', 'receptionist', 'pharmacist', 'physiotherapist', 'radiology', 'medical-coder'],
    },
    {
      id: 'labs' as NavigationTab,
      label: 'Lab & Diagnostics',
      icon: FlaskConical,
      badge: null,
      category: 'Diagnostics & Pharmacy',
      roles: ['admin', 'doctor', 'nurse', 'lab'],
    },
    {
      id: 'coder' as NavigationTab,
      label: 'Medical Coder Desk',
      icon: FileCheck2,
      badge: null,
      category: 'Diagnostics & Pharmacy',
      roles: ['admin', 'medical-coder'],
    },
    {
      id: 'pharmacy' as NavigationTab,
      label: 'Pharmacy Stock',
      icon: Pill,
      badge: lowPharmacyCount > 0 ? `${lowPharmacyCount} low` : null,
      category: 'Diagnostics & Pharmacy',
      roles: ['admin', 'pharmacist'],
    },
    {
      id: 'billing' as NavigationTab,
      label: 'Invoicing',
      icon: CreditCard,
      badge: pendingBillsCount > 0 ? pendingBillsCount : null,
      category: 'Billing',
      roles: ['admin', 'receptionist', 'pharmacist'],
    },
    {
      id: 'billing-dues' as NavigationTab,
      label: 'Due Settlement',
      icon: UserCheck,
      badge: pendingBillsCount > 0 ? pendingBillsCount : null,
      category: 'Billing',
      roles: ['admin', 'receptionist'],
    },
    {
      id: 'billing-advance' as NavigationTab,
      label: 'Advance Payment',
      icon: DollarSign,
      badge: null,
      category: 'Billing',
      roles: ['admin', 'receptionist'],
    },
    {
      id: 'billing-refunds' as NavigationTab,
      label: 'Refund',
      icon: RotateCcw,
      badge: null,
      category: 'Billing',
      roles: ['admin', 'receptionist'],
    },
    {
      id: 'billing-pos' as NavigationTab,
      label: 'POS Transactions',
      icon: Terminal,
      badge: null,
      category: 'Billing',
      roles: ['admin', 'receptionist'],
    },
    {
      id: 'insurance-approvals' as NavigationTab,
      label: 'Insurance Approval',
      icon: ShieldCheck,
      badge: pendingInsuranceApprovalsCount > 0 ? pendingInsuranceApprovalsCount : null,
      category: 'Billing',
      roles: ['admin', 'receptionist'],
    },
    {
      id: 'reports' as NavigationTab,
      label: currentRole === 'receptionist' ? 'Financial Report' : 'Analytics & Reports',
      icon: BarChart3,
      badge: null,
      category: currentRole === 'receptionist' ? 'Financial Report' : 'Staff & Governance',
      roles: ['admin', 'receptionist'],
    },
    {
      id: 'pricelist' as NavigationTab,
      label: currentRole === 'receptionist' ? '6. Price List & Tariffs' : 'Price List & Tariffs',
      icon: DollarSign,
      badge: 'IPD/OPD',
      category: currentRole === 'receptionist' ? 'Reception Desk Portal' : 'Billing & Facilities',
      roles: ['admin', 'doctor', 'receptionist'],
    },
    {
      id: 'wards' as NavigationTab,
      label: 'Ward & Beds',
      icon: BedDouble,
      badge: `${occupiedBedsCount}/${totalBeds}`,
      category: 'Billing & Facilities',
      roles: ['admin', 'doctor', 'nurse'],
    },
    {
      id: 'ot-schedule' as NavigationTab,
      label: 'OT Surgery Board',
      icon: Activity,
      badge: null,
      category: 'Clinical Services',
      roles: ['admin', 'doctor', 'nurse', 'receptionist'],
    },
    {
      id: 'blood-bank' as NavigationTab,
      label: 'Blood Bank & Crossmatch',
      icon: Droplet,
      badge: null,
      category: 'Clinical Services',
      roles: ['admin', 'doctor', 'nurse', 'lab'],
    },
    {
      id: 'staff' as NavigationTab,
      label: 'Doctors & Staff',
      icon: Stethoscope,
      badge: staff.length,
      category: 'Staff & Governance',
      roles: ['admin', 'doctor', 'receptionist'],
    },
    {
      id: 'admin' as NavigationTab,
      label: 'Admin & HIPAA',
      icon: ShieldCheck,
      badge: 'SECURE',
      category: 'Staff & Governance',
      roles: ['admin'],
    },
  ];

  const filteredNavItems = React.useMemo(() => {
    if (currentRole === 'receptionist') {
      const receptionMap: Partial<Record<NavigationTab, { category: string; label: string }>> = {
        overview: { category: 'Patient Registration', label: 'Dashboard' },
        registration: { category: 'Patient Registration', label: 'Registration' },
        'medical-records': { category: 'Patient Registration', label: 'Medical Record' },
        certificates: { category: 'Patient Registration', label: 'Medical Certificates' },
        appointments: { category: 'Appointment', label: 'Appointment Scheduling' },
        enquiry: { category: 'Appointment', label: 'Patient Enquiry' },
        'ot-schedule': { category: 'Clinical Services', label: 'OT Surgery Board' },
        billing: { category: 'Billing', label: 'Invoicing' },
        'billing-dues': { category: 'Billing', label: 'Due Settlement' },
        'billing-advance': { category: 'Billing', label: 'Advance Payment' },
        'billing-refunds': { category: 'Billing', label: 'Refund' },
        'billing-pos': { category: 'Billing', label: 'POS Transactions' },
        'insurance-approvals': { category: 'Insurance', label: 'Insurance Approval' },
        pricelist: { category: 'Package & Wellness', label: 'Package Assign' },
        'doctor-rota': { category: 'Duty & Roster', label: 'Doctor Duty' },
        staff: { category: 'Duty & Roster', label: 'Staff Management' },
        reports: { category: 'Financial Report', label: 'Patient Visit & Sales' },
        patients: { category: 'Patient Registration', label: 'Patient EMR' },
        inpatient: { category: 'Patient Registration', label: 'Inpatient' },
        outpatient: { category: 'Patient Registration', label: 'Outpatient' },
        triage: { category: 'Patient Registration', label: 'Triage' },
        pharmacy: { category: 'Billing', label: 'Pharmacy' },
        labs: { category: 'Billing', label: 'Lab & Diagnostics' },
        radiology: { category: 'Billing', label: 'Radiology' },
        wards: { category: 'Billing', label: 'Ward & Beds' },
        'blood-bank': { category: 'Clinical Services', label: 'Blood Bank' },
        'lab-orders': { category: 'Clinical Services', label: 'Doctor Lab Orders' },
        coder: { category: 'Insurance', label: 'Medical Coding' },
        admin: { category: 'Duty & Roster', label: 'Admin' },
      };

      const receptionOrder: NavigationTab[] = [
        'overview',
        'registration',
        'medical-records',
        'certificates',
        'appointments',
        'enquiry',
        'ot-schedule',
        'blood-bank',
        'lab-orders',
        'billing',
        'billing-dues',
        'billing-advance',
        'billing-refunds',
        'billing-pos',
        'insurance-approvals',
        'pricelist',
        'doctor-rota',
        'staff',
        'reports',
      ];

      return receptionOrder
        .map((tabId) => {
          const item = navItems.find((n) => n.id === tabId);
          if (!item) return null;
          const config = receptionMap[tabId] || { category: 'Reception Desk Portal', label: item.label };
          return {
            ...item,
            category: config.category,
            label: config.label,
          };
        })
        .filter(Boolean) as typeof navItems;
    }

    if (currentRole === 'doctor') {
      const doctorNavOrder: NavigationTab[] = [
        'patients',
        'medical-records',
        'lab-orders',
        'labs',
        'certificates',
        'ot-schedule',
        'blood-bank',
        'appointments',
        'doctor-rota',
        'pricelist',
      ];
      return doctorNavOrder
        .map((tabId) => navItems.find((item) => item.id === tabId))
        .filter(Boolean)
        .map((item) => item!.id === 'labs' ? { ...item!, label: 'Lab & Radiology' } : item!);
    }

    return navItems.filter((item) => {
      if (!item.roles.includes(currentRole)) return false;
      if (departmentPortal === 'outpatient') {
        if (item.id === 'inpatient' || item.id === 'wards') return false;
      }
      if (departmentPortal === 'inpatient') {
        if (item.id === 'outpatient') return false;
      }
      return true;
    });
  }, [currentRole, departmentPortal, navItems]);

  const activeCategory = filteredNavItems.find((item) => item.id === activeTab)?.category ?? null;
  useEffect(() => {
    if (activeCategory) {
      setOpenCategories((prev) => ({ ...prev, [activeCategory]: true }));
    }
  }, [activeCategory]);

  const toggleCategory = (cat: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  return (
    <aside
      className={`transition-all duration-200 border-r flex flex-col shrink-0 select-none overflow-y-auto ${
        isCollapsed ? 'w-16 p-2' : 'w-60 p-3'
      } ${themeClasses.sidebarBackground} ${themeClasses.sidebarBorder}`}
    >
      <div className={`mb-2 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-1'}`}>
        {!isCollapsed && (
          <span className={`text-[10px] uppercase font-bold tracking-widest ${themeClasses.sidebarHeaderColor}`}>
            Navigation
          </span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {!isCollapsed ? (
        <div
          className={`mb-2.5 px-2.5 py-1.5 rounded-lg border flex items-center justify-between shadow-2xs ${
            isDark
              ? 'bg-slate-800/80 border-slate-700/60'
              : 'bg-teal-50 border-teal-200 text-teal-950'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <KeyRound className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <div className="min-w-0">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold leading-none">
                Active Role
              </span>
              <span className={`text-xs font-bold capitalize truncate block leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {currentRole}
              </span>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        </div>
      ) : (
        <div
          className="mb-2.5 p-2 rounded-lg border flex items-center justify-center bg-teal-50 border-teal-200 text-teal-800"
          title={`Active Role: ${currentRole}`}
        >
          <KeyRound className="w-4 h-4" />
        </div>
      )}

      {/* Division Gateway Switcher */}
      {!isCollapsed ? (
        <div
          className={`mb-3 p-2 rounded-lg border shadow-2xs ${
            isDark
              ? 'bg-slate-800/60 border-slate-700/60'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[9px] uppercase tracking-wider font-bold ${themeClasses.sidebarHeaderColor}`}>
              Care Division
            </span>
            <button
              onClick={() => setShowPortalSelect(true)}
              className="text-[10px] text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-0.5 cursor-pointer"
              title="Switch Hospital Portal Division"
            >
              <span>Change</span>
              <ArrowLeftRight className="w-2.5 h-2.5" />
            </button>
          </div>
          <div>
            {departmentPortal === 'outpatient' ? (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Outpatient (OPD)</span>
              </div>
            ) : departmentPortal === 'inpatient' ? (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600">
                <BedDouble className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Inpatient (IPD)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Full Hospital</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowPortalSelect(true)}
          className="mb-3 p-2 rounded-lg border flex items-center justify-center bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 cursor-pointer"
          title={`Care Division: ${departmentPortal || 'Full Hospital'}. Click to change.`}
        >
          <ArrowLeftRight className="w-4 h-4 text-teal-700" />
        </button>
      )}

      {/* Categorized Navigation Links */}
      <div className="space-y-3">
        {[
          'Patient Registration',
          'Appointment',
          'Billing',
          'Insurance',
          'Package & Wellness',
          'Duty & Roster',
          'Financial Report',
          'Patient Care',
          'Clinical Services',
          'Appointments & Duty',
          'Diagnostics & Pharmacy',
          'Billing & Facilities',
          'Staff & Governance',
        ].map((categoryName) => {
          const categoryItems = filteredNavItems.filter((item) => item.category === categoryName);
          if (categoryItems.length === 0) return null;
          const isExpanded = openCategories[categoryName] ?? true;
          const groupId = `nav-group-${categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

          return (
            <div key={categoryName} className="space-y-0.5">
              {!isCollapsed ? (
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={groupId}
                  onClick={() => toggleCategory(categoryName)}
                  className={`flex min-h-8 w-full items-center justify-between rounded-md px-2 text-left transition hover:bg-slate-100 ${themeClasses.sidebarHeaderColor}`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-widest">{categoryName}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono font-medium text-slate-400">{categoryItems.length}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </span>
                </button>
              ) : (
                <div className="my-1 border-t border-slate-200/60" />
              )}

              <div id={groupId} hidden={!isCollapsed && !isExpanded} className="space-y-0.5">
                {categoryItems.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    id={`nav-${item.id}-link`}
                    onClick={() => {
                      setActiveTab(item.id);
                      setOpenCategories((prev) => ({ ...prev, [item.category]: true }));
                    }}
                    className={`w-full rounded-lg text-xs transition-colors cursor-pointer flex items-center ${
                      isCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-1.5'
                    } ${
                      isActive
                        ? themeClasses.sidebarActiveItem
                        : themeClasses.sidebarHoverItem
                    }`}
                    title={isCollapsed ? `${categoryName} · ${item.label}` : undefined}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                      {!isCollapsed && <span className="truncate font-medium text-[12px]">{item.label}</span>}
                    </div>
                    {!isCollapsed && item.badge !== null && (
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono shrink-0 ml-1 font-semibold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : typeof item.badge === 'string' && item.badge.includes('low')
                            ? 'bg-amber-100 text-amber-800'
                            : typeof item.badge === 'string' && item.badge.includes('STAT')
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* On-Duty Physicians Quick Roster */}
      {!isCollapsed && (
        <div className="mt-4 pt-3 border-t border-slate-200/80">
          <div className={`text-[10px] uppercase font-bold mb-1.5 px-2 tracking-widest flex items-center justify-between ${themeClasses.sidebarHeaderColor}`}>
            <span>Duty Clinicians</span>
            <span className="text-emerald-500 font-mono text-[9px] font-bold">LIVE</span>
          </div>
          <div className="space-y-1">
            {doctors.slice(0, 3).map((doc) => (
              <div
                key={doc.id}
                className={`p-1.5 rounded-lg border text-xs flex items-center justify-between shadow-2xs ${
                  isDark
                    ? 'bg-slate-800/40 border-slate-800'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="min-w-0 pr-1">
                  <p className={`font-medium truncate text-[11px] ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {doc.name.replace(', MD', '').replace(', FACS', '')}
                  </p>
                  <p className="text-slate-400 text-[9px] truncate">{doc.specialty}</p>
                </div>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    doc.status === 'Available'
                      ? 'bg-emerald-500'
                      : doc.status === 'In Surgery'
                      ? 'bg-rose-500'
                      : 'bg-amber-500'
                  }`}
                  title={doc.status}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workstation Capacity Status */}
      <div className="mt-auto pt-3 border-t border-slate-200/80">
        {!isCollapsed && (
          departmentPortal === 'outpatient' ? (
            <div className="px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg shadow-2xs">
              <div className="flex justify-between items-center mb-1">
                <span className="text-emerald-700 text-[9px] font-bold tracking-wider uppercase">OPD Queue</span>
                <span className="text-emerald-700 text-[10px] font-bold font-mono">{activeQueueCount} Active</span>
              </div>
              <div className="w-full bg-emerald-200 rounded-full h-1 overflow-hidden">
                <div
                  className="bg-emerald-600 h-1 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(15, activeQueueCount * 20))}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded-lg shadow-2xs">
              <div className="flex justify-between items-center mb-1">
                <span className="text-rose-700 text-[9px] font-bold tracking-wider uppercase">ER Inpatient Load</span>
                <span className="text-rose-700 text-[10px] font-bold font-mono">{erCapacityPercent}%</span>
              </div>
              <div className="w-full bg-rose-200 rounded-full h-1 overflow-hidden">
                <div
                  className="bg-rose-600 h-1 rounded-full transition-all duration-500"
                  style={{ width: `${erCapacityPercent}%` }}
                />
              </div>
            </div>
          )
        )}
        <div className={`mt-2 px-1 text-[9px] flex items-center justify-between ${isCollapsed ? 'justify-center' : ''} text-slate-400`}>
          <span className="flex items-center gap-1 font-medium">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            {!isCollapsed && <span>HIPAA Validated</span>}
          </span>
          {!isCollapsed && <span className="font-mono text-slate-400">v4.4.0</span>}
        </div>
      </div>
    </aside>
  );
};
