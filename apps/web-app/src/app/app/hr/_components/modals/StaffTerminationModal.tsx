/**
 * ============================================================================
 * STAFF TERMINATION MODAL — Thin wrapper for OffboardingWizard
 * ============================================================================
 * Delegates to the new professional 6-step OffboardingWizard.
 * Kept for backward compatibility with existing import paths.
 * ============================================================================
 */

'use client';

import { OffboardingWizard } from '../offboarding/OffboardingWizard';

interface StaffTerminationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staff: {
    id: string;
    firstName: string;
    lastName: string;
    position?: string;
    employeeNumber?: string;
    tenantMatricule?: string;
    globalMatricule?: string;
    status: string;
  } | null;
  tenantId: string;
}

export function StaffTerminationModal({
  isOpen,
  onClose,
  onSuccess,
  staff,
  tenantId,
}: StaffTerminationModalProps) {
  if (!staff) return null;

  return (
    <OffboardingWizard
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      tenantId={tenantId}
      staffId={staff.id}
      staffName={`${staff.firstName} ${staff.lastName}`}
      staffPosition={staff.position || 'Personnel'}
    />
  );
}
