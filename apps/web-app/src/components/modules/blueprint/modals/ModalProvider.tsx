/**
 * ============================================================================
 * MODAL PROVIDER - GESTION GLOBALE DES MODALS
 * ============================================================================
 * 
 * Provider pour gérer l'état global des modals
 * Permet d'ouvrir/fermer des modals depuis n'importe où
 * 
 * ============================================================================
 */

'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export interface ModalState {
  id: string;
  type: 'form' | 'confirm' | 'critical' | 'wizard' | 'readonly' | 'alert';
  props: any;
}

interface ModalContextType {
  modals: ModalState[];
  openModal: (id: string, type: ModalState['type'], props: any) => void;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modals, setModals] = useState<ModalState[]>([]);

  const openModal = (id: string, type: ModalState['type'], props: any) => {
    setModals((prev) => {
      // Éviter les doublons
      if (prev.find((m) => m.id === id)) {
        return prev;
      }
      return [...prev, { id, type, props }];
    });
  };

  const closeModal = (id: string) => {
    setModals((prev) => prev.filter((m) => m.id !== id));
  };

  const closeAllModals = () => {
    setModals([]);
  };

  return (
    <ModalContext.Provider
      value={{
        modals,
        openModal,
        closeModal,
        closeAllModals,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
}

