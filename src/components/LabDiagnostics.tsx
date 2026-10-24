import React, { useMemo, useState } from 'react';
import { FileText, FlaskConical, Search, UserRound, LineChart, TrendingUp, Activity } from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { LabResult, Patient, ReceptionToken } from '../types';
import { PatientAvatar } from './PatientAvatar';
import { LabTestTrendVisualizer } from './LabTestTrendVisualizer';

type DiagnosticSection = 'laboratory' | 'radiology';
type QueueFilter = 'all' | DiagnosticSection;

const isRadiologyReport = (report: LabResult) =>
  report.category === 'Radiology' ||
  report.department === 'Radiology & Imaging' ||
  Boolean(report.modality);

const getTokenNumber = (token: ReceptionToken) => {
  const number = token.tokenNumber.match(/\d+/)?.[0];
  return number ? Number(number) : Number.MAX_SAFE_INTEGER;
};

const compareTokens = (first: ReceptionToken, second: ReceptionToken) =>
  getTokenNumber(first) - getTokenNumber(second) ||
  first.tokenNumber.localeCompare(second.tokenNumber);

const isDiagnosticToken = (token: ReceptionToken) =>
  token.serviceType === 'Lab Sample' ||
  /lab|radiolog|diagnostic|imaging/i.test(token.department) ||
  Boolean(token.doctorOrders?.labRequests?.length || token.doctorOrders?.radiologyRequests?.length) ||
  Boolean(token.diagnosticReports?.length);

const reportMatchesToken = (report: LabResult, token: ReceptionToken) =>
  report.encounterTokenId === token.id ||
  Boolean(token.diagnosticReports?.some(
    (tokenReport) => tokenReport.testOrStudyName.trim().toLowerCase() === report.testName.trim().toLowerCase()
  ));

const formatPatientName = (patient: Patient) =>
  [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ');

export const LabDiagnostics: React.FC = () => {
  const { patients, receptionTokens, setSelectedPatientId, setActiveTab } = useHospital();
  const [searchQuery, setSearchQuery] = useState('');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [selectedPatientId, setLocalSelectedPatientId] = useState<string | null>(null);
  const [reportSection, setReportSection] = useState<DiagnosticSection>('laboratory');
  const [detailViewMode, setDetailViewMode] = useState<'reports' | 'trends'>('reports');
  const [selectedTrendTest, setSelectedTrendTest] = useState<string | undefined>(undefined);

  const diagnosticTokens = useMemo(
    () => receptionTokens.filter(isDiagnosticToken).sort(compareTokens),
    [receptionTokens]
  );

  const patientRows = useMemo(
    () =>
      patients
        .map((patient) => {
          const patientTokens = diagnosticTokens.filter((token) => token.patientId === patient.id);
          const reports = patient.labResults || [];
          return { patient, tokens: patientTokens, reports };
        })
        .filter(({ tokens, reports }) => tokens.length > 0 || reports.length > 0),
    [patients, diagnosticTokens]
  );

  const filteredPatients = patientRows.filter(({ patient, tokens, reports }) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQueue = queueFilter === 'all' || tokens.some((token) => {
      const tokenText = [
        token.department,
        ...(token.diagnosticReports || []).map((report) => report.department),
      ].join(' ');
      return queueFilter === 'radiology'
        ? /radiolog|imaging/i.test(tokenText)
        : /lab|laboratory/i.test(tokenText) || token.serviceType === 'Lab Sample';
    }) || reports.some((report) => queueFilter === 'radiology'
      ? isRadiologyReport(report)
      : !isRadiologyReport(report));
    const matchesSearch = !query || [
      formatPatientName(patient),
      patient.id,
      patient.rgNo || '',
      ...tokens.flatMap((token) => [token.tokenNumber, token.patientDetails?.registrationNumber || '']),
    ].some((value) => value.toLowerCase().includes(query));
    return matchesQueue && matchesSearch;
  });

  const selectedPatientRow =
    filteredPatients.find(({ patient }) => patient.id === selectedPatientId) ||
    patientRows.find(({ patient }) => patient.id === selectedPatientId);
  const selectedPatient = selectedPatientRow?.patient;
  const selectedReports = selectedPatientRow?.reports || [];
  const displayedReports = selectedReports
    .filter((report) => reportSection === 'radiology'
      ? isRadiologyReport(report)
      : !isRadiologyReport(report))
    .sort((first, second) => {
      const firstToken = selectedPatientRow?.tokens.find((token) => reportMatchesToken(first, token));
      const secondToken = selectedPatientRow?.tokens.find((token) => reportMatchesToken(second, token));
      if (firstToken && secondToken) return compareTokens(firstToken, secondToken);
      if (firstToken) return -1;
      if (secondToken) return 1;
      return (second.resultDate || second.orderedDate).localeCompare(first.resultDate || first.orderedDate);
    });

  const handleSelectPatient = (patientId: string) => {
    setLocalSelectedPatientId(patientId);
    setSelectedPatientId(patientId);
  };

  const openPatientProfile = () => {
    if (!selectedPatient) return;
    setSelectedPatientId(selectedPatient.id);
    setActiveTab('patients');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 lg:p-6">
      <header className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <FileText className="h-4 w-4" />
            </span>
            <h1 className="text-base font-bold text-slate-900">Lab &amp; Radiology</h1>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
              {diagnosticTokens.length} tokens
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Search by token or registration number, then select a patient to review reports.
          </p>
        </div>
      </header>

      <div className="grid min-h-[34rem] gap-4 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.7fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-3 border-b border-slate-200 bg-slate-50/70 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="Search patients by token number or registration number"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Token no. or registration no."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <div className="flex gap-1" role="group" aria-label="Filter diagnostic tokens">
              {([
                ['all', 'All'],
                ['laboratory', 'Lab'],
                ['radiology', 'Radiology'],
              ] as const).map(([filter, label]) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={queueFilter === filter}
                  onClick={() => setQueueFilter(filter)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    queueFilter === filter
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredPatients.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <FlaskConical className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-800">No patients found</p>
              <p className="mt-1 text-xs text-slate-500">Try a token number, registration number, or another department filter.</p>
            </div>
          ) : (
            <div className="max-h-[38rem] divide-y divide-slate-100 overflow-y-auto">
              {filteredPatients.map(({ patient, tokens, reports }) => (
                <button
                  key={patient.id}
                  type="button"
                  aria-pressed={patient.id === selectedPatientId}
                  onClick={() => handleSelectPatient(patient.id)}
                  className={`w-full p-3 text-left transition hover:bg-teal-50/60 ${
                    patient.id === selectedPatientId ? 'bg-teal-50 ring-1 ring-inset ring-teal-200' : ''
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <PatientAvatar patientId={patient.id} name={formatPatientName(patient)} gender={patient.gender} imageUrl={patient.photo || patient.avatar} size="sm" />
                      <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-slate-900">{formatPatientName(patient)}</span>
                      <span className="mt-1 block font-mono text-[10px] text-slate-500">
                        Reg. no: {patient.rgNo || patient.id}
                      </span>
                      </span>
                    </span>
                    <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {reports.length} reports
                    </span>
                  </span>
                  {tokens.length > 0 && (
                    <span className="mt-2 flex flex-wrap gap-1">
                      {[...tokens].sort(compareTokens).map((token) => (
                        <span
                          key={token.id}
                          className="rounded border border-teal-100 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-teal-800"
                          title={`${token.department} · ${token.visitDate || token.createdDate || ''}`}
                        >
                          {token.tokenNumber}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {!selectedPatient ? (
            <div className="flex h-full min-h-80 flex-col items-center justify-center p-6 text-center">
              <UserRound className="h-9 w-9 text-slate-300" />
              <h2 className="mt-3 text-sm font-semibold text-slate-800">Select a patient</h2>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                The patient&apos;s laboratory and radiology reports will appear separately here.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">{formatPatientName(selectedPatient)}</h2>
                  <p className="mt-1 font-mono text-[10px] text-slate-500">
                    Registration no: {selectedPatient.rgNo || selectedPatient.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setDetailViewMode('reports')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1.5 ${
                        detailViewMode === 'reports'
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Reports List
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailViewMode('trends')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1.5 ${
                        detailViewMode === 'trends'
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <LineChart className="w-3.5 h-3.5" />
                      Progress Trends
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={openPatientProfile}
                    className="rounded-md border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50"
                  >
                    Open patient profile
                  </button>
                </div>
              </div>

              {detailViewMode === 'trends' ? (
                <div className="p-4 overflow-y-auto max-h-[38rem]">
                  <LabTestTrendVisualizer
                    patient={selectedPatient}
                    reports={selectedPatient.labResults || []}
                    initialSelectedTestName={selectedTrendTest}
                    onBackToList={() => setDetailViewMode('reports')}
                  />
                </div>
              ) : (
                <>
                  <div className="flex gap-1 border-b border-slate-200 px-3 pt-3" role="tablist" aria-label="Patient diagnostic reports">
                    {([
                      ['laboratory', 'Laboratory'],
                      ['radiology', 'Radiology'],
                    ] as const).map(([section, label]) => {
                      const count = selectedReports.filter((report) => section === 'radiology'
                        ? isRadiologyReport(report)
                        : !isRadiologyReport(report)).length;
                      return (
                        <button
                          key={section}
                          type="button"
                          role="tab"
                          aria-selected={reportSection === section}
                          onClick={() => setReportSection(section)}
                          className={`rounded-t-md border-b-2 px-3 py-2 text-xs font-semibold ${
                            reportSection === section
                              ? 'border-teal-700 text-teal-800'
                              : 'border-transparent text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {label} <span className="ml-1 text-slate-400">{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {displayedReports.length === 0 ? (
                    <div className="px-4 py-12 text-center">
                      <FlaskConical className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-semibold text-slate-800">No {reportSection} reports</p>
                      <p className="mt-1 text-xs text-slate-500">Reports for this patient will appear here when available.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-[36rem] overflow-y-auto">
                      {displayedReports.map((report) => {
                        const reportToken = selectedPatientRow?.tokens.find((token) => reportMatchesToken(report, token));
                        const isLab = !isRadiologyReport(report);

                        return (
                          <article key={report.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-xs font-bold text-slate-900">{report.testName}</h3>
                                {isLab && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedTrendTest(report.testName);
                                      setDetailViewMode('trends');
                                    }}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded border border-teal-200 transition"
                                    title="View historical trend line chart for this test"
                                  >
                                    <LineChart className="w-3 h-3 text-teal-600" />
                                    Trend
                                  </button>
                                )}
                              </div>
                              <p className="mt-1 text-[11px] text-slate-600">
                                {report.department || report.category}
                                {report.modality ? ` · ${report.modality}` : ''}
                              </p>
                              <p className="mt-1 text-[11px] font-medium text-slate-700">{report.findings || report.value}</p>
                              {report.referenceRange && (
                                <p className="mt-0.5 text-[10px] text-slate-500">Normal Range: {report.referenceRange}</p>
                              )}
                              {report.impression && <p className="mt-1 text-[11px] text-slate-500 italic">{report.impression}</p>}
                            </div>
                            <div className="flex flex-wrap items-start gap-1.5 sm:justify-end">
                              {reportToken && (
                                <span className="rounded border border-teal-100 bg-teal-50 px-2 py-1 font-mono text-[10px] font-bold text-teal-800">
                                  Token {reportToken.tokenNumber}
                                </span>
                              )}
                              <span className={`rounded border px-2 py-1 text-[10px] font-bold ${
                                report.status === 'Critical'
                                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                                  : report.status === 'Pending'
                                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                                    : report.status === 'Elevated'
                                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              }`}>
                                {report.status}
                              </span>
                              <span className="w-full text-right text-[10px] text-slate-500">
                                {report.resultDate || report.orderedDate}
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};
