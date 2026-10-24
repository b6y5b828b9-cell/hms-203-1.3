import React, { useState, useEffect } from 'react';
import { HospitalProvider, useHospital, NavigationTab } from './context/HospitalContext';
import { getThemeClasses } from './utils/theme';
import { Invoice } from './types';

// Modals
import { NewPatientModal } from './components/NewPatientModal';
import { NewAppointmentModal } from './components/NewAppointmentModal';
import { NewInvoiceModal } from './components/NewInvoiceModal';
import { PaymentModal } from './components/PaymentModal';
import { TriageAssessmentModal } from './components/TriageAssessmentModal';
import { TelehealthVideoModal } from './components/TelehealthVideoModal';
import { HospitalPriceListModal } from './components/HospitalPriceListModal';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { BackupReminderModal } from './components/BackupReminderModal';

// Shell & Navigation
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { WorkspaceTabBar } from './components/WorkspaceTabBar';
import { QuickAccessBar } from './components/QuickAccessBar';
import { FooterBar } from './components/FooterBar';
import { LoginScreen } from './components/LoginScreen';
import { DepartmentPortalSelector } from './components/DepartmentPortalSelector';

// Views
import { DashboardOverview } from './components/DashboardOverview';
import { TriageStationView } from './components/TriageStationView';
import { PatientsEMR } from './components/PatientsEMR';
import { AppointmentsManager } from './components/AppointmentsManager';
import { DoctorDutyScheduleView } from './components/DoctorDutyScheduleView';
import { PatientEnquiryView } from './components/PatientEnquiryView';
import { WardOccupancyView } from './components/WardOccupancyView';
import { PharmacyInventory } from './components/PharmacyInventory';
import { DoctorLabOrdersStation } from './components/DoctorLabOrdersStation';
import { LabDiagnostics } from './components/LabDiagnostics';
import { MedicalCoderWorkspace } from './components/MedicalCoderWorkspace';
import { BillingInvoicing } from './components/BillingInvoicing';
import { HospitalPriceListView } from './components/HospitalPriceListView';
import { TelehealthView } from './components/TelehealthView';
import { StaffManagement } from './components/StaffManagement';
import { ReportsAnalytics } from './components/ReportsAnalytics';
import { AdminCompliance } from './components/AdminCompliance';
import { PatientRegistrationDesk } from './components/PatientRegistrationDesk';
import { PatientMedicalRecordView } from './components/PatientMedicalRecordView';
import { MedicalCertificateView } from './components/MedicalCertificateView';
import { SurgicalScheduleView } from './components/SurgicalScheduleView';
import { BloodBankRegistry } from './components/BloodBankRegistry';
import { WorkflowAssistant } from './components/WorkflowAssistant';

const HospitalAppContent: React.FC = () => {
  const {
    isAuthenticated,
    departmentPortal,
    showPortalSelect,
    setShowPortalSelect,
    activeTab,
    setActiveTab,
    patients,
    currentRole,
    setSelectedPatientId,
    appTheme,
  } = useHospital();

  // Modal State
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | undefined>(undefined);
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [appointmentPreset, setAppointmentPreset] = useState<
    { doctorId?: string; date?: string; timeSlot?: string } | undefined
  >(undefined);
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [triagePatientId, setTriagePatientId] = useState<string | null>(null);
  const [telehealthPatientId, setTelehealthPatientId] = useState<string | null>(null);
  const [telehealthDoctorName, setTelehealthDoctorName] = useState<string>('Dr. Sarah Jenkins, MD');
  const [isPriceListOpen, setIsPriceListOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Global Keyboard Shortcut: CMD+K or CTRL+K for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const themeClasses = getThemeClasses(appTheme);

  // 1. If not authenticated, render Login Screen
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // 2. If user requested portal selection or no portal selected, show Department Portal Gateway
  if (showPortalSelect || !departmentPortal) {
    return <DepartmentPortalSelector onPortalSelected={() => setShowPortalSelect(false)} />;
  }

  // 3. Render Main Application Shell
  const renderCurrentView = () => {
    switch (activeTab) {
      case 'registration':
        if (currentRole === 'doctor') {
          return (
            <div className="p-6 text-center text-sm text-slate-600">
              Patient registration is available to authorized intake staff.
            </div>
          );
        }
        return (
          <PatientRegistrationDesk
            onOpenNewPatient={() => setIsNewPatientOpen(true)}
            onEditPatient={(id) => {
              setEditingPatientId(id);
              setSelectedPatientId(id);
              setIsNewPatientOpen(true);
            }}
          />
        );
      case 'overview':
        return (
          <DashboardOverview
            onOpenNewPatient={() => setIsNewPatientOpen(true)}
            onOpenNewAppointment={(preset) => {
              setAppointmentPreset(preset);
              setIsNewAppointmentOpen(true);
            }}
            onOpenNewInvoice={() => setIsNewInvoiceOpen(true)}
            onSelectPatient={(id) => {
              setSelectedPatientId(id);
              setActiveTab('patients');
            }}
          />
        );

      case 'triage':
        return (
          <TriageStationView
            onSelectPatient={(id) => {
              setSelectedPatientId(id);
              setActiveTab('patients');
            }}
          />
        );

      case 'patients':
        return (
          <PatientsEMR
            onOpenTriageModal={(id) => setTriagePatientId(id)}
            onStartTelehealth={(id) => setTelehealthPatientId(id)}
          />
        );

      case 'appointments':
        return (
          <AppointmentsManager
            onOpenNewAppointment={(preset) => {
              setAppointmentPreset(preset);
              setIsNewAppointmentOpen(true);
            }}
            onSelectPatient={(id) => {
              setSelectedPatientId(id);
              setActiveTab('patients');
            }}
            onStartTelehealth={(id, doctorName) => {
              setTelehealthPatientId(id);
              setTelehealthDoctorName(doctorName || 'Dr. Sarah Jenkins, MD');
            }}
          />
        );

      case 'doctor-rota':
        return (
          <div className="p-4 lg:p-6 max-w-7xl mx-auto w-full">
            <DoctorDutyScheduleView />
          </div>
        );

      case 'medical-records':
        return <PatientMedicalRecordView />;

      case 'certificates':
        return <MedicalCertificateView />;

      case 'ot-schedule':
        return <SurgicalScheduleView />;

      case 'blood-bank':
        return <BloodBankRegistry />;

      case 'enquiry':
        return <PatientEnquiryView />;

      case 'wards':
      case 'inpatient':
        return (
          <WardOccupancyView
            onSelectPatient={(id) => {
              setSelectedPatientId(id);
              setActiveTab('patients');
            }}
          />
        );

      case 'pharmacy':
        return <PharmacyInventory />;

      case 'lab-orders':
        return <DoctorLabOrdersStation />;

      case 'lab':
      case 'labs':
      case 'radiology':
        return <LabDiagnostics />;
      case 'coder':
        return <MedicalCoderWorkspace />;

      case 'billing':
      case 'billing-dues':
      case 'billing-advance':
      case 'billing-refunds':
      case 'billing-pos':
      case 'insurance-approvals':
        return (
          <BillingInvoicing
            initialSubTab={
              activeTab === 'billing-dues' ? 'dues' :
              activeTab === 'billing-advance' ? 'advance' :
              activeTab === 'billing-refunds' ? 'refunds' :
              activeTab === 'billing-pos' ? 'pos' :
              activeTab === 'insurance-approvals' ? 'insurance' :
              'invoices'
            }
            onOpenNewInvoice={() => setIsNewInvoiceOpen(true)}
            onOpenPaymentModal={(inv) => setPayingInvoice(inv)}
          />
        );

      case 'tariffs':
      case 'pricelist':
        return <HospitalPriceListView />;

      case 'telehealth':
        return <TelehealthView />;

      case 'staff':
        return <StaffManagement />;

      case 'reports':
        return <ReportsAnalytics />;

      case 'compliance':
      case 'admin':
        return <AdminCompliance />;

      default:
        return (
          <DashboardOverview
            onOpenNewPatient={() => setIsNewPatientOpen(true)}
            onOpenNewAppointment={() => setIsNewAppointmentOpen(true)}
            onOpenNewInvoice={() => setIsNewInvoiceOpen(true)}
            onSelectPatient={(id) => {
              setSelectedPatientId(id);
              setActiveTab('patients');
            }}
          />
        );
    }
  };

  return (
    <div data-theme={appTheme} className={`min-h-screen flex flex-col font-sans ${themeClasses.appBackground} ${themeClasses.textPrimary} selection:bg-teal-700 selection:text-white`}>
      {/* Top Application Header */}
      <Header
        onOpenNewPatient={() => setIsNewPatientOpen(true)}
        onOpenNewAppointment={() => setIsNewAppointmentOpen(true)}
        onOpenNewInvoice={() => setIsNewInvoiceOpen(true)}
        onSelectPatient={(id) => {
          setSelectedPatientId(id);
          setActiveTab('patients');
        }}
        onOpenTriage={() => setTriagePatientId(patients[0]?.id || '')}
        onOpenPriceList={() => setIsPriceListOpen(true)}
        onOpenThemeModal={() => setIsThemeModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* Dynamic Sub-header Context Action Ribbon */}
      <QuickAccessBar
        onOpenNewPatient={() => setIsNewPatientOpen(true)}
        onOpenNewAppointment={() => setIsNewAppointmentOpen(true)}
        onOpenNewInvoice={() => setIsNewInvoiceOpen(true)}
        onOpenTriage={() => setTriagePatientId(patients[0]?.id || '')}
        onOpenPriceList={() => setIsPriceListOpen(true)}
        onOpenThemeModal={() => setIsThemeModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* Main Container Area with Sidebar + Scrollable View */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className={`flex-1 flex flex-col overflow-hidden ${themeClasses.mainBackground} min-w-0`}>
          <WorkspaceTabBar />
          <div className="flex-1 overflow-y-auto min-h-0">
            {renderCurrentView()}
          </div>
        </main>
      </div>

      {/* Operational Footer Bar */}
      <FooterBar />

      {/* Role-aware workflow help */}
      <WorkflowAssistant />

      {/* Floating System Modals */}
      <NewPatientModal
        isOpen={isNewPatientOpen}
        initialPatientId={editingPatientId}
        onClose={() => {
          setIsNewPatientOpen(false);
          setEditingPatientId(undefined);
        }}
        onPatientCreated={(newId) => {
          setSelectedPatientId(newId);
          setActiveTab('patients');
        }}
      />

      <NewAppointmentModal
        isOpen={isNewAppointmentOpen}
        onClose={() => {
          setIsNewAppointmentOpen(false);
          setAppointmentPreset(undefined);
        }}
        presetDoctorId={appointmentPreset?.doctorId}
        presetDate={appointmentPreset?.date}
        presetTimeSlot={appointmentPreset?.timeSlot}
      />

      <NewInvoiceModal
        isOpen={isNewInvoiceOpen}
        onClose={() => setIsNewInvoiceOpen(false)}
      />

      <PaymentModal
        isOpen={Boolean(payingInvoice)}
        invoice={payingInvoice}
        onClose={() => setPayingInvoice(null)}
      />

      <TriageAssessmentModal
        isOpen={Boolean(triagePatientId)}
        patientId={triagePatientId || undefined}
        onClose={() => setTriagePatientId(null)}
      />

      <TelehealthVideoModal
        isOpen={Boolean(telehealthPatientId)}
        patientId={telehealthPatientId || ''}
        doctorName={telehealthDoctorName}
        onClose={() => {
          setTelehealthPatientId(null);
          setTelehealthDoctorName('Dr. Sarah Jenkins, MD');
        }}
      />

      <HospitalPriceListModal
        isOpen={isPriceListOpen}
        onClose={() => setIsPriceListOpen(false)}
      />

      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenNewPatient={() => setIsNewPatientOpen(true)}
        onOpenNewAppointment={() => setIsNewAppointmentOpen(true)}
        onOpenNewInvoice={() => setIsNewInvoiceOpen(true)}
        onOpenTriage={() => setTriagePatientId(patients[0]?.id || '')}
        onOpenPriceList={() => setIsPriceListOpen(true)}
      />

      <BackupReminderModal />
    </div>
  );
};

export default function App() {
  return (
    <HospitalProvider>
      <HospitalAppContent />
    </HospitalProvider>
  );
}
