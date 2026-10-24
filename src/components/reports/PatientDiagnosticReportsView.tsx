import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  Building2,
  Calendar,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  FileCheck2,
  Stethoscope,
  Send,
  Search,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Activity,
  User,
  ArrowUpRight,
} from 'lucide-react';
import { Patient, LabResult } from '../../types';

interface PatientDiagnosticReportsViewProps {
  patient: Patient;
  initialDepartment?: string;
  onOrderNewTest?: () => void;
}

export const PatientDiagnosticReportsView: React.FC<PatientDiagnosticReportsViewProps> = ({
  patient,
  initialDepartment = 'all',
  onOrderNewTest,
}) => {
  const [selectedDepartment, setSelectedDepartment] = useState<string>(initialDepartment);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<'department' | 'date' | 'flat'>('date');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const allReports: LabResult[] = useMemo(() => {
    return patient.labResults || [];
  }, [patient]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return allReports.filter((rep) => {
      // Department filter
      const repDept = rep.department || (rep.category === 'Radiology' ? 'Radiology' : 'Laboratory');
      if (selectedDepartment !== 'all' && repDept !== selectedDepartment && rep.category !== selectedDepartment) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && rep.status !== selectedStatus) {
        return false;
      }

      // Date filter
      const repDate = rep.resultDate || rep.orderedDate || todayStr;
      if (dateFilter === 'today' && repDate !== todayStr) return false;
      if (dateFilter === '7d' && repDate < sevenDaysAgo) return false;
      if (dateFilter === '30d' && repDate < thirtyDaysAgo) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = rep.testName.toLowerCase().includes(q);
        const matchesCpt = rep.cptCode ? rep.cptCode.toLowerCase().includes(q) : false;
        const matchesFindings = rep.findings ? rep.findings.toLowerCase().includes(q) : false;
        const matchesImpression = rep.impression ? rep.impression.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesCpt && !matchesFindings && !matchesImpression) return false;
      }

      return true;
    });
  }, [allReports, selectedDepartment, selectedStatus, dateFilter, searchQuery]);

  // Grouping logic: By Date
  const reportsByDate = useMemo(() => {
    const map = new Map<string, LabResult[]>();
    filteredReports.forEach((rep) => {
      const d = rep.resultDate || rep.orderedDate || 'Recent Studies';
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(rep);
    });
    // Sort dates descending
    return Array.from(map.entries()).sort((a, b) => (b[0] > a[0] ? 1 : -1));
  }, [filteredReports]);

  // Grouping logic: By Department
  const reportsByDepartment = useMemo(() => {
    const map = new Map<string, LabResult[]>();
    filteredReports.forEach((rep) => {
      const dept = rep.department || (rep.category === 'Radiology' ? 'Radiology & Diagnostic Imaging' : 'Laboratory Medicine');
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(rep);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredReports]);

  // Unique departments for filter tabs
  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    allReports.forEach((r) => {
      if (r.department) set.add(r.department);
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [allReports]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const isSectionOpen = (id: string) => expandedSections[id] !== false;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Top Controls & Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Diagnostic & Clinical Reports Center (Date & Department-Wise)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified pathology, laboratory specimens, radiology imaging reads, and diagnostic test reports with patient & doctor dispatch tracking.
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print Reports Slip
            </button>
            {onOrderNewTest && (
              <button
                onClick={onOrderNewTest}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                + Order Diagnostic Test
              </button>
            )}
          </div>
        </div>

        {/* View Grouping & Search Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Grouping Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => setGroupBy('date')}
              className={`px-3 py-1 rounded-md transition-all ${
                groupBy === 'date' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3 h-3 inline mr-1 text-teal-600" /> Group by Date
            </button>
            <button
              onClick={() => setGroupBy('department')}
              className={`px-3 py-1 rounded-md transition-all ${
                groupBy === 'department' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3 h-3 inline mr-1 text-indigo-600" /> Group by Department
            </button>
            <button
              onClick={() => setGroupBy('flat')}
              className={`px-3 py-1 rounded-md transition-all ${
                groupBy === 'flat' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              Chronological List
            </button>
          </div>

          {/* Department Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setSelectedDepartment('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 ${
                selectedDepartment === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Departments ({allReports.length})
            </button>
            {availableDepartments.map((dept) => {
              const count = allReports.filter((r) => r.department === dept || r.category === dept).length;
              return (
                <button
                  key={dept}
                  onClick={() => setSelectedDepartment(dept)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 ${
                    selectedDepartment === dept
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {dept} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Filter & Search Input */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tests, CPT codes, findings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-md py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-md px-2 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 text-[11px]">Date Window:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="bg-transparent font-medium text-slate-800 text-xs w-full focus:outline-hidden"
            >
              <option value="all">All Available Dates</option>
              <option value="today">Today's Tests Only</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-md px-2 py-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500 text-[11px]">Finding Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent font-medium text-slate-800 text-xs w-full focus:outline-hidden"
            >
              <option value="all">All Findings</option>
              <option value="Normal">Normal</option>
              <option value="Elevated">Elevated / Borderline</option>
              <option value="Critical">Critical Alert</option>
              <option value="Pending">Pending Analysis</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Display Section */}
      {filteredReports.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center space-y-2">
          <FlaskConical className="w-8 h-8 text-slate-400 mx-auto" />
          <h4 className="text-sm font-semibold text-slate-800">No diagnostic reports match the filter criteria</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try resetting the department or date filter, or create a new diagnostic report from the 6-step token workflow.
          </p>
          <button
            onClick={() => {
              setSelectedDepartment('all');
              setSelectedStatus('all');
              setDateFilter('all');
              setSearchQuery('');
            }}
            className="mt-2 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100"
          >
            Clear All Filters
          </button>
        </div>
      ) : groupBy === 'date' ? (
        /* RENDER GROUPED BY DATE */
        <div className="space-y-4">
          {reportsByDate.map(([dateKey, groupReports]) => {
            const isOpen = isSectionOpen(dateKey);
            return (
              <div key={dateKey} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <button
                  onClick={() => toggleSection(dateKey)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                    <div className="w-2 h-2 rounded-full bg-teal-600" />
                    <span className="font-bold text-sm text-slate-900">{dateKey}</span>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-200 text-slate-700">
                      {groupReports.length} {groupReports.length === 1 ? 'Report' : 'Reports'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    Departments: {Array.from(new Set(groupReports.map((r) => r.department || r.category))).join(', ')}
                  </span>
                </button>

                {isOpen && (
                  <div className="p-4 space-y-3">
                    {groupReports.map((report) => (
                      <ReportCard key={report.id} report={report} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : groupBy === 'department' ? (
        /* RENDER GROUPED BY DEPARTMENT */
        <div className="space-y-4">
          {reportsByDepartment.map(([deptKey, groupReports]) => {
            const isOpen = isSectionOpen(deptKey);
            return (
              <div key={deptKey} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <button
                  onClick={() => toggleSection(deptKey)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-sm text-slate-900">{deptKey}</span>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {groupReports.length} {groupReports.length === 1 ? 'Report' : 'Reports'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    Latest: {groupReports[0]?.resultDate || groupReports[0]?.orderedDate}
                  </span>
                </button>

                {isOpen && (
                  <div className="p-4 space-y-3">
                    {groupReports.map((report) => (
                      <ReportCard key={report.id} report={report} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* FLAT TIMELINE */
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
};

/* Subcomponent for rendering individual Diagnostic Report Cards with complete clinical depth */
const ReportCard: React.FC<{ report: LabResult }> = ({ report }) => {
  const isCritical = report.status === 'Critical';
  const isElevated = report.status === 'Elevated';
  const isNormal = report.status === 'Normal';

  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        isCritical
          ? 'bg-rose-50/40 border-rose-200 shadow-xs'
          : isElevated
          ? 'bg-amber-50/40 border-amber-200 shadow-xs'
          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
            {report.department || report.category}
          </span>
          <h4 className="font-bold text-sm text-slate-900">{report.testName}</h4>
          {report.cptCode && (
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
              {report.cptCode}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
              isCritical
                ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                : isElevated
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : isNormal
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-sky-100 text-sky-800 border-sky-300'
            }`}
          >
            {report.status}
          </span>
        </div>
      </div>

      {/* Clinical Findings & Impression */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-3 text-xs">
        <div className="p-3 bg-slate-50/90 rounded-lg border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
            Analytical Findings & Values
          </span>
          <p className="font-semibold text-slate-900 leading-relaxed">
            {report.findings || report.value}
          </p>
          {report.referenceRange && (
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              Reference Limits: {report.referenceRange}
            </p>
          )}
        </div>

        <div className="p-3 bg-slate-50/90 rounded-lg border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
            Clinical Impression & Physician Interpretation
          </span>
          <p className="font-medium text-slate-800 leading-relaxed">
            {report.impression || report.notes || 'Parameters verified by diagnostic department.'}
          </p>
          {report.technicianOrRadiologist && (
            <p className="text-[11px] text-indigo-700 font-medium mt-1">
              Verified by: {report.technicianOrRadiologist}
            </p>
          )}
        </div>
      </div>

      {/* Footer metadata: Ordered Date, Result Date, and Dispatch Notification to Patient & Doctor */}
      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-3 flex-wrap text-[11px]">
          <span>
            Ordered: <strong className="text-slate-700">{report.orderedDate}</strong> by{' '}
            <strong className="text-slate-700">{report.orderedBy}</strong>
          </span>
          <span>•</span>
          <span>
            Result Date: <strong className="text-slate-700">{report.resultDate}</strong>
          </span>
        </div>

        {/* Dispatch Status Verification */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Dispatched to Patient & Doctor
          </span>
        </div>
      </div>
    </div>
  );
};
