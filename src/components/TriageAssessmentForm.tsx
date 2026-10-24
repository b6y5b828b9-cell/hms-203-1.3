import React, { useState } from 'react';
import {
  Activity,
  Heart,
  Thermometer,
  Wind,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  User,
  ShieldAlert,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { TriageUrgencyLevel, TriageAssessment } from '../types';

interface TriageAssessmentFormProps {
  initialPatientId?: string;
  onAssessmentCompleted?: (patientId: string, assessment: TriageAssessment) => void;
  onCancel?: () => void;
  isCompact?: boolean;
}

export const TriageAssessmentForm: React.FC<TriageAssessmentFormProps> = ({
  initialPatientId,
  onAssessmentCompleted,
  onCancel,
  isCompact = false,
}) => {
  const { patients, currentUser, recordTriageAssessment } = useHospital();

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    initialPatientId || (patients.length > 0 ? patients[0].id : '')
  );

  const [urgencyLevel, setUrgencyLevel] = useState<TriageUrgencyLevel>('Level 3 - Urgent');
  const [systolic, setSystolic] = useState<number>(124);
  const [diastolic, setDiastolic] = useState<number>(82);
  const [heartRate, setHeartRate] = useState<number>(76);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(16);
  const [tempF, setTempF] = useState<number>(98.6);
  const [oxygenSat, setOxygenSat] = useState<number>(98);
  const [gcsScore, setGcsScore] = useState<number>(15);
  const [chiefComplaint, setChiefComplaint] = useState<string>('Acute localized pain and mild dizziness');
  const [assignedZone, setAssignedZone] = useState<string>('Sub-Acute Bay 3');
  const [disposition, setDisposition] = useState<'Admit to Ward' | 'Emergency Bay' | 'Outpatient Clinic' | 'Discharged'>('Emergency Bay');
  const [notes, setNotes] = useState<string>('Airway patent, breathing regular, alert and oriented x3.');

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  const calculateNewsScore = (): number => {
    let score = 0;
    if (respiratoryRate <= 8 || respiratoryRate >= 25) score += 3;
    else if (respiratoryRate >= 21) score += 2;
    else if (respiratoryRate <= 11) score += 1;

    if (oxygenSat <= 91) score += 3;
    else if (oxygenSat <= 93) score += 2;
    else if (oxygenSat <= 95) score += 1;

    if (tempF <= 95.0 || tempF >= 102.4) score += 3;
    else if (tempF >= 100.6) score += 1;
    else if (tempF <= 96.8) score += 1;

    if (systolic <= 90 || systolic >= 220) score += 3;
    else if (systolic <= 100) score += 2;
    else if (systolic <= 110) score += 1;

    if (heartRate <= 40 || heartRate >= 131) score += 3;
    else if (heartRate >= 111) score += 2;
    else if (heartRate >= 91 || heartRate <= 50) score += 1;

    if (gcsScore < 15) score += 3;

    return score;
  };

  const currentNewsScore = calculateNewsScore();

  const handleUrgencySelect = (lvl: TriageUrgencyLevel) => {
    setUrgencyLevel(lvl);
    if (lvl.includes('Level 1')) {
      setAssignedZone('Resuscitation Trauma Bay 1');
      setDisposition('Emergency Bay');
    } else if (lvl.includes('Level 2')) {
      setAssignedZone('Acute Care Bay 2');
      setDisposition('Emergency Bay');
    } else if (lvl.includes('Level 3')) {
      setAssignedZone('Sub-Acute Bay 4');
      setDisposition('Emergency Bay');
    } else {
      setAssignedZone('Ambulatory Green Zone');
      setDisposition('Outpatient Clinic');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;

    const assessment = recordTriageAssessment(selectedPatientId, {
      patientId: selectedPatientId,
      patientName: selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : 'Unknown',
      assessedBy: currentUser.name || 'Jacqueline Chen, RN',
      assessorRole: currentUser.role || 'Staff Nurse',
      urgencyLevel,
      bloodPressure: `${systolic}/${diastolic}`,
      heartRate,
      respiratoryRate,
      temperatureF: tempF,
      oxygenSaturation: oxygenSat,
      gcsScore,
      newsScore: currentNewsScore,
      chiefComplaint,
      assignedZone,
      disposition,
      notes,
    });

    if (onAssessmentCompleted) {
      onAssessmentCompleted(selectedPatientId, assessment);
    }
  };

  const urgencyTiers: Array<{
    level: TriageUrgencyLevel;
    title: string;
    desc: string;
    color: string;
    badgeColor: string;
  }> = [
    {
      level: 'Level 1 - Resuscitation (Immediate)',
      title: 'Level 1: Resuscitation',
      desc: 'Immediate life-threat (Airway/Cardiac)',
      color: 'border-rose-500 bg-rose-50/70 text-rose-900',
      badgeColor: 'bg-rose-600 text-white',
    },
    {
      level: 'Level 2 - Emergent (High Risk / <15m)',
      title: 'Level 2: Emergent',
      desc: 'Severe chest pain, stroke, high lethality',
      color: 'border-amber-500 bg-amber-50/70 text-amber-900',
      badgeColor: 'bg-amber-600 text-white',
    },
    {
      level: 'Level 3 - Urgent (<30m)',
      title: 'Level 3: Urgent',
      desc: 'Moderate distress, 2+ resources needed',
      color: 'border-yellow-500 bg-yellow-50/70 text-yellow-900',
      badgeColor: 'bg-yellow-600 text-white',
    },
    {
      level: 'Level 4 - Less Urgent (<60m)',
      title: 'Level 4: Less Urgent',
      desc: 'Low distress, 1 simple diagnostic needed',
      color: 'border-blue-500 bg-blue-50/70 text-blue-900',
      badgeColor: 'bg-blue-600 text-white',
    },
    {
      level: 'Level 5 - Non-Urgent (Routine)',
      title: 'Level 5: Non-Urgent',
      desc: 'Routine clinic consult or prescription refill',
      color: 'border-emerald-500 bg-emerald-50/70 text-emerald-900',
      badgeColor: 'bg-emerald-600 text-white',
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      <div>
        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
          Select Patient for Intake Assessment
        </label>
        <select
          value={selectedPatientId}
          onChange={(e) => setSelectedPatientId(e.target.value)}
          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500/20"
          required
        >
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName} (MRN: {p.id}) · {p.age}y {p.gender} · Blood: {p.bloodGroup} · Status: {p.status}
            </option>
          ))}
        </select>
        {selectedPatient && (
          <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-[11px] text-slate-600">
            <span>Primary Physician: <strong>{selectedPatient.primaryPhysicianName}</strong></span>
            <span>Allergies: <strong className="text-rose-600">{selectedPatient.allergies.join(', ') || 'NKDA'}</strong></span>
          </div>
        )}
      </div>

      <div>
        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
          Acuity Stratification (Emergency Severity Index - ESI)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {urgencyTiers.map((tier) => {
            const isSelected = urgencyLevel === tier.level;
            return (
              <div
                key={tier.level}
                onClick={() => handleUrgencySelect(tier.level)}
                className={`p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                  isSelected
                    ? `${tier.color} shadow-xs font-semibold`
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{tier.title}</span>
                  {isSelected && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${tier.badgeColor}`}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-[10px] opacity-80 mt-1 line-clamp-1">{tier.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>Physiological Telemetry & Vitals</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-semibold">Calculated NEWS2:</span>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                currentNewsScore >= 7
                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                  : currentNewsScore >= 5
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}
            >
              Score: {currentNewsScore} ({currentNewsScore >= 7 ? 'High Clinical Risk' : currentNewsScore >= 5 ? 'Medium Risk' : 'Low Risk'})
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-1">Blood Pressure</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={systolic}
                onChange={(e) => setSystolic(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded p-1 text-xs font-mono font-bold text-slate-800"
                placeholder="Sys"
              />
              <span className="text-slate-400">/</span>
              <input
                type="number"
                value={diastolic}
                onChange={(e) => setDiastolic(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded p-1 text-xs font-mono font-bold text-slate-800"
                placeholder="Dia"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-1 flex items-center gap-1">
              <Heart className="w-3 h-3 text-rose-500" /> Heart Rate
            </label>
            <input
              type="number"
              value={heartRate}
              onChange={(e) => setHeartRate(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded p-1 text-xs font-mono font-bold text-slate-800"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-1 flex items-center gap-1">
              <Wind className="w-3 h-3 text-sky-500" /> Resp. Rate
            </label>
            <input
              type="number"
              value={respiratoryRate}
              onChange={(e) => setRespiratoryRate(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded p-1 text-xs font-mono font-bold text-slate-800"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-1 flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-amber-500" /> Temp (°F)
            </label>
            <input
              type="number"
              step="0.1"
              value={tempF}
              onChange={(e) => setTempF(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded p-1 text-xs font-mono font-bold text-slate-800"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-1">SpO2 (%)</label>
            <input
              type="number"
              value={oxygenSat}
              onChange={(e) => setOxygenSat(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded p-1 text-xs font-mono font-bold text-slate-800"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-500 font-semibold block mb-1">Glasgow (GCS)</label>
            <input
              type="number"
              min="3"
              max="15"
              value={gcsScore}
              onChange={(e) => setGcsScore(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded p-1 text-xs font-mono font-bold text-slate-800"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold text-slate-600 block mb-1">
            Chief Clinical Complaint
          </label>
          <input
            type="text"
            required
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-medium"
            placeholder="e.g. Acute severe substernal chest pressure radiating to jaw"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-semibold text-slate-600 block mb-1">Allocated Zone</label>
            <input
              type="text"
              value={assignedZone}
              onChange={(e) => setAssignedZone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-600 block mb-1">Disposition</label>
            <select
              value={disposition}
              onChange={(e) => setDisposition(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-medium"
            >
              <option value="Emergency Bay">Emergency Bay</option>
              <option value="Admit to Ward">Admit to Ward</option>
              <option value="Outpatient Clinic">Outpatient Clinic</option>
              <option value="Discharged">Discharged</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-slate-600 block mb-1">
          Nurse Triage Remarks & Initial Interventions
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
          placeholder="Document IV access, oxygen cannula, immediate physician notification, etc."
        />
      </div>

      <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-mono">
          Assessed by: {currentUser.name} ({currentUser.role})
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" /> Commit Triage Assessment
          </button>
        </div>
      </div>
    </form>
  );
};
