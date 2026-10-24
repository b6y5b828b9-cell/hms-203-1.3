import {
  ReceptionToken,
  TokenDoctorOrder,
  TokenLineItem,
  TokenLineItemInsuranceStatus,
  TokenServiceItem,
} from '../types';

const defaultAuthorizationStatus = (token: ReceptionToken): TokenLineItemInsuranceStatus =>
  token.paymentScheme?.schemeType === 'Insurance' || token.payMode === 'Insurance'
    ? 'Pending_Auth'
    : 'Cash_Only';

export const isSelfPayToken = (token: ReceptionToken): boolean =>
  token.paymentScheme
    ? token.paymentScheme.schemeType === 'Self-Pay'
    : token.payMode === 'Self';

const createLineItem = (
  token: ReceptionToken,
  item: Omit<TokenLineItem, 'insuranceStatus' | 'fulfillmentStatus'>,
  prior?: TokenLineItem
): TokenLineItem => ({
  ...item,
  insuranceStatus: prior?.insuranceStatus || defaultAuthorizationStatus(token),
  insuranceApprovalId: prior?.insuranceApprovalId,
  insuranceApprovedAmount: prior?.insuranceApprovedAmount,
  copayAmount: prior?.copayAmount,
  paymentOverride: prior?.paymentOverride || (isSelfPayToken(token)
    ? {
        mode: 'Self_Pay',
        reason: 'Visit registered under a self-pay payment scheme.',
        overriddenBy: 'Reception',
        overriddenAt: item.orderedAt,
      }
    : undefined),
  fulfillmentStatus: prior?.fulfillmentStatus || 'Ordered',
});

export const createDoctorOrderLineItems = (
  token: ReceptionToken,
  orders: TokenDoctorOrder
): TokenLineItem[] => {
  const orderedBy = orders.orderedByDoctorName;
  const orderedAt = orders.orderedAt;
  const lineItems: Array<Omit<TokenLineItem, 'insuranceStatus' | 'fulfillmentStatus'>> = [];

  if (orders.consultationFee > 0) {
    lineItems.push({
      id: `${token.id}-consult`,
      kind: 'Consultation',
      name: `Consultation — ${orderedBy}`,
      department: token.department,
      quantity: 1,
      unitPrice: orders.consultationFee,
      totalPrice: orders.consultationFee,
      orderedBy,
      orderedAt,
    });
  }

  for (const item of orders.labRequests) {
    lineItems.push({
      id: item.id,
      kind: 'Lab',
      name: item.testName,
      department: 'Laboratory',
      code: item.cptCode,
      quantity: 1,
      unitPrice: item.price,
      totalPrice: item.price,
      orderedBy,
      orderedAt,
    });
  }

  for (const item of orders.radiologyRequests) {
    lineItems.push({
      id: item.id,
      kind: 'Radiology',
      name: item.studyName,
      department: 'Radiology',
      code: item.cptCode,
      quantity: 1,
      unitPrice: item.price,
      totalPrice: item.price,
      orderedBy,
      orderedAt,
    });
  }

  for (const item of orders.procedureRequests) {
    lineItems.push({
      id: item.id,
      kind: 'Procedure',
      name: item.procedureName,
      department: 'Procedures',
      code: item.cptCode,
      quantity: 1,
      unitPrice: item.price,
      totalPrice: item.price,
      orderedBy,
      orderedAt,
    });
  }

  for (const item of orders.medicationRequests || []) {
    lineItems.push({
      id: item.id,
      kind: 'Medication',
      name: item.medicationName,
      department: 'Pharmacy',
      code: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.price,
      orderedBy,
      orderedAt,
    });
  }

  return lineItems.map((item) => createLineItem(
    token,
    item,
    token.lineItems?.find((existing) => existing.id === item.id)
  ));
};

export const createServiceLineItems = (
  token: ReceptionToken,
  services: TokenServiceItem[]
): TokenLineItem[] => services.map((service) => createLineItem(token, {
  id: service.id,
  kind: 'Service',
  name: service.name,
  department: service.category === 'Test' ? 'Laboratory' : service.category,
  quantity: 1,
  unitPrice: service.price,
  totalPrice: service.price,
  orderedBy: service.addedBy,
  orderedAt: service.addedAt,
}, token.lineItems?.find((existing) => existing.id === service.id)));

export const appendTokenLineItems = (
  existing: TokenLineItem[] = [],
  incoming: TokenLineItem[]
): TokenLineItem[] => {
  const byId = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    const prior = byId.get(item.id);
    byId.set(item.id, prior ? { ...item, ...prior, name: item.name, totalPrice: item.totalPrice } : item);
  }
  return [...byId.values()];
};

export const getEffectiveLineItemStatus = (
  item: TokenLineItem
): TokenLineItemInsuranceStatus | 'Self_Pay' =>
  item.paymentOverride?.mode === 'Self_Pay' ? 'Self_Pay' : item.insuranceStatus;

export const canExecuteDiagnosticLineItem = (item: TokenLineItem | undefined): boolean =>
  Boolean(item && (
    getEffectiveLineItemStatus(item) === 'Approved' ||
    getEffectiveLineItemStatus(item) === 'Partially_Approved' ||
    getEffectiveLineItemStatus(item) === 'Cash_Only' ||
    getEffectiveLineItemStatus(item) === 'Self_Pay'
  ));

export const canDispenseMedicationLineItem = (item: TokenLineItem | undefined): boolean =>
  Boolean(item && (
    getEffectiveLineItemStatus(item) === 'Approved' ||
    getEffectiveLineItemStatus(item) === 'Self_Pay'
  ));

export const getTokenLineItemBillingBreakdown = (item: TokenLineItem) => {
  const status = getEffectiveLineItemStatus(item);
  const lineTotal = Math.max(0, item.totalPrice);
  if (status === 'Denied') {
    return {
      total: 0,
      insuranceCoveredAmount: 0,
      copayAmount: 0,
      patientShare: 0,
    };
  }
  const total = lineTotal;
  if (status === 'Approved' || status === 'Partially_Approved') {
    const approvedAmount = Math.min(
      total,
      item.insuranceApprovedAmount ?? (status === 'Approved' ? total : 0)
    );
    const copayAmount = Math.min(approvedAmount, Math.max(0, item.copayAmount ?? 0));
    const insuranceCoveredAmount = Math.max(0, approvedAmount - copayAmount);
    return {
      total,
      insuranceCoveredAmount,
      copayAmount,
      patientShare: total - insuranceCoveredAmount,
    };
  }
  return {
    total,
    insuranceCoveredAmount: 0,
    copayAmount: 0,
    patientShare: total,
  };
};

export const aggregateTokenLineItemBilling = (lineItems: TokenLineItem[]) => {
  const pendingItems = lineItems.filter((item) => getEffectiveLineItemStatus(item) === 'Pending_Auth');
  const totals = lineItems.reduce((result, item) => {
    const status = getEffectiveLineItemStatus(item);
    const breakdown = getTokenLineItemBillingBreakdown(item);
    result.insuranceCoveredAmount += breakdown.insuranceCoveredAmount;
    result.patientShare += breakdown.patientShare;
    result.subtotal += breakdown.total;
    result.copayAmount += breakdown.copayAmount;
    return result;
  }, { subtotal: 0, insuranceCoveredAmount: 0, patientShare: 0, copayAmount: 0 });

  return { ...totals, pendingItemIds: pendingItems.map((item) => item.id) };
};
