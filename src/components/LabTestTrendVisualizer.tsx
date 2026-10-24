import React, { useState, useMemo } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Minus,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  LineChart,
  Activity,
  ChevronLeft,
  Printer,
  ArrowDownRight,
  ArrowUpRight,
  FlaskConical,
  Info,
  Check,
} from 'lucide-react';
import { LabResult, Patient } from '../types';

interface LabTestTrendVisualizerProps {
  patient: Patient;
  reports: LabResult[];
  initialSelectedTestName?: string;
  onBackToList?: () => void;
}

interface ParsedTrendPoint {
  id: string;
  testName: string;
  date: string;
  rawDate: Date;
  dateFormatted: string;
  numericValue: number;
  unit: string;
  rawValue: string;
  status: 'Normal' | 'Elevated' | 'Critical' | 'Pending';
  referenceRange: string;
  refMin?: number;
  refMax?: number;
  orderedBy: string;
  notes?: string;
  impression?: string;
  findings?: string;
  encounterTokenId?: string;
}

// Helper to parse numeric value and unit
function parseNumericValue(valStr: string): { num: number; unit: string } | null {
  if (!valStr) return null;
  const cleaned = valStr.trim();
  // Match number like 14.2, 228, 7.2 followed by unit like mg/dL, g/dL, %, ng/mL, etc.
  const match = cleaned.match(/^([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z/%μ]+(?:\/[a-zA-Z]+)?)?/);
  if (!match) {
    // Try anywhere in string if first word is number
    const subMatch = cleaned.match(/([0-9]+(?:\.[0-9]+)?)\s*(mg\/dL|g\/dL|mmol\/L|%|ng\/mL|cells\/mcL|u\/L|mIU\/L|pg\/mL)?/i);
    if (!subMatch) return null;
    const num = parseFloat(subMatch[1]);
    return isNaN(num) ? null : { num, unit: subMatch[2] || '' };
  }
  const num = parseFloat(match[1]);
  if (isNaN(num)) return null;
  return { num, unit: match[2] || '' };
}

// Helper to parse reference range limits
function parseRefLimits(rangeStr?: string): { min?: number; max?: number } {
  if (!rangeStr) return {};
  const lessMatch = rangeStr.match(/<\s*([0-9]+(?:\.[0-9]+)?)/);
  if (lessMatch) return { max: parseFloat(lessMatch[1]) };

  const greaterMatch = rangeStr.match(/>\s*([0-9]+(?:\.[0-9]+)?)/);
  if (greaterMatch) return { min: parseFloat(greaterMatch[1]) };

  const rangeMatch = rangeStr.match(/([0-9]+(?:\.[0-9]+)?)\s*-\s*([0-9]+(?:\.[0-9]+)?)/);
  if (rangeMatch) {
    return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
  }
  return {};
}

// Normalize test names for grouping (e.g., "Lipid Panel - Total Cholesterol" vs "Total Cholesterol")
function getCanonicalTestKey(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('cholesterol') || lower.includes('lipid')) return 'Total Cholesterol';
  if (lower.includes('hba1c') || lower.includes('hemoglobin a1c')) return 'Hemoglobin A1c (HbA1c)';
  if (lower.includes('glucose') || lower.includes('sugar') || lower.includes('cmp') || lower.includes('metabolic')) return 'Fasting Blood Glucose';
  if (lower.includes('cbc') || lower.includes('hemoglobin') || lower.includes('blood count')) return 'Hemoglobin (CBC)';
  if (lower.includes('troponin') || lower.includes('ck-mb')) return 'Cardiac Troponin I';
  if (lower.includes('creatinine') || lower.includes('egfr')) return 'Serum Creatinine';
  if (lower.includes('potassium')) return 'Serum Potassium';
  if (lower.includes('alt') || lower.includes('ast') || lower.includes('liver')) return 'ALT / Liver Function';
  return name.trim();
}

export const LabTestTrendVisualizer: React.FC<LabTestTrendVisualizerProps> = ({
  patient,
  reports,
  initialSelectedTestName,
  onBackToList,
}) => {
  // Extract and group all numerical lab results
  const testsGrouped = useMemo(() => {
    const groups: Record<string, ParsedTrendPoint[]> = {};

    reports.forEach((rep) => {
      const parsed = parseNumericValue(rep.value);
      if (!parsed) return;

      const canonicalName = getCanonicalTestKey(rep.testName);
      const refLimits = parseRefLimits(rep.referenceRange);

      const orderDateStr = rep.resultDate || rep.orderedDate || new Date().toISOString().split('T')[0];
      const dateObj = new Date(orderDateStr);

      const point: ParsedTrendPoint = {
        id: rep.id,
        testName: rep.testName,
        date: orderDateStr,
        rawDate: isNaN(dateObj.getTime()) ? new Date() : dateObj,
        dateFormatted: isNaN(dateObj.getTime())
          ? orderDateStr
          : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        numericValue: parsed.num,
        unit: parsed.unit,
        rawValue: rep.value,
        status: (rep.status as any) || 'Normal',
        referenceRange: rep.referenceRange || 'Reference range normal',
        refMin: refLimits.min,
        refMax: refLimits.max,
        orderedBy: rep.orderedBy || 'Attending Physician',
        notes: rep.notes,
        impression: rep.impression,
        findings: rep.findings,
        encounterTokenId: rep.encounterTokenId,
      };

      if (!groups[canonicalName]) {
        groups[canonicalName] = [];
      }
      groups[canonicalName].push(point);
    });

    // Sort each group chronologically
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
    });

    return groups;
  }, [reports]);

  const availableTestKeys = useMemo(() => Object.keys(testsGrouped), [testsGrouped]);

  // Determine currently selected test
  const [selectedTestKey, setSelectedTestKey] = useState<string>(() => {
    if (initialSelectedTestName) {
      const matchedCanonical = getCanonicalTestKey(initialSelectedTestName);
      if (availableTestKeys.includes(matchedCanonical)) return matchedCanonical;
    }
    return availableTestKeys[0] || 'Total Cholesterol';
  });

  const activePoints = useMemo(() => {
    return testsGrouped[selectedTestKey] || [];
  }, [testsGrouped, selectedTestKey]);

  // Selected hover point index on chart
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Time window filter
  const [timeWindow, setTimeWindow] = useState<'all' | '6m' | '30d'>('all');

  const filteredPoints = useMemo(() => {
    if (timeWindow === 'all') return activePoints;
    const now = new Date();
    const cutoff = new Date();
    if (timeWindow === '6m') cutoff.setMonth(now.getMonth() - 6);
    if (timeWindow === '30d') cutoff.setDate(now.getDate() - 30);
    return activePoints.filter((pt) => pt.rawDate >= cutoff);
  }, [activePoints, timeWindow]);

  // Key summary trajectory metrics
  const summaryMetrics = useMemo(() => {
    if (filteredPoints.length === 0) return null;
    const latest = filteredPoints[filteredPoints.length - 1];
    const baseline = filteredPoints[0];
    const unit = latest.unit || baseline.unit || '';

    const delta = latest.numericValue - baseline.numericValue;
    const percentChange = baseline.numericValue !== 0 ? (delta / baseline.numericValue) * 100 : 0;

    // Evaluate clinical direction
    let isPositive = false;
    let direction: 'improving' | 'deteriorating' | 'stable' = 'stable';

    if (Math.abs(percentChange) < 2) {
      direction = 'stable';
      isPositive = true;
    } else if (
      selectedTestKey.includes('Cholesterol') ||
      selectedTestKey.includes('HbA1c') ||
      selectedTestKey.includes('Glucose') ||
      selectedTestKey.includes('Troponin') ||
      selectedTestKey.includes('Creatinine')
    ) {
      // Lower is generally better for these tests when elevated
      if (delta < 0) {
        direction = 'improving';
        isPositive = true;
      } else {
        direction = 'deteriorating';
        isPositive = false;
      }
    } else if (selectedTestKey.includes('Hemoglobin') || selectedTestKey.includes('CBC')) {
      // For hemoglobin, if baseline was low, going up is improving
      if (baseline.numericValue < 12 && delta > 0) {
        direction = 'improving';
        isPositive = true;
      } else if (delta < 0) {
        direction = 'deteriorating';
        isPositive = false;
      }
    }

    return {
      latest,
      baseline,
      delta,
      percentChange,
      direction,
      isPositive,
      unit,
      totalReadings: filteredPoints.length,
    };
  }, [filteredPoints, selectedTestKey]);

  // Chart coordinate calculation
  const chartConfig = useMemo(() => {
    const width = 760;
    const height = 260;
    const padding = { top: 30, right: 35, bottom: 45, left: 55 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    if (filteredPoints.length === 0) {
      return {
        width,
        height,
        padding,
        plotWidth,
        plotHeight,
        coords: [],
        yTicks: [],
        pathData: '',
        areaData: '',
        minVal: 0,
        maxVal: 100,
        refBand: { yMax: null, yMin: null },
        refMax: undefined,
        refMin: undefined,
      };
    }

    // Determine Y range with padding
    const values = filteredPoints.map((p) => p.numericValue);
    const refMax = filteredPoints[0]?.refMax;
    const refMin = filteredPoints[0]?.refMin;

    if (typeof refMax === 'number') values.push(refMax);
    if (typeof refMin === 'number') values.push(refMin);

    let rawMin = Math.min(...values);
    let rawMax = Math.max(...values);

    // Give breathing room
    const span = rawMax - rawMin || rawMax * 0.2 || 10;
    let minVal = Math.max(0, Math.floor(rawMin - span * 0.15));
    let maxVal = Math.ceil(rawMax + span * 0.2);

    // If minVal === maxVal
    if (minVal === maxVal) {
      minVal = Math.max(0, minVal - 10);
      maxVal = maxVal + 10;
    }

    // Generate coordinates
    const coords = filteredPoints.map((pt, idx) => {
      const x =
        filteredPoints.length === 1
          ? padding.left + plotWidth / 2
          : padding.left + (idx / (filteredPoints.length - 1)) * plotWidth;
      const normalizedY = (pt.numericValue - minVal) / (maxVal - minVal);
      const y = padding.top + plotHeight - normalizedY * plotHeight;
      return { x, y, pt, idx };
    });

    // Create SVG Path
    let pathData = '';
    let areaData = '';
    if (coords.length === 1) {
      const c = coords[0];
      pathData = `M ${padding.left} ${c.y} L ${width - padding.right} ${c.y}`;
      areaData = `M ${padding.left} ${c.y} L ${width - padding.right} ${c.y} L ${width - padding.right} ${padding.top + plotHeight} L ${padding.left} ${padding.top + plotHeight} Z`;
    } else {
      pathData = coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`, '');
      const first = coords[0];
      const last = coords[coords.length - 1];
      const bottomY = padding.top + plotHeight;
      areaData = `${pathData} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
    }

    // Y-Axis Ticks (4 ticks)
    const yTicks: Array<{ val: number; y: number }> = [];
    for (let i = 0; i <= 4; i++) {
      const tickVal = Math.round(minVal + (i / 4) * (maxVal - minVal));
      const tickY = padding.top + plotHeight - (i / 4) * plotHeight;
      yTicks.push({ val: tickVal, y: tickY });
    }

    // Normal reference band Y coordinates
    const refBand = {
      yMax: typeof refMax === 'number' ? padding.top + plotHeight - ((refMax - minVal) / (maxVal - minVal)) * plotHeight : null,
      yMin: typeof refMin === 'number' ? padding.top + plotHeight - ((refMin - minVal) / (maxVal - minVal)) * plotHeight : null,
    };

    return {
      width,
      height,
      padding,
      coords,
      yTicks,
      pathData,
      areaData,
      minVal,
      maxVal,
      plotWidth,
      plotHeight,
      refBand,
      refMax,
      refMin,
    };
  }, [filteredPoints]);

  const activeHoveredCoord =
    hoveredPointIndex !== null ? chartConfig.coords[hoveredPointIndex] : null;

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          {onBackToList && (
            <button
              type="button"
              onClick={onBackToList}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Return to reports list"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-400">
              <LineChart className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                Historical Diagnostic Trend Visualizer
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Longitudinal progress tracking across clinical encounters for {patient.firstName} {patient.lastName}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Time Horizon Pills */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px]">
            <button
              type="button"
              onClick={() => setTimeWindow('all')}
              className={`px-2 py-1 rounded-md font-semibold transition ${
                timeWindow === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setTimeWindow('6m')}
              className={`px-2 py-1 rounded-md font-semibold transition ${
                timeWindow === '6m'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              6 Months
            </button>
            <button
              type="button"
              onClick={() => setTimeWindow('30d')}
              className={`px-2 py-1 rounded-md font-semibold transition ${
                timeWindow === '30d'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              30 Days
            </button>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Print Trend Visualizer"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Test Selection Tabs */}
      {availableTestKeys.length > 0 ? (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0 mr-1">
            Tracked Lab Tests:
          </span>
          {availableTestKeys.map((key) => {
            const count = testsGrouped[key].length;
            const isSelected = selectedTestKey === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedTestKey(key);
                  setHoveredPointIndex(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{key}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? 'bg-teal-800/80 text-teal-100'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 text-center">
          No numerical diagnostic values recorded for this patient yet.
        </div>
      )}

      {/* 3. Clinical Trajectory Banner */}
      {summaryMetrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Latest Result
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-black text-slate-900 dark:text-white font-mono">
                {summaryMetrics.latest.numericValue}
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                {summaryMetrics.unit}
              </span>
            </div>
            <span
              className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold mt-0.5 ${
                summaryMetrics.latest.status === 'Critical'
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  : summaryMetrics.latest.status === 'Elevated'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              {summaryMetrics.latest.status} ({summaryMetrics.latest.dateFormatted})
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Baseline (First)
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-black text-slate-700 dark:text-slate-300 font-mono">
                {summaryMetrics.baseline.numericValue}
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                {summaryMetrics.unit}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {summaryMetrics.baseline.dateFormatted}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Net Change
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              {summaryMetrics.delta < 0 ? (
                <ArrowDownRight className={`w-4 h-4 ${summaryMetrics.isPositive ? 'text-emerald-600' : 'text-rose-600'}`} />
              ) : summaryMetrics.delta > 0 ? (
                <ArrowUpRight className={`w-4 h-4 ${summaryMetrics.isPositive ? 'text-emerald-600' : 'text-rose-600'}`} />
              ) : (
                <Minus className="w-4 h-4 text-slate-400" />
              )}
              <span
                className={`text-base font-black font-mono ${
                  summaryMetrics.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {summaryMetrics.delta > 0 ? `+${summaryMetrics.delta.toFixed(1)}` : summaryMetrics.delta.toFixed(1)}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                ({summaryMetrics.percentChange > 0 ? `+${summaryMetrics.percentChange.toFixed(1)}%` : `${summaryMetrics.percentChange.toFixed(1)}%`})
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium capitalize">
              {summaryMetrics.direction === 'improving' ? 'Therapeutic Improvement' : summaryMetrics.direction === 'stable' ? 'Stable Condition' : 'Requires Clinician Review'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Reference Target
            </span>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
              {summaryMetrics.latest.referenceRange || 'Normal clinical threshold'}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {summaryMetrics.totalReadings} recorded measurement{summaryMetrics.totalReadings !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* 4. Interactive SVG Line Chart */}
      <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs overflow-hidden">
        {filteredPoints.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No readings found for the selected time horizon.
          </div>
        ) : (
          <div>
            {/* Legend & Indicator line */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-2 px-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block" />
                  <strong>{selectedTestKey}</strong> ({summaryMetrics?.unit || ''})
                </span>
                {chartConfig.refMax !== undefined && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <span className="w-3 h-0.5 border-t-2 border-dashed border-emerald-500 inline-block" />
                    Target Threshold ({chartConfig.refMax} {summaryMetrics?.unit})
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 italic">
                Hover over data points to inspect encounter details
              </span>
            </div>

            {/* SVG Visualizer */}
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`}
                className="w-full h-auto min-w-[580px] overflow-visible select-none"
              >
                <defs>
                  {/* Gradient fill underneath the line */}
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Gradient for reference range zone */}
                  <linearGradient id="refZoneGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Shaded Reference Interval Zone if refMax or refMin exists */}
                {chartConfig.refBand?.yMax !== null && chartConfig.refBand?.yMax !== undefined && (
                  <g>
                    <rect
                      x={chartConfig.padding.left}
                      y={chartConfig.refBand.yMax}
                      width={chartConfig.plotWidth}
                      height={chartConfig.padding.top + chartConfig.plotHeight - chartConfig.refBand.yMax}
                      fill="url(#refZoneGradient)"
                    />
                    {/* Target dashed threshold line */}
                    <line
                      x1={chartConfig.padding.left}
                      y1={chartConfig.refBand.yMax}
                      x2={chartConfig.width - chartConfig.padding.right}
                      y2={chartConfig.refBand.yMax}
                      stroke="#10b981"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={chartConfig.width - chartConfig.padding.right + 4}
                      y={chartConfig.refBand.yMax + 3}
                      fill="#10b981"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      ULN
                    </text>
                  </g>
                )}

                {/* Horizontal Gridlines & Y-Axis Labels */}
                {chartConfig.yTicks.map((tick, i) => (
                  <g key={i}>
                    <line
                      x1={chartConfig.padding.left}
                      y1={tick.y}
                      x2={chartConfig.width - chartConfig.padding.right}
                      y2={tick.y}
                      stroke="currentColor"
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth="1"
                    />
                    <text
                      x={chartConfig.padding.left - 8}
                      y={tick.y + 3.5}
                      textAnchor="end"
                      fill="#94a3b8"
                      fontSize="9.5"
                      fontFamily="monospace"
                    >
                      {tick.val}
                    </text>
                  </g>
                ))}

                {/* Area Gradient under curve */}
                {chartConfig.areaData && (
                  <path d={chartConfig.areaData} fill="url(#trendGradient)" />
                )}

                {/* Main Trend Line Path */}
                {chartConfig.pathData && (
                  <path
                    d={chartConfig.pathData}
                    fill="none"
                    stroke="#0d9488"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Interactive Data Point Nodes & X-Axis Labels */}
                {chartConfig.coords.map(({ x, y, pt, idx }) => {
                  const isHovered = hoveredPointIndex === idx;
                  const isCritical = pt.status === 'Critical';
                  const isElevated = pt.status === 'Elevated';
                  const dotColor = isCritical ? '#e11d48' : isElevated ? '#f59e0b' : '#0d9488';

                  return (
                    <g key={pt.id || idx}>
                      {/* Vertical tracking dashed guide when hovered */}
                      {isHovered && (
                        <line
                          x1={x}
                          y1={chartConfig.padding.top}
                          x2={x}
                          y2={chartConfig.padding.top + chartConfig.plotHeight}
                          stroke="#0d9488"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                      )}

                      {/* Touch target / hover hit area */}
                      <circle
                        cx={x}
                        cy={y}
                        r="18"
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPointIndex(idx)}
                        onClick={() => setHoveredPointIndex(idx)}
                      />

                      {/* Outer pulse ring for critical values or hovered point */}
                      {(isHovered || isCritical) && (
                        <circle
                          cx={x}
                          cy={y}
                          r={isHovered ? 9 : 7}
                          fill={dotColor}
                          opacity={isHovered ? 0.3 : 0.2}
                          className="transition-all"
                        />
                      )}

                      {/* Main Data Dot */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? 5.5 : 4}
                        fill="#ffffff"
                        stroke={dotColor}
                        strokeWidth="2.5"
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredPointIndex(idx)}
                        onClick={() => setHoveredPointIndex(idx)}
                      />

                      {/* Value label directly above dot */}
                      <text
                        x={x}
                        y={y - 8}
                        textAnchor="middle"
                        fill={isHovered ? dotColor : '#334155'}
                        fontSize="10"
                        fontWeight={isHovered ? '900' : 'bold'}
                        fontFamily="monospace"
                        className="dark:fill-slate-200"
                      >
                        {pt.numericValue}
                      </text>

                      {/* X-Axis Date Label */}
                      <text
                        x={x}
                        y={chartConfig.padding.top + chartConfig.plotHeight + 16}
                        textAnchor="middle"
                        fill={isHovered ? '#0f172a' : '#64748b'}
                        fontSize="9.5"
                        fontWeight={isHovered ? 'bold' : 'normal'}
                        className="dark:fill-slate-400"
                      >
                        {pt.dateFormatted}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Hover Floating Tooltip Detail Box */}
            {activeHoveredCoord && (
              <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs animate-in fade-in duration-100">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-3 h-3 rounded-full shrink-0 ${
                      activeHoveredCoord.pt.status === 'Critical'
                        ? 'bg-rose-500'
                        : activeHoveredCoord.pt.status === 'Elevated'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {activeHoveredCoord.pt.testName}: {activeHoveredCoord.pt.rawValue}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 ml-2">
                      (Ref: {activeHoveredCoord.pt.referenceRange})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                  <span>
                    Ordered by: <strong>{activeHoveredCoord.pt.orderedBy}</strong>
                  </span>
                  <span>
                    Date: <strong>{activeHoveredCoord.pt.dateFormatted}</strong>
                  </span>
                  {activeHoveredCoord.pt.encounterTokenId && (
                    <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 rounded text-[10px]">
                      {activeHoveredCoord.pt.encounterTokenId}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Historical Readings Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-teal-600" />
            Historical Encounter Readings ({filteredPoints.length})
          </span>
          <span className="text-[10px] text-slate-400">
            Chronological progression from oldest to newest
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3.5 py-2">Test Date</th>
                <th className="px-3.5 py-2">Encounter / Token</th>
                <th className="px-3.5 py-2">Measured Result</th>
                <th className="px-3.5 py-2">Reference Normal Range</th>
                <th className="px-3.5 py-2">Clinical Flag</th>
                <th className="px-3.5 py-2">Net Shift</th>
                <th className="px-3.5 py-2">Ordering Physician</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPoints.map((pt, idx) => {
                const prev = idx > 0 ? filteredPoints[idx - 1] : null;
                const shift = prev ? pt.numericValue - prev.numericValue : null;

                return (
                  <tr
                    key={pt.id || idx}
                    className={`transition hover:bg-teal-50/40 dark:hover:bg-slate-800/60 ${
                      hoveredPointIndex === idx ? 'bg-teal-50/80 dark:bg-teal-950/30' : ''
                    }`}
                    onMouseEnter={() => setHoveredPointIndex(idx)}
                    onMouseLeave={() => setHoveredPointIndex(null)}
                  >
                    <td className="px-3.5 py-2.5 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {pt.dateFormatted}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-500">
                      {pt.encounterTokenId || '—'}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {pt.rawValue}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500 text-[11px]">
                      {pt.referenceRange}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          pt.status === 'Critical'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : pt.status === 'Elevated'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {pt.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-[11px]">
                      {shift === null ? (
                        <span className="text-slate-400 italic">Baseline</span>
                      ) : (
                        <span
                          className={`font-semibold ${
                            summaryMetrics?.isPositive
                              ? shift < 0
                                ? 'text-emerald-600'
                                : 'text-rose-600'
                              : shift > 0
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {shift > 0 ? `+${shift.toFixed(1)}` : shift.toFixed(1)}
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {pt.orderedBy}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
