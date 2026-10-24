import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  LayoutDashboard,
  Plus,
  Search,
  Filter,
  DollarSign,
  Printer,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ReceiptText,
  ShieldCheck,
  RotateCcw,
  Building2,
  FileCheck,
  Layers,
  FileText,
  UserCheck,
  Stethoscope,
  Terminal,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { Invoice, AdvancePayment, PosTransaction } from '../types';
import { AdvancePaymentModal } from './billing/AdvancePaymentModal';
import { RefundPaymentModal } from './billing/RefundPaymentModal';
import { ReprintInvoiceModal } from './billing/ReprintInvoiceModal';
import { ReprintAdvanceModal } from './billing/ReprintAdvanceModal';
import { PatientLookup } from './billing/PatientLookup';
import {
  InsuranceCodeMapping,
  loadInsuranceCodeMappings,
  saveInsuranceCodeMappings,
} from '../utils/insuranceAuthorization';

interface BillingInvoicingProps {
  onOpenNewInvoice: () => void;
  onOpenPaymentModal: (invoice: Invoice) => void;
  initialSubTab?: BillingSubTab;
}

type BillingSubTab = 'overview' | 'invoices' | 'dues' | 'insurance' | 'advance' | 'refunds' | 'pos';

export const BillingInvoicing: React.FC<BillingInvoicingProps> = ({
  onOpenNewInvoice,
  onOpenPaymentModal,
  initialSubTab = 'overview',
}) => {
  const {
    invoices,
    advancePayments,
    refundPayments,
    insuranceApprovals,
    patients,
    receptionTokens,
    posTransactions,
    reviewRefundPayment,
    issueInvoice,
    addNotification,
    currentRole,
    setActiveTab,
  } = useHospital();

  const canViewInsuranceApprovals = currentRole === 'admin' || currentRole === 'receptionist';
  const [activeSubTab, setActiveSubTab] = useState<BillingSubTab>(initialSubTab);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [cashierPatientId, setCashierPatientId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [insuranceDateFilter, setInsuranceDateFilter] = useState('');
  const [insuranceDoctorFilter, setInsuranceDoctorFilter] = useState('all');
  const [insuranceApprovalStatusFilter, setInsuranceApprovalStatusFilter] = useState('all');
  const [insuranceServiceCategoryFilter, setInsuranceServiceCategoryFilter] = useState('all');
  const [insuranceSearchQuery, setInsuranceSearchQuery] = useState('');
  const [dueRecordDateFilter, setDueRecordDateFilter] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedOutstandingPatientId, setSelectedOutstandingPatientId] = useState<string | null>(null);
  const [advanceSearchQuery, setAdvanceSearchQuery] = useState('');
  const [advanceDateFilter, setAdvanceDateFilter] = useState<'all' | 'today' | 'active'>('all');
  const [posTerminalFilter, setPosTerminalFilter] = useState('all');
  const [posSearchQuery, setPosSearchQuery] = useState('');
  const [insuranceCodeMappings, setInsuranceCodeMappings] = useState<InsuranceCodeMapping[]>(() => loadInsuranceCodeMappings());
  const [mappingPayerId, setMappingPayerId] = useState('');
  const [mappingCptCode, setMappingCptCode] = useState('');
  const [mappingIcd10Code, setMappingIcd10Code] = useState('');
  const [mappingSource, setMappingSource] = useState('');
  const [mappingEffectiveFrom, setMappingEffectiveFrom] = useState('');
  const [mappingEffectiveUntil, setMappingEffectiveUntil] = useState('');
  const [mappingClassification, setMappingClassification] = useState<InsuranceCodeMapping['classification']>('Pre-Authorization Required');
  const [mappingError, setMappingError] = useState('');

  // Synchronize internal active subtab with initialSubTab prop whenever route or navigation changes
  useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (!canViewInsuranceApprovals && activeSubTab === 'insurance') setActiveSubTab('invoices');
  }, [canViewInsuranceApprovals, activeSubTab]);

  const handleSelectSubTab = (tab: BillingSubTab) => {
    setActiveSubTab(tab);
    if (tab === 'invoices') setActiveTab('billing');
    else if (tab === 'dues') setActiveTab('billing-dues');
    else if (tab === 'advance') setActiveTab('billing-advance');
    else if (tab === 'refunds') setActiveTab('billing-refunds');
    else if (tab === 'pos') setActiveTab('billing-pos');
    else if (tab === 'insurance') setActiveTab('insurance-approvals');
    else if (tab === 'overview') setActiveTab('billing');
  };

  const addInsuranceCodeMapping = (event: React.FormEvent) => {
    event.preventDefault();
    setMappingError('');
    if (!mappingPayerId.trim() || !mappingCptCode.trim() || !mappingIcd10Code.trim() || !mappingSource.trim() || !mappingEffectiveFrom) {
      setMappingError('Enter payer ID, CPT/service code, ICD-10 code, mapping source, and effective date.');
      return;
    }
    if (mappingEffectiveUntil && mappingEffectiveUntil < mappingEffectiveFrom) {
      setMappingError('The mapping expiry date cannot be earlier than its effective date.');
      return;
    }
    const duplicate = insuranceCodeMappings.some((mapping) =>
      mapping.payerId.trim().toLowerCase() === mappingPayerId.trim().toLowerCase() &&
      mapping.cptCode.trim().toUpperCase() === mappingCptCode.trim().toUpperCase() &&
      mapping.icd10Code.trim().toUpperCase() === mappingIcd10Code.trim().toUpperCase()
    );
    if (duplicate) {
      setMappingError('This payer / CPT / ICD-10 combination already has a rule.');
      return;
    }
    const nextMappings = [
      ...insuranceCodeMappings,
      {
        payerId: mappingPayerId.trim(),
        cptCode: mappingCptCode.trim(),
        icd10Code: mappingIcd10Code.trim(),
        source: mappingSource.trim(),
        effectiveFrom: mappingEffectiveFrom,
        effectiveUntil: mappingEffectiveUntil || undefined,
        classification: mappingClassification,
      },
    ];
    try {
      saveInsuranceCodeMappings(nextMappings);
      setInsuranceCodeMappings(nextMappings);
      setMappingPayerId('');
      setMappingCptCode('');
      setMappingIcd10Code('');
      setMappingSource('');
      setMappingEffectiveFrom('');
      setMappingEffectiveUntil('');
    } catch (error) {
      console.error('Unable to save payer CPT/ICD-10 mapping.', error);
      setMappingError('Could not save this rule in browser storage. Check available storage and try again.');
    }
  };

  const removeInsuranceCodeMapping = (target: InsuranceCodeMapping) => {
    const nextMappings = insuranceCodeMappings.filter((mapping) => mapping !== target);
    try {
      saveInsuranceCodeMappings(nextMappings);
      setInsuranceCodeMappings(nextMappings);
    } catch (error) {
      console.error('Unable to remove payer CPT/ICD-10 mapping.', error);
      addNotification('Mapping Rule Not Removed', 'Could not save the updated payer mapping list in browser storage.', 'warning');
    }
  };

  // Modal open states
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isReprintInvoiceOpen, setIsReprintInvoiceOpen] = useState(false);
  const [reprintInvoiceTargetId, setReprintInvoiceTargetId] = useState<string | undefined>(undefined);
  const [isReprintAdvanceOpen, setIsReprintAdvanceOpen] = useState(false);
  const [reprintAdvanceTargetId, setReprintAdvanceTargetId] = useState<string | undefined>(undefined);

  // Invoice Filters & Totals
  const normalizedSearch = invoiceSearchQuery.trim().toLowerCase();
  const filteredInvoices = invoices.filter((inv) => {
    const matchesPatient = !cashierPatientId || inv.patientId === cashierPatientId;
    const matchesSearch =
      !normalizedSearch ||
      inv.id.toLowerCase().includes(normalizedSearch) ||
      inv.patientName.toLowerCase().includes(normalizedSearch) ||
      inv.patientId.toLowerCase().includes(normalizedSearch) ||
      Boolean(inv.patientPhone && inv.patientPhone.includes(normalizedSearch)) ||
      Boolean(inv.insuranceProvider && inv.insuranceProvider.toLowerCase().includes(normalizedSearch));

    const isOverdue = Number(inv.balanceDue) > 0 && Boolean(inv.dueDate) && inv.dueDate < new Date().toISOString().slice(0, 10);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'outstanding' && Number(inv.balanceDue) > 0) ||
      (statusFilter === 'overdue' && isOverdue) ||
      (statusFilter === 'draft' && inv.status === 'Draft') ||
      (statusFilter === 'paid' && (inv.status === 'Paid' || Number(inv.balanceDue) === 0)) ||
      inv.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesPatient && matchesSearch && matchesStatus;
  });

  const issuedInvoices = invoices.filter(
    (invoice) => invoice.status !== 'Draft' &&
      Boolean(invoice.encounterTokenId) &&
      receptionTokens.some(
        (token) => token.id === invoice.encounterTokenId && Boolean(token.doctorId)
      )
  );
  const draftInvoiceCount = invoices.filter((invoice) => invoice.status === 'Draft').length;
  const totalBilled = issuedInvoices.reduce(
    (sum, inv) => sum + (Number(inv.totalAmount ?? inv.subtotal) || 0),
    0
  );
  const totalCollected = invoices.reduce(
    (sum, inv) => sum + Math.max(0, (Number(inv.amountPaid) || 0) - (Number(inv.refundedAmount) || 0)),
    0
  );
  const totalOutstanding = issuedInvoices.reduce(
    (sum, inv) => sum + (Number(inv.balanceDue) || 0),
    0
  );
  const outstandingInvoicesByPatient = invoices.reduce<Record<string, Invoice[]>>((grouped, invoice) => {
    if (invoice.status !== 'Draft' && Number(invoice.balanceDue) > 0) {
      grouped[invoice.patientId] = [...(grouped[invoice.patientId] || []), invoice];
    }
    return grouped;
  }, {});
  const outstandingPatients = Object.keys(outstandingInvoicesByPatient)
    .map((patientId) => {
      const patientInvoices = outstandingInvoicesByPatient[patientId];
      const firstInvoice = patientInvoices[0];
      const patient = patients.find((item) => item.id === firstInvoice.patientId);
      const patientAdvances = advancePayments
        .filter((advance) => advance.patientId === firstInvoice.patientId)
        .reduce((sum, advance) => sum + Math.max(0, Number(advance.remainingBalance) || 0), 0);
      return {
        patientId: firstInvoice.patientId,
        patientName: patient ? `${patient.firstName} ${patient.lastName}` : firstInvoice.patientName,
        mrn: patient?.rgNo || firstInvoice.patientId,
        invoices: patientInvoices.sort((first, second) => second.issueDate.localeCompare(first.issueDate)),
        balance: patientInvoices.reduce((sum, invoice) => sum + (Number(invoice.balanceDue) || 0), 0),
        availableAdvance: patientAdvances,
      };
    })
    .sort((first, second) => second.balance - first.balance);
  const filteredOutstandingPatients = cashierPatientId
    ? outstandingPatients.filter((patient) => patient.patientId === cashierPatientId)
    : outstandingPatients;
  const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const dueRegisterInvoices = invoices
    .filter((invoice) => {
      if (invoice.status === 'Draft' || Number(invoice.patientPayable) <= 0) return false;
      const recordedDate = invoice.dueRecordedAt?.slice(0, 10) || invoice.issueDate;
      return (!dueRecordDateFilter || recordedDate === dueRecordDateFilter) &&
        (!cashierPatientId || invoice.patientId === cashierPatientId);
    })
    .sort((first, second) =>
      (second.dueRecordedAt || second.createdAt || second.issueDate)
        .localeCompare(first.dueRecordedAt || first.createdAt || first.issueDate)
    );
  const dueRegisterRecordedTotal = dueRegisterInvoices.reduce(
    (sum, invoice) => sum + (Number(invoice.patientPayable) || 0),
    0
  );
  const dueRegisterOutstandingTotal = dueRegisterInvoices.reduce(
    (sum, invoice) => sum + Math.max(0, Number(invoice.balanceDue) || 0),
    0
  );
  const patientAdvancePayments = cashierPatientId
    ? advancePayments.filter((advance) => advance.patientId === cashierPatientId)
    : advancePayments;
  const patientRefundPayments = cashierPatientId
    ? refundPayments.filter((refund) => refund.patientId === cashierPatientId)
    : refundPayments;

  // Advance Totals & Filters
  const totalAdvanceDeposited = advancePayments.reduce((sum, a) => sum + a.amount, 0);
  const totalAdvanceRemaining = advancePayments.reduce((sum, a) => sum + a.remainingBalance, 0);
  const filteredAdvancePayments = advancePayments.filter((payment) => {
    if (advanceDateFilter === 'today' && payment.date !== new Date().toISOString().slice(0, 10)) {
      return false;
    }
    if (advanceDateFilter === 'active' && payment.remainingBalance <= 0) {
      return false;
    }
    if (cashierPatientId && payment.patientId !== cashierPatientId) {
      return false;
    }
    const query = advanceSearchQuery.trim().toLowerCase();
    if (!query) return true;

    return [
      payment.receiptNumber,
      payment.patientName,
      payment.patientMrn,
      payment.purpose,
      payment.paymentMethod,
      payment.cashierName,
    ].some((value) => value && value.toLowerCase().includes(query));
  });

  // Refund Totals
  const totalRefunded = refundPayments
    .filter((refund) => refund.status === 'Completed')
    .reduce((sum, refund) => sum + refund.amount, 0);
  const pendingRefundApprovals = refundPayments.filter((refund) => refund.status === 'Pending Approval').length;
  const overdueInvoiceCount = issuedInvoices.filter((invoice) =>
    Number(invoice.balanceDue) > 0 && invoice.dueDate < new Date().toISOString().slice(0, 10)
  ).length;

  // POS Totals & Filters
  const totalPosVolume = posTransactions.reduce((sum, p) => sum + p.amount, 0);
  const settledPosCount = posTransactions.filter((p) => p.status.includes('Settled') || p.status.includes('Approved')).length;
  const filteredPosTransactions = posTransactions.filter((tx) => {
    if (posTerminalFilter !== 'all' && !tx.terminalName.toLowerCase().includes(posTerminalFilter.toLowerCase())) {
      return false;
    }
    const query = posSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      tx.id,
      tx.batchNumber,
      tx.terminalName,
      tx.patientName,
      tx.patientId,
      tx.cardType,
      tx.cardLast4,
      tx.authCode,
      tx.rrnNumber,
      tx.cashierName,
      tx.status,
    ].some((val) => val && val.toLowerCase().includes(query));
  });

  // Insurance Approval Totals
  const totalApprovedPreAuth = insuranceApprovals
    .filter((approval) => approval.approvalStatus === 'Approved')
    .reduce((sum, approval) => sum + approval.approvedAmount, 0);
  const pendingInsuranceApprovals = insuranceApprovals.filter(
    (approval) => ['Pending', 'Pending Info', 'Query Raised', 'Waiver Notification Due'].includes(approval.approvalStatus)
  ).length;
  const insuranceDoctorOptions = [...new Set(insuranceApprovals.map((approval) => approval.doctorName))].sort();
  const filteredInsuranceApprovals = insuranceApprovals.filter((approval) =>
    (!insuranceDateFilter || approval.approvalDate === insuranceDateFilter) &&
    (!cashierPatientId || approval.patientId === cashierPatientId) &&
    (insuranceDoctorFilter === 'all' || approval.doctorName === insuranceDoctorFilter) &&
    (insuranceApprovalStatusFilter === 'all' || approval.approvalStatus === insuranceApprovalStatusFilter) &&
    (insuranceServiceCategoryFilter === 'all' || approval.serviceCategory === insuranceServiceCategoryFilter) &&
    (!insuranceSearchQuery.trim() || [
      approval.approvalNumber,
      approval.insuranceProvider,
      approval.policyNumber,
      approval.serviceName,
      approval.serviceCode || '',
      approval.doctorName,
      approval.department,
    ].some((value) => value.toLowerCase().includes(insuranceSearchQuery.trim().toLowerCase())))
  );
  const selectedInsurancePatient = patients.find((patient) => patient.id === cashierPatientId);
  const selectedPatientVisits = [...(selectedInsurancePatient?.facilityVisits || [])]
    .sort((firstVisit, secondVisit) => secondVisit.visitDate.localeCompare(firstVisit.visitDate));

  const handlePrint = () => {
    window.print();
  };

  const openReprintForInvoice = (invoiceId: string) => {
    setReprintInvoiceTargetId(invoiceId);
    setIsReprintInvoiceOpen(true);
  };

  const openReprintForAdvance = (advanceId: string) => {
    setReprintAdvanceTargetId(advanceId);
    setIsReprintAdvanceOpen(true);
  };

  // Dynamic header configuration based on active subtab
  const getSubTabInfo = () => {
    switch (activeSubTab) {
      case 'invoices':
        return {
          title: 'Invoicing & Charge Generation',
          description: 'Generate, issue, and manage outpatient and inpatient medical billing invoices.',
          icon: ReceiptText,
          iconColor: 'bg-blue-50 text-blue-600',
          action: (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setReprintInvoiceTargetId(undefined);
                  setIsReprintInvoiceOpen(true);
                }}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Reprint Invoice</span>
              </button>
              <button
                type="button"
                onClick={onOpenNewInvoice}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Generate Invoice</span>
              </button>
            </div>
          ),
        };
      case 'dues':
        return {
          title: 'Due Settlement & Balances',
          description: 'Settle outstanding patient encounter dues and review the cashier due register.',
          icon: UserCheck,
          iconColor: 'bg-rose-50 text-rose-600',
          action: (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Print Due Summary</span>
              </button>
            </div>
          ),
        };
      case 'advance':
        return {
          title: 'Patient Advance Deposits',
          description: 'Collect advance deposits, issue official receipts, and manage available deposit credits.',
          icon: DollarSign,
          iconColor: 'bg-emerald-50 text-emerald-600',
          action: (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setReprintAdvanceTargetId(undefined);
                  setIsReprintAdvanceOpen(true);
                }}
                className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Reprint Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAdvanceModalOpen(true)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Collect Advance</span>
              </button>
            </div>
          ),
        };
      case 'pos':
        return {
          title: 'POS Terminal & Cash Drawer Transactions',
          description: 'Real-time log of card terminal transactions, batch settlements, and cash drawer receipts.',
          icon: Terminal,
          iconColor: 'bg-indigo-50 text-indigo-600',
          action: (
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print POS Settlement</span>
            </button>
          ),
        };
      case 'refunds':
        return {
          title: 'Refunds & Payment Adjustments',
          description: 'Process patient billing refunds, credit reversals, and supervisor approvals.',
          icon: RotateCcw,
          iconColor: 'bg-amber-50 text-amber-600',
          action: (
            <button
              type="button"
              onClick={() => setIsRefundModalOpen(true)}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Process Refund</span>
            </button>
          ),
        };
      case 'insurance':
        return {
          title: 'Insurance Pre-Authorizations & Claims',
          description: 'Review pre-authorizations, policy eligibility, and insurance claim approvals.',
          icon: ShieldCheck,
          iconColor: 'bg-purple-50 text-purple-600',
          action: (
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Authorizations</span>
            </button>
          ),
        };
      case 'overview':
      default:
        return {
          title: 'Billing & Cashiering Command Center',
          description: 'Manage patient invoices, encounter balances, deposits, refunds, and cashier reconciliation.',
          icon: CreditCard,
          iconColor: 'bg-blue-50 text-blue-600',
          action: (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAdvanceModalOpen(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Collect Deposit</span>
              </button>
              <button
                type="button"
                onClick={onOpenNewInvoice}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Generate Invoice</span>
              </button>
            </div>
          ),
        };
    }
  };

  const subTabInfo = getSubTabInfo();
  const HeaderIcon = subTabInfo.icon;

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Billing desk header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-8 h-8 rounded-lg ${subTabInfo.iconColor} flex items-center justify-center font-bold`}>
              <HeaderIcon className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              {subTabInfo.title}
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            {subTabInfo.description}
          </p>
        </div>

        {/* Action button specific to current subtab */}
        <div className="shrink-0">
          {subTabInfo.action}
        </div>
      </div>

      {activeSubTab === 'overview' && (
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Open patient balances', value: `$${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, detail: `${outstandingPatients.length} patients · ${overdueInvoiceCount} overdue encounters`, icon: UserCheck, tab: 'dues' as BillingSubTab, color: 'text-rose-700 bg-rose-50' },
              { label: 'Invoices', value: `${issuedInvoices.length}`, detail: draftInvoiceCount ? `${draftInvoiceCount} draft ready to issue` : 'Issued invoices and claims', icon: ReceiptText, tab: 'invoices' as BillingSubTab, color: 'text-blue-700 bg-blue-50' },
              { label: 'Advance balances', value: `$${totalAdvanceRemaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, detail: `${advancePayments.length} deposit receipts`, icon: DollarSign, tab: 'advance' as BillingSubTab, color: 'text-emerald-700 bg-emerald-50' },
              { label: 'Refunds to review', value: `${pendingRefundApprovals}`, detail: pendingRefundApprovals ? 'Manager approval required' : `${refundPayments.length} total refund requests`, icon: RotateCcw, tab: 'refunds' as BillingSubTab, color: pendingRefundApprovals ? 'text-amber-700 bg-amber-50' : 'text-slate-700 bg-slate-100' },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <button key={card.label} type="button" onClick={() => handleSelectSubTab(card.tab)} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md cursor-pointer">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.color}`}><Icon className="h-4 w-4" /></span>
                  <span className="mt-3 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{card.label}</span>
                  <span className="mt-1 block text-xl font-bold text-slate-900">{card.value}</span>
                  <span className="mt-1 block text-[10px] text-slate-500">{card.detail}</span>
                </button>
              );
            })}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-900">Cashier shortcuts</h3>
              <p className="mt-1 text-[10px] text-slate-500">Choose a task to go directly to the right desk.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <button type="button" onClick={onOpenNewInvoice} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer">
                <ReceiptText className="h-4 w-4 text-blue-700" /><span><strong className="block text-xs text-slate-900">Create invoice</strong><small className="text-[10px] text-slate-500">Add OPD/IPD charges</small></span>
              </button>
              <button type="button" onClick={() => handleSelectSubTab('dues')} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-teal-300 hover:bg-teal-50/50 cursor-pointer">
                <CreditCard className="h-4 w-4 text-teal-700" /><span><strong className="block text-xs text-slate-900">Collect a balance</strong><small className="text-[10px] text-slate-500">Find patient and settle visit</small></span>
              </button>
              <button type="button" onClick={() => setIsAdvanceModalOpen(true)} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-emerald-300 hover:bg-emerald-50/50 cursor-pointer">
                <Plus className="h-4 w-4 text-emerald-700" /><span><strong className="block text-xs text-slate-900">Collect a deposit</strong><small className="text-[10px] text-slate-500">Issue an advance receipt</small></span>
              </button>
              <button type="button" onClick={() => handleSelectSubTab('refunds')} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-rose-300 hover:bg-rose-50/50 cursor-pointer">
                <RotateCcw className="h-4 w-4 text-rose-700" /><span><strong className="block text-xs text-slate-900">Refund or adjustment</strong><small className="text-[10px] text-slate-500">Submit or approve refund</small></span>
              </button>
              {canViewInsuranceApprovals && <button type="button" onClick={() => handleSelectSubTab('insurance')} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-purple-300 hover:bg-purple-50/50 cursor-pointer">
                <ShieldCheck className="h-4 w-4 text-purple-700" /><span><strong className="block text-xs text-slate-900">Insurance approvals</strong><small className="text-[10px] text-slate-500">{pendingInsuranceApprovals} pending or queried · view patient authorizations</small></span>
              </button>}
            </div>
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div><h3 className="text-sm font-bold text-slate-900">Needs attention</h3><p className="mt-1 text-[10px] text-slate-500">Review work that may need follow-up.</p></div>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-3 divide-y divide-slate-100">
                {draftInvoiceCount > 0 && <button type="button" onClick={() => { handleSelectSubTab('invoices'); setStatusFilter('draft'); }} className="flex w-full items-center justify-between py-2 text-left text-xs hover:text-blue-700 cursor-pointer"><span>{draftInvoiceCount} invoice drafts to issue</span><span className="font-semibold">Review →</span></button>}
                {overdueInvoiceCount > 0 && <button type="button" onClick={() => { handleSelectSubTab('invoices'); setStatusFilter('overdue'); }} className="flex w-full items-center justify-between py-2 text-left text-xs hover:text-blue-700 cursor-pointer"><span>{overdueInvoiceCount} overdue encounters</span><span className="font-semibold">Review →</span></button>}
                {pendingRefundApprovals > 0 && <button type="button" onClick={() => handleSelectSubTab('refunds')} className="flex w-full items-center justify-between py-2 text-left text-xs hover:text-blue-700 cursor-pointer"><span>{pendingRefundApprovals} refunds awaiting manager approval</span><span className="font-semibold">Review →</span></button>}
                {draftInvoiceCount === 0 && overdueInvoiceCount === 0 && pendingRefundApprovals === 0 && <p className="py-2 text-xs text-slate-500">No urgent billing tasks right now.</p>}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div><h3 className="text-sm font-bold text-slate-900">Daily operations</h3><p className="mt-1 text-[10px] text-slate-500">Receipts, insurance approvals, and payment reconciliation.</p></div>
                <Building2 className="h-4 w-4 text-slate-500" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => handleSelectSubTab('advance')} className="rounded-lg bg-slate-50 p-3 text-left hover:bg-slate-100 cursor-pointer"><strong className="block text-xs text-slate-900">Advance register</strong><span className="text-[10px] text-slate-500">{advancePayments.length} receipts · ${totalAdvanceDeposited.toFixed(2)} collected</span></button>
                <button type="button" onClick={() => handleSelectSubTab('pos')} className="rounded-lg bg-slate-50 p-3 text-left hover:bg-slate-100 cursor-pointer"><strong className="block text-xs text-slate-900">POS &amp; cash drawer</strong><span className="text-[10px] text-slate-500">{settledPosCount} settled · ${totalPosVolume.toFixed(2)} volume</span></button>
                {canViewInsuranceApprovals && <button type="button" onClick={() => handleSelectSubTab('insurance')} className="col-span-2 flex items-center justify-between rounded-lg bg-slate-50 p-3 text-left hover:bg-slate-100 cursor-pointer"><span><strong className="block text-xs text-slate-900">Insurance approvals</strong><span className="text-[10px] text-slate-500">{insuranceApprovals.length} authorization records · {pendingInsuranceApprovals} need follow-up</span></span><ShieldCheck className="h-4 w-4 text-slate-500" /></button>}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* SUB-TAB 1: INVOICES & CLAIMS */}
      {activeSubTab === 'invoices' && (
        <div className="space-y-4">
          {/* Revenue Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Invoiced Volume
              </span>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                ${totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {invoices.length} Issued Hospital Billing Records
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Collected Revenue
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                ${totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
                Successfully Cleared & Reconciled
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Outstanding Accounts Receivable
              </span>
              <div className="text-2xl font-bold font-mono text-rose-600 mt-1">
                ${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-rose-700 font-semibold mt-1 block">
                Patient balances remaining across encounters
              </span>
            </div>
          </div>

          {/* Active Patient Filter Badge */}
          {cashierPatientId && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-xl text-xs">
              <span className="flex items-center gap-1.5">
                <span className="font-semibold">Filtered for patient:</span>
                <span className="font-mono bg-blue-100 px-1.5 py-0.5 rounded">{cashierPatientId}</span>
              </span>
              <button
                type="button"
                onClick={() => setCashierPatientId('')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
              >
                Clear filter (View all hospital invoices)
              </button>
            </div>
          )}

          {/* Filter and Search Bar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search invoice #, patient name, MRN, phone, insurance..."
                value={invoiceSearchQuery}
                onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
              />
            </div>

            <div className="flex items-center gap-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'outstanding', label: 'Outstanding' },
                { id: 'overdue', label: 'Overdue' },
                { id: 'draft', label: 'Draft' },
                { id: 'paid', label: 'Paid' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Hospital Invoicing & Claims Ledger ({filteredInvoices.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setReprintInvoiceTargetId(undefined);
                    setIsReprintInvoiceOpen(true);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-xs font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3 h-3 text-slate-500" />
                  <span>Reprint Any Invoice</span>
                </button>
                <button
                  onClick={onOpenNewInvoice}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Generate Invoice</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <th className="py-2.5 px-3">Invoice ID</th>
                    <th className="py-2.5 px-3">Patient</th>
                    <th className="py-2.5 px-3">Issue / Due Date</th>
                    <th className="py-2.5 px-3">Total Amount</th>
                    <th className="py-2.5 px-3">Insurance Covered</th>
                    <th className="py-2.5 px-3">Balance Due</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        {cashierPatientId
                          ? 'No invoices for this patient match the selected search or filter.'
                          : 'No invoices match the selected search or status filter. Click "+ Generate Invoice" to create one.'}
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const overdue = Number(inv.balanceDue) > 0 && inv.dueDate < new Date().toISOString().slice(0, 10);
                      const displayStatus = overdue ? 'Overdue' : inv.status;
                      const statusClass = displayStatus === 'Paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : displayStatus === 'Partially Paid'
                        ? 'bg-amber-100 text-amber-800'
                        : displayStatus === 'Pending Insurance' || displayStatus === 'Insurance Processing'
                        ? 'bg-blue-100 text-blue-800'
                        : displayStatus === 'Draft'
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-rose-100 text-rose-800';
                      return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-800">
                          {inv.id}
                          {inv.encounterTokenId && (
                            <div className="mt-0.5 font-sans text-[9px] font-semibold text-teal-700">
                              Token {receptionTokens.find((token) => token.id === inv.encounterTokenId)?.tokenNumber || inv.encounterTokenId}
                            </div>
                          )}
                          {inv.encounterType && <div className="mt-0.5 font-sans text-[9px] font-semibold text-slate-500">{inv.encounterType} encounter</div>}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{inv.patientName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{inv.patientId}</div>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                          <div>{inv.issueDate}</div>
                          <div className="text-[10px] text-slate-400">Due: {inv.dueDate}</div>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-900">
                          ${(Number(inv.totalAmount ?? inv.subtotal) || 0).toFixed(2)}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-emerald-600 font-semibold">
                          ${(Number(inv.insuranceCoveredAmount ?? inv.insuranceCovered) || 0).toFixed(2)}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-rose-600">
                          ${(Number(inv.balanceDue) || 0).toFixed(2)}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusClass}`}
                          >
                            {displayStatus}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap text-right space-x-1.5">
                          <button
                            onClick={() => openReprintForInvoice(inv.id)}
                            title="Reprint official invoice"
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {inv.status === 'Draft' ? (
                            currentRole === 'admin' || currentRole === 'receptionist' ? (
                              <button type="button" onClick={() => issueInvoice(inv.id)} className="rounded bg-teal-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-teal-800">Issue</button>
                            ) : <span className="text-[10px] text-slate-500">Draft</span>
                          ) : inv.balanceDue > 0 ? (
                            <button
                              onClick={() => onOpenPaymentModal(inv)}
                              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded text-xs inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <DollarSign className="w-3 h-3" /> Collect
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-0.5">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                            </span>
                          )}
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'dues' && (
        <div className="space-y-4">
          {/* Patient Lookup Dedicated to Due Settlement */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Search &amp; Settle Patient Dues
                </h3>
                <p className="text-[11px] text-slate-500">
                  Search by patient name, MRN, token, phone, or registration number to focus on a specific patient, or browse all outstanding balances below.
                </p>
              </div>
              {cashierPatientId && (
                <button
                  type="button"
                  onClick={() => setCashierPatientId('')}
                  className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-md transition cursor-pointer self-start sm:self-auto"
                >
                  Clear Filter (Show All {outstandingPatients.length} Patients with Dues)
                </button>
              )}
            </div>
            <PatientLookup
              patients={patients}
              tokens={receptionTokens}
              selectedPatientId={cashierPatientId}
              onSelect={setCashierPatientId}
              allowAllPatients
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Patient balances due</p>
              <p className="mt-1 text-2xl font-bold font-mono text-rose-700">${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="mt-1 text-[10px] text-slate-500">Across {outstandingPatients.reduce((sum, item) => sum + item.invoices.length, 0)} unpaid encounters</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Patients with a balance</p>
              <p className="mt-1 text-2xl font-bold font-mono text-slate-900">{outstandingPatients.length}</p>
              <p className="mt-1 text-[10px] text-slate-500">Consolidated by patient across visits</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Available advance balances</p>
              <p className="mt-1 text-2xl font-bold font-mono text-emerald-800">${totalAdvanceRemaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="mt-1 text-[10px] text-emerald-700">Review deposits before requesting payment</p>
            </div>
          </div>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Patient due register</h3>
                <p className="mt-0.5 text-[10px] text-slate-500">View balances entered by cashiers today, yesterday, or any selected date. Settled dues remain in the history.</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={() => setDueRecordDateFilter(new Date().toISOString().slice(0, 10))} aria-pressed={dueRecordDateFilter === new Date().toISOString().slice(0, 10)} className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold ${dueRecordDateFilter === new Date().toISOString().slice(0, 10) ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}>Today</button>
                <button type="button" onClick={() => setDueRecordDateFilter(yesterdayDate)} aria-pressed={dueRecordDateFilter === yesterdayDate} className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold ${dueRecordDateFilter === yesterdayDate ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}>Yesterday</button>
                <button type="button" onClick={() => setDueRecordDateFilter('')} aria-pressed={!dueRecordDateFilter} className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold ${!dueRecordDateFilter ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}>All dates</button>
                <label className="text-[10px] font-semibold text-slate-600">
                  Choose date
                  <input type="date" value={dueRecordDateFilter} onChange={(event) => setDueRecordDateFilter(event.target.value)} className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] font-normal" />
                </label>
              </div>
            </header>
            <div className="grid gap-3 border-b border-slate-100 p-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Due records</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{dueRegisterInvoices.length}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Amount entered</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-900">${dueRegisterRecordedTotal.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-rose-700">Still outstanding</p>
                <p className="mt-1 font-mono text-lg font-bold text-rose-800">${dueRegisterOutstandingTotal.toFixed(2)}</p>
              </div>
            </div>
            {dueRegisterInvoices.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">No patient dues were recorded for {dueRecordDateFilter || 'the selected history'}{cashierPatientId ? ' for this patient' : ''}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-white text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">Due date / time</th>
                      <th className="px-3 py-2.5">Patient / invoice</th>
                      <th className="px-3 py-2.5">Cashier</th>
                      <th className="px-3 py-2.5 text-right">Amount entered</th>
                      <th className="px-3 py-2.5 text-right">Remaining due</th>
                      <th className="px-3 py-2.5">Remark</th>
                      <th className="px-3 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dueRegisterInvoices.map((invoice) => {
                      const patient = patients.find((item) => item.id === invoice.patientId);
                      const recordedAt = invoice.dueRecordedAt || invoice.createdAt;
                      const remainingDue = Math.max(0, Number(invoice.balanceDue) || 0);
                      return (
                        <tr key={invoice.id} className="align-top hover:bg-slate-50/70">
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                            <p>{recordedAt?.slice(0, 10) || invoice.issueDate}</p>
                            {recordedAt && <p className="mt-0.5 text-[10px] text-slate-500">{new Date(recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="font-semibold text-slate-900">{patient ? `${patient.firstName} ${patient.lastName}` : invoice.patientName}</p>
                            <p className="mt-0.5 font-mono text-[10px] text-slate-500">{patient?.rgNo || invoice.patientId} · {invoice.id}</p>
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">{invoice.dueRecordedBy || 'Not recorded'}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-semibold text-slate-800">${Number(invoice.patientPayable).toFixed(2)}</td>
                          <td className={`whitespace-nowrap px-3 py-2.5 text-right font-mono font-bold ${remainingDue > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {remainingDue > 0 ? `$${remainingDue.toFixed(2)}` : 'Cleared'}
                          </td>
                          <td className="max-w-xs px-3 py-2.5 text-slate-600">{invoice.dueRemarks || invoice.notes || 'No remark recorded'}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right">
                            {remainingDue > 0
                              ? <button type="button" onClick={() => onOpenPaymentModal(invoice)} className="rounded-md bg-teal-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-teal-800">Settle bill</button>
                              : <span className="text-[10px] font-semibold text-emerald-700">Settled</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {cashierPatientId ? 'Filtered Patient Outstanding Dues' : 'All Patient Outstanding Dues'}
                </h3>
                <p className="mt-0.5 text-[10px] text-slate-500">Balances are grouped across encounters. Expand any patient to settle an outstanding bill.</p>
              </div>
            </header>
            {(cashierPatientId ? filteredOutstandingPatients : outstandingPatients).length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">
                {cashierPatientId
                  ? 'No outstanding dues for this patient. All encounters are fully settled.'
                  : 'No patient balances are currently outstanding. All accounts are settled.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(cashierPatientId ? filteredOutstandingPatients : outstandingPatients).map((patient) => {
                  const expanded = selectedOutstandingPatientId === patient.patientId;
                  return (
                    <div key={patient.patientId}>
                      <button type="button" onClick={() => setSelectedOutstandingPatientId(expanded ? null : patient.patientId)} className="grid w-full grid-cols-2 items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_140px_150px_170px_120px]">
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-slate-900">{patient.patientName}</span>
                          <span className="block font-mono text-[10px] text-slate-500">MRN: {patient.mrn} · {patient.invoices.length} encounter{patient.invoices.length === 1 ? '' : 's'}</span>
                        </span>
                        <span className="text-[10px] text-slate-600">Available advance<br /><strong className="font-mono">${patient.availableAdvance.toFixed(2)}</strong></span>
                        <span className="text-right font-mono text-sm font-bold text-rose-700">${patient.balance.toFixed(2)} due</span>
                        <span className="text-[10px] text-slate-600">Potential after advance<br /><strong className="font-mono">${Math.max(0, patient.balance - patient.availableAdvance).toFixed(2)}</strong></span>
                        <span className="text-right text-[10px] font-semibold text-teal-700">{expanded ? 'Hide encounters' : 'View encounters'}</span>
                      </button>
                      {expanded && (
                        <div className="space-y-2 bg-slate-50 px-4 py-3">
                          {patient.invoices.map((invoice) => {
                            const overdue = invoice.dueDate < new Date().toISOString().slice(0, 10);
                            return (
                              <div key={invoice.id} className="flex flex-col justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
                                <div>
                                  <p className="text-xs font-bold text-slate-900">{invoice.id} {invoice.encounterType && <span className="font-semibold text-teal-700">· {invoice.encounterType}</span>} <span className="font-normal text-slate-500">· Issued {invoice.issueDate}</span></p>
                                  <p className="mt-0.5 text-[10px] text-slate-500">Due {invoice.dueDate}{overdue ? ' · Overdue' : ''} · {invoice.items.length} charge line{invoice.items.length === 1 ? '' : 's'}</p>
                                </div>
                                <div className="flex items-center justify-between gap-3 sm:justify-end">
                                  <span className="font-mono text-sm font-bold text-rose-700">${Number(invoice.balanceDue).toFixed(2)}</span>
                                  <button type="button" onClick={() => onOpenPaymentModal(invoice)} className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800">Settle bill</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* SUB-TAB 2: INSURANCE APPROVALS & PRE-AUTHORISATION */}
      {activeSubTab === 'insurance' && canViewInsuranceApprovals && (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">
            SLA values are operational targets (6 hours elective outpatient; 24 hours elective inpatient). Emergency requests use the 24-hour post-stabilization waiver notice path. This workspace records and times requests locally; no DHPO/eClaimLink/Shafafiya gateway is connected.
          </div>
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <h2 className="text-xs font-bold text-slate-900">Payer CPT / ICD-10 rule mappings</h2>
              <p className="mt-1 text-[10px] text-slate-600">
                Configure exact payer-specific code pairs from an approved, current payer rule source. No rules are preloaded; unmatched pairs stay in mapping review and are not submitted to an external gateway.
              </p>
            </div>
            <form onSubmit={addInsuranceCodeMapping} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-8">
              <input value={mappingPayerId} onChange={(event) => setMappingPayerId(event.target.value)} placeholder="Payer ID" aria-label="Mapping payer ID" className="rounded-md border border-slate-300 px-2.5 py-2 text-xs" />
              <input value={mappingCptCode} onChange={(event) => setMappingCptCode(event.target.value)} placeholder="CPT / service code" aria-label="Mapping CPT code" className="rounded-md border border-slate-300 px-2.5 py-2 text-xs" />
              <input value={mappingIcd10Code} onChange={(event) => setMappingIcd10Code(event.target.value)} placeholder="ICD-10 code" aria-label="Mapping ICD-10 code" className="rounded-md border border-slate-300 px-2.5 py-2 text-xs" />
              <input value={mappingSource} onChange={(event) => setMappingSource(event.target.value)} placeholder="Rule source/version" aria-label="Mapping source or version" className="rounded-md border border-slate-300 px-2.5 py-2 text-xs" />
              <input type="date" value={mappingEffectiveFrom} onChange={(event) => setMappingEffectiveFrom(event.target.value)} aria-label="Mapping effective date" className="rounded-md border border-slate-300 px-2.5 py-2 text-xs" />
              <input type="date" value={mappingEffectiveUntil} onChange={(event) => setMappingEffectiveUntil(event.target.value)} aria-label="Mapping expiry date" className="rounded-md border border-slate-300 px-2.5 py-2 text-xs" />
              <select value={mappingClassification} onChange={(event) => setMappingClassification(event.target.value as InsuranceCodeMapping['classification'])} aria-label="Mapping classification" className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs">
                {(['Direct Billing', 'Pre-Authorization Required', 'Excluded', 'Pre-Existing'] as const).map((classification) => <option key={classification} value={classification}>{classification}</option>)}
              </select>
              <button type="submit" className="rounded-md bg-teal-700 px-3 py-2 text-xs font-bold text-white hover:bg-teal-800">Add rule</button>
              {mappingError && <p role="alert" className="text-[10px] font-semibold text-rose-700 sm:col-span-2 lg:col-span-8">{mappingError}</p>}
            </form>
            {insuranceCodeMappings.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {insuranceCodeMappings.map((mapping, index) => (
                  <li key={`${mapping.payerId}-${mapping.cptCode}-${mapping.icd10Code}-${index}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[10px]">
                    <span className="font-mono text-slate-700">{mapping.payerId} · {mapping.cptCode} · {mapping.icd10Code} · {mapping.source} · effective {mapping.effectiveFrom}{mapping.effectiveUntil ? ` – ${mapping.effectiveUntil}` : ''}</span>
                    <span className="font-semibold text-violet-800">{mapping.classification}</span>
                    <button type="button" onClick={() => removeInsuranceCodeMapping(mapping)} className="font-semibold text-rose-700 hover:underline">Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {/* Header & Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Pre-Authorised Sum
              </span>
              <div className="text-2xl font-bold font-mono text-purple-600 mt-1">
                ${totalApprovedPreAuth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Approved by Third-Party Payers (TPAs)
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Active Insurance Approvals
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                {insuranceApprovals.filter((a) => a.approvalStatus === 'Approved').length} Authorisations
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
                Under Doctor Visit & Procedure / Lab / Radiology
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Approval handling
                </span>
                <p className="text-xs text-slate-600 mt-1">
                  Medical staff request authorization from the patient facility record. Medical Coders review requests and publish insurer decisions; billing tracks the outcome here.
                </p>
              </div>
            </div>
          </div>

          <section aria-label="Filter insurance approvals" className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[11px] font-semibold text-slate-700">
              Search authorization
              <input type="search" value={insuranceSearchQuery} onChange={(event) => setInsuranceSearchQuery(event.target.value)} placeholder="Approval no., service, insurer..." className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs font-normal" />
            </label>
            <label className="text-[11px] font-semibold text-slate-700">
              Approval date
              <input type="date" value={insuranceDateFilter} onChange={(event) => setInsuranceDateFilter(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs font-normal" />
            </label>
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              <span>
                {selectedInsurancePatient
                  ? `${selectedInsurancePatient.firstName} ${selectedInsurancePatient.lastName} · ${selectedInsurancePatient.rgNo || selectedInsurancePatient.id}`
                  : 'All patients (or choose in dues)'}
              </span>
              {cashierPatientId && (
                <button
                  type="button"
                  onClick={() => setCashierPatientId('')}
                  className="font-semibold text-purple-700 underline hover:text-purple-900"
                >
                  Clear
                </button>
              )}
            </div>
            <label className="text-[11px] font-semibold text-slate-700">
              Attending doctor
              <select value={insuranceDoctorFilter} onChange={(event) => setInsuranceDoctorFilter(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal">
                <option value="all">All doctors</option>
                {insuranceDoctorOptions.map((doctorName) => <option key={doctorName} value={doctorName}>{doctorName}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-700">
              Approval status
              <select value={insuranceApprovalStatusFilter} onChange={(event) => setInsuranceApprovalStatusFilter(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal">
                <option value="all">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="Pending Info">Pending info</option>
                <option value="Query Raised">Query raised</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Waiver Notification Due">Waiver notification due</option>
                <option value="Waiver Notified">Waiver notified</option>
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-700">
              Service category
              <select value={insuranceServiceCategoryFilter} onChange={(event) => setInsuranceServiceCategoryFilter(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-normal">
                <option value="all">All categories</option>
                <option value="Procedure">Procedure</option>
                <option value="Lab Test">Lab test</option>
                <option value="Radiology">Radiology</option>
                <option value="Consultation">Consultation</option>
                <option value="IPD Admission">IPD admission</option>
              </select>
            </label>
            <div className="flex items-end justify-between gap-2 text-xs">
              <span className="pb-2 text-slate-500">{filteredInsuranceApprovals.length} approvals</span>
              <button type="button" onClick={() => { setInsuranceSearchQuery(''); setInsuranceDateFilter(''); setInsuranceDoctorFilter('all'); setInsuranceApprovalStatusFilter('all'); setInsuranceServiceCategoryFilter('all'); }} className="mb-1 rounded-md border border-slate-300 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">Clear filters</button>
            </div>
          </section>

          {/* Insurance Approvals Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Insurance Pre-Authorisation & Approval Numbers Registry ({filteredInsuranceApprovals.length})
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <th className="py-2.5 px-3">Approval No. / Insurer</th>
                    <th className="py-2.5 px-3">Patient & MRN</th>
                    <th className="py-2.5 px-3">Attending Doctor Visit</th>
                    <th className="py-2.5 px-3">Procedure / Lab / Radiology</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Approved Amount</th>
                    <th className="py-2.5 px-3">Copay %</th>
                    <th className="py-2.5 px-3">Valid Until</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredInsuranceApprovals.length === 0 ? (
                    <tr><td colSpan={9} className="py-8 text-center text-xs text-slate-500">No insurance pre-authorisations match the current search or filters.</td></tr>
                  ) : filteredInsuranceApprovals.map((appr) => (
                    <tr key={appr.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-mono font-bold text-purple-700">{appr.approvalNumber}</div>
                        <div className="text-[10px] text-slate-500">{appr.insuranceProvider} ({appr.policyNumber})</div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{appr.patientName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{appr.patientMrn}</div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-medium text-slate-800 flex items-center gap-1">
                          <Stethoscope className="w-3 h-3 text-slate-400" />
                          <span>{appr.doctorName}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">{appr.department}</div>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800 line-clamp-1 max-w-xs">{appr.serviceName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{appr.serviceCode || 'No CPT/service code'}{appr.icd10Code ? ` · ICD-10 ${appr.icd10Code}` : ''}</div>
                        {appr.clinicalRationale && <div className="mt-1 max-w-xs truncate text-[10px] text-slate-500" title={appr.clinicalRationale}>{appr.clinicalRationale}</div>}
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[9px] font-semibold text-teal-700">Request payload details</summary>
                          <dl className="mt-1 space-y-0.5 text-[9px] text-slate-600">
                            <div>Emirates ID: {appr.emiratesId || 'Missing'}</div>
                            <div>Payer ID: {appr.payerId || 'Missing'} · Facility DHA license: {appr.facilityDhaLicense || 'Missing'}</div>
                            <div>Doctor license: {appr.doctorLicense || 'Missing'} · Pathway: {appr.requestType || 'Not recorded'}</div>
                            <div>Clinical rationale: {appr.clinicalRationale || 'Missing'}</div>
                            {appr.financialBreakdown && <div>{appr.financialBreakdown.currency} {appr.financialBreakdown.requestedAmount.toFixed(2)} requested · {appr.financialBreakdown.copayPercentage}% copay ({appr.financialBreakdown.currency} {appr.financialBreakdown.copayAmount.toFixed(2)}) · {appr.financialBreakdown.currency} {appr.financialBreakdown.patientPayable.toFixed(2)} patient payable</div>}
                            <div>Lab report: {appr.supportingDocuments?.labReport ? 'Recorded' : 'Not recorded'} · Imaging report: {appr.supportingDocuments?.imagingReport ? 'Recorded' : 'Not recorded'}</div>
                          </dl>
                        </details>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            appr.serviceCategory === 'Procedure'
                              ? 'bg-blue-100 text-blue-800'
                              : appr.serviceCategory === 'Radiology'
                              ? 'bg-indigo-100 text-indigo-800'
                              : appr.serviceCategory === 'Lab Test'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {appr.serviceCategory}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-emerald-700">
                        {appr.financialBreakdown
                          ? `AED ${appr.approvedAmount.toFixed(2)}`
                          : `$${appr.approvedAmount.toFixed(2)}`}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-700">
                        {appr.copayPercentage}% ({appr.financialBreakdown ? 'AED ' : '$'}{appr.copayAmount.toFixed(2)})
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600 text-[11px]">
                        {appr.validUntil}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            appr.approvalStatus === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : appr.approvalStatus === 'Pending'
                              ? 'bg-amber-100 text-amber-800'
                              : appr.approvalStatus === 'Pending Info' || appr.approvalStatus === 'Query Raised'
                              ? 'bg-orange-100 text-orange-800'
                              : appr.approvalStatus === 'Waiver Notification Due'
                              ? 'bg-red-100 text-red-800'
                              : appr.approvalStatus === 'Waiver Notified'
                              ? 'bg-cyan-100 text-cyan-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {appr.approvalStatus}
                        </span>
                        {appr.eligibilityClassification && <div className="mt-1 text-[9px] font-semibold text-violet-700">{appr.eligibilityClassification}</div>}
                        {appr.slaDueAt && <div className={`mt-1 text-[9px] ${Date.now() > Date.parse(appr.slaDueAt) ? 'font-bold text-rose-700' : 'text-slate-500'}`}>Response target {new Date(appr.slaDueAt).toLocaleString()}{Date.now() > Date.parse(appr.slaDueAt) ? ' · overdue' : ''}</div>}
                        {appr.emergencyWaiver && (
                          <div className="mt-1 text-[9px] font-semibold text-red-700">
                            {appr.emergencyWaiver.stabilizedAt
                              ? `Stabilized ${new Date(appr.emergencyWaiver.stabilizedAt).toLocaleString()} · 24h notice due ${appr.emergencyWaiver.postStabilizationNotificationDueAt ? new Date(appr.emergencyWaiver.postStabilizationNotificationDueAt).toLocaleString() : 'target unavailable'}`
                              : 'Emergency waiver · awaiting stabilization time'}
                            {appr.emergencyWaiver.notifiedAt ? ` · Notified ${new Date(appr.emergencyWaiver.notifiedAt).toLocaleString()}` : ''}
                          </div>
                        )}
                        {appr.missingFields?.length ? <div className="mt-1 max-w-xs text-[9px] font-semibold text-rose-700">Action required: {appr.missingFields.join(', ')}</div> : null}
                        {appr.gatewayStatus === 'Not Connected' && <div className="mt-1 text-[9px] text-slate-500">Internal tracking only · gateway not connected</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedInsurancePatient && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col justify-between gap-2 border-b border-slate-200 bg-slate-50/70 p-3.5 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Facility services &amp; insurance authorization · {selectedInsurancePatient.firstName} {selectedInsurancePatient.lastName}</h3>
                  <p className="mt-0.5 text-[10px] text-slate-500">Services entered by the medical team and their linked payer authorization.</p>
                </div>
                <span className="text-[10px] text-slate-500">{selectedInsurancePatient.services?.length || 0} facility services</span>
              </div>
              {!selectedInsurancePatient.services?.length ? (
                <p className="p-4 text-xs text-slate-500">No facility services have been recorded for this patient.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="bg-white text-[10px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Service</th>
                        <th className="px-3 py-2.5">Added to facility record</th>
                        <th className="px-3 py-2.5">Estimated cost</th>
                        <th className="px-3 py-2.5">Authorization</th>
                        <th className="px-3 py-2.5">Status / coverage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInsurancePatient.services.map((service) => {
                        const approval = insuranceApprovals.find((record) => record.id === service.insuranceApprovalId);
                        return (
                          <tr key={service.id}>
                            <td className="px-3 py-2.5">
                              <p className="font-semibold text-slate-800">{service.name}</p>
                              <p className="text-[10px] text-slate-500">{service.category}{service.serviceCode ? ` · ${service.serviceCode}` : ''}</p>
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">{new Date(service.addedAt).toLocaleDateString()} · {service.addedBy}</td>
                            <td className="px-3 py-2.5 font-mono text-slate-700">${service.estimatedCost.toFixed(2)}</td>
                            <td className="px-3 py-2.5">
                              <p className="font-mono text-slate-800">{approval?.approvalNumber || (approval ? 'Request pending' : 'Not requested')}</p>
                              {approval && <p className="text-[10px] text-slate-500">{approval.insuranceProvider} · {approval.policyNumber}</p>}
                            </td>
                            <td className="px-3 py-2.5">
                              {approval ? (
                                <>
                                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                    approval.approvalStatus === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                                    approval.approvalStatus === 'Pending' ? 'bg-amber-100 text-amber-800' :
                                    approval.approvalStatus === 'Query Raised' ? 'bg-orange-100 text-orange-800' :
                                    'bg-rose-100 text-rose-800'
                                  }`}>{approval.approvalStatus}</span>
                                  <p className="mt-1 text-[10px] text-slate-600">
                                    {approval.approvalStatus === 'Approved'
                                      ? `$${approval.approvedAmount.toFixed(2)} approved · ${approval.copayPercentage}% copay · valid to ${approval.validUntil || 'not specified'}`
                                      : approval.remarks || 'Awaiting payer decision'}
                                  </p>
                                </>
                              ) : <span className="text-[10px] text-slate-500">No authorization request linked</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {selectedInsurancePatient && (
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col justify-between gap-2 border-b border-slate-200 bg-slate-50/70 p-3.5 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Past visits · {selectedInsurancePatient.firstName} {selectedInsurancePatient.lastName}</h3>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-500">{selectedInsurancePatient.id} · All attending doctors</p>
                </div>
                <span className="text-[10px] text-slate-500">{selectedPatientVisits.length} visits</span>
              </div>
              {selectedPatientVisits.length === 0 ? (
                <p className="p-4 text-xs text-slate-500">No past visits are recorded for this patient.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[740px] text-left text-xs">
                    <thead className="bg-white text-[10px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Visit date</th>
                        <th className="px-3 py-2.5">Doctor</th>
                        <th className="px-3 py-2.5">Department / Visit</th>
                        <th className="px-3 py-2.5">Diagnosis</th>
                        <th className="px-3 py-2.5">Disposition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedPatientVisits.map((visit) => (
                        <tr key={visit.id}>
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-slate-700">{visit.visitDate}</td>
                          <td className="px-3 py-2.5"><p className="font-semibold text-slate-900">{visit.doctorName}</p><p className="text-[10px] text-slate-500">{visit.doctorSpecialty}</p></td>
                          <td className="px-3 py-2.5 text-slate-700">{visit.department}<p className="text-[10px] text-slate-500">{visit.visitType}</p></td>
                          <td className="px-3 py-2.5 text-slate-700">{visit.primaryDiagnosis.code} · {visit.primaryDiagnosis.description}</td>
                          <td className="px-3 py-2.5 text-slate-700">{visit.disposition}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* SUB-TAB 3: ADVANCE PAYMENTS */}
      {activeSubTab === 'advance' && (
        <div className="space-y-4">
          {/* Advance Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Advance Deposited
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                ${totalAdvanceDeposited.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {advancePayments.length} Advance Deposit Receipts Collected
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Remaining Deposit Balances
              </span>
              <div className="text-2xl font-bold font-mono text-blue-600 mt-1">
                ${totalAdvanceRemaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-blue-700 font-semibold mt-1 block">
                Available for Invoice Settlement or Refund
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Quick Advance Action
                </span>
                <p className="text-xs text-slate-600 mt-1">
                  Collect patient deposit for inpatient admission, OT surgery, or OPD retainer.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => setIsAdvanceModalOpen(true)}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Collect Advance</span>
                </button>
                <button
                  onClick={() => {
                    setReprintAdvanceTargetId(undefined);
                    setIsReprintAdvanceOpen(true);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Reprint</span>
                </button>
              </div>
            </div>
          </div>

          {/* Active Patient Filter Badge */}
          {cashierPatientId && (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-xl text-xs">
              <span className="flex items-center gap-1.5">
                <span className="font-semibold">Filtered for patient:</span>
                <span className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded">{cashierPatientId}</span>
              </span>
              <button
                type="button"
                onClick={() => setCashierPatientId('')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
              >
                Clear filter (View all advance deposits)
              </button>
            </div>
          )}

          {/* Patient Advance Search and Filters */}
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={advanceSearchQuery}
                  onChange={(event) => setAdvanceSearchQuery(event.target.value)}
                  placeholder="Receipt #, patient name, MRN, purpose, cashier..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                />
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { id: 'all', label: `All Deposits (${advancePayments.length})` },
                  { id: 'active', label: `Active Balances (${advancePayments.filter((a) => a.remainingBalance > 0).length})` },
                  { id: 'today', label: `Today (${advancePayments.filter((a) => a.date === new Date().toISOString().slice(0, 10)).length})` },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setAdvanceDateFilter(pill.id as 'all' | 'today' | 'active')}
                    className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                      advanceDateFilter === pill.id
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Advance Payments Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Advance Deposit Register ({filteredAdvancePayments.length})
                </h3>
              </div>
              <button
                onClick={() => setIsAdvanceModalOpen(true)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Collect Advance Deposit</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <th className="py-2.5 px-3">Receipt No.</th>
                    <th className="py-2.5 px-3">Patient &amp; MRN</th>
                    <th className="py-2.5 px-3">Date / Time</th>
                    <th className="py-2.5 px-3">Deposit Purpose</th>
                    <th className="py-2.5 px-3">Payment Method</th>
                    <th className="py-2.5 px-3">Amount Deposited</th>
                    <th className="py-2.5 px-3">Remaining Balance</th>
                    <th className="py-2.5 px-3">Cashier</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Reprint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredAdvancePayments.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        No advance deposit receipts match the selected search or filter. Click "+ Collect Advance Deposit" to record an advance.
                      </td>
                    </tr>
                  ) : filteredAdvancePayments.map((adv: AdvancePayment) => {
                    const patient = patients.find((item) => item.id === adv.patientId);
                    return (
                      <tr key={adv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-emerald-700">{adv.receiptNumber}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{adv.patientName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{adv.patientMrn} · {patient?.rgNo || 'No registration number'}</div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                          <div>{adv.date}</div>
                          <div className="text-[10px] text-slate-400">{adv.time}</div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap"><span className="font-medium text-slate-800">{adv.purpose}</span></td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">{adv.paymentMethod}{adv.terminalId && <div className="text-[10px] text-slate-400">{adv.terminalId}</div>}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-900">${adv.amount.toFixed(2)}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-emerald-600">${adv.remainingBalance.toFixed(2)}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">{adv.cashierName}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${adv.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : adv.status === 'Partially Utilized' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>{adv.status}</span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-right">
                          <button onClick={() => openReprintForAdvance(adv.id)} title="Reprint official advance receipt" className="px-2 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"><Printer className="w-3 h-3" /><span>Reprint</span></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: REFUND PAYMENTS */}
      {activeSubTab === 'refunds' && (
        <div className="space-y-4">
          {/* Refund Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Refunds Disbursed
              </span>
              <div className="text-2xl font-bold font-mono text-rose-600 mt-1">
                ${totalRefunded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {refundPayments.length} Authorised Refund Vouchers Issued
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Awaiting manager approval
              </span>
              <div className="text-2xl font-bold font-mono text-amber-700 mt-1">
                {pendingRefundApprovals} requests
              </div>
              <span className="text-[11px] text-slate-500 font-semibold mt-1 block">
                Only approved refunds are disbursed and deducted from deposits.
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Refund Action
                </span>
                <p className="text-xs text-slate-600 mt-1">
                  Process procedure cancellation, overpayment, or remaining deposit refund voucher.
                </p>
              </div>
              <button
                onClick={() => setIsRefundModalOpen(true)}
                className="mt-2 w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Process Refund Voucher</span>
              </button>
            </div>
          </div>

          {/* Refund Vouchers Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Refund Records for Selected Patient ({patientRefundPayments.length})
                </h3>
              </div>
              <button
                onClick={() => setIsRefundModalOpen(true)}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>New Refund</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <th className="py-2.5 px-3">Voucher No.</th>
                    <th className="py-2.5 px-3">Patient</th>
                    <th className="py-2.5 px-3">Original Reference</th>
                    <th className="py-2.5 px-3">Refund Amount</th>
                    <th className="py-2.5 px-3">Disbursement Method</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Authorized By</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {!cashierPatientId ? (
                    <tr><td colSpan={9} className="py-8 text-center text-slate-500">Search and select a patient above to view their refund records.</td></tr>
                  ) : patientRefundPayments.length === 0 ? (
                    <tr><td colSpan={9} className="py-8 text-center text-slate-500">No refund records found for this patient.</td></tr>
                  ) : patientRefundPayments.map((ref) => (
                    <tr key={ref.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-rose-700">
                        {ref.voucherNumber}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{ref.patientName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{ref.patientId}</div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{ref.originalReferenceType}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{ref.originalReferenceId}</div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-rose-600">
                        ${ref.amount.toFixed(2)}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 font-medium">
                        {ref.refundMethod}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">{ref.reason}</div>
                        {ref.notes && <div className="text-[10px] text-slate-400 line-clamp-1">{ref.notes}</div>}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                        <div>{ref.date}</div>
                        <div className="text-[10px] text-slate-400">{ref.time}</div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                        <div className="font-medium">{ref.authorizedBy}</div>
                        <div className="text-[10px] text-slate-400">Cashier: {ref.cashierName}</div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ref.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ref.status === 'Rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {ref.status}
                        </span>
                        {currentRole === 'admin' && ref.status === 'Pending Approval' && (
                          <div className="mt-2 flex gap-1">
                            <button type="button" onClick={() => reviewRefundPayment(ref.id, 'Approved')} className="rounded bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-800">Approve</button>
                            <button type="button" onClick={() => reviewRefundPayment(ref.id, 'Rejected')} className="rounded border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-50">Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: DAILY POS TRANSACTIONS */}
      {activeSubTab === 'pos' && (
        <div className="space-y-4">
          {/* POS Terminal Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Today's POS Settled Total
              </span>
              <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                ${totalPosVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Card Terminals & Front Desk Cash
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Desk A (Verifone V200c)
              </span>
              <div className="text-xl font-bold font-mono text-blue-600 mt-1">
                Batch 4092 Active
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
                Host Link: Online (EMV / Contactless)
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Desk B (Ingenico Move)
              </span>
              <div className="text-xl font-bold font-mono text-purple-600 mt-1">
                Batch 4093 Active
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
                Host Link: Online (EMV / Apple Pay)
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  POS Reconciliation
                </span>
                <span className="text-xs text-slate-600 mt-1 block">
                  {settledPosCount} Transactions Batched & Cleared
                </span>
              </div>
              <button
                onClick={handlePrint}
                className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Daily POS Settlement</span>
              </button>
            </div>
          </div>

          {/* POS Terminal Filters and Search */}
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={posSearchQuery}
                  onChange={(event) => setPosSearchQuery(event.target.value)}
                  placeholder="Search Tx ID, terminal, patient, auth code, RRN..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
                />
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { id: 'all', label: `All Terminals (${posTransactions.length})` },
                  { id: 'Verifone', label: `Verifone Desk A (${posTransactions.filter((p) => p.terminalName.toLowerCase().includes('verifone')).length})` },
                  { id: 'Ingenico', label: `Ingenico Desk B (${posTransactions.filter((p) => p.terminalName.toLowerCase().includes('ingenico')).length})` },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setPosTerminalFilter(pill.id)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                      posTerminalFilter === pill.id
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* POS Transactions Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  POS Swipes &amp; Cash Drawer Register ({filteredPosTransactions.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>PCI-DSS Point-to-Point Encryption (P2PE)</span>
                </div>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3 h-3" />
                  <span>Print Settlement</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <th className="py-2.5 px-3">Tx ID / Batch</th>
                    <th className="py-2.5 px-3">Terminal</th>
                    <th className="py-2.5 px-3">Patient</th>
                    <th className="py-2.5 px-3">Card / Instrument</th>
                    <th className="py-2.5 px-3">Auth Code</th>
                    <th className="py-2.5 px-3">RRN Number</th>
                    <th className="py-2.5 px-3">Amount ($)</th>
                    <th className="py-2.5 px-3">Time &amp; Date</th>
                    <th className="py-2.5 px-3">Cashier</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredPosTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        No POS terminal or cash drawer transactions match the current search or terminal filter.
                      </td>
                    </tr>
                  ) : filteredPosTransactions.map((tx: PosTransaction) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-800">
                        <div>{tx.id}</div>
                        <div className="text-[10px] text-slate-400">{tx.batchNumber}</div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 font-medium">
                        {tx.terminalName}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{tx.patientName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{tx.patientId}</div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-medium text-slate-800">{tx.cardType}</span>
                        {tx.cardLast4 && (
                          <span className="text-[10px] text-slate-500 font-mono ml-1">
                            (•••• {tx.cardLast4})
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-purple-700 font-bold">
                        {tx.authCode}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600 text-[11px]">
                        {tx.rrnNumber}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-900">
                        ${tx.amount.toFixed(2)}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                        <div>{tx.transactionTime}</div>
                        <div className="text-[10px] text-slate-400">{tx.transactionDate}</div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                        {tx.cashierName}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <AdvancePaymentModal
        isOpen={isAdvanceModalOpen}
        onClose={() => setIsAdvanceModalOpen(false)}
        onPaymentCreated={(payment) => {
          openReprintForAdvance(payment.id);
        }}
      />

      <RefundPaymentModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
      />

      <ReprintInvoiceModal
        isOpen={isReprintInvoiceOpen}
        onClose={() => setIsReprintInvoiceOpen(false)}
        initialInvoiceId={reprintInvoiceTargetId}
      />

      <ReprintAdvanceModal
        isOpen={isReprintAdvanceOpen}
        onClose={() => setIsReprintAdvanceOpen(false)}
        initialAdvanceId={reprintAdvanceTargetId}
      />
    </div>
  );
};
