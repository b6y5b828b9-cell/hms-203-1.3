import { supabaseClient } from '../lib/supabase';
import { TokenVitalsRecord } from '../types';

const clinicId = import.meta.env.VITE_HMS_CLINIC_ID;

export const advanceOutpatientNurseToken = async (
  tokenId: string,
  status: 'In Triage' | 'Ready for Treatment'
): Promise<boolean> => {
  if (!supabaseClient) return false;
  if (!clinicId) throw new Error('The clinic ID is not configured for outpatient nurse actions.');
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) throw new Error('Sign in with an authorized nursing account to update the queue.');
  const { error } = await supabaseClient.rpc('advance_outpatient_nurse_token', {
    p_clinic_id: clinicId,
    p_token_id: tokenId,
    p_next_status: status,
  });
  if (error) throw error;
  return true;
};

export const completeOutpatientNurseService = async (
  tokenId: string,
  lineItemId: string,
  notes: string,
  executorName: string
): Promise<boolean> => {
  if (!supabaseClient) return false;
  if (!clinicId) throw new Error('The clinic ID is not configured for outpatient treatment actions.');
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) throw new Error('Sign in with an authorized nursing account to complete treatment.');
  const { error } = await supabaseClient.rpc('complete_outpatient_nurse_service', {
    p_clinic_id: clinicId,
    p_token_id: tokenId,
    p_line_item_id: lineItemId,
    p_notes: notes,
    p_executor_name: executorName,
  });
  if (error) throw error;
  return true;
};

export const saveOutpatientNurseTriage = async (
  tokenId: string,
  vitals: TokenVitalsRecord,
  progressNote: string,
  nurseName: string
): Promise<boolean> => {
  if (!supabaseClient) return false;
  if (!clinicId) throw new Error('The clinic ID is not configured for outpatient triage.');
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) throw new Error('Sign in with an authorized nursing account to save triage.');
  const { error } = await supabaseClient.rpc('save_outpatient_nurse_triage', {
    p_clinic_id: clinicId,
    p_token_id: tokenId,
    p_vitals: vitals,
    p_progress_note: progressNote,
    p_nurse_name: nurseName,
  });
  if (error) throw error;
  return true;
};
