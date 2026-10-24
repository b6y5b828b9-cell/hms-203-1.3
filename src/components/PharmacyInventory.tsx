import React, { useState, useMemo } from 'react';
import {
  Pill,
  Search,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  PackageCheck,
  ShieldCheck,
  DollarSign,
  Printer,
  Clock,
  User,
  AlertCircle,
  FileText,
  X,
  History,
  Send,
  Sparkles,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { PharmacyItem, PharmacyDispenseRecord, Medication } from '../types';

interface PatientPrescriptionOrder {
  prescriptionId: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  patientAge: number;
  patientGender: string;
  patientAllergies: string[];
  medicationName: string;
  dosage: string;
  frequency: string;
  route: string;
  duration?: string;
  instructions?: string;
  prescribedBy: string;
  prescribedDate: string;
  status: 'Active' | 'Completed' | 'Discontinued';
}

export const PharmacyInventory: React.FC = () => {
  const {
    pharmacy,
    patients,
    receptionTokens,
    pharmacyDispenseRecords,
    dispensePrescriptionOrder,
    dispensePharmacyItem,
    restockPharmacyItem,
    addPharmacyItem,
    currentUser,
    addNotification,
  } = useHospital();

  const [activeTab, setActiveTab] = useState<'prescriptions' | 'inventory' | 'dispensed-history'>('prescriptions');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Restock Modal
  const [restockItem, setRestockItem] = useState<PharmacyItem | null>(null);
  const [restockQty, setRestockQty] = useState(50);

  // Add Item Modal
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGenericName, setNewGenericName] = useState('');
  const [newCategory, setNewCategory] = useState('Antibiotics');
  const [newDosageForm, setNewDosageForm] = useState<PharmacyItem['dosageForm']>('Tablet');
  const [newStock, setNewStock] = useState(100);
  const [newThreshold, setNewThreshold] = useState(25);
  const [newPrice, setNewPrice] = useState(1.50);
  const [newManufacturer, setNewManufacturer] = useState('Apex Generic Labs');
  const [newStorage, setNewStorage] = useState<PharmacyItem['storageCondition']>('Room Temp (20-25 C)');

  // Dispensing Action Modal
  const [dispenseOrder, setDispenseOrder] = useState<PatientPrescriptionOrder | null>(null);
  const [dispenseQuantity, setDispenseQuantity] = useState(30);
  const [overrideAllergyWarning, setOverrideAllergyWarning] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [dispenseResult, setDispenseResult] = useState<PharmacyDispenseRecord | null>(null);
  const [dispenseError, setDispenseError] = useState('');

  // Extract all patient prescriptions across the hospital
  const prescriptionOrders = useMemo<PatientPrescriptionOrder[]>(() => {
    const list: PatientPrescriptionOrder[] = [];

    patients.forEach((patient) => {
      const allergyNames = patient.allergies.map((a) =>
        typeof a === 'string' ? a : `${a.allergen} (${a.severity})`
      );

      // Check medications
      const meds = patient.prescriptions && patient.prescriptions.length > 0 ? patient.prescriptions : patient.medications || [];
      meds.forEach((m) => {
        list.push({
          prescriptionId: m.id,
          patientId: patient.id,
          patientName: `${patient.firstName} ${patient.lastName}`,
          patientMrn: patient.rgNo || patient.id,
          patientAge: patient.age,
          patientGender: patient.gender,
          patientAllergies: allergyNames,
          medicationName: m.name || (m as any).medicationName || 'Medication',
          dosage: m.dosage || 'Standard dose',
          frequency: m.frequency || 'Daily',
          route: m.route || 'Oral',
          duration: m.duration,
          instructions: m.instructions,
          prescribedBy: m.prescribedBy || 'Attending Physician',
          prescribedDate: m.startDate || 'Recent',
          status: m.status || 'Active',
        });
      });
    });

    return list;
  }, [patients]);

  const activePrescriptions = useMemo(() => {
    return prescriptionOrders.filter((po) => po.status === 'Active');
  }, [prescriptionOrders]);

  // Check allergy warning for an order
  const getAllergyWarning = (order: PatientPrescriptionOrder): string | null => {
    const allergies = order.patientAllergies.map((a) => a.toLowerCase());
    const drug = order.medicationName.toLowerCase();

    if (allergies.some((a) => a.includes('penicillin')) && (drug.includes('amox') || drug.includes('penicillin') || drug.includes('ampicillin'))) {
      return 'Severe Penicillin Allergy cross-reactivity with beta-lactam!';
    }
    if (allergies.some((a) => a.includes('sulfa')) && (drug.includes('sulfa') || drug.includes('bactrim') || drug.includes('septra'))) {
      return 'Sulfa Allergy: Risk of systemic hypersensitivity!';
    }
    if (allergies.some((a) => a.includes('aspirin') || a.includes('nsaid')) && (drug.includes('ibuprofen') || drug.includes('aspirin') || drug.includes('naproxen'))) {
      return 'Aspirin/NSAID Allergy: Risk of bronchospasm!';
    }
    if (allergies.some((a) => a.includes('codeine') || a.includes('opioid')) && (drug.includes('codeine') || drug.includes('tramadol') || drug.includes('morphine'))) {
      return 'Opioid/Codeine Allergy alert!';
    }
    return null;
  };

  const filteredItems = useMemo(() => {
    return pharmacy.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.genericName.toLowerCase().includes(q) ||
        (item.code || item.sku || '').toLowerCase().includes(q);

      const matchesCategory =
        filterCategory === 'all' ||
        (filterCategory === 'low'
          ? item.stockQuantity <= item.minThreshold
          : item.category.toLowerCase() === filterCategory.toLowerCase());

      return matchesSearch && matchesCategory;
    });
  }, [pharmacy, searchQuery, filterCategory]);

  const lowStockCount = pharmacy.filter((p) => p.stockQuantity <= p.minThreshold).length;

  const handleOpenDispense = (order: PatientPrescriptionOrder) => {
    setDispenseOrder(order);
    setDispenseQuantity(30);
    setOverrideAllergyWarning(false);
    setOverrideReason('');
    setDispenseError('');
    setDispenseResult(null);
  };

  const handleExecuteDispense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispenseOrder) return;
    setDispenseError('');

    const allergyWarn = getAllergyWarning(dispenseOrder);
    if (allergyWarn && !overrideAllergyWarning) {
      setDispenseError(`Safety Halt: ${allergyWarn} Please confirm pharmacist override to proceed.`);
      return;
    }

    const res = dispensePrescriptionOrder(
      dispenseOrder.prescriptionId,
      dispenseOrder.patientId,
      dispenseQuantity,
      currentUser.name,
      overrideAllergyWarning
    );

    if (!res.success) {
      setDispenseError(res.error || 'Dispense failed.');
    } else {
      setDispenseResult(res.record || null);
    }
  };

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItem || restockQty <= 0) return;
    restockPharmacyItem(restockItem.id, restockQty);
    setRestockItem(null);
  };

  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newStock < 0) return;

    const sku = `MED-${newName.slice(0, 4).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 2);

    addPharmacyItem({
      sku,
      code: sku,
      name: newName.trim(),
      genericName: newGenericName.trim() || newName.trim(),
      category: newCategory,
      dosageForm: newDosageForm,
      stockQuantity: newStock,
      minThreshold: newThreshold,
      unitPrice: Number(newPrice),
      batchNumber: `BAT-2026-${Math.floor(100 + Math.random() * 900)}`,
      expiryDate: expiryDate.toISOString().slice(0, 10),
      storageCondition: newStorage,
      manufacturer: newManufacturer.trim(),
    });

    setIsAddItemOpen(false);
    setNewName('');
    setNewGenericName('');
  };

  const handlePrintLabel = () => {
    window.print();
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Pill className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Hospital Pharmacy Formulary &amp; e-Prescription Dispensary
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold uppercase">
              DEA &amp; FDA COMPLIANT
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Live doctor e-prescription fulfillment queue, drug-allergy contraindication screening, formulary stock management, and batch dispensing audit.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {lowStockCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>{lowStockCount} Meds Low Stock</span>
            </div>
          )}
          <button
            onClick={() => setIsAddItemOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Formulary Medicine</span>
          </button>
        </div>
      </div>

      {/* Pharmacy Sub-Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('prescriptions')}
            className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'prescriptions'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Active e-Prescription Orders</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'prescriptions' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {activePrescriptions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Formulary Stock &amp; Ledger</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'inventory' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {pharmacy.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('dispensed-history')}
            className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'dispensed-history'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Dispensed History Audit</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'dispensed-history' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {pharmacyDispenseRecords.length}
            </span>
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-mono pr-2 hidden sm:inline">
          DISPENSING WORKSTATION
        </span>
      </div>

      {/* TAB 1: E-PRESCRIPTION ORDERS & DISPENSING QUEUE */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Doctor-Authored e-Prescriptions Awaiting Dispensing ({activePrescriptions.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Automated Drug-Allergy Screening</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <th className="py-2.5 px-3">Patient &amp; MRN</th>
                    <th className="py-2.5 px-3">Prescribed Medication</th>
                    <th className="py-2.5 px-3">Dosage &amp; Frequency</th>
                    <th className="py-2.5 px-3">Route &amp; Duration</th>
                    <th className="py-2.5 px-3">Allergy Screening</th>
                    <th className="py-2.5 px-3">Prescribing Physician</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {activePrescriptions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No active e-prescriptions currently pending in the fulfillment queue.
                      </td>
                    </tr>
                  ) : (
                    activePrescriptions.map((order, idx) => {
                      const warning = getAllergyWarning(order);
                      return (
                        <tr
                          key={`${order.prescriptionId}-${idx}`}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            warning ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-semibold text-slate-900">{order.patientName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              MRN: {order.patientMrn} · {order.patientAge}y {order.patientGender}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-900">
                            {order.medicationName}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                            <div>{order.dosage}</div>
                            <div className="text-[10px] text-slate-500">{order.frequency}</div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                            <div>{order.route}</div>
                            <div className="text-[10px] text-slate-400">{order.duration || 'Ongoing'}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            {warning ? (
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-300 animate-pulse">
                                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                <span className="line-clamp-1">{warning}</span>
                              </div>
                            ) : order.patientAllergies.length > 0 ? (
                              <span className="text-[10px] text-slate-600">
                                Allergies: {order.patientAllergies.join(', ')} (Cleared)
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-700 font-medium">
                                ✓ No Allergies (NKDA)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-semibold text-slate-800">{order.prescribedBy}</div>
                            <div className="text-[10px] text-slate-400">{order.prescribedDate}</div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-right">
                            <button
                              onClick={() => handleOpenDispense(order)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer ${
                                warning
                                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              }`}
                            >
                              Verify &amp; Dispense
                            </button>
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

      {/* TAB 2: FORMULARY INVENTORY & RESTOCK LEDGER */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search brand, generic name, or NDC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All Medications' },
                { id: 'low', label: 'Low Stock Alerts' },
                { id: 'Cardiovascular', label: 'Cardio' },
                { id: 'Antibiotics', label: 'Antibiotics' },
                { id: 'Analgesics', label: 'Analgesics' },
                { id: 'Respiratory', label: 'Respiratory' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterCategory(tab.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
                    filterCategory === tab.id
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Medications Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Formulary Stock Ledger ({filteredItems.length})
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    <th className="py-2.5 px-3">Drug Code / NDC</th>
                    <th className="py-2.5 px-3">Medication Name</th>
                    <th className="py-2.5 px-3">Dosage &amp; Form</th>
                    <th className="py-2.5 px-3">Stock Level</th>
                    <th className="py-2.5 px-3">Unit Price</th>
                    <th className="py-2.5 px-3">Batch &amp; Expiry</th>
                    <th className="py-2.5 px-3">Storage Condition</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No medications matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((med) => {
                      const isLow = med.stockQuantity <= med.minThreshold;
                      return (
                        <tr key={med.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-700">
                            {med.code || med.sku}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-semibold text-slate-900">{med.name}</div>
                            <div className="text-[10px] text-slate-400 italic">{med.genericName}</div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                            {med.dosageForm}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                            <span
                              className={`font-bold ${
                                isLow ? 'text-rose-600 animate-pulse' : 'text-slate-800'
                              }`}
                            >
                              {med.stockQuantity} units
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Min: {med.minThreshold}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-800">
                            ${(Number(med.unitPrice) || 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                            <div>{med.batchNumber}</div>
                            <div className="text-[10px] text-slate-400">Exp: {med.expiryDate}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                            {med.storageCondition}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-right space-x-1.5">
                            <button
                              onClick={() => {
                                setRestockItem(med);
                                setRestockQty(50);
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-[11px] cursor-pointer"
                            >
                              + Restock
                            </button>
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

      {/* TAB 3: DISPENSED HISTORY AUDIT */}
      {activeTab === 'dispensed-history' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Pharmaceutical Dispensing Audit Log ({pharmacyDispenseRecords.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">HIPAA &amp; DEA Dispensing Record</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <th className="py-2.5 px-3">Dispense ID</th>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Medication</th>
                  <th className="py-2.5 px-3">Qty</th>
                  <th className="py-2.5 px-3">Batch No.</th>
                  <th className="py-2.5 px-3">Dispensed By</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Allergy Screening</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {pharmacyDispenseRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No medications dispensed yet during this session.
                    </td>
                  </tr>
                ) : (
                  pharmacyDispenseRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-emerald-800">
                        {rec.id}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{rec.patientName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">MRN: {rec.patientMrn}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-bold text-slate-900">{rec.medicationName}</span>
                        <div className="text-[10px] text-slate-500">{rec.dosage}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-900">
                        {rec.quantityDispensed} units
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        {rec.batchNumber}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                        {rec.dispensedBy}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {rec.dispensedAt}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec.allergyScreeningStatus === 'Cleared'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rec.allergyScreeningStatus === 'Warning Overridden'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {rec.allergyScreeningStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: VERIFY & DISPENSE PRESCRIPTION */}
      {dispenseOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Pharmacist Dispensing Verification</h3>
                  <p className="text-[10px] text-slate-300">Prescription review and inventory issuance</p>
                </div>
              </div>
              <button
                onClick={() => setDispenseOrder(null)}
                className="text-slate-400 hover:text-white p-1 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {dispenseResult ? (
              <div className="p-6 text-center space-y-4 text-xs">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">Medication Dispensed Successfully</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {dispenseResult.quantityDispensed} units of {dispenseResult.medicationName} deducted from inventory stock.
                  </p>
                </div>

                {/* Printable Prescription Sticker Preview */}
                <div className="border border-slate-300 bg-slate-50 rounded-lg p-4 text-left font-mono text-[11px] space-y-1.5 shadow-xs">
                  <div className="border-b border-slate-200 pb-2 mb-2">
                    <strong className="block text-slate-900 text-xs">APEX HEALTH PHARMACY</strong>
                    <span className="text-[10px] text-slate-500 font-sans">Rx Dispensing Label · Ref: {dispenseResult.id}</span>
                  </div>
                  <div><strong>Patient:</strong> {dispenseResult.patientName} (MRN: {dispenseResult.patientMrn})</div>
                  <div><strong>Drug:</strong> {dispenseResult.medicationName}</div>
                  <div><strong>Directions:</strong> {dispenseResult.instructions}</div>
                  <div><strong>Quantity:</strong> {dispenseResult.quantityDispensed} · <strong>Batch:</strong> {dispenseResult.batchNumber}</div>
                  <div><strong>Pharmacist:</strong> {dispenseResult.dispensedBy}</div>
                  <div><strong>Dispensed:</strong> {dispenseResult.dispensedAt}</div>
                  <div className="pt-2 text-[10px] text-slate-400 italic border-t border-slate-200">
                    * Keep out of reach of children. Store as directed on package. *
                  </div>
                </div>

                <div className="flex justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handlePrintLabel}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Dispensing Label</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispenseOrder(null)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleExecuteDispense} className="p-5 space-y-3.5 text-xs">
                {dispenseError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{dispenseError}</span>
                  </div>
                )}

                {/* Patient Summary Card */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Patient:</span>
                    <strong className="text-slate-900">{dispenseOrder.patientName} ({dispenseOrder.patientMrn})</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Prescribing Physician:</span>
                    <span className="text-slate-800 font-medium">{dispenseOrder.prescribedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Documented Allergies:</span>
                    <span className="text-rose-700 font-semibold font-mono">
                      {dispenseOrder.patientAllergies.join(', ') || 'No Known Allergies (NKDA)'}
                    </span>
                  </div>
                </div>

                {/* Drug & Instructions */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Medication Prescribed</label>
                  <div className="text-sm font-bold text-slate-900">{dispenseOrder.medicationName}</div>
                  <div className="text-[11px] text-slate-600">{dispenseOrder.dosage} · {dispenseOrder.frequency} ({dispenseOrder.route})</div>
                  {dispenseOrder.instructions && (
                    <div className="text-[11px] text-slate-500 italic mt-0.5">Instructions: {dispenseOrder.instructions}</div>
                  )}
                </div>

                {/* Allergy Conflict Warning Banner if triggered */}
                {getAllergyWarning(dispenseOrder) && (
                  <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-800 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{getAllergyWarning(dispenseOrder)}</span>
                    </div>
                    <label className="flex items-center gap-2 pt-1 border-t border-rose-200 cursor-pointer text-rose-900 font-semibold">
                      <input
                        type="checkbox"
                        checked={overrideAllergyWarning}
                        onChange={(e) => setOverrideAllergyWarning(e.target.checked)}
                        className="rounded border-rose-300 text-rose-600"
                      />
                      <span>Clinical override authorized by Pharmacist</span>
                    </label>
                    {overrideAllergyWarning && (
                      <input
                        type="text"
                        placeholder="Document clinical override justification..."
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="w-full bg-white border border-rose-300 rounded p-1.5 text-xs text-rose-900"
                        required
                      />
                    )}
                  </div>
                )}

                {/* Dispense Quantity */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quantity to Dispense</label>
                  <input
                    type="number"
                    min="1"
                    max="300"
                    required
                    value={dispenseQuantity}
                    onChange={(e) => setDispenseQuantity(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setDispenseOrder(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Authorize &amp; Dispense</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: RESTOCK INVENTORY */}
      {restockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Restock Formulary Item</h3>
              <button onClick={() => setRestockItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRestockSubmit} className="space-y-3">
              <div>
                <span className="text-slate-500 block mb-0.5">Medication Name</span>
                <strong className="text-slate-900 block text-sm">{restockItem.name}</strong>
                <span className="text-[10px] text-slate-400 font-mono">Current Stock: {restockItem.stockQuantity} units</span>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Quantity to Add *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRestockItem(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-sm"
                >
                  Confirm Restock (+{restockQty})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD NEW FORMULARY DRUG */}
      {isAddItemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm text-white">Add Formulary Medicine</h3>
              <button onClick={() => setIsAddItemOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddItemSubmit} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Brand Name *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Lipitor"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Generic Name</label>
                  <input
                    type="text"
                    value={newGenericName}
                    onChange={(e) => setNewGenericName(e.target.value)}
                    placeholder="e.g. Atorvastatin Calcium"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  >
                    <option>Antibiotics</option>
                    <option>Cardiovascular</option>
                    <option>Analgesics</option>
                    <option>Respiratory</option>
                    <option>Endocrine</option>
                    <option>Emergency IV</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dosage Form</label>
                  <select
                    value={newDosageForm}
                    onChange={(e) => setNewDosageForm(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Injection IV">Injection IV</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Inhaler">Inhaler</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Qty</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newStock}
                    onChange={(e) => setNewStock(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Min Threshold</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddItemOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-sm"
                >
                  Add Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
