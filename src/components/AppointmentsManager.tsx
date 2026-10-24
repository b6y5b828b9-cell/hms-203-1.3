import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PhoneCall,
  User,
  Stethoscope,
  Video,
  CalendarDays,
  Ban,
  Copy,
  ClipboardPaste,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { Appointment } from '../types';
import { getDoctorDutyWindow, getDutyAppointmentSlots } from '../utils/doctorDutySchedule';

interface AppointmentsManagerProps {
  onOpenNewAppointment: (preset?: { doctorId?: string; date?: string; timeSlot?: string }) => void;
  onSelectPatient: (id: string) => void;
  onStartTelehealth?: (patientId: string, doctorName?: string) => void;
}

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AppointmentsManager: React.FC<AppointmentsManagerProps> = ({
  onOpenNewAppointment,
  onSelectPatient,
  onStartTelehealth,
}) => {
  const CANCELLATION_REASONS = [
    'Patient request',
    'Doctor unavailable',
    'Rescheduled',
    'Duplicate booking',
    'Insurance or authorization issue',
    'Other',
  ];
  const {
    appointments,
    doctors,
    doctorDutySchedules,
    updateAppointmentStatus,
    addAppointment,
    addNotification,
    logAuditEvent,
    setActiveTab,
  } = useHospital();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [viewType, setViewType] = useState<'appointments' | 'doctor-slots'>('doctor-slots');
  const [slotDepartment, setSlotDepartment] = useState(doctors[0]?.department || '');
  const [slotDoctorId, setSlotDoctorId] = useState(doctors[0]?.id || '');
  const [slotDate, setSlotDate] = useState(() => formatLocalDate(new Date()));
  const [blockedSlots, setBlockedSlots] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('medcore_blocked_duty_slots_v1') || '[]');
    } catch {
      return [];
    }
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slot: string } | null>(null);
  const [copiedAppointment, setCopiedAppointment] = useState<Appointment | null>(null);
  const [cancellationTarget, setCancellationTarget] = useState<Appointment | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationDetails, setCancellationDetails] = useState('');
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('medcore_blocked_duty_slots_v1', JSON.stringify(blockedSlots));
  }, [blockedSlots]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeMenu = (event: PointerEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) setContextMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  const departmentOptions = Array.from(new Set(appointments.map((appointment) => appointment.department))).sort();
  const doctorDepartmentOptions = Array.from(new Set(doctors.map((doctor) => doctor.department))).sort();
  const doctorsForSlots = doctors.filter((doctor) => doctor.department === slotDepartment);
  const slotDoctor = doctorsForSlots.find((doctor) => doctor.id === slotDoctorId) || doctorsForSlots[0];
  const slotDutyWindow = slotDoctor
    ? getDoctorDutyWindow(slotDoctor, doctorDutySchedules, slotDate)
    : { isOnDuty: false, startTime: '', endTime: '' };
  const doctorSlots = getDutyAppointmentSlots(slotDutyWindow);
  const bookedSlotTimes = appointments
    .filter((appointment) => appointment.doctorId === slotDoctor?.id && appointment.date === slotDate && ['Scheduled', 'Checked-In', 'In Consultation'].includes(appointment.status))
    .map((appointment) => appointment.timeSlot);
  const getSlotKey = (slot: string) => `${slotDoctor?.id || ''}|${slotDate}|${slot}`;
  const isSlotBreak = (slot: string) => blockedSlots.includes(`${getSlotKey(slot)}|break`);
  const isSlotBlocked = (slot: string) => blockedSlots.includes(getSlotKey(slot)) || isSlotBreak(slot);
  const openSlotCount = doctorSlots.filter(
    (slot) => !bookedSlotTimes.includes(slot) && !isSlotBlocked(slot)
  ).length;
  const getSlotAppointment = (slot: string) => appointments.find(
    (appointment) => appointment.doctorId === slotDoctor?.id && appointment.date === slotDate && appointment.timeSlot === slot && ['Scheduled', 'Checked-In', 'In Consultation'].includes(appointment.status)
  );
  const slotDates = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() + index);
    const value = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    return {
      value,
      label: index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : day.toLocaleDateString('en-US', { weekday: 'short' }),
      sublabel: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };
  });

  const filteredAppointments = appointments.filter((a) => {
    const matchesSearch =
      a.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || a.status.toLowerCase() === statusFilter.toLowerCase();

    const matchesDate = !dateFilter || a.date === dateFilter;

    const matchesDepartment =
      selectedDepartment === 'all' || a.department === selectedDepartment;

    return matchesSearch && matchesStatus && matchesDate && matchesDepartment;
  });

  const handleStatusChange = (id: string, newStatus: any, patientName: string) => {
    updateAppointmentStatus(id, newStatus);
    addNotification(
      `Appointment Updated`,
      `${patientName}'s status changed to ${newStatus}.`,
      'info',
      id
    );
  };

  const requestCancellation = (appointment: Appointment) => {
    setCancellationTarget(appointment);
    setCancellationReason('');
    setCancellationDetails('');
    setContextMenu(null);
  };

  const confirmCancellation = (event: React.FormEvent) => {
    event.preventDefault();
    if (!cancellationTarget || !cancellationReason) return;
    if (cancellationReason === 'Other' && !cancellationDetails.trim()) return;
    const details = cancellationReason === 'Other' ? cancellationDetails.trim() : undefined;
    updateAppointmentStatus(cancellationTarget.id, 'Cancelled', { reason: cancellationReason, details });
    addNotification(
      'Appointment Cancelled',
      `${cancellationTarget.patientName}'s appointment was cancelled. Reason: ${cancellationReason}${details ? ` · ${details}` : ''}`,
      'warning',
      cancellationTarget.id
    );
    setCancellationTarget(null);
  };

  const openSlotContextMenu = (event: React.MouseEvent, slot: string) => {
    event.preventDefault();
    const menuWidth = 220;
    const menuHeight = 280;
    setContextMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
      slot,
    });
  };

  const toggleSlotBlocked = (slot: string) => {
    const key = getSlotKey(slot);
    const wasBlocked = blockedSlots.includes(key);
    setBlockedSlots((previous) => wasBlocked ? previous.filter((item) => item !== key) : [...previous, key]);
    logAuditEvent('UPDATE', 'Appointment', key, `${wasBlocked ? 'Unblocked' : 'Blocked'} ${slotDoctor?.name || 'doctor'} slot ${slot} on ${slotDate}.`);
    setContextMenu(null);
  };

  const pasteCopiedAppointment = (slot: string) => {
    if (!copiedAppointment || !slotDoctor) return;
    addAppointment({
      patientId: copiedAppointment.patientId,
      patientName: copiedAppointment.patientName,
      patientAge: copiedAppointment.patientAge,
      patientGender: copiedAppointment.patientGender,
      doctorId: slotDoctor.id,
      doctorName: slotDoctor.name,
      department: slotDoctor.department,
      roomNumber: slotDoctor.roomNumber,
      date: slotDate,
      timeSlot: slot,
      type: copiedAppointment.isTelehealth ? 'General Consultation' : copiedAppointment.type,
      status: 'Scheduled',
      priority: copiedAppointment.priority,
      reason: copiedAppointment.reason,
      notes: copiedAppointment.notes,
      isTelehealth: false,
    });
    setContextMenu(null);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700 mb-1">
                Hospital Management System (2)
              </div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Clinical Appointment & Consultation Scheduling
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Real-time outpatient check-in queue, clinician bookings, and waiting room turnover tracking.
          </p>
        </div>

      </div>

      {/* Filter and Search Bar */}
      {viewType === 'appointments' && <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search patient, doctor, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 flex-wrap justify-end">
          <div className="flex items-center gap-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'scheduled', label: 'Scheduled' },
              { id: 'checked-in', label: 'Checked-In' },
              { id: 'in consultation', label: 'In Clinic' },
              { id: 'completed', label: 'Completed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg py-1 px-2 text-xs font-medium text-slate-700"
            title="Filter by department"
          >
            <option value="all">All Departments</option>
            {departmentOptions.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg py-1 px-2 text-xs font-mono text-slate-700"
            title="Filter by consultation date"
          />
        </div>
      </div>}

      {/* Appointments Data Table */}
      {viewType === 'appointments' && <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Appointments Schedule ({filteredAppointments.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Synchronized with Clinic Ward Roster
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-2.5 px-3">Slot / Wait</th>
                <th className="py-2.5 px-3">Patient</th>
                <th className="py-2.5 px-3">Attending Physician</th>
                <th className="py-2.5 px-3">Chief Complaint</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No scheduled appointments matching current filters.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                      <div className="font-bold text-slate-800">{appt.timeSlot}</div>
                      <div className="text-[10px] text-slate-400">{appt.date}</div>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <button
                        onClick={() => {
                          onSelectPatient(appt.patientId);
                          setActiveTab('patients');
                        }}
                        className="text-left group cursor-pointer"
                      >
                        <span className="font-semibold text-slate-900 group-hover:text-blue-600 block">
                          {appt.patientName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {appt.patientId} · {appt.patientAge}y {appt.patientGender}
                        </span>
                      </button>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                      <div className="font-semibold">{appt.doctorName}</div>
                      <div className="text-[10px] text-slate-400">{appt.department}</div>
                    </td>

                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                      {appt.chiefComplaint}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          appt.priority === 'Emergency'
                            ? 'bg-rose-100 text-rose-700'
                            : appt.priority === 'Urgent'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {appt.priority}
                      </span>
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
                              : appt.status === 'Completed'
                              ? 'bg-slate-400'
                              : 'bg-amber-600'
                          }`}
                        />
                        {appt.status}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap text-right space-x-1">
                      {(appt.isTelehealth || appt.type === 'Telehealth Consultation') && (
                        <button
                          onClick={() => onStartTelehealth?.(appt.patientId, appt.doctorName)}
                          className="px-2 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Video className="w-3 h-3" /> Video
                        </button>
                      )}
                      {appt.status === 'Scheduled' && (
                        <button
                          onClick={() => handleStatusChange(appt.id, 'Checked-In', appt.patientName)}
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-semibold text-[11px] cursor-pointer"
                        >
                          Check In
                        </button>
                      )}
                      {appt.status === 'Checked-In' && (
                        <button
                          onClick={() => handleStatusChange(appt.id, 'In Consultation', appt.patientName)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <PhoneCall className="w-3 h-3" /> Call In
                        </button>
                      )}
                      {appt.status === 'In Consultation' && (
                        <button
                          onClick={() => handleStatusChange(appt.id, 'Completed', appt.patientName)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold text-[11px] cursor-pointer"
                        >
                          Mark Done
                        </button>
                      )}
                      {appt.status !== 'Completed' && appt.status !== 'Cancelled' && (
                        <button
                          onClick={() => requestCancellation(appt)}
                          className="px-2 py-1 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-700 rounded font-semibold text-[11px] cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>}

      {viewType === 'doctor-slots' && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50/70 p-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-teal-800" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Book by department and doctor</h3>
                <p className="text-[11px] text-slate-500">Choose a department, doctor, and day to view appointment slots.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:w-[32rem]">
              <label className="text-[10px] font-semibold text-slate-600">
                Department
                <select aria-label="Filter doctors by department" value={slotDepartment} onChange={(event) => {
                  const department = event.target.value;
                  setSlotDepartment(department);
                  const firstDoctor = doctors.find((doctor) => doctor.department === department);
                  if (firstDoctor) setSlotDoctorId(firstDoctor.id);
                }} className="mt-1 block min-w-0 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800">
                  {doctorDepartmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
                </select>
              </label>
              <label className="text-[10px] font-semibold text-slate-600">
                Doctor
                <select aria-label="Choose doctor" value={slotDoctor?.id || ''} onChange={(event) => setSlotDoctorId(event.target.value)} disabled={doctorsForSlots.length === 0} className="mt-1 block min-w-0 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 disabled:bg-slate-100">
                  {doctorsForSlots.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name} · {doctor.specialty}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {slotDates.map((day) => (
                  <button key={day.value} type="button" aria-pressed={slotDate === day.value} onClick={() => setSlotDate(day.value)} className={`min-w-16 rounded-md border px-2.5 py-1.5 text-center text-[10px] font-bold ${slotDate === day.value ? 'border-teal-800 bg-teal-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                    <span className="block">{day.label}</span><span className="text-[9px] font-normal opacity-80">{day.sublabel}</span>
                  </button>
                ))}
              </div>
              <label className="text-[10px] font-semibold text-slate-600">
                Choose date
                <input type="date" min={formatLocalDate(new Date())} value={slotDate} onChange={(event) => setSlotDate(event.target.value)} className="ml-1.5 rounded-md border border-slate-300 px-2 py-1.5 text-xs" />
              </label>
            </div>

            {slotDoctor ? (
              <>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{slotDoctor.name}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{slotDoctor.specialty} · {slotDoctor.department}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-slate-500">Available hours</p>
                    <p className={`mt-0.5 text-xs font-semibold ${slotDutyWindow.isOnDuty ? 'text-emerald-800' : 'text-rose-700'}`}>
                      {slotDutyWindow.isOnDuty ? `${slotDutyWindow.startTime}–${slotDutyWindow.endTime}` : 'Off duty'}
                    </p>
                  </div>
                </div>
                {doctorSlots.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-xs text-amber-900">No duty is scheduled for this doctor on {slotDate}.</p>
                ) : (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-800">Appointment time slots</h4>
                      <span className="text-[10px] text-slate-500">{openSlotCount} available for booking</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                      {doctorSlots.map((slot) => {
                        const booked = bookedSlotTimes.includes(slot);
                        const blocked = isSlotBlocked(slot);
                        return (
                          <div key={slot} className="relative" onContextMenu={(event) => openSlotContextMenu(event, slot)}>
                            <button type="button" aria-disabled={booked || blocked} onClick={() => { if (!booked && !blocked) onOpenNewAppointment({ doctorId: slotDoctor.id, date: slotDate, timeSlot: slot }); }} className={`min-h-10 w-full rounded-md border px-2 py-2 text-xs font-semibold transition ${booked || blocked ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-100'}`}>
                              {booked ? `${slot} · Booked` : isSlotBreak(slot) ? `${slot} · Break` : blocked ? `${slot} · Off duty` : slot}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">No doctors are available for this department.</p>
            )}
          </div>
        </section>
      )}

      {contextMenu && slotDoctor && (() => {
        const appointment = getSlotAppointment(contextMenu.slot);
        const blocked = isSlotBlocked(contextMenu.slot);
        const slotIsBookable = !appointment && !blocked;
        const menuActionClass = 'flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';
        return (
          <div ref={contextMenuRef} role="menu" aria-label={`${contextMenu.slot} appointment slot actions`} style={{ left: contextMenu.x, top: contextMenu.y }} onContextMenu={(event) => event.preventDefault()} className="fixed z-50 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="text-xs font-bold text-slate-900">{contextMenu.slot}</p>
              <p className="truncate text-[10px] text-slate-500">{slotDoctor.name} · {slotDate}</p>
            </div>
            <button role="menuitem" type="button" disabled={!slotIsBookable} onClick={() => { onOpenNewAppointment({ doctorId: slotDoctor.id, date: slotDate, timeSlot: contextMenu.slot }); setContextMenu(null); }} className={menuActionClass}>
              <Plus className="h-3.5 w-3.5 text-teal-700" /> Book
            </button>
            <button role="menuitem" type="button" disabled={!appointment} onClick={() => appointment && requestCancellation(appointment)} className={`${menuActionClass} text-rose-700`}>
              <XCircle className="h-3.5 w-3.5" /> Cancel
            </button>
            <button role="menuitem" type="button" disabled={!appointment} onClick={() => { if (appointment) setCopiedAppointment(appointment); setContextMenu(null); }} className={menuActionClass}>
              <Copy className="h-3.5 w-3.5 text-blue-700" /> Copy
            </button>
            <button role="menuitem" type="button" disabled={!copiedAppointment || !slotIsBookable} onClick={() => pasteCopiedAppointment(contextMenu.slot)} className={menuActionClass}>
              <ClipboardPaste className="h-3.5 w-3.5 text-blue-700" /> Paste
            </button>
            <button role="menuitem" type="button" disabled={Boolean(appointment)} onClick={() => {
              const key = getSlotKey(contextMenu.slot);
              const wasBlocked = isSlotBlocked(contextMenu.slot);
              setBlockedSlots((previous) => wasBlocked
                ? previous.filter((item) => item !== key && item !== `${key}|break`)
                : [...previous, key]);
              logAuditEvent('UPDATE', 'Appointment', key, `${wasBlocked ? 'Opened' : 'Marked off duty'} ${slotDoctor.name} slot ${contextMenu.slot} on ${slotDate}.`);
              setContextMenu(null);
            }} className={menuActionClass}>
              <Ban className="h-3.5 w-3.5 text-amber-700" /> {blocked ? 'Open slot' : 'Mark off duty'}
            </button>
          </div>
        );
      })()}

      {cancellationTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={confirmCancellation} className="w-full max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cancel appointment</h3>
              <p className="mt-1 text-xs text-slate-600">{cancellationTarget.patientName} · {cancellationTarget.doctorName} · {cancellationTarget.date} {cancellationTarget.timeSlot}</p>
            </div>
            <label className="block text-xs font-semibold text-slate-700">
              Cancellation reason
              <select required value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                <option value="">Select a reason</option>
                {CANCELLATION_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </label>
            {cancellationReason === 'Other' && (
              <label className="block text-xs font-semibold text-slate-700">
                Additional details
                <textarea required value={cancellationDetails} onChange={(event) => setCancellationDetails(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
              </label>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setCancellationTarget(null)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Keep appointment</button>
              <button type="submit" disabled={!cancellationReason || (cancellationReason === 'Other' && !cancellationDetails.trim())} className="rounded-md bg-rose-700 px-3 py-2 text-xs font-bold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50">Confirm cancellation</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
