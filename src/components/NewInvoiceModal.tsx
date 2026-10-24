import React, { useState, useEffect } from 'react';
import { X, ReceiptText, Plus, Trash2, DollarSign, ShieldCheck, CheckCircle2, Stethoscope, RotateCcw } from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { BillItem } from '../types';
import { PatientLookup } from './billing/PatientLookup';
import { applyApprovedInsuranceBreakdown, applyDiscountBreakdown, parseInsuranceDeductible, sumInvoiceItemField } from '../utils/insuranceInvoice';

interface NewInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewInvoiceModal: React.FC<NewInvoiceModalProps> = ({ isOpen, onClose }) => {
  const { patients, receptionTokens, insuranceApprovals, hospitalPriceCatalog, pharmacy, createInvoice, addNotification } = useHospital();

  const [patientId, setPatientId] = useState('');
  const [encounterType, setEncounterType] = useState<'OPD' | 'IPD'>('OPD');
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [items, setItems] = useState<BillItem[]>([]);
  const [diagnoses, setDiagnoses] = useState<Array<{ code: string; description: string; doctorName: string; orderedAt: string }>>([]);
  const [invoiceReviewTab, setInvoiceReviewTab] = useState<'services' | 'approvals'>('services');
  const [insuranceCovered, setInsuranceCovered] = useState(0);
  const [copayAmount, setCopayAmount] = useState(25);
  const [itemDesc, setItemDesc] = useState('');
  const [itemCategory, setItemCategory] = useState<BillItem['category']>('Consultation');
  const [itemPrice, setItemPrice] = useState(75.0);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [dueRemarks, setDueRemarks] = useState('');
  const [formError, setFormError] = useState('');
  const selectedPatient = patients.find((patient) => patient.id === patientId);
  const patientTokens = receptionTokens.filter((token) => token.patientId === patientId && (
    token.doctorOrders || token.serviceItems?.length || token.pendingServiceIds?.length ||
    selectedPatient?.services?.some((service) => service.encounterTokenId === token.id)
  ));
  const selectedToken = patientTokens.find((token) => token.id === selectedTokenId);
  const paymentScheme = selectedToken?.paymentScheme;
  const isInsuranceInvoice = paymentScheme
    ? paymentScheme.schemeType === 'Insurance'
    : selectedPatient?.payMode === 'Insurance';
  const deductibleConfigured = selectedPatient?.insurance.deductibleAmount ||
    parseInsuranceDeductible(selectedPatient?.insuranceList?.find((record) => record.isPrimary)?.copayDeductible);
  const findApprovalForItem = (item: BillItem, tokenId = selectedToken?.id) => insuranceApprovals.find((approval) => {
    if (approval.patientId !== patientId) return false;
    if (item.insuranceApprovalId === approval.id) return true;
    if (item.sourceServiceId && approval.serviceRecordId === item.sourceServiceId) return true;
    if (!tokenId || approval.encounterTokenId !== tokenId) return false;
    return Boolean(
      (item.serviceCode && approval.serviceCode === item.serviceCode) ||
      approval.serviceName.trim().toLowerCase() === item.description.trim().toLowerCase()
    );
  });
  const patientApprovals = insuranceApprovals.filter((approval) =>
    approval.patientId === patientId && (!selectedTokenId || !approval.encounterTokenId || approval.encounterTokenId === selectedTokenId)
  );

  useEffect(() => {
    if (!isOpen) return;
    setPatientId('');
    setSelectedTokenId('');
    setItems([]);
    setDiagnoses([]);
    setInsuranceCovered(0);
    setCopayAmount(25);
    setDueRemarks('');
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setFormError('');
    if (!itemDesc.trim()) {
      setFormError('Enter a description for the charge.');
      return;
    }
    const price = Number(itemPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setFormError('Charge amount must be greater than zero.');
      return;
    }
    const newItem: BillItem = {
      id: `ITM-${Date.now()}`,
      description: itemDesc.trim(),
      category: itemCategory,
      unitCost: price,
      quantity: 1,
      amount: price,
      totalPrice: price,
      sourceType: 'Manual',
      billingStatus: 'Pending',
    };
    setItems([...items, newItem]);
    setItemDesc('');
  };

  const handleRemoveItem = (id: string) => {
    setItems((current) => current.map((item) => item.id === id
      ? { ...item, billingStatus: item.billingStatus === 'Deferred' ? 'Pending' : 'Deferred' }
      : item));
  };

  const addCatalogItem = (entry: { id: string; code: string; cptCode?: string; name: string; category: BillItem['category']; price: number }) => {
    if (items.some((item) => item.serviceCode === entry.code || (entry.cptCode && item.cptCode === entry.cptCode))) {
      setFormError(`${entry.name} is already on this invoice.`);
      return;
    }
    setItems((current) => [...current, {
      id: `ITM-${Date.now()}`,
      serviceCode: entry.code,
      cptCode: entry.cptCode,
      description: entry.name,
      category: entry.category,
      unitCost: entry.price,
      quantity: 1,
      amount: entry.price,
      totalPrice: entry.price,
      sourceType: 'Manual',
      billingStatus: 'Pending',
    }]);
    setCatalogSearch('');
    setFormError('');
  };

  const updateItem = (id: string, updates: Partial<BillItem>) => {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...updates };
      const amount = Math.max(0, Number(next.unitCost) || 0) * Math.max(1, Number(next.quantity) || 1);
      return { ...next, amount, totalPrice: amount };
    }));
  };

  const loadDoctorOrders = (tokenId: string) => {
    setSelectedTokenId(tokenId);
    const token = patientTokens.find((item) => item.id === tokenId);
    const orders = token?.doctorOrders;
    if (!token) {
      setItems([]);
      setDiagnoses([]);
      return;
    }
    const orderedItems: BillItem[] = [
      ...(orders && orders.consultationFee > 0 ? [{
        id: `${token.id}-consult`,
        description: `Consultation — ${orders.orderedByDoctorName}`,
        category: 'Consultation' as const,
        unitCost: orders.consultationFee,
        quantity: 1,
        amount: orders.consultationFee,
        totalPrice: orders.consultationFee,
      }] : []),
      ...(orders?.medicationRequests || []).map((order) => ({
        id: order.id,
        serviceCode: order.sku,
        description: `${order.medicationName} (${order.sku})`,
        category: 'Pharmacy' as const,
        unitCost: order.unitPrice,
        quantity: order.quantity,
        amount: order.price,
        totalPrice: order.price,
      })),
      ...(orders?.labRequests || []).filter((order) => order.price > 0).map((order) => ({
        id: order.id,
        serviceCode: order.id,
        cptCode: order.cptCode,
        description: order.testName,
        category: 'Lab Test' as const,
        unitCost: order.price,
        quantity: 1,
        amount: order.price,
        totalPrice: order.price,
      })),
      ...(orders?.radiologyRequests || []).filter((order) => order.price > 0).map((order) => ({
        id: order.id,
        serviceCode: order.id,
        cptCode: order.cptCode,
        description: order.studyName,
        category: 'Radiology' as const,
        unitCost: order.price,
        quantity: 1,
        amount: order.price,
        totalPrice: order.price,
      })),
      ...(orders?.procedureRequests || []).filter((order) => order.price > 0).map((order) => ({
        id: order.id,
        serviceCode: order.id,
        cptCode: order.cptCode,
        description: order.procedureName,
        category: 'Surgical Procedure' as const,
        unitCost: order.price,
        quantity: 1,
        amount: order.price,
        totalPrice: order.price,
      })),
    ];
    const doctorOrderItems = orderedItems.map((item) => {
      const sourceItem = { ...item, sourceServiceId: item.id, sourceEncounterTokenId: token.id, sourceType: 'Doctor Order' as const };
      const priorState = token.serviceBillingStates?.find((state) => state.serviceId === item.id);
      const approval = findApprovalForItem(sourceItem, token.id);
      return {
        ...sourceItem,
        insuranceApprovalId: approval?.id,
        billingStatus: priorState?.status || 'Pending',
      };
    });
    const patientServiceItems: BillItem[] = (selectedPatient?.services || [])
      .filter((service) => service.encounterTokenId === token.id || token.pendingServiceIds?.includes(service.id))
      .map((service) => ({
        id: service.id,
        sourceServiceId: service.id,
        sourceEncounterTokenId: token.id,
        sourceType: 'Patient Service',
        insuranceApprovalId: service.insuranceApprovalId,
        description: service.name,
        category: service.category === 'Procedure' ? 'Surgical Procedure' : service.category === 'IPD Admission' ? 'Room & Nursing' : service.category,
        unitCost: service.estimatedCost,
        quantity: 1,
        amount: service.estimatedCost,
        totalPrice: service.estimatedCost,
        billingStatus: service.billingStatus || 'Pending',
      }));
    const nursingItems: BillItem[] = (token.serviceItems || []).map((service) => ({
      id: service.id,
      sourceServiceId: service.id,
      sourceEncounterTokenId: token.id,
      sourceType: 'Nursing Service',
      description: service.name,
      category: service.category === 'Test' ? 'Lab Test' : service.category === 'Procedure' ? 'Surgical Procedure' : 'Technician Service',
      unitCost: service.price,
      quantity: 1,
      amount: service.price,
      totalPrice: service.price,
      billingStatus: token.serviceBillingStates?.find((state) => state.serviceId === service.id)?.status || 'Pending',
    }));
    setItems([...doctorOrderItems, ...patientServiceItems, ...nursingItems]);
    setDiagnoses((orders?.diagnoses || []).map((diagnosis) => ({
      code: diagnosis.code,
      description: diagnosis.description,
      doctorName: orders?.orderedByDoctorName || token.doctorName || 'Attending Physician',
      orderedAt: orders?.orderedAt || token.visitDate || token.createdDate || '',
    })));
    setFormError('');
  };

  const billableItems = items.filter((item) => !['Billed', 'Deferred', 'Cancelled'].includes(item.billingStatus || 'Pending'));
  const deferredItems = items.filter((item) => item.billingStatus === 'Deferred');
  const totalAmount = billableItems.reduce((sum, item) => sum + (Number(item.amount ?? item.totalPrice) || 0), 0);
  const discountPercent = !isInsuranceInvoice && paymentScheme?.schemeType === 'Discount Card'
    ? Math.min(100, Math.max(0, Number(paymentScheme.discountPercent) || 0))
    : 0;
  const linkedItems = billableItems.map((item) => {
    const approval = findApprovalForItem(item);
    return { ...item, insuranceApprovalId: item.insuranceApprovalId || approval?.id };
  });
  const invoiceItems = isInsuranceInvoice
    ? applyApprovedInsuranceBreakdown(linkedItems, insuranceApprovals, deductibleConfigured)
    : discountPercent > 0
    ? applyDiscountBreakdown(linkedItems, discountPercent)
    : linkedItems;
  const invoiceInsuranceCovered = isInsuranceInvoice
    ? sumInvoiceItemField(invoiceItems, 'insuranceAmount')
    : discountPercent > 0 ? 0 : Number(insuranceCovered) || 0;
  const invoiceCopay = isInsuranceInvoice
    ? sumInvoiceItemField(invoiceItems, 'copayAmount')
    : discountPercent > 0 ? 0 : copayAmount;
  const invoiceDeductible = isInsuranceInvoice ? sumInvoiceItemField(invoiceItems, 'deductibleAmount') : 0;
  const invoiceDiscountAmount = sumInvoiceItemField(invoiceItems, 'discountAmount');
  const invoiceNetAmount = invoiceItems.reduce((sum, item) => sum + Number(item.netAmount ?? item.amount ?? item.totalPrice ?? 0), 0);
  const hasPendingApproval = isInsuranceInvoice && invoiceItems.some((item) => {
    const approval = findApprovalForItem(item);
    return approval && approval.approvalStatus !== 'Approved';
  });
  const balanceDue = isInsuranceInvoice
    ? Math.max(0, invoiceNetAmount - invoiceInsuranceCovered)
    : discountPercent > 0
    ? Math.max(0, invoiceNetAmount - (Number(insuranceCovered) || 0))
    : Math.max(0, totalAmount - (Number(insuranceCovered) || 0) + copayAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const selectedPatient = patients.find((p) => p.id === patientId);
    if (!selectedPatient) {
      setFormError('Select a patient before saving the invoice.');
      return;
    }
    if (billableItems.length === 0) {
      setFormError('Add at least one charge before saving the invoice.');
      return;
    }
    if (billableItems.some((item) => !item.description.trim() || !Number.isFinite(item.unitCost) || item.unitCost <= 0 || !Number.isInteger(item.quantity) || item.quantity < 1)) {
      setFormError('Each service needs a description, a positive unit price, and a whole-number quantity.');
      return;
    }
    if (!isInsuranceInvoice && (!Number.isFinite(Number(insuranceCovered)) || Number(insuranceCovered) < 0 || Number(insuranceCovered) > totalAmount)) {
      setFormError('Insurance adjudication must be between $0 and the invoice subtotal.');
      return;
    }
    if (discountPercent > 0 && Number(insuranceCovered) > 0) {
      setFormError('A discount card cannot be combined with insurance coverage on the same invoice.');
      return;
    }
    if (!isInsuranceInvoice && (!Number.isFinite(copayAmount) || copayAmount < 0)) {
      setFormError('Patient copay must be a valid non-negative amount.');
      return;
    }
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const saveDraft = submitter instanceof HTMLButtonElement && submitter.value === 'draft';
    if (!saveDraft && balanceDue > 0 && !dueRemarks.trim()) {
      setFormError('Add a remark explaining the patient balance before issuing the invoice.');
      return;
    }

    createInvoice({
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
      encounterType,
      encounterTokenId: selectedToken?.id,
      insuranceProvider: isInsuranceInvoice ? selectedPatient.insurance.provider : undefined,
      diagnoses,
      patientPhone: selectedPatient.phone,
      patientEmail: selectedPatient.email,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      status: saveDraft ? 'Draft' : invoiceInsuranceCovered > 0 || hasPendingApproval ? 'Pending Insurance' : balanceDue === 0 ? 'Paid' : 'Pending',
      items: invoiceItems,
      deferredItems,
      discountAmount: invoiceDiscountAmount,
      insuranceCoveredAmount: invoiceInsuranceCovered,
      copayAmount: invoiceCopay,
      deductibleAmount: invoiceDeductible,
      dueRemarks: dueRemarks.trim() || undefined,
      tax: 0,
    });

    addNotification(
      saveDraft ? 'Invoice Draft Saved' : 'Invoice Issued',
      `${saveDraft ? 'Draft saved' : 'Invoice issued'} for ${selectedPatient.firstName} ${selectedPatient.lastName} (${encounterType}; $${balanceDue.toFixed(2)} patient balance).`,
      saveDraft ? 'info' : 'success',
      selectedPatient.id
    );

    onClose();
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with Classification Badge */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600/30 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
              <ReceiptText className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800">
                  Billing & Claims
                </span>
              </div>
              <h2 className="font-bold text-sm text-white mt-0.5">Generate Patient Invoice</h2>
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

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Classification Section 1: Patient Selection */}
          <div className="space-y-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              1. Patient & Insurance Profile
            </span>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px]">
              <PatientLookup
                patients={patients}
                tokens={receptionTokens}
                selectedPatientId={patientId}
                onSelect={(id) => {
                  const nextPatient = patients.find((patient) => patient.id === id);
                  setPatientId(id);
                  setSelectedTokenId('');
                  setDiagnoses([]);
                  setItems([]);
                  if (nextPatient) setEncounterType(nextPatient.status === 'Inpatient' ? 'IPD' : 'OPD');
                }}
              />
              <select value={encounterType} onChange={(event) => setEncounterType(event.target.value as 'OPD' | 'IPD')} aria-label="Encounter type" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium">
                <option value="OPD">OPD encounter</option>
                <option value="IPD">IPD encounter</option>
              </select>
            </div>
            {selectedPatient && patientTokens.length > 0 && (
              <label className="block text-xs font-semibold text-slate-700">
                Doctor encounter / token
                <select value={selectedTokenId} onChange={(event) => loadDoctorOrders(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-normal">
                  <option value="">Select visit to load doctor orders</option>
                  {patientTokens.map((token) => (
                    <option key={token.id} value={token.id}>{token.tokenNumber} · {token.department} · {token.createdDate || token.visitDate || 'Visit'} · {token.doctorOrders?.orderedByDoctorName}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {selectedToken?.doctorOrders && (
            <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
              <div className="flex items-center gap-2 text-indigo-900">
                <Stethoscope className="h-4 w-4" />
                <h3 className="text-xs font-bold">Doctor-entered diagnoses</h3>
                <span className="ml-auto text-[10px] text-indigo-700">{selectedToken.doctorOrders.orderedByDoctorName}</span>
              </div>
              {diagnoses.length ? (
                <ul className="mt-2 space-y-1">
                  {diagnoses.map((diagnosis, index) => <li key={`${diagnosis.code}-${index}`} className="text-[11px] text-slate-800"><span className="mr-2 rounded bg-white px-1.5 py-0.5 font-mono font-bold">{diagnosis.code}</span>{diagnosis.description}</li>)}
                </ul>
              ) : <p className="mt-2 text-[10px] text-slate-600">No diagnoses were recorded by the doctor for this visit.</p>}
              <p className="mt-2 text-[10px] text-slate-500">Diagnosis entries are read-only for the cashier.</p>
            </section>
          )}

          {/* Classification Section 2: Itemized Line Charges */}
          <div className="space-y-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                2. Invoice Review
              </span>
              <span className="text-xs font-mono font-bold text-slate-700">
                Subtotal: ${totalAmount.toFixed(2)}
              </span>
            </div>

            <div className="flex border-b border-slate-200" role="tablist" aria-label="Invoice review">
              <button type="button" role="tab" aria-selected={invoiceReviewTab === 'services'} onClick={() => setInvoiceReviewTab('services')} className={`border-b-2 px-3 py-2 text-[10px] font-semibold ${invoiceReviewTab === 'services' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>
                Services ({items.length})
              </button>
              <button type="button" role="tab" aria-selected={invoiceReviewTab === 'approvals'} onClick={() => setInvoiceReviewTab('approvals')} className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-[10px] font-semibold ${invoiceReviewTab === 'approvals' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>
                <ShieldCheck className="h-3.5 w-3.5" /> Approvals ({patientApprovals.length})
              </button>
            </div>

            {invoiceReviewTab === 'services' ? <div className="space-y-1.5 max-h-64 overflow-y-auto divide-y divide-slate-100 bg-white p-2.5 rounded-lg border border-slate-200">
              {!items.length && <p className="py-3 text-center text-[11px] text-slate-500">Select a visit to load ordered services or add a service below.</p>}
              {items.map((it) => (
                <div key={it.id} className={`grid grid-cols-1 gap-2 rounded-md border p-2 sm:grid-cols-[minmax(0,1fr)_125px_65px_100px_auto] sm:items-center ${it.billingStatus === 'Deferred' || (!it.billingStatus || it.billingStatus === 'Pending') ? 'border-rose-200 bg-rose-50' : it.billingStatus === 'Billed' ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-200'}`}>
                  <div className="min-w-0">
                    <input aria-label="Service description" value={it.description} onChange={(event) => updateItem(it.id, { description: event.target.value })} disabled={it.billingStatus === 'Billed'} className={`w-full rounded border px-2 py-1 text-xs font-medium ${it.billingStatus === 'Deferred' ? 'border-rose-200 text-rose-900' : 'border-slate-200 text-slate-800'}`} />
                    <span className={`text-[9px] uppercase ${it.billingStatus === 'Deferred' ? 'font-bold text-rose-700' : it.billingStatus === 'Billed' ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {it.sourceType || it.category}{it.billingStatus === 'Deferred' ? ' · Deferred, not billed' : it.billingStatus === 'Billed' ? ' · Already billed' : it.billingStatus === 'Cancelled' ? ' · Cancelled' : ' · Pending, not billed'}
                    </span>
                  </div>
                  <select aria-label="Service category" value={it.category} onChange={(event) => updateItem(it.id, { category: event.target.value as BillItem['category'] })} disabled={it.billingStatus === 'Billed'} className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px]">
                    {(['Consultation', 'Lab Test', 'Radiology', 'Pharmacy', 'Room & Nursing', 'Surgical Procedure', 'Cardiology'] as const).map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                  <label className="text-[9px] text-slate-500">Qty<input aria-label="Service quantity" type="number" min="1" step="1" value={it.quantity} onChange={(event) => updateItem(it.id, { quantity: Number(event.target.value) })} disabled={it.billingStatus === 'Billed'} className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-right font-mono text-xs" /></label>
                  <label className="text-[9px] text-slate-500">Unit price<input aria-label="Service unit price" type="number" min="0.01" step="0.01" value={it.unitCost} onChange={(event) => updateItem(it.id, { unitCost: Number(event.target.value) })} disabled={it.billingStatus === 'Billed'} className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-right font-mono text-xs" /></label>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className={`font-mono font-bold ${it.billingStatus === 'Deferred' ? 'text-rose-800 line-through' : 'text-slate-900'}`}>${(Number(it.totalPrice ?? it.amount) || 0).toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it.id)}
                      disabled={it.billingStatus === 'Billed' || it.billingStatus === 'Cancelled'}
                      className="p-1 text-rose-600 transition hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-40"
                      title={it.billingStatus === 'Deferred' ? 'Restore service to invoice' : 'Defer service'}
                      aria-label={`${it.billingStatus === 'Deferred' ? 'Restore' : 'Defer'} ${it.description}`}
                    >
                      {it.billingStatus === 'Deferred' ? <RotateCcw className="h-3.5 w-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div> : <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2.5">
              {!patientApprovals.length && <p className="py-3 text-center text-[11px] text-slate-500">No authorization records for this patient or selected encounter.</p>}
              {patientApprovals.map((approval) => (
                <div key={approval.id} className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-800">{approval.serviceName}</p>
                    <p className="mt-0.5 text-[9px] text-slate-500">{approval.approvalNumber} · {approval.insuranceProvider}</p>
                    {approval.remarks && <p className="mt-0.5 text-[9px] text-slate-500">{approval.remarks}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${approval.approvalStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700' : approval.approvalStatus === 'Rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{approval.approvalStatus}</span>
                    <p className="mt-1 font-mono text-[10px] text-slate-700">${approval.approvalStatus === 'Approved' ? approval.approvedAmount.toFixed(2) : '0.00'} covered</p>
                  </div>
                </div>
              ))}
            </div>}

            {/* Add service */}
            <div className="p-2 bg-white border border-slate-200 rounded-lg flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Description (e.g. ECG 12-Lead, Blood Panel)"
                value={itemDesc}
                onChange={(e) => setItemDesc(e.target.value)}
                className="flex-1 min-w-[140px] bg-slate-50 border border-slate-200 rounded p-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
              />
              <select
                value={itemCategory}
                onChange={(e) => setItemCategory(e.target.value as BillItem['category'])}
                className="bg-slate-50 border border-slate-200 rounded p-1.5 text-xs outline-none"
              >
                <option value="Consultation">Consult</option>
                <option value="Lab Test">Lab test</option>
                <option value="Radiology">Radiology</option>
                <option value="Pharmacy">Pharmacy</option>
                <option value="Room & Nursing">Room &amp; nursing</option>
                <option value="Surgical Procedure">Surgical procedure</option>
                <option value="Cardiology">Cardiology</option>
              </select>
              <input
                type="number"
                min="0.01"
                placeholder="Price"
                value={itemPrice}
                onChange={(e) => setItemPrice(Number(e.target.value))}
                className="w-20 bg-slate-50 border border-slate-200 rounded p-1.5 text-xs font-mono outline-none"
              />
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1 transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Classification Section 3: Financial Settlement & Due Amount */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl items-center">
            <div>
              <label className="text-[10px] font-semibold text-slate-600 block mb-1">
                Insurance Adjudication ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={isInsuranceInvoice ? invoiceInsuranceCovered : insuranceCovered}
                onChange={(e) => setInsuranceCovered(Number(e.target.value))}
                readOnly={isInsuranceInvoice}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {isInsuranceInvoice && <span className="mt-1 block text-[9px] text-slate-500">Only approved authorization amounts are credited. Pending or rejected services remain patient-payable.</span>}
            </div>
            <label className="text-[10px] font-semibold text-slate-600">
              Patient copay ($)
              <input type="number" min="0" step="0.01" value={isInsuranceInvoice ? invoiceCopay : copayAmount} onChange={(event) => setCopayAmount(Math.max(0, Number(event.target.value) || 0))} readOnly={isInsuranceInvoice} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-xs" />
            </label>
            {isInsuranceInvoice && (
              <div className="col-span-2 flex justify-between text-[10px] text-slate-600">
                <span>Patient deductible</span><span className="font-mono">${invoiceDeductible.toFixed(2)}</span>
              </div>
            )}
            {invoiceDiscountAmount > 0 && (
              <div className="col-span-2 flex justify-between text-[10px] text-emerald-700">
                <span>Discount ({discountPercent}%)</span><span className="font-mono">−${invoiceDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            {isInsuranceInvoice && hasPendingApproval && (
              <div className="col-span-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] text-amber-900">
                Authorization is pending review. No pending amount has been deducted from the patient balance.
              </div>
            )}
            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 text-right">
              <span className="text-[10px] text-blue-700 uppercase font-semibold block tracking-wider">
                Patient Balance Due
              </span>
              <span className="text-lg font-bold font-mono text-blue-900">
                ${(Number(balanceDue) || 0).toFixed(2)}
              </span>
            </div>
          </div>
          {balanceDue > 0 && (
            <label className="block text-[10px] font-semibold text-slate-600">
              Patient due remark <span className="text-rose-600">* required to issue</span>
              <textarea
                value={dueRemarks}
                onChange={(event) => setDueRemarks(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Reason or details for the balance due..."
                className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white p-2 text-xs font-normal"
              />
            </label>
          )}

          {/* Footer Controls */}
          {formError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-800">{formError}</p>}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs cursor-pointer transition"
            >
              Cancel
            </button>
            <div className="flex gap-2">
              <button type="submit" name="invoiceAction" value="draft" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Save draft</button>
              <button type="submit" name="invoiceAction" value="issue" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition">
                <CheckCircle2 className="w-4 h-4" />
                <span>Issue invoice</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
