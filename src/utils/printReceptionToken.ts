import { ReceptionToken } from '../types';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);

export const printReceptionToken = (token: ReceptionToken): boolean => {
  const printWindow = window.open('', '_blank', 'width=420,height=640');
  if (!printWindow) return false;

  const patientDetails = token.patientDetails;
  const visitCode = token.visitCode || (token.serviceType === 'Consultation' ? 'C' : token.serviceType === 'Physio Technician' ? 'TEC' : 'NC');
  const visitType = visitCode === 'C' ? 'Consultation' : visitCode === 'TEC' ? 'Technician' : 'Non-consultation';
  const fields = [
    ['Nationality', patientDetails?.nationality],
    ['Phone', token.patientPhone],
    ['Date of birth', patientDetails?.dateOfBirth],
    ['National ID', patientDetails?.nationalId],
    ['Gender', token.patientGender],
    ['Passport no.', patientDetails?.passportNumber],
    ['Visit type', `${visitCode} — ${visitType}`],
    ['Doctor / technician', token.doctorName],
    ['Department', token.department],
    ['Registered at', token.createdTime],
    ['Registered by', token.registeredBy || token.historyLogs?.[0]?.actor],
  ];
  const rows = fields
    .map(([label, value]) => `<div class="row"><span>${label}</span><strong>${escapeHtml(value || 'Not recorded')}</strong></div>`)
    .join('');
  const patientName = [patientDetails?.title, patientDetails?.middleName, token.patientName]
    .filter(Boolean)
    .join(' ');

  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Reception Token ${escapeHtml(token.tokenNumber)}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          * { box-sizing: border-box; }
          body { width: 72mm; margin: 0 auto; color: #111; font: 12px Arial, sans-serif; }
          .brand { display: flex; align-items: center; justify-content: center; gap: 6px; }
          .logo { width: 24px; height: 24px; }
          h1 { margin: 0; text-align: left; font-size: 15px; }
          .company { margin: 3px 0 0; text-align: center; font-size: 9px; font-weight: bold; }
          .sub { margin: 4px 0 10px; text-align: center; color: #555; font-size: 10px; }
          .token { margin: 0 0 10px; padding: 8px; border: 2px solid #111; text-align: center; }
          .token span { display: block; font-size: 10px; text-transform: uppercase; }
          .token strong { display: block; margin-top: 3px; font-size: 32px; }
          .name { margin: 0 0 10px; overflow-wrap: anywhere; text-align: center; font-size: 15px; font-weight: bold; }
          .row { display: flex; justify-content: space-between; gap: 8px; border-top: 1px dashed #999; padding: 6px 0; }
          .row span { color: #555; }
          .row strong { max-width: 48mm; overflow-wrap: anywhere; text-align: right; }
          .footer { margin-top: 10px; border-top: 1px dashed #777; padding-top: 8px; text-align: center; font-size: 10px; }
          @media print { body { width: 72mm; } }
        </style>
      </head>
      <body>
        <div class="brand">
          <svg class="logo" viewBox="0 0 32 32" role="img" aria-label="MedCore OS logo">
            <rect width="32" height="32" rx="8" fill="#0f766e"></rect>
            <path d="M13 5h6v8h8v6h-8v8h-6v-8H5v-6h8z" fill="#fff"></path>
          </svg>
          <h1>MEDCORE OS</h1>
        </div>
        <p class="company">Apex Health Systems &amp; Clinical Care</p>
        <p class="sub">${escapeHtml(token.visitDate || token.createdDate || '')} · Registered at ${escapeHtml(token.createdTime)}</p>
        <div class="token"><span>Token number</span><strong>${escapeHtml(token.tokenNumber)}</strong></div>
        <p class="name">${escapeHtml(patientName)}</p>
        ${rows}
        <div class="footer">Please wait for your token to be called.</div>
        <script>window.onload = function () { window.focus(); window.print(); };</script>
      </body>
    </html>`);
  printWindow.document.close();
  return true;
};
