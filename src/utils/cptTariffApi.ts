import { supabaseClient } from '../lib/supabase';

export interface CptTariff {
  cpt_code: string;
  description: string;
  category: 'Consultation' | 'Lab Test' | 'Radiology' | 'Procedure';
  standard_unit_price: number;
}

const isCptTariff = (value: unknown): value is CptTariff =>
  typeof value === 'object' &&
  value !== null &&
  'cpt_code' in value && typeof value.cpt_code === 'string' &&
  'description' in value && typeof value.description === 'string' &&
  'category' in value && ['Consultation', 'Lab Test', 'Radiology', 'Procedure'].includes(String(value.category)) &&
  'standard_unit_price' in value && Number.isFinite(Number(value.standard_unit_price));

const authenticatedRequest = async (path: string, init: RequestInit = {}) => {
  if (!supabaseClient) throw new Error('The secure tariff service is not configured.');
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Sign in with an authorized clinic account to use CPT tariffs.');

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cpt-api/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      ...init.headers,
    },
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body
      ? String(body.error)
      : 'The secure tariff service returned an error.';
    throw new Error(message);
  }
  return body;
};

export const searchCptTariffs = async (query: string, signal?: AbortSignal): Promise<CptTariff[]> => {
  const response = await authenticatedRequest(`search?q=${encodeURIComponent(query)}`, { signal });
  if (!Array.isArray(response) || !response.every(isCptTariff)) {
    throw new Error('The tariff service returned invalid search results.');
  }
  return response.map((tariff) => ({
    ...tariff,
    standard_unit_price: Number(tariff.standard_unit_price),
  }));
};

export const addCptTariffToVisit = async (
  clinicId: string,
  tokenId: string,
  cptCode: string,
  quantity: number,
  expectedUnitPrice: number
) => {
  const response = await authenticatedRequest('add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clinicId, tokenId, cptCode, quantity, expectedUnitPrice }),
  });
  if (!isCptTariffLineItem(response)) {
    throw new Error('The tariff service returned an invalid visit line item.');
  }
  return response;
};

const isCptTariffLineItem = (
  value: unknown
): value is {
  id: string;
  kind: 'Consultation' | 'Lab' | 'Radiology' | 'Procedure';
  name: string;
  department: string;
  code: string;
  tariffCategory: CptTariff['category'];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  orderedBy: string;
  orderedAt: string;
} =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value && typeof value.id === 'string' &&
  'kind' in value && ['Consultation', 'Lab', 'Radiology', 'Procedure'].includes(String(value.kind)) &&
  'name' in value && typeof value.name === 'string' &&
  'department' in value && typeof value.department === 'string' &&
  'code' in value && typeof value.code === 'string' &&
  'tariffCategory' in value && ['Consultation', 'Lab Test', 'Radiology', 'Procedure'].includes(String(value.tariffCategory)) &&
  'quantity' in value && Number.isInteger(value.quantity) &&
  'unitPrice' in value && Number.isFinite(Number(value.unitPrice)) &&
  'totalPrice' in value && Number.isFinite(Number(value.totalPrice)) &&
  'orderedBy' in value && typeof value.orderedBy === 'string' &&
  'orderedAt' in value && typeof value.orderedAt === 'string';
