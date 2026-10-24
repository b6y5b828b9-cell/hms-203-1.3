import React, { useMemo, useState } from 'react';
import { ArrowRight, Bot, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import { NavigationTab, ROLE_DEFINITIONS, useHospital } from '../context/HospitalContext';
import { UserRole } from '../types';

interface WorkflowAction {
  label: string;
  tab: NavigationTab;
}

interface AssistantMessage {
  id: number;
  author: 'assistant' | 'user';
  text: string;
}

const ROLE_ACTIONS: Record<UserRole, WorkflowAction[]> = {
  admin: [
    { label: 'Review operations', tab: 'overview' },
    { label: 'Open reports', tab: 'reports' },
    { label: 'Check compliance', tab: 'admin' },
  ],
  doctor: [
    { label: 'Open Doctor EMR', tab: 'patients' },
    { label: 'View appointments', tab: 'appointments' },
    { label: 'Review diagnostics', tab: 'labs' },
  ],
  nurse: [
    { label: 'Open triage', tab: 'triage' },
    { label: 'Review patient visits', tab: 'patients' },
    { label: 'Open inpatient list', tab: 'inpatient' },
  ],
  physiotherapist: [
    { label: 'Review visit activity', tab: 'overview' },
    { label: 'Find a patient', tab: 'enquiry' },
  ],
  receptionist: [
    { label: 'Register a patient', tab: 'registration' },
    { label: 'View today’s queue', tab: 'appointments' },
    { label: 'Open billing', tab: 'billing' },
  ],
  pharmacist: [
    { label: 'Review pharmacy stock', tab: 'pharmacy' },
    { label: 'Find a patient', tab: 'enquiry' },
    { label: 'Open billing', tab: 'billing' },
  ],
  lab: [
    { label: 'Open lab worklist', tab: 'labs' },
    { label: 'Find a patient', tab: 'enquiry' },
    { label: 'Review visit queue', tab: 'overview' },
  ],
  radiology: [
    { label: 'Open radiology worklist', tab: 'radiology' },
    { label: 'Find a patient', tab: 'enquiry' },
    { label: 'Review visit queue', tab: 'overview' },
  ],
  'medical-coder': [
    { label: 'Review authorization desk', tab: 'coder' },
    { label: 'Find a patient', tab: 'enquiry' },
    { label: 'Open reports', tab: 'reports' },
  ],
};

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const WorkflowAssistant: React.FC = () => {
  const {
    currentRole,
    currentUser,
    appointments,
    receptionTokens,
    pharmacy,
    invoices,
    insuranceApprovals,
    departmentPortal,
    setActiveTab,
  } = useHospital();
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);

  const roleLabel = ROLE_DEFINITIONS[currentRole].label;
  const today = getLocalDate();
  const todayAppointments = appointments.filter((appointment) =>
    appointment.date === today && ['Scheduled', 'Checked-In', 'In Consultation'].includes(appointment.status)
  ).length;
  const waitingTokens = receptionTokens.filter((token) => token.status === 'Waiting').length;
  const nursingQueue = receptionTokens.filter((token) =>
    token.status !== 'Completed' && token.status !== 'Cancelled' && token.currentStage === '2_NURSING_VITALS'
  ).length;
  const doctorQueue = receptionTokens.filter((token) =>
    token.status !== 'Completed' && token.status !== 'Cancelled' && token.currentStage === '3_DOCTOR_EMR'
  ).length;
  const pendingLabOrders = receptionTokens.reduce((count, token) =>
    count + (token.doctorOrders?.labRequests.filter((request) => request.status !== 'Completed').length || 0), 0);
  const pendingRadiologyOrders = receptionTokens.reduce((count, token) =>
    count + (token.doctorOrders?.radiologyRequests.filter((request) => request.status !== 'Completed').length || 0), 0);
  const lowStockCount = pharmacy.filter((item) => item.stockQuantity <= item.minThreshold).length;
  const pendingInvoices = invoices.filter((invoice) => invoice.status === 'Pending' || invoice.status === 'Partially Paid').length;
  const pendingAuthorizations = insuranceApprovals.filter((approval) =>
    approval.approvalStatus === 'Pending' || approval.approvalStatus === 'Query Raised'
  ).length;

  const priorities = useMemo(() => {
    switch (currentRole) {
      case 'doctor':
        return [
          `${doctorQueue} visit${doctorQueue === 1 ? '' : 's'} waiting in the doctor workflow.`,
          `${todayAppointments} appointment${todayAppointments === 1 ? '' : 's'} remain active today.`,
          `${pendingLabOrders + pendingRadiologyOrders} diagnostic order${pendingLabOrders + pendingRadiologyOrders === 1 ? '' : 's'} need completion.`,
        ];
      case 'nurse':
        return [
          `${nursingQueue} visit${nursingQueue === 1 ? '' : 's'} waiting at nursing/vitals.`,
          `${waitingTokens} patient token${waitingTokens === 1 ? '' : 's'} currently waiting.`,
          `${todayAppointments} active appointment${todayAppointments === 1 ? '' : 's'} scheduled today.`,
        ];
      case 'receptionist':
        return [
          `${todayAppointments} appointment${todayAppointments === 1 ? '' : 's'} active today.`,
          `${waitingTokens} patient token${waitingTokens === 1 ? '' : 's'} waiting in the queue.`,
          `${pendingInvoices} invoice${pendingInvoices === 1 ? '' : 's'} pending or partially paid.`,
        ];
      case 'pharmacist':
        return [
          `${lowStockCount} item${lowStockCount === 1 ? '' : 's'} at or below the configured stock threshold.`,
          'Review the active prescription and patient record before dispensing.',
          'Check the pharmacy work area for the next workflow step.',
        ];
      case 'lab':
        return [
          `${pendingLabOrders} laboratory order${pendingLabOrders === 1 ? '' : 's'} awaiting completion.`,
          `${waitingTokens} patient token${waitingTokens === 1 ? '' : 's'} currently waiting.`,
          'Confirm patient and order identifiers before recording a result.',
        ];
      case 'radiology':
        return [
          `${pendingRadiologyOrders} radiology order${pendingRadiologyOrders === 1 ? '' : 's'} awaiting completion.`,
          `${waitingTokens} patient token${waitingTokens === 1 ? '' : 's'} currently waiting.`,
          'Confirm patient, modality, and order identifiers before documenting a report.',
        ];
      case 'medical-coder':
        return [
          `${pendingAuthorizations} insurance authorization${pendingAuthorizations === 1 ? '' : 's'} pending or queried.`,
          'Verify supporting documentation and coding details before publishing.',
          'Use the authorization desk to record review outcomes.',
        ];
      default:
        return [
          `${waitingTokens} patient token${waitingTokens === 1 ? '' : 's'} currently waiting.`,
          `${todayAppointments} active appointment${todayAppointments === 1 ? '' : 's'} scheduled today.`,
          `${lowStockCount} pharmacy item${lowStockCount === 1 ? '' : 's'} at or below minimum stock.`,
        ];
    }
  }, [
    currentRole,
    doctorQueue,
    lowStockCount,
    nursingQueue,
    pendingAuthorizations,
    pendingLabOrders,
    pendingRadiologyOrders,
    pendingInvoices,
    todayAppointments,
    waitingTokens,
  ]);

  const routeForQuestion = (text: string): NavigationTab | undefined => {
    const normalized = text.toLowerCase();
    const matches = (terms: string[]) => terms.some((term) => normalized.includes(term));
    if (matches(['certificate', 'sick leave', 'fitness', 'exemption', 'attestation'])) return 'certificates';
    if (matches(['surgery', 'operating theatre', 'operation', 'or suite', 'surgeon', 'pacu', 'who checklist'])) return 'ot-schedule';
    if (matches(['blood', 'blood bank', 'crossmatch', 'transfusion', 'prbc', 'ffp'])) return 'blood-bank';
    if (matches(['appointment', 'schedule', 'booking'])) return 'appointments';
    if (matches(['register', 'registration', 'check in', 'check-in'])) return 'registration';
    if (matches(['invoice', 'billing', 'payment', 'insurance claim'])) return 'billing';
    if (matches(['pharmacy', 'medicine', 'medication', 'stock', 'dispens'])) return 'pharmacy';
    if (matches(['radiology', 'imaging', 'x-ray', 'mri', 'ct scan'])) return 'radiology';
    if (matches(['lab', 'laboratory', 'test order', 'diagnostic'])) return 'labs';
    if (matches(['authorization', 'preauthorization', 'pre-authorization', 'coding', 'coder'])) return 'coder';
    if (matches(['triage', 'vitals', 'nursing'])) return 'triage';
    if (matches(['medical record', 'dossier', 'profile edit'])) return 'medical-records';
    if (matches(['patient', 'emr', 'history'])) return 'enquiry';
    if (matches(['report', 'analytics'])) return 'reports';
    if (matches(['compliance', 'audit', 'settings'])) return 'admin';
    if (matches(['queue', 'token', 'waiting'])) return 'overview';
    return undefined;
  };

  const allowedTabs = useMemo(() => {
    const roleTabs: Record<UserRole, NavigationTab[]> = {
      admin: ['overview', 'registration', 'medical-records', 'certificates', 'patients', 'enquiry', 'inpatient', 'outpatient', 'triage', 'appointments', 'doctor-rota', 'ot-schedule', 'blood-bank', 'billing', 'pharmacy', 'labs', 'radiology', 'wards', 'pricelist', 'staff', 'coder', 'reports', 'admin'],
      doctor: ['patients', 'medical-records', 'certificates', 'ot-schedule', 'blood-bank', 'enquiry', 'triage', 'inpatient', 'outpatient', 'appointments', 'doctor-rota', 'labs', 'radiology', 'wards', 'pricelist'],
      nurse: ['patients', 'medical-records', 'certificates', 'ot-schedule', 'blood-bank', 'enquiry', 'inpatient', 'outpatient', 'triage', 'labs', 'radiology', 'wards'],
      physiotherapist: ['overview', 'enquiry'],
      receptionist: ['overview', 'registration', 'medical-records', 'certificates', 'enquiry', 'appointments', 'ot-schedule', 'billing', 'pricelist', 'reports'],
      pharmacist: ['enquiry', 'pharmacy', 'billing'],
      lab: ['enquiry', 'labs', 'blood-bank', 'overview'],
      radiology: ['enquiry', 'radiology', 'overview'],
      'medical-coder': ['enquiry', 'coder', 'reports'],
    };
    const allowed = roleTabs[currentRole];
    return departmentPortal === 'outpatient'
      ? allowed.filter((tab) => tab !== 'inpatient' && tab !== 'wards')
      : allowed;
  }, [currentRole, departmentPortal]);

  const sendQuestion = (value = question) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const nextMessages: AssistantMessage[] = [
      ...messages,
      { id: Date.now(), author: 'user', text: trimmed },
    ];
    const requestedTab = routeForQuestion(trimmed);
    const response = requestedTab
      ? allowedTabs.includes(requestedTab)
        ? `I can take you to ${requestedTab.replace('-', ' ')}. Use the shortcut below.`
        : `That area is not available for your ${roleLabel} role. I can only suggest workflows available to your current role.`
      : /priority|next|urgent|focus|pending|waiting/i.test(trimmed)
        ? `Your role-based worklist snapshot:\n${priorities.join('\n')}`
        : /help|what can you do|how do/i.test(trimmed)
          ? 'I can summarize role-based workflow counts, explain common process steps, and open the parts of MedCore available to your role. Try asking about appointments, registration, patient lookup, billing, diagnostics, pharmacy stock, or your next priorities.'
          : 'I can help with navigation and workflow counts from the current app data. Try asking about appointments, patient registration, billing, lab/radiology orders, pharmacy stock, authorization, or your priorities.';
    nextMessages.push({ id: Date.now() + 1, author: 'assistant', text: response });
    setMessages(nextMessages);
    setQuestion('');
  };

  const requestedTab = messages.length > 0
    ? routeForQuestion(messages[messages.length - 2]?.text || '')
    : undefined;
  const routeableAction = requestedTab && allowedTabs.includes(requestedTab)
    ? ROLE_ACTIONS[currentRole].find((item) => item.tab === requestedTab) || {
        label: `Open ${requestedTab.replace('-', ' ')}`,
        tab: requestedTab,
      }
    : undefined;

  return (
    <div className="fixed bottom-16 right-4 z-50 sm:bottom-20 sm:right-6">
      {isOpen && (
        <section
          aria-label="Workflow assistant"
          className="mb-3 flex h-[min(650px,calc(100vh-7rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between bg-gradient-to-r from-teal-800 to-cyan-800 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/15 p-2"><Sparkles className="h-5 w-5" /></div>
              <div>
                <h2 className="text-sm font-bold">MedCore Workflow Assist</h2>
                <p className="mt-0.5 text-[11px] text-teal-100">{currentUser.name} · {roleLabel}</p>
              </div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close assistant" className="rounded-lg p-1.5 hover:bg-white/15">
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
            <div className="rounded-xl border border-teal-100 bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-teal-900">
                <Bot className="h-4 w-4" /> Your worklist snapshot
              </div>
              <ul className="space-y-1.5 text-xs leading-relaxed text-slate-700">
                {priorities.map((item) => <li key={item} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />{item}</li>)}
              </ul>
              <p className="mt-2 text-[10px] text-slate-400">Operational counts only; verify details in the relevant record.</p>
            </div>

            {messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quick actions</p>
                {ROLE_ACTIONS[currentRole].filter((item) => allowedTabs.includes(item.tab)).map((item) => (
                  <button
                    type="button"
                    key={item.tab}
                    onClick={() => { setActiveTab(item.tab); setIsOpen(false); }}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-800"
                  >
                    {item.label}<ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className={`max-w-[92%] whitespace-pre-line rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
                    message.author === 'user'
                      ? 'ml-auto bg-teal-700 text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}>
                    {message.text}
                  </div>
                ))}
                {routeableAction && (
                  <button
                    type="button"
                    onClick={() => { setActiveTab(routeableAction.tab); setIsOpen(false); }}
                    className="ml-auto flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    {routeableAction.label}<ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] leading-relaxed text-amber-900">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Demo mode: responses use local rules and counts only. No external AI service is called. Not for diagnosis, treatment, or emergency decisions.
            </div>
            <form
              onSubmit={(event) => { event.preventDefault(); sendQuestion(); }}
              className="flex items-center gap-2"
            >
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about a workflow…"
                aria-label="Ask the workflow assistant"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              <button
                type="submit"
                disabled={!question.trim()}
                aria-label="Send question"
                className="rounded-lg bg-teal-700 p-2 text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close workflow assistant' : 'Open workflow assistant'}
        className="ml-auto flex items-center gap-2 rounded-full bg-teal-800 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-teal-900"
      >
        <Sparkles className="h-4 w-4" />
        <span>Assist</span>
      </button>
    </div>
  );
};
