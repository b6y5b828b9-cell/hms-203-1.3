import React, { useState } from 'react';
import {
  Video,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  CheckCircle2,
  Stethoscope,
  PhoneCall,
  Search,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { TelehealthVideoModal } from './TelehealthVideoModal';

export const TelehealthView: React.FC = () => {
  const { doctors, appointments, patients } = useHospital();
  const [activeCallPatientId, setActiveCallPatientId] = useState<string | null>(null);
  const [activeDoctorName, setActiveDoctorName] = useState<string>('Dr. Sarah Jenkins, MD');

  const telehealthDocs = doctors.filter((d) => d.telehealthEnabled);

  const telehealthAppointments = appointments.filter(
    (a) => a.status === 'Scheduled' || a.status === 'Checked-In'
  );

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold">
              <Video className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-white tracking-wide">
              Telehealth & Remote Ambulatory Consultations
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-bold uppercase">
              WEBRTC SECURE
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl">
            Live WebRTC clinical video consultations, remote patient vitals streaming, and digital e-prescribing.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-850 px-3 py-1.5 rounded-lg border border-slate-700">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>HIPAA & SOC-2 Type II Certified Pipeline</span>
        </div>
      </div>

      {/* Available Telehealth Physicians */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {telehealthDocs.map((doc) => (
          <div
            key={doc.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">
                  {doc.id}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    doc.status === 'Available'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  ● {doc.status}
                </span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                  {doc.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900">{doc.name}</h3>
                  <p className="text-[11px] text-slate-500">{doc.specialty}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                Shift: {doc.shift} · Room: {doc.roomNumber} · Rating: ★ {doc.rating}
              </p>
            </div>

            <button
              onClick={() => {
                const samplePatient = patients[0];
                if (samplePatient) {
                  setActiveCallPatientId(samplePatient.id);
                  setActiveDoctorName(doc.name);
                }
              }}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Launch Telehealth Room</span>
            </button>
          </div>
        ))}
      </div>

      {/* Telehealth Queue */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Scheduled Telehealth Remote Waiting Room ({telehealthAppointments.length})
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-2.5 px-3">Patient</th>
                <th className="py-2.5 px-3">Doctor</th>
                <th className="py-2.5 px-3">Date & Slot</th>
                <th className="py-2.5 px-3">Chief Reason</th>
                <th className="py-2.5 px-3">Queue Status</th>
                <th className="py-2.5 px-3 text-right">Connect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {telehealthAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No remote telehealth sessions waiting.
                  </td>
                </tr>
              ) : (
                telehealthAppointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{appt.patientName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {appt.patientId} · {appt.patientAge}y {appt.patientGender}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 font-medium">
                      {appt.doctorName}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                      {appt.date} · {appt.timeSlot}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                      {appt.chiefComplaint}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                        {appt.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-right">
                      <button
                        onClick={() => {
                          setActiveCallPatientId(appt.patientId);
                          setActiveDoctorName(appt.doctorName);
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Video className="w-3.5 h-3.5" /> Start Call
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activeCallPatientId && (
        <TelehealthVideoModal
          isOpen={Boolean(activeCallPatientId)}
          onClose={() => setActiveCallPatientId(null)}
          patientId={activeCallPatientId}
          doctorName={activeDoctorName}
        />
      )}
    </div>
  );
};
