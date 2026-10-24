import React, { useState, useMemo } from 'react';
import {
  Droplet,
  Search,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Calendar,
  Layers,
  Activity,
  Heart,
  X,
  User,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { BloodUnit, BloodGroup, BloodComponent } from '../types';

export const BloodBankRegistry: React.FC = () => {
  const {
    patients,
    bloodUnits,
    reserveBloodUnit,
    releaseBloodUnit,
    addBloodUnit,
    addNotification,
    currentUser,
  } = useHospital();

  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [selectedComponentFilter, setSelectedComponentFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Crossmatch Checker State
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || '');
  const [checkerComponent, setCheckerComponent] = useState<BloodComponent>('Packed Red Blood Cells (PRBC)');
  const [printingUnit, setPrintingUnit] = useState<BloodUnit | null>(null);

  // New Blood Unit Modal State
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [newBloodGroup, setNewBloodGroup] = useState<BloodGroup>('O+');
  const [newComponent, setNewComponent] = useState<BloodComponent>('Packed Red Blood Cells (PRBC)');
  const [newVolume, setNewVolume] = useState(350);
  const [newLocation, setNewLocation] = useState('Blood Bank Refrigerator #1 (4°C)');
  const [newDonorId, setNewDonorId] = useState(`DNR-${Math.floor(1000 + Math.random() * 9000)}`);
  const [newDaysToExpiry, setNewDaysToExpiry] = useState(35);

  const bloodGroups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const components: BloodComponent[] = [
    'Packed Red Blood Cells (PRBC)',
    'Fresh Frozen Plasma (FFP)',
    'Platelet Concentrate (RDP)',
    'Cryoprecipitate',
  ];

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  // Compatibility Rule Matrix
  const isCompatibleRbc = (donor: BloodGroup, recipient: BloodGroup): boolean => {
    // Red Blood Cells:
    // O- can give to all
    // O+ can give to O+, A+, B+, AB+
    // A- can give to A-, A+, AB-, AB+
    // A+ can give to A+, AB+
    // B- can give to B-, B+, AB-, AB+
    // B+ can give to B+, AB+
    // AB- can give to AB-, AB+
    // AB+ can give to AB+ only
    const compatibilityMap: Record<BloodGroup, BloodGroup[]> = {
      'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
      'O+': ['O+', 'A+', 'B+', 'AB+'],
      'A-': ['A-', 'A+', 'AB-', 'AB+'],
      'A+': ['A+', 'AB+'],
      'B-': ['B-', 'B+', 'AB-', 'AB+'],
      'B+': ['B+', 'AB+'],
      'AB-': ['AB-', 'AB+'],
      'AB+': ['AB+'],
      'Unknown': [],
    };
    return (compatibilityMap[donor] || []).includes(recipient);
  };

  const isCompatiblePlasma = (donor: BloodGroup, recipient: BloodGroup): boolean => {
    // Plasma (FFP) reverse rules:
    // AB is universal plasma donor
    // A can donate to A, O
    // B can donate to B, O
    // O can donate to O only
    const cleanDonor = donor.replace(/[+-]/g, '');
    const cleanRecipient = recipient.replace(/[+-]/g, '');
    if (cleanDonor === 'AB') return true;
    if (cleanDonor === 'A') return cleanRecipient === 'A' || cleanRecipient === 'O';
    if (cleanDonor === 'B') return cleanRecipient === 'B' || cleanRecipient === 'O';
    if (cleanDonor === 'O') return cleanRecipient === 'O';
    return false;
  };

  const checkCompatibility = (unit: BloodUnit, recipientGroup: BloodGroup): { compatible: boolean; rationale: string } => {
    if (recipientGroup === 'Unknown') {
      return { compatible: false, rationale: 'Recipient blood group unknown. Type & screen required first.' };
    }
    if (unit.component === 'Fresh Frozen Plasma (FFP)') {
      const compatible = isCompatiblePlasma(unit.bloodGroup, recipientGroup);
      return {
        compatible,
        rationale: compatible
          ? `Plasma safe: Donor ${unit.bloodGroup} lacks antibodies against recipient ${recipientGroup} antigens.`
          : `ABO Incompatible Plasma: Anti-A / Anti-B antibodies in ${unit.bloodGroup} plasma will hemolyze recipient ${recipientGroup} cells.`,
      };
    }
    // Red Blood Cells & Platelets
    const compatible = isCompatibleRbc(unit.bloodGroup, recipientGroup);
    return {
      compatible,
      rationale: compatible
        ? `RBC Compatible: Recipient ${recipientGroup} lacks anti-donor antibodies against ${unit.bloodGroup} antigens.`
        : `CRITICAL INCOMPATIBILITY: Major ABO/Rh mismatch! Recipient circulating antibodies will trigger acute hemolytic reaction against ${unit.bloodGroup} cells.`,
    };
  };

  const filteredUnits = useMemo(() => {
    return bloodUnits.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.unitId.toLowerCase().includes(q) ||
        u.bloodGroup.toLowerCase().includes(q) ||
        u.component.toLowerCase().includes(q) ||
        (u.reservedForPatientName && u.reservedForPatientName.toLowerCase().includes(q));

      const matchesGroup = selectedGroupFilter === 'all' || u.bloodGroup === selectedGroupFilter;
      const matchesComponent = selectedComponentFilter === 'all' || u.component === selectedComponentFilter;
      const matchesStatus = selectedStatusFilter === 'all' || u.status === selectedStatusFilter;

      return matchesSearch && matchesGroup && matchesComponent && matchesStatus;
    });
  }, [bloodUnits, searchQuery, selectedGroupFilter, selectedComponentFilter, selectedStatusFilter]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    bloodGroups.forEach((bg) => {
      counts[bg] = bloodUnits.filter((u) => u.bloodGroup === bg && u.status === 'Available').length;
    });
    return counts;
  }, [bloodUnits]);

  const handleAddUnitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date();
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + newDaysToExpiry);

    addBloodUnit({
      bloodGroup: newBloodGroup,
      component: newComponent,
      volumeMl: newVolume,
      collectionDate: today.toISOString().slice(0, 10),
      expiryDate: expiry.toISOString().slice(0, 10),
      storageLocation: newLocation,
      status: 'Available',
      donorId: newDonorId,
    });

    setIsAddUnitOpen(false);
  };

  const handlePrintTag = (unit: BloodUnit) => {
    setPrintingUnit(unit);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <Droplet className="w-4 h-4 text-rose-600 fill-rose-600" />
            </div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Hospital Blood Bank &amp; Transfusion Crossmatch Registry
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold uppercase">
              AABB / CAP COMPLIANT
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Donor component inventory (PRBC, FFP, Platelets, Cryo), automated ABO/Rh compatibility testing, surgical case blood reservation, and bedside transfusion crossmatch verification.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsAddUnitOpen(true)}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Register Donated Blood Unit</span>
          </button>
        </div>
      </div>

      {/* Blood Group Inventory Quick Strip */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {bloodGroups.map((bg) => {
          const avail = groupCounts[bg] || 0;
          const isLow = avail <= 1;
          return (
            <button
              key={bg}
              type="button"
              onClick={() => setSelectedGroupFilter(selectedGroupFilter === bg ? 'all' : bg)}
              className={`p-3 rounded-xl border transition text-center cursor-pointer ${
                selectedGroupFilter === bg
                  ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`font-mono font-black text-sm ${selectedGroupFilter === bg ? 'text-white' : 'text-rose-600'}`}>
                {bg}
              </div>
              <div className={`text-lg font-bold font-mono mt-0.5 ${selectedGroupFilter === bg ? 'text-white' : 'text-slate-900'}`}>
                {avail}
              </div>
              <span
                className={`text-[9px] font-semibold block uppercase ${
                  selectedGroupFilter === bg
                    ? 'text-rose-100'
                    : isLow
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {avail === 0 ? 'Depleted' : isLow ? 'Low Stock' : 'Ready'}
              </span>
            </button>
          );
        })}
      </div>

      {/* INTERACTIVE CROSSMATCH COMPATIBILITY CHECKER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Interactive Transfusion Crossmatch Compatibility Tester</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                  REAL-TIME SAFETY ENGINE
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Verify recipient antibodies vs donor antigen compatibility before blood release.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-slate-400 font-semibold block mb-1">Recipient Patient *</label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-medium focus:ring-2 focus:ring-rose-500"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} (MRN: {p.rgNo || p.id}) — Group: {p.bloodGroup}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-400 font-semibold block mb-1">Target Transfusion Component *</label>
            <select
              value={checkerComponent}
              onChange={(e) => setCheckerComponent(e.target.value as BloodComponent)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white font-medium focus:ring-2 focus:ring-rose-500"
            >
              <option value="Packed Red Blood Cells (PRBC)">Packed Red Blood Cells (PRBC)</option>
              <option value="Fresh Frozen Plasma (FFP)">Fresh Frozen Plasma (FFP)</option>
              <option value="Platelet Concentrate (RDP)">Platelet Concentrate (RDP)</option>
            </select>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Recipient Blood Group</span>
              <span className="text-xl font-bold font-mono text-rose-400">{selectedPatient.bloodGroup}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Universal RBC Match:</span>
              <span className="text-xs font-mono font-bold text-slate-300">
                {selectedPatient.bloodGroup === 'AB+' ? 'Universal Recipient (All)' : 'O- (Universal Donor)'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Compatible Available Units List */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300">
              Compatible Units in Blood Bank Inventory for {selectedPatient.firstName} {selectedPatient.lastName} ({selectedPatient.bloodGroup}):
            </span>
            <span className="text-[11px] text-emerald-400 font-mono font-semibold">
              {
                bloodUnits.filter(
                  (u) =>
                    u.component === checkerComponent &&
                    u.status === 'Available' &&
                    checkCompatibility(u, selectedPatient.bloodGroup).compatible
                ).length
              }{' '}
              Verified Units Safe for Transfusion
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
            {bloodUnits
              .filter((u) => u.component === checkerComponent)
              .map((unit) => {
                const comp = checkCompatibility(unit, selectedPatient.bloodGroup);
                const isAvailable = unit.status === 'Available';
                const isReservedForThisPatient = unit.reservedForPatientId === selectedPatient.id;

                return (
                  <div
                    key={unit.unitId}
                    className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between transition-all ${
                      comp.compatible
                        ? 'bg-slate-800/90 border-emerald-500/50'
                        : 'bg-rose-950/30 border-rose-500/40 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-white text-xs">{unit.unitId}</span>
                        <span
                          className={`font-mono text-xs font-black px-1.5 py-0.2 rounded ${
                            comp.compatible ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {unit.bloodGroup}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 truncate">{unit.component}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Vol: {unit.volumeMl}mL · Exp: {unit.expiryDate}
                      </div>
                      <div className="text-[10px] mt-1 font-semibold flex items-center gap-1">
                        {comp.compatible ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Safe Crossmatch
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Incompatible
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-700/80 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">{unit.status}</span>
                      {isAvailable && comp.compatible && (
                        <button
                          type="button"
                          onClick={() =>
                            reserveBloodUnit(
                              unit.unitId,
                              selectedPatient.id,
                              `${selectedPatient.firstName} ${selectedPatient.lastName}`
                            )
                          }
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold text-[10px] transition cursor-pointer"
                        >
                          Reserve Unit
                        </button>
                      )}
                      {isReservedForThisPatient && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => releaseBloodUnit(unit.unitId)}
                            className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded font-semibold text-[10px] transition cursor-pointer"
                          >
                            Release
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintTag(unit)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] flex items-center gap-0.5"
                          >
                            <Printer className="w-2.5 h-2.5" /> Tag
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col sm:flex-row gap-3 items-center justify-between text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search unit #, blood group, component, patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg py-1.5 pl-8 pr-3 text-xs focus:ring-2 focus:ring-rose-500/20 text-slate-800"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={selectedComponentFilter}
            onChange={(e) => setSelectedComponentFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 text-xs font-medium text-slate-700"
          >
            <option value="all">All Components</option>
            {components.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 text-xs font-medium text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="Available">Available</option>
            <option value="Reserved">Reserved</option>
            <option value="Crossmatched">Crossmatched</option>
            <option value="Transfused">Transfused</option>
          </select>
        </div>
      </div>

      {/* Inventory Units Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Droplet className="w-4 h-4 text-rose-600 fill-rose-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Blood Bank Component Inventory ({filteredUnits.length} Units)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Cold-Chain Temperature Controlled</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/75 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                <th className="py-2.5 px-3">Unit ID</th>
                <th className="py-2.5 px-3">Group &amp; Rh</th>
                <th className="py-2.5 px-3">Component Type</th>
                <th className="py-2.5 px-3">Volume</th>
                <th className="py-2.5 px-3">Storage Location</th>
                <th className="py-2.5 px-3">Expiry Date</th>
                <th className="py-2.5 px-3">Status / Reserved For</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No blood units found matching current filter.
                  </td>
                </tr>
              ) : (
                filteredUnits.map((u) => {
                  const isAvailable = u.status === 'Available';
                  const isReserved = u.status === 'Reserved';
                  return (
                    <tr key={u.unitId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-slate-900">
                        {u.unitId}
                        <div className="text-[10px] text-slate-400 font-normal">Donor: {u.donorId}</div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          {u.bloodGroup}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-800">
                        {u.component}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                        {u.volumeMl} mL
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        {u.storageLocation}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600">
                        {u.expiryDate}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isAvailable
                              ? 'bg-emerald-100 text-emerald-800'
                              : isReserved
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {u.status}
                        </span>
                        {u.reservedForPatientName && (
                          <div className="text-[10px] text-slate-600 mt-0.5">
                            For: <strong>{u.reservedForPatientName}</strong>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-right space-x-1">
                        <button
                          onClick={() => handlePrintTag(u)}
                          title="Print Transfusion Verification Tag"
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Tag</span>
                        </button>
                        {isReserved && (
                          <button
                            onClick={() => releaseBloodUnit(u.unitId)}
                            className="px-2 py-1 bg-slate-100 hover:bg-rose-50 text-rose-700 rounded text-xs font-semibold cursor-pointer"
                          >
                            Release
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: REGISTER DONATED BLOOD UNIT */}
      {isAddUnitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                  <Droplet className="w-4 h-4 fill-rose-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Register Donated Blood Unit</h3>
                  <p className="text-[10px] text-slate-300">Catalog screened donor component into inventory</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddUnitOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddUnitSubmit} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Blood Group *</label>
                  <select
                    value={newBloodGroup}
                    onChange={(e) => setNewBloodGroup(e.target.value as BloodGroup)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold"
                  >
                    {bloodGroups.map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Volume (mL)</label>
                  <input
                    type="number"
                    min="50"
                    max="600"
                    required
                    value={newVolume}
                    onChange={(e) => setNewVolume(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Component Type *</label>
                <select
                  value={newComponent}
                  onChange={(e) => setNewComponent(e.target.value as BloodComponent)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-medium"
                >
                  {components.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Storage Location</label>
                <input
                  type="text"
                  required
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Donor Identifier</label>
                  <input
                    type="text"
                    required
                    value={newDonorId}
                    onChange={(e) => setNewDonorId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Days to Expiry</label>
                  <input
                    type="number"
                    min="5"
                    max="365"
                    required
                    value={newDaysToExpiry}
                    onChange={(e) => setNewDaysToExpiry(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddUnitOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Commit Blood Unit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT TRANSFUSION TAG MODAL */}
      {printingUnit && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrintingUnit(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs select-none"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-300 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-3 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
              <span className="font-bold text-xs">Blood Transfusion Verification Slip</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold flex items-center gap-1 shadow-sm transition"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Tag
                </button>
                <button
                  onClick={() => setPrintingUnit(null)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 bg-slate-50 flex-1 flex justify-center">
              <div className="bg-white border-2 border-slate-900 rounded-xl p-6 w-full text-slate-900 font-sans shadow-md print:shadow-none print:border-none print:p-0">
                <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center">
                  <div className="text-base font-black tracking-tight uppercase">
                    Apex Health Systems — Blood Transfusion Tag
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    AABB Clinical Crossmatch &amp; Bedside Check Tag
                  </div>
                </div>

                <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-center mb-4">
                  <span className="text-[10px] uppercase font-bold text-rose-800 block">DONOR UNIT BLOOD GROUP</span>
                  <span className="text-3xl font-black font-mono text-rose-700">{printingUnit.bloodGroup}</span>
                  <span className="text-xs font-semibold text-rose-900 block mt-0.5">{printingUnit.component}</span>
                </div>

                <div className="space-y-2 text-xs border border-slate-200 rounded-lg p-3 bg-slate-50 mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Unit Serial ID:</span>
                    <span className="font-mono font-bold text-slate-900">{printingUnit.unitId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Volume:</span>
                    <span className="font-mono font-bold text-slate-900">{printingUnit.volumeMl} mL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Storage Location:</span>
                    <span className="text-slate-800">{printingUnit.storageLocation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expiration Date:</span>
                    <span className="font-mono font-bold text-rose-700">{printingUnit.expiryDate}</span>
                  </div>
                  {printingUnit.reservedForPatientName && (
                    <div className="flex justify-between pt-1 border-t border-slate-200">
                      <span className="text-slate-500">Reserved Patient:</span>
                      <span className="font-bold text-slate-900">{printingUnit.reservedForPatientName}</span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-100 rounded-lg text-[10px] text-slate-700 space-y-1 mb-4">
                  <p className="font-bold uppercase text-slate-900">Bedside Verification Protocol:</p>
                  <p>1. Two qualified healthcare providers must independently verify patient ID and unit group.</p>
                  <p>2. Record pre-transfusion vitals (BP, Pulse, Temp, Resp Rate).</p>
                  <p>3. Monitor patient continuously for first 15 minutes of infusion.</p>
                </div>

                <div className="pt-4 border-t border-dashed border-slate-300 grid grid-cols-2 gap-4 text-center text-[10px]">
                  <div>
                    <div className="border-b border-slate-400 w-32 mx-auto mb-1"></div>
                    <span>RN #1 Verification Sign</span>
                  </div>
                  <div>
                    <div className="border-b border-slate-400 w-32 mx-auto mb-1"></div>
                    <span>RN #2 / MD Verification Sign</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
