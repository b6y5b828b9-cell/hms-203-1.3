import React, { useState } from 'react';
import { AlertCircle, CalendarCheck, CheckCircle2, Edit3, Eraser, FileText, MapPin, Phone, Printer, Save, Search, Ticket, UserPlus, UserRound, Video, X } from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { Appointment, Patient, PaymentSchemeType, ReceptionToken, TokenPaymentScheme } from '../types';
import { printReceptionToken } from '../utils/printReceptionToken';
import { parseInsuranceDeductible } from '../utils/insuranceInvoice';
import { PatientAvatar } from './PatientAvatar';

interface PatientRegistrationDeskProps {
  onOpenNewPatient: (isTelehealthPatient?: boolean) => void;
  onEditPatient: (patientId: string) => void;
}

export const PatientRegistrationDesk: React.FC<PatientRegistrationDeskProps> = ({
  onOpenNewPatient,
  onEditPatient,
}) => {
  const {
    patients,
    doctors,
    appointments,
    receptionTokens,
    createReceptionToken,
    updatePatient,
    updateAppointmentStatus,
    advanceTokenWorkflow,
    addNotification,
  } = useHospital();
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [appointmentQuery, setAppointmentQuery] = useState('');
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [tokenQuery, setTokenQuery] = useState('');
  const [conversionType, setConversionType] = useState<'Consultation' | 'Non-Consultation' | 'Technician'>('Consultation');
  const [conversionDoctorId, setConversionDoctorId] = useState('');
  const [registrationType, setRegistrationType] = useState<'Consultation' | 'Non-Consultation' | 'Technician'>('Consultation');
  const [assignedDoctorId, setAssignedDoctorId] = useState('');
  const [visitDepartment, setVisitDepartment] = useState('');
  const [physioTechnician, setPhysioTechnician] = useState('Ahmed Hassan - Physiotherapy Technician');
  const [paymentSchemeType, setPaymentSchemeType] = useState<PaymentSchemeType>('Self-Pay');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [coveragePercent, setCoveragePercent] = useState('80');
  const [visitInsuranceProvider, setVisitInsuranceProvider] = useState('');
  const [visitInsurancePolicyNumber, setVisitInsurancePolicyNumber] = useState('');
  const [visitInsuranceNetwork, setVisitInsuranceNetwork] = useState('');
  const [visitEmergencyPhone, setVisitEmergencyPhone] = useState('');
  const [isTelehealthPatient, setIsTelehealthPatient] = useState(false);
  const [newRegistrationIsTelehealth, setNewRegistrationIsTelehealth] = useState(false);
  const [includePendingServices, setIncludePendingServices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registrationTab, setRegistrationTab] = useState<'new' | 'existing' | 'appointment' | 'reprint' | 'edit' | 'change-token'>('existing');
  const [lastRegisteredToken, setLastRegisteredToken] = useState<ReceptionToken | null>(null);
  const [selectedReprintTokenId, setSelectedReprintTokenId] = useState('');

  const currentDate = new Date();
  const today = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
  const todayAppointments = appointments.filter((appointment) => appointment.date === today && appointment.status !== 'Cancelled');
  const normalizedAppointmentQuery = appointmentQuery.trim().toLowerCase();
  const normalizedAppointmentQueryCompact = normalizedAppointmentQuery.replace(/[^a-z0-9]/g, '');
  const filteredTodayAppointments = todayAppointments.filter((appointment) => {
    if (!normalizedAppointmentQuery) return true;
    const patient = patients.find((item) => item.id === appointment.patientId);
    const searchableValues = [
      appointment.patientName,
      appointment.patientId,
      appointment.id,
      appointment.patientPhone,
      appointment.patientNationalId,
      appointment.patientPassportNo,
      appointment.patientRegistrationNo,
      patient?.id,
      patient?.rgNo,
      patient?.phone,
      patient?.mobile,
      patient?.smsMobile,
      patient?.emiratesId,
      patient?.passportNo,
      patient?.firstName,
      patient?.middleName,
      patient?.lastName,
    ].filter((value): value is string => Boolean(value));
    return searchableValues.some((value) => {
      const normalizedValue = value.toLowerCase();
      const compactValue = normalizedValue.replace(/[^a-z0-9]/g, '');
      return normalizedValue.includes(normalizedAppointmentQuery) || compactValue.includes(normalizedAppointmentQueryCompact);
    });
  });
  const filteredPatients = patients.filter((patient) => {
    const search = patientQuery.trim().toLowerCase();
    if (!search) return true;

    const searchableValues = [
      patient.firstName,
      patient.lastName,
      `${patient.firstName} ${patient.lastName}`,
      patient.id,
      patient.rgNo,
      patient.phone,
      patient.emiratesId,
      patient.passportNo,
      patient.email,
      patient.mobile,
      patient.nationality,
    ].filter(Boolean) as string[];

    return searchableValues.some((value) => value.toLowerCase().includes(search));
  }).slice(0, 8);
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);
  const selectedAppointment = todayAppointments.find((appointment) => appointment.id === selectedAppointmentId);
  const selectedToken = receptionTokens.find((token) => token.id === selectedTokenId);
  const activeTokens = receptionTokens.filter((token) => token.status !== 'Completed' && token.status !== 'Cancelled');
  const quickStats = [
    { label: 'Walk-in queue', value: String(activeTokens.length), tone: 'bg-blue-50 text-blue-700', icon: Ticket },
    { label: 'Today appointments', value: String(todayAppointments.length), tone: 'bg-violet-50 text-violet-700', icon: CalendarCheck },
    { label: 'Registered patients', value: String(patients.length), tone: 'bg-emerald-50 text-emerald-700', icon: UserRound },
    { label: 'Need review', value: String(patients.filter((patient) => patient.status === 'Pending').length), tone: 'bg-amber-50 text-amber-700', icon: FileText },
  ];
  const filteredTokens = activeTokens.filter((token) => {
    const search = tokenQuery.trim().toLowerCase();
    return !search || `${token.patientName} ${token.patientId} ${token.tokenNumber} ${token.id}`.toLowerCase().includes(search);
  }).slice(0, 8);
  const normalizedTokenQuery = tokenQuery.trim().toLowerCase();
  const compactTokenQuery = normalizedTokenQuery.replace(/[^a-z0-9]/g, '');
  const filteredReprintTokens = receptionTokens
    .filter((token) => {
      if (!normalizedTokenQuery) return true;
      const patient = patients.find((item) => item.id === token.patientId);
      const searchableValues = [
        token.tokenNumber,
        token.id,
        token.patientName,
        token.patientId,
        token.patientPhone,
        token.patientDetails?.registrationNumber,
        token.patientDetails?.nationalId,
        token.patientDetails?.passportNumber,
        patient?.firstName,
        patient?.middleName,
        patient?.lastName,
        patient?.rgNo,
        patient?.phone,
        patient?.mobile,
        patient?.emiratesId,
        patient?.passportNo,
      ].filter((value): value is string => Boolean(value));
      return searchableValues.some((value) => {
        const normalizedValue = value.toLowerCase();
        return normalizedValue.includes(normalizedTokenQuery) ||
          normalizedValue.replace(/[^a-z0-9]/g, '').includes(compactTokenQuery);
      });
    })
    .sort((first, second) =>
      (second.createdDate || second.visitDate || '').localeCompare(first.createdDate || first.visitDate || '') ||
      second.createdTime.localeCompare(first.createdTime)
    )
    .slice(0, 20);
  const selectedReprintToken = receptionTokens.find((token) => token.id === selectedReprintTokenId);

  const clearForm = () => {
    setPatientQuery('');
    setSelectedPatientId('');
    setSelectedAppointmentId('');
    setAppointmentQuery('');
    setSelectedTokenId('');
    setTokenQuery('');
    setSelectedReprintTokenId('');
    setConversionType('Consultation');
    setPaymentSchemeType('Self-Pay');
    setPaymentDetails('');
    setCoveragePercent('80');
    setVisitInsuranceProvider('');
    setVisitInsurancePolicyNumber('');
    setVisitInsuranceNetwork('');
    setVisitEmergencyPhone('');
    setIsTelehealthPatient(false);
    setNewRegistrationIsTelehealth(false);
    setIncludePendingServices(false);
    setRegistrationType('Consultation');
    setAssignedDoctorId('');
    setVisitDepartment('');
    setPhysioTechnician('Ahmed Hassan - Physiotherapy Technician');
    setSaving(false);
  };

  const saveExistingPatientToken = () => {
    if (!selectedPatient) {
      addNotification('Select Patient', 'Choose an existing patient before saving registration.', 'warning');
      return;
    }

    if (paymentSchemeType === 'Insurance' && (!visitInsuranceProvider.trim() || !visitInsurancePolicyNumber.trim())) {
      addNotification('Insurance Details Required', 'Enter the insurance provider and policy number for this visit.', 'warning', selectedPatient.id);
      return;
    }
    if (paymentSchemeType !== 'Insurance' && paymentSchemeType !== 'Self-Pay' && !paymentDetails.trim()) {
      addNotification('Payment Details Required', `Enter the ${paymentSchemeType === 'Discount Card' ? 'discount card' : paymentSchemeType === 'Corporate' ? 'corporate payer' : 'package'} name or number.`, 'warning', selectedPatient.id);
      return;
    }

    const assignedDoctor =
      doctors.find((doctor) => doctor.id === assignedDoctorId) ||
      doctors.find((doctor) => doctor.id === selectedPatient.primaryPhysicianId) ||
      doctors[0];
    const physioOptions = ['Ahmed Hassan - Physiotherapy Technician', 'Zainab Noor - Physiotherapy Technician', 'Nadia Salem - Physiotherapy Technician'];
    const selectedPhysio = physioOptions.includes(physioTechnician) ? physioTechnician : physioOptions[0];
    const walkInDepartment =
      visitDepartment || selectedPatient.department || assignedDoctor?.department || 'General Medicine';
    const serviceType: ReceptionToken['serviceType'] =
      registrationType === 'Consultation'
        ? 'Consultation'
        : registrationType === 'Technician'
        ? 'Physio Technician'
        : 'Billing & Cashier';
    const currentVisitDate = new Date();
    const visitDate = `${currentVisitDate.getFullYear()}-${String(currentVisitDate.getMonth() + 1).padStart(2, '0')}-${String(currentVisitDate.getDate()).padStart(2, '0')}`;
    const providerId = registrationType === 'Technician' ? undefined : assignedDoctor?.id || selectedPatient.primaryPhysicianId;
    const providerName = registrationType === 'Technician'
      ? selectedPhysio
      : assignedDoctor?.name || selectedPatient.primaryPhysicianName || 'Registration Desk';
    setSaving(true);
    const walkInPurpose = selectedPatient.purposeOfVisit || (registrationType === 'Consultation' ? 'Walk-in consultation' : registrationType === 'Technician' ? 'Physiotherapy treatment session' : 'Administrative registration & billing');
    const normalizedCoverage = Math.min(100, Math.max(0, Number(coveragePercent) || 0));
    const paymentScheme: TokenPaymentScheme = paymentSchemeType === 'Insurance'
      ? {
          schemeType: 'Insurance',
          insuranceProvider: visitInsuranceProvider.trim(),
          policyNumber: visitInsurancePolicyNumber.trim(),
          network: visitInsuranceNetwork.trim() || undefined,
          coverageTier: visitInsuranceNetwork.trim() || undefined,
          coveragePercent: normalizedCoverage,
          copayPercent: 100 - normalizedCoverage,
          serviceCopay: selectedPatient.insurance.serviceCopay,
          deductibleAmount: selectedPatient.insurance.deductibleAmount ||
            parseInsuranceDeductible(selectedPatient.insuranceList?.find((record) => record.isPrimary)?.copayDeductible),
        }
      : paymentSchemeType === 'Discount Card'
      ? { schemeType: 'Discount Card', discountCardName: paymentDetails.trim(), discountCardNumber: paymentDetails.trim(), discountPercent: normalizedCoverage }
      : paymentSchemeType === 'Corporate'
      ? { schemeType: 'Corporate', corporateName: paymentDetails.trim(), corporateNumber: paymentDetails.trim(), coveragePercent: normalizedCoverage }
      : paymentSchemeType === 'Package'
      ? { schemeType: 'Package', packageName: paymentDetails.trim(), packageNumber: paymentDetails.trim(), coveragePercent: normalizedCoverage }
      : { schemeType: 'Self-Pay' };
    const visitInsuranceProviderName = paymentSchemeType === 'Insurance'
      ? visitInsuranceProvider.trim()
      : paymentSchemeType === 'Self-Pay'
      ? 'Self-Pay'
      : paymentDetails.trim();
    const visitPayMode: NonNullable<ReceptionToken['payMode']> = paymentSchemeType === 'Self-Pay'
      ? 'Self'
      : paymentSchemeType === 'Discount Card'
      ? 'Discount Card'
      : paymentSchemeType === 'Corporate' || paymentSchemeType === 'Package'
      ? 'Company'
      : 'Insurance';
    const emergencyContact = {
      ...selectedPatient.emergencyContact,
      phone: visitEmergencyPhone.trim() || selectedPatient.emergencyContact.phone,
    };
    const pendingServiceIds = registrationType === 'Non-Consultation' && includePendingServices
      ? (selectedPatient.services || [])
          .filter((service) => service.billingStatus !== 'Billed' && service.billingStatus !== 'Cancelled')
          .map((service) => service.id)
      : [];

    updatePatient(selectedPatient.id, { isTelehealthPatient });
    const token = createReceptionToken({
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
      patientPhone: selectedPatient.phone,
      patientDetails: {
        nationality: selectedPatient.nationality,
        emergencyContact,
      },
      doctorId: providerId,
      doctorName: providerName,
      department: walkInDepartment,
      serviceType,
      visitCode: registrationType === 'Consultation' ? 'C' : registrationType === 'Technician' ? 'TEC' : 'NC',
      priority: 'Normal',
      status: 'Waiting',
      estimatedWaitMins: 0,
      counterOrRoom: registrationType === 'Consultation' ? 'Walk-in Registration Desk' : registrationType === 'Technician' ? 'Physiotherapy Technician Desk' : 'Cashier Desk',
      currentStage: '1_REGISTRATION',
      visitType: registrationType === 'Consultation' ? 'Consultation' : registrationType === 'Technician' ? 'Technician' : 'Billing',
      visitPurpose: walkInPurpose,
      visitComplaint: walkInPurpose,
      registrationSource: 'Existing Patient',
      patientAge: selectedPatient.age,
      patientGender: selectedPatient.gender,
      insuranceProvider: visitInsuranceProviderName,
      payMode: visitPayMode,
      visitDate,
      patientVisitSummary: registrationType === 'Consultation'
        ? `${walkInDepartment} • ${assignedDoctor?.name || selectedPatient.primaryPhysicianName} • ${walkInPurpose}`
        : registrationType === 'Technician'
        ? `${walkInDepartment} • ${selectedPhysio} • ${walkInPurpose}`
        : `${walkInDepartment} • ${assignedDoctor?.name || selectedPatient.primaryPhysicianName || 'Registration Desk'} • ${walkInPurpose}`,
      paymentScheme,
      pendingServiceIds,
      historyLogs: [
        {
          stage: '1_REGISTRATION',
          timestamp: new Date().toISOString(),
          action: `Walk-in registration for ${selectedPatient.firstName} ${selectedPatient.lastName}. Department: ${walkInDepartment}. ${registrationType === 'Consultation' ? `Doctor: ${assignedDoctor?.name || selectedPatient.primaryPhysicianName}.` : registrationType === 'Technician' ? `Physio technician: ${selectedPhysio}.` : 'Routing to cashier.'} Visit: ${walkInPurpose}`,
          actor: 'Registration Desk',
        },
      ],
    });
    setLastRegisteredToken(token);
    if (!printReceptionToken(token)) {
      addNotification('Print Window Blocked', `Patient registered with reception token ${token.tokenNumber}. Allow pop-ups to print the token slip.`, 'warning', selectedPatient.id);
    }

    addNotification(
      `Registration Complete — Reception Token ${token.tokenNumber}`,
      `${selectedPatient.firstName} ${selectedPatient.lastName}, please proceed to ${token.counterOrRoom}.`,
      'success',
      selectedPatient.id
    );
    if (pendingServiceIds.length) {
      addNotification(
        'Pending Services Carried Forward',
        `${pendingServiceIds.length} service(s) linked to ${token.tokenNumber} for cashier review.`,
        'info',
        selectedPatient.id
      );
    }
    if (registrationType === 'Consultation' && assignedDoctor) {
      addNotification(
        'Doctor Walk-in Alert',
        `Walk-in patient ${selectedPatient.firstName} ${selectedPatient.lastName} has been registered for ${assignedDoctor.name} in ${walkInDepartment}.`,
        'info',
        assignedDoctor.id
      );
    }
    clearForm();
  };

  const saveAppointmentRegistration = () => {
    if (!selectedAppointment) {
      addNotification('Select Appointment', 'Choose a current-day appointment before saving registration.', 'warning');
      return;
    }
    const existingAppointmentToken = receptionTokens.find((token) => token.appointmentId === selectedAppointment.id);
    if (existingAppointmentToken || selectedAppointment.status === 'Checked-In') {
      addNotification(
        'Appointment Already Registered',
        `This appointment already has a check-in record${existingAppointmentToken ? ` (token ${existingAppointmentToken.tokenNumber})` : ''}.`,
        'warning',
        selectedAppointment.patientId
      );
      return;
    }
    const patient = patients.find((item) => item.id === selectedAppointment.patientId);
    const appointmentVisitType = registrationType === 'Technician' ? 'Technician' : 'Consultation';
    const physioOptions = ['Ahmed Hassan - Physiotherapy Technician', 'Zainab Noor - Physiotherapy Technician', 'Nadia Salem - Physiotherapy Technician'];
    const selectedPhysio = physioOptions.includes(physioTechnician) ? physioTechnician : physioOptions[0];
    const token = createReceptionToken({
      patientId: selectedAppointment.patientId,
      patientName: selectedAppointment.patientName,
      patientPhone: patient?.phone || selectedAppointment.patientPhone,
      patientAge: patient?.age ?? selectedAppointment.patientAge,
      patientGender: patient?.gender || selectedAppointment.patientGender,
      patientDetails: {
        nationalId: patient?.emiratesId || selectedAppointment.patientNationalId,
        passportNumber: patient?.passportNo || selectedAppointment.patientPassportNo,
        nationality: patient?.nationality,
      },
      appointmentId: selectedAppointment.id,
      bookingChannel: selectedAppointment.bookingChannel,
      doctorId: appointmentVisitType === 'Consultation' ? selectedAppointment.doctorId : undefined,
      doctorName: appointmentVisitType === 'Consultation' ? selectedAppointment.doctorName : selectedPhysio,
      department: appointmentVisitType === 'Consultation' ? selectedAppointment.department : 'Physiotherapy',
      serviceType: appointmentVisitType === 'Consultation' ? 'Consultation' : 'Physio Technician',
      visitCode: appointmentVisitType === 'Consultation' ? 'C' : 'TEC',
      priority: selectedAppointment.priority === 'Urgent' ? 'Urgent' : 'Normal',
      status: 'Waiting',
      estimatedWaitMins: selectedAppointment.estimatedWaitMinutes || 0,
      counterOrRoom: appointmentVisitType === 'Consultation' ? selectedAppointment.roomNumber : 'Physiotherapy Technician Desk',
      currentStage: '1_REGISTRATION',
      visitType: appointmentVisitType,
      visitPurpose: selectedAppointment.reason || (appointmentVisitType === 'Consultation' ? 'Scheduled consultation' : 'Physiotherapy treatment session'),
      visitComplaint: selectedAppointment.reason || (appointmentVisitType === 'Consultation' ? 'Scheduled consultation' : 'Physiotherapy treatment session'),
      registrationSource: 'Appointment',
      insuranceProvider: patient?.insurance?.provider || 'Self-Pay',
      payMode: patient?.payMode || 'Self',
      visitDate: selectedAppointment.date,
      patientVisitSummary: appointmentVisitType === 'Consultation'
        ? `${selectedAppointment.department} • ${selectedAppointment.doctorName} • ${selectedAppointment.reason || 'Scheduled consultation'}`
        : `${selectedAppointment.department} • ${selectedPhysio} • ${selectedAppointment.reason || 'Physiotherapy treatment session'}`,
      paymentScheme: patient?.payMode === 'Self' ? { schemeType: 'Self-Pay' } : {
        schemeType: 'Insurance',
        insuranceProvider: patient?.insurance?.provider,
        policyNumber: patient?.insurance?.policyNumber,
        coveragePercent: patient?.insurance?.coveragePercentage,
        serviceCopay: patient?.insurance?.serviceCopay,
        deductibleAmount: patient?.insurance?.deductibleAmount ||
          parseInsuranceDeductible(patient?.insuranceList?.find((record) => record.isPrimary)?.copayDeductible),
      },
    });
    if (!token) return;
    updateAppointmentStatus(selectedAppointment.id, 'Checked-In');
    setLastRegisteredToken(token);
    if (!printReceptionToken(token)) {
      addNotification('Print Window Blocked', `Patient registered with reception token ${token.tokenNumber}. Allow pop-ups to print the token slip.`, 'warning', selectedAppointment.patientId);
    }
    addNotification(
      `Registration Complete — Reception Token ${token.tokenNumber}`,
      `${selectedAppointment.patientName}, please proceed to ${token.counterOrRoom} for ${appointmentVisitType === 'Consultation' ? 'consultation' : 'technician service'}.`,
      'success',
      selectedAppointment.patientId
    );
    clearForm();
  };

  const convertToken = () => {
    if (!selectedToken) {
      addNotification('Select Token', 'Choose a registration token before changing its service.', 'warning');
      return;
    }
    const isConsultation = conversionType === 'Consultation';
    const isTechnician = conversionType === 'Technician';
    const conversionDoctor = doctors.find((doctor) => doctor.id === conversionDoctorId);
    if (isConsultation && !conversionDoctor) {
      addNotification('Select Consultation Doctor', 'Choose the doctor who will receive this consultation token.', 'warning', selectedToken.patientId);
      return;
    }
    const destination: Partial<ReceptionToken> = isConsultation
      ? {
          serviceType: 'Consultation',
          visitCode: 'C',
          visitType: 'Consultation',
          doctorId: conversionDoctor?.id,
          doctorName: conversionDoctor?.name,
          department: conversionDoctor?.department || selectedToken.department,
          counterOrRoom: 'Doctor Consultation Suite',
        }
      : isTechnician
      ? {
          serviceType: 'Physio Technician',
          visitCode: 'TEC',
          visitType: 'Technician',
          doctorId: undefined,
          doctorName: physioTechnician,
          department: 'Physiotherapy',
          counterOrRoom: 'Physiotherapy Technician Desk',
        }
      : {
          serviceType: 'Billing & Cashier',
          visitCode: 'NC',
          visitType: 'Billing',
          doctorId: undefined,
          doctorName: undefined,
          department: 'Registration & Cashier',
          counterOrRoom: 'Cashier Counter',
        };
    advanceTokenWorkflow(selectedToken.id, isConsultation ? '1_REGISTRATION' : '2_NURSING_VITALS', destination);
    addNotification('Token Changed', `${selectedToken.tokenNumber} is now classified as ${conversionType}.`, 'success', selectedToken.patientId);
    setSelectedTokenId('');
    setTokenQuery('');
  };

  const changePaymentScheme = () => {
    if (!selectedToken) {
      addNotification('Select Token', 'Choose a registration token before changing its insurance details.', 'warning');
      return;
    }
    if (paymentSchemeType !== 'Self-Pay' && !paymentDetails.trim()) {
      addNotification('Details Required', `Enter the ${paymentSchemeType === 'Corporate' ? 'corporate payer' : 'package'} name or number.`, 'warning');
      return;
    }

    const parsedCoverage = Math.min(100, Math.max(0, Number(coveragePercent) || 0));
    const paymentScheme: TokenPaymentScheme = paymentSchemeType === 'Self-Pay'
      ? { schemeType: 'Self-Pay' }
      : paymentSchemeType === 'Corporate'
      ? { schemeType: 'Corporate', corporateName: paymentDetails.trim(), corporateNumber: paymentDetails.trim(), coveragePercent: parsedCoverage }
      : { schemeType: 'Package', packageName: paymentDetails.trim(), packageNumber: paymentDetails.trim(), coveragePercent: parsedCoverage };

    advanceTokenWorkflow(selectedToken.id, selectedToken.currentStage || '1_REGISTRATION', { paymentScheme });
    addNotification('Insurance Details Changed', `${selectedToken.tokenNumber} is now billed under ${paymentSchemeType}.`, 'success', selectedToken.patientId);
    setSelectedTokenId('');
    setTokenQuery('');
    setPaymentDetails('');
  };

  return (
    <div className="p-3 sm:p-4 lg:p-5 space-y-3 max-w-[1400px] mx-auto text-xs">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center"><UserRound className="w-5 h-5 text-blue-600" /></div><div><h1 className="text-lg font-bold text-slate-900">Patient Registration</h1><p className="text-slate-500 mt-0.5">Register new patients, search existing patients, manage appointments, or edit patient details.</p></div></div>
        <div className="flex items-center gap-2 self-end"><button onClick={() => setRegistrationTab('existing')} className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold flex items-center gap-1.5 cursor-pointer"><Search className="w-3.5 h-3.5" /> Quick Jump</button><button onClick={() => onOpenNewPatient()} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 cursor-pointer"><UserPlus className="w-3.5 h-3.5" /> Create / Action</button></div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-white rounded-t-xl px-2 pt-2">
        {[
          ['new', UserPlus, 'New Registration'], ['existing', Search, 'Existing Patient'], ['appointment', CalendarCheck, 'Appointment Patient'], ['reprint', Printer, 'Reprint Token'], ['edit', Edit3, 'Edit'], ['change-token', Ticket, 'Change Token'],
        ].map(([tab, Icon, label]) => (
          <button
            key={tab as string}
            onClick={() => {
              setRegistrationTab(tab as typeof registrationTab);
              if (tab === 'appointment' && registrationType === 'Non-Consultation') setRegistrationType('Consultation');
              if (tab === 'reprint') {
                setSelectedReprintTokenId('');
                setTokenQuery('');
              }
            }}
            className={`px-4 py-2.5 rounded-t-lg font-semibold flex items-center gap-1.5 border-b-2 cursor-pointer ${registrationTab === tab ? 'bg-teal-600 border-teal-600 text-white' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
          >
            <Icon className="w-3.5 h-3.5" /> {label as string}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {quickStats.map(({ label, value, tone, icon: Icon }) => (
          <div key={label} className={`rounded-xl border border-slate-200 ${tone} px-3 py-2.5`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="mt-2 text-lg font-bold">{value}</div>
          </div>
        ))}
      </div>

      {lastRegisteredToken && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 shadow-sm" role="status" aria-live="polite">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Registration complete · please proceed to reception</p>
            <h2 className="mt-1 text-base font-bold text-slate-900">{lastRegisteredToken.patientName}</h2>
            <p className="mt-1 text-xs text-slate-700">{lastRegisteredToken.department} · {lastRegisteredToken.doctorName || lastRegisteredToken.counterOrRoom}</p>
          </div>
          <div className="rounded-lg border border-emerald-300 bg-white px-5 py-2 text-center">
            <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-500">Reception token</span>
            <span className="block font-mono text-3xl font-black text-emerald-800">{lastRegisteredToken.tokenNumber}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!printReceptionToken(lastRegisteredToken)) {
                addNotification('Print Window Blocked', 'Allow pop-ups to print the reception token slip.', 'warning', lastRegisteredToken.patientId);
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800"
          >
            <Printer className="h-4 w-4" /> Print token
          </button>
        </section>
      )}

      <section className="bg-white border border-slate-200 rounded-b-xl rounded-tr-xl shadow-sm p-3 sm:p-4">
        {registrationTab === 'new' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><UserPlus className="w-4 h-4 text-blue-600" /></div>
                <div>
                  <h2 className="font-bold text-slate-900">New Patient Registration</h2>
                  <p className="text-[10px] text-slate-500">This workflow uses the full patient admission module.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onOpenNewPatient(newRegistrationIsTelehealth)} className="px-4 py-2 rounded-lg bg-teal-600 text-white font-bold flex items-center gap-1.5 cursor-pointer"><Save className="w-3.5 h-3.5" /> Open Full Form</button>
                <button onClick={clearForm} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold flex items-center gap-1.5 cursor-pointer"><Eraser className="w-3.5 h-3.5" /> Clear</button>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
              <input
                type="checkbox"
                checked={newRegistrationIsTelehealth}
                onChange={(event) => setNewRegistrationIsTelehealth(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-cyan-400 text-cyan-600 focus:ring-cyan-500"
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold text-cyan-900">
                  <Video className="h-4 w-4" /> Register as telehealth patient
                </span>
                <span className="mt-1 block text-xs text-cyan-800">
                  This selection will be carried into the new patient form.
                </span>
              </span>
            </label>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
              <div className="flex items-center gap-2 font-bold text-blue-900">
                <UserPlus className="w-4 h-4 text-blue-600" /> Advanced registration workflow
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-700">
                <div className="rounded-lg bg-white border border-blue-100 p-3">
                  <div className="font-semibold text-slate-900 mb-1">Patient information</div>
                  Demographics, DOB, ID, phone, emergency contact, and photo capture are handled in the full module.
                </div>
                <div className="rounded-lg bg-white border border-blue-100 p-3">
                  <div className="font-semibold text-slate-900 mb-1">Clinical intake</div>
                  Visit purpose, allergies, chronic history, department, and doctor assignment follow the patient module workflow.
                </div>
                <div className="rounded-lg bg-white border border-blue-100 p-3">
                  <div className="font-semibold text-slate-900 mb-1">Insurance details</div>
                  Insurance, discount card, copay rules, and document uploads are handled with the same logic as the new patient module.
                </div>
                <div className="rounded-lg bg-white border border-blue-100 p-3">
                  <div className="font-semibold text-slate-900 mb-1">Token creation</div>
                  New patients are registered with the same token workflow and duplicate checking used by the full intake module.
                </div>
              </div>

              <button
                onClick={() => onOpenNewPatient(newRegistrationIsTelehealth)}
                className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-bold flex items-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" /> Launch New Patient Module
              </button>
            </div>
          </div>
        )}
        {registrationTab === 'existing' && <ExistingPatientPanel
          patient={selectedPatient}
          patientQuery={patientQuery}
          setPatientQuery={(query: string) => {
            setPatientQuery(query);
            setSelectedPatientId('');
          }}
          filteredPatients={filteredPatients}
          selectedPatientId={selectedPatientId}
          setSelectedPatientId={(id: string) => {
            const patient = patients.find((item) => item.id === id);
            setSelectedPatientId(id);
            setIsTelehealthPatient(patient?.isTelehealthPatient ?? false);
            setIncludePendingServices(false);
            setAssignedDoctorId(patient?.primaryPhysicianId || '');
            setVisitDepartment(patient?.department || '');
            setPaymentSchemeType(patient?.payMode === 'Insurance'
              ? 'Insurance'
              : patient?.payMode === 'Discount Card'
              ? 'Discount Card'
              : patient?.payMode === 'Company'
              ? 'Corporate'
              : 'Self-Pay');
            setVisitInsuranceProvider(patient?.insurance?.provider || '');
            setVisitInsurancePolicyNumber(patient?.insurance?.policyNumber || '');
            setVisitInsuranceNetwork(patient?.insurance?.network || '');
            setPaymentDetails(patient?.insurance?.provider || patient?.selectedPackage || '');
            setCoveragePercent(String(patient?.insurance?.coveragePercentage ?? 80));
            setVisitEmergencyPhone(patient?.emergencyContact.phone || '');
          }}
          saveExistingPatientToken={saveExistingPatientToken}
          registrationType={registrationType}
          setRegistrationType={(type: 'Consultation' | 'Non-Consultation' | 'Technician') => {
            setRegistrationType(type);
            if (type !== 'Non-Consultation') setIncludePendingServices(false);
          }}
          includePendingServices={includePendingServices}
          setIncludePendingServices={setIncludePendingServices}
          physioTechnician={physioTechnician}
          setPhysioTechnician={setPhysioTechnician}
          doctors={doctors}
          assignedDoctorId={assignedDoctorId}
          setAssignedDoctorId={setAssignedDoctorId}
          visitDepartment={visitDepartment}
          setVisitDepartment={setVisitDepartment}
          paymentSchemeType={paymentSchemeType}
          setPaymentSchemeType={setPaymentSchemeType}
          paymentDetails={paymentDetails}
          setPaymentDetails={setPaymentDetails}
          coveragePercent={coveragePercent}
          setCoveragePercent={setCoveragePercent}
          visitInsuranceProvider={visitInsuranceProvider}
          setVisitInsuranceProvider={setVisitInsuranceProvider}
          visitInsurancePolicyNumber={visitInsurancePolicyNumber}
          setVisitInsurancePolicyNumber={setVisitInsurancePolicyNumber}
          visitInsuranceNetwork={visitInsuranceNetwork}
          setVisitInsuranceNetwork={setVisitInsuranceNetwork}
          visitEmergencyPhone={visitEmergencyPhone}
          setVisitEmergencyPhone={setVisitEmergencyPhone}
          isTelehealthPatient={isTelehealthPatient}
          setIsTelehealthPatient={setIsTelehealthPatient}
          saving={saving}
        />}
        {registrationTab === 'appointment' && (
          <AppointmentPanel
            today={today}
            todayAppointments={filteredTodayAppointments}
            allTodayAppointmentCount={todayAppointments.length}
            appointmentQuery={appointmentQuery}
            setAppointmentQuery={(query) => {
              setAppointmentQuery(query);
              setSelectedAppointmentId('');
            }}
            patients={patients}
            selectedAppointmentId={selectedAppointmentId}
            setSelectedAppointmentId={setSelectedAppointmentId}
            selectedAppointment={selectedAppointment}
            saveAppointmentRegistration={saveAppointmentRegistration}
            registrationType={registrationType}
            setRegistrationType={setRegistrationType}
            physioTechnician={physioTechnician}
            setPhysioTechnician={setPhysioTechnician}
          />
        )}
        {registrationTab === 'reprint' && (
          <div className="max-w-4xl space-y-4">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-slate-900">
                <Printer className="h-4 w-4 text-teal-700" /> Reprint Reception Token
              </h2>
              <p className="mt-1 text-[10px] text-slate-500">
                Search saved tokens by token number, patient name, registration number, phone, national ID, or passport.
              </p>
            </div>
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={tokenQuery}
                onChange={(event) => {
                  setTokenQuery(event.target.value);
                  setSelectedReprintTokenId('');
                }}
                placeholder="Search token no. or patient details"
                aria-label="Search reception tokens by token or patient details"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {filteredReprintTokens.map((token) => (
                  <button
                    key={token.id}
                    type="button"
                    onClick={() => setSelectedReprintTokenId(token.id)}
                    aria-pressed={selectedReprintTokenId === token.id}
                    className={`w-full rounded-lg border p-3 text-left ${
                      selectedReprintTokenId === token.id
                        ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-200'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="rounded bg-teal-50 px-2 py-1 font-mono text-xs font-bold text-teal-800">{token.tokenNumber}</span>
                        <span className="truncate text-xs font-semibold text-slate-900">{token.patientName}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{token.status}</span>
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-600">
                      {token.patientDetails?.registrationNumber || token.patientId} · {token.patientPhone || 'No phone'} · {token.department} · {token.createdDate || token.visitDate || 'Date not recorded'}
                    </span>
                  </button>
                ))}
                {filteredReprintTokens.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs text-slate-500">
                    {receptionTokens.length === 0 ? 'There are no saved reception tokens to reprint.' : 'No tokens match this search.'}
                  </div>
                )}
              </div>

              {selectedReprintToken ? (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-teal-800">Selected receipt</p>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">{selectedReprintToken.patientName}</h3>
                    <p className="mt-1 text-xs text-slate-600">Token {selectedReprintToken.tokenNumber} · {selectedReprintToken.createdDate || selectedReprintToken.visitDate} · {selectedReprintToken.createdTime}</p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
                    <div><dt className="text-slate-500">Visit type</dt><dd className="font-semibold text-slate-800">{selectedReprintToken.visitCode || (selectedReprintToken.serviceType === 'Consultation' ? 'C' : selectedReprintToken.serviceType === 'Physio Technician' ? 'TEC' : 'NC')}</dd></div>
                    <div><dt className="text-slate-500">Department</dt><dd className="font-semibold text-slate-800">{selectedReprintToken.department}</dd></div>
                    <div><dt className="text-slate-500">Doctor / technician</dt><dd className="font-semibold text-slate-800">{selectedReprintToken.doctorName || 'Not assigned'}</dd></div>
                    <div><dt className="text-slate-500">Registered by</dt><dd className="font-semibold text-slate-800">{selectedReprintToken.registeredBy || 'Not recorded'}</dd></div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => {
                      if (!printReceptionToken(selectedReprintToken)) {
                        addNotification('Print Window Blocked', 'Allow pop-ups to print the reception token slip.', 'warning', selectedReprintToken.patientId);
                      }
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-800"
                  >
                    <Printer className="h-4 w-4" /> Reprint token {selectedReprintToken.tokenNumber}
                  </button>
                </div>
              ) : (
                <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500">
                  Select a saved token to review details and reprint its receipt.
                </div>
              )}
            </div>
          </div>
        )}
        {registrationTab === 'change-token' && (
          <div className="max-w-4xl space-y-4">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-slate-900">
                <Ticket className="h-4 w-4 text-teal-700" /> Change Reception Token Type
              </h2>
              <p className="mt-1 text-[10px] text-slate-500">
                Search and select an active token, then route it to the correct service.
              </p>
            </div>
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={tokenQuery}
                onChange={(event) => {
                  setTokenQuery(event.target.value);
                  setSelectedTokenId('');
                }}
                placeholder="Search by token number, patient name, or registration number"
                aria-label="Search active tokens to change token type"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {filteredTokens.map((token) => (
                <button
                  key={token.id}
                  type="button"
                  onClick={() => {
                    setSelectedTokenId(token.id);
                    setConversionDoctorId(token.doctorId || patients.find((patient) => patient.id === token.patientId)?.primaryPhysicianId || '');
                    setConversionType(
                      token.serviceType === 'Consultation'
                        ? 'Consultation'
                        : token.serviceType === 'Physio Technician'
                        ? 'Technician'
                        : 'Non-Consultation'
                    );
                  }}
                  aria-pressed={selectedTokenId === token.id}
                  className={`w-full rounded-lg border p-3 text-left ${
                    selectedTokenId === token.id ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-200' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{token.patientName} · {token.tokenNumber}</span>
                    <span className="text-[10px] text-slate-500">{token.createdDate || token.visitDate || 'Date not recorded'} · {token.createdTime}</span>
                  </span>
                  <span className="mt-1 block text-[10px] text-slate-600">
                    {token.serviceType} · {token.department} · {token.doctorName || 'Provider not assigned'} · {token.status}
                  </span>
                </button>
              ))}
              {filteredTokens.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">
                  {activeTokens.length ? 'No active tokens match this search.' : 'There are no active tokens to change.'}
                </p>
              )}
            </div>
            {selectedToken && (
              <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
                <div>
                  <h3 className="font-bold text-slate-900">Selected token {selectedToken.tokenNumber}</h3>
                  <p className="mt-1 text-[11px] text-slate-600">{selectedToken.patientName} · {selectedToken.department} · {selectedToken.doctorName || 'Provider not assigned'}</p>
                </div>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-700">New token type</span>
                  <select value={conversionType} onChange={(event) => setConversionType(event.target.value as typeof conversionType)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800">
                    {(['Consultation', 'Non-Consultation', 'Technician'] as const).map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                {conversionType === 'Technician' && (
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-700">Physiotherapy technician</span>
                    <select value={physioTechnician} onChange={(event) => setPhysioTechnician(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800">
                      {['Ahmed Hassan - Physiotherapy Technician', 'Zainab Noor - Physiotherapy Technician', 'Nadia Salem - Physiotherapy Technician'].map((technician) => <option key={technician} value={technician}>{technician}</option>)}
                    </select>
                  </label>
                )}
                {conversionType === 'Consultation' && (
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-700">Consultation doctor</span>
                    <select value={conversionDoctorId} onChange={(event) => setConversionDoctorId(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800">
                      <option value="">Select doctor</option>
                      {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name} · {doctor.department}</option>)}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  onClick={convertToken}
                  disabled={
                    conversionType === 'Consultation' && selectedToken.serviceType === 'Consultation' ||
                    conversionType === 'Consultation' && conversionDoctorId === selectedToken.doctorId ||
                    conversionType === 'Non-Consultation' && selectedToken.serviceType === 'Billing & Cashier' ||
                    conversionType === 'Technician' && selectedToken.serviceType === 'Physio Technician' && selectedToken.doctorName === physioTechnician
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Ticket className="h-3.5 w-3.5" /> Apply token change
                </button>
              </div>
            )}
          </div>
        )}
        {registrationTab === 'edit' && <EditPatientPanel patients={patients} selectedPatientId={selectedPatientId} setSelectedPatientId={setSelectedPatientId} onEditPatient={onEditPatient} />}
      </section>

      
    </div>
  );
};

const RegistrationSection: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => <div className="mb-3"><div className="flex items-center gap-2 bg-blue-50/70 rounded-md px-3 py-2 text-blue-900 font-bold mb-2"><Icon className="w-4 h-4 text-blue-600" />{title}</div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{children}</div></div>;

const Field: React.FC<{ label: string; placeholder: string; wide?: boolean }> = ({ label, placeholder, wide }) => <label className={`${wide ? 'sm:col-span-2 lg:col-span-2' : ''} block`}><span className="block text-[10px] font-semibold text-slate-600 mb-1">{label}</span><input placeholder={placeholder} className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none" /></label>;

const ExistingPatientPanel: React.FC<any> = ({ patient, patientQuery, setPatientQuery, filteredPatients, selectedPatientId, setSelectedPatientId, saveExistingPatientToken, registrationType, setRegistrationType, includePendingServices, setIncludePendingServices, physioTechnician, setPhysioTechnician, doctors, assignedDoctorId, setAssignedDoctorId, visitDepartment, setVisitDepartment, paymentSchemeType, setPaymentSchemeType, paymentDetails, setPaymentDetails, coveragePercent, setCoveragePercent, visitInsuranceProvider, setVisitInsuranceProvider, visitInsurancePolicyNumber, setVisitInsurancePolicyNumber, visitInsuranceNetwork, setVisitInsuranceNetwork, visitEmergencyPhone, setVisitEmergencyPhone, isTelehealthPatient, setIsTelehealthPatient, saving }) => {
  const departments = Array.from(new Set([
    patient?.department,
    ...doctors.map((doctor: any) => doctor.department),
  ].filter(Boolean))) as string[];
  const previousVisit = [...(patient?.facilityVisits || [])].sort((first: any, second: any) => second.visitDate.localeCompare(first.visitDate))[0];
  const pendingServices = (patient?.services || []).filter((service: any) => service.billingStatus !== 'Billed' && service.billingStatus !== 'Cancelled');

  if (patient) {
    return (
      <section className="max-w-4xl space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700">Existing patient visit registration</p>
            <h2 className="mt-1 text-base font-bold text-slate-900">{patient.firstName} {patient.middleName} {patient.lastName}</h2>
            <p className="mt-1 font-mono text-[11px] text-slate-500">Registration no: {patient.rgNo || patient.id}</p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPatientId('')}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Choose another patient
          </button>
        </header>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
          <input
            type="checkbox"
            checked={isTelehealthPatient}
            onChange={(event) => setIsTelehealthPatient(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-cyan-400 text-cyan-600 focus:ring-cyan-500"
          />
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-cyan-900">
              <Video className="h-4 w-4" /> Register as telehealth patient
            </span>
            <span className="mt-1 block text-xs text-cyan-800">
              Save this selection with the patient record.
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Date of birth', patient.dob],
            ['Age / gender', `${patient.age} years · ${patient.gender}`],
            ['Phone', patient.phone || patient.mobile || patient.smsMobile || 'Not recorded'],
            ['Email', patient.email || 'Not recorded'],
            ['National ID', patient.emiratesId || 'Not recorded'],
            ['Passport', patient.passportNo || 'Not recorded'],
            ['Address', patient.address || 'Not recorded'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 break-words text-xs font-medium text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        <section className="rounded-lg border border-blue-100 bg-blue-50/60 p-3" aria-label="Patient history summary">
          <h3 className="text-xs font-bold text-blue-950">History on file</h3>
          <div className="mt-2 grid gap-2 text-[10px] sm:grid-cols-2">
            <p><strong>Last visit:</strong> {previousVisit ? `${previousVisit.visitDate} · ${previousVisit.visitType}` : 'No previous visit recorded'}</p>
            <p><strong>Last diagnosis:</strong> {previousVisit?.primaryDiagnosis?.description || 'Not recorded'}</p>
            <p><strong>Active conditions:</strong> {patient.chronicConditions?.length ? patient.chronicConditions.join(', ') : 'None recorded'}</p>
            <p><strong>Allergies:</strong> {patient.allergies?.length ? patient.allergies.map((allergy: any) => allergy.allergen).join(', ') : 'None recorded'}</p>
            <p className="sm:col-span-2"><strong>Active medications:</strong> {patient.medications?.filter((medication: any) => medication.status === 'Active').length
              ? patient.medications.filter((medication: any) => medication.status === 'Active').map((medication: any) => medication.name).join(', ')
              : 'None recorded'}</p>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 p-3">
          <h3 className="text-xs font-bold text-slate-800">Visit insurance / payment</h3>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-600">Payment type</span>
            <select value={paymentSchemeType} onChange={(event) => setPaymentSchemeType(event.target.value as PaymentSchemeType)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800">
              {(['Self-Pay', 'Insurance', 'Discount Card', 'Corporate', 'Package'] as PaymentSchemeType[]).map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          {paymentSchemeType === 'Insurance' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Insurance provider</span><input value={visitInsuranceProvider} onChange={(event) => setVisitInsuranceProvider(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Policy number</span><input value={visitInsurancePolicyNumber} onChange={(event) => setVisitInsurancePolicyNumber(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Network</span><input value={visitInsuranceNetwork} onChange={(event) => setVisitInsuranceNetwork(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Coverage (%)</span><input type="number" min="0" max="100" value={coveragePercent} onChange={(event) => setCoveragePercent(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" /></label>
            </div>
          ) : paymentSchemeType !== 'Self-Pay' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">{paymentSchemeType} name / number</span><input value={paymentDetails} onChange={(event) => setPaymentDetails(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-600">Coverage / discount (%)</span><input type="number" min="0" max="100" value={coveragePercent} onChange={(event) => setCoveragePercent(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" /></label>
            </div>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-600">Emergency contact number for this visit</span>
            <input type="tel" value={visitEmergencyPhone} onChange={(event) => setVisitEmergencyPhone(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
            <span className="mt-1 block text-[10px] text-slate-500">Saved with this visit only; it will not change the patient’s personal profile.</span>
          </label>
        </section>

        <div>
          <label className="mb-2 block text-xs font-bold text-slate-700">Visit type</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(['Consultation', 'Non-Consultation', 'Technician'] as const).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={registrationType === type}
                onClick={() => setRegistrationType(type)}
                className={`rounded-lg border p-2.5 text-xs font-semibold transition-colors ${
                  registrationType === type
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {registrationType === 'Non-Consultation' && pendingServices.length > 0 && (
          <section className="rounded-lg border border-rose-200 bg-rose-50 p-3" aria-label="Pending services">
            <label className="flex cursor-pointer items-start gap-2">
              <input type="checkbox" checked={includePendingServices} onChange={(event) => setIncludePendingServices(event.target.checked)} className="mt-0.5 accent-rose-700" />
              <span>
                <strong className="block text-xs text-rose-900">{pendingServices.length} pending service{pendingServices.length === 1 ? '' : 's'} on file</strong>
                <span className="mt-0.5 block text-[10px] text-rose-800">Include these services in this non-consultation visit for review.</span>
              </span>
            </label>
            <ul className="mt-2 space-y-1 border-t border-rose-200 pt-2 text-[10px] text-rose-900">
              {pendingServices.map((service: any) => <li key={service.id} className="flex justify-between gap-2"><span>{service.name}</span><span className="shrink-0 font-semibold">{service.billingStatus || 'Pending'}</span></li>)}
            </ul>
          </section>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {registrationType !== 'Technician' ? (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">Visit doctor</span>
              <select
                value={assignedDoctorId || patient.primaryPhysicianId || ''}
                onChange={(event) => {
                  const doctor = doctors.find((item: any) => item.id === event.target.value);
                  setAssignedDoctorId(event.target.value);
                  if (doctor?.department) setVisitDepartment(doctor.department);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
              >
                <option value="">Select doctor</option>
                {doctors.map((doctor: any) => (
                  <option key={doctor.id} value={doctor.id}>{doctor.name} · {doctor.department}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-600">Physiotherapy technician</span>
              <select
                value={physioTechnician}
                onChange={(event) => setPhysioTechnician(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
              >
                {['Ahmed Hassan - Physiotherapy Technician', 'Zainab Noor - Physiotherapy Technician', 'Nadia Salem - Physiotherapy Technician'].map((technician) => (
                  <option key={technician} value={technician}>{technician}</option>
                ))}
              </select>
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-600">Visit department</span>
            <select
              value={visitDepartment || patient.department || ''}
              onChange={(event) => setVisitDepartment(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
            >
              <option value="">Select department</option>
              {departments.map((department: string) => (
                <option key={department} value={department}>{department}</option>
              ))}
              <option value="Physiotherapy">Physiotherapy</option>
            </select>
          </label>
        </div>
        <p className="text-[10px] text-slate-500">
          Demographic and contact details are read-only here. Department, doctor, token type, insurance, and the visit emergency number apply to this registration only.
        </p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={saveExistingPatientToken}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save visit registration'}
          </button>
        </div>
      </section>
    );
  }

  return (
  <div className="max-w-3xl space-y-3">
      <h2 className="font-bold text-slate-900 flex items-center gap-2"><Search className="w-4 h-4 text-blue-600" /> Search Existing Patient</h2>
      <input value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} placeholder="Search by name, phone, MRN, national ID, or passport" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
      <div className="space-y-2">
        {patientQuery.trim() && filteredPatients.map((patientItem: any) => (
          <button key={patientItem.id} type="button" onClick={() => setSelectedPatientId(patientItem.id)} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-teal-300 hover:bg-teal-50">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <PatientAvatar patientId={patientItem.id} name={`${patientItem.firstName} ${patientItem.lastName}`} gender={patientItem.gender} imageUrl={patientItem.photo || patientItem.avatar} size="sm" />
                <div className="min-w-0">
                <span className="font-semibold block text-slate-800">{patientItem.firstName} {patientItem.lastName}</span>
                <span className="text-[10px] text-slate-500">Reg. no: {patientItem.rgNo || patientItem.id} · {patientItem.phone || 'No phone'} · {patientItem.emiratesId || patientItem.passportNo || 'No ID'}</span>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{patientItem.status || 'Outpatient'}</span>
            </div>
          </button>
        ))}
        {patientQuery.trim() && filteredPatients.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">No patients match this search.</p>
        )}
      </div>
      {!patientQuery.trim() && <p className="text-xs text-slate-500">Search by name, phone, registration number, national ID, or passport to find an existing patient.</p>}
  </div>
  );
};

interface AppointmentPanelProps {
  today: string;
  todayAppointments: Appointment[];
  allTodayAppointmentCount: number;
  appointmentQuery: string;
  setAppointmentQuery: (query: string) => void;
  patients: Patient[];
  selectedAppointmentId: string;
  setSelectedAppointmentId: (appointmentId: string) => void;
  selectedAppointment?: Appointment;
  saveAppointmentRegistration: () => void;
  registrationType: 'Consultation' | 'Non-Consultation' | 'Technician';
  setRegistrationType: (type: 'Consultation' | 'Non-Consultation' | 'Technician') => void;
  physioTechnician: string;
  setPhysioTechnician: (technician: string) => void;
}

const AppointmentPanel: React.FC<AppointmentPanelProps> = ({
  today,
  todayAppointments,
  allTodayAppointmentCount,
  appointmentQuery,
  setAppointmentQuery,
  patients,
  selectedAppointmentId,
  setSelectedAppointmentId,
  selectedAppointment,
  saveAppointmentRegistration,
  registrationType,
  setRegistrationType,
  physioTechnician,
  setPhysioTechnician,
}) => {
  const selectedPatient = selectedAppointment
    ? patients.find((patient) => patient.id === selectedAppointment.patientId)
    : undefined;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="font-bold text-slate-900 flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-indigo-600" /> Register Appointment Patient
        </h2>
        <p className="text-[10px] text-slate-500 mt-1">Search is limited to appointments scheduled for today ({today}).</p>
      </div>

      <label className="relative block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={appointmentQuery}
          onChange={(event) => setAppointmentQuery(event.target.value)}
          placeholder="Find today’s patient by name, phone, national ID, passport, or registration number"
          aria-label="Search today's appointment patients by name or ID"
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </label>

      <div className="max-h-72 space-y-2 overflow-y-auto">
        {todayAppointments.map((appointment) => {
          const patient = patients.find((item) => item.id === appointment.patientId);
          const isSelected = selectedAppointmentId === appointment.id;

          return (
            <button
              key={appointment.id}
              type="button"
              onClick={() => setSelectedAppointmentId(appointment.id)}
              aria-pressed={isSelected}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                isSelected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className="flex flex-wrap items-start justify-between gap-2">
                <span>
                  <span className="block font-semibold text-slate-900">{appointment.patientName}</span>
                  <span className="mt-1 block text-[11px] text-slate-600">
                    {appointment.timeSlot} · {appointment.doctorName} · {appointment.department}
                  </span>
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                  {appointment.status}
                </span>
              </span>
              <span className="mt-2 block text-[10px] text-slate-500">
                Reg. no: {patient?.rgNo || appointment.patientRegistrationNo || patient?.id || appointment.patientId}
                {' · '}Phone: {patient?.phone || patient?.mobile || appointment.patientPhone || 'Not recorded'}
                {' · '}National ID: {patient?.emiratesId || appointment.patientNationalId || 'Not recorded'}
                {' · '}Passport: {patient?.passportNo || appointment.patientPassportNo || 'Not recorded'}
                {appointment.bookingChannel ? ` · Booked via ${appointment.bookingChannel}` : ''}
              </span>
            </button>
          );
        })}
        {todayAppointments.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs text-slate-500">
            {allTodayAppointmentCount === 0
              ? 'There are no appointments scheduled for today.'
              : 'No today appointments match. Check the patient details or search by name, phone, ID, passport, or registration number.'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['Consultation', 'Technician'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setRegistrationType(type)}
            className={`rounded-lg border p-2 text-[11px] font-semibold ${
              registrationType === type ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {registrationType === 'Technician' && (
        <div>
          <label className="mb-1 block text-[10px] font-semibold text-slate-600">Physio Technician</label>
          <select
            value={physioTechnician}
            onChange={(event) => setPhysioTechnician(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            {['Ahmed Hassan - Physiotherapy Technician', 'Zainab Noor - Physiotherapy Technician', 'Nadia Salem - Physiotherapy Technician'].map((technician) => (
              <option key={technician} value={technician}>{technician}</option>
            ))}
          </select>
        </div>
      )}
      {selectedAppointment && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-950">
          <h3 className="font-bold">Selected appointment patient</h3>
          <p className="mt-1">{selectedAppointment.patientName} · {selectedAppointment.timeSlot}</p>
          <p>{selectedAppointment.doctorName} · {selectedAppointment.department} · {selectedAppointment.roomNumber}</p>
          <p className="mt-2 border-t border-indigo-200 pt-2 text-[11px]">
            Registration no: {selectedPatient?.rgNo || selectedAppointment.patientRegistrationNo || selectedPatient?.id || selectedAppointment.patientId || 'Not recorded'}
            {' · '}Phone: {selectedPatient?.phone || selectedPatient?.mobile || selectedAppointment.patientPhone || 'Not recorded'}
            {' · '}National ID: {selectedPatient?.emiratesId || selectedAppointment.patientNationalId || 'Not recorded'}
            {' · '}Passport: {selectedPatient?.passportNo || selectedAppointment.patientPassportNo || 'Not recorded'}
          </p>
          <p className="mt-1">Visit: {selectedAppointment.type} · {selectedAppointment.reason}</p>
          {selectedAppointment.bookingChannel && <p className="mt-1">Booked via: {selectedAppointment.bookingChannel}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={saveAppointmentRegistration}
        disabled={!selectedAppointment}
        className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white enabled:cursor-pointer enabled:hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save className="w-3.5 h-3.5" /> Save Appointment Registration
      </button>
    </div>
  );
};

const EditPatientPanel: React.FC<any> = ({ patients, selectedPatientId, setSelectedPatientId, onEditPatient }) => <div className="max-w-2xl space-y-3"><h2 className="font-bold text-slate-900 flex items-center gap-2"><Edit3 className="w-4 h-4 text-teal-600" /> Edit Registered Patient</h2><p className="text-slate-500">Edit name, gender, insurance, contact, or other registration details.</p><select value={selectedPatientId} onChange={(event) => setSelectedPatientId(event.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2"><option value="">Select patient to edit</option>{patients.map((patient: any) => <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName} · {patient.id}</option>)}</select><button disabled={!selectedPatientId} onClick={() => onEditPatient(selectedPatientId)} className="px-4 py-2 bg-teal-600 disabled:bg-slate-300 text-white rounded-lg font-bold flex items-center gap-2 cursor-pointer"><Edit3 className="w-3.5 h-3.5" /> Edit Details</button></div>;
