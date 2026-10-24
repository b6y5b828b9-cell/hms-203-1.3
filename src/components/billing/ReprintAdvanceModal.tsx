import React, { useState } from 'react';
import { X, Printer, DollarSign, Search, CheckCircle2, ShieldCheck, Building2, User } from 'lucide-react';
import { useHospital } from '../../context/HospitalContext';
import { AdvancePayment } from '../../types';

interface ReprintAdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAdvanceId?: string;
}

export const ReprintAdvanceModal: React.FC<ReprintAdvanceModalProps> = ({
  isOpen,
  onClose,
  initialAdvanceId,
}) => {
  const { advancePayments } = useHospital();
  const [selectedAdvanceId, setSelectedAdvanceId] = useState(
    initialAdvanceId || advancePayments[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const currentAdvance =
    advancePayments.find((adv) => adv.id === selectedAdvanceId) || advancePayments[0];

  const filteredAdvances = advancePayments.filter(
    (adv) =>
      adv.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      adv.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      adv.patientMrn.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Reprint Advance Payment Receipt
              </h3>
              <p className="text-[11px] text-slate-300">
                Official advance financial deposit voucher print preview
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Advance Selector Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="font-bold text-slate-700 whitespace-nowrap">Select Deposit:</span>
            <select
              value={selectedAdvanceId}
              onChange={(e) => setSelectedAdvanceId(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-mono font-medium max-w-xs"
            >
              {filteredAdvances.map((adv) => (
                <option key={adv.id} value={adv.id}>
                  {adv.receiptNumber} — {adv.patientName} (${adv.amount.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search receipt # or patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>

        {/* Printable View */}
        <div className="p-6 sm:p-8 overflow-y-auto bg-slate-100 flex-1 flex justify-center">
          {currentAdvance ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-md p-6 sm:p-7 w-full max-w-lg text-slate-800 font-sans print:border-none print:shadow-none print:p-0">
              {/* Receipt Header */}
              <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    +
                  </div>
                  <h1 className="text-sm font-black tracking-tight text-slate-900 uppercase">
                    Ascension Medical Center & Hospitals
                  </h1>
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                  Advance Financial Deposit Receipt
                </div>
                <div className="text-[10px] text-slate-400">
                  Front Desk Cashier Services • Department of Finance
                </div>
              </div>

              {/* Receipt Details Box */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-3.5 space-y-2 text-xs mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt Voucher No:</span>
                  <span className="font-mono font-bold text-slate-900">{currentAdvance.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction Date & Time:</span>
                  <span className="font-medium text-slate-800">{currentAdvance.date} at {currentAdvance.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Patient Name:</span>
                  <span className="font-bold text-slate-900">{currentAdvance.patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Patient MRN ID:</span>
                  <span className="font-mono text-slate-700">{currentAdvance.patientMrn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Deposit Purpose:</span>
                  <span className="font-semibold text-slate-800">{currentAdvance.purpose}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Instrument:</span>
                  <span className="font-medium text-slate-800">{currentAdvance.paymentMethod}</span>
                </div>
                {currentAdvance.terminalId && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Card Terminal / POS:</span>
                    <span className="font-mono text-slate-700">{currentAdvance.terminalId}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Collecting Cashier:</span>
                  <span className="text-slate-800">{currentAdvance.cashierName}</span>
                </div>
              </div>

              {/* Financial Box */}
              <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-3.5 space-y-2 text-xs mb-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    Total Advance Deposited:
                  </span>
                  <span className="text-lg font-bold font-mono text-emerald-700">
                    ${currentAdvance.amount.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-emerald-200/60 pt-1.5 text-[11px]">
                  <span className="text-slate-600">Available Remaining Balance:</span>
                  <span className="font-bold font-mono text-slate-900">
                    ${currentAdvance.remainingBalance.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-600">Status:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {currentAdvance.status}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {currentAdvance.notes && (
                <div className="text-[10px] text-slate-500 bg-white border border-slate-200 rounded p-2 mb-4">
                  <span className="font-semibold text-slate-700">Remarks: </span>
                  {currentAdvance.notes}
                </div>
              )}

              {/* Signature / Legal */}
              <div className="border-t border-dashed border-slate-300 pt-4 flex items-center justify-between text-[9px] text-slate-500">
                <div>
                  <div>* Please retain this receipt for discharge settlement *</div>
                  <div>Ascension Medical Center • Automated Hospital POS System</div>
                </div>
                <div className="text-right">
                  <div className="border-b border-slate-400 w-28 mb-1"></div>
                  <span>Authorized Signature</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-400 p-8">No advance payment record selected.</div>
          )}
        </div>
      </div>
    </div>
  );
};
