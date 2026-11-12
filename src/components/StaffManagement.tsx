import React, { useState } from 'react';
import {
  Stethoscope,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  UserCheck,
  Plus,
  Mail,
  Phone,
  Award,
  CalendarClock,
  X,
  UserPlus,
  UserX,
  AlertCircle,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { DoctorPackageService, StaffMember, UserRole } from '../types';
import { getDoctorDegree, getDoctorDisplayName } from '../utils/doctorProfile';

const getLocalDateString = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const StaffManagement: React.FC = () => {
  const {
    staff,
    doctors,
    currentRole,
    currentUser,
    addStaff,
    deactivateStaff,
    updateDoctorProfile,
    doctorPackages,
    hospitalPriceCatalog,
    saveDoctorPackage,
    deactivateDoctorPackage,
    doctorDutyChangeRequests,
    reviewDoctorDutyChangeRequest,
  } = useHospital();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDepartment, setNewDepartment] = useState(currentUser.department);
  const [newRoom, setNewRoom] = useState('');
  const [newLicense, setNewLicense] = useState('');
  const [newShift, setNewShift] = useState<StaffMember['shift']>('Morning (07:00 - 15:00)');
  const [newRole, setNewRole] = useState<UserRole>(currentRole === 'doctor' ? 'nurse' : 'doctor');
  const [formError, setFormError] = useState('');
  const [staffToDeactivate, setStaffToDeactivate] = useState<StaffMember | null>(null);
  const [editingDoctorId, setEditingDoctorId] = useState(doctors[0]?.id || '');
  const [doctorName, setDoctorName] = useState(getDoctorDisplayName(doctors[0] || { name: '' }));
  const [doctorDepartment, setDoctorDepartment] = useState(doctors[0]?.department || '');
  const [doctorNationality, setDoctorNationality] = useState(doctors[0]?.nationality || '');
  const [doctorLanguage, setDoctorLanguage] = useState(doctors[0]?.language || '');
  const [doctorDegree, setDoctorDegree] = useState(getDoctorDegree(doctors[0] || { name: '' }));
  const [doctorFormError, setDoctorFormError] = useState('');
  const [editingPackageId, setEditingPackageId] = useState('');
  const [packageDoctorId, setPackageDoctorId] = useState(doctors[0]?.id || '');
  const [packageName, setPackageName] = useState('');
  const [packageNumber, setPackageNumber] = useState('');
  const [packageCoverage, setPackageCoverage] = useState('100');
  const [packageBasePrice, setPackageBasePrice] = useState('0');
  const [packageServices, setPackageServices] = useState<DoctorPackageService[]>([]);
  const [selectedPackageTariffId, setSelectedPackageTariffId] = useState('');
  const [selectedServiceQuota, setSelectedServiceQuota] = useState('1');
  const [packageValidFrom, setPackageValidFrom] = useState(getLocalDateString);
  const [packageValidUntil, setPackageValidUntil] = useState(getLocalDateString);
  const [packageIsActive, setPackageIsActive] = useState(true);
  const [packageFormError, setPackageFormError] = useState('');

  const doctorManagedRoles: UserRole[] = ['doctor', 'nurse', 'physiotherapist', 'lab', 'radiology'];
  const canManageStaff = currentRole === 'admin' || currentRole === 'doctor';
  const activeAdminCount = staff.filter((member) => member.role === 'admin' && member.isActive !== false).length;

  const canManageMember = (member: StaffMember) =>
    member.id !== currentUser.id &&
    !(member.role === 'admin' && activeAdminCount <= 1) &&
    (currentRole === 'admin' || (
      currentRole === 'doctor' &&
      member.department === currentUser.department &&
      doctorManagedRoles.includes(member.role)
    ));

  const filteredStaff = staff.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      roleFilter === 'all' || s.role.toLowerCase() === roleFilter.toLowerCase();
    const matchesActive = showInactive || s.isActive !== false;

    return matchesSearch && matchesRole && matchesActive;
  });
  const pendingDutyRequests = doctorDutyChangeRequests.filter((request) => request.status === 'Pending');

  const handleAddStaff = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    const result = addStaff({
      name: newName.trim(),
      role: newRole,
      department: currentRole === 'doctor' ? currentUser.department : newDepartment.trim(),
      shift: newShift,
      phone: newPhone.trim(),
      email: newEmail.trim(),
      roomOrStation: newRoom.trim(),
      licenseNumber: newLicense.trim() || 'Pending verification',
      status: 'On Duty',
    });
    if (!result) {
      setFormError('You do not have permission to add this staff role or department.');
      return;
    }
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewRoom('');
    setNewLicense('');
    setIsAddFormOpen(false);
  };

  const handleDoctorSelection = (doctorId: string) => {
    const doctor = doctors.find((item) => item.id === doctorId);
    if (!doctor) return;
    setEditingDoctorId(doctorId);
    setDoctorName(getDoctorDisplayName(doctor));
    setDoctorDepartment(doctor.department);
    setDoctorNationality(doctor.nationality || '');
    setDoctorLanguage(doctor.language || '');
    setDoctorDegree(getDoctorDegree(doctor));
    setDoctorFormError('');
  };

  const handleSaveDoctorProfile = (event: React.FormEvent) => {
    event.preventDefault();
    const saved = updateDoctorProfile(editingDoctorId, {
      name: doctorName,
      department: doctorDepartment,
      nationality: doctorNationality,
      language: doctorLanguage,
      degree: doctorDegree,
    });
    setDoctorFormError(saved ? '' : 'Doctor details were not saved. Check the required fields and try again.');
  };

  const handleSaveDoctorPackage = (event: React.FormEvent) => {
    event.preventDefault();
    setPackageFormError('');
    const saved = saveDoctorPackage({
      id: editingPackageId || `PKG-${Date.now()}`,
      doctorId: packageDoctorId,
      packageName,
      packageNumber,
      coveragePercent: Number(packageCoverage),
      basePrice: Number(packageBasePrice),
      includedServices: packageServices,
      validFrom: packageValidFrom,
      validUntil: packageValidUntil,
      isActive: packageIsActive,
    });
    if (!saved) {
      setPackageFormError('Package was not saved. Check the fields and your administrator permissions.');
      return;
    }
    setEditingPackageId('');
    setPackageName('');
    setPackageNumber('');
    setPackageCoverage('100');
    setPackageBasePrice('0');
    setPackageServices([]);
    setSelectedPackageTariffId('');
    setSelectedServiceQuota('1');
    setPackageValidFrom(getLocalDateString());
    setPackageValidUntil(getLocalDateString());
    setPackageIsActive(true);
  };

  const handleEditDoctorPackage = (packageId: string) => {
    const item = doctorPackages.find((entry) => entry.id === packageId);
    if (!item) return;
    setEditingPackageId(item.id);
    setPackageDoctorId(item.doctorId);
    setPackageName(item.packageName);
    setPackageNumber(item.packageNumber);
    setPackageCoverage(String(item.coveragePercent));
    setPackageBasePrice(String(item.basePrice || 0));
    setPackageServices((item.includedServices || []).map((service) => ({ ...service })));
    setSelectedPackageTariffId('');
    setSelectedServiceQuota('1');
    setPackageValidFrom(item.validFrom);
    setPackageValidUntil(item.validUntil);
    setPackageIsActive(item.isActive);
    setPackageFormError('');
  };

  const handleCancelPackageEdit = () => {
    setEditingPackageId('');
    setPackageDoctorId(doctors[0]?.id || '');
    setPackageName('');
    setPackageNumber('');
    setPackageCoverage('100');
    setPackageBasePrice('0');
    setPackageServices([]);
    setSelectedPackageTariffId('');
    setSelectedServiceQuota('1');
    setPackageValidFrom(getLocalDateString());
    setPackageValidUntil(getLocalDateString());
    setPackageIsActive(true);
    setPackageFormError('');
  };

  const addPackageTariffService = () => {
    const tariff = hospitalPriceCatalog.find((item) => item.id === selectedPackageTariffId);
    const quota = Number(selectedServiceQuota);
    if (!tariff || !Number.isInteger(quota) || quota < 1 || packageServices.some((item) => item.tariffItemId === tariff.id)) {
      setPackageFormError('Choose a tariff service not already included and enter a positive whole-number quota.');
      return;
    }
    setPackageServices((current) => [...current, {
      tariffItemId: tariff.id,
      code: tariff.code,
      name: tariff.name,
      category: tariff.category,
      department: tariff.department,
      cptCode: tariff.cptCode,
      unitPrice: tariff.standardPrice,
      insuranceCoveredPercent: tariff.insuranceCoveredApprox,
      quota,
    }]);
    setSelectedPackageTariffId('');
    setSelectedServiceQuota('1');
    setPackageFormError('');
  };

  const packageRetailValue = packageServices.reduce((total, service) => total + service.unitPrice * service.quota, 0);

  if (!canManageStaff) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <section className="rounded-xl border border-amber-200 bg-white p-6 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-8 w-8 text-amber-600" />
          <h2 className="mt-3 text-base font-bold text-slate-900">Staff directory access restricted</h2>
          <p className="mt-1 text-sm text-slate-600">Only administrators and doctors can view this directory.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Stethoscope className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Hospital Clinical Staff Directory & Credentialing
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold uppercase">
              CREDENTIALS VERIFIED
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Medical staff rosters, attending physicians, nursing shift schedules, licensing boards, and institutional directory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>NPI & Medical License Verified</span>
          {canManageStaff && (
            <button
              type="button"
              onClick={() => {
                setFormError('');
                setIsAddFormOpen((open) => !open);
              }}
              className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-md bg-teal-800 px-3 text-xs font-bold text-white hover:bg-teal-900"
            >
              <UserPlus className="h-3.5 w-3.5" /> Add staff
            </button>
          )}
        </div>
      </div>

      {isAddFormOpen && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Add staff account</h3>
              <p className="mt-0.5 text-xs text-slate-500">{currentRole === 'admin' ? 'Assign an approved role and department.' : `Clinical staff in ${currentUser.department}.`}</p>
            </div>
            <button type="button" onClick={() => setIsAddFormOpen(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close add staff form">
              <X className="h-4 w-4" />
            </button>
          </div>

          {formError && (
            <p role="alert" className="mb-3 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
            </p>
          )}

          <form onSubmit={handleAddStaff} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-slate-700">
              Full name
              <input required value={newName} onChange={(event) => setNewName(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Email
              <input required type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Phone
              <input required type="tel" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Role
              <select required value={newRole} onChange={(event) => setNewRole(event.target.value as UserRole)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                {(currentRole === 'admin' ? ['admin', 'doctor', 'nurse', 'physiotherapist', 'receptionist', 'pharmacist', 'lab', 'radiology', 'medical-coder'] as UserRole[] : doctorManagedRoles).map((role) => (
                  <option key={role} value={role}>{role.replace('-', ' ')}</option>
                ))}
              </select>
            </label>
            {currentRole === 'admin' ? (
              <label className="text-xs font-semibold text-slate-700">
                Department
                <input required value={newDepartment} onChange={(event) => setNewDepartment(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
              </label>
            ) : (
              <div className="text-xs font-semibold text-slate-700">
                Department
                <p className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-normal text-slate-600">{currentUser.department}</p>
              </div>
            )}
            <label className="text-xs font-semibold text-slate-700">
              Shift
              <select value={newShift} onChange={(event) => setNewShift(event.target.value as StaffMember['shift'])} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                {(['Morning (07:00 - 15:00)', 'Evening (15:00 - 23:00)', 'Night (23:00 - 07:00)', 'On-Call'] as const).map((shift) => <option key={shift} value={shift}>{shift}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Station / room
              <input required value={newRoom} onChange={(event) => setNewRoom(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              License / credential ID
              <input value={newLicense} onChange={(event) => setNewLicense(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="Pending verification if omitted" />
            </label>
            <p className="text-[11px] text-amber-800 sm:col-span-2 lg:col-span-4">This prototype creates a staff directory account only; secure credential setup and identity verification are not connected.</p>
            <div className="flex justify-end sm:col-span-2 lg:col-span-4">
              <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-md bg-teal-800 px-4 text-xs font-bold text-white hover:bg-teal-900">
                <UserPlus className="h-4 w-4" /> Create staff record
              </button>
            </div>
          </form>
        </section>
      )}

      {currentRole === 'admin' && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Award className="h-4 w-4 text-teal-700" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Doctor packages</h3>
              <p className="mt-0.5 text-xs text-slate-500">Configure multiple packages per doctor and their coverage dates for existing-patient registration.</p>
            </div>
          </div>
          <form onSubmit={handleSaveDoctorPackage} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-slate-700">
              Doctor
              <select required value={packageDoctorId} onChange={(event) => setPackageDoctorId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                <option value="">Select doctor</option>
                {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{getDoctorDisplayName(doctor)} · {doctor.department}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Package name
              <input required value={packageName} onChange={(event) => setPackageName(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Package number
              <input required value={packageNumber} onChange={(event) => setPackageNumber(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Coverage (%)
              <input required type="number" min="0" max="100" step="1" value={packageCoverage} onChange={(event) => setPackageCoverage(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Base package price (AED)
              <input required type="number" min="0" step="0.01" value={packageBasePrice} onChange={(event) => setPackageBasePrice(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Valid from
              <input required type="date" value={packageValidFrom} onChange={(event) => setPackageValidFrom(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Valid until
              <input required type="date" min={packageValidFrom} value={packageValidUntil} onChange={(event) => setPackageValidUntil(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2 lg:col-span-4">
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-[220px] flex-1 text-xs font-semibold text-slate-700">
                  Included tariff service
                  <select value={selectedPackageTariffId} onChange={(event) => setSelectedPackageTariffId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                    <option value="">Select from locked price list</option>
                    {hospitalPriceCatalog.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name} · AED {item.standardPrice.toFixed(2)}</option>)}
                  </select>
                </label>
                <label className="w-28 text-xs font-semibold text-slate-700">
                  Included quota
                  <input type="number" min="1" step="1" value={selectedServiceQuota} onChange={(event) => setSelectedServiceQuota(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
                </label>
                <button type="button" onClick={addPackageTariffService} disabled={!selectedPackageTariffId} className="inline-flex h-9 items-center gap-1 rounded-md border border-teal-700 px-3 text-xs font-bold text-teal-800 hover:bg-teal-50 disabled:opacity-50">
                  <Plus className="h-3.5 w-3.5" /> Add service
                </button>
              </div>
              {packageServices.length ? (
                <div className="mt-3 space-y-2">
                  {packageServices.map((service) => (
                    <div key={service.tariffItemId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <strong className="text-slate-800">{service.name}</strong>
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{service.cptCode || service.code}</span>
                        <span className="ml-2 text-slate-500">Locked AED {service.unitPrice.toFixed(2)} · quota {service.quota}</span>
                      </div>
                      <button type="button" onClick={() => setPackageServices((current) => current.filter((entry) => entry.tariffItemId !== service.tariffItemId))} aria-label={`Remove ${service.name}`} className="rounded p-1 text-rose-700 hover:bg-rose-50"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  <p className="text-right text-[11px] text-slate-600">
                    Tariff value AED {packageRetailValue.toFixed(2)} · Bundle savings <strong className={packageRetailValue > Number(packageBasePrice) ? 'text-emerald-700' : 'text-slate-700'}>AED {Math.max(0, packageRetailValue - (Number(packageBasePrice) || 0)).toFixed(2)}</strong>
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-slate-500">No services included yet. Add tariff services and their package quotas.</p>
              )}
            </div>
            {editingPackageId && (
              <label className="flex items-center gap-2 self-end pb-2 text-xs font-semibold text-slate-700">
                <input type="checkbox" checked={packageIsActive} onChange={(event) => setPackageIsActive(event.target.checked)} />
                Active
              </label>
            )}
            {packageFormError && <p role="alert" className="text-xs text-rose-700 sm:col-span-2 lg:col-span-4">{packageFormError}</p>}
            <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-4">
              {editingPackageId && <button type="button" onClick={handleCancelPackageEdit} className="rounded-md border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">Cancel edit</button>}
              <button type="submit" disabled={!packageDoctorId} className="rounded-md bg-teal-800 px-4 py-2 text-xs font-bold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50">
                {editingPackageId ? 'Save package changes' : 'Add package'}
              </button>
            </div>
          </form>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="border-b border-slate-200 text-[10px] uppercase text-slate-500">
                <tr><th className="px-2 py-2">Doctor / package</th><th className="px-2 py-2">Number</th><th className="px-2 py-2">Price / services</th><th className="px-2 py-2">Coverage</th><th className="px-2 py-2">Validity</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {doctorPackages.map((item) => {
                  const doctor = doctors.find((entry) => entry.id === item.doctorId);
                  return (
                    <tr key={item.id}>
                      <td className="px-2 py-2"><strong className="block text-slate-800">{doctor?.name || 'Unknown doctor'}</strong><span className="text-slate-500">{item.packageName}</span></td>
                      <td className="px-2 py-2 text-slate-700">{item.packageNumber}</td>
                      <td className="px-2 py-2 text-slate-700">AED {(item.basePrice || 0).toFixed(2)} <span className="text-slate-500">· {item.includedServices?.length || 0} services</span></td>
                      <td className="px-2 py-2 text-slate-700">{item.coveragePercent}%</td>
                      <td className="px-2 py-2 text-slate-700">{item.validFrom} – {item.validUntil}</td>
                      <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{item.isActive ? 'Active' : 'Inactive'}</span></td>
                      <td className="px-2 py-2">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleEditDoctorPackage(item.id)} className="font-semibold text-teal-800 hover:underline">Edit</button>
                          {item.isActive && <button type="button" onClick={() => deactivateDoctorPackage(item.id)} className="font-semibold text-rose-700 hover:underline">Deactivate</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {doctorPackages.length === 0 && <tr><td colSpan={7} className="px-2 py-5 text-center text-slate-500">No doctor packages configured.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {currentRole === 'admin' && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Award className="h-4 w-4 text-teal-700" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Doctor scheduling details</h3>
              <p className="mt-0.5 text-xs text-slate-500">Edit the doctor name, department, nationality, language, and degree shown in scheduling.</p>
            </div>
          </div>
          <form onSubmit={handleSaveDoctorProfile} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-semibold text-slate-700">
              Doctor
              <select required value={editingDoctorId} onChange={(event) => handleDoctorSelection(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>{getDoctorDisplayName(doctor)} · {doctor.department}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Doctor name
              <input required value={doctorName} onChange={(event) => setDoctorName(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Department
              <input required value={doctorDepartment} onChange={(event) => setDoctorDepartment(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Nationality
              <input value={doctorNationality} onChange={(event) => setDoctorNationality(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Language
              <input value={doctorLanguage} onChange={(event) => setDoctorLanguage(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Degree
              <input value={doctorDegree} onChange={(event) => setDoctorDegree(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" placeholder="e.g. MBBS, MD" />
            </label>
            {doctorFormError && <p role="alert" className="text-xs text-rose-700 lg:col-span-3">{doctorFormError}</p>}
            <div className="flex justify-end sm:col-span-2 lg:col-span-3">
              <button type="submit" disabled={!editingDoctorId} className="inline-flex h-9 items-center gap-2 rounded-md bg-teal-800 px-4 text-xs font-bold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" /> Save doctor details
              </button>
            </div>
          </form>
        </section>
      )}

      {currentRole === 'admin' && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-teal-700" />
              <h3 className="text-sm font-bold text-slate-900">Doctor Duty Rota Requests</h3>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              {pendingDutyRequests.length} pending
            </span>
          </div>
          {pendingDutyRequests.length === 0 ? (
            <p className="py-3 text-xs text-slate-500">No duty rota changes are waiting for approval.</p>
          ) : (
            <div className="space-y-3">
              {pendingDutyRequests.map((request) => (
                <article key={request.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 text-xs">
                      <h4 className="font-bold text-slate-900">{request.doctorName}</h4>
                      <p className="mt-1 text-slate-600">
                        Current: {request.currentDays.join(', ')} · {request.currentHours}
                      </p>
                      <p className="mt-0.5 font-semibold text-teal-800">
                        Requested: {request.requestedDays.join(', ')} · {request.requestedHours}
                      </p>
                      <p className="mt-1 text-slate-700">Reason: {request.reason}</p>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Submitted by {request.requesterUserName} · {new Date(request.requestedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => reviewDoctorDutyChangeRequest(request.id, 'Rejected')}
                        className="flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewDoctorDutyChangeRequest(request.id, 'Approved')}
                        className="flex items-center gap-1 rounded-md bg-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search staff name, department, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Staff' },
            { id: 'doctor', label: 'Physicians' },
            { id: 'nurse', label: 'Nursing Staff' },
            { id: 'admin', label: 'Administration' },
            { id: 'receptionist', label: 'Admissions' },
            { id: 'medical-coder', label: 'Medical Coders' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRoleFilter(tab.id)}
              className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
                roleFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={showInactive}
          onClick={() => setShowInactive((shown) => !shown)}
          className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${showInactive ? 'bg-slate-700 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          {showInactive ? 'Showing all accounts' : `Include deactivated (${staff.filter((member) => member.isActive === false).length})`}
        </button>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStaff.map((person) => (
          <div
            key={person.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                    {person.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-900">{person.name}</h3>
                    <p className="text-[11px] text-slate-500 capitalize font-medium">
                      {person.role} · {person.department}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                  {person.id}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate text-[11px]">{person.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono text-[11px]">{person.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[11px]">Shift: {person.shift}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px]">
              <span className={`flex items-center gap-1 font-semibold ${person.isActive === false ? 'text-slate-500' : person.status === 'Off Duty' ? 'text-amber-700' : 'text-emerald-700'}`}>
                {person.isActive === false ? <UserX className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {person.isActive === false ? 'Deactivated' : person.status}
              </span>
              <span className="truncate text-right font-mono text-[10px] text-slate-400">
                Credential: {person.licenseNumber || 'Not recorded'}
              </span>
            </div>
            {canManageMember(person) && person.isActive !== false && (
              <button
                type="button"
                onClick={() => setStaffToDeactivate(person)}
                className="mt-3 inline-flex min-h-8 items-center gap-1.5 self-end rounded-md border border-rose-200 px-2.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
              >
                <UserX className="h-3.5 w-3.5" /> Deactivate account
              </button>
            )}
          </div>
        ))}
      </div>
      {staffToDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section role="alertdialog" aria-modal="true" aria-labelledby="deactivate-staff-title" className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-700"><UserX className="h-4 w-4" /></span>
              <div>
                <h3 id="deactivate-staff-title" className="text-sm font-bold text-slate-900">Deactivate staff account?</h3>
                <p className="mt-1 text-xs text-slate-600">{staffToDeactivate.name} will no longer be able to sign in. Their staff record and audit history will be retained.</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setStaffToDeactivate(null)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={() => { deactivateStaff(staffToDeactivate.id); setStaffToDeactivate(null); }} className="rounded-md bg-rose-700 px-3 py-2 text-xs font-bold text-white hover:bg-rose-800">Deactivate</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
