import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ban, CalendarClock, Check, CheckCircle2, Clock, Copy, ShieldCheck, Stethoscope, Timer, ClipboardPaste } from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { Doctor, StaffMember } from '../types';
import { DoctorDutyWindow, getDoctorDutyWindow, getDutyAppointmentSlots } from '../utils/doctorDutySchedule';

type RosterPerson =
  | { key: string; id: string; name: string; department: string; group: string; source: 'doctor'; doctor: Doctor }
  | { key: string; id: string; name: string; department: string; group: string; source: 'staff'; member: StaffMember };

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const today = () => formatDate(new Date());

const getStaffShift = (member: StaffMember) => {
  const times = member.shift.match(/\((\d{2}:\d{2}) - (\d{2}:\d{2})\)/);
  return {
    isOnDuty: member.status !== 'Off Duty',
    startTime: times?.[1] || '09:00',
    endTime: times?.[2] || '17:00',
  };
};

const roleLabel = (role: StaffMember['role']) =>
  role === 'medical-coder' ? 'Medical Coder' : role === 'lab' ? 'Lab Staff' : role.charAt(0).toUpperCase() + role.slice(1);

export const DoctorDutyScheduleView: React.FC = () => {
  const {
    doctors,
    staff,
    doctorDutySchedules,
    staffDutySchedules,
    appointments,
    currentRole,
    setDoctorDutySchedule,
    setStaffDutySchedule,
    logAuditEvent,
  } = useHospital();
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedPersonKey, setSelectedPersonKey] = useState(doctors[0] ? `doctor:${doctors[0].id}` : '');
  const [selectedDate, setSelectedDate] = useState(today);
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [feedback, setFeedback] = useState('');
  const [blockedSlots, setBlockedSlots] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('medcore_blocked_duty_slots_v1');
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) && parsed.every((slot) => typeof slot === 'string') ? parsed : [];
    } catch {
      return [];
    }
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slot: string } | null>(null);
  const [dateContextMenu, setDateContextMenu] = useState<{ x: number; y: number; date: string } | null>(null);
  const [copiedDuty, setCopiedDuty] = useState<{ isOnDuty: boolean; startTime: string; endTime: string; intervalMinutes: number } | null>(null);
  const [showBlockRemark, setShowBlockRemark] = useState(false);
  const [blockRemark, setBlockRemark] = useState('');
  const [blockRemarkError, setBlockRemarkError] = useState('');
  const shiftTimingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('medcore_blocked_duty_slots_v1', JSON.stringify(blockedSlots));
  }, [blockedSlots]);

  useEffect(() => {
    if (!contextMenu && !dateContextMenu) return;
    const closeMenu = (event: PointerEvent) => {
      if (
        !(event.target instanceof Element) ||
        (!event.target.closest('[data-roster-slot-menu]') && !event.target.closest('[data-roster-date-menu]'))
      ) {
        setContextMenu(null);
        setDateContextMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
        setDateContextMenu(null);
      }
    };
    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu, dateContextMenu]);

  const rosterPeople = useMemo<RosterPerson[]>(() => {
    const doctorPeople: RosterPerson[] = doctors.map((doctor) => ({
      key: `doctor:${doctor.id}`,
      id: doctor.id,
      name: doctor.name,
      department: doctor.department,
      group: 'Doctor',
      source: 'doctor',
      doctor,
    }));
    const doctorNames = new Set(doctors.map((doctor) => doctor.name.trim().toLowerCase()));
    const staffPeople: RosterPerson[] = staff
      .filter((member) => member.isActive !== false)
      .filter((member) => member.role !== 'doctor' || !doctorNames.has(member.name.trim().toLowerCase()))
      .map((member) => ({
        key: `staff:${member.id}`,
        id: member.id,
        name: member.name,
        department: member.department,
        group: roleLabel(member.role),
        source: 'staff',
        member,
      }));
    return [...doctorPeople, ...staffPeople].sort((a, b) => a.name.localeCompare(b.name));
  }, [doctors, staff]);

  const departments = useMemo(
    () => [...new Set(rosterPeople.map((person) => person.department))].sort(),
    [rosterPeople]
  );
  const groups = useMemo(
    () => [...new Set(rosterPeople.map((person) => person.group))].sort(),
    [rosterPeople]
  );
  const filteredPeople = rosterPeople.filter(
    (person) =>
      (!selectedDepartment || person.department === selectedDepartment) &&
      (selectedGroup === 'all' || person.group === selectedGroup)
  );
  const selectedPerson =
    filteredPeople.find((person) => person.key === selectedPersonKey) || filteredPeople[0];
  const dateSchedule = selectedPerson
    ? selectedPerson.source === 'doctor'
      ? doctorDutySchedules.find((schedule) => schedule.doctorId === selectedPerson.id && schedule.date === selectedDate)
      : staffDutySchedules.find((schedule) => schedule.staffId === selectedPerson.id && schedule.date === selectedDate)
    : undefined;
  const inheritedDuty = selectedPerson
    ? selectedPerson.source === 'doctor'
      ? getDoctorDutyWindow(
          selectedPerson.doctor,
          doctorDutySchedules.filter((schedule) => schedule.date !== selectedDate),
          selectedDate
        )
      : getStaffShift(selectedPerson.member)
    : { isOnDuty: false, startTime: '', endTime: '' };
  const visibleDuty = dateSchedule || inheritedDuty;
  const getDutyForDate = (date: string): DoctorDutyWindow => {
    if (!selectedPerson) return { isOnDuty: false, startTime: '', endTime: '', intervalMinutes: 30 };
    if (selectedPerson.source === 'doctor') {
      return getDoctorDutyWindow(selectedPerson.doctor, doctorDutySchedules, date);
    }
    return staffDutySchedules.find(
      (schedule) => schedule.staffId === selectedPerson.id && schedule.date === date
    ) || getStaffShift(selectedPerson.member);
  };
  const slotWindow = currentRole === 'admin'
    ? { isOnDuty, startTime, endTime, intervalMinutes }
    : visibleDuty;
  const dutySlots = getDutyAppointmentSlots(slotWindow);
  const getSlotKey = (slot: string) => `${selectedPerson?.id || ''}|${selectedDate}|${slot}`;
  const isSlotBlocked = (slot: string) =>
    blockedSlots.includes(getSlotKey(slot)) || blockedSlots.includes(`${getSlotKey(slot)}|break`);
  const isSlotBreak = (slot: string) => blockedSlots.includes(`${getSlotKey(slot)}|break`);
  const isSlotBooked = (slot: string) => selectedPerson?.source === 'doctor' && appointments.some(
    (appointment) =>
      appointment.doctorId === selectedPerson.id &&
      appointment.date === selectedDate &&
      appointment.timeSlot === slot &&
      ['Scheduled', 'Checked-In', 'In Consultation'].includes(appointment.status)
  );

  const openSlotMenu = (event: React.MouseEvent, slot: string) => {
    event.preventDefault();
    setContextMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 220 - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 110 - 8)),
      slot,
    });
  };

  const setSlotAvailability = (slot: string, disposition: 'break' | 'open') => {
    if (!selectedPerson || currentRole !== 'admin') return;
    const key = getSlotKey(slot);
    if (disposition === 'break' && isSlotBooked(slot)) return;
    const breakKey = `${key}|break`;
    setBlockedSlots((previous) => {
      const withoutSlotState = previous.filter((item) => item !== key && item !== breakKey);
      return disposition === 'break' ? [...withoutSlotState, breakKey] : withoutSlotState;
    });
    logAuditEvent(
      'UPDATE',
      selectedPerson.source === 'doctor' ? 'Appointment' : 'Security Settings',
      key,
      `${disposition === 'break' ? 'Marked break' : 'Opened'} ${selectedPerson.name}'s ${slot} slot on ${selectedDate}.`
    );
    setFeedback(`${selectedPerson.name}'s ${slot} slot ${disposition === 'break' ? 'marked as a break' : 'opened'}.`);
    setContextMenu(null);
  };

  const availableSlotCount = dutySlots.filter(
    (slot) => !isSlotBlocked(slot) && !isSlotBooked(slot)
  ).length;

  const openDateMenu = (event: React.MouseEvent, date: string) => {
    event.preventDefault();
    if (date < today()) return;
    setDateContextMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 240 - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 300 - 8)),
      date,
    });
  };

  const handleDateMenuAction = (action: 'block' | 'open' | 'timing' | 'copy' | 'paste') => {
    if (!selectedPerson || !dateContextMenu) return;
    if (action !== 'block') setShowBlockRemark(false);
    const targetDate = dateContextMenu.date;
    const targetDuty = getDutyForDate(targetDate);
    const defaultDuty: DoctorDutyWindow = selectedPerson.source === 'doctor'
      ? getDoctorDutyWindow(
          selectedPerson.doctor,
          doctorDutySchedules.filter((schedule) => schedule.date !== targetDate),
          targetDate
        )
      : getStaffShift(selectedPerson.member);

    if (action === 'timing') {
      setSelectedDate(targetDate);
      const timingDuty = targetDuty.isOnDuty ? targetDuty : defaultDuty;
      setIsOnDuty(true);
      setStartTime(timingDuty.startTime || startTime || '09:00');
      setEndTime(timingDuty.endTime || endTime || '17:00');
      setIntervalMinutes(timingDuty.intervalMinutes || intervalMinutes);
      setDateContextMenu(null);
      window.requestAnimationFrame(() => {
        shiftTimingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        shiftTimingRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>('input[type="time"], select')?.focus();
      });
      return;
    }

    if (action === 'block') {
      setBlockRemark('');
      setBlockRemarkError('');
      setShowBlockRemark(true);
      return;
    }

    if (action === 'copy') {
      setCopiedDuty({
        isOnDuty: targetDuty.isOnDuty,
        startTime: targetDuty.startTime || '09:00',
        endTime: targetDuty.endTime || '17:00',
        intervalMinutes: targetDuty.intervalMinutes || 30,
      });
      setFeedback(`Duty settings copied from ${targetDate}.`);
      setDateContextMenu(null);
      return;
    }

    if (action === 'paste') {
      if (!copiedDuty) return;
      const saved = saveSchedule(
        copiedDuty.isOnDuty,
        targetDate,
        copiedDuty
      );
      if (saved) {
        setSelectedDate(targetDate);
        const slotPrefix = `${selectedPerson.id}|${targetDate}|`;
        setBlockedSlots((previous) => previous.filter((key) => !key.startsWith(slotPrefix)));
      }
      setDateContextMenu(null);
      return;
    }

    const saved = saveSchedule(action === 'open', targetDate, {
      startTime: targetDuty.startTime || defaultDuty.startTime || startTime || '09:00',
      endTime: targetDuty.endTime || defaultDuty.endTime || endTime || '17:00',
      intervalMinutes: targetDuty.intervalMinutes || defaultDuty.intervalMinutes || intervalMinutes,
    });
    if (saved) {
      setSelectedDate(targetDate);
      const slotPrefix = `${selectedPerson.id}|${targetDate}|`;
      setBlockedSlots((previous) => previous.filter((key) => !key.startsWith(slotPrefix)));
    }
    setDateContextMenu(null);
  };

  const confirmBlockDate = (event: React.FormEvent) => {
    event.preventDefault();
    const remark = blockRemark.trim();
    if (!remark) {
      setBlockRemarkError('Enter a remark to block this date.');
      return;
    }
    if (!selectedPerson || !dateContextMenu) return;
    const targetDate = dateContextMenu.date;
    const targetDuty = getDutyForDate(targetDate);
    const saved = saveSchedule(false, targetDate, {
      startTime: targetDuty.startTime || startTime || '09:00',
      endTime: targetDuty.endTime || endTime || '17:00',
      intervalMinutes: targetDuty.intervalMinutes || intervalMinutes,
      remark,
    });
    if (saved) {
      setSelectedDate(targetDate);
      const slotPrefix = `${selectedPerson.id}|${targetDate}|`;
      setBlockedSlots((previous) => previous.filter((key) => !key.startsWith(slotPrefix)));
      setShowBlockRemark(false);
      setDateContextMenu(null);
    }
  };

  useEffect(() => {
    if (!selectedPerson) return;
    const duty = selectedPerson.source === 'doctor'
      ? getDoctorDutyWindow(selectedPerson.doctor, doctorDutySchedules, selectedDate)
      : staffDutySchedules.find(
          (schedule) => schedule.staffId === selectedPerson.id && schedule.date === selectedDate
        ) || getStaffShift(selectedPerson.member);
    setIsOnDuty(duty.isOnDuty);
    setStartTime(duty.startTime || '09:00');
    setEndTime(duty.endTime || '17:00');
    setIntervalMinutes((duty as any).intervalMinutes || 30);
  }, [selectedPerson?.key, selectedDate, doctorDutySchedules, staffDutySchedules]);

  const selectedMonth = new Date(`${selectedDate}T12:00:00`);
  const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1, 12);
  const monthDayCount = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
  const tomorrowDate = new Date(`${today()}T12:00:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = formatDate(tomorrowDate);
  const monthDates = Array.from({ length: monthDayCount }, (_, index) => {
    const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), index + 1, 12);
    const value = formatDate(date);
    const specificSchedule = selectedPerson
      ? selectedPerson.source === 'doctor'
        ? doctorDutySchedules.find((schedule) => schedule.doctorId === selectedPerson.id && schedule.date === value)
        : staffDutySchedules.find((schedule) => schedule.staffId === selectedPerson.id && schedule.date === value)
      : undefined;
    const duty = specificSchedule || (selectedPerson?.source === 'doctor'
      ? getDoctorDutyWindow(selectedPerson.doctor, doctorDutySchedules, value)
      : selectedPerson
      ? getStaffShift(selectedPerson.member)
      : { isOnDuty: false, startTime: '', endTime: '' });
    return {
      value,
      day: index + 1,
      isToday: value === today(),
      isTomorrow: value === tomorrow,
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      isPast: value < today(),
      hasSpecificSchedule: Boolean(specificSchedule),
      isBlocked: Boolean(specificSchedule && !specificSchedule.isOnDuty && specificSchedule.remark),
      remark: specificSchedule?.remark || '',
      isOnDuty: duty.isOnDuty,
      startTime: duty.startTime,
      endTime: duty.endTime,
      hasBreak: blockedSlots.some(
        (key) => key.startsWith(`${selectedPerson?.id || ''}|${value}|`) && key.endsWith('|break')
      ),
    };
  });
  const monthLabel = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const currentMonthStart = new Date(`${today().slice(0, 7)}-01T12:00:00`);
  const canShowPreviousMonth = monthStart > currentMonthStart;
  const changeMonth = (offset: number) => {
    const nextMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + offset, 1, 12);
    const nextValue = formatDate(nextMonth);
    setSelectedDate(nextValue < today() ? today() : nextValue);
  };

  const saveSchedule = (
    dutyStatus = isOnDuty,
    scheduleDate = selectedDate,
    scheduleValues: {
      startTime: string;
      endTime: string;
      intervalMinutes: number;
      remark?: string;
    } = { startTime, endTime, intervalMinutes }
  ) => {
    if (!selectedPerson) return;
    const data = {
      date: scheduleDate,
      isOnDuty: dutyStatus,
      startTime: dutyStatus ? scheduleValues.startTime : '',
      endTime: dutyStatus ? scheduleValues.endTime : '',
      intervalMinutes: scheduleValues.intervalMinutes,
      ...(scheduleValues.remark ? { remark: scheduleValues.remark } : {}),
    };
    const saved = selectedPerson.source === 'doctor'
      ? setDoctorDutySchedule({ ...data, doctorId: selectedPerson.id })
      : setStaffDutySchedule({ ...data, staffId: selectedPerson.id });
    setFeedback(saved
      ? `Duty updated for ${selectedPerson.name} on ${scheduleDate}${dutyStatus ? '.' : ' · Off duty.'}`
      : 'Could not save this duty schedule. Check the selected day and shift times.');
    return saved;
  };

  if (currentRole !== 'admin' && currentRole !== 'doctor') {
    return (
      <section className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-white p-6 text-center shadow-sm">
        <ShieldCheck className="mx-auto h-8 w-8 text-amber-600" />
        <h2 className="mt-3 text-base font-bold text-slate-900">Duty roster access restricted</h2>
        <p className="mt-1 text-sm text-slate-600">Only administrators and doctors can view duty assignments.</p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-800"><CalendarClock className="h-4.5 w-4.5" /></span>
          <div>
            <h1 className="text-base font-bold text-slate-950">Staff Duty Roster</h1>
            <p className="mt-0.5 text-xs text-slate-500">Arrange daily duty and shift hours for doctors and all active staff.</p>
          </div>
        </div>
        {currentRole === 'admin' && <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800"><ShieldCheck className="h-4 w-4" /> Schedule administrator</span>}
      </header>

      <form onSubmit={(event) => { event.preventDefault(); saveSchedule(); }} className="grid grid-cols-1 items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <section>
          <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Stethoscope className="h-4 w-4 text-teal-800" />
            <h2 className="text-sm font-bold text-slate-900">Select department, team member, and date</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-700">
              Department
              <select value={selectedDepartment} onChange={(event) => { setSelectedDepartment(event.target.value); setFeedback(''); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                <option value="">All departments</option>
                {departments.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Staff type
              <select value={selectedGroup} onChange={(event) => { setSelectedGroup(event.target.value); setFeedback(''); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                <option value="all">All staff types</option>
                {groups.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
              Staff member
              <select
                value={selectedPerson?.key || ''}
                onChange={(event) => { setSelectedPersonKey(event.target.value); setFeedback(''); }}
                disabled={filteredPeople.length === 0}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal disabled:bg-slate-100"
              >
                {filteredPeople.map((person) => (
                  <option key={person.key} value={person.key}>
                    {person.name} · {person.source === 'doctor' ? person.doctor.specialty : person.group} · {person.department}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <section className="mt-4 rounded-lg border border-slate-200 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={!canShowPreviousMonth}
                onClick={() => changeMonth(-1)}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <h3 className="text-sm font-bold text-slate-900">{monthLabel}</h3>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => (
                <div key={weekday} className="pb-1 text-center text-[9px] font-bold uppercase tracking-wide text-slate-500">
                  {weekday}
                </div>
              ))}
              {Array.from({ length: monthStart.getDay() }, (_, index) => (
                <div key={`empty-${index}`} aria-hidden="true" />
              ))}
              {monthDates.map((day) => {
                const isSelected = selectedDate === day.value;
                return (
                  <button
                    key={day.value}
                    type="button"
                    disabled={day.isPast}
                    aria-pressed={isSelected}
                    onContextMenu={(event) => openDateMenu(event, day.value)}
                    onClick={() => { setSelectedDate(day.value); setFeedback(''); }}
                    title={day.remark || undefined}
                    className={`min-h-[4.5rem] rounded-md border p-1 text-left transition sm:min-h-20 ${
                      isSelected
                        ? 'border-teal-800 bg-teal-800 text-white'
                        : day.isPast
                        ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                        : day.hasBreak
                        ? 'border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300'
                        : day.isBlocked
                        ? 'border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-300'
                        : day.hasSpecificSchedule && !day.isOnDuty
                        ? 'border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-300'
                        : day.isOnDuty
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-400'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50'
                    }`}
                  >
                    <span className="flex items-start justify-between gap-0.5">
                      <span className="text-xs font-bold">{day.day}</span>
                      <span className="text-[8px] font-semibold sm:text-[9px]">
                        {day.isToday ? 'Today' : day.isTomorrow ? 'Tomorrow' : day.weekday}
                      </span>
                    </span>
                    <span className={`mt-1 block truncate text-[8px] font-medium sm:text-[9px] ${isSelected ? 'text-white/80' : day.isPast ? 'text-slate-300' : 'opacity-75'}`}>
                      {day.isPast
                        ? 'Past'
                      : day.hasBreak
                      ? 'Break'
                      : day.isBlocked
                      ? 'Blocked'
                      : day.isOnDuty
                        ? `${day.startTime}–${day.endTime}`
                        : day.hasSpecificSchedule
                        ? 'Off duty'
                        : 'No shift'}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-500">
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />On duty</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400" />Scheduled off duty</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-300" />No shift set</span>
            </div>
          </section>
          <label className="mt-3 block max-w-xs text-xs font-semibold text-slate-700">
            Or choose a date
            <input type="date" min={today()} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal" />
          </label>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="h-4 w-4 text-teal-800" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Daily duty assignment</h2>
              {selectedPerson && <p className="mt-0.5 text-[11px] text-slate-500">{selectedPerson.name} · {selectedPerson.department} · {selectedDate}</p>}
            </div>
          </div>

          {selectedPerson ? (
            <>
              <div className={`mb-3 rounded-md border px-3 py-2 text-xs ${dateSchedule ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                {dateSchedule ? 'Date-specific schedule is set.' : inheritedDuty.isOnDuty ? `Using default shift: ${inheritedDuty.startTime}–${inheritedDuty.endTime}` : 'No default duty is set for this staff member.'}
              </div>
              {currentRole === 'admin' ? (
                <div className="space-y-3">
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800">
                    <span>Staff member is on duty</span>
                    <input type="checkbox" checked={isOnDuty} onChange={(event) => setIsOnDuty(event.target.checked)} className="h-4 w-4 accent-teal-800" />
                  </label>
                  {isOnDuty && (
                    <div ref={shiftTimingRef} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <label className="text-xs font-semibold text-slate-700">Start time<input required type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" /></label>
                      <label className="text-xs font-semibold text-slate-700">End time<input required type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" /></label>
                      <label className="text-xs font-semibold text-slate-700">
                        Slot gap
                        <select value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.target.value))} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal">
                          {[5, 10, 15, 20, 30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
                        </select>
                      </label>
                    </div>
                  )}
                  {feedback && <p role="status" className="text-xs text-teal-800">{feedback}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsOnDuty(false);
                        saveSchedule(false);
                      }}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-200 bg-white px-4 text-xs font-bold text-rose-700 hover:bg-rose-50"
                    >
                      <Ban className="h-4 w-4" /> Off duty
                    </button>
                    <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-md bg-teal-800 px-4 text-xs font-bold text-white hover:bg-teal-900"><CheckCircle2 className="h-4 w-4" /> Save daily duty</button>
                  </div>
                </div>
              ) : (
                <div className={`rounded-lg p-4 ${visibleDuty.isOnDuty ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                  <p className={`text-sm font-bold ${visibleDuty.isOnDuty ? 'text-emerald-800' : 'text-slate-700'}`}>{visibleDuty.isOnDuty ? 'On duty' : 'Off duty'}</p>
                  {visibleDuty.isOnDuty && <p className="mt-1 font-mono text-sm text-slate-700">{visibleDuty.startTime}–{visibleDuty.endTime}</p>}
                  <p className="mt-2 text-[11px] text-slate-500">Contact an administrator to change this assignment.</p>
                </div>
              )}
              {dutySlots.length > 0 ? (
                <section className="mt-4 border-t border-slate-100 pt-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">Slots for this day</h3>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {currentRole === 'admin'
                          ? 'Right-click a slot to mark a break or open it again.'
                          : 'Green slots are open; amber slots are breaks; red slots are off duty.'}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-500">{availableSlotCount} available</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {dutySlots.map((slot) => {
                      const blocked = isSlotBlocked(slot);
                      const booked = isSlotBooked(slot);
                      return (
                        <button
                          key={slot}
                          type="button"
                          onContextMenu={(event) => openSlotMenu(event, slot)}
                          onClick={() => setContextMenu(null)}
                          className={`min-h-10 rounded-md border px-2 py-2 text-xs font-semibold ${
                            booked
                              ? 'cursor-not-allowed border-blue-200 bg-blue-50 text-blue-800'
                              : blocked
                              ? isSlotBreak(slot)
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : 'border-rose-200 bg-rose-50 text-rose-800'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          }`}
                          aria-label={`${slot}${booked ? ', booked' : isSlotBreak(slot) ? ', break' : blocked ? ', off duty' : ', open'}; right-click for actions`}
                          title="Right-click for slot actions"
                        >
                          {slot}{booked ? ' · Booked' : isSlotBreak(slot) ? ' · Break' : blocked ? ' · Off duty' : ' · Open'}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  No shift is scheduled for this day. Set the team member on duty and save to create daily slots.
                </p>
              )}
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">No active team members match these filters.</p>
          )}
        </section>
      </form>
      {dateContextMenu && selectedPerson && (
        <div
          data-roster-date-menu
          role="menu"
          aria-label={`${dateContextMenu.date} duty actions`}
          style={{ left: dateContextMenu.x, top: dateContextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
          className="fixed z-50 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-xs font-bold text-slate-900">Duty actions</p>
            <p className="truncate text-[10px] text-slate-500">{selectedPerson.name} · {dateContextMenu.date}</p>
          </div>
          <button role="menuitem" type="button" disabled={currentRole !== 'admin'} onClick={() => handleDateMenuAction('block')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            <Ban className="h-3.5 w-3.5 text-rose-700" /> Block date
          </button>
          {showBlockRemark && (
            <form onSubmit={confirmBlockDate} className="space-y-2 border-b border-slate-100 p-3">
              <label className="block text-[11px] font-semibold text-slate-700">
                Remark (required)
                <textarea
                  autoFocus
                  required
                  value={blockRemark}
                  onChange={(event) => { setBlockRemark(event.target.value); setBlockRemarkError(''); }}
                  rows={2}
                  maxLength={300}
                  placeholder="Why is this date being blocked?"
                  className="mt-1 w-full resize-none rounded-md border border-slate-300 px-2 py-1.5 text-xs font-normal"
                />
              </label>
              {blockRemarkError && <p role="alert" className="text-[10px] text-rose-700">{blockRemarkError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowBlockRemark(false)} className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={!blockRemark.trim()} className="rounded-md bg-rose-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50">Confirm block</button>
              </div>
            </form>
          )}
          <button role="menuitem" type="button" disabled={currentRole !== 'admin'} onClick={() => handleDateMenuAction('open')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            <Check className="h-3.5 w-3.5 text-emerald-700" /> Open date
          </button>
          <button role="menuitem" type="button" disabled={currentRole !== 'admin'} onClick={() => handleDateMenuAction('timing')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            <Timer className="h-3.5 w-3.5 text-blue-700" /> Change timing
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button role="menuitem" type="button" onClick={() => handleDateMenuAction('copy')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50">
            <Copy className="h-3.5 w-3.5 text-slate-600" /> Copy duty
          </button>
          <button role="menuitem" type="button" disabled={currentRole !== 'admin' || !copiedDuty} onClick={() => handleDateMenuAction('paste')} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            <ClipboardPaste className="h-3.5 w-3.5 text-slate-600" /> Paste duty
          </button>
        </div>
      )}
      {contextMenu && selectedPerson && (
        <div
          data-roster-slot-menu
          role="menu"
          aria-label={`${contextMenu.slot} duty slot actions`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
          className="fixed z-50 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-xs font-bold text-slate-900">{contextMenu.slot}</p>
            <p className="truncate text-[10px] text-slate-500">{selectedPerson.name} · {selectedDate}</p>
          </div>
          <button
            role="menuitem"
            type="button"
            disabled={currentRole !== 'admin' || isSlotBooked(contextMenu.slot)}
            onClick={() => setSlotAvailability(contextMenu.slot, 'break')}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Ban className="h-3.5 w-3.5 text-amber-700" />
            Mark as break
          </button>
          <button
            role="menuitem"
            type="button"
            disabled={currentRole !== 'admin' || (!isSlotBlocked(contextMenu.slot) && !isSlotBreak(contextMenu.slot))}
            onClick={() => setSlotAvailability(contextMenu.slot, 'open')}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
            Open slot
          </button>
          {isSlotBooked(contextMenu.slot) && (
            <p className="px-3 pb-2 text-[10px] text-amber-700">A booked appointment cannot be marked off duty.</p>
          )}
        </div>
      )}
    </div>
  );
};
