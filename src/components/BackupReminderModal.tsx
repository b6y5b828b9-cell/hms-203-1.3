import React, { useState } from 'react';
import {
  X,
  Database,
  Download,
  CheckCircle2,
  Clock,
  ShieldCheck,
  HardDrive,
  FileSpreadsheet,
  AlertTriangle,
  FileCode,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';

export const BackupReminderModal: React.FC = () => {
  const {
    showBackupReminderModal,
    setShowBackupReminderModal,
    isBackupOverdue,
    lastBackupTimestamp,
    performDatabaseBackup,
    patients,
    appointments,
    invoices,
    staff,
    pharmacy,
  } = useHospital();

  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!showBackupReminderModal) return null;

  const handleBackup = (format: 'json' | 'csv') => {
    performDatabaseBackup(format);
    setDownloadSuccess(`Database exported in .${format.toUpperCase()} format successfully!`);
    setTimeout(() => {
      setDownloadSuccess(null);
    }, 4000);
  };

  const formattedLastBackup = lastBackupTimestamp
    ? new Date(lastBackupTimestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never performed';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150 select-none">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">
                24-Hour Database Backup & Compliance
              </h2>
              <p className="text-[10px] text-slate-400">
                Hospital Data Governance & HIPAA Disaster Recovery Protocol
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowBackupReminderModal(false)}
            className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {isBackupOverdue ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Routine 24-Hour Backup Alert</span>
                <span className="text-[11px] text-amber-800">
                  More than 24 hours have elapsed since the last hospital snapshot was saved. Generating a fresh offline backup ensures continuity.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Backup Status Healthy</span>
                <span className="text-[11px] text-emerald-800">
                  Hospital database snapshot is up-to-date and compliant with institutional guidelines.
                </span>
              </div>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Last Verified Backup:</span>
              </span>
              <span className="font-mono font-bold text-slate-900">{formattedLastBackup}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200">
              <span className="flex items-center gap-1.5 font-medium">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                <span>Current Hospital Records:</span>
              </span>
              <span className="font-semibold text-slate-800">
                {patients.length} Patients · {appointments.length} Appointments · {invoices.length} Invoices
              </span>
            </div>
          </div>

          <div>
            <span className="font-bold text-slate-700 block mb-2">
              Select Immediate Export Archive Format:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleBackup('json')}
                className="p-3 rounded-lg border-2 border-slate-200 hover:border-blue-600 hover:bg-blue-50/40 text-left transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <FileCode className="w-4 h-4 text-blue-600" />
                  <div>
                    <span className="font-bold text-slate-800 group-hover:text-blue-700 block">
                      JSON Full Snapshot
                    </span>
                    <span className="text-[10px] text-slate-400">Complete restore bundle</span>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              </button>

              <button
                type="button"
                onClick={() => handleBackup('csv')}
                className="p-3 rounded-lg border-2 border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40 text-left transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <div>
                    <span className="font-bold text-slate-800 group-hover:text-emerald-700 block">
                      CSV Tabular Export
                    </span>
                    <span className="text-[10px] text-slate-400">Excel / BI Analytics</span>
                  </div>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
              </button>
            </div>
          </div>

          {downloadSuccess && (
            <div className="p-2.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 font-semibold text-center animate-in fade-in">
              {downloadSuccess}
            </div>
          )}

          <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>HIPAA § 164.308(a)(7) Disaster Recovery Plan</span>
            </span>
            <span className="font-mono text-[10px] text-slate-400">256-BIT CHECKSUM</span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowBackupReminderModal(false)}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold text-xs transition cursor-pointer"
          >
            Dismiss Reminder
          </button>
        </div>
      </div>
    </div>
  );
};
