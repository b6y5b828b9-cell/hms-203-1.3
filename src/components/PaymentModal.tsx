import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  CheckCircle2,
  Printer,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { Invoice, PaymentMethod, PaymentTransaction } from '../types';
import { requestLoyaltyOtp, verifyLoyaltyOtp } from '../utils/loyaltyOtp';

interface PaymentModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ invoice, isOpen, onClose }) => {
  const { patients, advancePayments, receptionTokens, processSplitPayments } = useHospital();
  const [paymentLines, setPaymentLines] = useState<Array<{ id: string; method: PaymentMethod; amount: string; advanceId?: string }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [completedTxs, setCompletedTxs] = useState<PaymentTransaction[] | null>(null);
  const [error, setError] = useState('');
  const [settlementDate, setSettlementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [otpChallenge, setOtpChallenge] = useState<{ challengeId: string; maskedPhone: string } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [pointsAuthorizationToken, setPointsAuthorizationToken] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setPaymentLines(invoice ? [{ id: 'payment-1', method: 'Credit/Debit Card', amount: String(Number(invoice.balanceDue) || 0) }] : []);
    setCompletedTxs(null);
    setError('');
    setSettlementDate(new Date().toISOString().slice(0, 10));
    setOtpChallenge(null);
    setOtpCode('');
    setPointsAuthorizationToken('');
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, invoice?.id, invoice?.balanceDue]);

  if (!isOpen || !invoice) return null;

  const balanceDue = Number(invoice.balanceDue) || 0;
  const patient = patients.find((item) => item.id === invoice.patientId);
  const encounterToken = receptionTokens.find((token) => token.id === invoice.encounterTokenId);
  const patientAdvancePayments = advancePayments
    .filter((advance) => advance.patientId === invoice.patientId)
    .sort((first, second) =>
      second.date.localeCompare(first.date) ||
      second.time.localeCompare(first.time) ||
      second.id.localeCompare(first.id)
    );
  const totalAdvanceDeposited = patientAdvancePayments.reduce(
    (sum, advance) => sum + Math.max(0, Number(advance.amount) || 0),
    0
  );
  const availableAdvanceBalance = patientAdvancePayments.reduce(
    (sum, advance) => sum + Math.max(0, Number(advance.remainingBalance) || 0),
    0
  );
  const advanceLines = paymentLines.filter((line) => line.method === 'Patient Advance');
  const advanceDollars = advanceLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const availablePoints = patient?.loyaltyPoints || 0;
  const pointsLines = paymentLines.filter((line) => line.method === 'Loyalty Points');
  const pointsDollars = pointsLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const pointsRequired = Math.round(pointsDollars * 100);
  const updatePaymentLine = (id: string, updates: Partial<(typeof paymentLines)[number]>) => {
    setPaymentLines((lines) => lines.map((item) => item.id === id ? { ...item, ...updates } : item));
    setOtpChallenge(null);
    setOtpCode('');
    setPointsAuthorizationToken('');
  };

  const setAdvanceAmount = (advanceId: string, value: string) => {
    setPaymentLines((lines) => {
      const advance = patientAdvancePayments.find((item) => item.id === advanceId);
      if (!advance) return lines;
      const previousAmount = lines
        .filter((line) => line.method === 'Patient Advance' && line.advanceId === advanceId)
        .reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
      const requestedAmount = Number(value) || 0;
      const otherAdvanceAmount = advanceDollars - previousAmount;
      const maxAmount = Math.min(
        Math.max(0, Number(advance.remainingBalance) + previousAmount),
        Math.max(0, balanceDue - otherAdvanceAmount)
      );
      const nextAmount = value === ''
        ? ''
        : requestedAmount > maxAmount
        ? maxAmount.toFixed(2)
        : value;
      const withoutThisAdvance = lines.filter((line) => !(line.method === 'Patient Advance' && line.advanceId === advanceId));
      const nextLines = value !== ''
        ? [...withoutThisAdvance, { id: `advance-${advanceId}`, method: 'Patient Advance' as const, amount: nextAmount, advanceId }]
        : withoutThisAdvance;
      const totalAdvanceAmount = nextLines
        .filter((line) => line.method === 'Patient Advance')
        .reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
      let overflow = Math.max(0, nextLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0) - balanceDue);
      return nextLines.map((line) => {
        if (line.method === 'Patient Advance' || overflow <= 0) return line;
        const lineAmount = Number(line.amount) || 0;
        const reduction = Math.min(lineAmount, overflow);
        overflow -= reduction;
        return { ...line, amount: lineAmount > reduction ? (lineAmount - reduction).toFixed(2) : '' };
      }).filter((line) => line.method === 'Patient Advance' || Number(line.amount) > 0 || totalAdvanceAmount === 0);
    });
  };

  const handleRequestOtp = async () => {
    setError('');
    setIsRequestingOtp(true);
    try {
      const challenge = await requestLoyaltyOtp(invoice.id);
      setOtpChallenge(challenge);
      setOtpCode('');
      setPointsAuthorizationToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request an OTP. Use another payment method.');
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpChallenge || !otpCode.trim()) {
      setError('Enter the OTP sent to the registered patient number.');
      return;
    }
    setError('');
    setIsVerifyingOtp(true);
    try {
      const verification = await verifyLoyaltyOtp(otpChallenge.challengeId, otpCode.trim());
      setPointsAuthorizationToken(verification.authorizationToken);
      setOtpCode('');
    } catch (err) {
      setPointsAuthorizationToken('');
      setError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const payments = paymentLines
      .map(({ amount, method, advanceId }) => ({ amount: Number(amount), method, advanceId }))
      .filter((item) => item.amount > 0);
    const total = payments.reduce((sum, item) => sum + item.amount, 0);
    if (!payments.length || payments.length !== paymentLines.length || total > balanceDue + 0.001) {
      setError('Enter a positive amount for each payment and keep the total within the outstanding balance.');
      return;
    }
    if (pointsLines.length && !pointsAuthorizationToken) {
      setError('Verify the registered patient mobile OTP before using loyalty points.');
      return;
    }
    if (pointsRequired > availablePoints) {
      setError(`This payment needs ${pointsRequired} points; only ${availablePoints} are available.`);
      return;
    }
    setIsProcessing(true);
    try {
      const transactions = await processSplitPayments(invoice.id, paymentLines.map((line) => ({
        amount: Number(line.amount),
        method: line.method,
        advanceId: line.advanceId,
        pointsAuthorizationToken: line.method === 'Loyalty Points' ? pointsAuthorizationToken : undefined,
      })), settlementDate);
      setCompletedTxs(transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process this payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full overflow-hidden text-xs flex flex-col max-h-[92vh]">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                  Billing & Settlement
                </span>
              </div>
              <h2 className="font-bold text-sm text-white mt-0.5">Settle patient balance</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {completedTxs ? (
          <div className="p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Payment Cleared Successfully</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Amount of ${completedTxs.reduce((sum, transaction) => sum + transaction.amountPaid, 0).toFixed(2)} received across {completedTxs.length} payment {completedTxs.length === 1 ? 'method' : 'methods'}.
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-3 text-left space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>Transaction ID</span>
                <span className="font-bold text-slate-800">{completedTxs.map((tx) => tx.transactionId).join(', ')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Authorization Code</span>
                <span className="font-bold text-emerald-700">{completedTxs.map((tx) => tx.authCode).join(', ')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Invoice Linked</span>
                <span>{invoice.id}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Timestamp</span>
                <span>{new Date(completedTxs[0].timestamp).toLocaleString()}</span>
              </div>
              {completedTxs.map((transaction) => (
                <div key={transaction.transactionId} className="flex justify-between text-slate-600">
                  <span>{transaction.method}{transaction.loyaltyPointsRedeemed ? ` · ${transaction.loyaltyPointsRedeemed} points` : ''}{transaction.advanceAllocations?.length ? ` · ${transaction.advanceAllocations.map((allocation) => allocation.receiptNumber).join(', ')}` : ''}</span><span>${transaction.amountPaid.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={handlePrintReceipt}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print Receipt
              </button>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold text-xs cursor-pointer"
              >
                Return to Ledger
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePay} className="p-4 grid grid-cols-1 gap-3.5 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded flex justify-between items-center lg:col-span-2">
              <div>
                <div className="font-bold text-slate-800">{invoice.patientName}</div>
                <div className="text-[10px] text-slate-400 font-mono">Invoice: {invoice.id}</div>
                {invoice.encounterTokenId && <div className="text-[10px] font-semibold text-teal-700">Visit token: {encounterToken?.tokenNumber || invoice.encounterTokenId}</div>}
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Remaining Due</div>
                <div className="text-base font-bold font-mono text-slate-900">
                  ${(Number(balanceDue) || 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="space-y-2 lg:col-start-1 lg:row-start-2">
              <label className="block rounded-lg border border-slate-200 bg-white p-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Settlement date</span>
                <input
                  type="date"
                  value={settlementDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setSettlementDate(event.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs font-medium text-slate-800"
                />
              </label>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-slate-600">Payment methods</label>
                <button type="button" onClick={() => { setPaymentLines((lines) => [...lines, { id: `payment-${Date.now()}`, method: 'Cash', amount: '' }]); setPointsAuthorizationToken(''); setOtpChallenge(null); }} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50">
                  <Plus className="h-3 w-3" /> Add method
                </button>
              </div>
              {paymentLines.filter((line) => line.method !== 'Patient Advance').map((line) => (
                <div key={line.id} className="grid grid-cols-[1fr_120px_auto] gap-2">
                  <select aria-label="Payment method" value={line.method} onChange={(event) => updatePaymentLine(line.id, { method: event.target.value as PaymentMethod })} className="min-w-0 rounded border border-slate-300 bg-white px-2 py-2 text-xs">
                    <option value="Cash">Cash</option>
                    <option value="Credit/Debit Card">Credit card / POS</option>
                    <option value="ACH/Bank Transfer">Online transfer</option>
                    <option value="Direct Insurance">Direct insurance</option>
                    <option value="HSA/FSA">HSA / FSA</option>
                    <option value="Loyalty Points">Hospital loyalty points</option>
                  </select>
                  <input aria-label="Amount in dollars" type="number" step="0.01" min="0.01" max={line.method === 'Loyalty Points' ? Math.min(balanceDue, availablePoints / 100) : line.method === 'Patient Advance' ? Math.min(balanceDue, availableAdvanceBalance - advanceDollars + (Number(line.amount) || 0)) : balanceDue} value={line.amount} onChange={(event) => updatePaymentLine(line.id, { amount: event.target.value })} className="w-full rounded border border-slate-300 px-2 py-2 text-right font-mono text-xs" required />
                  <button type="button" aria-label="Remove payment method" disabled={paymentLines.length === 1} onClick={() => setPaymentLines((lines) => lines.filter((item) => item.id !== line.id))} className="rounded border border-slate-200 px-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {pointsLines.length > 0 && (
                <section className="space-y-2 rounded-lg border border-violet-200 bg-violet-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold text-violet-950">Loyalty points · 100 points = $1</p>
                      <p className="text-[10px] text-violet-800">Available: {availablePoints} points · Required: {pointsRequired} points (${pointsDollars.toFixed(2)})</p>
                    </div>
                    <button type="button" onClick={handleRequestOtp} disabled={isRequestingOtp || !pointsRequired || pointsRequired > availablePoints || !patient?.phone} className="rounded-md bg-violet-700 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50">
                      {isRequestingOtp ? 'Requesting…' : otpChallenge ? 'Resend code' : 'Send OTP'}
                    </button>
                  </div>
                  {!availablePoints && <p className="text-[10px] text-rose-700">No loyalty points are recorded for this patient.</p>}
                  {otpChallenge && (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="min-w-0 flex-1 text-[10px] font-semibold text-slate-700">
                        OTP sent to {otpChallenge.maskedPhone}
                        <input inputMode="numeric" autoComplete="one-time-code" value={otpCode} onChange={(event) => { setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 8)); setPointsAuthorizationToken(''); }} placeholder="Enter OTP" className="mt-1 w-full rounded-md border border-violet-200 bg-white px-2.5 py-2 font-mono text-xs" />
                      </label>
                      <button type="button" onClick={handleVerifyOtp} disabled={isVerifyingOtp || !otpCode.trim()} className="rounded-md border border-violet-300 bg-white px-3 py-2 text-[10px] font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-50">
                        {isVerifyingOtp ? 'Verifying…' : 'Verify OTP'}
                      </button>
                    </div>
                  )}
                  {pointsAuthorizationToken && <p role="status" className="text-[10px] font-semibold text-emerald-800">Registered mobile verified for this redemption.</p>}
                  <p className="text-[9px] text-violet-800">OTP is requested and verified by the secure SMS backend. The cashier cannot view the code.</p>
                </section>
              )}
              <div className="flex justify-between rounded bg-slate-50 px-2.5 py-2 text-[10px]">
                <span className="text-slate-600">Payment total</span>
                <span className={`font-mono font-bold ${paymentLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0) > balanceDue ? 'text-rose-700' : 'text-slate-900'}`}>
                  ${paymentLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0).toFixed(2)} / ${balanceDue.toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500">Card details are handled by the configured payment terminal; do not enter card numbers or security codes here.</p>
            </div>

            <aside className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 lg:col-start-2 lg:row-start-2">
              <div className="border-b border-emerald-200 pb-2">
                <h3 className="text-[11px] font-bold text-emerald-950">Apply patient advance</h3>
                <p className="mt-0.5 text-[10px] text-emerald-800">
                  Collected ${totalAdvanceDeposited.toFixed(2)} · Available ${availableAdvanceBalance.toFixed(2)}
                </p>
              </div>
              {patientAdvancePayments.length ? (
                <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {patientAdvancePayments.map((advance) => {
                    const existingAmount = advanceLines
                      .filter((line) => line.advanceId === advance.id)
                      .reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
                    const maxAmount = Math.min(
                      Number(advance.remainingBalance) + existingAmount,
                      balanceDue - (advanceDollars - existingAmount)
                    );
                    const utilizationHistory = [...(advance.utilizationHistory || [])]
                      .sort((first, second) => second.date.localeCompare(first.date));
                    return (
                      <div key={advance.id} className="rounded-md border border-emerald-200 bg-white p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[10px] font-bold text-slate-800">{advance.date} · {advance.receiptNumber}</p>
                            <p className="mt-0.5 text-[9px] text-slate-500">{advance.purpose} · {advance.status}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[9px] text-slate-500">Available</p>
                            <p className="font-mono text-[10px] font-bold text-emerald-800">${Number(advance.remainingBalance).toFixed(2)}</p>
                          </div>
                        </div>
                        <label className="mt-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-600">
                          Apply from this deposit
                          <span className="flex items-center rounded border border-slate-300 bg-white px-2">
                            <span className="text-slate-400">$</span>
                            <input
                              aria-label={`Amount to use from advance collected ${advance.date}`}
                              type="number"
                              min="0"
                              max={Math.max(0, maxAmount)}
                              step="0.01"
                              value={advanceLines.find((line) => line.advanceId === advance.id)?.amount || ''}
                              onChange={(event) => setAdvanceAmount(advance.id, event.target.value)}
                              className="w-20 bg-transparent py-1 pl-1 text-right font-mono text-[10px] text-slate-900 outline-none"
                            />
                          </span>
                        </label>
                        <p className="mt-1 text-[9px] text-slate-500">Originally collected: ${Number(advance.amount).toFixed(2)}</p>
                        {utilizationHistory.length > 0 && (
                          <div className="mt-1 border-t border-slate-100 pt-1">
                            {utilizationHistory.map((utilization) => (
                              <p key={`${utilization.transactionId}-${utilization.date}`} className="text-[9px] text-slate-600">
                                Used {new Date(utilization.date).toLocaleString()} · ${utilization.amount.toFixed(2)}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-[10px] text-emerald-800">No advance deposits are recorded for this patient.</p>
              )}
              <div className="mt-2 flex justify-between border-t border-emerald-200 pt-2 text-[10px] font-bold">
                <span className="text-emerald-900">Advance applied</span>
                <span className="font-mono text-emerald-900">${advanceDollars.toFixed(2)}</span>
              </div>
            </aside>

            {error && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-2 text-[10px] font-semibold text-rose-800 lg:col-span-2">{error}</p>}

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between lg:col-span-2">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-600" /> No card data stored
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || paymentLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0) > balanceDue || advanceDollars > availableAdvanceBalance || Boolean(pointsLines.length && !pointsAuthorizationToken) || pointsRequired > availablePoints}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold text-xs shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Authorizing...
                    </>
                  ) : (
                    <>Collect ${paymentLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0).toFixed(2)}</>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
