import React, { useState } from 'react';
import { X, RotateCcw, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { useHospital } from '../../context/HospitalContext';
import { RefundPayment } from '../../types';
import { PatientLookup } from './PatientLookup';

interface RefundPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefundCreated?: (refund: RefundPayment) => void;
}

export const RefundPaymentModal: React.FC<RefundPaymentModalProps> = ({
  isOpen,
  onClose,
  onRefundCreated,
}) => {
  const { patients, receptionTokens, advancePayments, invoices, addRefundPayment, currentUser } = useHospital();

  const [patientId, setPatientId] = useState('');
  const [refundSource, setRefundSource] = useState<'Advance Deposit' | 'Invoice Overpayment' | 'Service Cancellation'>('Advance Deposit');
  const [selectedAdvanceId, setSelectedAdvanceId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState('100.00');
  const [refundMethod, setRefundMethod] = useState<'Cash' | 'Card Reversal' | 'Bank Transfer' | 'Cheque'>('Cash');
  const [reason, setReason] = useState<RefundPayment['reason']>('Procedure Cancelled');
  const [cashierName, setCashierName] = useState(currentUser?.name || 'Chloe Bennett (Reception Desk A)');
  const [notes, setNotes] = useState('Patient requested elective procedure cancellation 24h prior.');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setPatientId('');
      setSelectedAdvanceId('');
      setSelectedInvoiceId('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedPatient = patients.find((p) => p.id === patientId);
  const patientAdvances = advancePayments.filter((a) => a.patientId === selectedPatient?.id && a.remainingBalance > 0);
  const patientInvoices = invoices.filter((invoice) =>
    invoice.patientId === selectedPatient?.id &&
    (Number(invoice.amountPaid) || 0) - (Number(invoice.refundedAmount) || 0) > 0
  );

  const activeAdvance = patientAdvances.find((a) => a.id === selectedAdvanceId) || patientAdvances[0];
  const activeInvoice = patientInvoices.find((invoice) => invoice.id === selectedInvoiceId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid refund amount greater than $0.');
      return;
    }

    if (!selectedPatient) {
      setError('Please select a valid patient.');
      return;
    }

    if (refundSource === 'Advance Deposit') {
      if (!activeAdvance) {
        setError('No active advance deposit with remaining balance found for this patient.');
        return;
      }
      if (parsedAmount > activeAdvance.remainingBalance) {
        setError(`Refund amount cannot exceed remaining deposit balance of $${activeAdvance.remainingBalance.toFixed(2)}.`);
        return;
      }
    }
    if (refundSource !== 'Advance Deposit') {
      if (!activeInvoice) {
        setError('Select the paid invoice related to this refund.');
        return;
      }
      const refundableAmount = (Number(activeInvoice.amountPaid) || 0) - (Number(activeInvoice.refundedAmount) || 0);
      if (parsedAmount > refundableAmount) {
        setError(`Refund cannot exceed the remaining paid balance on this invoice ($${refundableAmount.toFixed(2)}).`);
        return;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const refId =
      refundSource === 'Advance Deposit'
        ? activeAdvance?.receiptNumber || activeAdvance?.id || 'ADV-REF'
        : selectedInvoiceId || 'INV-REF';

    const newRefund = addRefundPayment({
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
      originalReferenceType: refundSource,
      originalReferenceId: refId,
      amount: parsedAmount,
      refundMethod,
      reason,
      date: today,
      time,
      authorizedBy: 'Pending manager approval',
      cashierName,
      status: 'Pending Approval',
      notes,
    });

    if (onRefundCreated) {
      onRefundCreated(newRefund);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Process Patient Refund Voucher</h3>
              <p className="text-[11px] text-slate-300">Issue official reimbursement voucher & rebalance ledger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Patient Selection */}
          <PatientLookup
            patients={patients}
            tokens={receptionTokens}
            selectedPatientId={patientId}
            onSelect={(id) => {
              setPatientId(id);
              setSelectedAdvanceId('');
              setSelectedInvoiceId('');
            }}
            accent="rose"
          />

          {/* Refund Source & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Refund Source</label>
              <select
                value={refundSource}
                onChange={(e) => setRefundSource(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
              >
                <option value="Advance Deposit">Advance Deposit Balance</option>
                <option value="Invoice Overpayment">Invoice Overpayment</option>
                <option value="Service Cancellation">Service Cancellation</option>
              </select>
            </div>

            {refundSource === 'Advance Deposit' ? (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Advance Receipt</label>
                {patientAdvances.length > 0 ? (
                  <select
                    value={selectedAdvanceId || activeAdvance?.id}
                    onChange={(e) => {
                      setSelectedAdvanceId(e.target.value);
                      const adv = patientAdvances.find((a) => a.id === e.target.value);
                      if (adv) setAmount(adv.remainingBalance.toFixed(2));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
                  >
                    {patientAdvances.map((adv) => (
                      <option key={adv.id} value={adv.id}>
                        {adv.receiptNumber} (${adv.remainingBalance.toFixed(2)} avail)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                    No active advance with remaining funds found.
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Linked Invoice Number</label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
                >
                  <option value="">Select Invoice...</option>
                  {patientInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.id} (Paid: ${((Number(inv.amountPaid) || 0) - (Number(inv.refundedAmount) || 0)).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Amount & Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Refund Amount ($ USD)</label>
              <div className="relative">
                <span className="text-slate-400 font-bold absolute left-3 top-2">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500/20"
                  required
                />
              </div>
              {refundSource === 'Advance Deposit' && activeAdvance && (
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Max refundable: ${activeAdvance.remainingBalance.toFixed(2)}
                </span>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Disbursement Method</label>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="Cash">Cash (Disbursed from Front Desk)</option>
                <option value="Card Reversal">Card Terminal Reversal</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          {/* Reason & Authorization */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Reason for Refund</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
              >
                <option value="Procedure Cancelled">Procedure Cancelled</option>
                <option value="Duplicate Charge">Duplicate charge</option>
                <option value="Insurance Overpayment">Insurance overpayment</option>
                <option value="Excess Advance Deposit">Excess advance deposit</option>
                <option value="Service Cancelled">Service cancelled</option>
                <option value="Doctor Unavailable">Doctor unavailable</option>
                <option value="Patient Request">Patient request</option>
              </select>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
              This request will remain pending until an administrator approves it. No advance balance is changed before approval.
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Audit Justification & Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Clinical reason, cancellation approval details..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Submit for manager approval</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
