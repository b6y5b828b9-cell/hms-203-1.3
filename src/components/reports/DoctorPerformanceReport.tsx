import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Building2,
  CalendarRange,
  Stethoscope,
  UserX,
  Users,
} from 'lucide-react';
import { useHospital } from '../../context/HospitalContext';

export type DoctorReportMode = 'daily' | 'monthly' | 'yearly';

const formatDateKey = (value?: string) => value?.slice(0, 10) ?? '';

const matchesPeriod = (dateValue: string | undefined, mode: DoctorReportMode) => {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();

  if (mode === 'daily') {
    return date.toDateString() === now.toDateString();
  }

  if (mode === 'monthly') {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }

  return date.getFullYear() === now.getFullYear();
};

const toPeriodLabel = (mode: DoctorReportMode) => {
  if (mode === 'daily') return 'Today';
  if (mode === 'monthly') return 'This Month';
  return 'This Year';
};

const getMonthKey = (dateValue?: string) => {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getYearKey = (dateValue?: string) => {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}`;
};

export const DoctorPerformanceReport: React.FC = () => {
  const { appointments, doctors, receptionTokens, currentRole } = useHospital();
  const [viewMode, setViewMode] = useState<DoctorReportMode>('monthly');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All Departments');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('All Doctors');

  const departmentOptions = useMemo(
    () => ['All Departments', ...Array.from(new Set([...doctors.map((d) => d.department), ...appointments.map((a) => a.department)]))],
    [doctors, appointments]
  );

  const doctorOptions = useMemo(
    () => [{ id: 'All Doctors', name: 'All Doctors' }, ...doctors.map((d) => ({ id: d.id, name: d.name }))],
    [doctors]
  );

  const filterAppointment = (appointment: typeof appointments[number]) => {
    if (selectedDepartment !== 'All Departments' && appointment.department !== selectedDepartment) return false;
    if (selectedDoctorId !== 'All Doctors' && appointment.doctorId !== selectedDoctorId) return false;
    return matchesPeriod(appointment.date, viewMode);
  };

  const filterToken = (token: typeof receptionTokens[number]) => {
    const tokenDate = token.createdDate ?? formatDateKey(token.completedAt ?? token.calledAt ?? undefined);
    if (selectedDepartment !== 'All Departments' && token.department !== selectedDepartment) return false;
    if (selectedDoctorId !== 'All Doctors' && token.doctorId !== selectedDoctorId) return false;
    return matchesPeriod(tokenDate, viewMode);
  };

  const filteredAppointments = useMemo(
    () => appointments.filter(filterAppointment),
    [appointments, selectedDepartment, selectedDoctorId, viewMode]
  );

  const filteredTokens = useMemo(
    () => receptionTokens.filter(filterToken),
    [receptionTokens, selectedDepartment, selectedDoctorId, viewMode]
  );

  const totalPatientsSeen = filteredAppointments.length;
  const cancelledAppointments = filteredAppointments.filter(
    (appointment) => appointment.status === 'Cancelled' || appointment.status === 'No-Show'
  ).length;
  const walkInPatients = filteredTokens.filter((token) => token.status !== 'Cancelled').length;

  const departmentSummary = useMemo(() => {
    const groups = new Map<string, { total: number; cancelled: number; walkIn: number }>();

    for (const dept of departmentOptions.filter((item) => item !== 'All Departments')) {
      groups.set(dept, { total: 0, cancelled: 0, walkIn: 0 });
    }

    for (const appointment of filteredAppointments) {
      const dept = appointment.department || 'Unassigned';
      const entry = groups.get(dept) ?? { total: 0, cancelled: 0, walkIn: 0 };
      entry.total += 1;
      if (appointment.status === 'Cancelled' || appointment.status === 'No-Show') {
        entry.cancelled += 1;
      }
      groups.set(dept, entry);
    }

    for (const token of filteredTokens) {
      const dept = token.department || 'Unassigned';
      const entry = groups.get(dept) ?? { total: 0, cancelled: 0, walkIn: 0 };
      if (token.status !== 'Cancelled') {
        entry.walkIn += 1;
      }
      groups.set(dept, entry);
    }

    return Array.from(groups.entries())
      .map(([department, values]) => ({
        department,
        total: values.total + values.walkIn,
        cancelled: values.cancelled,
        walkIn: values.walkIn,
      }))
      .filter((row) => row.total > 0 || row.cancelled > 0 || row.walkIn > 0)
      .sort((a, b) => b.total - a.total);
  }, [departmentOptions, filteredAppointments, filteredTokens]);

  const doctorSummary = useMemo(() => {
    const groups = new Map<string, { name: string; department: string; total: number; cancelled: number; walkIn: number }>();

    for (const doctor of doctors) {
      groups.set(doctor.id, { name: doctor.name, department: doctor.department, total: 0, cancelled: 0, walkIn: 0 });
    }

    for (const appointment of filteredAppointments) {
      const doctor = groups.get(appointment.doctorId) ?? {
        name: appointment.doctorName,
        department: appointment.department,
        total: 0,
        cancelled: 0,
        walkIn: 0,
      };
      doctor.total += 1;
      if (appointment.status === 'Cancelled' || appointment.status === 'No-Show') {
        doctor.cancelled += 1;
      }
      groups.set(appointment.doctorId, doctor);
    }

    for (const token of filteredTokens) {
      const doctorId = token.doctorId ?? '';
      const doctor = groups.get(doctorId) ?? {
        name: token.doctorName ?? 'Unassigned Doctor',
        department: token.department,
        total: 0,
        cancelled: 0,
        walkIn: 0,
      };
      doctor.walkIn += 1;
      doctor.total += 1;
      groups.set(doctorId || `${token.department}-unassigned`, doctor);
    }

    return Array.from(groups.values())
      .map((entry) => ({
        ...entry,
        total: entry.total,
      }))
      .filter((row) => row.total > 0 || row.cancelled > 0 || row.walkIn > 0)
      .sort((a, b) => b.total - a.total);
  }, [doctors, filteredAppointments, filteredTokens]);

  const trendBreakdown = useMemo(() => {
    const buckets = new Map<string, { label: string; total: number; cancelled: number; walkIn: number }>();

    const push = (dateValue: string, appointment: typeof filteredAppointments[number], tokenCount = 0) => {
      const key = viewMode === 'yearly' ? getYearKey(dateValue) : getMonthKey(dateValue);
      const label = viewMode === 'yearly' ? `FY ${key}` : new Date(`${dateValue}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const entry = buckets.get(key) ?? { label, total: 0, cancelled: 0, walkIn: 0 };
      entry.total += 1 + tokenCount;
      if (appointment.status === 'Cancelled' || appointment.status === 'No-Show') entry.cancelled += 1;
      entry.walkIn += tokenCount;
      buckets.set(key, entry);
    };

    for (const appointment of filteredAppointments) {
      push(appointment.date, appointment, 0);
    }

    for (const token of filteredTokens) {
      const tokenDate = token.createdDate ?? formatDateKey(token.completedAt ?? token.calledAt ?? undefined);
      if (!tokenDate) continue;
      const key = viewMode === 'yearly' ? getYearKey(tokenDate) : getMonthKey(tokenDate);
      const label = viewMode === 'yearly' ? `FY ${key}` : new Date(`${tokenDate}T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const bucket = buckets.get(key) ?? { label, total: 0, cancelled: 0, walkIn: 0 };
      bucket.total += 1;
      bucket.walkIn += 1;
      buckets.set(key, bucket);
    }

    return Array.from(buckets.values()).sort((a, b) => a.label.localeCompare(b.label)).slice(0, 6);
  }, [filteredAppointments, filteredTokens, viewMode]);

  return (
    <div className="space-y-5 text-xs">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-800 font-bold uppercase tracking-wide text-[11px]">
            <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
            Doctor Performance Report
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {currentRole === 'receptionist'
              ? 'Patient consultation volume, cancellation rate, and walk-in traffic by department and doctor.'
              : 'Operational overview of patient consultations by department and doctor with walk-in and cancellation analytics.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['daily', 'monthly', 'yearly'] as DoctorReportMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                viewMode === mode
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {mode === 'daily' ? 'Daily' : mode === 'monthly' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Patients</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{totalPatientsSeen}</div>
          <div className="text-[11px] text-slate-500 mt-1">{toPeriodLabel(viewMode)} patient count</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cancelled</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{cancelledAppointments}</div>
          <div className="text-[11px] text-slate-500 mt-1">Cancelled / No-show visits</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Walk-ins</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{walkInPatients}</div>
          <div className="text-[11px] text-slate-500 mt-1">Direct registration visits</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Departments</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{departmentSummary.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Active departments on report</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 font-bold text-slate-800 text-[11px] uppercase tracking-wide">
            <CalendarRange className="w-3.5 h-3.5 text-indigo-600" />
            Report Filters
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-700 outline-none"
            >
              {departmentOptions.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>

            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-700 outline-none"
            >
              {doctorOptions.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 font-bold text-slate-700 text-[11px] uppercase tracking-wide">
              Department wise report
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2 text-right">Patients</th>
                    <th className="px-3 py-2 text-right">Cancelled</th>
                    <th className="px-3 py-2 text-right">Walk-ins</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentSummary.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                        No patient activity found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    departmentSummary.map((row) => (
                      <tr key={row.department} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 font-semibold text-slate-700">{row.department}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-900">{row.total}</td>
                        <td className="px-3 py-2 text-right font-mono text-rose-600">{row.cancelled}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-600">{row.walkIn}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 font-bold text-slate-700 text-[11px] uppercase tracking-wide">
              Doctor wise report
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Doctor</th>
                    <th className="px-3 py-2 text-right">Patients</th>
                    <th className="px-3 py-2 text-right">Cancelled</th>
                    <th className="px-3 py-2 text-right">Walk-ins</th>
                  </tr>
                </thead>
                <tbody>
                  {doctorSummary.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                        No doctor activity found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    doctorSummary.map((row) => (
                      <tr key={row.name} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-700">{row.name}</div>
                          <div className="text-[10px] text-slate-500">{row.department}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-900">{row.total}</td>
                        <td className="px-3 py-2 text-right font-mono text-rose-600">{row.cancelled}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-600">{row.walkIn}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-slate-800 text-[11px] uppercase tracking-wide mb-4">
          <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600" />
          {viewMode === 'daily' ? 'Daily activity summary' : viewMode === 'monthly' ? 'Monthly performance overview' : 'Yearly performance overview'}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {trendBreakdown.map((entry) => (
            <div key={entry.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{entry.label}</div>
              <div className="mt-2 text-lg font-black text-slate-900">{entry.total}</div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600">
                <span>Cancelled</span>
                <span className="font-mono text-rose-600">{entry.cancelled}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600">
                <span>Walk-ins</span>
                <span className="font-mono text-emerald-600">{entry.walkIn}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
