import React, { useState } from 'react';
import {
  Ticket,
  Plus,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Printer,
  Search,
  Building,
  UserCheck,
} from 'lucide-react';
import { useHospital } from '../../context/HospitalContext';
import { PaymentSchemeType, ReceptionToken } from '../../types';
import { TokenWorkflowModal } from '../tokens/TokenWorkflowModal';

export const DailyTokensView: React.FC = () => {
  const { receptionTokens, createReceptionToken, updateReceptionTokenStatus, patients, doctors, addNotification } = useHospital();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isNewTokenModalOpen, setIsNewTokenModalOpen] = useState(false);
  const [workflowToken, setWorkflowToken] = useState<ReceptionToken | null>(null);

  // New Token Form State
  const [patientMode, setPatientMode] = useState<'existing' | 'walkin'>('existing');
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || '');
  const [walkinName, setWalkinName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('+1 (555) 019-2834');
  const [department, setDepartment] = useState('Front Desk Registration');
  const [serviceType, setServiceType] = useState<ReceptionToken['serviceType']>('Consultation');
  const [doctorId, setDoctorId] = useState(patients[0]?.primaryPhysicianId || '');
  const [counterOrRoom, setCounterOrRoom] = useState('Counter 1 (Main Desk)');
  const [priority, setPriority] = useState<ReceptionToken['priority']>('Normal');
  const [registrationType, setRegistrationType] = useState<'Consultation' | 'Non-Consultation'>('Consultation');
  const [paymentSchemeType, setPaymentSchemeType] = useState<PaymentSchemeType>('Self-Pay');
  const [insuranceProvider, setInsuranceProvider] = useState('MetLife Health');
  const [policyNumber, setPolicyNumber] = useState('POL-992014');
  const [discountPercent, setDiscountPercent] = useState(20);

  // Token Metrics
  const totalTokens = receptionTokens.length;
  const waitingTokens = receptionTokens.filter((t) => t.status === 'Waiting');
  const inConsultationTokens = receptionTokens.filter((t) => t.status === 'In Consultation');
  const completedTokens = receptionTokens.filter((t) => t.status === 'Completed');
  const cancelledTokens = receptionTokens.filter((t) => t.status === 'Cancelled');

  // Filtered Tokens
  const filteredTokens = receptionTokens.filter((token) => {
    const matchesSearch =
      token.tokenNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.department.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || token.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const handleCreateToken = (e: React.FormEvent) => {
    e.preventDefault();

    let name = walkinName.trim();
    let patientId = 'WALK-IN';
    let phone = walkinPhone;

    if (patientMode === 'existing') {
      const pt = patients.find((p) => p.id === selectedPatientId) || patients[0];
      if (pt) {
        name = `${pt.firstName} ${pt.lastName}`;
        patientId = pt.id;
        phone = pt.phone;
      }
    }

    if (!name) {
      name = 'Anonymous Walk-in Patient';
    }

    const selectedDoctor = doctors.find((doctor) => doctor.id === doctorId);
    if (registrationType === 'Consultation' && serviceType === 'Consultation' && !selectedDoctor) {
      addNotification('Select Consultation Doctor', 'Choose the doctor for this consultation before creating the token.', 'warning');
      return;
    }

    const createdToken = createReceptionToken({
      patientId,
      patientName: name,
      patientPhone: phone,
      doctorId: registrationType === 'Consultation' && serviceType === 'Consultation' ? selectedDoctor?.id : undefined,
      doctorName: registrationType === 'Consultation' && serviceType === 'Consultation' ? selectedDoctor?.name : undefined,
      department: registrationType === 'Consultation' ? department : 'Registration & Cashier',
      serviceType: registrationType === 'Consultation' ? serviceType : 'Billing & Cashier',
      counterOrRoom,
      priority,
      status: 'Waiting',
      estimatedWaitMins: waitingTokens.length * 10,
      currentStage: '1_REGISTRATION',
      paymentScheme:
        paymentSchemeType === 'Insurance'
          ? { schemeType: 'Insurance', insuranceProvider, policyNumber, coveragePercent: 80 }
          : paymentSchemeType === 'Discount Card'
          ? { schemeType: 'Discount Card', discountCardName: 'Patient Discount Card', discountPercent }
          : { schemeType: 'Self-Pay' },
    });
    if (!createdToken) return;

    addNotification({
      title: `Token ${createdToken.tokenNumber} Issued`,
      message: `Token for ${name} created under ${department} (${counterOrRoom}).`,
      type: 'info',
    });

    setIsNewTokenModalOpen(false);
    setWalkinName('');
  };

  const handleCallToken = (token: ReceptionToken) => {
    updateReceptionTokenStatus(token.id, 'In Consultation');
    addNotification({
      title: `Calling Token ${token.tokenNumber}`,
      message: `Please proceed to ${token.counterOrRoom} for ${token.patientName}.`,
      type: 'info',
    });
  };

  const handleCompleteToken = (token: ReceptionToken) => {
    updateReceptionTokenStatus(token.id, 'Completed');
    addNotification({
      title: `Token ${token.tokenNumber} Completed`,
      message: `Consultation & service finalized for ${token.patientName}.`,
      type: 'info',
    });
  };

  const handlePrintSlip = (token: ReceptionToken) => {
    window.print();
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Active Serving Banner */}
      {inConsultationTokens.length > 0 && (
        <div className="bg-blue-900 text-white rounded-xl p-3.5 sm:p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 border border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
              <Volume2 className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-blue-300 block">
                NOW SERVING AT COUNTERS
              </span>
              <div className="text-xl font-black font-mono tracking-tight">
                {inConsultationTokens.map((t) => `${t.tokenNumber} (${t.counterOrRoom})`).join(' • ')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-blue-200">
              {inConsultationTokens.length} Patient(s) actively engaged at counters
            </span>
          </div>
        </div>
      )}

      {/* 5 Token Status Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Tokens Created
          </span>
          <div className="text-2xl font-black font-mono text-slate-900 mt-1">{totalTokens}</div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Issued Today</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
            Waiting in Queue
          </span>
          <div className="text-2xl font-black font-mono text-amber-600 mt-1">{waitingTokens.length}</div>
          <span className="text-[10px] text-amber-700 mt-0.5 block">Estimated ~{waitingTokens.length * 8} min</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-blue-200 bg-blue-50/20 shadow-sm">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
            In Consultation / Counter
          </span>
          <div className="text-2xl font-black font-mono text-blue-600 mt-1">{inConsultationTokens.length}</div>
          <span className="text-[10px] text-blue-700 mt-0.5 block">At Service Counters</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
            Completed Tokens
          </span>
          <div className="text-2xl font-black font-mono text-emerald-600 mt-1">{completedTokens.length}</div>
          <span className="text-[10px] text-emerald-700 mt-0.5 block">Cleared Today</span>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Cancelled / No Show
          </span>
          <div className="text-2xl font-black font-mono text-slate-600 mt-1">{cancelledTokens.length}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Non-Responsive</span>
        </div>
      </div>

      {/* Action Bar & Search Filter */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search token #, patient name, department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'waiting', label: 'Waiting' },
              { id: 'in consultation', label: 'In Consultation' },
              { id: 'completed', label: 'Completed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsNewTokenModalOpen(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Create Token</span>
          </button>
        </div>
      </div>

      {/* Daily Tokens Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Daily Reception Tokens Status Registry ({filteredTokens.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Real-time Queue Sequencer</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-2.5 px-3">Token No.</th>
                <th className="py-2.5 px-3">Patient & MRN</th>
                <th className="py-2.5 px-3">Department & Service</th>
                <th className="py-2.5 px-3">Counter / Suite</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Created Time</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Queue Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredTokens.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No tokens found for the selected query or status filter.
                  </td>
                </tr>
              ) : (
                filteredTokens.map((token) => (
                  <tr key={token.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-mono font-black text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block">
                        {token.tokenNumber}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{token.patientName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{token.patientId}</div>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-800">{token.department}</div>
                      <div className="text-[10px] text-slate-500">{token.serviceType}</div>
                      {token.serviceItems && token.serviceItems.length > 0 && (
                        <div className="mt-1 text-[10px] text-teal-700">
                          Services: {token.serviceItems.map((item) => `${item.name} · AED ${item.price.toFixed(2)}`).join(', ')}
                        </div>
                      )}
                      {token.serviceType === 'Consultation' && token.doctorOrders && (
                        <div className="mt-1 text-[10px] text-indigo-700">
                          Doctor orders: {[
                            ...token.doctorOrders.labRequests.map((item) => item.testName),
                            ...token.doctorOrders.radiologyRequests.map((item) => item.studyName),
                            ...token.doctorOrders.procedureRequests.map((item) => item.procedureName),
                          ].join(', ') || 'Consultation only'}
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700">
                      {token.counterOrRoom}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          token.priority === 'Urgent'
                            ? 'bg-rose-100 text-rose-800'
                            : token.priority === 'VIP / Elderly'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {token.priority}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600 text-[11px]">
                      {token.createdTime}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          token.status === 'Waiting'
                            ? 'bg-amber-100 text-amber-800'
                            : token.status === 'In Consultation'
                            ? 'bg-blue-600 text-white animate-pulse'
                            : token.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {token.status}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap text-right space-x-1.5">
                      {token.status === 'Waiting' && (
                        <button
                          onClick={() => handleCallToken(token)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>Call Desk</span>
                        </button>
                      )}

                      <button
                        onClick={() => setWorkflowToken(token)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-700 text-white rounded text-xs font-bold shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <UserCheck className="w-3 h-3" />
                        <span>Workflow</span>
                      </button>

                      {token.status === 'In Consultation' && (
                        <button
                          onClick={() => handleCompleteToken(token)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Finish</span>
                        </button>
                      )}

                      <button
                        onClick={() => handlePrintSlip(token)}
                        title="Print Token Slip"
                        className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE TOKEN MODAL */}
      {isNewTokenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create Daily Reception Token</h3>
                  <p className="text-[11px] text-slate-300">Generate sequential token slip for incoming patient</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewTokenModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateToken} className="p-5 space-y-3.5 text-xs">
              {/* Patient Mode Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPatientMode('existing')}
                  className={`flex-1 py-1.5 rounded-lg font-bold border transition cursor-pointer ${
                    patientMode === 'existing'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Registered Patient
                </button>
                <button
                  type="button"
                  onClick={() => setPatientMode('walkin')}
                  className={`flex-1 py-1.5 rounded-lg font-bold border transition cursor-pointer ${
                    patientMode === 'walkin'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  Walk-In Visitor
                </button>
              </div>

              {patientMode === 'existing' ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Patient</label>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => {
                      const patientId = e.target.value;
                      setSelectedPatientId(patientId);
                      const patient = patients.find((item) => item.id === patientId);
                      setDoctorId(patient?.primaryPhysicianId || '');
                      if (patient?.department) setDepartment(patient.department);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} (Reg. no: {p.rgNo || p.id})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Walk-In Patient Name</label>
                  <input
                    type="text"
                    value={walkinName}
                    onChange={(e) => setWalkinName(e.target.value)}
                    placeholder="Enter full name..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                    required={patientMode === 'walkin'}
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Registration Queue Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Consultation', 'Non-Consultation'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setRegistrationType(type)}
                      className={`py-1.5 rounded-lg font-bold border transition cursor-pointer ${
                        registrationType === type
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {registrationType === 'Consultation' && serviceType === 'Consultation' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Consultation Doctor</label>
                  <select
                    required
                    value={doctorId}
                    onChange={(event) => {
                      const selected = doctors.find((doctor) => doctor.id === event.target.value);
                      setDoctorId(event.target.value);
                      if (selected) setDepartment(selected.department);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  >
                    <option value="">Select doctor</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>{doctor.name} · {doctor.department}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-500">A patient may have one consultation token per doctor each day.</p>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Scheme</label>
                <select
                  value={paymentSchemeType}
                  onChange={(e) => setPaymentSchemeType(e.target.value as PaymentSchemeType)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                >
                  <option value="Self-Pay">Self-Pay</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Discount Card">Discount Card</option>
                </select>
              </div>

              {paymentSchemeType === 'Insurance' && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={insuranceProvider}
                    onChange={(e) => setInsuranceProvider(e.target.value)}
                    placeholder="Insurance provider"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                  <input
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                    placeholder="Policy number"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  />
                </div>
              )}

              {paymentSchemeType === 'Discount Card' && (
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  placeholder="Discount percentage"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                />
              )}

              {/* Department & Service */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  >
                    <option value="Front Desk Registration">Front Desk Registration</option>
                    <option value="Billing & Claims Cashier">Billing & Claims Cashier</option>
                    <option value="Cardiovascular Care">Cardiovascular Care</option>
                    <option value="Neurosciences">Neurosciences</option>
                    <option value="Diagnostic Lab">Diagnostic Lab</option>
                    <option value="Pediatric Care">Pediatric Care</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Service Type</label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                  >
                    <option value="Consultation">Consultation</option>
                    <option value="Billing & Cashier">Billing & Cashier</option>
                    <option value="Insurance Authorisation">Insurance Authorisation</option>
                    <option value="Lab Sample">Lab Sample</option>
                    <option value="Report Collection">Report Collection</option>
                  </select>
                </div>
              </div>

              {/* Counter / Room */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Assigned Counter / Suite</label>
                <select
                  value={counterOrRoom}
                  onChange={(e) => setCounterOrRoom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                >
                  <option value="Counter 1 (Main Desk)">Counter 1 (Main Desk)</option>
                  <option value="Counter 2 (Cashier Desk A)">Counter 2 (Cashier Desk A)</option>
                  <option value="Desk A (Pre-Auth Desk)">Desk A (Pre-Auth Desk)</option>
                  <option value="Suite 108 (Pediatrics)">Suite 108 (Pediatrics)</option>
                  <option value="Suite 302 (Cardiology)">Suite 302 (Cardiology)</option>
                  <option value="Phlebotomy Room B">Phlebotomy Room B</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Queue Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Normal', 'VIP / Elderly', 'Urgent'] as const).map((pri) => (
                    <button
                      type="button"
                      key={pri}
                      onClick={() => setPriority(pri)}
                      className={`py-1.5 px-2 rounded-lg font-bold text-center border transition cursor-pointer ${
                        priority === pri
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {pri}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewTokenModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-sm cursor-pointer"
                >
                  Issue Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TokenWorkflowModal
        token={workflowToken ? receptionTokens.find((item) => item.id === workflowToken.id) || workflowToken : null}
        isOpen={Boolean(workflowToken)}
        onClose={() => setWorkflowToken(null)}
        onOpenPatientFile={(patientId) => {
          setWorkflowToken(null);
          addNotification('Patient File Ready', `Open patient record ${patientId} from the Patients EMR module.`, 'info');
        }}
      />
    </div>
  );
};
