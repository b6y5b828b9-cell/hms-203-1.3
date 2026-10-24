import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarClock,
  CreditCard,
  BedDouble,
  Activity,
  ShieldCheck,
  Stethoscope,
  Pill,
  FlaskConical,
  Scan,
  BarChart3,
  UserCheck,
  DollarSign,
  Search,
  UserPlus,
  FileCheck2,
  FileText,
  RotateCcw,
  Terminal,
  Droplet,
  LucideIcon,
} from 'lucide-react';
import { NavigationTab } from '../context/HospitalContext';

export interface WorkspaceTabMeta {
  tabKey: NavigationTab;
  title: string;
  category: string;
  icon: LucideIcon;
  color: string;
  badge?: string | number;
}

export const WORKSPACE_TAB_DEFINITIONS: Record<NavigationTab, { title: string; category: string; icon: LucideIcon; color: string }> = {
  overview: { title: 'Dashboard', category: 'General', icon: LayoutDashboard, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' },
  registration: { title: 'Patient Registration', category: 'Patient Intake', icon: UserPlus, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400' },
  'medical-records': { title: 'Medical Records', category: 'Patient Records', icon: FileText, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400' },
  certificates: { title: 'Medical Certificates', category: 'Documentation', icon: FileText, color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-400' },
  patients: { title: 'Patient EMR Records', category: 'Clinical EMR', icon: Users, color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400' },
  enquiry: { title: 'Patient Enquiry', category: 'Information Desk', icon: Search, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400' },
  inpatient: { title: 'Inpatients (IPD)', category: 'Inpatient Care', icon: BedDouble, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' },
  outpatient: { title: 'Outpatients (OPD)', category: 'Outpatient Care', icon: UserCheck, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30 dark:text-cyan-400' },
  triage: { title: 'Nurse Triage Station', category: 'Emergency & Triage', icon: Activity, color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400' },
  appointments: { title: 'Appointments', category: 'Scheduling', icon: Calendar, color: 'text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-400' },
  'doctor-rota': { title: 'Staff Duty Roster', category: 'Staff Rota', icon: CalendarClock, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400' },
  billing: { title: 'Invoicing', category: 'Billing & Cashier', icon: CreditCard, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' },
  'billing-dues': { title: 'Due Settlement', category: 'Billing & Cashier', icon: UserCheck, color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400' },
  'billing-advance': { title: 'Advance Payment', category: 'Billing & Cashier', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400' },
  'billing-refunds': { title: 'Refund', category: 'Billing & Cashier', icon: RotateCcw, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400' },
  'billing-pos': { title: 'POS Transactions', category: 'Billing & Cashier', icon: Terminal, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400' },
  'insurance-approvals': { title: 'Insurance Approval', category: 'Billing & Cashier', icon: ShieldCheck, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400' },
  pharmacy: { title: 'Pharmacy Stock', category: 'Pharmacy', icon: Pill, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400' },
  'lab-orders': { title: 'Doctor Lab Orders', category: 'Diagnostics', icon: FlaskConical, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400' },
  labs: { title: 'Lab & Diagnostics', category: 'Diagnostics', icon: FlaskConical, color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-400' },
  lab: { title: 'Lab Diagnostics', category: 'Diagnostics', icon: FlaskConical, color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-400' },
  radiology: { title: 'Radiology Diagnostics', category: 'Diagnostics', icon: Scan, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/30 dark:text-cyan-400' },
  wards: { title: 'Ward & Beds', category: 'Bed Management', icon: BedDouble, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' },
  'ot-schedule': { title: 'OT Surgery Schedule', category: 'Surgical Services', icon: Activity, color: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400' },
  'blood-bank': { title: 'Blood Bank Registry', category: 'Blood Bank', icon: Droplet, color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400' },
  pricelist: { title: 'Price List & Tariffs', category: 'Tariffs', icon: DollarSign, color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400' },
  tariffs: { title: 'Price List & Tariffs', category: 'Tariffs', icon: DollarSign, color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400' },
  telehealth: { title: 'Telehealth Consult', category: 'Telemedicine', icon: Stethoscope, color: 'text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-400' },
  compliance: { title: 'Admin & Compliance', category: 'Governance', icon: ShieldCheck, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400' },
  admin: { title: 'Admin & Compliance', category: 'Governance', icon: ShieldCheck, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400' },
  staff: { title: 'Staff Directory', category: 'Administration', icon: Users, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400' },
  coder: { title: 'Medical Coder Desk', category: 'Diagnostics', icon: FileCheck2, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400' },
  reports: { title: 'Analytics & Reports', category: 'Reports', icon: BarChart3, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

export const getTabInfo = (tabKey: NavigationTab) => {
  return WORKSPACE_TAB_DEFINITIONS[tabKey] || {
    title: String(tabKey),
    category: 'Workspace',
    icon: LayoutDashboard,
    color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
  };
};
