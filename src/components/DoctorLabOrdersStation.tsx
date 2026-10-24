import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  Search,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Filter,
  Tag,
  Printer,
  FileText,
  Check,
  X,
  ChevronRight,
  Activity,
  Layers,
  RefreshCw,
  AlertTriangle,
  Beaker,
  Stethoscope,
  Barcode,
  ExternalLink,
  LineChart,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { PatientAvatar } from './PatientAvatar';
import { Patient, ReceptionToken } from '../types';
import { canExecuteDiagnosticLineItem, getEffectiveLineItemStatus } from '../utils/tokenStateMachine';

type DateFilterOption = 'today' | 'yesterday' | 'week' | 'all' | 'custom';
type StatusFilterOption = 'all' | 'pending' | 'collected' | 'completed';
type UrgencyFilterOption = 'all' | 'urgent' | 'routine';

interface LabOrderCardData {
  tokenId: string;
  tokenNumber: string;
  patientId: string;
  patientName: string;
  patientRegistrationNo: string;
  patientGender?: string;
  patientAge?: number;
  patientPhoto?: string;
  doctorName: string;
  doctorDepartment: string;
  counterOrRoom?: string;
  orderDate: string;
  orderTime: string;
  priority: 'Urgent' | 'Normal';
  chiefComplaint?: string;
  clinicalAssessment?: string;
  diagnoses?: Array<{ code: string; description: string }>;
  labRequests: Array<{
    id: string;
    testName: string;
    category: string;
    cptCode?: string;
    price: number;
    status: 'Ordered' | 'Sample Collected' | 'Completed';
    authorizationStatus: string;
    authorizedForExecution: boolean;
  }>;
  diagnosticReports?: Array<{
    testOrStudyName: string;
    resultValue?: string;
    status: 'Normal' | 'Elevated' | 'Critical' | 'Completed';
    referenceRange?: string;
    completedAt?: string;
    technicianOrRadiologist?: string;
  }>;
}

export const DoctorLabOrdersStation: React.FC = () => {
  const {
    patients,
    receptionTokens,
    currentUser,
    updateLabOrderStatus,
    recordLabTestResult,
    setSelectedPatientId,
    setActiveTab,
  } = useHospital();

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('today');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilterOption>('all');

  // Modals
  const [resultModalData, setResultModalData] = useState<{
    tokenId: string;
    tokenNumber: string;
    patientId: string;
    patientName: string;
    testId: string;
    testName: string;
    category: string;
  } | null>(null);

  const [resultValue, setResultValue] = useState('');
  const [resultUnit, setResultUnit] = useState('mg/dL');
  const [referenceRange, setReferenceRange] = useState('Normal range: 70 - 110 mg/dL');
  const [resultStatus, setResultStatus] = useState<'Normal' | 'Elevated' | 'Critical'>('Normal');
  const [findingsNotes, setFindingsNotes] = useState('');
  const [technicianName, setTechnicianName] = useState(currentUser?.name || 'Lab Specialist');

  const [requisitionSlipData, setRequisitionSlipData] = useState<LabOrderCardData | null>(null);

  // Today's date string YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Yesterday date string
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  // Compute aggregated list of lab orders from reception tokens and patients
  const labOrderCards: LabOrderCardData[] = useMemo(() => {
    const cards: LabOrderCardData[] = [];

    // 1. Gather orders from receptionTokens
    receptionTokens.forEach((token) => {
      const doctorLabRequests = token.doctorOrders?.labRequests || [];
      if (doctorLabRequests.length === 0) return;
      const labRequests = doctorLabRequests.map((request) => {
        const lineItem = token.lineItems?.find((item) => item.id === request.id);
        return {
          ...request,
          authorizationStatus: lineItem ? getEffectiveLineItemStatus(lineItem) : 'Pending_Auth',
          authorizedForExecution: canExecuteDiagnosticLineItem(lineItem),
        };
      });

      const patient = patients.find((p) => p.id === token.patientId);
      const regNo =
        patient?.rgNo ||
        token.patientDetails?.registrationNumber ||
        token.patientId;

      // Extract date from token visitDate, createdDate, or default to today
      const orderDate = token.visitDate || token.createdDate || todayStr;
      const orderTime = token.doctorOrders?.orderedAt || token.createdTime || '09:00 AM';

      cards.push({
        tokenId: token.id,
        tokenNumber: token.tokenNumber,
        patientId: token.patientId,
        patientName: token.patientName || (patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient'),
        patientRegistrationNo: regNo,
        patientGender: patient?.gender,
        patientAge: patient?.age,
        patientPhoto: patient?.photo || patient?.avatar,
        doctorName: token.doctorOrders?.orderedByDoctorName || token.doctorName || 'Attending Physician',
        doctorDepartment: token.department || 'Outpatient Clinic',
        counterOrRoom: token.counterOrRoom || 'Consultation Room',
        orderDate,
        orderTime,
        priority: token.priority === 'Urgent' ? 'Urgent' : 'Normal',
        chiefComplaint: token.doctorOrders?.chiefComplaint || token.visitComplaint,
        clinicalAssessment: token.doctorOrders?.clinicalAssessment,
        diagnoses: token.doctorOrders?.diagnoses,
        labRequests,
        diagnosticReports: token.diagnosticReports?.map((r) => ({
          testOrStudyName: r.testOrStudyName,
          resultValue: r.resultValue,
          status: r.status,
          referenceRange: r.referenceRange,
          completedAt: r.completedAt,
          technicianOrRadiologist: r.technicianOrRadiologist,
        })),
      });
    });

    return cards;
  }, [receptionTokens, patients, todayStr]);

  // Overall Statistics
  const stats = useMemo(() => {
    let todayOrdersCount = 0;
    let totalTestsCount = 0;
    let pendingSamplesCount = 0;
    let inLabProcessingCount = 0;
    let completedTestsCount = 0;

    labOrderCards.forEach((card) => {
      const isToday = card.orderDate === todayStr;
      if (isToday) todayOrdersCount++;

      card.labRequests.forEach((req) => {
        totalTestsCount++;
        if (req.status === 'Ordered') pendingSamplesCount++;
        else if (req.status === 'Sample Collected') inLabProcessingCount++;
        else if (req.status === 'Completed') completedTestsCount++;
      });
    });

    return {
      todayOrdersCount,
      totalTestsCount,
      pendingSamplesCount,
      inLabProcessingCount,
      completedTestsCount,
    };
  }, [labOrderCards, todayStr]);

  // Filtered Cards
  const filteredOrders = useMemo(() => {
    return labOrderCards.filter((card) => {
      // 1. Date Filter (Defaults to Today!)
      if (dateFilter === 'today') {
        if (card.orderDate !== todayStr) return false;
      } else if (dateFilter === 'yesterday') {
        if (card.orderDate !== yesterdayStr) return false;
      } else if (dateFilter === 'week') {
        const orderDateObj = new Date(card.orderDate);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (orderDateObj < sevenDaysAgo) return false;
      } else if (dateFilter === 'custom') {
        if (card.orderDate !== customDate) return false;
      }

      // 2. Search Filter (by Name, Token No, or Registration ID)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = card.patientName.toLowerCase().includes(q);
        const matchesToken = card.tokenNumber.toLowerCase().includes(q) || card.tokenId.toLowerCase().includes(q);
        const matchesRegId = card.patientRegistrationNo.toLowerCase().includes(q) || card.patientId.toLowerCase().includes(q);
        const matchesDoctor = card.doctorName.toLowerCase().includes(q);
        const matchesTest = card.labRequests.some((t) => t.testName.toLowerCase().includes(q));

        if (!matchesName && !matchesToken && !matchesRegId && !matchesDoctor && !matchesTest) {
          return false;
        }
      }

      // 3. Status Filter
      if (statusFilter === 'pending') {
        const hasPending = card.labRequests.some((t) => t.status === 'Ordered');
        if (!hasPending) return false;
      } else if (statusFilter === 'collected') {
        const hasCollected = card.labRequests.some((t) => t.status === 'Sample Collected');
        if (!hasCollected) return false;
      } else if (statusFilter === 'completed') {
        const allCompleted = card.labRequests.every((t) => t.status === 'Completed');
        if (!allCompleted) return false;
      }

      // 4. Urgency Filter
      if (urgencyFilter === 'urgent') {
        if (card.priority !== 'Urgent') return false;
      } else if (urgencyFilter === 'routine') {
        if (card.priority === 'Urgent') return false;
      }

      return true;
    });
  }, [
    labOrderCards,
    dateFilter,
    todayStr,
    yesterdayStr,
    customDate,
    searchQuery,
    statusFilter,
    urgencyFilter,
  ]);

  // Open Result Entry Modal
  const handleOpenResultModal = (card: LabOrderCardData, testId: string, testName: string, category: string) => {
    const request = card.labRequests.find((item) => item.id === testId);
    if (!request?.authorizedForExecution) return;
    setResultModalData({
      tokenId: card.tokenId,
      tokenNumber: card.tokenNumber,
      patientId: card.patientId,
      patientName: card.patientName,
      testId,
      testName,
      category,
    });

    // Provide sensible default ranges based on test
    if (/cbc|blood count/i.test(testName)) {
      setResultValue('14.2');
      setResultUnit('g/dL (Hemoglobin)');
      setReferenceRange('Male: 13.8 - 17.2 g/dL | Female: 12.1 - 15.1 g/dL');
    } else if (/troponin/i.test(testName)) {
      setResultValue('0.01');
      setResultUnit('ng/mL');
      setReferenceRange('Normal: < 0.04 ng/mL');
    } else if (/lipid|cholesterol/i.test(testName)) {
      setResultValue('184');
      setResultUnit('mg/dL (Total Cholesterol)');
      setReferenceRange('Desirable: < 200 mg/dL');
    } else if (/metabolic|glucose|sugar/i.test(testName)) {
      setResultValue('98');
      setResultUnit('mg/dL (Fasting Glucose)');
      setReferenceRange('Fasting: 70 - 99 mg/dL');
    } else {
      setResultValue('Normal');
      setResultUnit('Qualitative / Value');
      setReferenceRange('Normal / Non-Reactive');
    }

    setResultStatus('Normal');
    setFindingsNotes('Sample received in good integrity. Verified by automated lab analyzer.');
  };

  // Submit Result Entry
  const handleSubmitResult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultModalData) return;

    recordLabTestResult(resultModalData.tokenId, resultModalData.testId, {
      testName: resultModalData.testName,
      category: resultModalData.category,
      value: `${resultValue} ${resultUnit}`.trim(),
      referenceRange,
      status: resultStatus,
      findings: findingsNotes,
      technicianName,
      notes: `Entered via Lab Orders Station by ${technicianName}`,
    });

    setResultModalData(null);
  };

  // Mark all pending samples as collected on a card
  const handleCollectAllSamples = (card: LabOrderCardData) => {
    card.labRequests.forEach((req) => {
      if (req.status === 'Ordered') {
        updateLabOrderStatus(card.tokenId, req.id, 'Sample Collected', 'Specimen received in Phlebotomy');
      }
    });
  };

  return (
    <div className="space-y-5 p-4 lg:p-6 max-w-7xl mx-auto w-full">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 shadow-sm">
            <FlaskConical className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Doctor Lab Orders Station
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                Live Intake Queue
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Real-time doctor lab orders intake queue, specimen collection tracking, and diagnostic test result recording.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDateFilter('today');
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
            title="Reset Filters"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset View
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
              Today's Patients
            </span>
            <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.todayOrdersCount}
          </div>
          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
            Active patient queues
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
              Total Tests
            </span>
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.totalTestsCount}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            Doctor prescribed
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3.5 shadow-sm bg-amber-50/20 dark:bg-amber-950/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-amber-700 dark:text-amber-400">
              Pending Specimen
            </span>
            <Beaker className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">
            {stats.pendingSamplesCount}
          </div>
          <span className="text-[10px] text-amber-600 dark:text-amber-500 font-medium">
            Awaiting sample collection
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-900/50 rounded-xl p-3.5 shadow-sm bg-sky-50/20 dark:bg-sky-950/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-sky-700 dark:text-sky-400">
              In Processing
            </span>
            <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-700 dark:text-sky-400 mt-1">
            {stats.inLabProcessingCount}
          </div>
          <span className="text-[10px] text-sky-600 dark:text-sky-500 font-medium">
            Samples in analyzer
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-3.5 shadow-sm bg-emerald-50/20 dark:bg-emerald-950/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">
              Completed
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
            {stats.completedTestsCount}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium">
            Results published
          </span>
        </div>
      </div>

      {/* 3. Search and Filtering Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Multi-field search input: Name, Token No, or Registration ID */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find patient by Name, Token No. (e.g. T-101), or Registration ID / MRN (e.g. PT-10492)..."
              className="w-full pl-10 pr-9 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Selector Defaulting to Today */}
          <div className="flex items-center flex-wrap gap-1.5 shrink-0">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              Date:
            </span>

            <button
              type="button"
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                dateFilter === 'today'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Current Day (Default)
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('yesterday')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                dateFilter === 'yesterday'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Yesterday
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('week')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                dateFilter === 'week'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Last 7 Days
            </button>

            <button
              type="button"
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                dateFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All Orders
            </button>

            <input
              type="date"
              value={customDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                setDateFilter('custom');
              }}
              className="text-xs px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Status:
            </span>
            {(
              [
                ['all', 'All Statuses'],
                ['pending', 'Pending Specimen'],
                ['collected', 'Sample Collected'],
                ['completed', 'Completed Results'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  statusFilter === key
                    ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-medium mr-1">Urgency:</span>
            {(
              [
                ['all', 'All'],
                ['urgent', 'STAT / Urgent'],
                ['routine', 'Routine'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setUrgencyFilter(key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  urgencyFilter === key
                    ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Patient Order Cards Queue */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
          <span>
            Showing <strong className="text-slate-900 dark:text-white font-bold">{filteredOrders.length}</strong> patient encounter{filteredOrders.length !== 1 ? 's' : ''} with doctor lab orders
            {dateFilter === 'today' && ' for today'}
          </span>
          <span className="text-[11px]">
            Sorted by order queue priority
          </span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
            <div className="w-14 h-14 rounded-full bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-purple-500 flex items-center justify-center mx-auto mb-3">
              <FlaskConical className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No Doctor Lab Orders Found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              {searchQuery
                ? `No orders match "${searchQuery}". Check patient name, token number, or registration ID.`
                : dateFilter === 'today'
                ? 'No doctor lab test orders recorded for today yet. Select "All Orders" or pick another date to review previous queues.'
                : 'No doctor lab orders match the active filters.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {dateFilter === 'today' && (
                <button
                  type="button"
                  onClick={() => setDateFilter('all')}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition shadow-sm"
                >
                  View All Dates
                </button>
              )}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition"
                >
                  Clear Search
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredOrders.map((card) => {
              const pendingCount = card.labRequests.filter((r) => r.status === 'Ordered' && r.authorizedForExecution).length;
              const collectedCount = card.labRequests.filter((r) => r.status === 'Sample Collected').length;
              const completedCount = card.labRequests.filter((r) => r.status === 'Completed').length;
              const isUrgent = card.priority === 'Urgent';

              return (
                <div
                  key={card.tokenId}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl shadow-sm transition overflow-hidden ${
                    isUrgent
                      ? 'border-red-300 dark:border-red-900/60 shadow-red-500/5'
                      : 'border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800'
                  }`}
                >
                  {/* Card Header */}
                  <div
                    className={`p-4 sm:p-5 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                      isUrgent
                        ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <PatientAvatar
                        patientId={card.patientId}
                        name={card.patientName}
                        gender={card.patientGender}
                        imageUrl={card.patientPhoto}
                        size="md"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {card.patientName}
                          </h3>
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            Token {card.tokenNumber}
                          </span>
                          <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Reg ID: {card.patientRegistrationNo}
                          </span>
                          {isUrgent ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-pulse">
                              <AlertTriangle className="w-3 h-3" /> STAT / Urgent
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              Routine
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {card.orderDate} at {card.orderTime}
                          </span>
                          {card.patientAge && (
                            <span>
                              {card.patientAge} yrs • {card.patientGender || 'Unspecified'}
                            </span>
                          )}
                          <span>
                            Location: <strong>{card.counterOrRoom}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick status summary & print barcode button */}
                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => setRequisitionSlipData(card)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-xl transition shadow-xs"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
                        Print Requisition & Barcode
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatientId(card.patientId);
                          setActiveTab('labs');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-xl transition"
                        title="View Patient Diagnostic Trend Visualizer"
                      >
                        <LineChart className="w-3.5 h-3.5" />
                        Trends
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatientId(card.patientId);
                          setActiveTab('patients');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-xl transition"
                        title="Open Patient EMR"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        EMR
                      </button>
                    </div>
                  </div>

                  {/* Card Body: Doctor Prescription Source & Diagnostics Checklist */}
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Doctor Source banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <Stethoscope className="w-4 h-4 text-purple-600 shrink-0" />
                        <span>
                          Ordered by <strong>{card.doctorName}</strong> ({card.doctorDepartment})
                        </span>
                      </div>
                      {card.chiefComplaint && (
                        <div className="text-slate-500 dark:text-slate-400 text-right">
                          Complaint: <span className="italic">{card.chiefComplaint}</span>
                        </div>
                      )}
                    </div>

                    {/* Assessment & Diagnoses if available */}
                    {(card.clinicalAssessment || (card.diagnoses && card.diagnoses.length > 0)) && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {card.clinicalAssessment && (
                          <span className="text-slate-600 dark:text-slate-400">
                            Assessment: <strong className="text-slate-800 dark:text-slate-200">{card.clinicalAssessment}</strong>
                          </span>
                        )}
                        {card.diagnoses && card.diagnoses.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {card.diagnoses.map((diag, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-mono border border-purple-200 dark:border-purple-800"
                              >
                                {diag.code}: {diag.description}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Test Checklists */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                          <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
                          Prescribed Laboratory Tests ({card.labRequests.length})
                        </span>
                        {pendingCount > 0 && (
                          <button
                            type="button"
                            onClick={() => handleCollectAllSamples(card)}
                            className="text-xs font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:underline flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Collect All Pending ({pendingCount})
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {card.labRequests.map((req) => {
                          const isOrdered = req.status === 'Ordered';
                          const isCollected = req.status === 'Sample Collected';
                          const isCompleted = req.status === 'Completed';

                          // Find matching result report if completed
                          const report = card.diagnosticReports?.find(
                            (r) => r.testOrStudyName.toLowerCase() === req.testName.toLowerCase()
                          );

                          return (
                            <div
                              key={req.id}
                              className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition ${
                                isCompleted
                                  ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/40'
                                  : isCollected
                                  ? 'bg-sky-50/30 dark:bg-sky-950/10 border-sky-200 dark:border-sky-900/40'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    isCompleted
                                      ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                                      : isCollected
                                      ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400'
                                      : 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {isCompleted ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                  ) : isCollected ? (
                                    <Activity className="w-4 h-4" />
                                  ) : (
                                    <Beaker className="w-4 h-4" />
                                  )}
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                      {req.testName}
                                    </span>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                      {req.category}
                                    </span>
                                    {req.cptCode && (
                                      <span className="text-[10px] font-mono text-slate-400">
                                        {req.cptCode}
                                      </span>
                                    )}
                                    <span className={`text-[10px] font-semibold ${req.authorizedForExecution ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                                      Insurance: {req.authorizationStatus}
                                    </span>
                                  </div>

                                  {/* Result display if completed */}
                                  {isCompleted && report ? (
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                      <span className="text-slate-500 dark:text-slate-400">Result:</span>
                                      <strong className="text-slate-900 dark:text-white font-mono font-bold">
                                        {report.resultValue || 'Completed'}
                                      </strong>
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                          report.status === 'Critical'
                                            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                            : report.status === 'Elevated'
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                        }`}
                                      >
                                        {report.status}
                                      </span>
                                      {report.referenceRange && (
                                        <span className="text-[11px] text-slate-400">
                                          ({report.referenceRange})
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-slate-400">
                                      {isOrdered && 'Sample not yet collected'}
                                      {isCollected && 'Specimen collected — ready for analyzer test recording'}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Interactive Actions for this test */}
                              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                                {isOrdered && req.authorizedForExecution && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateLabOrderStatus(card.tokenId, req.id, 'Sample Collected', 'Specimen collected at Phlebotomy')
                                    }
                                    className="px-3 py-1.5 text-xs font-semibold bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 dark:text-sky-300 rounded-lg border border-sky-200 dark:border-sky-800 transition shadow-xs flex items-center gap-1.5"
                                  >
                                    <Beaker className="w-3.5 h-3.5" />
                                    Collect Specimen
                                  </button>
                                )}

                                {(isCollected || isOrdered) && req.authorizedForExecution && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenResultModal(card, req.id, req.testName, req.category)
                                    }
                                    className="px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition shadow-xs flex items-center gap-1.5"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    Enter Result
                                  </button>
                                )}

                                {isCompleted && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenResultModal(card, req.id, req.testName, req.category)
                                    }
                                    className="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                  >
                                    Edit Result
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Result Entry Modal */}
      {resultModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Enter Lab Test Result
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {resultModalData.testName} • {resultModalData.patientName} (Token {resultModalData.tokenNumber})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResultModalData(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitResult} className="p-4 sm:p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Measured Quantitative Value *
                  </label>
                  <input
                    type="text"
                    required
                    value={resultValue}
                    onChange={(e) => setResultValue(e.target.value)}
                    placeholder="e.g. 14.2 or Normal"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Units of Measurement
                  </label>
                  <input
                    type="text"
                    value={resultUnit}
                    onChange={(e) => setResultUnit(e.target.value)}
                    placeholder="e.g. mg/dL, g/dL, ng/mL"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reference Range / Normal Interval
                </label>
                <input
                  type="text"
                  value={referenceRange}
                  onChange={(e) => setReferenceRange(e.target.value)}
                  placeholder="e.g. Normal: 70 - 110 mg/dL"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Diagnostic Result Interpretation / Flag
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Normal', 'Elevated', 'Critical'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setResultStatus(status)}
                      className={`py-2 px-3 rounded-xl font-bold border transition text-center ${
                        resultStatus === status
                          ? status === 'Critical'
                            ? 'bg-red-600 text-white border-red-600'
                            : status === 'Elevated'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Technician Clinical Findings &amp; Notes
                </label>
                <textarea
                  rows={2}
                  value={findingsNotes}
                  onChange={(e) => setFindingsNotes(e.target.value)}
                  placeholder="Enter analyzer findings, specimen observations, or pathology impressions..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Verified &amp; Certified By
                </label>
                <input
                  type="text"
                  required
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  placeholder="Attending Lab Technologist Name"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResultModalData(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Save &amp; Publish Result
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Printable Specimen Requisition / Barcode Slip Modal */}
      {requisitionSlipData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Barcode className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Laboratory Specimen Requisition &amp; Barcode Slip
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRequisitionSlipData(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-sans">
              {/* Simulated Printable Specimen Label */}
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                      Apex Care Medical Center
                    </h4>
                    <p className="text-[10px] text-slate-500">Department of Pathology &amp; Laboratory Medicine</p>
                  </div>
                  <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                    {requisitionSlipData.tokenNumber}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">PATIENT NAME</span>
                    <strong className="text-slate-900 dark:text-white text-xs">
                      {requisitionSlipData.patientName}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">REGISTRATION ID / MRN</span>
                    <strong className="font-mono text-slate-900 dark:text-white text-xs">
                      {requisitionSlipData.patientRegistrationNo}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">AGE / GENDER</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {requisitionSlipData.patientAge || '—'} yrs / {requisitionSlipData.patientGender || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">ORDER DATE &amp; TIME</span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {requisitionSlipData.orderDate} {requisitionSlipData.orderTime}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px]">PRESCRIBING PHYSICIAN</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">
                      {requisitionSlipData.doctorName} ({requisitionSlipData.doctorDepartment})
                    </span>
                  </div>
                </div>

                {/* Simulated Barcode */}
                <div className="py-2 text-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="font-mono text-xs tracking-widest text-slate-900 dark:text-white font-bold select-none">
                    ||| | |||| | ||| ||||| || |||| ||| ||||| |||
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 mt-0.5">
                    *{requisitionSlipData.patientRegistrationNo}-{requisitionSlipData.tokenNumber}*
                  </div>
                </div>

                {/* Ordered Tests List */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Specimens &amp; Tests Required
                  </span>
                  <div className="space-y-1">
                    {requisitionSlipData.labRequests.map((test, i) => (
                      <div
                        key={test.id || i}
                        className="flex items-center justify-between text-[11px] py-1 border-b border-slate-200/60 dark:border-slate-800"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {i + 1}. {test.testName}
                        </span>
                        <span className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950 px-1.5 py-0.2 rounded font-medium">
                          {test.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequisitionSlipData(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Print Requisition Slip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
