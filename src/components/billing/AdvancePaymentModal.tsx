import React, { useState } from 'react';
import { X, DollarSign, CreditCard, Building, CheckCircle2, AlertCircle } from 'lucide-react';
import { useHospital } from '../../context/HospitalContext';
import { AdvancePayment } from '../../types';
import { PatientLookup } from './PatientLookup';

interface AdvancePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentCreated?: (payment: AdvancePayment) => void;
}

export const AdvancePaymentModal: React.FC<AdvancePaymentModalProps> = ({
  isOpen,
  onClose,
  onPaymentCreated,
}) => {
  const { patients, receptionTokens, addAdvancePayment, currentUser } = useHospital();

  const [patientId, setPatientId] = useState('');
  const [amount, setAmount] = useState('500.00');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Credit/Debit Card' | 'Wire Transfer'>('Credit/Debit Card');
  const [terminalId, setTerminalId] = useState('POS-TERM-01 (Verifone)');
  const [purpose, setPurpose] = useState<'Inpatient Bed Admission' | 'OT / Surgical Deposit' | 'OPD Retainer' | 'Emergency Deposit' | 'Diagnostic Workup'>('Inpatient Bed Admission');
  const [notes, setNotes] = useState('Pre-admission financial deposit deposit retainer.');
  const [cashierName, setCashierName] = useState(currentUser?.name || 'Chloe Bennett (Reception Desk A)');
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (isOpen) setPatientId('');
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedPatient = patients.find((p) => p.id === patientId);

  const printAdvanceReceipt = (payment: AdvancePayment, patient: typeof selectedPatient) => {
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) return;

    const escapeHtml = (value: string | number | undefined | null) =>
      String(value ?? 'Not recorded')
        .replace(/[&<>"']/g, (character) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character] || character);

    const patientName = `${patient?.firstName || ''} ${patient?.middleName || ''} ${patient?.lastName || ''}`.replace(/\s+/g, ' ').trim() || payment.patientName;
    const patientAddress = patient?.address || 'Not recorded';
    const patientPhone = patient?.phone || 'Not recorded';
    const patientDob = patient?.dob || 'Not recorded';
    const patientGender = patient?.gender || 'Not recorded';
    const patientRgNo = patient?.rgNo || 'Not recorded';
    const patientEmail = patient?.email || 'Not recorded';
    const patientNationality = patient?.nationality || 'Not recorded';
    const issuedAt = `${payment.date} at ${payment.time}`;
    const availableBalance = Number(payment.remainingBalance || 0);

    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Advance Payment Receipt ${escapeHtml(payment.receiptNumber)}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #0f172a; font: 12px Arial, sans-serif; }
            .receipt { max-width: 780px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f766e; padding-bottom: 12px; }
            .brand { font-size: 18px; font-weight: 900; letter-spacing: 0.04em; }
            .company { margin-top: 2px; color: #475569; font-size: 10px; text-transform: uppercase; }
            .status { padding: 5px 9px; border-radius: 6px; background: #dcfce7; color: #166534; font-size: 10px; font-weight: 800; text-transform: uppercase; }
            .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 18px 0; }
            .meta div { padding: 9px 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
            .label { display: block; color: #64748b; font-size: 9px; text-transform: uppercase; }
            .value { display: block; margin-top: 3px; font-weight: 700; overflow-wrap: anywhere; }
            section { margin-top: 18px; }
            h2 { margin: 0 0 9px; color: #0f172a; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
            th { color: #64748b; font-size: 9px; text-transform: uppercase; }
            .amount { text-align: right; white-space: nowrap; font-family: monospace; font-weight: 700; }
            .total { margin-top: 12px; padding: 10px 12px; border: 1px solid #a7f3d0; border-radius: 8px; background: #f0fdf4; }
            .total-row { display: flex; justify-content: space-between; margin-top: 6px; }
            .totals { margin-left: auto; width: 260px; }
            .notes { margin-top: 16px; padding: 10px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 10px; }
            .footer { margin-top: 30px; padding-top: 14px; border-top: 1px dashed #94a3b8; display: flex; justify-content: space-between; gap: 20px; color: #64748b; font-size: 9px; }
            .signature { width: 160px; text-align: center; }
            .signature-line { margin-top: 18px; border-bottom: 1px solid #64748b; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <div>
                <div class="brand">ASCENSION MEDICAL CENTER</div>
                <div class="company">Hospital · Finance &amp; Patient Services</div>
              </div>
              <span class="status">${escapeHtml(payment.status)}</span>
            </div>

            <div class="meta">
              <div><span class="label">Receipt number</span><span class="value">${escapeHtml(payment.receiptNumber)}</span></div>
              <div><span class="label">Issue date &amp; time</span><span class="value">${escapeHtml(issuedAt)}</span></div>
              <div><span class="label">Patient registration number</span><span class="value">${escapeHtml(patientRgNo)}</span></div>
              <div><span class="label">Patient MRN</span><span class="value">${escapeHtml(payment.patientMrn)}</span></div>
            </div>

            <section>
              <h2>Patient details</h2>
              <table>
                <tr><th>Name</th><td>${escapeHtml(patientName)}</td></tr>
                <tr><th>Date of birth</th><td>${escapeHtml(patientDob)}</td></tr>
                <tr><th>Gender</th><td>${escapeHtml(patientGender)}</td></tr>
                <tr><th>Nationality</th><td>${escapeHtml(patientNationality)}</td></tr>
                <tr><th>Phone</th><td>${escapeHtml(patientPhone)}</td></tr>
                <tr><th>Email</th><td>${escapeHtml(patientEmail)}</td></tr>
                <tr><th>Address</th><td>${escapeHtml(patientAddress)}</td></tr>
              </table>
            </section>

            <section>
              <h2>Payment details</h2>
              <table>
                <thead><tr><th>Item</th><th>Details</th><th class="amount">Amount</th></tr></thead>
                <tbody>
                  <tr><td>Advance payment</td><td>${escapeHtml(payment.purpose)}</td><td class="amount">$${Number(payment.amount).toFixed(2)}</td></tr>
                </tbody>
              </table>
              <div class="total">
                <div class="totals">
                  <div class="total-row"><span>Advance deposited</span><strong>$${Number(payment.amount).toFixed(2)}</strong></div>
                  <div class="total-row"><span>Available balance</span><strong>$${availableBalance.toFixed(2)}</strong></div>
                </div>
              </div>
            </section>

            <section>
              <h2>Payment method</h2>
              <table>
                <tr><th>Method</th><td>${escapeHtml(payment.paymentMethod)}</td></tr>
                <tr><th>Terminal</th><td>${escapeHtml(payment.terminalId || 'Not recorded')}</td></tr>
                <tr><th>Cashier</th><td>${escapeHtml(payment.cashierName)}</td></tr>
                <tr><th>Receipt status</th><td>${escapeHtml(payment.status)}</td></tr>
              </table>
            </section>

            ${payment.notes ? `<div class="notes"><strong>Remarks:</strong> ${escapeHtml(payment.notes)}</div>` : ''}

            <div class="footer">
              <div><strong>Official hospital receipt</strong><br>Generated by MedCore OS</div>
              <div class="signature"><div class="signature-line"></div><span>Authorized signature</span></div>
            </div>
          </div>
          <script>window.onload = function () { window.focus(); window.print(); };</script>
        </body>
      </html>`);
    printWindow.document.close();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid deposit amount greater than $0.');
      return;
    }

    if (!selectedPatient) {
      setError('Please select a valid patient.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const newPayment = addAdvancePayment({
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
      patientMrn: selectedPatient.id,
      amount: parsedAmount,
      paymentMethod,
      date: today,
      time,
      purpose,
      remainingBalance: parsedAmount,
      status: 'Active',
      cashierName,
      terminalId: paymentMethod === 'Credit/Debit Card' ? terminalId : undefined,
      notes,
    });

    printAdvanceReceipt(newPayment, selectedPatient);

    if (onPaymentCreated) {
      onPaymentCreated(newPayment);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Collect Advance Payment Deposit</h3>
              <p className="text-[11px] text-slate-300">Issue official advance deposit receipt & allocate balance</p>
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
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Patient Selection */}
          <PatientLookup
            patients={patients}
            tokens={receptionTokens}
            selectedPatientId={patientId}
            onSelect={setPatientId}
            accent="emerald"
          />

          {/* Amount & Purpose */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Advance Amount ($ USD)</label>
              <div className="relative">
                <span className="text-slate-400 font-bold absolute left-3 top-2">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Deposit Purpose</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="Inpatient Bed Admission">Inpatient Bed Admission</option>
                <option value="OT / Surgical Deposit">OT / Surgical Deposit</option>
                <option value="OPD Retainer">OPD Retainer</option>
                <option value="Emergency Deposit">Emergency Deposit</option>
                <option value="Diagnostic Workup">Diagnostic Workup</option>
              </select>
            </div>
          </div>

          {/* Payment Method & Terminal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="Credit/Debit Card">Credit/Debit Card (POS)</option>
                <option value="Cash">Cash (Front Desk Drawer)</option>
                <option value="Wire Transfer">Wire / Online Transfer</option>
              </select>
            </div>

            {paymentMethod === 'Credit/Debit Card' ? (
              <div>
                <label className="block font-bold text-slate-700 mb-1">POS Terminal</label>
                <select
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="POS-TERM-01 (Verifone)">Desk A - Verifone V200c</option>
                  <option value="POS-TERM-02 (Ingenico)">Desk B - Ingenico Move5000</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Cash Register Drawer</label>
                <input
                  type="text"
                  readOnly
                  value="Desk A Main Drawer (USD Cash)"
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 font-medium"
                />
              </div>
            )}
          </div>

          {/* Cashier & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Collecting Cashier</label>
              <input
                type="text"
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Notes / Reference</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional pre-auth or admitting doctor remarks..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
              />
            </div>
          </div>

          {/* Info Callout */}
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight">
              An official advance receipt with a unique receipt number will be generated. The remaining balance can be adjusted against future hospital invoices or refunded.
            </div>
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
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm & Issue Receipt</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
