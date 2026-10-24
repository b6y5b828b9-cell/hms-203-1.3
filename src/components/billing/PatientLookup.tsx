import React, { useMemo, useState } from 'react';
import { Search, UserRound, X } from 'lucide-react';
import { Patient, ReceptionToken } from '../../types';

interface PatientLookupProps {
  patients: Patient[];
  tokens: ReceptionToken[];
  selectedPatientId: string;
  onSelect: (patientId: string) => void;
  accent?: 'blue' | 'emerald' | 'rose';
  allowAllPatients?: boolean;
}

export const findCashierPatients = (
  patients: Patient[],
  tokens: ReceptionToken[],
  query: string,
  allowAllPatients = false
): Patient[] => {
  const search = query.trim().toLocaleLowerCase();
  if (search.length < 2) return [];

  const eligiblePatientIds = allowAllPatients
    ? new Set(patients.map((patient) => patient.id))
    : new Set(
        tokens
          .filter((token) => Boolean(token.doctorId))
          .map((token) => token.patientId)
      );
  const matchingPatientIds = new Set<string>();
  tokens.forEach((token) => {
    if (!allowAllPatients && !token.doctorId) return;
    const tokenDetails = [
      token.tokenNumber,
      token.id,
      token.patientName,
      token.patientId,
      token.patientPhone,
    ].filter(Boolean).join(' ').toLocaleLowerCase();
    if (tokenDetails.includes(search)) matchingPatientIds.add(token.patientId);
  });

  return patients
    .filter((patient) => eligiblePatientIds.has(patient.id))
    .filter((patient) => {
      const insuranceDetails = (patient.insuranceList || [])
        .flatMap((record) => [
          record.partyName,
          record.subPartyName,
          record.payerName,
          record.network,
          record.plan,
          record.cardNumber,
          record.policyNumber,
          record.certificateNumber,
          record.dependentNumber,
        ])
        .filter(Boolean);
      const searchableDetails = [
        patient.id,
        patient.rgNo,
        patient.title,
        patient.firstName,
        patient.middleName,
        patient.lastName,
        patient.surName,
        patient.dob,
        patient.age,
        patient.gender,
        patient.phone,
        patient.smsMobile,
        patient.email,
        patient.address,
        patient.nationality,
        patient.area,
        patient.district,
        patient.emergencyContact?.name,
        patient.emergencyContact?.phone,
        patient.emiratesId,
        patient.passportNo,
        patient.dlNo,
        patient.mothersEid,
        patient.motherPassportNo,
        patient.gccId,
        patient.company,
        patient.insurance?.provider,
        patient.insurance?.policyNumber,
        patient.insurance?.memberId,
        patient.insurance?.dhaMemberId,
        patient.insurance?.clientNumber,
        patient.insurance?.groupNumber,
        ...insuranceDetails,
      ].filter(Boolean).join(' ').toLocaleLowerCase();
      return searchableDetails.includes(search) || matchingPatientIds.has(patient.id);
    })
    .slice(0, 8);
};

export const PatientLookup: React.FC<PatientLookupProps> = ({
  patients,
  tokens,
  selectedPatientId,
  onSelect,
  accent = 'blue',
  allowAllPatients = false,
}) => {
  const [query, setQuery] = useState('');
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);
  const results = useMemo(
    () => findCashierPatients(patients, tokens, query, allowAllPatients),
    [patients, tokens, query, allowAllPatients]
  );
  const accentClasses = {
    blue: 'focus:border-blue-500 focus:ring-blue-500/20',
    emerald: 'focus:border-emerald-500 focus:ring-emerald-500/20',
    rose: 'focus:border-rose-500 focus:ring-rose-500/20',
  }[accent];

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-slate-700">
        Find patient
        <span className="relative mt-1 block">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (selectedPatientId) onSelect('');
            }}
            placeholder="Token, name, MRN, phone, ID, or insurance number"
            autoComplete="off"
            className={`w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs font-normal outline-none focus:ring-2 ${accentClasses}`}
          />
        </span>
      </label>

      {selectedPatient ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <UserRound className="h-4 w-4 shrink-0 text-emerald-700" />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-900">
                {selectedPatient.title ? `${selectedPatient.title} ` : ''}
                {selectedPatient.firstName} {selectedPatient.middleName ? `${selectedPatient.middleName} ` : ''}{selectedPatient.lastName}
              </p>
              <p className="text-[10px] text-slate-600">MRN: {selectedPatient.rgNo || selectedPatient.id} · {selectedPatient.phone}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelect('');
              setQuery('');
            }}
            aria-label="Clear selected patient"
            className="rounded p-1 text-slate-500 hover:bg-white hover:text-slate-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : query.trim().length < 2 ? (
        <p className="text-[10px] text-slate-500">Search using at least 2 characters. Patient records are not shown until you search.</p>
      ) : results.length > 0 ? (
        <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm" role="listbox" aria-label="Patient search results">
          {results.map((patient) => {
            const matchingTokens = tokens.filter((token) =>
              token.patientId === patient.id &&
              [token.tokenNumber, token.id].some((value) => value?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
            );
            return (
              <button
                key={patient.id}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => onSelect(patient.id)}
                className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-900">{patient.firstName} {patient.middleName ? `${patient.middleName} ` : ''}{patient.lastName}</span>
                  <span className="block truncate text-[10px] text-slate-500">MRN: {patient.rgNo || patient.id} · {patient.phone}</span>
                </span>
                {matchingTokens[0] && <span className="shrink-0 rounded bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">{matchingTokens[0].tokenNumber}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800">No patient found. Check the token, name, or ID and try again.</p>
      )}
    </div>
  );
};
