'use client';

import { CheckCircle } from 'lucide-react';
import { STEP_LABELS } from '../types';

interface StepIndicatorProps {
  currentStep: number;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 overflow-x-auto">
      {STEP_LABELS.map((label, idx) => {
        const stepNum = idx + 1;
        const isActive = currentStep === stepNum;
        const isCompleted = currentStep > stepNum;

        return (
          <div key={stepNum} className="flex items-center gap-1.5 shrink-0">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
              style={{
                backgroundColor: isCompleted
                  ? '#059669'
                  : isActive
                  ? '#1d4fa5'
                  : '#E2E8F0',
                color: isCompleted || isActive ? '#FFFFFF' : '#94A3B8',
              }}
            >
              {isCompleted ? <CheckCircle className="h-3.5 w-3.5" /> : stepNum}
            </div>
            <span
              className={`text-[10px] font-bold hidden lg:inline ${
                isActive ? 'text-slate-800' : isCompleted ? 'text-emerald-600' : 'text-slate-400'
              }`}
            >
              {label}
            </span>
            {idx < STEP_LABELS.length - 1 && (
              <div
                className="w-4 sm:w-8 h-[2px] mx-0.5 rounded-full transition-colors"
                style={{ backgroundColor: currentStep > stepNum ? '#059669' : '#E2E8F0' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
