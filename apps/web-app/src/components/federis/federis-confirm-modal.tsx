/**
 * FederisConfirmModal — Modale de confirmation PROFESSIONNELLE (Academia Federis)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ 2026-10-01 — remplace les window.confirm() génériques du navigateur
 *    (alertes système sans identité visuelle) par une modale aux couleurs de
 *    l'espace patronat : icône en pastille, titre, message, données clés en
 *    lignes libellé/valeur, note d'information, avertissement irruption,
 *    boutons d'action avec état de chargement.
 *
 * Réutilisée par :
 *   - FederisDeliberationsPage — « Envoyer les relevés » / « Publier les
 *     résultats » (workflow du jury — T26 : embarque le sélecteur de durée du
 *     lien public parents via children) ;
 *   - FederisGradeRelevesTab — « Envoyer aux écoles » (sous-onglet Relevé de
 *     notes du module Délibération).
 *
 * Accessibilité : rôle dialog + aria-modal, fermeture par Échap et par clic
 * sur l'arrière-plan, focus piégé sur la modale.
 */

'use client';

import { useEffect, useRef } from 'react';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FedConfirmDetail {
  label: string;
  value: React.ReactNode;
}

export interface FederisConfirmModalProps {
  open: boolean;
  /** Titre court — ex. « Envoyer les relevés de notes aux écoles ? » */
  title: string;
  /** Message descriptif (ReactNode : mise en gras possible). */
  message: React.ReactNode;
  /** Icône de pastille (lucide-react) — ex. Send, ShieldCheck. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Palette : navy (action principale) | gold (distribution) | emerald (publication) | red (destructif). */
  tone?: 'navy' | 'gold' | 'emerald' | 'red';
  /** Données clés affichées en lignes libellé / valeur. */
  details?: FedConfirmDetail[];
  /** Note d'information (bloc bleu). */
  note?: React.ReactNode;
  /** Avertissement (bloc ambre) — ex. caractère définitif. */
  warning?: React.ReactNode;
  /** ⭐ T26 — Contenu additionnel (ex. sélecteur de durée du lien public)
   *    rendu entre l'avertissement et les boutons d'action. */
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Désactive le bouton de confirmation ( traitement en cours). */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TONES: Record<
  NonNullable<FederisConfirmModalProps['tone']>,
  { pill: string; icon: string; btn: string }
> = {
  navy: {
    pill: 'bg-blue-50 border border-blue-100',
    icon: 'text-blue-900',
    btn: 'fed-btn-navy',
  },
  gold: {
    pill: 'bg-amber-50 border border-amber-100',
    icon: 'text-amber-600',
    btn: 'fed-btn-gold',
  },
  emerald: {
    pill: 'bg-emerald-50 border border-emerald-100',
    icon: 'text-emerald-600',
    btn: 'px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50',
  },
  red: {
    pill: 'bg-red-50 border border-red-100',
    icon: 'text-red-600',
    btn: 'px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
  },
};

export default function FederisConfirmModal({
  open,
  title,
  message,
  icon: Icon,
  tone = 'navy',
  details,
  note,
  warning,
  children,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  loading = false,
  onConfirm,
  onCancel,
}: FederisConfirmModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Échap = annulation (hors traitement en cours).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;
  const t = TONES[tone];

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Arrière-plan — clic = annulation */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => !loading && onCancel()}
      />

      <div
        ref={cardRef}
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
      >
        {/* Bande supérieure colorée (identité du ton) */}
        <div
          className={cn(
            'h-1.5 w-full',
            tone === 'gold'
              ? 'bg-gradient-to-r from-amber-400 to-amber-600'
              : tone === 'emerald'
                ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                : tone === 'red'
                  ? 'bg-gradient-to-r from-red-400 to-red-600'
                  : 'bg-gradient-to-r from-blue-800 to-blue-900',
          )}
        />

        <div className="p-6 space-y-5">
          {/* En-tête : icône en pastille + titre + fermeture */}
          <div className="flex items-start gap-4">
            {Icon && (
              <span
                className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
                  t.pill,
                )}
              >
                <Icon className={cn('w-6 h-6', t.icon)} />
              </span>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-blue-900 leading-snug">{title}</h3>
              <div className="text-xs text-slate-500 mt-1.5 leading-relaxed">{message}</div>
            </div>
            <button
              onClick={() => !loading && onCancel()}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 shrink-0"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Données clés — lignes libellé / valeur */}
          {details && details.length > 0 && (
            <div className="bg-[#f7f9fc] border border-slate-200 rounded-xl overflow-hidden">
              {details.map((d, i) => (
                <div
                  key={d.label}
                  className={cn(
                    'flex items-center justify-between gap-4 px-4 py-2.5',
                    i < details.length - 1 && 'border-b border-slate-200',
                  )}
                >
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    {d.label}
                  </span>
                  <span className="text-xs font-bold text-blue-900 text-right">{d.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Note d'information */}
          {note && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-900 mt-1.5 shrink-0" />
              <p className="text-[11px] text-blue-900 leading-relaxed">{note}</p>
            </div>
          )}

          {/* Avertissement */}
          {warning && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
              <p className="text-[11px] text-amber-800 leading-relaxed">{warning}</p>
            </div>
          )}

          {/* ⭐ T26 — Contenu additionnel (sélecteurs, options…). */}
          {children}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => !loading && onCancel()}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              autoFocus
              className={cn(
                'px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50 inline-flex items-center gap-2',
                t.btn,
              )}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Traitement…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
