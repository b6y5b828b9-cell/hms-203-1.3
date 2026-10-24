import React, { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  Heart,
  Wind,
  Thermometer,
  Calendar,
  Clock,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowUpRight,
  ShieldAlert,
  Video,
  UserCheck,
  Stethoscope,
  Filter,
  FileText,
  ChevronRight,
  Sparkles,
  Info,
  X,
  Send,
  Droplet,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { Patient, Vitals, LabResult, Appointment, AppointmentStatus } from '../types';
import { getDoctorDutyWindow, getDutyAppointmentSlots } from '../utils/doctorDutySchedule';
import { PatientAvatar } from './PatientAvatar';
import { PatientLabDiagnosticsChart } from './reports/PatientLabDiagnosticsChart';

interface PatientDashboardProps {
  patient: Patient;
  onOpenTriageModal?: (patientId: string) => void;
  onStartTelehealth?: (patientId: string) => void;
  onNavigateToNotes?: () => void;
  onNavigateToPrescriptions?: () => void;
  onNavigateToReports?: () => void;
}

type TrendMetric = 'bp' | 'heartRate' | 'spO2' | 'temperature' | 'respiratoryRate';
type TimeframeOption = '6m' | '1y' | 'custom';

interface SyntheticVitalsPoint extends Vitals {
  label: string;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({
  patient,
  onOpenTriageModal,
  onStartTelehealth,
  onNavigateToNotes,
  onNavigateToPrescriptions,
  onNavigateToReports,
}) => {
  const {
    appointments,
    doctorDutySchedules,
    addVitals,
    addLabResult,
    addAppointment,
    addNotification,
    updateAppointmentStatus,
    updatePatientStatus,
    doctors,
    currentUser,
  } = useHospital();

  // Active Metric for Trends Telemetry Chart
  const [selectedMetric, setSelectedMetric] = useState<TrendMetric>('bp');
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>('6m');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Filters for Lab Results
  const [labStatusFilter, setLabStatusFilter] = useState<'all' | 'Critical' | 'Elevated' | 'Normal' | 'Pending'>('all');
  const [labCategoryFilter, setLabCategoryFilter] = useState<string>('all');

  // Modals inside Dashboard
  const [isRecordVitalsOpen, setIsRecordVitalsOpen] = useState(false);
  const [isOrderLabOpen, setIsOrderLabOpen] = useState(false);
  const [isScheduleAptOpen, setIsScheduleAptOpen] = useState(false);

  // New Vitals Form State
  const [newSys, setNewSys] = useState(120);
  const [newDia, setNewDia] = useState(80);
  const [newHr, setNewHr] = useState(72);
  const [newSpo2, setNewSpo2] = useState(98);
  const [newTemp, setNewTemp] = useState(98.6);
  const [newRr, setNewRr] = useState(16);
  const [newGlucose, setNewGlucose] = useState<number | undefined>(105);

  // New Lab Order Form State
  const [labTestName, setLabTestName] = useState('Comprehensive Metabolic Panel (CMP-14)');
  const [labCategory, setLabCategory] = useState<'Biochemistry' | 'Hematology' | 'Cardiology' | 'Pathology' | 'Radiology'>('Biochemistry');
  const [labPriority, setLabPriority] = useState<'Routine' | 'STAT Urgent'>('Routine');
  const [labDoctor, setLabDoctor] = useState(patient.primaryPhysicianName || 'Dr. Sarah Jenkins, MD');
  const [labNotes, setLabNotes] = useState('');

  // New Appointment Form State
  const [aptDate, setAptDate] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  const [aptTime, setAptTime] = useState('');
  const [aptDoctorId, setAptDoctorId] = useState(doctors[0]?.id || 'DOC-101');
  const [aptType, setAptType] = useState('Follow-up Specialist Review');
  const [aptReason, setAptReason] = useState('Longitudinal clinical follow-up and treatment plan review');
  const [aptRemarks, setAptRemarks] = useState('');

  const blockedDutySlots = useMemo(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('medcore_blocked_duty_slots_v1') || '[]');
      return Array.isArray(saved) && saved.every((slot) => typeof slot === 'string') ? saved : [];
    } catch {
      return [];
    }
  }, []);
  const selectedAppointmentDoctor = doctors.find((doctor) => doctor.id === aptDoctorId);
  const appointmentDutyWindow = selectedAppointmentDoctor
    ? getDoctorDutyWindow(selectedAppointmentDoctor, doctorDutySchedules, aptDate)
    : { isOnDuty: false, startTime: '', endTime: '' };
  const appointmentDutySlots = getDutyAppointmentSlots(appointmentDutyWindow);
  const isAppointmentSlotBlocked = (slot: string) =>
    blockedDutySlots.includes(`${aptDoctorId}|${aptDate}|${slot}`) ||
    blockedDutySlots.includes(`${aptDoctorId}|${aptDate}|${slot}|break`);
  const isAppointmentSlotBooked = (slot: string) => appointments.some(
    (appointment) => appointment.doctorId === aptDoctorId &&
      appointment.date === aptDate &&
      appointment.timeSlot === slot &&
      ['Scheduled', 'Checked-In', 'In Consultation'].includes(appointment.status)
  );
  const todayLocal = new Date();
  const todayDateString = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;
  const availableAppointmentSlots = appointmentDutySlots.filter((slot) =>
    aptDate >= todayDateString && !isAppointmentSlotBlocked(slot) && !isAppointmentSlotBooked(slot)
  );

  useEffect(() => {
    if (isScheduleAptOpen && !availableAppointmentSlots.includes(aptTime)) {
      setAptTime(availableAppointmentSlots[0] || '');
    }
  }, [isScheduleAptOpen, aptDate, aptDoctorId, aptTime, availableAppointmentSlots.join('|')]);

  // Extract raw vitals array safely
  const rawVitalsList: Vitals[] = useMemo(() => {
    if (Array.isArray(patient.vitals) && patient.vitals.length > 0) {
      return patient.vitals;
    }
    return [];
  }, [patient.vitals]);

  // Plot recorded measurements only; never create synthetic clinical observations.
  const trendsData: SyntheticVitalsPoint[] = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate = new Date(now);

    if (selectedTimeframe === 'custom') {
      startDate = new Date(`${customStartDate}T00:00:00`);
      endDate = new Date(`${customEndDate}T23:59:59.999`);
    } else {
      startDate = new Date(now);
      if (selectedTimeframe === '6m') startDate.setMonth(startDate.getMonth() - 6);
      else startDate.setFullYear(startDate.getFullYear() - 1);
    }

    return [...rawVitalsList]
      .filter((vital) => {
        const recordedAt = new Date(vital.recordedAt).getTime();
        return Number.isFinite(recordedAt) && recordedAt >= startDate.getTime() && recordedAt <= endDate.getTime();
      })
      .sort((first, second) => new Date(first.recordedAt).getTime() - new Date(second.recordedAt).getTime())
      .map((vital) => ({
        ...vital,
        label: new Date(vital.recordedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: selectedTimeframe === '1y' || selectedTimeframe === 'custom' ? '2-digit' : undefined,
        }),
      }));
  }, [rawVitalsList, selectedTimeframe, customStartDate, customEndDate]);

  // Current latest vital signs
  const currentVitals = [...rawVitalsList].sort(
    (first, second) => new Date(second.recordedAt).getTime() - new Date(first.recordedAt).getTime()
  )[0] || {
    bloodPressureSys: 120,
    bloodPressureDia: 80,
    heartRate: 72,
    spO2: 98,
    temperature: 98.6,
    respiratoryRate: 16,
  };
  const hasRecordedVitals = rawVitalsList.length > 0;

  // Associated upcoming appointments
  const patientAppointments = useMemo(() => {
    return appointments
      .filter((a) => a.patientId === patient.id)
      .sort((a, b) => new Date(`${a.date} ${a.timeSlot}`).getTime() - new Date(`${b.date} ${b.timeSlot}`).getTime());
  }, [appointments, patient.id]);

  const upcomingAppointments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return patientAppointments.filter((appointment) =>
      appointment.date >= today && appointment.status !== 'Completed' && appointment.status !== 'Cancelled' && appointment.status !== 'No-Show'
    );
  }, [patientAppointments]);

  // Lab Results
  const patientLabs = useMemo(() => {
    return Array.isArray(patient.labResults) ? patient.labResults : [];
  }, [patient.labResults]);

  const filteredLabs = useMemo(() => {
    return [...patientLabs].filter((lab) => {
      const matchesStatus = labStatusFilter === 'all' || lab.status === labStatusFilter;
      const matchesCategory = labCategoryFilter === 'all' || lab.category === labCategoryFilter;
      return matchesStatus && matchesCategory;
    }).sort((first, second) =>
      (second.resultDate || second.orderedDate).localeCompare(first.resultDate || first.orderedDate)
    );
  }, [patientLabs, labStatusFilter, labCategoryFilter]);

  // Lab status summary counts
  const labCounts = useMemo(() => {
    return {
      total: patientLabs.length,
      normal: patientLabs.filter((l) => l.status === 'Normal').length,
      elevated: patientLabs.filter((l) => l.status === 'Elevated').length,
      critical: patientLabs.filter((l) => l.status === 'Critical').length,
      pending: patientLabs.filter((l) => l.status === 'Pending').length,
    };
  }, [patientLabs]);

  // Helper for Blood Pressure classification
  const getBpCategory = (sys: number, dia: number) => {
    if (sys >= 140 || dia >= 90) return { label: 'Stage 2 HTN', color: 'text-rose-700 bg-rose-50 border-rose-200' };
    if (sys >= 130 || dia >= 80) return { label: 'Stage 1 HTN', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    if (sys >= 120 && dia < 80) return { label: 'Elevated BP', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' };
    if (sys < 90 || dia < 60) return { label: 'Hypotension', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    return { label: 'Optimal Normal', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  };

  // Helper for Heart Rate classification
  const getHrCategory = (hr: number) => {
    if (hr > 100) return { label: 'Tachycardia', color: 'text-rose-700 bg-rose-50 border-rose-200' };
    if (hr < 60) return { label: 'Bradycardia', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: 'Normal Sinus', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  };

  // Chart configuration for selected metric
  const chartConfig = useMemo(() => {
    switch (selectedMetric) {
      case 'bp':
        return {
          title: 'Blood Pressure Trend (Sys / Dia)',
          unit: 'mmHg',
          colorSys: '#2563eb', // Blue
          colorDia: '#0ea5e9', // Sky
          normalMin: 90,
          normalMax: 120,
          yMin: 50,
          yMax: 170,
          getter: (p: SyntheticVitalsPoint) => p.bloodPressureSys,
          secondaryGetter: (p: SyntheticVitalsPoint) => p.bloodPressureDia,
        };
      case 'heartRate':
        return {
          title: 'Heart Rate Telemetry',
          unit: 'BPM',
          colorSys: '#e11d48', // Rose
          normalMin: 60,
          normalMax: 100,
          yMin: 40,
          yMax: 130,
          getter: (p: SyntheticVitalsPoint) => p.heartRate,
        };
      case 'spO2':
        return {
          title: 'Pulse Oximetry Oxygen Saturation',
          unit: '%',
          colorSys: '#0284c7', // Sky
          normalMin: 95,
          normalMax: 100,
          yMin: 88,
          yMax: 100,
          getter: (p: SyntheticVitalsPoint) => p.spO2,
        };
      case 'temperature':
        return {
          title: 'Core Body Temperature',
          unit: '°F',
          colorSys: '#d97706', // Amber
          normalMin: 97.0,
          normalMax: 99.0,
          yMin: 96.0,
          yMax: 103.0,
          getter: (p: SyntheticVitalsPoint) => p.temperature,
        };
      case 'respiratoryRate':
        return {
          title: 'Respiratory Rate',
          unit: 'breaths/min',
          colorSys: '#10b981', // Emerald
          normalMin: 12,
          normalMax: 20,
          yMin: 8,
          yMax: 28,
          getter: (p: SyntheticVitalsPoint) => p.respiratoryRate,
        };
    }
  }, [selectedMetric]);

  // Statistics calculation for the current metric
  const metricStats = useMemo(() => {
    const values: number[] = trendsData.map((d) => Number(chartConfig.getter(d)) || 0);
    const latestVal = values[values.length - 1] || 0;
    const prevVal = values.length > 1 ? values[values.length - 2] : latestVal;
    const diff = Number((latestVal - prevVal).toFixed(1));
    const minVal = values.length > 0 ? Math.min(...values) : 0;
    const maxVal = values.length > 0 ? Math.max(...values) : 0;
    const sum = values.reduce((s: number, v: number) => s + v, 0);
    const avgVal = values.length > 0 ? Number((sum / values.length).toFixed(1)) : 0;

    return { latestVal, diff, minVal, maxVal, avgVal };
  }, [trendsData, chartConfig]);

  // Handle Record Vitals submission
  const handleSaveVitals = (e: React.FormEvent) => {
    e.preventDefault();
    addVitals(patient.id, {
      bloodPressureSys: Number(newSys),
      bloodPressureDia: Number(newDia),
      heartRate: Number(newHr),
      spO2: Number(newSpo2),
      temperature: Number(newTemp),
      respiratoryRate: Number(newRr),
      bloodGlucose: newGlucose ? Number(newGlucose) : undefined,
    });
    setIsRecordVitalsOpen(false);
  };

  // Handle Order Lab Test submission
  const handleSaveLab = (e: React.FormEvent) => {
    e.preventDefault();
    const todayStr = new Date().toISOString().split('T')[0];
    addLabResult(patient.id, {
      testName: labTestName,
      category: labCategory,
      orderedDate: todayStr,
      status: 'Pending',
      value: 'In Laboratory Processing',
      referenceRange: 'Processing Specimen',
      orderedBy: labDoctor,
      notes: labNotes ? `${labPriority} order: ${labNotes}` : `${labPriority} order requested.`,
    });
    setIsOrderLabOpen(false);
    setLabNotes('');
  };

  // Handle Schedule Appointment submission
  const handleSaveAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedDoc = doctors.find((d) => d.id === aptDoctorId);
    if (!selectedDoc || !availableAppointmentSlots.includes(aptTime)) {
      addNotification('Appointment Slot Unavailable', 'Select an open slot from the selected doctor’s published schedule.', 'warning', patient.id);
      return;
    }
    addAppointment({
      patientId: patient.id,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientAge: patient.age,
      patientGender: patient.gender,
      doctorId: selectedDoc.id,
      doctorName: selectedDoc.name,
      department: selectedDoc.department,
      roomNumber: selectedDoc.roomNumber,
      date: aptDate,
      timeSlot: aptTime,
      type: aptType,
      priority: 'Normal',
      reason: aptReason,
      notes: aptRemarks.trim() || undefined,
      status: 'Scheduled',
    });
    setAptRemarks('');
    setIsScheduleAptOpen(false);
  };

  // SVG Chart Geometry Calculations
  const chartWidth = 640;
  const chartHeight = 180;
  const paddingX = 45;
  const paddingY = 25;
  const innerW = chartWidth - paddingX * 2;
  const innerH = chartHeight - paddingY * 2;

  const points = useMemo(() => {
    const total = trendsData.length;
    return trendsData.map((pt, idx) => {
      const x = paddingX + (idx / Math.max(1, total - 1)) * innerW;
      const val = chartConfig.getter(pt);
      const clampedVal = Math.max(chartConfig.yMin, Math.min(chartConfig.yMax, val));
      const normalizedY = (clampedVal - chartConfig.yMin) / (chartConfig.yMax - chartConfig.yMin);
      const y = chartHeight - paddingY - normalizedY * innerH;

      let diaY: number | undefined;
      if (chartConfig.secondaryGetter) {
        const dVal = chartConfig.secondaryGetter(pt);
        const clampedD = Math.max(chartConfig.yMin, Math.min(chartConfig.yMax, dVal));
        const normD = (clampedD - chartConfig.yMin) / (chartConfig.yMax - chartConfig.yMin);
        diaY = chartHeight - paddingY - normD * innerH;
      }

      return { x, y, diaY, val, pt, label: pt.label };
    });
  }, [trendsData, chartConfig, innerW, innerH]);

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const firstX = points[0].x.toFixed(1);
    const lastX = points[points.length - 1].x.toFixed(1);
    const bottomY = (chartHeight - paddingY).toFixed(1);
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [points, linePath, chartHeight]);

  const secondaryLinePath = useMemo(() => {
    if (!chartConfig.secondaryGetter || points.length === 0) return '';
    return points.reduce(
      (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${(p.diaY ?? p.y).toFixed(1)}`,
      ''
    );
  }, [points, chartConfig]);

  // Normal Zone background rectangle
  const normalZoneYTop = chartHeight - paddingY - ((chartConfig.normalMax - chartConfig.yMin) / (chartConfig.yMax - chartConfig.yMin)) * innerH;
  const normalZoneYBottom = chartHeight - paddingY - ((chartConfig.normalMin - chartConfig.yMin) / (chartConfig.yMax - chartConfig.yMin)) * innerH;
  const normalZoneHeight = Math.max(0, normalZoneYBottom - normalZoneYTop);

  return (
    <div className="space-y-4">
      {/* 1. CLINICAL HEADER SUMMARY STRIP */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <PatientAvatar patientId={patient.id} name={`${patient.firstName} ${patient.lastName}`} gender={patient.gender} imageUrl={patient.photo || patient.avatar} size="lg" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">
                  {patient.firstName} {patient.lastName}
                </h3>
                <span className="font-mono text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded font-bold">
                  {patient.id}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    patient.status === 'Emergency'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : patient.status === 'Inpatient'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {patient.status}
                </span>
                {patient.wardOrRoom && (
                  <span className="text-[11px] text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded">
                    Room: {patient.wardOrRoom}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {patient.age} years old · {patient.gender} · DOB: {patient.dob} · Attending: <span className="font-semibold text-slate-700">{patient.primaryPhysicianName || 'Dr. Sarah Jenkins, MD'}</span>
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
            {onOpenTriageModal && (
              <button
                type="button"
                onClick={() => onOpenTriageModal(patient.id)}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Triage</span>
              </button>
            )}

            <label className="sr-only" htmlFor="patient-overview-status">Patient status</label>
            <select
              id="patient-overview-status"
              aria-label="Update patient status"
              value={patient.status}
              onChange={(event) => updatePatientStatus(patient.id, event.target.value as Patient['status'])}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700"
            >
              <option value="Outpatient">Outpatient</option>
              <option value="Inpatient">Inpatient</option>
              <option value="Emergency">Emergency</option>
              <option value="Discharged">Discharged</option>
            </select>

            <button
              onClick={() => setIsScheduleAptOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Schedule Visit</span>
            </button>

            {onStartTelehealth && (
              <button
                onClick={() => onStartTelehealth(patient.id)}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Initiate HIPAA Telehealth Video Room"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Telehealth</span>
              </button>
            )}
          </div>
        </div>

        {/* Clinical Safety Banner: Allergies & Chronic Conditions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1 shrink-0">
              <ShieldAlert className="w-3 h-3 text-rose-600" /> Allergies:
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {patient.allergies && patient.allergies.length > 0 ? (
                patient.allergies.map((a, i) => {
                  const label = typeof a === 'string' ? a : `${a.allergen} (${a.severity})`;
                  return (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded text-[11px] font-semibold"
                    >
                      {label}
                    </span>
                  );
                })
              ) : (
                <span className="text-slate-400 italic text-[11px]">No Known Drug Allergies (NKDA)</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto md:justify-end">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0">
              <Activity className="w-3 h-3 text-blue-600" /> Chronic Risk:
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {patient.chronicConditions && patient.chronicConditions.length > 0 ? (
                patient.chronicConditions.map((c, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-medium"
                  >
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-slate-400 italic text-[11px]">No documented chronic illnesses</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. REAL-TIME VITALS TELEMETRY TILES */}
      {hasRecordedVitals ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Blood Pressure Tile */}
        <div
          onClick={() => setSelectedMetric('bp')}
          className={`p-3 bg-white rounded-xl border transition cursor-pointer ${
            selectedMetric === 'bp'
              ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 text-blue-600">
              <Activity className="w-3.5 h-3.5" /> Blood Pressure
            </span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                getBpCategory(currentVitals.bloodPressureSys, currentVitals.bloodPressureDia).color
              }`}
            >
              {getBpCategory(currentVitals.bloodPressureSys, currentVitals.bloodPressureDia).label}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-slate-900">
              {currentVitals.bloodPressureSys}/{currentVitals.bloodPressureDia}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">mmHg</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Target: &lt;120/80</span>
            <span className="text-blue-600 font-semibold text-[9px]">Tap to plot</span>
          </div>
        </div>

        {/* Pulse / Heart Rate Tile */}
        <div
          onClick={() => setSelectedMetric('heartRate')}
          className={`p-3 bg-white rounded-xl border transition cursor-pointer ${
            selectedMetric === 'heartRate'
              ? 'border-rose-500 ring-2 ring-rose-100 shadow-sm'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 text-rose-600">
              <Heart className="w-3.5 h-3.5" /> Heart Rate
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getHrCategory(currentVitals.heartRate).color}`}>
              {getHrCategory(currentVitals.heartRate).label}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-slate-900">
              {currentVitals.heartRate}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">BPM</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Norm: 60 - 100</span>
            <span className="text-rose-600 font-semibold text-[9px]">Tap to plot</span>
          </div>
        </div>

        {/* SpO2 Oxygen Tile */}
        <div
          onClick={() => setSelectedMetric('spO2')}
          className={`p-3 bg-white rounded-xl border transition cursor-pointer ${
            selectedMetric === 'spO2'
              ? 'border-sky-500 ring-2 ring-sky-100 shadow-sm'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 text-sky-600">
              <Wind className="w-3.5 h-3.5" /> Oxygen SpO2
            </span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                currentVitals.spO2 >= 95
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : currentVitals.spO2 >= 92
                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                  : 'text-rose-700 bg-rose-50 border-rose-200'
              }`}
            >
              {currentVitals.spO2 >= 95 ? 'Adequate' : currentVitals.spO2 >= 92 ? 'Borderline' : 'Hypoxia'}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-slate-900">
              {currentVitals.spO2}%
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Norm: &gt;= 95%</span>
            <span className="text-sky-600 font-semibold text-[9px]">Tap to plot</span>
          </div>
        </div>

        {/* Temperature Tile */}
        <div
          onClick={() => setSelectedMetric('temperature')}
          className={`p-3 bg-white rounded-xl border transition cursor-pointer ${
            selectedMetric === 'temperature'
              ? 'border-amber-500 ring-2 ring-amber-100 shadow-sm'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 text-amber-600">
              <Thermometer className="w-3.5 h-3.5" /> Body Temp
            </span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                currentVitals.temperature > 100.4
                  ? 'text-rose-700 bg-rose-50 border-rose-200'
                  : currentVitals.temperature > 99.0
                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                  : 'text-emerald-700 bg-emerald-50 border-emerald-200'
              }`}
            >
              {currentVitals.temperature > 100.4 ? 'Febrile' : currentVitals.temperature > 99.0 ? 'Elevated' : 'Normothermic'}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-slate-900">
              {currentVitals.temperature}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">°F</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Norm: 97.0 - 99.0</span>
            <span className="text-amber-600 font-semibold text-[9px]">Tap to plot</span>
          </div>
        </div>

        {/* Respiratory Rate Tile */}
        <div
          onClick={() => setSelectedMetric('respiratoryRate')}
          className={`p-3 bg-white rounded-xl border transition cursor-pointer col-span-2 sm:col-span-1 ${
            selectedMetric === 'respiratoryRate'
              ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-sm'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 text-emerald-600">
              <Clock className="w-3.5 h-3.5" /> Resp. Rate
            </span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                currentVitals.respiratoryRate >= 12 && currentVitals.respiratoryRate <= 20
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-amber-700 bg-amber-50 border-amber-200'
              }`}
            >
              {currentVitals.respiratoryRate >= 12 && currentVitals.respiratoryRate <= 20 ? 'Eupnea' : 'Abnormal'}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-slate-900">
              {currentVitals.respiratoryRate}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">/min</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Norm: 12 - 20</span>
            <span className="text-emerald-600 font-semibold text-[9px]">Tap to plot</span>
          </div>
        </div>
      </div> : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No vital signs have been recorded for this patient.
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h4 className="text-sm font-bold text-slate-900">Contact &amp; insurance details</h4>
          <p className="mt-0.5 text-[11px] text-slate-500">Additional patient contact and coverage information</p>
        </div>
        <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
          <div className="p-4">
            <h5 className="mb-2 text-[10px] font-bold uppercase text-slate-500">Contact details</h5>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div><dt className="text-slate-500">Phone</dt><dd className="font-semibold text-slate-900">{patient.phone || 'Not recorded'}</dd></div>
              <div><dt className="text-slate-500">Blood group</dt><dd className="font-semibold text-slate-900">{patient.bloodGroup || 'Unknown'}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Email</dt><dd className="break-all font-semibold text-slate-900">{patient.email || 'Not recorded'}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Address</dt><dd className="font-semibold text-slate-900">{patient.address || 'Not recorded'}</dd></div>
            </dl>
          </div>

          <div className="p-4">
            <h5 className="mb-2 text-[10px] font-bold uppercase text-slate-500">Insurance coverage</h5>
            {patient.insurance?.provider ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div><dt className="text-slate-500">Payer</dt><dd className="font-semibold text-slate-900">{patient.insurance.provider}</dd></div>
                <div><dt className="text-slate-500">Status</dt><dd className="font-semibold text-slate-900">{patient.insurance.status || 'Not verified'}</dd></div>
                <div><dt className="text-slate-500">Policy no.</dt><dd className="font-semibold text-slate-900">{patient.insurance.policyNumber || 'Not recorded'}</dd></div>
                <div><dt className="text-slate-500">Member ID</dt><dd className="font-semibold text-slate-900">{patient.insurance.memberId || patient.insurance.dhaMemberId || 'Not recorded'}</dd></div>
                <div><dt className="text-slate-500">Network</dt><dd className="font-semibold text-slate-900">{patient.insurance.network || 'Not recorded'}</dd></div>
                <div><dt className="text-slate-500">Plan</dt><dd className="font-semibold text-slate-900">{patient.insurance.planName || 'Not recorded'}</dd></div>
                <div className="col-span-2"><dt className="text-slate-500">Coverage expiry</dt><dd className="font-semibold text-slate-900">{patient.insurance.expiryDate || 'Not recorded'}</dd></div>
              </dl>
            ) : (
              <p className="text-xs text-slate-500">No insurance policy recorded. Patient is marked as self-pay.</p>
            )}
          </div>
        </div>
      </section>

      {/* 2.5. LAB DIAGNOSTICS & BIOMARKER TELEMETRY CHART */}
      <PatientLabDiagnosticsChart
        patient={patient}
        onOrderLabTest={() => setIsOrderLabOpen(true)}
        onNavigateToReports={onNavigateToReports}
      />

      {/* 3. HEALTH TRENDS INTERACTIVE TELEMETRY MODULE */}
      <details className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-slate-900 marker:text-teal-700">
          Health Trends Telemetry &amp; Longitudinal Vitals
          <span className="ml-2 text-[11px] font-normal text-slate-500">{trendsData.length} readings · open chart and filters</span>
        </summary>
        <div className="space-y-3 border-t border-slate-100 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h4 className="font-bold text-sm text-slate-900">Vitals trend chart</h4>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Recorded measurements only. No readings are generated or estimated.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="vitals-range">Vitals date range</label>
            <select
              id="vitals-range"
              value={selectedTimeframe}
              onChange={(event) => setSelectedTimeframe(event.target.value as TimeframeOption)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
            >
              <option value="6m">Last 6 months</option>
              <option value="1y">Last year</option>
              <option value="custom">Custom dates</option>
            </select>
            {selectedTimeframe === 'custom' && (
              <div className="flex items-center gap-1.5">
                <label className="sr-only" htmlFor="vitals-start-date">Start date</label>
                <input
                  id="vitals-start-date"
                  type="date"
                  value={customStartDate}
                  max={customEndDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
                />
                <span className="text-xs text-slate-500">to</span>
                <label className="sr-only" htmlFor="vitals-end-date">End date</label>
                <input
                  id="vitals-end-date"
                  type="date"
                  value={customEndDate}
                  min={customStartDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
                />
              </div>
            )}
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-stretch sm:self-auto overflow-x-auto">
            {(
              [
                { id: 'bp', label: 'Blood Pressure' },
                { id: 'heartRate', label: 'Heart Rate' },
                { id: 'spO2', label: 'SpO2' },
                { id: 'temperature', label: 'Temp' },
                { id: 'respiratoryRate', label: 'Resp Rate' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMetric(m.id)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedMetric === m.id
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Trend Metric Statistics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Rolling Average</span>
            <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
              {trendsData.length ? <>{metricStats.avgVal} <span className="text-xs font-normal text-slate-500">{chartConfig.unit}</span></> : 'No data'}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Observed Range (Min - Max)</span>
            <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
              {trendsData.length ? <>{metricStats.minVal} - {metricStats.maxVal} <span className="text-xs font-normal text-slate-500">{chartConfig.unit}</span></> : 'No data'}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Clinical Target</span>
            <div className="text-base font-bold font-mono text-emerald-700 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {chartConfig.normalMin} - {chartConfig.normalMax} {chartConfig.unit}
              </span>
            </div>
          </div>
        </div>

        {/* SVG Sparkline / Trend Graph */}
        <div className="relative border border-slate-200 rounded-lg p-3 bg-white overflow-hidden">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
            <span className="font-semibold text-slate-700">{chartConfig.title}</span>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-300 inline-block" />
                <span>Normal Band ({chartConfig.normalMin} - {chartConfig.normalMax})</span>
              </span>
              {selectedMetric === 'bp' ? (
                <>
                  <span className="flex items-center gap-1 text-blue-600 font-bold">
                    <span className="w-3 h-0.5 bg-blue-600 inline-block" /> Systolic
                  </span>
                  <span className="flex items-center gap-1 text-sky-500 font-bold">
                    <span className="w-3 h-0.5 bg-sky-500 inline-block" /> Diastolic
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1 text-blue-600 font-bold">
                  <span className="w-3 h-0.5 bg-blue-600 inline-block" /> Measured Trend
                </span>
              )}
            </div>
          </div>

          {trendsData.length ? <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-44 select-none"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartConfig.colorSys} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={chartConfig.colorSys} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Shaded Target Normal Zone */}
              <rect
                x={paddingX}
                y={normalZoneYTop}
                width={innerW}
                height={normalZoneHeight}
                fill="#ecfdf5"
                opacity="0.8"
                stroke="#a7f3d0"
                strokeDasharray="3,3"
                strokeWidth="0.8"
              />

              {/* Horizontal Gridlines and Y-axis Labels */}
              {[chartConfig.yMin, Math.round((chartConfig.yMin + chartConfig.yMax) / 2), chartConfig.yMax].map((tick) => {
                const tickY = chartHeight - paddingY - ((tick - chartConfig.yMin) / (chartConfig.yMax - chartConfig.yMin)) * innerH;
                return (
                  <g key={tick}>
                    <line
                      x1={paddingX}
                      y1={tickY}
                      x2={chartWidth - paddingX}
                      y2={tickY}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                    />
                    <text
                      x={paddingX - 8}
                      y={tickY + 3}
                      textAnchor="end"
                      fontSize="9"
                      fill="#94a3b8"
                      fontFamily="monospace"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* Area Fill */}
              <path d={areaPath} fill="url(#trendAreaGradient)" />

              {/* Secondary Line (Diastolic for BP) */}
              {chartConfig.secondaryGetter && (
                <path
                  d={secondaryLinePath}
                  fill="none"
                  stroke={chartConfig.colorDia}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Main Trend Line */}
              <path
                d={linePath}
                fill="none"
                stroke={chartConfig.colorSys}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data Points and Interaction Circles */}
              {points.map((p, idx) => {
                const isHovered = hoveredPointIndex === idx;
                return (
                  <g key={idx}>
                    {/* Systolic or Main Point */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 5.5 : 3.5}
                      fill="#ffffff"
                      stroke={chartConfig.colorSys}
                      strokeWidth={isHovered ? 2.5 : 2}
                      className="transition-all cursor-pointer"
                      onMouseEnter={() => setHoveredPointIndex(idx)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                    />

                    {/* Diastolic Point if BP */}
                    {p.diaY !== undefined && (
                      <circle
                        cx={p.x}
                        cy={p.diaY}
                        r={isHovered ? 5 : 3}
                        fill="#ffffff"
                        stroke={chartConfig.colorDia}
                        strokeWidth={isHovered ? 2 : 1.5}
                        className="transition-all cursor-pointer"
                        onMouseEnter={() => setHoveredPointIndex(idx)}
                        onMouseLeave={() => setHoveredPointIndex(null)}
                      />
                    )}

                    {/* X-axis date labels */}
                    <text
                      x={p.x}
                      y={chartHeight - 8}
                      textAnchor="middle"
                      fontSize="9"
                      fill={isHovered ? '#1e293b' : '#94a3b8'}
                      fontWeight={isHovered ? 'bold' : 'normal'}
                    >
                      {p.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div> : (
            <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">
              No recorded vitals in this date range.
            </div>
          )}

          {/* Tooltip Card for Active / Hovered Point */}
          {hoveredPointIndex !== null && points[hoveredPointIndex] && (
            <div className="absolute top-4 right-4 bg-slate-900 text-white rounded-lg p-2.5 shadow-lg text-xs space-y-1 z-10 font-sans border border-slate-700 animate-fadeIn">
              <div className="font-bold text-[11px] text-slate-300">
                {points[hoveredPointIndex].pt.label}
              </div>
              <div className="font-mono text-sm font-bold text-white flex items-center gap-1.5">
                {selectedMetric === 'bp' ? (
                  <span>
                    BP: {points[hoveredPointIndex].pt.bloodPressureSys}/{points[hoveredPointIndex].pt.bloodPressureDia} mmHg
                  </span>
                ) : (
                  <span>
                    {chartConfig.title}: {chartConfig.getter(points[hoveredPointIndex].pt)} {chartConfig.unit}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400">
                Pulse: {points[hoveredPointIndex].pt.heartRate} bpm · SpO2: {points[hoveredPointIndex].pt.spO2}%
              </div>
            </div>
          )}
        </div>
        </div>
      </details>

      {/* UPCOMING APPOINTMENTS & CLINICAL ENCOUNTERS */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-sm text-slate-900">
                  Upcoming Encounters ({upcomingAppointments.length})
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Scheduled consultations, procedures, & follow-ups.
              </p>
            </div>

            <button
              onClick={() => setIsScheduleAptOpen(true)}
              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded text-xs font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Book</span>
            </button>
          </div>

          {/* Upcoming Appointments List */}
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {upcomingAppointments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg">
                <Calendar className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                <p className="font-semibold">No upcoming appointments scheduled.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Book a specialty consultation or routine follow-up check.
                </p>
                <button
                  onClick={() => setIsScheduleAptOpen(true)}
                  className="mt-2.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Schedule Appointment</span>
                </button>
              </div>
            ) : (
              upcomingAppointments.map((apt) => {
                const isCheckedIn = apt.status === 'Checked-In';
                const isInConsultation = apt.status === 'In Consultation';

                return (
                  <div
                    key={apt.id}
                    className={`p-3 rounded-lg border transition space-y-2 ${
                      isInConsultation
                        ? 'bg-amber-50/70 border-amber-200'
                        : isCheckedIn
                        ? 'bg-blue-50/70 border-blue-200'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-slate-900">{apt.type}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              apt.priority === 'Emergency'
                                ? 'bg-rose-100 text-rose-800'
                                : apt.priority === 'Urgent'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {apt.priority}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          With <span className="font-semibold text-slate-800">{apt.doctorName}</span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                          isInConsultation
                            ? 'bg-amber-600 text-white border-amber-700'
                            : isCheckedIn
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-slate-200 text-slate-800 border-slate-300'
                        }`}
                      >
                        {apt.status}
                      </span>
                    </div>

                    <div className="bg-white/80 rounded p-2 border border-slate-200/60 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span className="flex items-center gap-1 font-semibold text-slate-800">
                          <Clock className="w-3 h-3 text-blue-500" />
                          <span>{apt.date} at {apt.timeSlot}</span>
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">{apt.roomNumber}</span>
                      </div>
                      {apt.reason && (
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          Reason: {apt.reason}
                        </p>
                      )}
                      {apt.notes && (
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          Remarks: {apt.notes}
                        </p>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-[10px] text-slate-400 font-mono">
                        Queue #{apt.queueNumber} · {apt.department}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {apt.isTelehealth && onStartTelehealth && (
                          <button
                            onClick={() => onStartTelehealth(patient.id)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                          >
                            <Video className="w-3 h-3" />
                            <span>Join Video</span>
                          </button>
                        )}

                        {apt.status === 'Scheduled' && (
                          <button
                            onClick={() => updateAppointmentStatus(apt.id, 'Checked-In')}
                            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>Check-In</span>
                          </button>
                        )}

                        {apt.status === 'Checked-In' && (
                          <button
                            onClick={() => updateAppointmentStatus(apt.id, 'In Consultation')}
                            className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                          >
                            <Stethoscope className="w-3 h-3" />
                            <span>Call In</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: RECORD VITALS */}
      {isRecordVitalsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Record Vital Signs</h3>
                  <p className="text-[11px] text-slate-500">Telemetry sync for {patient.firstName} {patient.lastName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsRecordVitalsOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVitals} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Blood Pressure Systolic (mmHg)</label>
                  <input
                    type="number"
                    min="60"
                    max="240"
                    required
                    value={newSys}
                    onChange={(e) => setNewSys(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Diastolic (mmHg)</label>
                  <input
                    type="number"
                    min="40"
                    max="160"
                    required
                    value={newDia}
                    onChange={(e) => setNewDia(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Heart Rate (BPM)</label>
                  <input
                    type="number"
                    min="30"
                    max="220"
                    required
                    value={newHr}
                    onChange={(e) => setNewHr(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Oxygen Saturation SpO2 (%)</label>
                  <input
                    type="number"
                    min="70"
                    max="100"
                    required
                    value={newSpo2}
                    onChange={(e) => setNewSpo2(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Temp (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="90"
                    max="108"
                    required
                    value={newTemp}
                    onChange={(e) => setNewTemp(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Resp. Rate</label>
                  <input
                    type="number"
                    min="6"
                    max="45"
                    required
                    value={newRr}
                    onChange={(e) => setNewRr(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Glucose (mg/dL)</label>
                  <input
                    type="number"
                    min="40"
                    max="600"
                    value={newGlucose || ''}
                    onChange={(e) => setNewGlucose(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRecordVitalsOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded font-semibold text-xs cursor-pointer hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Send className="w-3 h-3" /> Commit Vitals Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ORDER LAB TEST */}
      {isOrderLabOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Order Diagnostic Lab Panel</h3>
                  <p className="text-[11px] text-slate-500">For {patient.firstName} {patient.lastName} ({patient.id})</p>
                </div>
              </div>
              <button
                onClick={() => setIsOrderLabOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLab} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Diagnostic Test Name</label>
                <select
                  value={labTestName}
                  onChange={(e) => setLabTestName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-medium"
                >
                  <option value="Comprehensive Metabolic Panel (CMP-14)">Comprehensive Metabolic Panel (CMP-14)</option>
                  <option value="Complete Blood Count (CBC) with Differential">Complete Blood Count (CBC) with Differential</option>
                  <option value="Lipid Panel - Total, HDL, LDL, Triglycerides">Lipid Panel - Total, HDL, LDL, Triglycerides</option>
                  <option value="Cardiac Troponin I (High Sensitivity STAT)">Cardiac Troponin I (High Sensitivity STAT)</option>
                  <option value="Hemoglobin A1c (HbA1c)">Hemoglobin A1c (HbA1c)</option>
                  <option value="Serum Electrolytes (Na, K, Cl, CO2)">Serum Electrolytes (Na, K, Cl, CO2)</option>
                  <option value="Coagulation PT/INR Screening">Coagulation PT/INR Screening</option>
                  <option value="Thyroid Stimulating Hormone (TSH) with Reflex FT4">Thyroid Stimulating Hormone (TSH) with Reflex FT4</option>
                  <option value="Urinalysis Complete with Microscopic Exam">Urinalysis Complete with Microscopic Exam</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Laboratory Specialty</label>
                  <select
                    value={labCategory}
                    onChange={(e) => setLabCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-medium"
                  >
                    <option value="Biochemistry">Biochemistry</option>
                    <option value="Hematology">Hematology</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Pathology">Pathology</option>
                    <option value="Radiology">Radiology</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Order Priority</label>
                  <select
                    value={labPriority}
                    onChange={(e) => setLabPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-medium"
                  >
                    <option value="Routine">Routine (Same Day)</option>
                    <option value="STAT Urgent">STAT Urgent (&lt; 30m)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Ordering Physician</label>
                <input
                  type="text"
                  required
                  value={labDoctor}
                  onChange={(e) => setLabDoctor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Clinical Indication & Specimen Notes</label>
                <textarea
                  rows={2}
                  value={labNotes}
                  onChange={(e) => setLabNotes(e.target.value)}
                  placeholder="e.g. Evaluate medication efficacy, fasting protocol confirmed..."
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOrderLabOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded font-semibold text-xs cursor-pointer hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Send className="w-3 h-3" /> Transmit Lab Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SCHEDULE ENCOUNTER / APPOINTMENT */}
      {isScheduleAptOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Schedule Clinical Encounter</h3>
                  <p className="text-[11px] text-slate-500">Book visit for {patient.firstName} {patient.lastName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsScheduleAptOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAppointment} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Appointment Date</label>
                  <input
                    type="date"
                    required
                    min={todayDateString}
                    value={aptDate}
                    onChange={(e) => setAptDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Time Slot</label>
                  <select
                    required
                    disabled={!availableAppointmentSlots.length}
                    value={aptTime}
                    onChange={(e) => setAptTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-mono font-medium"
                  >
                    <option value="">Select available slot</option>
                    {availableAppointmentSlots.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                  {!availableAppointmentSlots.length && (
                    <p className="mt-1 text-[10px] text-amber-700">
                      {appointmentDutyWindow.isOnDuty ? 'No open slots for this doctor on this date.' : 'Doctor is not scheduled on this date.'}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Attending Physician / Specialist</label>
                <select
                  value={aptDoctorId}
                  onChange={(e) => setAptDoctorId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-medium"
                >
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} · {doc.specialty} ({doc.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Encounter Classification</label>
                <select
                  value={aptType}
                  onChange={(e) => setAptType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs font-medium"
                >
                  <option value="Follow-up Specialist Review">Follow-up Specialist Review</option>
                  <option value="General Consultation">General Consultation</option>
                  <option value="Telehealth Consultation">Telehealth Consultation</option>
                  <option value="Lab & Imaging Review">Lab & Imaging Review</option>
                  <option value="Post-Operative Evaluation">Post-Operative Evaluation</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Clinical Purpose / Chief Reason</label>
                <textarea
                  rows={2}
                  required
                  value={aptReason}
                  onChange={(e) => setAptReason(e.target.value)}
                  placeholder="Document reason for booking, symptoms to evaluate..."
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Appointment Remarks (optional)</label>
                <textarea
                  rows={2}
                  value={aptRemarks}
                  onChange={(e) => setAptRemarks(e.target.value)}
                  placeholder="Add instructions or notes for the appointment."
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsScheduleAptOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded font-semibold text-xs cursor-pointer hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!availableAppointmentSlots.includes(aptTime)}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 text-white rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Calendar className="w-3 h-3" /> Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
