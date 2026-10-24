import React, { useState, useEffect } from 'react';
import {
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MessageSquare,
  Activity,
  ShieldCheck,
  Maximize2,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';

interface TelehealthVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  doctorName?: string;
}

export const TelehealthVideoModal: React.FC<TelehealthVideoModalProps> = ({
  isOpen,
  onClose,
  patientId,
  doctorName = 'Dr. Sarah Jenkins, MD',
}) => {
  const { patients } = useHospital();
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  const patient = patients.find((p) => p.id === patientId);

  useEffect(() => {
    if (!isOpen) {
      setCallDuration(0);
      return;
    }
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen || !patient) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 z-50 animate-in fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col h-[85vh] text-white">
        {/* Call Header */}
        <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <div className="font-bold text-xs text-white flex items-center gap-2">
                <span>Encrypted Telehealth Session</span>
                <span className="font-mono text-emerald-400 text-[11px] font-bold">
                  {formatDuration(callDuration)}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Patient: {patient.firstName} {patient.lastName} (MRN: {patient.id}) · Physician: {doctorName}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono hidden sm:inline-block">
              WEBRTC P2P 1080P
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Canvas Simulation */}
        <div className="flex-1 relative bg-slate-950 flex items-center justify-center overflow-hidden">
          {/* Main Remote Feed (Patient) */}
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-slate-900 to-slate-950">
            <div className="w-24 h-24 rounded-full bg-blue-600/20 border-2 border-blue-500 text-blue-400 flex items-center justify-center font-bold text-3xl mb-4 shadow-xl shadow-blue-500/10">
              {patient.firstName[0]}
              {patient.lastName[0]}
            </div>
            <h3 className="text-base font-bold text-white">
              {patient.firstName} {patient.lastName}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Remote Patient Feed Connected (Latency: 22ms)
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300 font-mono">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>Real-time vitals: SpO2 98% · HR 74 BPM</span>
            </div>
          </div>

          {/* Picture-in-picture Doctor Feed */}
          <div className="absolute bottom-4 right-4 w-40 h-28 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl flex flex-col items-center justify-center text-center p-2">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center mb-1">
              MD
            </div>
            <span className="text-[10px] font-bold text-slate-200 line-clamp-1">{doctorName}</span>
            <span className="text-[9px] text-slate-400">Attending (Local)</span>
          </div>
        </div>

        {/* Call Controls Bar */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">HIPAA Compliant End-to-End Encryption</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setMicActive(!micActive)}
              className={`p-3 rounded-full transition cursor-pointer ${
                micActive
                  ? 'bg-slate-800 hover:bg-slate-700 text-white'
                  : 'bg-rose-600 text-white hover:bg-rose-500'
              }`}
              title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setVideoActive(!videoActive)}
              className={`p-3 rounded-full transition cursor-pointer ${
                videoActive
                  ? 'bg-slate-800 hover:bg-slate-700 text-white'
                  : 'bg-rose-600 text-white hover:bg-rose-500'
              }`}
              title={videoActive ? 'Turn off camera' : 'Turn on camera'}
            >
              {videoActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition cursor-pointer"
              title="Terminate Consultation Call"
            >
              <PhoneOff className="w-4 h-4" />
              <span>End Call</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
