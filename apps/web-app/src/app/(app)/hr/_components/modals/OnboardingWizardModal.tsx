'use client';

import { OnboardingWizard } from '../onboarding/OnboardingWizard';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
}

/**
 * Thin wrapper that delegates to the new professional OnboardingWizard.
 * Kept for backward compatibility with existing import paths.
 */
export function OnboardingWizardModal({ isOpen, onClose, onSuccess, tenantId }: OnboardingWizardModalProps) {
  return (
    <OnboardingWizard
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      tenantId={tenantId}
    />
  );
}
