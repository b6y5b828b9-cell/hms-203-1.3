import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Ticket,
  Printer,
  Calendar,
  PieChart,
  Users,
  BedDouble,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { DailyMonthlyYearlySalesView } from './reports/DailyMonthlyYearlySalesView';
import { DailyTokensView } from './reports/DailyTokensView';
import { DoctorPerformanceReport } from './reports/DoctorPerformanceReport';

type ReportTab = 'sales' | 'tokens' | 'doctor' | 'executive';

export const ReportsAnalytics: React.FC = () => {
  const { currentRole, invoices, receptionTokens } = useHospital();
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              {currentRole === 'receptionist'
                ? 'Financial Report & Daily Reception Token Operations'
                : 'Hospital Financial Intelligence & Analytics'}
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold uppercase">
              AUDITED
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            {currentRole === 'receptionist'
              ? 'Consolidated view of daily sales, monthly sales, yearly sales under the same slide, and live tracking of daily tokens created with status monitoring.'
              : 'Enterprise healthcare financial metrics, daily/monthly/yearly revenue reconciliation, patient queue throughput, and bed turnover statistics.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Current Slide</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'sales'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Daily, Monthly & Yearly Sales</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'sales' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Same Slide
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tokens')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'tokens'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>Daily Tokens Created & Status</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'tokens' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {receptionTokens.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('doctor')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'doctor'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Doctor Reports</span>
          </button>

          {currentRole !== 'receptionist' && (
            <button
              onClick={() => setActiveTab('executive')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'executive'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Executive Clinical KPIs</span>
            </button>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-mono pr-2">
          <span>FY26 REVENUE CYCLE</span>
        </div>
      </div>

      {/* RENDER ACTIVE REPORT TAB */}
      {activeTab === 'sales' && <DailyMonthlyYearlySalesView />}
      {activeTab === 'tokens' && <DailyTokensView />}
      {activeTab === 'doctor' && <DoctorPerformanceReport />}

      {/* OPTIONAL EXECUTIVE TAB (FOR ADMINS) */}
      {activeTab === 'executive' && currentRole !== 'receptionist' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Invoices Issued
              </span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{invoices.length}</div>
              <span className="text-[11px] text-slate-500 mt-1 block">Patient Financial Records</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Average Wait Time
              </span>
              <div className="text-2xl font-bold text-slate-900 mt-1">12.4 min</div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                Front desk check-in to triage
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Payer Turnaround
              </span>
              <div className="text-2xl font-bold text-slate-900 mt-1">3.2 Days</div>
              <span className="text-[11px] text-blue-600 font-semibold mt-1 block">
                Electronic pre-authorisation clearance
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
