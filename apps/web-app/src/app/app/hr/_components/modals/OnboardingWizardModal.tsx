'use client';

import { OnboardingWizard } from '../onboarding/OnboardingWizard';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
  /** ⭐ 160 — Reprendre un BROUILLON d'embauche interrompu : le wizard
   * s'ouvre hydraté à l'étape pertinente (section « Embauches en cours »). */
  resumeStaffId?: string | null;
}

/**
 * Thin wrapper that delegates to the new professional OnboardingWizard.
 * Kept for backward compatibility with existing import paths.
 */
export function OnboardingWizardModal({ isOpen, onClose, onSuccess, tenantId, resumeStaffId }: OnboardingWizardModalProps) {
  return (
    <OnboardingWizard
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      tenantId={tenantId}
      resumeStaffId={resumeStaffId}
    />
  );
}
