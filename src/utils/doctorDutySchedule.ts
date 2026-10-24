import { Doctor, DoctorDutySchedule } from '../types';

export interface DoctorDutyWindow {
  isOnDuty: boolean;
  startTime: string;
  endTime: string;
  intervalMinutes?: number;
}

const parseClockTime = (value: string): number | null => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  const rawHour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || rawHour > 23) return null;
  const hour = match[3]
    ? (rawHour % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0)
    : rawHour;
  return hour * 60 + minute;
};

const to24Hour = (value: string) => {
  const minutes = parseClockTime(value);
  if (minutes === null) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

export const getDoctorDutyWindow = (
  doctor: Doctor,
  schedules: DoctorDutySchedule[],
  date: string
): DoctorDutyWindow => {
  const datedSchedule = schedules.find((schedule) => schedule.doctorId === doctor.id && schedule.date === date);
  if (datedSchedule) {
    return {
      isOnDuty: datedSchedule.isOnDuty,
      startTime: datedSchedule.isOnDuty ? datedSchedule.startTime : '',
      endTime: datedSchedule.isOnDuty ? datedSchedule.endTime : '',
      intervalMinutes: datedSchedule.intervalMinutes || 30,
    };
  }

  const weekday = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
  if (!doctor.availableDays.includes(weekday)) {
    return { isOnDuty: false, startTime: '', endTime: '' };
  }

  const [legacyStart = '', legacyEnd = ''] = doctor.availableHours.split(/\s+-\s+/);
  const startTime = to24Hour(legacyStart);
  const endTime = to24Hour(legacyEnd);
  const startMinutes = parseClockTime(startTime);
  const endMinutes = parseClockTime(endTime);
  if (!startTime || !endTime || startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return { isOnDuty: false, startTime: '', endTime: '' };
  }
  return { isOnDuty: true, startTime, endTime };
};

export const getDutyAppointmentSlots = (window: DoctorDutyWindow, intervalMinutes = window.intervalMinutes || 30): string[] => {
  if (!window.isOnDuty) return [];
  const startMinutes = parseClockTime(window.startTime);
  const endMinutes = parseClockTime(window.endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return [];

  const slots: string[] = [];
  for (let minutes = startMinutes; minutes + intervalMinutes <= endMinutes; minutes += intervalMinutes) {
    const hour24 = Math.floor(minutes / 60);
    const hour12 = hour24 % 12 || 12;
    const meridiem = hour24 >= 12 ? 'PM' : 'AM';
    slots.push(`${String(hour12).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} ${meridiem}`);
  }
  return slots;
};
