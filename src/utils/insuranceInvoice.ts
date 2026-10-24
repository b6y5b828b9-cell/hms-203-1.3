import { BillItem, InsuranceApproval, InsurancePolicy } from '../types';

export const parseInsuranceDeductible = (value?: string): number => {
  if (!value || /%/.test(value)) return 0;
  const match = value.replace(/,/g, '').match(/(?:AED|USD|[$])?\s*(\d+(?:\.\d{1,2})?)/i);
  return match ? Math.max(0, Number(match[1]) || 0) : 0;
};

export const applyInsuranceBreakdown = (
  items: BillItem[],
  serviceCopay: InsurancePolicy['serviceCopay'],
  fallbackCopayPercentage: number,
  deductibleAmount = 0
): BillItem[] => {
  let deductibleRemaining = Math.max(0, Number(deductibleAmount) || 0);

  return items.map((item) => {
    const gross = Math.max(0, (Number(item.unitCost) || 0) * Math.max(1, Number(item.quantity) || 1));
    const discount = Math.min(gross, Math.max(0, Number(item.discountAmount) || 0));
    const net = Math.max(0, gross - discount);
    const deductible = Math.min(net, deductibleRemaining);
    deductibleRemaining -= deductible;

    const categoryCopay = item.category === 'Consultation'
      ? serviceCopay?.consultation
      : item.category === 'Lab Test'
      ? serviceCopay?.lab ?? serviceCopay?.laboratory
      : item.category === 'Radiology'
      ? serviceCopay?.radiology
      : item.category === 'Pharmacy'
      ? serviceCopay?.pharmacy
      : item.category === 'Surgical Procedure' || item.category === 'Technician Service'
      ? serviceCopay?.surgicalProcedure ?? serviceCopay?.procedures ?? serviceCopay?.procedure
      : undefined;
    const copayPercentage = Math.min(100, Math.max(0, Number(categoryCopay ?? fallbackCopayPercentage) || 0));
    const afterDeductible = Math.max(0, net - deductible);
    const copay = Math.round(afterDeductible * copayPercentage) / 100;

    return {
      ...item,
      amount: gross,
      totalPrice: gross,
      discountAmount: discount,
      netAmount: net,
      deductibleAmount: deductible,
      copayPercentage,
      copayAmount: copay,
      insuranceAmount: Math.max(0, afterDeductible - copay),
    };
  });
};

export const applyApprovedInsuranceBreakdown = (
  items: BillItem[],
  approvals: InsuranceApproval[],
  deductibleAmount = 0
): BillItem[] => {
  let deductibleRemaining = Math.max(0, Number(deductibleAmount) || 0);
  const remainingApprovedAmounts = new Map(approvals.map((approval) => [approval.id, Math.max(0, Number(approval.approvedAmount) || 0)]));
  const remainingCopayAmounts = new Map(approvals.map((approval) => [approval.id, Math.max(0, Number(approval.copayAmount) || 0)]));

  return items.map((item) => {
    const gross = Math.max(0, (Number(item.unitCost) || 0) * Math.max(1, Number(item.quantity) || 1));
    const approval = approvals.find((record) => record.id === item.insuranceApprovalId);
    const canApplyApproval = approval?.approvalStatus === 'Approved';
    const remainingApproved = canApplyApproval ? remainingApprovedAmounts.get(approval.id) || 0 : 0;
    const approvedInsurance = approval?.approvalStatus === 'Approved'
      ? Math.min(gross, remainingApproved)
      : 0;
    if (canApplyApproval) remainingApprovedAmounts.set(approval.id, remainingApproved - approvedInsurance);
    const remainingCopay = canApplyApproval ? remainingCopayAmounts.get(approval.id) || 0 : 0;
    const approvedCopay = canApplyApproval
      ? Math.min(gross - approvedInsurance, remainingCopay)
      : 0;
    if (canApplyApproval) remainingCopayAmounts.set(approval.id, remainingCopay - approvedCopay);
    const remainingPatientShare = Math.max(0, gross - approvedInsurance - approvedCopay);
    const deductible = Math.min(remainingPatientShare, deductibleRemaining);
    deductibleRemaining -= deductible;

    return {
      ...item,
      amount: gross,
      totalPrice: gross,
      discountAmount: 0,
      netAmount: gross,
      deductibleAmount: deductible,
      copayPercentage: approval?.approvalStatus === 'Approved' ? approval.copayPercentage : undefined,
      copayAmount: approvedCopay,
      insuranceAmount: approvedInsurance,
    };
  });
};

export const applyDiscountBreakdown = (items: BillItem[], discountPercentage: number): BillItem[] => {
  const discountRate = Math.min(100, Math.max(0, Number(discountPercentage) || 0));
  return items.map((item) => {
    const gross = Math.max(0, (Number(item.unitCost) || 0) * Math.max(1, Number(item.quantity) || 1));
    const discount = Math.round(gross * discountRate) / 100;
    return {
      ...item,
      amount: gross,
      totalPrice: gross,
      discountAmount: discount,
      netAmount: gross - discount,
      insuranceAmount: 0,
      copayAmount: 0,
    };
  });
};

export const sumInvoiceItemField = (items: BillItem[], field: 'discountAmount' | 'netAmount' | 'deductibleAmount' | 'copayAmount' | 'insuranceAmount'): number =>
  items.reduce((sum, item) => sum + (Number(item[field]) || 0), 0);
