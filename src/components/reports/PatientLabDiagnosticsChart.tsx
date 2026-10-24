import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Info,
  Calendar,
  Clock,
  ArrowUpRight,
  Filter,
  Plus,
  Search,
  ChevronRight,
  Printer,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { Patient, LabResult } from '../../types';

interface PatientLabDiagnosticsChartProps {
  patient: Patient;
  onOrderLabTest?: () => void;
  onNavigateToReports?: () => void;
}

interface ParsedLabDataPoint {
  id: string;
  testName: string;
  category: string;
  date: string;
  displayDate: string;
  numericValue: number;
  rawUnit: string;
  rawValue: string;
  status: 'Normal' | 'Elevated' | 'Critical' | 'Pending';
  refRange: string;
  refMin: number;
  refMax: number;
  findings?: string;
  impression?: string;
  technician?: string;
  orderedBy?: string;
}

interface GroupedTest {
  name: string;
  category: string;
  unit: string;
  refRange: string;
  refMin: number;
  refMax: number;
  latestValue: number;
  latestStatus: 'Normal' | 'Elevated' | 'Critical' | 'Pending';
  latestDate: string;
  readings: ParsedLabDataPoint[];
}

// Helpers for numeric parsing
const parseNumericValue = (valStr: string): number | null => {
  if (!valStr) return null;
  const match = valStr.match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : null;
};

const extractUnit = (valStr: string, refStr: string): string => {
  const unitMatch = valStr.match(/[0-9.]+\s*([a-zA-Z/%^0-9-]+(?:\/[a-zA-Z0-9]+)?)/);
  if (unitMatch && unitMatch[1]) return unitMatch[1];
  const refUnitMatch = refStr.match(/[0-9.]+\s*([a-zA-Z/%^0-9-]+(?:\/[a-zA-Z0-9]+)?)/);
  if (refUnitMatch && refUnitMatch[1]) return refUnitMatch[1];
  return '';
};

const parseReferenceRange = (refStr: string): { min: number; max: number } => {
  if (!refStr) return { min: 0, max: 100 };

  // e.g. "3.5 - 5.1 mEq/L" or "70 - 99 mg/dL"
  const rangeMatch = refStr.match(/([0-9.]+)\s*-\s*([0-9.]+)/);
  if (rangeMatch) {
    return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
  }

  // e.g. "< 200 mg/dL" or "< 0.04 ng/mL" or "< 5.7%"
  const lessMatch = refStr.match(/<\s*([0-9.]+)/);
  if (lessMatch) {
    return { min: 0, max: parseFloat(lessMatch[1]) };
  }

  // e.g. "> 60 mL/min"
  const greaterMatch = refStr.match(/>\s*([0-9.]+)/);
  if (greaterMatch) {
    return { min: parseFloat(greaterMatch[1]), max: parseFloat(greaterMatch[1]) * 1.5 };
  }

  return { min: 0, max: 100 };
};

export const PatientLabDiagnosticsChart: React.FC<PatientLabDiagnosticsChartProps> = ({
  patient,
  onOrderLabTest,
  onNavigateToReports,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTestName, setActiveTestName] = useState<string>('');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Group all patient lab results into clean biomarker series
  const groupedTests = useMemo<GroupedTest[]>(() => {
    const rawResults = patient.labResults || [];
    const testMap: Record<string, ParsedLabDataPoint[]> = {};

    rawResults.forEach((result) => {
      // Exclude pure imaging text unless numeric
      if (result.category === 'Radiology' && !result.testName.toLowerCase().includes('density')) {
        return;
      }

      const numVal = parseNumericValue(result.value);
      if (numVal === null || isNaN(numVal)) return;

      const dateStr = result.resultDate || result.orderedDate || new Date().toISOString().slice(0, 10);
      const unit = extractUnit(result.value, result.referenceRange);
      const { min, max } = parseReferenceRange(result.referenceRange);

      const dataPoint: ParsedLabDataPoint = {
        id: result.id,
        testName: result.testName,
        category: result.department || result.category || 'Biochemistry',
        date: dateStr,
        displayDate: new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        numericValue: numVal,
        rawUnit: unit,
        rawValue: result.value,
        status: result.status,
        refRange: result.referenceRange,
        refMin: min,
        refMax: max,
        findings: result.findings,
        impression: result.impression,
        technician: result.technicianOrRadiologist,
        orderedBy: result.orderedBy,
      };

      if (!testMap[result.testName]) {
        testMap[result.testName] = [];
      }
      testMap[result.testName].push(dataPoint);
    });

    const groups: GroupedTest[] = Object.keys(testMap).map((testName) => {
      const readings = testMap[testName].sort((a, b) => a.date.localeCompare(b.date));
      const latest = readings[readings.length - 1];
      return {
        name: testName,
        category: latest.category,
        unit: latest.rawUnit,
        refRange: latest.refRange,
        refMin: latest.refMin,
        refMax: latest.refMax,
        latestValue: latest.numericValue,
        latestStatus: latest.status,
        latestDate: latest.date,
        readings,
      };
    });

    // Sort tests: tests with Critical or Elevated results appear first, then by count of readings
    return groups.sort((a, b) => {
      if (a.latestStatus === 'Critical' && b.latestStatus !== 'Critical') return -1;
      if (b.latestStatus === 'Critical' && a.latestStatus !== 'Critical') return 1;
      if (a.latestStatus === 'Elevated' && b.latestStatus === 'Normal') return -1;
      if (b.latestStatus === 'Elevated' && a.latestStatus === 'Normal') return 1;
      return b.readings.length - a.readings.length;
    });
  }, [patient]);

  // Set default active test when groupedTests changes
  const activeTest = useMemo(() => {
    if (!groupedTests.length) return null;
    return groupedTests.find((t) => t.name === activeTestName) || groupedTests[0];
  }, [groupedTests, activeTestName]);

  // Filtered categories
  const filteredTests = useMemo(() => {
    if (selectedCategory === 'all') return groupedTests;
    if (selectedCategory === 'critical') {
      return groupedTests.filter((t) => t.latestStatus === 'Critical' || t.latestStatus === 'Elevated');
    }
    return groupedTests.filter((t) => t.category.toLowerCase().includes(selectedCategory.toLowerCase()));
  }, [groupedTests, selectedCategory]);

  // Statistics calculation for active test
  const stats = useMemo(() => {
    if (!activeTest || !activeTest.readings.length) {
      return { min: 0, max: 0, avg: 0, latest: 0, delta: 0, percentChange: 0, isImproving: false };
    }
    const vals = activeTest.readings.map((r) => r.numericValue);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
    const latest = vals[vals.length - 1];
    const prev = vals.length > 1 ? vals[vals.length - 2] : latest;
    const delta = parseFloat((latest - prev).toFixed(2));
    const percentChange = prev !== 0 ? parseFloat((((latest - prev) / prev) * 100).toFixed(1)) : 0;

    // For tests where lower is generally better (Cholesterol, HbA1c, Troponin, Glucose), a drop is improving
    const lowerIsBetter = /cholesterol|hba1c|glucose|troponin|creatinine|crp|dimer/i.test(activeTest.name);
    const isImproving = lowerIsBetter ? delta <= 0 : delta >= 0;

    return { min, max, avg, latest, delta, percentChange, isImproving };
  }, [activeTest]);

  // SVG Chart Geometry
  const chartWidth = 680;
  const chartHeight = 220;
  const paddingX = 55;
  const paddingY = 30;
  const innerW = chartWidth - paddingX * 2;
  const innerH = chartHeight - paddingY * 2;

  // Compute dynamic scale boundaries for the active test
  const chartScale = useMemo(() => {
    if (!activeTest || !activeTest.readings.length) {
      return { yMin: 0, yMax: 100 };
    }
    const vals = activeTest.readings.map((r) => r.numericValue);
    const dataMin = Math.min(...vals, activeTest.refMin);
    const dataMax = Math.max(...vals, activeTest.refMax);
    const span = Math.max(1, dataMax - dataMin);

    const yMin = Math.max(0, Math.floor((dataMin - span * 0.2) * 10) / 10);
    const yMax = Math.ceil((dataMax + span * 0.25) * 10) / 10;

    return { yMin, yMax };
  }, [activeTest]);

  const points = useMemo(() => {
    if (!activeTest || !activeTest.readings.length) return [];
    const total = activeTest.readings.length;
    const { yMin, yMax } = chartScale;
    const yRange = Math.max(0.001, yMax - yMin);

    return activeTest.readings.map((reading, idx) => {
      const x = total === 1 ? paddingX + innerW / 2 : paddingX + (idx / (total - 1)) * innerW;
      const normalizedY = (reading.numericValue - yMin) / yRange;
      const y = chartHeight - paddingY - normalizedY * innerH;

      return {
        x,
        y,
        val: reading.numericValue,
        reading,
        label: reading.displayDate,
      };
    });
  }, [activeTest, chartScale, innerW, innerH]);

  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      // Single point: draw a short baseline segment
      const p = points[0];
      return `M ${(p.x - 40).toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 40).toFixed(1)} ${p.y.toFixed(1)}`;
    }
    return points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const bottomY = (chartHeight - paddingY).toFixed(1);
    if (points.length === 1) {
      const p = points[0];
      return `M ${(p.x - 40).toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 40).toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 40).toFixed(1)} ${bottomY} L ${(p.x - 40).toFixed(1)} ${bottomY} Z`;
    }
    const firstX = points[0].x.toFixed(1);
    const lastX = points[points.length - 1].x.toFixed(1);
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [points, linePath]);

  // Calculate Normal Zone rectangle
  const normalZoneYTop = useMemo(() => {
    if (!activeTest) return 0;
    const { yMin, yMax } = chartScale;
    const yRange = Math.max(0.001, yMax - yMin);
    const clampedMax = Math.min(yMax, Math.max(yMin, activeTest.refMax));
    const normalizedY = (clampedMax - yMin) / yRange;
    return chartHeight - paddingY - normalizedY * innerH;
  }, [activeTest, chartScale, innerH]);

  const normalZoneHeight = useMemo(() => {
    if (!activeTest) return 0;
    const { yMin, yMax } = chartScale;
    const yRange = Math.max(0.001, yMax - yMin);
    const clampedMin = Math.min(yMax, Math.max(yMin, activeTest.refMin));
    const clampedMax = Math.min(yMax, Math.max(yMin, activeTest.refMax));
    const spanNormalized = (clampedMax - clampedMin) / yRange;
    return Math.max(4, spanNormalized * innerH);
  }, [activeTest, chartScale, innerH]);

  const criticalCount = useMemo(
    () => (patient.labResults || []).filter((r) => r.status === 'Critical').length,
    [patient]
  );
  const elevatedCount = useMemo(
    () => (patient.labResults || []).filter((r) => r.status === 'Elevated').length,
    [patient]
  );

  return (
    <section className="overflow-hidden rounded-xl border border-teal-200/90 bg-white shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-col gap-3 border-b border-teal-100 bg-gradient-to-r from-teal-50/80 via-white to-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm ring-2 ring-teal-100">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Lab Diagnostics &amp; Biomarker Telemetry Chart</h3>
              <span className="rounded bg-teal-100 px-2 py-0.5 font-mono text-[10px] font-bold text-teal-800">
                {groupedTests.length} Analyte Series
              </span>
              {criticalCount > 0 && (
                <span className="flex items-center gap-1 rounded bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
                  🚨 {criticalCount} Critical Panic
                </span>
              )}
              {elevatedCount > 0 && criticalCount === 0 && (
                <span className="flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  ⚠️ {elevatedCount} Abnormal
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Longitudinal tracking with clinical reference corridors, delta analytics, and statutory critical value verification.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOrderLabTest && (
            <button
              type="button"
              onClick={onOrderLabTest}
              className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-teal-800 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Order Lab Work</span>
            </button>
          )}
          {onNavigateToReports && (
            <button
              type="button"
              onClick={onNavigateToReports}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <span>Full Reports</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {groupedTests.length === 0 ? (
        <div className="p-8 text-center">
          <FlaskConical className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-800">No laboratory assays recorded yet</p>
          <p className="mt-1 text-xs text-slate-500">
            When lab technicians enter blood or urine tests, longitudinal biomarker curves will automatically graph here.
          </p>
          {onOrderLabTest && (
            <button
              type="button"
              onClick={onOrderLabTest}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Order Initial Lab Panel
            </button>
          )}
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Critical Value Urgent Action Alert if present */}
          {criticalCount > 0 && (
            <div className="flex items-center justify-between rounded-lg border-2 border-rose-500 bg-rose-50 p-3 text-xs text-rose-950 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 animate-pulse" />
                <div>
                  <span className="font-extrabold uppercase tracking-wide text-rose-900">
                    Active Critical / Panic Threshold Detected
                  </span>
                  <p className="text-[11px] text-rose-800 mt-0.5">
                    Attending physician verbal notification standard is required. Review abnormal curve and certified findings below.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const criticalTest = groupedTests.find((t) => t.latestStatus === 'Critical');
                  if (criticalTest) setActiveTestName(criticalTest.name);
                }}
                className="rounded-md bg-rose-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-800 transition shrink-0"
              >
                Inspect Critical Curve
              </button>
            </div>
          )}

          {/* Biomarker Category Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter biomarker panels">
              {[
                ['all', 'All Assays'],
                ['critical', `🚨 Abnormal / Critical (${criticalCount + elevatedCount})`],
                ['biochemistry', 'Biochemistry'],
                ['hematology', 'Hematology & CBC'],
                ['cardiology', 'Cardiology'],
              ].map(([cat, label]) => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    selectedCategory === cat
                      ? 'bg-teal-800 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <span className="text-[11px] font-mono text-slate-400">
              Plotting: <span className="font-bold text-slate-700">{activeTest?.name}</span>
            </span>
          </div>

          {/* Analyte Selection Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {filteredTests.map((test) => {
              const isActive = activeTest?.name === test.name;
              return (
                <button
                  key={test.name}
                  type="button"
                  onClick={() => setActiveTestName(test.name)}
                  className={`group flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${
                    isActive
                      ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-200 text-teal-950 font-bold'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs truncate max-w-[170px]">{test.name}</span>
                      {test.latestStatus === 'Critical' && (
                        <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping shrink-0" />
                      )}
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-1.5 text-[11px] font-mono">
                      <span className="font-extrabold text-slate-900">
                        {test.latestValue} {test.unit}
                      </span>
                      <span
                        className={`rounded px-1 text-[9px] font-bold ${
                          test.latestStatus === 'Critical'
                            ? 'bg-rose-100 text-rose-800'
                            : test.latestStatus === 'Elevated'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {test.latestStatus}
                      </span>
                    </div>
                  </div>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-500">
                    {test.readings.length} pts
                  </span>
                </button>
              );
            })}
          </div>

          {/* Interactive Trend Chart Card */}
          {activeTest && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              {/* Telemetry Statistics Strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 bg-slate-50 rounded-lg border border-slate-200 p-3 text-xs">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-500">Latest Observation</span>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-base font-black font-mono text-slate-900">
                      {stats.latest}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">{activeTest.unit}</span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-black ${
                        activeTest.latestStatus === 'Critical'
                          ? 'bg-rose-600 text-white'
                          : activeTest.latestStatus === 'Elevated'
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {activeTest.latestStatus}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-500">Delta vs Baseline</span>
                  <div className="mt-1 flex items-baseline gap-1">
                    {stats.delta !== 0 ? (
                      <>
                        {stats.delta > 0 ? (
                          <span className="flex items-center gap-0.5 font-bold font-mono text-xs text-rose-700">
                            <TrendingUp className="h-3.5 w-3.5" /> +{stats.delta} {activeTest.unit}
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 font-bold font-mono text-xs text-emerald-700">
                            <TrendingDown className="h-3.5 w-3.5" /> {stats.delta} {activeTest.unit}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">({stats.percentChange}%)</span>
                      </>
                    ) : (
                      <span className="font-bold text-xs text-slate-500">Stable (no change)</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-500">Normal Corridor Target</span>
                  <div className="mt-1 flex items-center gap-1 font-bold font-mono text-xs text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>{activeTest.refRange || `${activeTest.refMin} - ${activeTest.refMax} ${activeTest.unit}`}</span>
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-500">Observed Range (Min - Max)</span>
                  <div className="mt-1 font-bold font-mono text-xs text-slate-800">
                    {stats.min} - {stats.max} {activeTest.unit}
                  </div>
                </div>
              </div>

              {/* Chart Canvas */}
              <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 mb-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{activeTest.name}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] text-slate-600">
                      {activeTest.category}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2.5 w-2.5 rounded-xs border border-emerald-300 bg-emerald-100" />
                      <span>Target Band ({activeTest.refRange})</span>
                    </span>
                    <span className="flex items-center gap-1 font-bold text-teal-700">
                      <span className="inline-block h-0.5 w-3 bg-teal-700" />
                      <span>Measured Value</span>
                    </span>
                  </div>
                </div>

                {/* SVG Visualizer */}
                <div className="w-full overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full h-48 select-none"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="labChartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f766e" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Normal Corridor Rect */}
                    <rect
                      x={paddingX}
                      y={normalZoneYTop}
                      width={innerW}
                      height={normalZoneHeight}
                      fill="#ecfdf5"
                      opacity="0.85"
                      stroke="#a7f3d0"
                      strokeDasharray="3,3"
                      strokeWidth="1"
                    />

                    {/* Horizontal Gridlines & Y-Axis Labels */}
                    {[
                      chartScale.yMin,
                      parseFloat(((chartScale.yMin + chartScale.yMax) / 2).toFixed(1)),
                      chartScale.yMax,
                    ].map((tick) => {
                      const yRange = Math.max(0.001, chartScale.yMax - chartScale.yMin);
                      const tickY = chartHeight - paddingY - ((tick - chartScale.yMin) / yRange) * innerH;
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
                            fontWeight="bold"
                          >
                            {tick}
                          </text>
                        </g>
                      );
                    })}

                    {/* Shaded Area Fill */}
                    <path d={areaPath} fill="url(#labChartGradient)" />

                    {/* Trend Line */}
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#0f766e"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Interactive Points */}
                    {points.map((p, idx) => {
                      const isHovered = hoveredPointIndex === idx;
                      const isCrit = p.reading.status === 'Critical';
                      const isElev = p.reading.status === 'Elevated';
                      const pointColor = isCrit ? '#e11d48' : isElev ? '#d97706' : '#0f766e';

                      return (
                        <g key={p.reading.id || idx}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={isHovered ? 6 : isCrit ? 5 : 4}
                            fill="#ffffff"
                            stroke={pointColor}
                            strokeWidth={isHovered ? 3 : 2}
                            className="transition-all cursor-pointer"
                            onMouseEnter={() => setHoveredPointIndex(idx)}
                            onMouseLeave={() => setHoveredPointIndex(null)}
                          />

                          {/* X-Axis Date Tick */}
                          <text
                            x={p.x}
                            y={chartHeight - 8}
                            textAnchor="middle"
                            fontSize="9"
                            fill={isHovered ? '#0f766e' : '#64748b'}
                            fontWeight={isHovered ? 'bold' : 'normal'}
                          >
                            {p.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Hover Tooltip Card */}
                {hoveredPointIndex !== null && points[hoveredPointIndex] && (
                  <div className="absolute top-4 right-4 z-20 rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-xs text-white shadow-xl backdrop-blur-xs animate-in fade-in duration-100 max-w-xs space-y-1">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                      <span className="font-bold text-slate-300">{points[hoveredPointIndex].label}</span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-black ${
                          points[hoveredPointIndex].reading.status === 'Critical'
                            ? 'bg-rose-600 text-white'
                            : points[hoveredPointIndex].reading.status === 'Elevated'
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {points[hoveredPointIndex].reading.status}
                      </span>
                    </div>
                    <div className="font-mono text-base font-extrabold text-white">
                      {points[hoveredPointIndex].val} {activeTest.unit}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Ref: {points[hoveredPointIndex].reading.refRange}
                    </div>
                    {points[hoveredPointIndex].reading.findings && (
                      <p className="text-[11px] text-slate-300 line-clamp-2 italic pt-1">
                        &ldquo;{points[hoveredPointIndex].reading.findings}&rdquo;
                      </p>
                    )}
                    {points[hoveredPointIndex].reading.technician && (
                      <div className="text-[9px] text-slate-500 pt-0.5">
                        Certified by: {points[hoveredPointIndex].reading.technician}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Chronological Readings Table */}
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Chronological Lab Results ({activeTest.readings.length} specimen records)
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Ref: {activeTest.refRange}</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {[...activeTest.readings].reverse().map((reading, idx) => (
                    <div
                      key={reading.id || idx}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2.5 text-xs hover:bg-slate-50/80 transition gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold text-slate-700">
                            {reading.displayDate}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                              reading.status === 'Critical'
                                ? 'bg-rose-100 text-rose-800 font-black'
                                : reading.status === 'Elevated'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {reading.status}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {reading.numericValue} {reading.rawUnit}
                          </span>
                        </div>
                        {reading.findings && (
                          <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-1">
                            {reading.findings}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-500 shrink-0">
                        {reading.orderedBy && <span>Dr. {reading.orderedBy.replace(/^Dr\.?\s*/, '')}</span>}
                        {reading.technician && <span>· Tech: {reading.technician}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
