/**
 * ============================================================================
 * WIZARD MODAL - MODAL DE FORMULAIRE MULTI-ÉTAPES
 * ============================================================================
 * 
 * Modal réutilisable pour les formulaires en plusieurs étapes
 * 
 * ============================================================================
 */

'use client';

import { ReactNode, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WizardStep {
  id: string;
  label: string;
  content: ReactNode;
  isValid?: boolean;
}

export interface WizardModalProps {
  /** Titre du wizard */
  title: string;
  /** Étapes du wizard */
  steps: WizardStep[];
  /** Ouvert/fermé */
  isOpen: boolean;
  /** Callback de fermeture */
  onClose: () => void;
  /** Callback de soumission */
  onSubmit: (data: any) => void;
  /** Label du bouton de soumission */
  submitLabel?: string;
  /** Chargement */
  isLoading?: boolean;
  /** Taille */
  size?: 'md' | 'lg' | 'xl';
}

export default function WizardModal({
  title,
  steps,
  isOpen,
  onClose,
  onSubmit,
  submitLabel = 'Terminer',
  isLoading = false,
  size = 'lg',
}: WizardModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<any>({});

  if (!isOpen) return null;

  const sizeClasses = {
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const canGoNext = currentStepData.isValid !== false;

  const handleNext = () => {
    if (!isLastStep && canGoNext) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className={cn('relative bg-white rounded-lg shadow-xl w-full', sizeClasses[size])}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-600 mt-1">
                Étape {currentStep + 1} sur {steps.length}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    'flex-1 h-2 rounded-full',
                    index <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
                  )}
                />
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
              {steps.map((step, index) => (
                <span
                  key={step.id}
                  className={cn(
                    index <= currentStep ? 'font-medium text-blue-600' : ''
                  )}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6 min-h-[300px]">{currentStepData.content}</div>

          {/* Actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handlePrevious}
              disabled={isFirstStep || isLoading}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Précédent</span>
            </button>

            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Annuler
              </button>
              {isLastStep ? (
                <button
                  onClick={handleSubmit}
                  disabled={!canGoNext || isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Traitement...' : submitLabel}
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={!canGoNext || isLoading}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Suivant</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

