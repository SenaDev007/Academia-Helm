'use client';

/**
 * ============================================================================
 * BULK ACTION MODAL — Modal de confirmation personnalisé pour actions multiples
 * ============================================================================
 *
 * Remplace les confirm()/prompt() génériques du navigateur par un modal
 * professionnel cohérent avec la palette Academia Helm.
 *
 * Variantes :
 *   - 'confirm' : confirmation simple (Oui/Non)
 *   - 'danger'  : confirmation avec saisie texte obligatoire (ex: "SUPPRIMER")
 *   - 'warning' : confirmation avec avertissement visible
 *
 * Usage :
 *   <BulkActionModal
 *     isOpen={true}
 *     type="danger"
 *     title="Supprimer 5 élèves"
 *     message="Cette action est irréversible..."
 *     confirmLabel="Supprimer définitivement"
 *     confirmText="SUPPRIMER"  // pour type='danger' — l'utilisateur doit taper ce texte
 *     onConfirm={() => handleDelete()}
 *     onCancel={() => setOpen(false)}
 *   />
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, X, Loader2, Shield, Info } from 'lucide-react';

interface BulkActionModalProps {
  isOpen: boolean;
  type?: 'confirm' | 'danger' | 'warning';
  title: string;
  message: string;
  /** Pour type='danger' : texte que l'utilisateur doit taper pour activer le bouton */
  confirmText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isProcessing?: boolean;
  /** Liste optionnelle d'éléments sélectionnés (affichés en preview) */
  selectedItems?: string[];
  selectedCount?: number;
}

const TYPE_CONFIG = {
  confirm: {
    icon: Info,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    border: 'border-blue-200',
    headerBg: 'bg-blue-50',
    buttonBg: 'bg-blue-600 hover:bg-blue-700',
    messageBg: 'bg-blue-50',
    messageText: 'text-blue-800',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    border: 'border-amber-200',
    headerBg: 'bg-amber-50',
    buttonBg: 'bg-amber-600 hover:bg-amber-700',
    messageBg: 'bg-amber-50',
    messageText: 'text-amber-800',
  },
  danger: {
    icon: Shield,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    border: 'border-red-200',
    headerBg: 'bg-red-50',
    buttonBg: 'bg-red-600 hover:bg-red-700',
    messageBg: 'bg-red-50',
    messageText: 'text-red-800',
  },
};

export default function BulkActionModal({
  isOpen,
  type = 'confirm',
  title,
  message,
  confirmText,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  isProcessing = false,
  selectedItems = [],
  selectedCount = 0,
}: BulkActionModalProps) {
  const [textInput, setTextInput] = useState('');
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;

  // Reset text input quand le modal se ferme
  useEffect(() => {
    if (!isOpen) {
      setTextInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isDanger = type === 'danger';
  const canConfirm = !isDanger || (confirmText && textInput.trim() === confirmText);

  const handleConfirm = async () => {
    if (!canConfirm || isProcessing) return;
    await onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onCancel();
      }}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl border-2 ${config.border} w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-200`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-modal-title"
      >
        {/* Header avec icône */}
        <div className={`${config.headerBg} px-6 py-5 border-b ${config.border} flex items-start gap-4`}>
          <div className={`shrink-0 w-12 h-12 rounded-xl ${config.iconBg} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${config.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="bulk-modal-title" className="text-lg font-bold text-slate-900 leading-tight">
              {title}
            </h2>
            {selectedCount > 0 && (
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {selectedCount} élève{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
              </p>
            )}
          </div>
          {!isProcessing && (
            <button
              onClick={onCancel}
              className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Message */}
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {message}
          </p>

          {/* Preview des éléments sélectionnés (si peu) */}
          {selectedItems.length > 0 && selectedItems.length <= 5 && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Élèves concernés
              </p>
              <ul className="space-y-1">
                {selectedItems.map((name, i) => (
                  <li key={i} className="text-xs text-slate-700 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-slate-400" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {selectedItems.length > 5 && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs text-slate-600">
                <strong>{selectedItems.length}</strong> élèves seront affectés par cette action.
              </p>
            </div>
          )}

          {/* Champ de saisie pour type='danger' */}
          {isDanger && confirmText && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Pour confirmer, tapez : <span className="text-red-600">{confirmText}</span>
              </label>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                autoFocus
                disabled={isProcessing}
                placeholder={confirmText}
                className={`w-full px-3 py-2 text-sm border-2 rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  textInput.trim() === confirmText
                    ? 'border-red-500 focus:ring-red-500 bg-red-50'
                    : 'border-slate-300 focus:ring-blue-500'
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canConfirm) {
                    handleConfirm();
                  }
                }}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Le bouton de confirmation sera activé uniquement quand vous aurez tapé le texte exact.
              </p>
            </div>
          )}

          {/* Avertissement pour danger */}
          {isDanger && (
            <div className={`${config.messageBg} ${config.messageText} rounded-lg p-3 border ${config.border} text-xs flex items-start gap-2`}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Action irréversible.</strong> Cette opération ne peut pas être annulée.
                {confirmText && ' La saisie du texte de confirmation est obligatoire.'}
              </div>
            </div>
          )}
        </div>

        {/* Footer — boutons */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || isProcessing}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${config.buttonBg} shadow-sm`}
          >
            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
            {isProcessing ? 'Traitement...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
