import React, { useState } from 'react';
import { X, Printer, ReceiptText, Search, CheckCircle2, ShieldCheck, Building2, User } from 'lucide-react';
import { useHospital } from '../../context/HospitalContext';
import { Invoice } from '../../types';
import { sumInvoiceItemField } from '../../utils/insuranceInvoice';

interface ReprintInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialInvoiceId?: string;
}

export const ReprintInvoiceModal: React.FC<ReprintInvoiceModalProps> = ({
  isOpen,
  onClose,
  initialInvoiceId,
}) => {
  const { invoices } = useHospital();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(initialInvoiceId || invoices[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const currentInvoice = invoices.find((inv) => inv.id === selectedInvoiceId) || invoices[0];

  const filteredInvoices = invoices.filter((inv) =>
    inv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.patientId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePrint = () => {
    window.print();
  };

  const totalAmount = Number(currentInvoice?.totalAmount ?? currentInvoice?.subtotal ?? 0);
  const grossAmount = Number(currentInvoice?.subtotal ?? totalAmount);
  const insuranceCovered = Number(currentInvoice?.insuranceCoveredAmount ?? currentInvoice?.insuranceCovered ?? 0);
  const paidAmount = Number(currentInvoice?.amountPaid ?? 0);
  const balanceDue = Number(currentInvoice?.balanceDue ?? 0);
  const invoiceItems = currentInvoice?.items || [];
  const hasInsuranceBreakdown = invoiceItems.some((item) => item.insuranceAmount !== undefined);
  const discountTotal = hasInsuranceBreakdown ? sumInvoiceItemField(invoiceItems, 'discountAmount') : 0;
  const netAmount = hasInsuranceBreakdown ? sumInvoiceItemField(invoiceItems, 'netAmount') : totalAmount;
  const deductibleTotal = Number(currentInvoice?.deductibleAmount) ||
    (hasInsuranceBreakdown ? sumInvoiceItemField(invoiceItems, 'deductibleAmount') : 0);
  const copayTotal = Number(currentInvoice?.copayAmount) ||
    (hasInsuranceBreakdown ? sumInvoiceItemField(invoiceItems, 'copayAmount') : 0);
  const patientResponsibility = Number(currentInvoice?.patientPayable ?? (deductibleTotal + copayTotal || totalAmount - insuranceCovered));

  const invoiceRows = invoiceItems.length > 0
    ? invoiceItems.map((item, index) => ({
        srNo: index + 1,
        dos: currentInvoice?.issueDate || '05/01/2026',
        description: item.description || 'Healthcare Service',
        serviceCode: item.serviceCode || item.cptCode || 'Service code',
        unit: item.quantity || 1,
        rate: Number(item.unitCost || item.amount || 0),
        discount: Number(item.discountAmount || 0),
        net: Number(item.netAmount || (Number(item.amount || item.unitCost || 0) - Number(item.discountAmount || 0))),
        deduct: Number(item.deductibleAmount || 0),
        copay: Number(item.copayAmount || 0),
        insurer: currentInvoice?.insuranceProvider || 'BlueCross BlueShield of Texas',
        approvalNo: currentInvoice?.insuranceClaimNumber || 'AUTH-2026-001',
        approvalDate: currentInvoice?.issueDate || '05/01/2026',
        orderDate: currentInvoice?.issueDate || '05/01/2026',
        doctorName: 'Dr. Sarah Jenkins',
        vat: Number(item.amount || item.unitCost || 0) * 0.05,
        cpt: item.cptCode || item.serviceCode || 'Service code',
        diagnosis: currentInvoice?.diagnoses?.[0]?.code || 'J06.9',
        billed: Number(item.amount || item.unitCost || 0),
        adjustments: Number(item.discountAmount || 0),
        insurancePaid: Number(item.insuranceAmount || 0),
        patientDue: Number(item.amount || item.unitCost || 0) - Number(item.discountAmount || 0) - Number(item.insuranceAmount || 0),
        index,
      }))
    : [
        {
          srNo: 1,
          dos: currentInvoice?.issueDate || '05/01/2026',
          description: 'New Patient Office Visit',
          serviceCode: '99203',
          unit: 1,
          rate: 180,
          discount: 45,
          net: 135,
          deduct: 20,
          copay: 25,
          insurer: 'BlueCross BlueShield of Texas',
          approvalNo: 'AUTH-2026-001',
          approvalDate: '05/01/2026',
          orderDate: '05/01/2026',
          doctorName: 'Dr. Sarah Jenkins',
          vat: 9,
          cpt: '99203',
          diagnosis: 'J06.9',
          billed: 180,
          adjustments: 45,
          insurancePaid: 90,
          patientDue: 45,
          index: 0,
        },
        {
          srNo: 2,
          dos: currentInvoice?.issueDate || '05/02/2026',
          description: 'CBC with Differential',
          serviceCode: '85025',
          unit: 1,
          rate: 90,
          discount: 20,
          net: 70,
          deduct: 10,
          copay: 5,
          insurer: 'BlueCross BlueShield of Texas',
          approvalNo: 'AUTH-2026-002',
          approvalDate: '05/02/2026',
          orderDate: '05/02/2026',
          doctorName: 'Dr. Sarah Jenkins',
          vat: 4.5,
          cpt: '85025',
          diagnosis: 'D64.9',
          billed: 90,
          adjustments: 20,
          insurancePaid: 55,
          patientDue: 15,
          index: 1,
        },
      ];

  const totalBilled = invoiceRows.reduce((sum, row) => sum + Number(row.billed || 0), 0);
  const totalAdjustments = invoiceRows.reduce((sum, row) => sum + Number(row.adjustments || 0), 0);
  const totalInsurancePaid = invoiceRows.reduce((sum, row) => sum + Number(row.insurancePaid || 0), 0);
  const totalPatientDue = invoiceRows.reduce((sum, row) => sum + Number(row.patientDue || 0), 0);
  const totalVat = invoiceRows.reduce((sum, row) => sum + Number(row.vat || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-5xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
              <ReceiptText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Medical Statement Preview</h3>
              <p className="text-[11px] text-slate-300">Healthcare billing statement • HIPAA-friendly formatting</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="font-bold text-slate-700 whitespace-nowrap">Select Invoice:</span>
            <select
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 font-mono font-medium max-w-xs"
            >
              {filteredInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.id} — {inv.patientName} (${(inv.totalAmount || inv.subtotal).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search invoice or patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>

        <div className="p-6 sm:p-8 overflow-y-auto bg-slate-100 flex-1 flex justify-center">
          {currentInvoice ? (
            <div className="invoice-print bg-white border border-slate-200 rounded-xl shadow-md w-full max-w-5xl text-slate-800 font-sans print:border-none print:shadow-none print:p-0">
              <style>{`@media print {
                @page { size: A4 portrait; margin: 12mm; }
                body * { visibility: hidden !important; }
                .invoice-print, .invoice-print * { visibility: visible !important; }
                .invoice-print { position: absolute !important; inset: 0 !important; width: 100% !important; max-width: none !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; padding: 0 !important; }
                .invoice-print table { font-size: 8pt !important; }
                .invoice-print th, .invoice-print td { padding: 4px !important; }
              }`}</style>

              <div className="p-6 sm:p-8">
                <header className="border-b-4 border-slate-900 pb-4 mb-6">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center text-lg font-black">MC</div>
                        <div>
                          <h1 className="text-2xl font-black tracking-tight text-slate-900">ABC FAMILY MEDICAL GROUP</h1>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Outpatient & Specialty Care</p>
                        </div>
                      </div>
                      <div className="space-y-1 text-sm text-slate-700">
                        <p>123 Wellness Boulevard, Suite 400</p>
                        <p>Houston, TX 77002</p>
                        <p>Phone: (713) 555-0199 | Fax: (713) 555-0188</p>
                        <p>Email: billing@abcfamilymed.com | Website: www.abcfamilymed.com</p>
                      </div>
                    </div>

                    <div className="lg:text-right">
                      <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-700">Statement of Charges</div>
                      <div className="mt-2 text-3xl font-black text-slate-900">{currentInvoice.id}</div>
                      <div className="text-sm text-slate-600 mt-2">Statement Date: {currentInvoice.issueDate}</div>
                      <div className="text-sm text-slate-600">Payment Due Date: {currentInvoice.dueDate}</div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-slate-700">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="font-bold uppercase tracking-wide text-slate-500 mb-1">Provider NPI</div>
                      <div className="font-semibold">1234567890</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="font-bold uppercase tracking-wide text-slate-500 mb-1">Tax ID / EIN</div>
                      <div className="font-semibold">12-3456789</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="font-bold uppercase tracking-wide text-slate-500 mb-1">Billing Office</div>
                      <div className="font-semibold">(713) 555-0199</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="font-bold uppercase tracking-wide text-slate-500 mb-1">Hours</div>
                      <div className="font-semibold">Mon–Fri, 8:00 AM–6:00 PM</div>
                    </div>
                  </div>
                </header>

                <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Patient Details</h2>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-slate-500 block text-[10px] uppercase tracking-wide">Full Name</span><span className="font-semibold">{currentInvoice.patientName}</span></div>
                      <div><span className="text-slate-500 block text-[10px] uppercase tracking-wide">DOB</span><span className="font-semibold">04/18/1987</span></div>
                      <div><span className="text-slate-500 block text-[10px] uppercase tracking-wide">Account / MRN</span><span className="font-semibold">{currentInvoice.patientId}</span></div>
                      <div><span className="text-slate-500 block text-[10px] uppercase tracking-wide">Phone</span><span className="font-semibold">{currentInvoice.patientPhone || '(713) 555-0123'}</span></div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Guarantor / Responsible Party</h2>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-slate-500 block text-[10px] uppercase tracking-wide">Name</span><span className="font-semibold">{currentInvoice.patientName}</span></div>
                      <div><span className="text-slate-500 block text-[10px] uppercase tracking-wide">Relationship</span><span className="font-semibold">Self</span></div>
                      <div><span className="text-slate-500 block text-[10px] uppercase tracking-wide">DOB</span><span className="font-semibold">04/18/1987</span></div>
                      <div><span className="text-slate-500 block text-[10px] uppercase tracking-wide">Address</span><span className="font-semibold">780 Lakeview Drive, Houston, TX</span></div>
                    </div>
                  </div>
                </section>

                <section className="mb-6 rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-900 text-white px-4 py-3 text-xs font-black uppercase tracking-[0.2em]">Insurance Information</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 mb-2">Primary Payer</h3>
                      <div className="space-y-2 text-sm">
                        <div><span className="text-slate-500 block text-[10px] uppercase tracking-wide">Payer Name</span><span className="font-semibold">{currentInvoice.insuranceProvider || 'BlueCross BlueShield of Texas'}</span></div>
                        <div><span className="text-slate-500 block text-[10px] uppercase tracking-wide">Policy / Subscriber ID</span><span className="font-semibold">BCX-889412</span></div>
                        <div><span className="text-slate-500 block text-[10px] uppercase tracking-wide">Group Number</span><span className="font-semibold">GRP-30216</span></div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 mb-2">Secondary Payer</h3>
                      <div className="space-y-2 text-sm">
                        <div><span className="text-slate-500 block text-[10px] uppercase tracking-wide">Payer Name</span><span className="font-semibold">N/A</span></div>
                        <div><span className="text-slate-500 block text-[10px] uppercase tracking-wide">Policy / Subscriber ID</span><span className="font-semibold">N/A</span></div>
                        <div><span className="text-slate-500 block text-[10px] uppercase tracking-wide">Group Number</span><span className="font-semibold">N/A</span></div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="mb-6">
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-[11px] min-w-[1600px]">
                        <thead>
                          <tr className="bg-slate-900 text-white text-[9px] uppercase tracking-[0.14em]">
                            <th className="px-2 py-3 font-bold">Sr.No</th>
                            <th className="px-2 py-3 font-bold">Service Code</th>
                            <th className="px-2 py-3 font-bold">DOS</th>
                            <th className="px-2 py-3 font-bold">Service Description</th>
                            <th className="px-2 py-3 font-bold">Unit</th>
                            <th className="px-2 py-3 font-bold text-right">Rate</th>
                            <th className="px-2 py-3 font-bold text-right">Discount</th>
                            <th className="px-2 py-3 font-bold text-right">Net</th>
                            <th className="px-2 py-3 font-bold text-right">Deduct</th>
                            <th className="px-2 py-3 font-bold text-right">Copay</th>
                            <th className="px-2 py-3 font-bold">Ins/Cmp</th>
                            <th className="px-2 py-3 font-bold">Approval No.</th>
                            <th className="px-2 py-3 font-bold">Approval Date</th>
                            <th className="px-2 py-3 font-bold">Order Date</th>
                            <th className="px-2 py-3 font-bold">Doctor Name</th>
                            <th className="px-2 py-3 font-bold text-right">VAT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceRows.map((row) => (
                            <tr key={row.index} className="border-b border-slate-200 even:bg-slate-50">
                              <td className="px-2 py-3 align-top">{row.srNo}</td>
                              <td className="px-2 py-3 align-top font-mono">{row.serviceCode}</td>
                              <td className="px-2 py-3 align-top whitespace-nowrap">{row.dos}</td>
                              <td className="px-2 py-3 align-top">{row.description}</td>
                              <td className="px-2 py-3 align-top text-right">{row.unit}</td>
                              <td className="px-2 py-3 align-top text-right font-mono">${Number(row.rate || 0).toFixed(2)}</td>
                              <td className="px-2 py-3 align-top text-right font-mono">${Number(row.discount || 0).toFixed(2)}</td>
                              <td className="px-2 py-3 align-top text-right font-mono">${Number(row.net || 0).toFixed(2)}</td>
                              <td className="px-2 py-3 align-top text-right font-mono">${Number(row.deduct || 0).toFixed(2)}</td>
                              <td className="px-2 py-3 align-top text-right font-mono">${Number(row.copay || 0).toFixed(2)}</td>
                              <td className="px-2 py-3 align-top">{row.insurer}</td>
                              <td className="px-2 py-3 align-top">{row.approvalNo}</td>
                              <td className="px-2 py-3 align-top whitespace-nowrap">{row.approvalDate}</td>
                              <td className="px-2 py-3 align-top whitespace-nowrap">{row.orderDate}</td>
                              <td className="px-2 py-3 align-top">{row.doctorName}</td>
                              <td className="px-2 py-3 align-top text-right font-mono">${Number(row.vat || 0).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <section className="mb-6 flex flex-col lg:flex-row justify-between gap-6">
                  <div className="w-full lg:w-[52%] rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Payment Terms</h2>
                    <div className="space-y-2 text-sm text-slate-700">
                      <p><span className="font-semibold">Payment Due Date:</span> {currentInvoice.dueDate}</p>
                      <p><span className="font-semibold">Accepted Methods:</span> Online portal, credit card, check, bank transfer</p>
                      <p><span className="font-semibold">Portal:</span> www.abcfamilymed.com/pay</p>
                      <p><span className="font-semibold">Check Payable To:</span> ABC Family Medical Group</p>
                    </div>
                  </div>

                  <div className="w-full lg:w-[48%] rounded-xl border border-slate-200 bg-slate-900 text-white p-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>Total Billed</span><span className="font-mono font-semibold">${totalBilled.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Insurance Adjustments</span><span className="font-mono font-semibold">-${totalAdjustments.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Insurance Paid</span><span className="font-mono font-semibold">${totalInsurancePaid.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Deductible / Copay</span><span className="font-mono font-semibold">${(Number(deductibleTotal) + Number(copayTotal)).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>VAT</span><span className="font-mono font-semibold">${totalVat.toFixed(2)}</span></div>
                      <div className="flex justify-between border-t border-slate-700 pt-2 mt-2 text-base font-bold"><span>Final Balance Due</span><span className="font-mono">${Number(balanceDue || totalPatientDue).toFixed(2)}</span></div>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Billing Disclaimer</h2>
                  <p className="mb-2">This is a statement of services provided to the patient listed above. Charges are based on services rendered and insurance contract terms. This document contains protected health information and is intended for billing and payment purposes only.</p>
                  <p className="mb-2">If you believe a service is inaccurate, incomplete, or not covered by your insurance plan, please contact our billing office within 30 days. We are available to discuss appeals, financial assistance, or payment arrangements.</p>
                  <p className="font-semibold">Confidentiality Notice: This statement is protected under HIPAA and should be handled securely.</p>
                </section>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-400 p-8">No invoice selected.</div>
          )}
        </div>
      </div>
    </div>
  );
};
