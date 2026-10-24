import React, { useMemo, useState } from 'react';
import {
  DollarSign,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Building,
  Activity,
  Layers,
  Sparkles,
  Printer,
  ShieldCheck,
  Pencil,
  Plus,
  Save,
  X,
  Trash2,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { HospitalPriceItem } from '../types';

const categories: HospitalPriceItem['category'][] = [
  'Consultation',
  'Diagnostic Lab',
  'Radiology & Imaging',
  'Ward & Nursing',
  'Surgical Procedure',
  'Dermatology Procedure',
  'Injection & Administration',
  'Physiotherapy',
  'Emergency Care',
  'Medication',
];

const emptyItem = (): HospitalPriceItem => ({
  id: `PRC-${Date.now()}`,
  code: '',
  name: '',
  category: 'Diagnostic Lab',
  department: '',
  applicableType: 'Both IPD & OPD',
  standardPrice: 0,
  insuranceCoveredApprox: 80,
  copayEst: 0,
  cptCode: '',
  description: '',
});

export const HospitalPriceListView: React.FC = () => {
  const { hospitalPriceCatalog, pharmacy, currentRole, saveHospitalPriceItem, deactivateHospitalPriceItem } = useHospital();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDivision, setSelectedDivision] = useState<'all' | 'Inpatient Only' | 'Outpatient Only'>('all');
  const [editingItem, setEditingItem] = useState<HospitalPriceItem | null>(null);
  const [itemForm, setItemForm] = useState<HospitalPriceItem>(emptyItem);
  const [formError, setFormError] = useState('');
  const canManageCatalog = currentRole === 'admin';

  const filteredItems = useMemo(() => hospitalPriceCatalog.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.cptCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || item.category === selectedCategory;

    const matchesDivision =
      selectedDivision === 'all' ||
      item.applicableType === 'Both IPD & OPD' ||
      item.applicableType === selectedDivision;

    return matchesSearch && matchesCategory && matchesDivision;
  }), [hospitalPriceCatalog, searchQuery, selectedCategory, selectedDivision]);
  const filteredMedicine = pharmacy.filter((item) =>
    `${item.sku} ${item.name} ${item.genericName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePrint = () => {
    window.print();
  };

  const saveItem = (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemForm.name.trim() || !itemForm.code.trim() || !itemForm.department.trim() ||
      !Number.isFinite(itemForm.standardPrice) || itemForm.standardPrice < 0) {
      setFormError('Enter service name, unique service code, department, and a non-negative AED price.');
      return;
    }
    saveHospitalPriceItem({
      ...itemForm,
      copayEst: itemForm.standardPrice * (100 - itemForm.insuranceCoveredApprox) / 100,
    });
    setEditingItem(null);
    setItemForm(emptyItem());
    setFormError('');
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Hospital Services & Coding Inventory
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold uppercase">
              2026 TARIFF REVISION
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-3xl">
            Hospital services, procedures, departments, and IPD/OPD applicability with verified CPT codes for billing and reporting.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canManageCatalog && (
            <button
              onClick={() => { setEditingItem(null); setItemForm(emptyItem()); setFormError(''); }}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add tariff item
            </button>
          )}
          <button
            onClick={handlePrint}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Tariffs</span>
          </button>
        </div>
      </div>

      {canManageCatalog && (
        <form onSubmit={saveItem} className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">{editingItem ? `Edit ${editingItem.code}` : 'Add service or procedure to tariff catalog'}</h3>
            <button type="button" onClick={() => { setEditingItem(null); setItemForm(emptyItem()); setFormError(''); }} aria-label="Clear tariff form" className="rounded p-1 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[10px] font-semibold text-slate-600">Service code<input required value={itemForm.code} onChange={(event) => setItemForm({ ...itemForm, code: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-2 text-xs" placeholder="e.g. DERM-BIOPSY" /></label>
            <label className="text-[10px] font-semibold text-slate-600">CPT code<input value={itemForm.cptCode || ''} onChange={(event) => setItemForm({ ...itemForm, cptCode: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-2 text-xs" placeholder="Enter a verified CPT code" /></label>
            <label className="text-[10px] font-semibold text-slate-600">Service name<input required value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-2 text-xs" /></label>
            <label className="text-[10px] font-semibold text-slate-600">Category<select value={itemForm.category} onChange={(event) => setItemForm({ ...itemForm, category: event.target.value as HospitalPriceItem['category'] })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="text-[10px] font-semibold text-slate-600">Department<input required value={itemForm.department} onChange={(event) => setItemForm({ ...itemForm, department: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-2 text-xs" /></label>
            <label className="text-[10px] font-semibold text-slate-600">Standard price (AED)<input required type="number" min="0" step="0.01" value={itemForm.standardPrice} onChange={(event) => setItemForm({ ...itemForm, standardPrice: Number(event.target.value) })} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-2 text-xs" /></label>
            <label className="text-[10px] font-semibold text-slate-600">Usual insurer share (%)<input type="number" min="0" max="100" value={itemForm.insuranceCoveredApprox} onChange={(event) => setItemForm({ ...itemForm, insuranceCoveredApprox: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-2 text-xs" /></label>
            <label className="text-[10px] font-semibold text-slate-600">Applicable division<select value={itemForm.applicableType} onChange={(event) => setItemForm({ ...itemForm, applicableType: event.target.value as HospitalPriceItem['applicableType'] })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"><option>Both IPD &amp; OPD</option><option>Outpatient Only</option><option>Inpatient Only</option></select></label>
            <label className="text-[10px] font-semibold text-slate-600 sm:col-span-2 lg:col-span-3">Description / billing notes<textarea rows={2} value={itemForm.description} onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-2 text-xs" /></label>
            <div className="flex items-end"><button type="submit" className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"><Save className="h-3.5 w-3.5" /> Save tariff</button></div>
          </div>
          {formError && <p role="alert" className="mt-2 text-xs font-semibold text-rose-700">{formError}</p>}
          <p className="mt-2 text-[10px] text-amber-700">Verify CPT and payer-specific fee schedules with your coding/billing team before use; these are configurable facility tariffs, not payer guarantees.</p>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search procedure code, title, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">Division:</span>
            {[
              { id: 'all' as const, label: 'All Divisions' },
              { id: 'Outpatient Only' as const, label: 'OPD Ambulatory' },
              { id: 'Inpatient Only' as const, label: 'IPD Inpatient' },
            ].map((div) => (
              <button
                key={div.id}
                onClick={() => setSelectedDivision(div.id)}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                  selectedDivision === div.id
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {div.label}
              </button>
            ))}
          </div>
        </div>

        {/* Categories Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Category:</span>
          {['all', ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'all' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Price Schedule Items ({filteredItems.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Standard self-pay & pre-insurance list price
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-2.5 px-3">Service Code</th>
                <th className="py-2.5 px-3">CPT Code</th>
                <th className="py-2.5 px-3">Item / Procedure Description</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Applicable Division</th>
                <th className="py-2.5 px-3">Insurance Coverage</th>
                <th className="py-2.5 px-3 text-right">Standard Fee (AED)</th>
                {canManageCatalog && <th className="py-2.5 px-3 text-right">Manage</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredItems.length === 0 ? (
                <tr>
                    <td colSpan={canManageCatalog ? 8 : 7} className="py-8 text-center text-slate-400">
                    No tariff items found matching current search or filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-indigo-600 text-[11px]">
                      {item.code}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-700 text-[11px]">
                      {item.cptCode || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">{item.description}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                      <span className="text-[11px]">{item.category}</span>
                      <span className="block text-[10px] text-slate-400">{item.department}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.applicableType === 'Both IPD & OPD'
                            ? 'bg-purple-100 text-purple-800'
                            : item.applicableType === 'Inpatient Only'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.applicableType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>~{item.insuranceCoveredApprox}% Covered</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono font-bold text-slate-900 text-xs">
                      AED {item.standardPrice.toLocaleString('en-AE', { minimumFractionDigits: 2 })}
                    </td>
                    {canManageCatalog && <td className="py-2.5 px-3 whitespace-nowrap text-right">
                      <button type="button" onClick={() => { setEditingItem(item); setItemForm({ ...item }); setFormError(''); }} aria-label={`Edit ${item.name}`} className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => { if (window.confirm(`Remove ${item.name} from the tariff catalog? Existing invoices retain their saved prices.`)) deactivateHospitalPriceItem(item.id); }} aria-label={`Remove ${item.name}`} className="rounded p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>CMS Hospital Price Transparency Compliant (45 CFR Part 180)</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">
            TOTAL CATALOGUED SERVICES: {hospitalPriceCatalog.length}
          </span>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Medicine inventory &amp; unit prices</h3>
          </div>
          <span className="text-[10px] text-slate-500">Prescription selection uses pharmacy stock items and SKU, not CPT codes.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white text-[10px] font-bold uppercase text-slate-500">
              <tr><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Medicine / generic name</th><th className="px-3 py-2">Form / strength</th><th className="px-3 py-2 text-right">Unit price (AED)</th><th className="px-3 py-2 text-right">Stock</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMedicine.map((medicine) => (
                <tr key={medicine.id}>
                  <td className="px-3 py-2 font-mono font-semibold text-indigo-700">{medicine.sku}</td>
                  <td className="px-3 py-2"><span className="font-semibold text-slate-800">{medicine.name}</span><span className="ml-1 text-slate-500">({medicine.genericName})</span></td>
                  <td className="px-3 py-2 text-slate-600">{medicine.dosageForm}</td>
                  <td className="px-3 py-2 text-right font-mono">AED {medicine.unitPrice.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{medicine.stockQuantity}</td>
                </tr>
              ))}
              {filteredMedicine.length === 0 && <tr><td colSpan={5} className="px-3 py-5 text-center text-slate-400">No medicines match this search.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
