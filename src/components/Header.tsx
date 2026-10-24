import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Search,
  UserPlus,
  CalendarPlus,
  ReceiptText,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  ShieldCheck,
  Activity,
  Clock,
  LogOut,
  ArrowLeftRight,
  Stethoscope,
  BedDouble,
  DollarSign,
  Palette,
  ChevronDown,
  UserCheck,
  Check,
  FileCheck2,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { getThemeClasses, THEME_OPTIONS, normalizeTheme } from '../utils/theme';
import { UserRole } from '../types';
import { PatientAvatar } from './PatientAvatar';

interface HeaderProps {
  onOpenNewPatient: () => void;
  onOpenNewAppointment: () => void;
  onOpenNewInvoice: () => void;
  onSelectPatient: (id: string) => void;
  onOpenTriage?: () => void;
  onOpenPriceList?: () => void;
  onOpenThemeModal?: () => void;
  onOpenCommandPalette?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewPatient,
  onOpenNewAppointment,
  onOpenNewInvoice,
  onSelectPatient,
  onOpenTriage,
  onOpenPriceList,
  onOpenThemeModal,
  onOpenCommandPalette,
}) => {
  const {
    notifications,
    markNotificationRead,
    clearAllNotifications,
    patients,
    resetHospitalData,
    setActiveTab,
    currentUser,
    currentRole,
    setCurrentRole,
    departmentPortal,
    setShowPortalSelect,
    appTheme,
    setAppTheme,
    logout,
  } = useHospital();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const roleMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  const themeClasses = getThemeClasses(appTheme);
  const currentThemeNorm = normalizeTheme(appTheme);
  const activeThemeMeta = THEME_OPTIONS.find((t) => t.id === appTheme) || THEME_OPTIONS[0];

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizeUserName = (name: string) =>
    name.toLowerCase().replace(/^dr\.?\s*/, '').replace(/,?\s*(md|facs|do|phd)\b/g, '').replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
  const visibleNotifications = notifications.filter((notification) => {
    if (!notification.recipientUserId && !notification.recipientUserName) return true;
    return (
      notification.recipientUserId === currentUser.id ||
      (notification.recipientUserName !== undefined &&
        normalizeUserName(notification.recipientUserName) === normalizeUserName(currentUser.name))
    );
  });
  const unreadCount = visibleNotifications.filter((n) => !n.read).length;
  const searchResults = globalSearch.trim()
    ? patients.filter(
        (p) =>
          p.firstName.toLowerCase().includes(globalSearch.toLowerCase()) ||
          p.lastName.toLowerCase().includes(globalSearch.toLowerCase()) ||
          p.id.toLowerCase().includes(globalSearch.toLowerCase()) ||
          p.chronicConditions.some((c) => c.toLowerCase().includes(globalSearch.toLowerCase()))
      )
    : [];

  const emergencyPatientsCount = patients.filter((p) => p.status === 'Emergency').length;

  const availableRoles: Array<{ role: UserRole; title: string; desc: string; icon: React.ElementType }> = [
    {
      role: 'admin',
      title: 'Administrator',
      desc: 'Full access to all reports, operations & compliance',
      icon: ShieldCheck,
    },
    {
      role: 'doctor',
      title: 'Attending Physician',
      desc: 'Enquiry, Doctor EMR, Lab & Radiology, Price List',
      icon: Stethoscope,
    },
    {
      role: 'nurse',
      title: 'Staff Nurse',
      desc: 'Patient Vitals, STAT Triage, EMR, Lab & Radiology reports',
      icon: Activity,
    },
    {
      role: 'receptionist',
      title: 'Reception & Desk',
      desc: 'Registration, Billing, Appointments, Claims, Price List',
      icon: UserCheck,
    },
    {
      role: 'pharmacist',
      title: 'Pharmacist',
      desc: 'Formulary dispensing, medicine inventory, billing',
      icon: ReceiptText,
    },
    {
      role: 'medical-coder',
      title: 'Medical Coder',
      desc: 'Insurance authorization review and patient report publishing',
      icon: FileCheck2,
    },
  ];

  return (
    <nav
      className={`h-14 border-b flex items-center justify-between px-4 lg:px-6 shrink-0 z-30 select-none transition-colors ${themeClasses.headerBackground} ${themeClasses.headerBorder}`}
    >
      {/* Brand & Global Search */}
      <div className="flex items-center gap-4 lg:gap-6">
        <div
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={() => setActiveTab('overview')}
          title="MedCore OS Home Dashboard"
        >
          <div className="w-8 h-8 bg-[var(--brand-primary)] rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:bg-[var(--brand-primary-hover)] transition">
            +
          </div>
          <span className={`font-bold text-base lg:text-lg tracking-tight ${themeClasses.headerText}`}>
            MEDCORE<span className="text-[var(--brand-primary)] font-extrabold">OS</span>
          </span>
        </div>

        {/* Active Division Portal Badge & Switcher */}
        <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-200">
          {departmentPortal === 'outpatient' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
              <span>Outpatient (OPD)</span>
            </div>
          ) : departmentPortal === 'inpatient' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold">
              <BedDouble className="w-3.5 h-3.5 text-indigo-600" />
              <span>Inpatient (IPD)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
              <span>Full Hospital Suite</span>
            </div>
          )}
          <button
            id="btn-header-switch-portal"
            onClick={() => setShowPortalSelect(true)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
            title="Switch between Outpatient and Inpatient portals"
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span>Switch</span>
          </button>
        </div>

        {/* Global Patient & Record Search Input */}
        <div className="relative hidden md:block">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="header-global-search"
              placeholder="Search patients, doctors, or commands..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 250)}
              className="w-64 lg:w-72 bg-slate-100/80 border border-slate-200 rounded-lg py-1.5 pl-8 pr-14 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 placeholder-slate-400 transition"
            />
            {globalSearch ? (
              <button
                onClick={() => setGlobalSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={onOpenCommandPalette}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-mono bg-white border border-slate-200 text-slate-500 rounded shadow-2xs hover:bg-slate-50"
                title="Open Command Palette (Ctrl+K)"
              >
                ⌘K
              </button>
            )}
          </div>

          {searchFocused && searchResults.length > 0 && (
            <div className="absolute top-full left-0 mt-1.5 w-96 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden z-50">
              <div className="p-2 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                <span>Matching Patient Records ({searchResults.length})</span>
                <span className="text-[9px] text-blue-600 font-semibold">Jump to EMR</span>
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onSelectPatient(p.id);
                      setGlobalSearch('');
                      setActiveTab('patients');
                    }}
                    className="w-full text-left p-2.5 hover:bg-blue-50/50 flex items-center justify-between transition group"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <PatientAvatar patientId={p.id} name={`${p.firstName} ${p.lastName}`} gender={p.gender} imageUrl={p.photo || p.avatar} size="sm" />
                      <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-800 group-hover:text-blue-600 flex items-center gap-1.5">
                        <span>{p.firstName} {p.lastName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({p.id})</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {p.age}y · {p.gender} · Blood: <span className="font-semibold">{p.bloodGroup}</span> · {p.primaryPhysicianName}
                      </div>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        p.status === 'Emergency'
                          ? 'bg-red-100 text-red-700'
                          : p.status === 'Inpatient'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {p.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center status badges */}
      <div className="hidden xl:flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{currentTime || '00:00:00'} EST</span>
        </div>
        {emergencyPatientsCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <span>{emergencyPatientsCount} ER ADMISSIONS ACTIVE</span>
          </div>
        )}
      </div>

      {/* Right Controls: Streamlined to prevent duplicate buttons across screens */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Theme Selector */}
        <div className="relative" ref={themeMenuRef}>
          <button
            id="btn-header-theme"
            onClick={() => {
              if (onOpenThemeModal) {
                onOpenThemeModal();
              } else {
                setShowThemeMenu(!showThemeMenu);
              }
            }}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition border border-transparent hover:border-slate-200 flex items-center gap-1"
            title={`Current theme: ${activeThemeMeta.name}`}
            aria-label="Theme Selector"
          >
            <Palette className="w-4 h-4 text-blue-600" />
            <span
              className="w-2 h-2 rounded-full hidden sm:inline-block"
              style={{ backgroundColor: activeThemeMeta.accentHex }}
            />
          </button>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            id="btn-header-notifications"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            aria-label="Alerts"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in duration-150">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-bold text-xs uppercase tracking-wide text-slate-800">
                    Live Telemetry Feeds ({unreadCount})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={clearAllNotifications}
                    className="text-[10px] text-slate-500 hover:text-slate-700 uppercase font-semibold underline"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {visibleNotifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    All telemetry feeds operational. No alerts.
                  </div>
                ) : (
                  visibleNotifications.map((notif) => {
                    const isSmsNotification = /sms/i.test(notif.title) || /sms/i.test(notif.message);

                    return (
                      <div
                        key={notif.id}
                        onClick={() => markNotificationRead(notif.id)}
                        className={`p-3 text-left transition cursor-pointer flex items-start gap-2.5 ${
                          notif.read ? 'opacity-60 bg-white' : isSmsNotification ? 'bg-emerald-50/40' : 'bg-blue-50/30'
                        } hover:bg-slate-50 border-l-2 ${
                          isSmsNotification ? 'border-emerald-500' : notif.type === 'critical' ? 'border-red-500' : notif.type === 'warning' ? 'border-amber-500' : 'border-blue-500'
                        }`}
                      >
                        <div className="shrink-0 mt-0.5">
                          {isSmsNotification ? (
                            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-[9px] font-bold text-emerald-700">
                              SMS
                            </div>
                          ) : notif.type === 'critical' ? (
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          ) : notif.type === 'warning' ? (
                            <Info className="w-4 h-4 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-slate-800 truncate">
                              {notif.title}
                            </span>
                            <span className="text-[10px] text-slate-400">{notif.timestamp}</span>
                          </div>
                          {isSmsNotification && (
                            <div className="mt-1 inline-flex items-center rounded-full bg-emerald-100 text-[9px] font-bold uppercase tracking-wide text-emerald-700 px-1.5 py-0.5">
                              SMS Alert
                            </div>
                          )}
                          <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                            {notif.message}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="p-2 bg-slate-50 border-t border-slate-200 text-center flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>PCI-DSS & HIPAA Compliant Session</span>
              </div>
            </div>
          )}
        </div>

        {/* Reset System Data */}
        <button
          id="btn-header-reset"
          onClick={() => {
            if (window.confirm('Reset hospital database to default sample records?')) {
              resetHospitalData();
            }
          }}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          title="Reset hospital demo records"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* User Profile & Role Switcher */}
        <div className="relative pl-2 border-l border-slate-200" ref={roleMenuRef}>
          <div
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition"
            title="Click to switch staff role or view profile"
          >
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-slate-800">{currentUser.name}</span>
              <span className="text-[10px] text-blue-600 uppercase tracking-wider font-bold flex items-center gap-0.5">
                <span>{currentRole}</span>
                <ChevronDown className="w-2.5 h-2.5" />
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
              {currentUser.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </div>
          </div>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in duration-150">
              <div className="p-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-slate-900">{currentUser.name}</div>
                    <div className="text-[10px] text-slate-500">{currentUser.email || currentUser.department}</div>
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                    Active: {currentRole}
                  </span>
                </div>
              </div>
              <div className="p-2">
                <div className="text-[10px] uppercase font-bold text-slate-400 px-2 mb-1 tracking-wider">
                  Switch Active Role (RBAC)
                </div>
                <div className="space-y-0.5">
                  {availableRoles.map((r) => {
                    const isCurrent = currentRole === r.role;
                    const Icon = r.icon;
                    return (
                      <button
                        key={r.role}
                        onClick={() => {
                          setCurrentRole(r.role);
                          setShowRoleMenu(false);
                        }}
                        className={`w-full p-2 rounded-lg text-left text-xs transition flex items-start justify-between ${
                          isCurrent
                            ? 'bg-blue-50 border border-blue-200 text-blue-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isCurrent ? 'text-blue-600' : 'text-slate-400'}`} />
                          <div>
                            <div className="font-bold text-xs">{r.title}</div>
                            <div className="text-[10px] text-slate-500 line-clamp-1">{r.desc}</div>
                          </div>
                        </div>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="p-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button
                  onClick={() => {
                    setShowRoleMenu(false);
                    if (onOpenThemeModal) onOpenThemeModal();
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                >
                  <Palette className="w-3 h-3" />
                  <span>Theme & Display</span>
                </button>
                <button
                  onClick={logout}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
