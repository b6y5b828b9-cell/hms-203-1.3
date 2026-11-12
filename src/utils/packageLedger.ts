import { DoctorPackage, DoctorPackageService, ReceptionToken, TokenLineItem } from '../types';
import { createDoctorOrderLineItems } from './tokenStateMachine';

export interface PackageServiceUsage {
  service: DoctorPackageService;
  usedCount: number;
  quota: number;
}

export interface UnbundledPackageCharge {
  lineItem: TokenLineItem;
  includedService?: DoctorPackageService;
  extraQuantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PackageLedger {
  usage: PackageServiceUsage[];
  unbundledCharges: UnbundledPackageCharge[];
}

const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');

const lineMatchesService = (lineItem: TokenLineItem, service: DoctorPackageService) => {
  const lineCode = normalize(lineItem.code || '');
  const serviceCodes = [service.code, service.cptCode].filter(Boolean).map((code) => normalize(code!));
  if (lineCode && serviceCodes.includes(lineCode)) return true;
  return !lineCode && normalize(lineItem.name) === normalize(service.name);
};

const getLineItems = (token: ReceptionToken): TokenLineItem[] =>
  token.lineItems?.length
    ? token.lineItems
    : token.doctorOrders
    ? createDoctorOrderLineItems(token, token.doctorOrders)
    : [];

const tokenDate = (token: ReceptionToken) => token.visitDate || token.createdDate || '';

const tokenSortKey = (token: ReceptionToken) => {
  const time = token.createdTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!time) return `${tokenDate(token)} 00:00 ${token.id}`;
  let hour = Number(time[1]) % 12;
  if (time[3].toUpperCase() === 'PM') hour += 12;
  return `${tokenDate(token)} ${String(hour).padStart(2, '0')}:${time[2]} ${token.id}`;
};

const eligiblePackageTokens = (
  packageItem: DoctorPackage,
  tokens: ReceptionToken[],
  validFrom: string,
  validUntil: string
) =>
  tokens.filter((token) => {
    const visitDate = tokenDate(token);
    return token.status !== 'Cancelled' &&
      token.paymentScheme?.packageId === packageItem.id &&
      visitDate >= validFrom &&
      visitDate <= validUntil;
  }).sort((first, second) => tokenSortKey(first).localeCompare(tokenSortKey(second)));

export const buildPackageLedger = (
  packageItem: DoctorPackage,
  tokens: ReceptionToken[],
  currentTokenId: string,
  validFrom = packageItem.validFrom,
  validUntil = packageItem.validUntil
): PackageLedger => {
  const packageTokens = eligiblePackageTokens(packageItem, tokens, validFrom, validUntil);
  const currentToken = packageTokens.find((token) => token.id === currentTokenId);
  const currentTokenKey = currentToken ? tokenSortKey(currentToken) : '';
  const usage = packageItem.includedServices.map((service) => {
    const usedCount = packageTokens.reduce((total, token) =>
      total + getLineItems(token)
        .filter((lineItem) => lineMatchesService(lineItem, service))
        .reduce((lineTotal, lineItem) => lineTotal + lineItem.quantity, 0), 0);
    return { service, usedCount, quota: service.quota };
  });

  if (!currentToken) return { usage, unbundledCharges: [] };

  const serviceRemainders = new Map<string, number>();
  for (const service of packageItem.includedServices) {
    const priorUsed = packageTokens
      .filter((token) => token.id !== currentToken.id && tokenSortKey(token) < currentTokenKey)
      .reduce((total, token) =>
        total + getLineItems(token)
          .filter((lineItem) => lineMatchesService(lineItem, service))
          .reduce((lineTotal, lineItem) => lineTotal + lineItem.quantity, 0), 0);
    serviceRemainders.set(service.tariffItemId, Math.max(0, service.quota - priorUsed));
  }

  const unbundledCharges: UnbundledPackageCharge[] = [];
  for (const lineItem of getLineItems(currentToken).sort((first, second) => first.orderedAt.localeCompare(second.orderedAt))) {
    const includedService = packageItem.includedServices.find((service) => lineMatchesService(lineItem, service));
    if (!includedService) {
      unbundledCharges.push({
        lineItem,
        extraQuantity: lineItem.quantity,
        unitPrice: lineItem.unitPrice,
        totalPrice: lineItem.quantity * lineItem.unitPrice,
      });
      continue;
    }

    const remaining = serviceRemainders.get(includedService.tariffItemId) || 0;
    const includedQuantity = Math.min(lineItem.quantity, remaining);
    serviceRemainders.set(includedService.tariffItemId, remaining - includedQuantity);
    const extraQuantity = lineItem.quantity - includedQuantity;
    if (extraQuantity > 0) {
      unbundledCharges.push({
        lineItem,
        includedService,
        extraQuantity,
        unitPrice: lineItem.unitPrice,
        totalPrice: extraQuantity * lineItem.unitPrice,
      });
    }
  }

  return { usage, unbundledCharges };
};

export const getPackageRetailValue = (services: DoctorPackageService[]) =>
  services.reduce((total, service) => total + service.unitPrice * service.quota, 0);
