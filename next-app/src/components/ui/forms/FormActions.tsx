/**
 * ============================================================================
 * FORM ACTIONS - ACTIONS DE FORMULAIRE STANDARD
 * ============================================================================
 * 
 * Composant standard pour les boutons d'action des formulaires
 * 
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FormActionsProps {
  onSubmit?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  submitDisabled?: boolean;
  additionalActions?: ReactNode;
  className?: string;
}

export function FormActions({
  onSubmit,
  onCancel,
  submitLabel = 'Enregistrer',
  cancelLabel = 'Annuler',
  loading = false,
  submitDisabled = false,
  additionalActions,
  className,
}: FormActionsProps) {
  return (
    <div className={cn('flex items-center justify-end gap-3 pt-4 border-t', className)}>
      {additionalActions}
      {onCancel && (
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
      )}
      {onSubmit && (
        <Button
          type="submit"
          onClick={onSubmit}
          disabled={loading || submitDisabled}
        >
          {loading ? 'Enregistrement...' : submitLabel}
        </Button>
      )}
    </div>
  );
}
