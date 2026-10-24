import React, { useEffect, useState } from 'react';
import { CalendarClock, Send } from 'lucide-react';
import { useHospital } from '../context/HospitalContext';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const normalizeName = (name: string) =>
  name.toLowerCase().replace(/^dr\.?\s*/, '').replace(/,?\s*(md|facs|do|phd)\b/g, '').replace(/[.,]/g, '').trim();

const timeToMinutes = (time: string) => {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  return (Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(match[2]);
};

const toTimeInput = (time: string) => {
  const minutes = timeToMinutes(time);
  if (minutes === null) return '';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

const toDutyLabel = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

export const DoctorDutyRotaRequest: React.FC = () => {
  const {
    doctors,
    currentRole,
    currentUser,
    doctorDutyChangeRequests,
    submitDoctorDutyChangeRequest,
  } = useHospital();
  const doctor = doctors.find((item) => normalizeName(item.name) === normalizeName(currentUser.name));
  const [requestedDays, setRequestedDays] = useState<string[]>(doctor?.availableDays || []);
  const initialTimes = doctor?.availableHours.split(/\s+-\s+/) || [];
  const [requestedStart, setRequestedStart] = useState(toTimeInput(initialTimes[0] || ''));
  const [requestedEnd, setRequestedEnd] = useState(toTimeInput(initialTimes[1] || ''));
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');

  useEffect(() => {
    if (!doctor) return;
    setRequestedDays(doctor.availableDays);
    const [start, end] = doctor.availableHours.split(/\s+-\s+/);
    setRequestedStart(toTimeInput(start || ''));
    setRequestedEnd(toTimeInput(end || ''));
  }, [doctor]);

  if (currentRole !== 'doctor') return null;

  const myRequests = doctorDutyChangeRequests.filter((request) => request.requesterUserId === currentUser.id);
  const pendingRequest = myRequests.find((request) => request.status === 'Pending');

  const toggleDay = (day: string) => {
    setRequestedDays((days) => days.includes(day) ? days.filter((item) => item !== day) : [...days, day]);
    setConfirmation('');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!doctor || pendingRequest) return;
    const startMinutes = requestedStart ? Number(requestedStart.split(':')[0]) * 60 + Number(requestedStart.split(':')[1]) : null;
    const endMinutes = requestedEnd ? Number(requestedEnd.split(':')[0]) * 60 + Number(requestedEnd.split(':')[1]) : null;
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      setConfirmation('Enter a valid end time after the start time.');
      return;
    }
    const request = submitDoctorDutyChangeRequest(doctor.id, {
      availableDays: requestedDays,
      availableHours: `${toDutyLabel(requestedStart)} - ${toDutyLabel(requestedEnd)}`,
      reason,
    });
    setConfirmation(request ? 'Your request has been sent to hospital administration.' : 'Unable to submit this request. Check your schedule and try again.');
    if (request) setReason('');
  };

  if (!doctor) {
    return (
      <section className="rounded-xl border border-amber-200 bg-white p-4 text-xs text-amber-900">
        No physician schedule is linked to {currentUser.name}. Contact administration to link your doctor profile.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
        <CalendarClock className="h-4 w-4 text-teal-700" />
        <div>
          <h3 className="text-sm font-bold text-slate-900">Doctor Duty Rota</h3>
          <p className="text-[11px] text-slate-500">Current schedule: {doctor.availableDays.join(', ')} · {doctor.availableHours}</p>
        </div>
      </div>

      {pendingRequest ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-bold">Rota change awaiting admin approval</p>
          <p className="mt-1">Requested: {pendingRequest.requestedDays.join(', ')} · {pendingRequest.requestedHours}</p>
          <p className="mt-1 text-amber-800">Reason: {pendingRequest.reason}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <fieldset>
            <legend className="mb-1.5 text-[11px] font-semibold text-slate-700">Requested duty days</legend>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((day) => (
                <label key={day} className={`cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-semibold ${requestedDays.includes(day) ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                  <input className="sr-only" type="checkbox" checked={requestedDays.includes(day)} onChange={() => toggleDay(day)} />
                  {day}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-[11px] font-semibold text-slate-700">
              Start time
              <input
                required
                type="time"
                value={requestedStart}
                onChange={(event) => setRequestedStart(event.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs font-normal text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-700">
              End time
              <input
                required
                type="time"
                value={requestedEnd}
                onChange={(event) => setRequestedEnd(event.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs font-normal text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-700">
              Reason for change
              <input
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Enter a reason for the request"
                className="mt-1 block w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs font-normal text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p role="status" className="text-[11px] text-slate-600">{confirmation}</p>
            <button
              type="submit"
              disabled={!requestedDays.length || !requestedStart || !requestedEnd || !reason.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> Submit for approval
            </button>
          </div>
        </form>
      )}

      {myRequests.some((request) => request.status !== 'Pending') && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <h4 className="mb-2 text-[11px] font-bold uppercase text-slate-600">Recent requests</h4>
          <div className="space-y-1.5">
            {myRequests.filter((request) => request.status !== 'Pending').slice(0, 3).map((request) => (
              <p key={request.id} className="text-[11px] text-slate-600">
                <span className={`font-semibold ${request.status === 'Approved' ? 'text-emerald-700' : 'text-rose-700'}`}>{request.status}</span>
                {' · '}{request.requestedDays.join(', ')} · {request.requestedHours}
                {request.reviewedBy && ` · Reviewed by ${request.reviewedBy}`}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};