/**
 * ============================================================================
 * FORM MODAL - MODAL DE FORMULAIRE STANDARDISÉ
 * ============================================================================
 * 
 * Modal réutilisable pour les formulaires CRUD
 * Utilise BaseModal pour la structure standardisée
 * 
 * Usage :
 * - Créer
 * - Modifier
 * - Paramétrer
 * 
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import BaseModal from './BaseModal';

export interface FormModalProps {
  /** Titre du modal */
  title: string;
  /** Sous-titre métier (optionnel) */
  subtitle?: string;
  /** Contenu du formulaire (optionnel si fields est fourni) */
  children?: ReactNode;
  /** Ouvert/fermé */
  isOpen: boolean;
  /** Callback de fermeture */
  onClose: () => void;
  /** Actions (boutons) */
  actions?: ReactNode;
  /** Taille */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'large';
  /** Afficher le contexte */
  showContext?: boolean;
  /** Champs dynamiques (nouveau pattern) */
  fields?: any[];
  /** Callback de sauvegarde (nouveau pattern) */
  onSave?: (data: any) => Promise<void>;
  /** Callback de confirmation (nouveau pattern) */
  onConfirm?: () => Promise<void>;
  /** Données initiales pour le formulaire */
  initialData?: any;
}

export default function FormModal({
  title,
  subtitle,
  children,
  isOpen,
  onClose,
  actions,
  size = 'md',
  showContext = true,
  fields,
  onSave,
  onConfirm,
  initialData,
}: FormModalProps) {
  const modalSize = size === 'large' ? 'lg' : size;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onConfirm) await onConfirm();
    if (onSave) {
      const formData = new FormData(e.target as HTMLFormElement);
      const data = Object.fromEntries(formData.entries());
      await onSave(data);
    }
  };

  return (
    <BaseModal
      title={title}
      subtitle={subtitle}
      isOpen={isOpen}
      onClose={onClose}
      size={modalSize}
      showContext={showContext}
      footer={actions || (onSave || onConfirm ? (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="modal-form"
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Confirmer
          </button>
        </div>
      ) : null)}
    >
      {fields ? (
        <form id="modal-form" onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.name} className="space-y-1">
              <label className="text-xs font-black uppercase text-gray-400">
                {field.label}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  name={field.name}
                  defaultValue={initialData?.[field.name] || field.defaultValue}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 font-medium min-h-[100px]"
                />
              ) : field.type === 'select' ? (
                <select
                  name={field.name}
                  defaultValue={initialData?.[field.name] || field.defaultValue}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {field.options?.map((opt: any) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  name={field.name}
                  defaultValue={initialData?.[field.name] || field.defaultValue}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              )}
            </div>
          ))}
          {children}
        </form>
      ) : onConfirm ? (
        <form id="modal-form" onSubmit={handleSubmit}>
          {children}
        </form>
      ) : (
        children
      )}
    </BaseModal>
  );
}

