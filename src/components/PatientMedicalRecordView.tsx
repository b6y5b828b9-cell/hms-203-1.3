import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  User,
  ShieldCheck,
  Heart,
  AlertTriangle,
  Phone,
  Save,
  CheckCircle2,
  Calendar,
  CreditCard,
  Plus,
  Trash2,
  ArrowRight,
  UserCheck,
  History,
  Lock,
  Building,
  Activity,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { Patient, EmergencyContact } from '../types';

export const PatientMedicalRecordView: React.FC = () => {
  const {
    patients,
    updatePatient,
    addNotification,
    selectedPatientId,
    setSelectedPatientId,
    setActiveTab,
  } = useHospital();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFormTab, setActiveFormTab] = useState<'personal' | 'medical' | 'emergency' | 'insurance'>('personal');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Patient>>({});
  const [newAllergy, setNewAllergy] = useState('');
  const [newAllergySeverity, setNewAllergySeverity] = useState<'Mild' | 'Moderate' | 'Severe'>('Moderate');
  const [newCondition, setNewCondition] = useState('');

  // Target patient selection
  const currentPatient =
    patients.find((p) => p.id === selectedPatientId) ||
    patients.find((p) =>
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone.includes(searchQuery) ||
      (p.emiratesId && p.emiratesId.includes(searchQuery))
    ) ||
    patients[0];

  useEffect(() => {
    if (currentPatient) {
      setFormData({
        title: currentPatient.title || '',
        firstName: currentPatient.firstName,
        middleName: currentPatient.middleName || '',
        lastName: currentPatient.lastName,
        dob: currentPatient.dob,
        age: currentPatient.age,
        gender: currentPatient.gender,
        bloodGroup: currentPatient.bloodGroup,
        phone: currentPatient.phone,
        mobile: currentPatient.mobile || currentPatient.phone,
        smsMobile: currentPatient.smsMobile || currentPatient.phone,
        email: currentPatient.email,
        emiratesId: currentPatient.emiratesId || '',
        passportNo: currentPatient.passportNo || '',
        nationality: currentPatient.nationality,
        maritalStatus: currentPatient.maritalStatus || 'Single',
        address: currentPatient.address,
        allergies: currentPatient.allergies ? [...currentPatient.allergies] : [],
        chronicConditions: currentPatient.chronicConditions ? [...currentPatient.chronicConditions] : [],
        medicalHistory: currentPatient.medicalHistory ? [...currentPatient.medicalHistory] : [],
        surgicalHistory: currentPatient.surgicalHistory ? [...currentPatient.surgicalHistory] : [],
        familyHistory: currentPatient.familyHistory || '',
        lifestyleHabits: currentPatient.lifestyleHabits || {
          smoking: 'Non-smoker',
          alcohol: 'Non-drinker',
          exerciseFrequency: 'Moderate',
        },
        emergencyContact: currentPatient.emergencyContact
          ? { ...currentPatient.emergencyContact }
          : { name: '', relationship: 'Next of Kin', phone: '' },
        insurance: currentPatient.insurance
          ? { ...currentPatient.insurance }
          : {
              provider: 'Self-Pay',
              policyNumber: '',
              groupNumber: '',
              coveragePercentage: 80,
              copayAmount: 20,
              status: 'Verified',
              expiryDate: '2027-12-31',
            },
      });
      setSaveSuccess(false);
    }
  }, [currentPatient?.id]);

  const filteredPatients = searchQuery.trim()
    ? patients.filter((p) => {
        const query = searchQuery.toLowerCase().trim();
        return (
          p.firstName.toLowerCase().includes(query) ||
          p.lastName.toLowerCase().includes(query) ||
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query) ||
          (p.rgNo && p.rgNo.toLowerCase().includes(query)) ||
          p.phone.includes(query) ||
          (p.emiratesId && p.emiratesId.toLowerCase().includes(query)) ||
          (p.passportNo && p.passportNo.toLowerCase().includes(query))
        );
      })
    : patients;

  const handleInputChange = (field: keyof Patient, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSaveSuccess(false);
  };

  const handleNestedChange = (parent: 'emergencyContact' | 'lifestyleHabits' | 'insurance', field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [parent]: {
        ...(prev[parent] as any),
        [field]: value,
      },
    }));
    setSaveSuccess(false);
  };

  const handleAddAllergy = () => {
    if (!newAllergy.trim()) return;
    const item = { allergen: newAllergy.trim(), severity: newAllergySeverity };
    setFormData((prev) => ({
      ...prev,
      allergies: [...(prev.allergies || []), item as any],
    }));
    setNewAllergy('');
    setSaveSuccess(false);
  };

  const handleRemoveAllergy = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      allergies: (prev.allergies || []).filter((_, i) => i !== index),
    }));
    setSaveSuccess(false);
  };

  const handleAddCondition = () => {
    if (!newCondition.trim()) return;
    setFormData((prev) => ({
      ...prev,
      chronicConditions: [...(prev.chronicConditions || []), newCondition.trim()],
    }));
    setNewCondition('');
    setSaveSuccess(false);
  };

  const handleRemoveCondition = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      chronicConditions: (prev.chronicConditions || []).filter((_, i) => i !== index),
    }));
    setSaveSuccess(false);
  };

  const handleSaveMedicalRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPatient) return;

    // Preserve permanent unique identifiers
    const updates: Partial<Patient> = {
      ...formData,
      // Ensure unique identifiers remain constant
      id: currentPatient.id,
      rgNo: currentPatient.rgNo || currentPatient.id,
    };

    updatePatient(currentPatient.id, updates);
    setSaveSuccess(true);
    addNotification(
      'Medical Record Updated',
      `Permanent patient record for ${formData.firstName} ${formData.lastName} (${currentPatient.rgNo || currentPatient.id}) saved successfully.`,
      'success',
      currentPatient.id
    );

    setTimeout(() => {
      setSaveSuccess(false);
    }, 4000);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* View Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Patient Medical Record &amp; Demographic Profile
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-bold uppercase">
              MASTER DOSSIER
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Update personal details, clinical history, chronic conditions, and insurance data for registered patients. The unique Patient ID / MRN remains permanent across all visits.
          </p>
        </div>

        {/* Quick jump actions */}
        <div className="flex flex-wrap items-center gap-2">
          {currentPatient && (
            <>
              <button
                type="button"
                onClick={() => {
                  setSelectedPatientId(currentPatient.id);
                  setActiveTab('registration');
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Register Visit &amp; Token</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPatientId(currentPatient.id);
                  setActiveTab('enquiry');
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>Visit Timeline</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Patient Directory Lookup */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col max-h-[780px]">
          <div className="mb-3">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Select Patient to Edit Medical Record
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder="Search MRN, Name, Phone, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-teal-500/20 text-slate-900"
              />
            </div>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100 flex-1 space-y-1">
            {filteredPatients.map((p) => {
              const isSelected = p.id === currentPatient?.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  className={`p-2.5 rounded-lg cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-teal-50 border border-teal-200 text-teal-900 shadow-2xs'
                      : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs truncate flex items-center gap-1.5">
                      <span>{p.firstName} {p.lastName}</span>
                      <span className="text-[10px] text-teal-700 font-mono font-semibold">({p.rgNo || p.id})</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {p.age}y · {p.gender} · {p.phone}
                    </div>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold shrink-0">
                    {p.facilityVisits?.length || 1} visit{p.facilityVisits?.length === 1 ? '' : 's'}
                  </span>
                </div>
              );
            })}
            {filteredPatients.length === 0 && (
              <p className="text-center py-8 text-xs text-slate-400">
                No registered patients match your search.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Comprehensive Medical Record Editor */}
        {currentPatient ? (
          <div className="lg:col-span-8 space-y-4">
            {/* Permanent Patient ID & Identity Badge */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-800 font-bold text-base flex items-center justify-center font-mono">
                    {formData.bloodGroup || currentPatient.bloodGroup}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">
                        {formData.title ? `${formData.title} ` : ''}{formData.firstName} {formData.middleName ? `${formData.middleName} ` : ''}{formData.lastName}
                      </h2>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-mono text-xs font-bold">
                        <Lock className="w-3 h-3 text-blue-500" />
                        MRN: {currentPatient.rgNo || currentPatient.id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Permanent Unique Patient Key · Registered {new Date(currentPatient.createdAt).toLocaleDateString()} · {currentPatient.facilityVisits?.length || 1} Total Hospital Visits
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                    currentPatient.status === 'Emergency'
                      ? 'bg-rose-100 text-rose-800'
                      : currentPatient.status === 'Inpatient'
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {currentPatient.status}
                  </span>
                </div>
              </div>

              {/* Permanent ID note */}
              <div className="mt-3 bg-amber-50/80 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  <strong>Permanent Medical Record Number (MRN):</strong> This patient’s unique ID (<span className="font-mono font-bold">{currentPatient.rgNo || currentPatient.id}</span>) is permanent and remains the same on every registration, encounter, and token generation. Day-to-day encounters update doctor assignment and visit notes without changing this core identifier.
                </p>
              </div>
            </div>

            {/* Form Section Tabs */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex border-b border-slate-200 bg-slate-50/75 p-1 gap-1 overflow-x-auto">
                {[
                  { id: 'personal', label: '1. Personal & Contact Details', icon: User },
                  { id: 'medical', label: '2. Medical History & Allergies', icon: Heart },
                  { id: 'emergency', label: '3. Emergency Contacts', icon: Phone },
                  { id: 'insurance', label: '4. Registered Insurance & TPA', icon: ShieldCheck },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeFormTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFormTab(tab.id as typeof activeFormTab)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-white text-teal-800 shadow-xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSaveMedicalRecord} className="p-4 sm:p-5 space-y-4">
                {/* TAB 1: PERSONAL & CONTACT DETAILS */}
                {activeFormTab === 'personal' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Title</label>
                        <select
                          value={formData.title || ''}
                          onChange={(e) => handleInputChange('title', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                        >
                          <option value="">None</option>
                          <option value="Mr.">Mr.</option>
                          <option value="Ms.">Ms.</option>
                          <option value="Mrs.">Mrs.</option>
                          <option value="Dr.">Dr.</option>
                          <option value="Prof.">Prof.</option>
                          <option value="Master">Master</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">First Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.firstName || ''}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Middle Name</label>
                        <input
                          type="text"
                          value={formData.middleName || ''}
                          onChange={(e) => handleInputChange('middleName', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Last Name *</label>
                        <input
                          type="text"
                          required
                          value={formData.lastName || ''}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Date of Birth</label>
                        <input
                          type="date"
                          value={formData.dob || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleInputChange('dob', val);
                            if (val) {
                              const birthYear = new Date(val).getFullYear();
                              const currentYear = new Date().getFullYear();
                              handleInputChange('age', Math.max(0, currentYear - birthYear));
                            }
                          }}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Age</label>
                        <input
                          type="number"
                          value={formData.age ?? ''}
                          onChange={(e) => handleInputChange('age', Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Gender</label>
                        <select
                          value={formData.gender || 'Male'}
                          onChange={(e) => handleInputChange('gender', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Blood Group</label>
                        <select
                          value={formData.bloodGroup || 'O+'}
                          onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800"
                        >
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Primary Phone *</label>
                        <input
                          type="tel"
                          required
                          value={formData.phone || ''}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">SMS Mobile</label>
                        <input
                          type="tel"
                          value={formData.smsMobile || ''}
                          onChange={(e) => handleInputChange('smsMobile', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email Address</label>
                        <input
                          type="email"
                          value={formData.email || ''}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">National ID / Emirates ID</label>
                        <input
                          type="text"
                          value={formData.emiratesId || ''}
                          onChange={(e) => handleInputChange('emiratesId', e.target.value)}
                          placeholder="784-XXXX-XXXXXXX-X"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Passport Number</label>
                        <input
                          type="text"
                          value={formData.passportNo || ''}
                          onChange={(e) => handleInputChange('passportNo', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nationality</label>
                        <input
                          type="text"
                          value={formData.nationality || ''}
                          onChange={(e) => handleInputChange('nationality', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Marital Status</label>
                        <select
                          value={formData.maritalStatus || 'Single'}
                          onChange={(e) => handleInputChange('maritalStatus', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                        >
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Divorced">Divorced</option>
                          <option value="Widowed">Widowed</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2 lg:col-span-4">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Residential Address</label>
                        <input
                          type="text"
                          value={formData.address || ''}
                          onChange={(e) => handleInputChange('address', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: MEDICAL HISTORY & ALLERGIES */}
                {activeFormTab === 'medical' && (
                  <div className="space-y-4 text-xs">
                    {/* Allergies */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-800 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Known Drug &amp; Food Allergies</span>
                        </label>
                        <span className="text-[10px] text-slate-500">{(formData.allergies || []).length} Recorded</span>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {(formData.allergies || []).map((allergy: any, idx) => {
                          const name = typeof allergy === 'string' ? allergy : allergy.allergen;
                          const severity = typeof allergy === 'string' ? 'Moderate' : allergy.severity || 'Moderate';
                          return (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center gap-1.5"
                            >
                              <span>{name} ({severity})</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveAllergy(idx)}
                                className="text-rose-500 hover:text-rose-800 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                        {(formData.allergies || []).length === 0 && (
                          <span className="text-slate-400 italic text-[11px]">No documented allergies (NKDA).</span>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <input
                          type="text"
                          placeholder="Add allergy (e.g. Penicillin, NSAIDs, Peanuts)..."
                          value={newAllergy}
                          onChange={(e) => setNewAllergy(e.target.value)}
                          className="flex-1 bg-white border border-slate-300 rounded-lg p-1.5 text-xs"
                        />
                        <select
                          value={newAllergySeverity}
                          onChange={(e) => setNewAllergySeverity(e.target.value as any)}
                          className="bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-medium"
                        >
                          <option value="Mild">Mild</option>
                          <option value="Moderate">Moderate</option>
                          <option value="Severe">Severe (Anaphylaxis)</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleAddAllergy}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>
                    </div>

                    {/* Chronic Medical Conditions */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-800 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-blue-600" />
                          <span>Chronic Conditions &amp; Comorbidities</span>
                        </label>
                        <span className="text-[10px] text-slate-500">{(formData.chronicConditions || []).length} Conditions</span>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {(formData.chronicConditions || []).map((cond, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-semibold flex items-center gap-1.5"
                          >
                            <span>{cond}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCondition(idx)}
                              className="text-blue-500 hover:text-blue-800 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        {(formData.chronicConditions || []).length === 0 && (
                          <span className="text-slate-400 italic text-[11px]">No chronic conditions documented.</span>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <input
                          type="text"
                          placeholder="Add chronic condition (e.g. Hypertension, Type 2 Diabetes, Asthma)..."
                          value={newCondition}
                          onChange={(e) => setNewCondition(e.target.value)}
                          className="flex-1 bg-white border border-slate-300 rounded-lg p-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleAddCondition}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>
                    </div>

                    {/* Family & Surgical History */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Family Medical History
                        </label>
                        <textarea
                          rows={3}
                          value={formData.familyHistory || ''}
                          onChange={(e) => handleInputChange('familyHistory', e.target.value)}
                          placeholder="e.g. Father had CAD at age 52; Mother has type 2 diabetes mellitus..."
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Lifestyle &amp; Clinical Habits
                        </label>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-600">Smoking:</span>
                            <select
                              value={formData.lifestyleHabits?.smoking || 'Non-smoker'}
                              onChange={(e) => handleNestedChange('lifestyleHabits', 'smoking', e.target.value)}
                              className="bg-slate-50 border border-slate-300 rounded-lg p-1 text-xs"
                            >
                              <option value="Non-smoker">Non-smoker</option>
                              <option value="Current smoker">Current smoker</option>
                              <option value="Ex-smoker">Ex-smoker</option>
                            </select>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-600">Alcohol:</span>
                            <select
                              value={formData.lifestyleHabits?.alcohol || 'Non-drinker'}
                              onChange={(e) => handleNestedChange('lifestyleHabits', 'alcohol', e.target.value)}
                              className="bg-slate-50 border border-slate-300 rounded-lg p-1 text-xs"
                            >
                              <option value="Non-drinker">Non-drinker</option>
                              <option value="Occasional">Occasional</option>
                              <option value="Regular">Regular</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: EMERGENCY CONTACTS */}
                {activeFormTab === 'emergency' && (
                  <div className="space-y-4 text-xs">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-teal-600" />
                        <span>Primary Next of Kin / Emergency Contact</span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Contact Full Name *
                          </label>
                          <input
                            type="text"
                            value={formData.emergencyContact?.name || ''}
                            onChange={(e) => handleNestedChange('emergencyContact', 'name', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Relationship to Patient
                          </label>
                          <select
                            value={formData.emergencyContact?.relationship || 'Spouse'}
                            onChange={(e) => handleNestedChange('emergencyContact', 'relationship', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                          >
                            <option value="Spouse">Spouse</option>
                            <option value="Parent">Parent</option>
                            <option value="Sibling">Sibling</option>
                            <option value="Child">Child</option>
                            <option value="Guardian">Legal Guardian</option>
                            <option value="Friend">Friend / Colleague</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Emergency Phone Number *
                          </label>
                          <input
                            type="tel"
                            value={formData.emergencyContact?.phone || ''}
                            onChange={(e) => handleNestedChange('emergencyContact', 'phone', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: REGISTERED INSURANCE & TPA */}
                {activeFormTab === 'insurance' && (
                  <div className="space-y-4 text-xs">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                          <span>Primary Registered Health Insurance Policy</span>
                        </h3>
                        <span className="text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
                          {formData.insurance?.status || 'Active'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Insurance Payer / Carrier
                          </label>
                          <input
                            type="text"
                            value={formData.insurance?.provider || ''}
                            onChange={(e) => handleNestedChange('insurance', 'provider', e.target.value)}
                            placeholder="e.g. Bupa Global, Daman, MetLife..."
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Policy / Certificate Number
                          </label>
                          <input
                            type="text"
                            value={formData.insurance?.policyNumber || ''}
                            onChange={(e) => handleNestedChange('insurance', 'policyNumber', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Card / Member ID
                          </label>
                          <input
                            type="text"
                            value={formData.insurance?.cardNumber || formData.insurance?.memberId || ''}
                            onChange={(e) => handleNestedChange('insurance', 'cardNumber', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Network Tier
                          </label>
                          <input
                            type="text"
                            value={formData.insurance?.network || ''}
                            onChange={(e) => handleNestedChange('insurance', 'network', e.target.value)}
                            placeholder="e.g. RN, Comprehensive, Gold..."
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Coverage Percentage (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.insurance?.coveragePercentage ?? 80}
                            onChange={(e) => handleNestedChange('insurance', 'coveragePercentage', Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Fixed Copay Amount ($)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.insurance?.copayAmount ?? 20}
                            onChange={(e) => handleNestedChange('insurance', 'copayAmount', Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Policy Expiry Date
                          </label>
                          <input
                            type="date"
                            value={formData.insurance?.expiryDate || '2027-12-31'}
                            onChange={(e) => handleNestedChange('insurance', 'expiryDate', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            TPA Administrator
                          </label>
                          <input
                            type="text"
                            value={formData.insurance?.tpa || ''}
                            onChange={(e) => handleNestedChange('insurance', 'tpa', e.target.value)}
                            placeholder="e.g. NAS, MedNet, NextCare..."
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Save Feedback and Action Button */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    {saveSuccess && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg animate-fade-in">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Patient medical record and personal details updated successfully!
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-teal-700 hover:bg-teal-600 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Medical Record Changes</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            Select a patient from the directory on the left to edit their medical record.
          </div>
        )}
      </div>
    </div>
  );
};
