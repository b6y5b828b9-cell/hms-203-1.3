import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FileText,
  Info,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRound,
  X,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import {
  DoctorPackage,
  DoctorPackageService,
  HospitalPriceItem,
  Patient,
  PatientPackageAssignment,
  ReceptionToken,
} from '../types';
import { buildPackageLedger, getPackageRetailValue, PackageLedger } from '../utils/packageLedger';
import { getThemeClasses, normalizeTheme } from '../utils/theme';
import { PatientAvatar } from './PatientAvatar';

const formatAed = (amount: number) =>
  new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 2 }).format(amount);

const getLocalDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const getServiceGroup = (category: HospitalPriceItem['category']) => {
  if (category === 'Consultation') return 'Consultations';
  if (category === 'Diagnostic Lab') return 'Laboratory';
  if (category === 'Radiology & Imaging') return 'Radiology';
  return 'Procedures / Room';
};

const resolvePackage = (
  patient: Patient | undefined,
  token: ReceptionToken | undefined,
  doctorPackages: DoctorPackage[]
): { packageItem: DoctorPackage; assignment?: PatientPackageAssignment } | null => {
  if (!patient || !token) return null;
  const tokenPackageId = token.paymentScheme?.packageId;
  const visitDate = token.visitDate || token.createdDate || getLocalDate();
  const assignment = (patient.packageAssignments || [])
    .filter((entry) =>
      entry.doctorId === token.doctorId &&
      entry.validFrom <= visitDate &&
      entry.validUntil >= visitDate &&
      (!tokenPackageId || entry.doctorPackageId === tokenPackageId)
    )
    .sort((first, second) => second.assignedAt.localeCompare(first.assignedAt))[0];
  const catalogPackage = doctorPackages.find((entry) =>
    entry.id === (tokenPackageId || assignment?.doctorPackageId)
  );
  if (!catalogPackage && !assignment) return null;

  const packageItem = catalogPackage || {
    id: assignment!.doctorPackageId,
    doctorId: assignment!.doctorId,
    packageName: assignment!.packageName,
    packageNumber: assignment!.packageNumber,
    coveragePercent: assignment!.coveragePercent,
    validFrom: assignment!.validFrom,
    validUntil: assignment!.validUntil,
    basePrice: assignment!.basePrice || token.paymentScheme?.packageBasePrice || 0,
    includedServices: assignment!.includedServices || [],
    isActive: true,
    createdAt: assignment!.assignedAt,
    createdBy: assignment!.assignedBy,
  } satisfies DoctorPackage;

  return {
    packageItem: {
      ...packageItem,
      packageName: assignment?.packageName || token.paymentScheme?.packageName || packageItem.packageName,
      packageNumber: assignment?.packageNumber || token.paymentScheme?.packageNumber || packageItem.packageNumber,
      coveragePercent: token.paymentScheme?.coveragePercent ?? assignment?.coveragePercent ?? packageItem.coveragePercent,
      validFrom: assignment?.validFrom || packageItem.validFrom,
      validUntil: assignment?.validUntil || packageItem.validUntil,
      basePrice: token.paymentScheme?.packageBasePrice ?? assignment?.basePrice ?? packageItem.basePrice ?? 0,
      includedServices: assignment?.includedServices || packageItem.includedServices || [],
    },
    assignment,
  };
};

const PackageStatusBadge: React.FC<{ status: 'Active' | 'Exhausted' | 'Unbundled / Extra' | 'Pre-Auth Approved' | 'Pending'; isDark?: boolean }> = ({ status, isDark = false }) => {
  const lightPalette = {
    Active: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    Exhausted: 'border-rose-200 bg-rose-50 text-rose-800',
    'Unbundled / Extra': 'border-amber-200 bg-amber-50 text-amber-900',
    'Pre-Auth Approved': 'border-sky-200 bg-sky-50 text-sky-800',
    Pending: 'border-amber-200 bg-amber-50 text-amber-900',
  };
  const darkPalette = {
    Active: 'border-emerald-800 bg-emerald-950/60 text-emerald-300',
    Exhausted: 'border-rose-800 bg-rose-950/60 text-rose-300',
    'Unbundled / Extra': 'border-amber-800 bg-amber-950/60 text-amber-300',
    'Pre-Auth Approved': 'border-sky-800 bg-sky-950/60 text-sky-300',
    Pending: 'border-amber-800 bg-amber-950/60 text-amber-300',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${isDark ? darkPalette[status] : lightPalette[status]}`}>{status}</span>;
};

const PackageSelectionDrawer: React.FC<{
  packages: DoctorPackage[];
  query: string;
  setQuery: (query: string) => void;
  onClose: () => void;
  onAssign: (packageId: string) => void;
  isDark: boolean;
}> = ({ packages, query, setQuery, onClose, onAssign, isDark }) => {
  const searchRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const filteredPackages = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return packages;
    return packages.filter((item) => [
      item.packageName,
      item.packageNumber,
      ...item.includedServices.flatMap((service) => [service.name, service.code, service.cptCode || '', service.department]),
    ].some((value) => value.toLocaleLowerCase().includes(needle)));
  }, [packages, query]);

  useEffect(() => {
    searchRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusableElements = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements?.length) return;
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex justify-end bg-slate-950/45"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        id="package-selection-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="package-drawer-title"
        className={`flex h-full w-full max-w-xl flex-col border-l shadow-2xl ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}
      >
        <div className={`flex items-start justify-between gap-4 border-b p-5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">Package catalog</p>
            <h2 id="package-drawer-title" className={`mt-1 text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Assign a care package</h2>
            <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Packages are doctor-specific; tariff codes and service prices are locked to the configured catalog.</p>
          </div>
          <button type="button" aria-label="Close package drawer" onClick={onClose} className={`rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={`border-b p-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <label className="relative block">
            <span className="sr-only">Search packages and included services</span>
            <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search package, service, department or CPT code"
              className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${isDark ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-white text-slate-800 placeholder:text-slate-400'}`}
            />
          </label>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {filteredPackages.map((item) => {
            const retailValue = getPackageRetailValue(item.includedServices);
            const savings = Math.max(0, retailValue - item.basePrice);
            return (
              <article key={item.id} className={`rounded-xl border p-4 ${isDark ? 'border-slate-700 bg-slate-950/60' : 'border-slate-200 bg-white shadow-sm'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.packageName}</h3>
                    <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No. {item.packageNumber} · {item.coveragePercent}% coverage · valid through {item.validUntil}</p>
                  </div>
                  <div className="text-right">
                    <strong className={`block text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatAed(item.basePrice)}</strong>
                    {savings > 0 && <span className="text-[10px] font-bold text-emerald-700">Save {formatAed(savings)}</span>}
                  </div>
                </div>
                <div className={`mt-3 rounded-lg p-3 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                  <div className={`mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span>Included tariff services</span><span>{item.includedServices.length} services</span>
                  </div>
                  <ul className="space-y-1.5">
                    {item.includedServices.slice(0, 4).map((service) => (
                      <li key={service.tariffItemId} className="flex items-center justify-between gap-2 text-xs">
                        <span className={`min-w-0 truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{service.name}</span>
                        <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] ${isDark ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`} title={`${service.name}. ${service.insuranceCoveredPercent}% estimated insurance coverage.`}>
                          {service.cptCode || service.code} · ×{service.quota}
                        </span>
                      </li>
                    ))}
                    {item.includedServices.length > 4 && <li className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>+ {item.includedServices.length - 4} more included services</li>}
                    {!item.includedServices.length && <li className="text-[11px] text-amber-700">No service quotas configured.</li>}
                  </ul>
                </div>
                <button type="button" onClick={() => onAssign(item.id)} disabled={!item.includedServices.length} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  Assign &amp; apply to visit <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </article>
            );
          })}
          {filteredPackages.length === 0 && (
            <div className={`rounded-xl border border-dashed p-8 text-center ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>
              <Search className={`mx-auto h-5 w-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <p className={`mt-2 text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>No matching packages</p>
              <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Try another package name or CPT code, or check the doctor and validity dates.</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export const PackageAssignmentView: React.FC = () => {
  const {
    patients,
    doctors,
    doctorPackages,
    hospitalPriceCatalog,
    receptionTokens,
    currentRole,
    currentUser,
    appTheme,
    assignDoctorPackageToToken,
    submitPackagePreAuth,
  } = useHospital();
  const theme = getThemeClasses(appTheme);
  const isDark = normalizeTheme(appTheme) === 'dark';
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || '');
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [packageSearch, setPackageSearch] = useState('');
  const assignButtonRef = useRef<HTMLButtonElement>(null);

  const selectedPatient = patients.find((item) => item.id === selectedPatientId);
  const patientTokens = useMemo(() =>
    receptionTokens
      .filter((token) => token.patientId === selectedPatientId && token.status !== 'Cancelled')
      .sort((first, second) => `${second.visitDate || second.createdDate || ''} ${second.createdTime}`.localeCompare(`${first.visitDate || first.createdDate || ''} ${first.createdTime}`)),
  [receptionTokens, selectedPatientId]);
  const selectedToken = patientTokens.find((item) => item.id === selectedTokenId);

  useEffect(() => {
    if (!patientTokens.some((token) => token.id === selectedTokenId)) {
      setSelectedTokenId(patientTokens[0]?.id || '');
    }
  }, [patientTokens, selectedTokenId]);

  const visitDate = selectedToken?.visitDate || selectedToken?.createdDate || getLocalDate();
  const resolvedPackage = resolvePackage(selectedPatient, selectedToken, doctorPackages);
  const activePackage = resolvedPackage?.packageItem;
  const activeAssignment = resolvedPackage?.assignment;
  const isAppliedToVisit = Boolean(activePackage && selectedToken?.paymentScheme?.packageId === activePackage.id);
  const packageLedger: PackageLedger | null = activePackage && selectedToken
    ? buildPackageLedger(
        activePackage,
        patientTokens,
        selectedToken.id,
        activeAssignment?.validFrom || activePackage.validFrom,
        activeAssignment?.validUntil || activePackage.validUntil
      )
    : null;
  const availablePackages = doctorPackages.filter((item) =>
    item.isActive &&
    item.doctorId === selectedToken?.doctorId &&
    item.validFrom <= visitDate &&
    item.validUntil >= visitDate &&
    item.includedServices.length > 0
  );
  const doctorName = doctors.find((doctor) => doctor.id === selectedToken?.doctorId)?.name || selectedToken?.doctorName || 'Doctor not assigned';
  const payer = selectedToken?.paymentScheme?.insuranceProvider || selectedPatient?.insurance.provider || selectedToken?.insuranceProvider || 'Self-pay';
  const network = selectedToken?.paymentScheme?.network || selectedPatient?.insurance.network || 'Network not recorded';
  const scheme = selectedToken?.paymentScheme;
  const basePackagePrice = isAppliedToVisit
    ? Math.max(0, scheme?.packageBasePrice ?? activePackage?.basePrice ?? 0)
    : 0;
  const coveragePercent = Math.min(100, Math.max(0, scheme?.coveragePercent ?? activePackage?.coveragePercent ?? 0));
  const deductible = isAppliedToVisit
    ? Math.max(0, scheme?.deductibleAmount ?? selectedPatient?.insurance.deductibleAmount ?? 0)
    : 0;
  const deductibleAppliedToPackage = Math.min(basePackagePrice, deductible);
  const packageInsuranceCovered = Math.max(0, basePackagePrice - deductibleAppliedToPackage) * coveragePercent / 100;
  let remainingDeductible = Math.max(0, deductible - deductibleAppliedToPackage);
  const unbundledCharges = isAppliedToVisit ? packageLedger?.unbundledCharges || [] : [];
  const unbundledTotal = unbundledCharges.reduce((total, charge) => total + charge.totalPrice, 0);
  const extraInsuranceCovered = unbundledCharges.reduce((total, charge) => {
    const tariff = hospitalPriceCatalog.find((item) =>
      item.code === charge.lineItem.code ||
      item.cptCode === charge.lineItem.code ||
      item.name.toLocaleLowerCase() === charge.lineItem.name.toLocaleLowerCase()
    );
    const amountAfterDeductible = Math.max(0, charge.totalPrice - Math.min(charge.totalPrice, remainingDeductible));
    remainingDeductible = Math.max(0, remainingDeductible - charge.totalPrice);
    const approvedAmount = charge.lineItem.insuranceApprovedAmount;
    if (['Approved', 'Partially_Approved'].includes(charge.lineItem.insuranceStatus) && Number.isFinite(approvedAmount)) {
      const lineTotal = charge.lineItem.totalPrice || charge.totalPrice;
      return total + Math.min(charge.totalPrice, Math.max(0, approvedAmount || 0) * charge.totalPrice / lineTotal);
    }
    if (charge.lineItem.insuranceStatus === 'Denied' || charge.lineItem.insuranceStatus === 'Cash_Only') return total;
    const coverage = charge.includedService?.insuranceCoveredPercent ?? tariff?.insuranceCoveredApprox ?? 0;
    return total + amountAfterDeductible * Math.min(100, Math.max(0, coverage)) / 100;
  }, 0);
  const insuranceCovered = packageInsuranceCovered + extraInsuranceCovered;
  const patientShare = Math.max(0, basePackagePrice + unbundledTotal - insuranceCovered);
  const totalPaid = Math.max(0, selectedToken?.billingSummary?.totalPaid || 0);
  const netPayable = Math.max(0, patientShare - totalPaid);
  const packagePatientShare = Math.max(0, basePackagePrice - packageInsuranceCovered);
  const preAuthStatus = scheme?.preAuthStatus;
  const canAssign = ['admin', 'receptionist'].includes(currentRole) &&
    Boolean(selectedPatient && selectedToken && !selectedToken.billingSummary && selectedToken.status !== 'Completed');
  const canApplyActivePackage = canAssign && Boolean(
    activePackage && doctorPackages.some((item) => item.id === activePackage.id && item.isActive)
  );

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    window.requestAnimationFrame(() => assignButtonRef.current?.focus());
  }, []);
  const handleAssignPackage = (packageId: string) => {
    if (!selectedPatient || !selectedToken) return;
    if (assignDoctorPackageToToken(selectedPatient.id, selectedToken.id, packageId)) closeDrawer();
  };
  const handlePrintStatement = () => window.print();
  const inputClass = `w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-800'}`;
  const surfaceClass = `${theme.cardBackground} rounded-xl border ${theme.cardBorder}`;

  return (
    <div className={`min-h-full p-4 lg:p-6 ${theme.mainBackground}`}>
      <div className="mx-auto max-w-[1600px] space-y-4">
        <div className="print:hidden">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isDark ? 'text-sky-400' : 'text-teal-700'}`}>Revenue cycle · package desk</p>
              <h1 className={`mt-1 text-xl font-bold tracking-tight sm:text-2xl ${theme.textPrimary}`}>Package Assignment &amp; Billing Ledger</h1>
              <p className={`mt-1 max-w-2xl text-xs ${theme.textSecondary}`}>Review entitlements, encounter utilization, payer split, and out-of-package charges before billing.</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${theme.accentBadge}`}>
              <ShieldCheck className="h-3.5 w-3.5" /> Tariff-locked ledger
            </span>
          </header>

          <section className={`${surfaceClass} mb-4 p-4`}>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
              <label className={`block text-[10px] font-bold uppercase tracking-wide ${theme.textSecondary}`}>
                Patient / MRN
                <select value={selectedPatientId} onChange={(event) => setSelectedPatientId(event.target.value)} className={`${inputClass} mt-1.5 normal-case`}>
                  <option value="">Select a patient</option>
                  {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName} · {patient.rgNo || patient.id}</option>)}
                </select>
              </label>
              <label className={`block text-[10px] font-bold uppercase tracking-wide ${theme.textSecondary}`}>
                Active visit / token
                <span className="relative mt-1.5 block">
                  <select value={selectedTokenId} onChange={(event) => setSelectedTokenId(event.target.value)} disabled={!patientTokens.length} className={`${inputClass} appearance-none pr-9 normal-case disabled:opacity-60`}>
                    {!patientTokens.length && <option value="">No active visit tokens</option>}
                    {patientTokens.map((token) => <option key={token.id} value={token.id}>{token.tokenNumber} · {token.visitDate || token.createdDate || 'Date n/a'} · {token.doctorName || 'No doctor'}</option>)}
                  </select>
                  <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${theme.textSecondary}`} />
                </span>
              </label>
            </div>

            {selectedPatient ? (
              <div className={`mt-4 flex flex-wrap items-center justify-between gap-4 border-t pt-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <PatientAvatar
                    patientId={selectedPatient.id}
                    name={`${selectedPatient.firstName} ${selectedPatient.lastName}`}
                    gender={selectedPatient.gender}
                    imageUrl={selectedPatient.avatar || selectedPatient.photo}
                    size="md"
                  />
                  <div className="min-w-0">
                    <h2 className={`truncate text-base font-bold ${theme.textPrimary}`}>{selectedPatient.firstName} {selectedPatient.middleName} {selectedPatient.lastName}</h2>
                    <div className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] ${theme.textSecondary}`}>
                      <span className="font-mono">MRN {selectedPatient.rgNo || selectedPatient.id}</span>
                      <span className="inline-flex items-center gap-1"><Stethoscope className="h-3 w-3" />{doctorName}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${isDark ? 'border-slate-700 bg-slate-950 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                    {selectedToken?.tokenNumber || 'No token'}
                  </span>
                  <span className={`rounded-md border px-2 py-1 text-[10px] font-bold ${selectedPatient.status === 'Inpatient' ? 'border-violet-200 bg-violet-50 text-violet-800' : 'border-cyan-200 bg-cyan-50 text-cyan-800'}`}>
                    {selectedPatient.status === 'Inpatient' ? 'IPD' : 'OPD'} · {selectedToken?.visitType || 'Encounter'}
                  </span>
                  <span className={`max-w-[260px] truncate rounded-md border px-2 py-1 text-[10px] font-semibold ${isDark ? 'border-slate-700 bg-slate-950 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`} title={`${payer} · ${network}`}>
                    {payer} · {network}
                  </span>
                  <button
                    ref={assignButtonRef}
                    aria-controls="package-selection-drawer"
                    aria-expanded={drawerOpen}
                    type="button"
                    onClick={() => { setPackageSearch(''); setDrawerOpen(true); }}
                    disabled={!canAssign}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Assign New Package
                  </button>
                </div>
              </div>
            ) : (
              <div className={`mt-4 rounded-lg border border-dashed p-5 text-center text-xs ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'}`}>Select a patient to review package and visit details.</div>
            )}
          </section>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(320px,1fr)]">
            <div className="min-w-0 space-y-4">
              <section className={`${surfaceClass} overflow-hidden`}>
                <div className={`flex flex-wrap items-center justify-between gap-3 border-b p-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`grid h-9 w-9 place-items-center rounded-lg ${isDark ? 'bg-teal-950 text-teal-300' : 'bg-teal-50 text-teal-700'}`}><Activity className="h-4 w-4" /></span>
                    <div>
                      <h2 className={`text-sm font-bold ${theme.textPrimary}`}>Active care &amp; package utilization</h2>
                      <p className={`mt-0.5 text-[10px] ${theme.textSecondary}`}>Entitlement used across visits linked to this package, within the validity period.</p>
                    </div>
                  </div>
                  {activePackage && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>{activePackage.packageName} · {activePackage.packageNumber}</span>
                      {isAppliedToVisit && preAuthStatus === 'Approved' && <PackageStatusBadge status="Pre-Auth Approved" isDark={isDark} />}
                      {isAppliedToVisit && preAuthStatus === 'Pending' && <PackageStatusBadge status="Pending" isDark={isDark} />}
                      {!isAppliedToVisit && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">Not applied to visit</span>}
                    </div>
                  )}
                </div>
                {activePackage && packageLedger ? (
                  <>
                    {!isAppliedToVisit && (
                      <div className={`mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${isDark ? 'border-amber-900/70 bg-amber-950/30' : 'border-amber-200 bg-amber-50'}`}>
                        <p className={`text-xs ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>This package is assigned to the patient profile, but is not linked to the selected visit.{!canApplyActivePackage && ' It is no longer active and cannot be applied.'}</p>
                        {canApplyActivePackage && <button type="button" onClick={() => handleAssignPackage(activePackage.id)} className="rounded-md bg-amber-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-800">Apply to visit</button>}
                      </div>
                    )}
                    {activePackage.includedServices.length ? (
                      <div className="space-y-4 p-4">
                        {Object.entries(
                          activePackage.includedServices.reduce<Record<string, DoctorPackageService[]>>((groups, service) => {
                            const group = getServiceGroup(service.category);
                            (groups[group] ||= []).push(service);
                            return groups;
                          }, {})
                        ).map(([department, services]) => (
                          <section key={department} aria-label={`${department} package services`}>
                            <h3 className={`mb-2 text-[10px] font-bold uppercase tracking-[0.12em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{department}</h3>
                            <div className={`overflow-hidden rounded-lg border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                              <div className={`hidden grid-cols-[minmax(0,1fr)_minmax(125px,0.45fr)_auto] gap-3 px-3 py-2 text-[9px] font-bold uppercase tracking-wide sm:grid ${isDark ? 'bg-slate-950 text-slate-500' : 'bg-slate-50 text-slate-500'}`}>
                                <span>Service / locked tariff</span><span>Package utilization</span><span>Unit status</span>
                              </div>
                              {services.map((service) => {
                                const usage = packageLedger.usage.find((entry) => entry.service.tariffItemId === service.tariffItemId);
                                const used = usage?.usedCount || 0;
                                const quota = usage?.quota || service.quota;
                                const progress = quota ? Math.min(100, used / quota * 100) : 0;
                                const rowStatus = used >= quota ? 'Exhausted' : 'Active';
                                const description = `${service.name}. ${service.insuranceCoveredPercent}% estimated insurance coverage. Tariff price locked at ${formatAed(service.unitPrice)}.`;
                                return (
                                  <div key={service.tariffItemId} className={`grid gap-3 border-t p-3 sm:grid-cols-[minmax(0,1fr)_minmax(125px,0.45fr)_auto] sm:items-center ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <div className="min-w-0">
                                      <p className={`text-xs font-semibold ${theme.textPrimary}`}>{service.name}</p>
                                      <div className={`mt-1 flex flex-wrap items-center gap-1.5 text-[10px] ${theme.textSecondary}`}>
                                        <span>{service.department}</span>
                                        <span aria-hidden="true">·</span>
                                        <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono ${isDark ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`} title={description}>
                                          <Info className="h-3 w-3" />{service.cptCode || service.code}
                                        </span>
                                        <span className={`rounded border px-1.5 py-0.5 font-semibold ${isDark ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`} title="Tariff price is read-only and locked to the package service snapshot">{formatAed(service.unitPrice)} / unit</span>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="mb-1 flex items-center justify-between gap-2">
                                        <span className={`text-[10px] font-semibold ${theme.textPrimary}`}>{used} / {quota} Used</span>
                                        <span className={`text-[9px] ${theme.textSecondary}`}>{Math.round(progress)}%</span>
                                      </div>
                                      <div className={`h-1.5 overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} role="progressbar" aria-label={`${service.name} package utilization`} aria-valuemin={0} aria-valuemax={quota} aria-valuenow={Math.min(used, quota)}>
                                        <div className={`h-full rounded-full transition-all ${used >= quota ? 'bg-rose-500' : progress >= 75 ? 'bg-amber-500' : 'bg-teal-600'}`} style={{ width: `${progress}%` }} />
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1 sm:justify-end">
                                      <PackageStatusBadge status={rowStatus} isDark={isDark} />
                                      {isAppliedToVisit && preAuthStatus === 'Approved' && <PackageStatusBadge status="Pre-Auth Approved" isDark={isDark} />}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center">
                        <AlertCircle className="mx-auto h-5 w-5 text-amber-600" />
                        <p className={`mt-2 text-xs font-semibold ${theme.textPrimary}`}>No tariff quotas configured for this package.</p>
                        <p className={`mt-1 text-[10px] ${theme.textSecondary}`}>An administrator can add included services and locked quotas from Doctor Packages.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-8 text-center">
                    <Package className={`mx-auto h-7 w-7 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                    <h3 className={`mt-2 text-sm font-bold ${theme.textPrimary}`}>No active package on this visit</h3>
                    <p className={`mx-auto mt-1 max-w-sm text-xs ${theme.textSecondary}`}>Choose a patient and visit. Assign an eligible package to start tracking included services, quotas, and extra charges.</p>
                  </div>
                )}
              </section>

              <section className={`${surfaceClass} overflow-hidden`}>
                <div className={`flex flex-wrap items-center justify-between gap-2 border-b p-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`grid h-9 w-9 place-items-center rounded-lg ${isDark ? 'bg-amber-950 text-amber-300' : 'bg-amber-50 text-amber-700'}`}><CircleDollarSign className="h-4 w-4" /></span>
                    <div>
                      <h2 className={`text-sm font-bold ${theme.textPrimary}`}>Additional / unbundled charges</h2>
                      <p className={`mt-0.5 text-[10px] ${theme.textSecondary}`}>Services outside the package or above the included quota; prices are locked to ordered tariff rates.</p>
                    </div>
                  </div>
                  {unbundledCharges.length > 0 && <PackageStatusBadge status="Unbundled / Extra" isDark={isDark} />}
                </div>
                {!isAppliedToVisit ? (
                  <div className={`p-5 text-center text-xs ${theme.textSecondary}`}>Apply a package to this visit to identify included units and separate additional charges.</div>
                ) : unbundledCharges.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-xs">
                      <thead className={`text-[9px] uppercase tracking-wide ${isDark ? 'bg-slate-950 text-slate-500' : 'bg-slate-50 text-slate-500'}`}>
                        <tr><th className="px-4 py-2.5">Ordered service</th><th className="px-3 py-2.5">Code</th><th className="px-3 py-2.5">Extra units</th><th className="px-3 py-2.5">Locked unit price</th><th className="px-4 py-2.5 text-right">Charge</th></tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                        {unbundledCharges.map((charge, index) => {
                          const tariff = hospitalPriceCatalog.find((item) =>
                            item.code === charge.lineItem.code ||
                            item.cptCode === charge.lineItem.code ||
                            item.name.toLocaleLowerCase() === charge.lineItem.name.toLocaleLowerCase()
                          );
                          const description = tariff?.description || charge.lineItem.name;
                          return (
                            <tr key={`${charge.lineItem.id}-${index}`} className={isDark ? 'text-slate-200' : 'text-slate-700'}>
                              <td className="px-4 py-3">
                                <span className="font-semibold">{charge.lineItem.name}</span>
                                <span className={`mt-0.5 block text-[10px] ${theme.textSecondary}`}>{charge.lineItem.department}</span>
                              </td>
                              <td className="px-3 py-3"><span title={`${description} · Insurance estimate ${tariff?.insuranceCoveredApprox ?? charge.includedService?.insuranceCoveredPercent ?? 0}%`} className={`rounded border px-1.5 py-1 font-mono text-[10px] ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>{charge.lineItem.code || 'No tariff code'}</span></td>
                              <td className="px-3 py-3">{charge.extraQuantity}</td>
                              <td className="px-3 py-3">{formatAed(charge.unitPrice)}</td>
                              <td className="px-4 py-3 text-right font-bold">{formatAed(charge.totalPrice)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}>
                        <tr><td colSpan={4} className="px-4 py-3 text-right font-bold">Unbundled extras subtotal</td><td className="px-4 py-3 text-right font-extrabold">{formatAed(unbundledTotal)}</td></tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className={`flex items-center gap-2 p-5 text-xs ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}><CheckCircle2 className="h-4 w-4" /> All ordered services are within the package quotas.</div>
                )}
              </section>
            </div>

            <aside className="min-w-0 lg:sticky lg:top-4">
              <section className={`${surfaceClass} overflow-hidden`}>
                <div className="bg-gradient-to-br from-teal-800 to-teal-950 p-4 text-white">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-teal-200">Live financial summary</p>
                      <h2 className="mt-1 text-lg font-bold">{activePackage?.packageName || 'No package selected'}</h2>
                      <p className="mt-0.5 text-[10px] text-teal-100">{activePackage ? `Package ${activePackage.packageNumber} · ${coveragePercent}% coverage` : 'Assign an eligible package to calculate the payer split.'}</p>
                    </div>
                    <CircleDollarSign className="h-5 w-5 shrink-0 text-teal-200" />
                  </div>
                </div>
                <div className="space-y-4 p-4">
                  <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-100 bg-slate-50'}`}>
                    <div className={`mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide ${theme.textSecondary}`}>
                      <span>Insurance co-pay split</span><span>{payer}</span>
                    </div>
                    <div className="space-y-2.5">
                      <FinancialRow label="Base package price" amount={basePackagePrice} isDark={isDark} />
                      <FinancialRow label="Insurance covered" amount={-insuranceCovered} tone="positive" isDark={isDark} />
                      <FinancialRow label="Patient co-pay / deductible" amount={packagePatientShare} isDark={isDark} />
                      <div className={`border-t pt-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                        <FinancialRow label="Unbundled extras" amount={unbundledTotal} isDark={isDark} />
                        {unbundledTotal > 0 && <p className={`mt-1 text-right text-[9px] ${theme.textSecondary}`}>Estimated patient share: {formatAed(Math.max(0, unbundledTotal - extraInsuranceCovered))}</p>}
                      </div>
                      {deductibleAppliedToPackage > 0 && <p className={`text-[9px] ${theme.textSecondary}`}>Includes {formatAed(deductibleAppliedToPackage)} package deductible.</p>}
                    </div>
                  </div>

                  <div className={`rounded-xl border p-3 ${isDark ? 'border-teal-900 bg-teal-950/30' : 'border-teal-100 bg-teal-50/70'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wide ${isDark ? 'text-teal-200' : 'text-teal-800'}`}>Net payable balance</p>
                        <p className={`mt-1 text-2xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>{formatAed(netPayable)}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${netPayable === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{netPayable === 0 ? 'Settled' : 'Estimate'}</span>
                    </div>
                    {totalPaid > 0 && <p className={`mt-2 text-[10px] ${theme.textSecondary}`}>Less {formatAed(totalPaid)} received for this visit.</p>}
                  </div>

                  <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[10px] ${isDark ? 'border-slate-800 bg-slate-950 text-slate-400' : 'border-slate-200 bg-white text-slate-600'}`}>
                    <UserRound className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{payer} · {network}</span>
                    {preAuthStatus === 'Approved' ? <PackageStatusBadge status="Pre-Auth Approved" isDark={isDark} /> : preAuthStatus === 'Pending' ? <PackageStatusBadge status="Pending" isDark={isDark} /> : null}
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => selectedToken && submitPackagePreAuth(selectedToken.id)}
                      disabled={!isAppliedToVisit || !canAssign || preAuthStatus === 'Pending' || preAuthStatus === 'Approved'}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-700 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShieldCheck className="h-4 w-4" /> Submit for Insurance Pre-Auth
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintStatement}
                      disabled={!isAppliedToVisit || !selectedToken}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                    >
                      <FileText className="h-4 w-4" /> Generate Itemized Statement
                    </button>
                  </div>
                  <p className={`flex items-start gap-1.5 text-[9px] leading-4 ${theme.textSecondary}`}><Info className="mt-0.5 h-3 w-3 shrink-0" /> Coverage is an estimate until the payer confirms authorization. Tariff rates are read-only.</p>
                </div>
              </section>

              <section className={`${surfaceClass} mt-3 p-3`}>
                <div className="flex items-center gap-2">
                  <ClipboardList className={`h-4 w-4 ${isDark ? 'text-sky-300' : 'text-sky-700'}`} />
                  <h3 className={`text-xs font-bold ${theme.textPrimary}`}>Visit controls</h3>
                </div>
                <div className={`mt-2 grid grid-cols-2 gap-2 text-[10px] ${theme.textSecondary}`}>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{visitDate}</span>
                  <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{selectedToken?.createdTime || 'No token'}</span>
                  <span className="inline-flex items-center gap-1"><Stethoscope className="h-3 w-3" />{doctorName}</span>
                  <span className="inline-flex items-center gap-1"><BadgeCheck className="h-3 w-3" />{currentUser.name}</span>
                </div>
              </section>
            </aside>
          </div>
        </div>

        <section id="package-statement" className="hidden print:block print:p-8">
          <h1 className="text-2xl font-bold">Itemized Package Statement</h1>
          <p className="mt-1 text-sm">{selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName} · MRN ${selectedPatient.rgNo || selectedPatient.id}` : 'Patient not selected'}</p>
          <p className="text-sm">{selectedToken?.tokenNumber || 'No token'} · {visitDate} · {activePackage?.packageName || 'No package'}</p>
          <hr className="my-4" />
          <table className="w-full border-collapse text-sm">
            <thead><tr className="border-b text-left"><th className="py-2">Service</th><th>Code</th><th>Quantity</th><th>Unit price</th><th className="text-right">Charge</th></tr></thead>
            <tbody>
              {activePackage?.includedServices.map((service) => {
                const usage = packageLedger?.usage.find((row) => row.service.tariffItemId === service.tariffItemId);
                return <tr key={service.tariffItemId} className="border-b"><td className="py-2">{service.name} (included)</td><td>{service.cptCode || service.code}</td><td>{usage?.usedCount || 0} / {service.quota}</td><td>{formatAed(service.unitPrice)}</td><td className="text-right">Included in package</td></tr>;
              })}
              {unbundledCharges.map((charge, index) => <tr key={`${charge.lineItem.id}-${index}`} className="border-b"><td className="py-2">{charge.lineItem.name}</td><td>{charge.lineItem.code || '—'}</td><td>{charge.extraQuantity}</td><td>{formatAed(charge.unitPrice)}</td><td className="text-right">{formatAed(charge.totalPrice)}</td></tr>)}
            </tbody>
          </table>
          <div className="ml-auto mt-5 w-72 space-y-1 text-right text-sm">
            <p>Package: {formatAed(basePackagePrice)}</p>
            <p>Insurance covered: −{formatAed(insuranceCovered)}</p>
            <p>Unbundled extras: {formatAed(unbundledTotal)}</p>
            <p className="border-t pt-2 font-bold">Net payable: {formatAed(netPayable)}</p>
          </div>
        </section>
      </div>

      {drawerOpen && (
        <PackageSelectionDrawer
          packages={availablePackages}
          query={packageSearch}
          setQuery={setPackageSearch}
          onClose={closeDrawer}
          onAssign={handleAssignPackage}
          isDark={isDark}
        />
      )}
      <style>{`@media print { body * { visibility: hidden !important; } #package-statement, #package-statement * { visibility: visible !important; } #package-statement { position: absolute; inset: 0; display: block !important; width: 100%; } }`}</style>
    </div>
  );
};

const FinancialRow: React.FC<{ label: string; amount: number; tone?: 'positive'; isDark: boolean }> = ({ label, amount, tone, isDark }) => (
  <div className="flex items-center justify-between gap-3 text-xs">
    <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{label}</span>
    <span className={`font-semibold ${tone === 'positive' ? 'text-emerald-700' : isDark ? 'text-slate-100' : 'text-slate-900'}`}>
      {amount < 0 ? `−${formatAed(Math.abs(amount))}` : formatAed(amount)}
    </span>
  </div>
);
