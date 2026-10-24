import React from 'react';
import { X, Activity } from 'lucide-react';
import { TriageAssessmentForm } from './TriageAssessmentForm';
import { TriageAssessment } from '../types';

interface TriageAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: string;
  onAssessmentSaved?: (patientId: string, assessment: TriageAssessment) => void;
}

export const TriageAssessmentModal: React.FC<TriageAssessmentModalProps> = ({
  isOpen,
  onClose,
  patientId,
  onAssessmentSaved,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">
                STAT Emergency Triage & Intake Assessment
              </h2>
              <p className="text-[10px] text-slate-400">
                Acuity stratification, NEWS2 physiological scoring & ER bed dispatch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <TriageAssessmentForm
            initialPatientId={patientId}
            onAssessmentCompleted={(pId, assessment) => {
              if (onAssessmentSaved) {
                onAssessmentSaved(pId, assessment);
              }
              onClose();
            }}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
};
