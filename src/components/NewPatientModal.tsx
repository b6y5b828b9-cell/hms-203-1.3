import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  AlertCircle,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Video,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { BloodGroup, PatientStatus, Patient, PaymentSchemeType } from '../types';
import { printReceptionToken } from '../utils/printReceptionToken';

interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPatientCreated?: (id: string) => void;
  initialPatientId?: string;
  initialIsTelehealthPatient?: boolean;
}

type RegistrationSection = 'demographics' | 'contact' | 'clinical' | 'insurance';
type RegistrationView = 'registration' | 'consent';

const registrationSuggestions: Record<string, string[]> = {
  cities: ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah', 'Al Ain'],
  nationalities: ['United Arab Emirates', 'India', 'Pakistan', 'Bangladesh', 'Philippines', 'Egypt', 'Jordan', 'Lebanon', 'Syria', 'Nepal', 'Sri Lanka', 'United Kingdom', 'United States', 'Canada'],
  countries: ['United Arab Emirates', 'Saudi Arabia', 'Oman', 'Qatar', 'Bahrain', 'Kuwait', 'India', 'Pakistan', 'Bangladesh', 'Philippines', 'Egypt', 'Jordan', 'Lebanon', 'United Kingdom', 'United States', 'Canada'],
  languages: ['Arabic', 'English', 'Hindi', 'Urdu', 'Bengali', 'Tagalog', 'Malayalam', 'Tamil', 'Nepali', 'Sinhalese', 'French'],
  areas: ['Al Reem Island', 'Khalifa City', 'Mohammed Bin Zayed City', 'Al Khalidiyah', 'Al Maryah Island', 'Downtown Dubai', 'Dubai Marina', 'Jumeirah', 'Deira', 'Bur Dubai', 'Al Nahda', 'Al Majaz', 'Al Taawun', 'Al Jurf'],
  districts: ['Abu Dhabi', 'Al Ain', 'Al Dhafra', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'],
  visaCategories: ['UAE Citizen', 'Residence Visa', 'Visit Visa', 'GCC Citizen', 'Employment Visa', 'Investor Visa', 'Family Visa', 'Student Visa', 'Golden Visa', 'Transit Visa'],
  occupations: ['Healthcare Professional', 'Government Employee', 'Private Sector Employee', 'Business Owner', 'Student', 'Homemaker', 'Retired', 'Self-employed', 'Unemployed'],
  religions: ['Islam', 'Christianity', 'Hinduism', 'Buddhism', 'Sikhism', 'Judaism', 'Other', 'Prefer not to disclose'],
};
const uaeInsuranceSuggestions = {
  payers: ['Daman', 'Sukoon', 'ADNIC', 'GIG Gulf', 'Orient Insurance', 'Dubai Insurance', 'Union Insurance', 'National General Insurance', 'Al Buhaira National Insurance'],
  tpas: ['NAS', 'NextCare', 'MedNet', 'Almadallah', 'Inayah', 'FMC Network UAE'],
  networks: ['Basic', 'Standard', 'Enhanced', 'Comprehensive', 'Thiqa', 'Abu Dhabi Basic', 'Dubai Essential Benefits Plan (EBP)'],
};

export const NewPatientModal: React.FC<NewPatientModalProps> = ({
  isOpen,
  onClose,
  onPatientCreated,
  initialPatientId,
  initialIsTelehealthPatient = false,
}) => {
  const { patients, doctors, wardBeds, addPatient, updatePatient, addNotification } = useHospital();
  const [registrationView, setRegistrationView] = useState<RegistrationView>('registration');

  // Demographics
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Patient['gender'] | ''>('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('Unknown');
  const [maritalStatus, setMaritalStatus] = useState<Patient['maritalStatus'] | ''>('');
  const [photo, setPhoto] = useState('');

  // Contact & ID
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [passportNo, setPassportNo] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [nationality, setNationality] = useState('');
  const [language, setLanguage] = useState('');
  const [religion, setReligion] = useState('');
  const [visaCategory, setVisaCategory] = useState('');
  const [countryOfResidence, setCountryOfResidence] = useState('');
  const [area, setArea] = useState('');
  const [district, setDistrict] = useState('');
  const [occupation, setOccupation] = useState('');
  const [company, setCompany] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [referralType, setReferralType] = useState<NonNullable<Patient['referral']>['type']>('Walk-In');
  const [referrerName, setReferrerName] = useState('');
  const [consentSigned, setConsentSigned] = useState(false);
  const [consentSignature, setConsentSignature] = useState('');
  const [consentTimestamp, setConsentTimestamp] = useState('');
  const [consentDetailsAtSigning, setConsentDetailsAtSigning] = useState('');
  const [consentSignerRole, setConsentSignerRole] = useState<NonNullable<Patient['consentSignerRole']>>('Patient');
  const [consentSignerRelationship, setConsentSignerRelationship] = useState('');

  // Clinical & Admission
  const [status, setStatus] = useState<PatientStatus>('Outpatient');
  const [isTelehealthPatient, setIsTelehealthPatient] = useState(false);
  const [department, setDepartment] = useState('General Medicine');
  const [doctorId, setDoctorId] = useState(doctors[0]?.id || '');
  const [wardOrRoom, setWardOrRoom] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [chronicInput, setChronicInput] = useState('');

  // Insurance & Billing
  const [payMode, setPayMode] = useState<'Self' | 'Insurance' | 'Discount Card'>('Self');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insuranceRegulator, setInsuranceRegulator] = useState<NonNullable<Patient['insurance']>['regulator'] | ''>('');
  const [insuranceNetwork, setInsuranceNetwork] = useState('');
  const [insurancePlanName, setInsurancePlanName] = useState('');
  const [insuranceCardNumber, setInsuranceCardNumber] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [groupNumber, setGroupNumber] = useState('');
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState('');
  const [tpa, setTpa] = useState('');
  const [memberId, setMemberId] = useState('');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [dependentNumber, setDependentNumber] = useState('');
  const [claimFormNo, setClaimFormNo] = useState('');
  const [requiresPreAuthorization, setRequiresPreAuthorization] = useState(false);
  const [preExistingWaitingPeriod, setPreExistingWaitingPeriod] = useState('');
  const [verificationReference, setVerificationReference] = useState('');
  const [dailyClinicLimitAed, setDailyClinicLimitAed] = useState('');
  const [dhaMemberId, setDhaMemberId] = useState('');
  const [clientNumber, setClientNumber] = useState('');
  const [copayPercent, setCopayPercent] = useState(0);
  const [deductibleAmount, setDeductibleAmount] = useState('');
  const [registrationType, setRegistrationType] = useState<'Consultation' | 'Non-Consultation' | 'Technician'>('Consultation');
  const [physioTechnician, setPhysioTechnician] = useState('Ahmed Hassan - Physiotherapy Technician');
  const [discountCardName, setDiscountCardName] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [insuranceCardImage, setInsuranceCardImage] = useState('');
  const [supportDocumentImage, setSupportDocumentImage] = useState('');
  const [serviceCopay, setServiceCopay] = useState({ consultation: 20, dental: 20, procedure: 20, laboratory: 20, lab: 20, radiology: 20, pharmacy: 20, procedures: 20, surgicalProcedure: 20, emergency: 10 });
  const [copayRules, setCopayRules] = useState({
    consultation: { minPercent: 10, maxPercent: 25, minAmount: 50, maxAmount: 150 },
    dental: { minPercent: 10, maxPercent: 30, minAmount: 40, maxAmount: 120 },
    procedure: { minPercent: 15, maxPercent: 35, minAmount: 75, maxAmount: 250 },
    laboratory: { minPercent: 10, maxPercent: 20, minAmount: 30, maxAmount: 120 },
    lab: { minPercent: 10, maxPercent: 20, minAmount: 30, maxAmount: 120 },
    radiology: { minPercent: 15, maxPercent: 30, minAmount: 60, maxAmount: 220 },
    pharmacy: { minPercent: 5, maxPercent: 20, minAmount: 20, maxAmount: 150 },
    procedures: { minPercent: 15, maxPercent: 35, minAmount: 80, maxAmount: 280 },
    surgicalProcedure: { minPercent: 20, maxPercent: 40, minAmount: 100, maxAmount: 400 },
    emergency: { minPercent: 10, maxPercent: 25, minAmount: 40, maxAmount: 180 },
  });

  // Auto-calculate age from DOB
  const calculateAge = (birthDateString: string): number => {
    if (!birthDateString) return 0;
    const today = new Date();
    const birthDate = new Date(`${birthDateString}T00:00:00`);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return Math.max(0, age);
  };

  const calculatedAge = calculateAge(dob);

  const clearForm = () => {
    setTitle('');
    setFirstName('');
    setMiddleName('');
    setLastName('');
    setDob('');
    setGender('');
    setBloodGroup('Unknown');
    setMaritalStatus('');
    setPhoto('');
    setPhone('');
    setEmail('');
    setNationalId('');
    setPassportNo('');
    setAddress('');
    setCity('');
    setNationality('');
    setLanguage('');
    setReligion('');
    setVisaCategory('');
    setCountryOfResidence('');
    setArea('');
    setDistrict('');
    setOccupation('');
    setCompany('');
    setEmergencyName('');
    setEmergencyRelation('');
    setEmergencyPhone('');
    setReferralType('Walk-In');
    setReferrerName('');
    setConsentSigned(false);
    setConsentSignature('');
    setConsentTimestamp('');
    setConsentDetailsAtSigning('');
    setConsentSignerRole('Patient');
    setConsentSignerRelationship('');
    setRegistrationView('registration');
    setStatus('Outpatient');
    setIsTelehealthPatient(false);
    setDepartment('General Medicine');
    setDoctorId(doctors[0]?.id || '');
    setWardOrRoom('');
    setChiefComplaint('');
    setAllergiesInput('');
    setChronicInput('');
    setPayMode('Self');
    setInsuranceProvider('');
    setInsuranceRegulator('');
    setInsuranceNetwork('');
    setInsurancePlanName('');
    setInsuranceCardNumber('');
    setInsuranceCardImage('');
    setSupportDocumentImage('');
    setPolicyNumber('');
    setGroupNumber('');
    setInsuranceExpiryDate('');
    setTpa('');
    setMemberId('');
    setCertificateNumber('');
    setDependentNumber('');
    setClaimFormNo('');
    setRequiresPreAuthorization(false);
    setPreExistingWaitingPeriod('');
    setVerificationReference('');
    setDailyClinicLimitAed('');
    setDhaMemberId('');
    setClientNumber('');
    setCopayPercent(0);
    setDeductibleAmount('');
    setRegistrationType('Consultation');
    setPhysioTechnician('Ahmed Hassan - Physiotherapy Technician');
    setDiscountCardName('');
    setDiscountPercent(0);
    setServiceCopay({ consultation: 20, dental: 20, procedure: 20, laboratory: 20, lab: 20, radiology: 20, pharmacy: 20, procedures: 20, surgicalProcedure: 20, emergency: 10 });
    setCopayRules({
      consultation: { minPercent: 10, maxPercent: 25, minAmount: 50, maxAmount: 150 },
      dental: { minPercent: 10, maxPercent: 30, minAmount: 40, maxAmount: 120 },
      procedure: { minPercent: 15, maxPercent: 35, minAmount: 75, maxAmount: 250 },
      laboratory: { minPercent: 10, maxPercent: 20, minAmount: 30, maxAmount: 120 },
      lab: { minPercent: 10, maxPercent: 20, minAmount: 30, maxAmount: 120 },
      radiology: { minPercent: 15, maxPercent: 30, minAmount: 60, maxAmount: 220 },
      pharmacy: { minPercent: 5, maxPercent: 20, minAmount: 20, maxAmount: 150 },
      procedures: { minPercent: 15, maxPercent: 35, minAmount: 80, maxAmount: 280 },
      surgicalProcedure: { minPercent: 20, maxPercent: 40, minAmount: 100, maxAmount: 400 },
      emergency: { minPercent: 10, maxPercent: 25, minAmount: 40, maxAmount: 180 },
    });
  };

  // Pre-fill if editing existing
  useEffect(() => {
    if (initialPatientId) {
      const existing = patients.find((p) => p.id === initialPatientId);
      if (existing) {
        setTitle(existing.title || '');
        setFirstName(existing.firstName || '');
        setMiddleName(existing.middleName || '');
        setLastName(existing.lastName || '');
        setDob(existing.dob || '');
        setGender(existing.gender || '');
        setBloodGroup(existing.bloodGroup || 'Unknown');
        setMaritalStatus(existing.maritalStatus || '');
        setPhoto(existing.photo || '');
        setPhone(existing.phone || '');
        setEmail(existing.email || '');
        setNationalId(existing.emiratesId || '');
        setPassportNo(existing.passportNo || '');
        setAddress(existing.address || '');
        setCity('');
        setNationality(existing.nationality || '');
        setLanguage(existing.language || '');
        setReligion(existing.religion || '');
        setVisaCategory(existing.visaCategory || '');
        setCountryOfResidence(existing.countryOfResidence || '');
        setArea(existing.area || '');
        setDistrict(existing.district || '');
        setOccupation(existing.occupation || '');
        setCompany(existing.company || '');
        setEmergencyName(existing.emergencyContact?.name || '');
        setEmergencyRelation(existing.emergencyContact?.relationship || '');
        setEmergencyPhone(existing.emergencyContact?.phone || '');
        setReferralType(existing.referral?.type || 'Walk-In');
        setReferrerName(existing.referral?.referrerName || '');
        setConsentSigned(false);
        setConsentSignature('');
        setConsentTimestamp('');
        setConsentDetailsAtSigning('');
        setConsentSignerRole('Patient');
        setConsentSignerRelationship('');
        setStatus(existing.status || 'Outpatient');
        setIsTelehealthPatient(existing.isTelehealthPatient ?? false);
        setDepartment(existing.department || 'General Medicine');
        setDoctorId(existing.primaryPhysicianId || doctors[0]?.id || '');
        setWardOrRoom(existing.wardOrRoom || '');
        setChiefComplaint(existing.purposeOfVisit || '');
        setAllergiesInput(existing.allergies?.map((a) => a.allergen).join(', ') || '');
        setChronicInput(existing.chronicConditions?.join(', ') || '');
        setInsuranceProvider(existing.insurance?.provider || '');
        setInsuranceRegulator(existing.insurance?.regulator || '');
        setInsuranceNetwork(existing.insurance?.network || '');
        setInsurancePlanName(existing.insurance?.planName || '');
        setInsuranceCardNumber(existing.insurance?.cardNumber || '');
        setPolicyNumber(existing.insurance?.policyNumber || '');
        setGroupNumber(existing.insurance?.groupNumber || '');
        setInsuranceExpiryDate(existing.insurance?.expiryDate || '');
        setTpa(existing.insurance?.tpa || '');
        setMemberId(existing.insurance?.memberId || '');
        setCertificateNumber(existing.insurance?.certificateNumber || '');
        setDependentNumber(existing.insurance?.dependentNumber || '');
        setClaimFormNo(existing.insurance?.claimFormNo || '');
        setRequiresPreAuthorization(existing.insurance?.requiresPreAuthorization || false);
        setPreExistingWaitingPeriod(existing.insurance?.preExistingWaitingPeriod || '');
        setVerificationReference(existing.insurance?.verificationReference || '');
        setDailyClinicLimitAed(existing.insurance?.dailyClinicLimitAed?.toString() || '');
        setDhaMemberId(existing.insurance?.dhaMemberId || '');
        setClientNumber(existing.insurance?.clientNumber || '');
        setCopayPercent(100 - (existing.insurance?.coveragePercentage ?? 100));
        setDeductibleAmount(existing.insurance?.deductibleAmount?.toString() || '');
        setServiceCopay({ consultation: 20, dental: 20, procedure: 20, laboratory: 20, lab: 20, radiology: 20, pharmacy: 20, procedures: 20, surgicalProcedure: 20, emergency: 10, ...(existing.insurance?.serviceCopay as any) });
        setInsuranceCardImage(existing.insuranceCardImage || '');
        setSupportDocumentImage(existing.supportDocumentImage || '');
        setPayMode(existing.payMode === 'Discount Card' || existing.payMode === 'Company'
          ? 'Discount Card'
          : existing.payMode || (existing.insurance?.provider === 'Self-Pay' ? 'Self' : 'Insurance'));
      }
    }
  }, [initialPatientId, patients, doctors, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && !initialPatientId) setIsTelehealthPatient(initialIsTelehealthPatient);
  }, [isOpen, initialPatientId, initialIsTelehealthPatient]);

  if (!isOpen) return null;

  const consentPatientName = `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim();
  const consentAddress = [address.trim(), city.trim()].filter(Boolean).join(', ');
  const consentPatientDetails = [
    consentPatientName,
    dob,
    gender,
    phone.trim(),
    nationalId.trim(),
    passportNo.trim(),
    consentAddress,
  ].join('|');
  const consentSignerName = consentSignerRole === 'Patient' ? consentPatientName : consentSignature.trim();
  const hasCurrentConsent = consentSigned && consentTimestamp.length > 0 && consentDetailsAtSigning === consentPatientDetails;

  const registrationSections: RegistrationSection[] = ['demographics', 'contact', 'clinical', 'insurance'];
  const validateSection = (step: RegistrationSection) => {
    if (step === 'demographics') {
      const birthDate = dob ? new Date(`${dob}T00:00:00`) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!firstName.trim() || !lastName.trim() || !dob || !gender || !birthDate || Number.isNaN(birthDate.getTime()) || birthDate > today) {
        addNotification('Patient Details Required', 'Enter the patient’s first name, last name, date of birth, and gender to continue.', 'warning');
        return false;
      }
    }

    if (step === 'contact') {
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 7 || phoneDigits.length > 15) {
        addNotification('Valid Phone Required', 'Enter a patient phone number with 7 to 15 digits.', 'warning');
        return false;
      }
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        addNotification('Valid Email Required', 'Enter a valid email address or leave the email field blank.', 'warning');
        return false;
      }
      const emergencyDigits = emergencyPhone.replace(/\D/g, '');
      if (emergencyPhone.trim() && (emergencyDigits.length < 7 || emergencyDigits.length > 15)) {
        addNotification('Valid Emergency Phone Required', 'Enter an emergency phone number with 7 to 15 digits.', 'warning');
        return false;
      }
    }

    if (step === 'clinical' && status === 'Inpatient' && !wardOrRoom) {
      addNotification('Bed Assignment Required', 'Select an available bed before registering an inpatient.', 'warning');
      return false;
    }

    if (step === 'insurance' && payMode === 'Insurance' && (!insuranceProvider.trim() || (!policyNumber.trim() && !memberId.trim()))) {
      addNotification('Insurance Details Required', 'Enter the insurer and either the policy number or member ID, or select another payment mode.', 'warning');
      return false;
    }
    if (step === 'insurance' && payMode === 'Insurance' && insuranceExpiryDate && insuranceExpiryDate < new Date().toISOString().split('T')[0]) {
      addNotification('Insurance Card Expired', 'This policy expiry date has passed. Verify the policy or select another payment mode.', 'warning');
      return false;
    }
    if (step === 'insurance' && payMode === 'Discount Card' && !discountCardName.trim()) {
      addNotification('Discount Card Required', 'Enter the approved discount card name or select another payment mode.', 'warning');
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (registrationView !== 'registration') return;

    const invalidSection = registrationSections.find((step) => !validateSection(step));
    if (invalidSection) return;
    if (!gender) return;
    if (!hasCurrentConsent || !consentSignerName || (consentSignerRole === 'Legal guardian' && !consentSignerRelationship.trim())) {
      addNotification('Registration Consent Required', 'Review the patient details on the Consent Form tab and confirm the signature and acknowledgment before saving.', 'warning');
      setRegistrationView('consent');
      return;
    }

    if (duplicateMatches.length > 0) {
      const duplicateName = duplicateMatches[0];
      addNotification(
        'Possible Duplicate Patient',
        `${duplicateName.firstName} ${duplicateName.lastName} already exists with similar registration details. Please review before saving.`,
        'warning',
        duplicateName.id
      );
      return;
    }

    const assignedDoctor = doctors.find((d) => d.id === doctorId) || doctors[0];

    const parsedAllergies = allergiesInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((item) => ({
        allergen: item,
        severity: 'Moderate' as const,
      }));

    const parsedChronic = chronicInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (initialPatientId) {
      updatePatient(initialPatientId, {
        title,
        firstName: firstName.trim(),
        middleName: middleName.trim(),
        lastName: lastName.trim(),
        dob,
        age: calculatedAge,
        gender,
        bloodGroup,
        maritalStatus: maritalStatus || undefined,
        photo,
        phone: phone.trim(),
        email: email.trim(),
        emiratesId: nationalId,
        passportNo,
        address: [address.trim(), city.trim()].filter(Boolean).join(', '),
        nationality,
        language,
        religion,
        visaCategory,
        countryOfResidence,
        area,
        district,
        occupation,
        company,
        referral: {
          type: referralType,
          referrerName: referrerName.trim() || undefined,
        },
        consentSigned,
        consentTimestamp: consentSigned ? consentTimestamp : undefined,
        consentSignature: consentSignerName,
        consentSignerRole,
        consentSignerRelationship,
        emergencyContact: {
          name: emergencyName.trim(),
          relationship: emergencyRelation.trim(),
          phone: emergencyPhone.trim(),
        },
        status,
        isTelehealthPatient,
        department,
        primaryPhysicianId: assignedDoctor?.id || 'DOC-01',
        primaryPhysicianName: assignedDoctor?.name || 'Attending Physician',
        wardOrRoom: status === 'Outpatient' ? undefined : wardOrRoom || undefined,
        purposeOfVisit: chiefComplaint,
        allergies: parsedAllergies,
        chronicConditions: parsedChronic,
        insurance: {
          provider: payMode === 'Self' ? 'Self-Pay' : insuranceProvider.trim(),
          policyNumber: payMode === 'Self' ? '' : policyNumber.trim(),
          tpa: payMode === 'Self' ? undefined : tpa.trim() || undefined,
          regulator: payMode === 'Self' ? undefined : insuranceRegulator || undefined,
          network: payMode === 'Self' ? undefined : insuranceNetwork.trim() || undefined,
          planName: payMode === 'Self' ? undefined : insurancePlanName.trim() || undefined,
          cardNumber: payMode === 'Self' ? undefined : insuranceCardNumber.trim() || undefined,
          certificateNumber: payMode === 'Self' ? undefined : certificateNumber.trim() || undefined,
          dependentNumber: payMode === 'Self' ? undefined : dependentNumber.trim() || undefined,
          claimFormNo: payMode === 'Self' ? undefined : claimFormNo.trim() || undefined,
          requiresPreAuthorization: payMode === 'Self' ? undefined : requiresPreAuthorization,
          preExistingWaitingPeriod: payMode === 'Self' ? undefined : preExistingWaitingPeriod.trim() || undefined,
          verificationReference: payMode === 'Self' ? undefined : verificationReference.trim() || undefined,
          dailyClinicLimitAed: payMode === 'Self' || Number(dailyClinicLimitAed) <= 0 ? undefined : Number(dailyClinicLimitAed),
          memberId: payMode === 'Self' ? undefined : memberId.trim() || undefined,
          dhaMemberId: payMode === 'Self' ? undefined : dhaMemberId.trim() || undefined,
          clientNumber: payMode === 'Self' ? undefined : clientNumber.trim() || undefined,
          groupNumber: payMode === 'Self' ? '' : groupNumber.trim(),
          coveragePercentage: payMode === 'Self' ? 0 : Math.max(0, 100 - copayPercent),
          deductibleAmount: payMode === 'Self' ? 0 : Math.max(0, Number(deductibleAmount) || 0),
          copayAmount: 0,
          expiryDate: insuranceExpiryDate,
          status: 'Pending',
          serviceCopay: {
            consultation: serviceCopay.consultation ?? 20,
            dental: serviceCopay.dental ?? 20,
            procedure: serviceCopay.procedure ?? 20,
            laboratory: serviceCopay.laboratory ?? 20,
            lab: serviceCopay.lab ?? 20,
            radiology: serviceCopay.radiology ?? 20,
            pharmacy: serviceCopay.pharmacy ?? 20,
            procedures: serviceCopay.procedures ?? 20,
            surgicalProcedure: serviceCopay.surgicalProcedure ?? 20,
            emergency: serviceCopay.emergency ?? 10,
          },
        },
        payMode,
        insuranceCardImage: insuranceCardImage || undefined,
        supportDocumentImage: supportDocumentImage || undefined,
      });

      addNotification(
        'Patient Record Updated',
        `Successfully updated record for ${firstName} ${lastName}.`,
        'success',
        initialPatientId
      );

      if (onPatientCreated) {
        onPatientCreated(initialPatientId);
      }
      onClose();
      return;
    }

    // Register new patient
    const { patient: newPatient, token: registrationToken } = addPatient({
      title,
      firstName: firstName.trim(),
      middleName: middleName.trim(),
      lastName: lastName.trim(),
      dob,
      age: calculatedAge,
      gender,
      bloodGroup,
      maritalStatus: maritalStatus || undefined,
      photo,
      phone: phone.trim(),
      email: email.trim(),
      address: [address.trim(), city.trim()].filter(Boolean).join(', '),
      nationality,
      language,
      religion,
      visaCategory,
      countryOfResidence,
      area,
      district,
      occupation,
      company,
      referral: {
      type: referralType,
      referrerName: referrerName.trim() || undefined,
      },
      consentSigned,
      consentTimestamp: consentSigned ? consentTimestamp : undefined,
      consentSignature: consentSignerName,
      consentSignerRole,
      consentSignerRelationship,
      emiratesId: nationalId,
      passportNo,
      emergencyContact: {
        name: emergencyName.trim(),
        relationship: emergencyRelation.trim(),
        phone: emergencyPhone.trim(),
      },
      status,
      isTelehealthPatient,
      department,
      primaryPhysicianId: assignedDoctor?.id || 'DOC-01',
      primaryPhysicianName: assignedDoctor?.name || 'Attending Physician',
      wardOrRoom: status === 'Outpatient' ? undefined : wardOrRoom || undefined,
      purposeOfVisit: chiefComplaint.trim(),
      allergies: parsedAllergies,
      chronicConditions: parsedChronic,
      insurance: {
        provider: payMode === 'Self' ? 'Self-Pay' : insuranceProvider.trim(),
        policyNumber: payMode === 'Self' ? '' : policyNumber.trim(),
        tpa: payMode === 'Self' ? undefined : tpa.trim() || undefined,
        regulator: payMode === 'Self' ? undefined : insuranceRegulator || undefined,
        network: payMode === 'Self' ? undefined : insuranceNetwork.trim() || undefined,
        planName: payMode === 'Self' ? undefined : insurancePlanName.trim() || undefined,
        cardNumber: payMode === 'Self' ? undefined : insuranceCardNumber.trim() || undefined,
        certificateNumber: payMode === 'Self' ? undefined : certificateNumber.trim() || undefined,
        dependentNumber: payMode === 'Self' ? undefined : dependentNumber.trim() || undefined,
        claimFormNo: payMode === 'Self' ? undefined : claimFormNo.trim() || undefined,
        requiresPreAuthorization: payMode === 'Self' ? undefined : requiresPreAuthorization,
        preExistingWaitingPeriod: payMode === 'Self' ? undefined : preExistingWaitingPeriod.trim() || undefined,
        verificationReference: payMode === 'Self' ? undefined : verificationReference.trim() || undefined,
        dailyClinicLimitAed: payMode === 'Self' || Number(dailyClinicLimitAed) <= 0 ? undefined : Number(dailyClinicLimitAed),
        memberId: payMode === 'Self' ? undefined : memberId.trim() || undefined,
        dhaMemberId: payMode === 'Self' ? undefined : dhaMemberId.trim() || undefined,
        clientNumber: payMode === 'Self' ? undefined : clientNumber.trim() || undefined,
        groupNumber: payMode === 'Self' ? '' : groupNumber.trim(),
        coveragePercentage: payMode === 'Self' ? 0 : Math.max(0, 100 - copayPercent),
        deductibleAmount: payMode === 'Self' ? 0 : Math.max(0, Number(deductibleAmount) || 0),
        copayAmount: 0,
        expiryDate: insuranceExpiryDate,
        status: 'Pending',
        serviceCopay: {
          consultation: serviceCopay.consultation ?? 20,
          dental: serviceCopay.dental ?? 20,
          procedure: serviceCopay.procedure ?? 20,
          laboratory: serviceCopay.laboratory ?? 20,
          lab: serviceCopay.lab ?? 20,
          radiology: serviceCopay.radiology ?? 20,
          pharmacy: serviceCopay.pharmacy ?? 20,
          procedures: serviceCopay.procedures ?? 20,
          surgicalProcedure: serviceCopay.surgicalProcedure ?? 20,
          emergency: serviceCopay.emergency ?? 10,
        },
      },
      insuranceCardImage: insuranceCardImage || undefined,
      supportDocumentImage: supportDocumentImage || undefined,
      payMode: payMode === 'Discount Card' ? 'Discount Card' : payMode,
      discountCardName: payMode === 'Discount Card' ? discountCardName.trim() : undefined,
      discountCardNumber: payMode === 'Discount Card' ? discountCardName.trim() : undefined,
      discountPercent: payMode === 'Discount Card' ? Math.min(100, Math.max(0, Number(discountPercent) || 0)) : undefined,
    }, registrationType);
    if (!printReceptionToken(registrationToken)) {
      addNotification('Print Window Blocked', `Patient registered with reception token ${registrationToken.tokenNumber}. Allow pop-ups to print the token slip.`, 'warning', newPatient.id);
    }

    const paymentScheme: {
      schemeType: PaymentSchemeType;
      insuranceProvider?: string;
      policyNumber?: string;
      coveragePercent?: number;
      discountCardName?: string;
      discountPercent?: number;
    } =
      payMode === 'Insurance'
        ? {
            schemeType: 'Insurance',
            insuranceProvider,
            policyNumber,
            coveragePercent: Math.max(0, 100 - copayPercent),
          }
        : payMode === 'Discount Card'
        ? {
            schemeType: 'Discount Card',
            discountCardName,
            discountPercent,
          }
        : { schemeType: 'Self-Pay' };

    addNotification(
      'Patient Admitted Successfully',
      `${newPatient.firstName} ${newPatient.lastName} (${newPatient.id}) registered and queued for ${registrationType === 'Consultation' ? department : 'registration and billing'}.`,
      'success',
      newPatient.id
    );

    if (assignedDoctor && registrationType === 'Consultation') {
      addNotification(
        'Doctor Walk-in Alert',
        `Walk-in patient ${newPatient.firstName} ${newPatient.lastName} has been registered for ${assignedDoctor.name} in ${department}.`,
        'info',
        assignedDoctor.id
      );
    }

    if (onPatientCreated) {
      onPatientCreated(newPatient.id);
    }

    onClose();
  };

  const normalizeValue = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();

  const duplicateMatches = patients.filter((patient) => {
    if (initialPatientId && patient.id === initialPatientId) return false;

    const currentFullName = `${firstName} ${middleName} ${lastName}`.trim();
    const patientFullName = `${patient.firstName} ${patient.middleName || ''} ${patient.lastName}`.trim();
    const sameName = currentFullName && patientFullName && normalizeValue(currentFullName) === normalizeValue(patientFullName);
    const sameDob = !!dob && !!patient.dob && dob === patient.dob;
    const samePhone = !!phone && !!patient.phone && normalizeValue(phone) === normalizeValue(patient.phone);
    const sameNationalId = !!nationalId && !!patient.emiratesId && normalizeValue(nationalId) === normalizeValue(patient.emiratesId);
    const samePassport = !!passportNo && !!patient.passportNo && normalizeValue(passportNo) === normalizeValue(patient.passportNo);

    return samePhone || sameNationalId || samePassport || (sameName && sameDob);
  }).slice(0, 3);

  const finalSummary = {
    patient: `${title} ${firstName} ${middleName ? `${middleName} ` : ''}${lastName}`.trim(),
    phone: phone || 'Not provided',
    dob: dob || 'Not provided',
    doctor: doctors.find((d) => d.id === doctorId)?.name || 'To be assigned',
    visit: chiefComplaint || 'Not specified',
  };

  const availableBeds = wardBeds.filter((b) => b.status === 'Available');

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base text-white">
                {initialPatientId ? 'Update Patient Record' : 'Patient Registration & Intake'}
              </h2>
              <p className="text-xs text-slate-400">Enter verified details only. Required fields are marked *.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 py-2 bg-white/95 backdrop-blur border-b border-slate-200 flex gap-2">
            <button
              type="button"
              onClick={() => setRegistrationView('registration')}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${registrationView === 'registration' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              aria-current={registrationView === 'registration' ? 'page' : undefined}
            >
              Patient Information & Registration
            </button>
            <button
              type="button"
              onClick={() => setRegistrationView('consent')}
              className={`rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors ${registrationView === 'consent' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              aria-current={registrationView === 'consent' ? 'page' : undefined}
            >
              <FileText className="w-3.5 h-3.5" />
              Registration Consent
              {hasCurrentConsent && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" aria-label="Consent signed" />}
            </button>
          </div>

          {registrationView === 'registration' ? (
            <>
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
                Mark this patient for telehealth care.
              </span>
            </span>
          </label>
          <div className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Patient Information</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">Demographics and identifying details</p>
            </div>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div className="w-24 h-24 rounded-lg border border-slate-300 bg-white overflow-hidden flex items-center justify-center shrink-0">
                  {photo ? <img src={photo} alt="Patient preview" className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-slate-300" />}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Patient Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setPhoto(typeof reader.result === 'string' ? reader.result : '');
                      reader.readAsDataURL(file);
                    }}
                    className="w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Upload a patient reference photo for identification.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Prefix / Title</label>
                  <select
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="">Select</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Master">Master</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. John"
                    required
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Doe"
                    required
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Date of Birth <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      required
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Calculated Age</label>
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-xs text-slate-700 font-semibold">
                    {dob ? `${calculatedAge} years old` : 'Enter DOB to calculate'}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Gender <span className="text-red-500">*</span></label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Patient['gender'] | '')}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Blood Group <span className="font-normal text-slate-400">(if known)</span></label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="Unknown">Unknown / not recorded</option>
                    <option value="A+">A Positive (A+)</option>
                    <option value="A-">A Negative (A-)</option>
                    <option value="B+">B Positive (B+)</option>
                    <option value="B-">B Negative (B-)</option>
                    <option value="AB+">AB Positive (AB+)</option>
                    <option value="AB-">AB Negative (AB-)</option>
                    <option value="O+">O Positive (O+)</option>
                    <option value="O-">O Negative (O-)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Marital Status</label>
                  <select
                    value={maritalStatus}
                    onChange={(e) => setMaritalStatus(e.target.value as Patient['maritalStatus'] | '')}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="">Not specified</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </div>
                </div>
              </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Contact & Identification</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">How to reach the patient and verify identity</p>
            </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Primary Phone Number</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="patient@email.com"
                      className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">National ID / Emirates ID / SSN</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={nationalId}
                      onChange={(e) => setNationalId(e.target.value)}
                      placeholder="784-1990-1234567-1"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">Enter the ID exactly as shown on the patient’s document.</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Passport Number</label>
                  <input
                    type="text"
                    value={passportNo}
                    onChange={(e) => setPassportNo(e.target.value)}
                    placeholder="N98234120"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-700 block mb-1">Residential Street Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="42 Medical Plaza, Suite 300"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">City / Region</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    list="patient-city-options"
                    placeholder="Select or enter city / region"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-3">
                <h4 className="text-xs font-semibold text-slate-800">Geographical & personal details <span className="font-normal text-slate-500">(optional; choose a suggestion or enter another value)</span></h4>
                <datalist id="patient-city-options">{registrationSuggestions.cities.map((value) => <option key={value} value={value} />)}</datalist>
                <datalist id="patient-nationality-options">{registrationSuggestions.nationalities.map((value) => <option key={value} value={value} />)}</datalist>
                <datalist id="patient-country-options">{registrationSuggestions.countries.map((value) => <option key={value} value={value} />)}</datalist>
                <datalist id="patient-language-options">{registrationSuggestions.languages.map((value) => <option key={value} value={value} />)}</datalist>
                <datalist id="patient-area-options">{registrationSuggestions.areas.map((value) => <option key={value} value={value} />)}</datalist>
                <datalist id="patient-district-options">{registrationSuggestions.districts.map((value) => <option key={value} value={value} />)}</datalist>
                <datalist id="patient-visa-options">{registrationSuggestions.visaCategories.map((value) => <option key={value} value={value} />)}</datalist>
                <datalist id="patient-occupation-options">{registrationSuggestions.occupations.map((value) => <option key={value} value={value} />)}</datalist>
                <datalist id="patient-religion-options">{registrationSuggestions.religions.map((value) => <option key={value} value={value} />)}</datalist>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">Nationality</label>
                    <input list="patient-nationality-options" autoComplete="country-name" value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="Select or enter nationality" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">Country of Residence</label>
                    <input list="patient-country-options" autoComplete="country-name" value={countryOfResidence} onChange={(e) => setCountryOfResidence(e.target.value)} placeholder="Select or enter country" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">Preferred Language</label>
                    <input list="patient-language-options" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Select or enter language" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">Area / Neighborhood</label>
                    <input list="patient-area-options" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Select or enter area" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">District</label>
                    <input list="patient-district-options" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="Select or enter district" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">Visa Category</label>
                    <input list="patient-visa-options" value={visaCategory} onChange={(e) => setVisaCategory(e.target.value)} placeholder="Select or enter visa category" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">Occupation</label>
                    <input list="patient-occupation-options" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Select or enter occupation" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">Employer / Company</label>
                    <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Employer or company" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">Religion <span className="font-normal text-slate-400">(if relevant)</span></label>
                    <input list="patient-religion-options" value={religion} onChange={(e) => setReligion(e.target.value)} placeholder="Select or enter religion" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">Referral Source</label>
                    <select value={referralType} onChange={(e) => setReferralType(e.target.value as NonNullable<Patient['referral']>['type'])} className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden">
                      <option value="Walk-In">Walk-in</option>
                      <option value="Internal">Internal referral</option>
                      <option value="External Center">External center</option>
                      <option value="Corporate">Corporate</option>
                      <option value="Online Booking">Online booking</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">Referrer / Organization</label>
                    <input value={referrerName} onChange={(e) => setReferrerName(e.target.value)} placeholder="Name or organization (if applicable)" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <h4 className="text-xs font-semibold text-slate-800 mb-2">Emergency Contact</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">Contact Name</label>
                    <input
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">Relationship</label>
                    <input
                      type="text"
                      value={emergencyRelation}
                      onChange={(e) => setEmergencyRelation(e.target.value)}
                      placeholder="Spouse / Parent / Sibling"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 block mb-1">Emergency Phone</label>
                    <input
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="+1 (555) 999-1234"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>
                </div>
              </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Visit & Clinical Intake</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">Visit type, care team, admission and relevant medical history</p>
            </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Admission Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as PatientStatus)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="Outpatient">Outpatient (OPD Walk-in / Scheduled)</option>
                    <option value="Inpatient">Inpatient (Ward Admission)</option>
                    <option value="Emergency">Emergency (Immediate ER / STAT)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Clinical Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="General Medicine">General Medicine</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Emergency Medicine">Emergency Medicine</option>
                    <option value="Orthopedics">Orthopedics</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Neurology">Neurology</option>
                    <option value="Oncology">Oncology</option>
                    <option value="Pulmonology">Pulmonology</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Attending Physician</label>
                  <select
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} — {d.specialty} ({d.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    {status === 'Outpatient' ? 'Consultation Room' : 'Assigned Ward Bed'}
                  </label>
                  {status === 'Outpatient' ? (
                    <input
                      type="text"
                      value={wardOrRoom}
                      onChange={(e) => setWardOrRoom(e.target.value)}
                      placeholder="e.g. OPD Room 104"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  ) : (
                    <select
                      value={wardOrRoom}
                      onChange={(e) => setWardOrRoom(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      <option value="">-- Select Available Hospital Bed --</option>
                      {availableBeds.map((bed) => (
                        <option key={bed.id} value={bed.bedNumber}>
                          {bed.bedNumber} ({bed.wardName} - {bed.roomType})
                        </option>
                      ))}
                      {!availableBeds.some((b) => b.bedNumber === wardOrRoom) && wardOrRoom && (
                        <option value={wardOrRoom}>{wardOrRoom} (Currently Assigned)</option>
                      )}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">Chief Complaint / Purpose of Visit</label>
                <textarea
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Describe patient's symptoms, presentation, or referral reason..."
                  rows={2}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Known Allergies <span className="text-slate-400 font-normal">(comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    value={allergiesInput}
                    onChange={(e) => setAllergiesInput(e.target.value)}
                    placeholder="e.g. Penicillin, Latex, NSAIDs"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Chronic Conditions <span className="text-slate-400 font-normal">(comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    value={chronicInput}
                    onChange={(e) => setChronicInput(e.target.value)}
                    placeholder="e.g. Hypertension, Type 2 Diabetes"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                </div>
              </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Registration & Payment</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">Choose the correct service queue and billing arrangement</p>
            </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Registration Queue Type</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['Consultation', 'Non-Consultation', 'Technician'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setRegistrationType(type)}
                        className={`p-3 rounded-lg border text-xs font-medium text-left transition-all cursor-pointer ${
                          registrationType === type
                            ? 'border-blue-600 bg-blue-50/50 text-blue-800 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-semibold">{type} Registration Token</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {type === 'Consultation'
                            ? 'Route to nursing and doctor EMR'
                            : type === 'Technician'
                              ? 'Route to physiotherapy technician desk'
                              : 'Route to cashier, lab, radiology, or procedure'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {registrationType === 'Technician' && (
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">Physio Technician</label>
                    <select
                      value={physioTechnician}
                      onChange={(e) => setPhysioTechnician(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      {['Ahmed Hassan - Physiotherapy Technician', 'Zainab Noor - Physiotherapy Technician', 'Nadia Salem - Physiotherapy Technician'].map((tech) => (
                        <option key={tech} value={tech}>{tech}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Payment Mode</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['Insurance', 'Self', 'Discount Card'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPayMode(mode)}
                        className={`p-3 rounded-lg border text-xs font-medium text-center transition-all cursor-pointer ${
                          payMode === mode
                            ? 'border-blue-600 bg-blue-50/50 text-blue-800 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-semibold">{mode === 'Self' ? 'Self-Pay / Cash' : mode === 'Discount Card' ? 'Discount Card' : mode}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {mode === 'Insurance'
                            ? 'Direct TPA Billing'
                            : mode === 'Self'
                            ? 'Immediate Patient Payment'
                            : 'Apply an approved discount card'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {payMode === 'Insurance' ? (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 text-slate-800 font-medium text-xs">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      UAE Insurance Policy & Eligibility Details
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Record the card and payer details as printed. Eligibility must still be confirmed with the insurer/TPA portal; saving this form does not verify coverage.
                    </p>
                    <datalist id="uae-insurance-payers">{uaeInsuranceSuggestions.payers.map((value) => <option key={value} value={value} />)}</datalist>
                    <datalist id="uae-insurance-tpas">{uaeInsuranceSuggestions.tpas.map((value) => <option key={value} value={value} />)}</datalist>
                    <datalist id="uae-insurance-networks">{uaeInsuranceSuggestions.networks.map((value) => <option key={value} value={value} />)}</datalist>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Insurance Company / Payer</label>
                        <input
                          type="text"
                          list="uae-insurance-payers"
                          value={insuranceProvider}
                          onChange={(e) => setInsuranceProvider(e.target.value)}
                          placeholder="e.g. Daman, Sukoon, ADNIC"
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">TPA</label>
                        <input
                          type="text"
                          list="uae-insurance-tpas"
                          value={tpa}
                          onChange={(e) => setTpa(e.target.value)}
                          placeholder="e.g. NAS, NextCare, MedNet"
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">UAE Regulator / Emirate</label>
                        <select
                          value={insuranceRegulator}
                          onChange={(e) => setInsuranceRegulator(e.target.value as typeof insuranceRegulator)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        >
                          <option value="">Select if applicable</option>
                          <option value="DHA">DHA — Dubai</option>
                          <option value="DOH">DOH — Abu Dhabi</option>
                          <option value="MOHAP">MOHAP — Northern Emirates</option>
                          <option value="Other">Other / not specified</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Network</label>
                        <input type="text" list="uae-insurance-networks" value={insuranceNetwork} onChange={(e) => setInsuranceNetwork(e.target.value)} placeholder="Network printed on card" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Plan Name / Category</label>
                        <input type="text" value={insurancePlanName} onChange={(e) => setInsurancePlanName(e.target.value)} placeholder="Plan / EBP / Thiqa category" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Insurance Card Number</label>
                        <input type="text" value={insuranceCardNumber} onChange={(e) => setInsuranceCardNumber(e.target.value)} placeholder="Number printed on insurance card" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Member ID</label>
                        <input
                          type="text"
                          value={memberId}
                          onChange={(e) => setMemberId(e.target.value)}
                          placeholder="Enter member ID"
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Emirates ID</label>
                        <input
                          type="text"
                          value={nationalId}
                          onChange={(e) => setNationalId(e.target.value)}
                          placeholder="784-0000-0000000-0"
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">DHA Member ID</label>
                        <input
                          type="text"
                          value={dhaMemberId}
                          onChange={(e) => setDhaMemberId(e.target.value)}
                          placeholder="Enter DHA member ID"
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Policy Number</label>
                        <input
                          type="text"
                          value={policyNumber}
                          onChange={(e) => setPolicyNumber(e.target.value)}
                          placeholder="Enter policy number"
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Group Number</label>
                        <input
                          type="text"
                          value={groupNumber}
                          onChange={(e) => setGroupNumber(e.target.value)}
                          placeholder="Enter group number"
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Coverage Expiry Date</label>
                        <input
                          type="date"
                          value={insuranceExpiryDate}
                          onChange={(e) => setInsuranceExpiryDate(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Client Number</label>
                        <input
                          type="text"
                          value={clientNumber}
                          onChange={(e) => setClientNumber(e.target.value)}
                          placeholder="e.g. INS137"
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Certificate Number</label>
                        <input type="text" value={certificateNumber} onChange={(e) => setCertificateNumber(e.target.value)} placeholder="Certificate / policy certificate" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Dependent Number</label>
                        <input type="text" value={dependentNumber} onChange={(e) => setDependentNumber(e.target.value)} placeholder="Dependent / family member no." className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Claim Form / Reference No.</label>
                        <input type="text" value={claimFormNo} onChange={(e) => setClaimFormNo(e.target.value)} placeholder="Optional claim reference" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Eligibility Verification Reference</label>
                        <input type="text" value={verificationReference} onChange={(e) => setVerificationReference(e.target.value)} placeholder="Portal / call reference, if verified" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Pre-existing Condition Waiting Period</label>
                        <input type="text" value={preExistingWaitingPeriod} onChange={(e) => setPreExistingWaitingPeriod(e.target.value)} placeholder="As stated by insurer / policy" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Patient Copay (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={copayPercent}
                          onChange={(e) => setCopayPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Deductible to apply (AED)</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={deductibleAmount}
                          onChange={(event) => setDeductibleAmount(event.target.value)}
                          placeholder="0.00"
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                        <span className="mt-1 block text-[9px] text-slate-500">Applied before co-pay on this invoice.</span>
                      </div>
                      <div className="flex items-center gap-1.5 py-2 text-[11px] text-amber-800 font-medium">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        Verify eligibility and authorization with the payer before treatment.
                      </div>
                    </div>
                    <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2 text-[11px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={requiresPreAuthorization}
                        onChange={(event) => setRequiresPreAuthorization(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      Policy/service requires pre-authorization (confirm per benefit and payer)
                    </label>
                  </div>
                ) : payMode === 'Discount Card' ? (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 text-slate-800 font-medium text-xs">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      Discount Card Details
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Card Name</label>
                        <input
                          type="text"
                          value={discountCardName}
                          onChange={(e) => setDiscountCardName(e.target.value)}
                          placeholder="e.g. Senior Citizen Card"
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Discount (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Self-Pay Policy Notice:</span>
                      <p className="mt-0.5 text-amber-700">
                        Patient is registered as self-pay. Hospital tariff items will be billed directly to the patient invoice with zero insurance deduction.
                      </p>
                    </div>
                  </div>
                )}

                {payMode === 'Insurance' && (
                  <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs"><CreditCard className="w-4 h-4 text-blue-600" /> Co-Pay Configuration</div>
                    <p className="text-[10px] text-slate-500">Configure service co-pays and, when applicable, a per-patient daily maximum for insurer-covered charges. Cashier enforcement remains optional at each visit.</p>
                    <div className="max-w-sm">
                      <label htmlFor="daily-clinic-insurance-limit" className="text-[11px] font-medium text-slate-600 block mb-1">Patient Daily Clinic Insurance Limit (AED)</label>
                      <input
                        id="daily-clinic-insurance-limit"
                        type="number"
                        min={0}
                        step="0.01"
                        value={dailyClinicLimitAed}
                        onChange={(event) => setDailyClinicLimitAed(event.target.value)}
                        placeholder="Leave blank if no daily limit applies"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">The cap applies to the insurer-covered amount accumulated for this patient on the visit date, not the patient co-pay.</p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-slate-200 rounded-lg overflow-hidden text-[10px]">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="border border-slate-200 px-2 py-2 text-left font-semibold text-slate-700">Service</th>
                            <th className="border border-slate-200 px-2 py-2 text-center font-semibold text-slate-700">Co-pay %</th>
                            <th className="border border-slate-200 px-2 py-2 text-center font-semibold text-slate-700">Min %</th>
                            <th className="border border-slate-200 px-2 py-2 text-center font-semibold text-slate-700">Max %</th>
                            <th className="border border-slate-200 px-2 py-2 text-center font-semibold text-slate-700">Min Amount</th>
                            <th className="border border-slate-200 px-2 py-2 text-center font-semibold text-slate-700">Max Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {([
                            ['consultation', 'Consultation'], ['dental', 'Dental'], ['procedure', 'Procedure'],
                            ['pharmacy', 'Pharmacy'], ['surgicalProcedure', 'Surgical Procedure'], ['lab', 'Lab'],
                            ['radiology', 'Radiology'], ['laboratory', 'Laboratory'], ['emergency', 'Emergency'],
                          ] as const).map(([key, label]) => (
                            <tr key={key} className="bg-white">
                              <td className="border border-slate-200 px-2 py-2 text-slate-700 font-medium">{label}</td>
                              <td className="border border-slate-200 px-2 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={serviceCopay[key] ?? 0}
                                  onChange={(e) => setServiceCopay((current) => ({ ...current, [key]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                                  className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-center focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                />
                              </td>
                              <td className="border border-slate-200 px-2 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={copayRules[key].minPercent}
                                  onChange={(e) => setCopayRules((current) => ({
                                    ...current,
                                    [key]: { ...current[key], minPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) },
                                  }))}
                                  className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-center focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                />
                              </td>
                              <td className="border border-slate-200 px-2 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={copayRules[key].maxPercent}
                                  onChange={(e) => setCopayRules((current) => ({
                                    ...current,
                                    [key]: { ...current[key], maxPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) },
                                  }))}
                                  className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-center focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                />
                              </td>
                              <td className="border border-slate-200 px-2 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={copayRules[key].minAmount}
                                  onChange={(e) => setCopayRules((current) => ({
                                    ...current,
                                    [key]: { ...current[key], minAmount: Math.max(0, Number(e.target.value) || 0) },
                                  }))}
                                  className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-center focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                />
                              </td>
                              <td className="border border-slate-200 px-2 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  value={copayRules[key].maxAmount}
                                  onChange={(e) => setCopayRules((current) => ({
                                    ...current,
                                    [key]: { ...current[key], maxAmount: Math.max(0, Number(e.target.value) || 0) },
                                  }))}
                                  className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-center focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {payMode === 'Discount Card' && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
                    <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs"><CreditCard className="w-4 h-4 text-amber-600" /> Discount Card Configuration</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Discount %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 block mb-1">Discount Card</label>
                        <div className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-700">{discountCardName || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {payMode === 'Self' && (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 text-xs">
                    <div className="font-semibold text-slate-800 mb-1">Self-pay registration</div>
                    Co-pay configuration is not applicable for self-pay patients. Only direct patient billing is used.
                  </div>
                )}

                {(payMode === 'Insurance' || payMode === 'Discount Card') && (
                  <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs"><FileText className="w-4 h-4 text-blue-600" /> Insurance Card & ID Proof</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[11px] font-medium text-slate-600 block">Insurance Card Capture</label>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => setInsuranceCardImage(typeof reader.result === 'string' ? reader.result : '');
                            reader.readAsDataURL(file);
                          }}
                          className="w-full text-[10px] text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-blue-50 file:px-2 file:py-1.5 file:text-[10px] file:font-semibold file:text-blue-700"
                        />
                        {insuranceCardImage && <img src={insuranceCardImage} alt="Insurance card preview" className="h-24 w-full object-cover rounded-lg border border-slate-200" />}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-medium text-slate-600 block">ID Proof Scan</label>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => setSupportDocumentImage(typeof reader.result === 'string' ? reader.result : '');
                            reader.readAsDataURL(file);
                          }}
                          className="w-full text-[10px] text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-blue-50 file:px-2 file:py-1.5 file:text-[10px] file:font-semibold file:text-blue-700"
                        />
                        {supportDocumentImage && <img src={supportDocumentImage} alt="ID proof preview" className="h-24 w-full object-cover rounded-lg border border-slate-200" />}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <aside className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Insurance Details</div>
                  <div className="space-y-2 text-[11px] text-slate-700">
                    <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Payment Mode</div>
                      <div className="mt-1 font-semibold text-slate-900">{payMode}</div>
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Provider</div>
                      <div className="mt-1 font-semibold text-slate-900">{payMode === 'Insurance' ? insuranceProvider : payMode === 'Discount Card' ? discountCardName : 'Self-pay patient'}</div>
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Policy / Card</div>
                      <div className="mt-1 font-semibold text-slate-900">{payMode === 'Insurance' ? policyNumber : payMode === 'Discount Card' ? 'Discount card active' : 'Cash / direct payment'}</div>
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 p-2.5">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">Co-Pay</div>
                      <div className="mt-1 font-semibold text-slate-900">{copayPercent}% — pending verification</div>
                    </div>
                  </div>
                </div>

                {duplicateMatches.length > 0 && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
                    <div className="flex items-center gap-2 text-xs font-semibold"><AlertCircle className="w-4 h-4 text-amber-600" /> Possible duplicate record</div>
                    <ul className="mt-2 space-y-1 text-[11px]">
                      {duplicateMatches.map((item) => (
                        <li key={item.id}>
                          {item.firstName} {item.lastName} — {item.phone || item.emiratesId || item.passportNo || 'similar ID'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-4 bg-blue-50/60 rounded-lg border border-blue-200 space-y-3">
                  <div className="flex items-center gap-2 text-blue-900 font-semibold text-xs"><FileText className="w-4 h-4 text-blue-600" /> Registration Summary</div>
                  <div className="space-y-2 text-[11px]">
                    <div><span className="block text-[10px] text-slate-500">Patient</span><strong className="text-slate-900">{finalSummary.patient}</strong></div>
                    <div><span className="block text-[10px] text-slate-500">Contact</span><strong className="text-slate-900">{finalSummary.phone}</strong></div>
                    <div><span className="block text-[10px] text-slate-500">Doctor</span><strong className="text-slate-900">{finalSummary.doctor}</strong></div>
                    <div><span className="block text-[10px] text-slate-500">Visit</span><strong className="text-slate-900">{finalSummary.visit}</strong></div>
                  </div>
                </div>

              </aside>
            </div>

          {/* Footer Controls */}
          <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white/95 backdrop-blur border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={clearForm}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {initialPatientId ? 'Save Changes' : 'Register Patient'}
              </button>
            </div>
          </div>
            </>
          ) : (
            <section className="mx-auto max-w-3xl space-y-5 rounded-xl border border-slate-200 p-5 sm:p-7" aria-labelledby="registration-consent-heading">
              <div>
                <div className="flex items-center gap-2 text-blue-700">
                  <FileText className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase tracking-wide">Patient registration</span>
                </div>
                <h3 id="registration-consent-heading" className="mt-2 text-xl font-bold text-slate-900">Registration & Privacy Consent</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Please review this consent with the patient or their legal representative before signing.
                </p>
              </div>

              <div className="space-y-3 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                <p>
                  I confirm that the information provided for patient registration is accurate to the best of my knowledge. I authorize the hospital to create and maintain a patient record and to use the information provided for registration, appointment coordination, billing, and related healthcare administration.
                </p>
                <p>
                  I understand that my information will be handled under the hospital’s applicable privacy practices and that I may ask staff how my information is used or request correction of inaccurate registration details.
                </p>
                <p className="font-semibold text-slate-800">
                  This registration consent does not replace separate consent required for examination, treatment, procedures, or release of medical information.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/60 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wide text-blue-900">Patient details for consent</h4>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-slate-500">Patient name</dt><dd className="font-semibold text-slate-900">{consentPatientName || 'Complete patient name in registration'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Date of birth</dt><dd className="font-semibold text-slate-900">{dob || 'Not entered'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Gender</dt><dd className="font-semibold text-slate-900">{gender || 'Not entered'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Phone</dt><dd className="font-semibold text-slate-900">{phone.trim() || 'Not entered'}</dd></div>
                  <div><dt className="text-xs text-slate-500">National ID / Emirates ID</dt><dd className="font-semibold text-slate-900">{nationalId.trim() || 'Not entered'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Passport number</dt><dd className="font-semibold text-slate-900">{passportNo.trim() || 'Not entered'}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Address</dt><dd className="font-semibold text-slate-900">{consentAddress || 'Not entered'}</dd></div>
                  {initialPatientId && <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Patient record number</dt><dd className="font-semibold text-slate-900">{initialPatientId}</dd></div>}
                </dl>
                <p className="text-[11px] text-blue-800">These values are linked to the registration form and update automatically when patient details change.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="consent-signer-role" className="mb-1 block text-xs font-semibold text-slate-700">Signing as</label>
                  <select
                    id="consent-signer-role"
                    value={consentSignerRole}
                    onChange={(event) => {
                      setConsentSignerRole(event.target.value as NonNullable<Patient['consentSignerRole']>);
                      setConsentSignerRelationship('');
                      setConsentSigned(false);
                      setConsentTimestamp('');
                      setConsentDetailsAtSigning('');
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Patient">Patient</option>
                    <option value="Legal guardian">Parent / legal guardian</option>
                  </select>
                </div>
                {consentSignerRole === 'Legal guardian' && (
                  <div>
                    <label htmlFor="consent-relationship" className="mb-1 block text-xs font-semibold text-slate-700">Relationship to patient <span className="text-red-500">*</span></label>
                    <input
                      id="consent-relationship"
                      value={consentSignerRelationship}
                      onChange={(event) => {
                        setConsentSignerRelationship(event.target.value);
                        setConsentSigned(false);
                        setConsentTimestamp('');
                        setConsentDetailsAtSigning('');
                      }}
                      placeholder="e.g. Mother, Father, Legal guardian"
                      required
                      className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="consent-signature" className="mb-1 block text-xs font-semibold text-slate-700">
                  {consentSignerRole === 'Patient' ? 'Patient’s full legal name (electronic signature)' : 'Guardian’s full legal name (electronic signature)'}
                  <span className="text-red-500"> *</span>
                </label>
                <input
                  id="consent-signature"
                  type="text"
                  value={consentSignerRole === 'Patient' ? consentPatientName : consentSignature}
                  onChange={(event) => {
                    setConsentSignature(event.target.value);
                    setConsentSigned(false);
                    setConsentTimestamp('');
                    setConsentDetailsAtSigning('');
                  }}
                  autoComplete="name"
                  placeholder={consentSignerRole === 'Patient' ? 'Enter patient name in registration' : 'Type guardian full legal name'}
                  readOnly={consentSignerRole === 'Patient'}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={hasCurrentConsent}
                  disabled={!consentSignerName || (consentSignerRole === 'Legal guardian' && !consentSignerRelationship.trim())}
                  onChange={(event) => {
                    setConsentSigned(event.target.checked);
                    setConsentTimestamp(event.target.checked ? new Date().toISOString() : '');
                    setConsentDetailsAtSigning(event.target.checked ? consentPatientDetails : '');
                  }}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                />
                <span>I have reviewed this registration consent and agree to it on behalf of the patient named in this record.</span>
              </label>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className={`text-xs font-semibold ${hasCurrentConsent ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {hasCurrentConsent ? 'Consent signed and ready to save' : 'Review patient details, then sign and acknowledge'}
                </span>
                <button
                  type="button"
                  onClick={() => setRegistrationView('registration')}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Return to registration
                </button>
              </div>
            </section>
          )}
        </form>
      </div>
    </div>
  );
};
