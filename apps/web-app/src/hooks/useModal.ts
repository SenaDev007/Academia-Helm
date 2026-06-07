/**
 * ============================================================================
 * USE MODAL - HOOK POUR GÉRER LES MODALS
 * ============================================================================
 * 
 * Hook simplifié pour ouvrir/fermer des modals
 * Utilise le ModalProvider en interne
 * 
 * ============================================================================
 */

import { useCallback } from 'react';
import { useModal as useModalContext } from '@/components/modules/blueprint/modals/ModalProvider';

export function useModal() {
  const { openModal, closeModal, closeAllModals } = useModalContext();

  const openFormModal = useCallback(
    (id: string, props: any) => {
      openModal(id, 'form', props);
    },
    [openModal]
  );

  const openConfirmModal = useCallback(
    (id: string, props: any) => {
      openModal(id, 'confirm', props);
    },
    [openModal]
  );

  const openCriticalModal = useCallback(
    (id: string, props: any) => {
      openModal(id, 'critical', props);
    },
    [openModal]
  );

  const openWizardModal = useCallback(
    (id: string, props: any) => {
      openModal(id, 'wizard', props);
    },
    [openModal]
  );

  const openReadOnlyModal = useCallback(
    (id: string, props: any) => {
      openModal(id, 'readonly', props);
    },
    [openModal]
  );

  const openAlertModal = useCallback(
    (id: string, props: any) => {
      openModal(id, 'alert', props);
    },
    [openModal]
  );

  return {
    openFormModal,
    openConfirmModal,
    openCriticalModal,
    openWizardModal,
    openReadOnlyModal,
    openAlertModal,
    closeModal,
    closeAllModals,
  };
}

