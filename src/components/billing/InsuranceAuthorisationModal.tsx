import React, { useState } from 'react';
import { X, ShieldCheck, Stethoscope, FileText, CheckCircle2, AlertCircle, Building, DollarSign } from 'lucide-react';
import { useHospital } from '../../context/HospitalContext';
import { InsuranceApproval } from '../../types';

interface InsuranceAuthorisationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorisationCreated?: (approval: InsuranceApproval) => void;
}

export const InsuranceAuthorisationModal: React.FC<InsuranceAuthorisationModalProps> = ({
  isOpen,
  onClose,
  onAuthorisationCreated,
}) => {
  const { patients, doctors, appointments, addInsuranceApproval, currentUser } = useHospital();

  const [patientId, setPatientId] = useState(patients[0]?.id || '');
  const [doctorId, setDoctorId] = useState(doctors[0]?.id || '');
  const [serviceCategory, setServiceCategory] = useState<'Procedure' | 'Lab Test' | 'Radiology' | 'Consultation'>('Procedure');
  const [serviceName, setServiceName] = useState('Coronary Angiography & 2D Echo Doppler');
  const [serviceCode, setServiceCode] = useState('CPT-93306');
  const [insuranceProvider, setInsuranceProvider] = useState('Blue Cross Blue Shield');
  const [policyNumber, setPolicyNumber] = useState('BCBS-9021-X');
  const [approvalNumber, setApprovalNumber] = useState(`AUTH-${Math.floor(100000 + Math.random() * 900000)}`);
  const [estimatedCost, setEstimatedCost] = useState('2400.00');
  const [approvedAmount, setApprovedAmount] = useState('2160.00');
  const [copayPercentage, setCopayPercentage] = useState('10');
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [authorisedBy, setAuthorisedBy] = useState(currentUser?.name || 'Chloe Bennett (Billing Pre-Auth)');
  const [remarks, setRemarks] = useState('Pre-authorisation approval granted by insurer; primary copay required at admission.');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const selectedPatient = patients.find((p) => p.id === patientId) || patients[0];
  const selectedDoctor = doctors.find((d) => d.id === doctorId) || doctors[0];

  // Preset services based on category
  const handleCategoryChange = (cat: 'Procedure' | 'Lab Test' | 'Radiology' | 'Consultation') => {
    setServiceCategory(cat);
    if (cat === 'Procedure') {
      setServiceName('Coronary Angiography & 2D Echo Doppler');
      setServiceCode('CPT-93306');
      setEstimatedCost('2400.00');
      setApprovedAmount('2160.00');
    } else if (cat === 'Lab Test') {
      setServiceName('Comprehensive Neurological Autoantibody Panel');
      setServiceCode('CPT-86255');
      setEstimatedCost('650.00');
      setApprovedAmount('520.00');
    } else if (cat === 'Radiology') {
      setServiceName('MRI Right Knee with Contrast & 3D Reconstruction');
      setServiceCode('CPT-73721');
      setEstimatedCost('1100.00');
      setApprovedAmount('990.00');
    } else {
      setServiceName('Specialist Outpatient Consultation & Evaluation');
      setServiceCode('CPT-99204');
      setEstimatedCost('320.00');
      setApprovedAmount('288.00');
    }
  };

  const parsedEst = parseFloat(estimatedCost) || 0;
  const parsedAppr = parseFloat(approvedAmount) || 0;
  const parsedCopayPct = parseFloat(copayPercentage) || 0;
  const calculatedCopayAmt = (parsedAppr * parsedCopayPct) / 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!approvalNumber.trim()) {
      setError('Please provide a valid insurance pre-authorisation approval number.');
      return;
    }

    if (parsedAppr <= 0) {
      setError('Approved amount must be greater than $0.');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    const newApproval = addInsuranceApproval({
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
      patientMrn: selectedPatient.id,
      insuranceProvider,
      policyNumber,
      approvalNumber: approvalNumber.trim(),
      doctorId: selectedDoctor.id,
      doctorName: selectedDoctor.name,
      department: selectedDoctor.department,
      serviceCategory,
      serviceName,
      serviceCode,
      estimatedCost: parsedEst,
      approvedAmount: parsedAppr,
      copayPercentage: parsedCopayPct,
      copayAmount: calculatedCopayAmt,
      approvalStatus: 'Approved',
      approvalDate: today,
      validUntil,
      authorisedBy,
      remarks,
    });

    if (!newApproval) {
      setError('Insurance requests must be submitted by the assigned doctor as Pending. A Medical Coder publishes the insurer decision.');
      return;
    }

    if (onAuthorisationCreated) {
      onAuthorisationCreated(newApproval);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Add Insurance Pre-Authorisation Approval
              </h3>
              <p className="text-[11px] text-slate-300">
                Link insurance approval number under attending doctor & procedure/lab/radiology
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Patient & Doctor Visit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Select Patient / MRN</label>
              <select
                value={patientId}
                onChange={(e) => {
                  setPatientId(e.target.value);
                  const pt = patients.find((p) => p.id === e.target.value);
                  if (pt && pt.insuranceDetails) {
                    setInsuranceProvider(pt.insuranceDetails.provider || 'Blue Cross Blue Shield');
                    setPolicyNumber(pt.insuranceDetails.policyNumber || 'BCBS-9021-X');
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({p.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Attending Doctor Visit</label>
              <div className="relative">
                <Stethoscope className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <select
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.department})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Insurance Provider & Policy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Insurance Provider</label>
              <input
                type="text"
                value={insuranceProvider}
                onChange={(e) => setInsuranceProvider(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Policy / Member ID</label>
              <input
                type="text"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium font-mono"
                required
              />
            </div>
          </div>

          {/* Insurance Approval Number (Prominent Highlight) */}
          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl">
            <label className="block font-bold text-blue-900 mb-1">
              Insurance Approval / Pre-Authorisation No. *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={approvalNumber}
                onChange={(e) => setApprovalNumber(e.target.value)}
                placeholder="e.g. AUTH-BCBS-882910"
                className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-lg text-sm font-bold font-mono text-blue-900 focus:ring-2 focus:ring-blue-500/20"
                required
              />
              <button
                type="button"
                onClick={() => setApprovalNumber(`AUTH-${Math.floor(100000 + Math.random() * 900000)}`)}
                className="px-2.5 py-2 bg-white hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-[11px] font-semibold whitespace-nowrap cursor-pointer"
              >
                Generate Pre-Auth
              </button>
            </div>
            <span className="text-[10px] text-blue-700 mt-1 block">
              Direct pre-authorization code issued by payer's clinical adjudication portal.
            </span>
          </div>

          {/* Service Classification: Procedure, Lab, Radiology, Consultation */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Service Type Classification</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['Procedure', 'Lab Test', 'Radiology', 'Consultation'] as const).map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`py-2 px-2 rounded-lg text-center font-bold text-[11px] border transition cursor-pointer ${
                    serviceCategory === cat
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Service Name & Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Procedure / Test Name</label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Procedure Code (CPT)</label>
              <input
                type="text"
                value={serviceCode}
                onChange={(e) => setServiceCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono font-bold"
                required
              />
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Estimated Cost ($)</label>
              <input
                type="number"
                step="0.01"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="block font-bold text-emerald-700 mb-1">Approved Amount ($)</label>
              <input
                type="number"
                step="0.01"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-lg font-mono font-bold text-emerald-800"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Patient Copay %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={copayPercentage}
                onChange={(e) => setCopayPercentage(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-800"
              />
            </div>
          </div>

          {/* Valid Until & Authoriser */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Authorisation Valid Until</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Authorised By (Officer)</label>
              <input
                type="text"
                value={authorisedBy}
                onChange={(e) => setAuthorisedBy(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                required
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Insurer Pre-Auth Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Clinical conditions, approved length of stay, network restrictions..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Link Pre-Auth Approval</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
