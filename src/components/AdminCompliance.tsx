import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  FileCheck,
  Database,
  Download,
  AlertTriangle,
  CheckCircle2,
  Key,
  HardDrive,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';

export const AdminCompliance: React.FC = () => {
  const {
    auditLogs,
    isBackupOverdue,
    lastBackupTimestamp,
    performDatabaseBackup,
    resetHospitalData,
  } = useHospital();

  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const handleBackup = (format: 'json' | 'csv') => {
    performDatabaseBackup(format);
    setDownloadNotice(`Backup archive downloaded as .${format.toUpperCase()} successfully.`);
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Hospital System Governance, Security & HIPAA Compliance
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold uppercase">
              HIPAA CERTIFIED
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Access authorization audits, institutional disaster recovery backups, 256-bit encryption safeguards, and role permission matrices.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleBackup('json')}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Full Backup</span>
          </button>
        </div>
      </div>

      {downloadNotice && (
        <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-lg text-center animate-in fade-in">
          {downloadNotice}
        </div>
      )}

      {/* Compliance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-xs text-slate-900">Encryption Standards</h3>
          </div>
          <p className="text-xs text-slate-500">
            FIPS 140-2 validated AES-256 GCM encryption at rest and TLS 1.3 in transit with perfect forward secrecy.
          </p>
          <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
            ACTIVE ENCRYPTION
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-xs text-slate-900">Disaster Recovery (24h)</h3>
          </div>
          <p className="text-xs text-slate-500">
            Automated snapshot reminder engine per HIPAA § 164.308(a)(7) guidelines.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => handleBackup('json')}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold cursor-pointer"
            >
              JSON Snapshot
            </button>
            <button
              onClick={() => handleBackup('csv')}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold cursor-pointer"
            >
              CSV Tables
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-purple-600" />
            <h3 className="font-bold text-xs text-slate-900">Role-Based Access (RBAC)</h3>
          </div>
          <p className="text-xs text-slate-500">
            Granular permission gates enforced across Doctors, Nurses, Reception, Pharmacists, and Administrators.
          </p>
          <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
            ZERO TRUST POLICIES
          </span>
        </div>
      </div>

      {/* Immutable Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              HIPAA Access & Mutation Audit Trail ({auditLogs.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            IMMUTABLE LOCAL RECORD
          </span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">User & Role</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Target Entity</th>
                <th className="py-2.5 px-3">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal font-mono text-[11px]">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2 px-3 whitespace-nowrap text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap text-slate-800">
                    {log.userName} ({log.userRole})
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-bold">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap text-blue-600 font-bold">
                    {log.targetEntity} {log.targetId ? `(${log.targetId})` : ''}
                  </td>
                  <td className="py-2 px-3 text-slate-600 font-sans text-xs">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
