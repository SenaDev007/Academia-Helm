'use client';

/**
 * ============================================================================
 * CARD DESIGN PREVIEW — Panneau droit (60%) du sous-onglet "Paramètres Design"
 * ============================================================================
 *
 * Affiche un aperçu live de la carte scolaire avec :
 *   - Switch recto / verso (2 boutons)
 *   - IdCardVisual en mode "editable" (utilise les settings actuels)
 *   - Mise à jour temps réel quand les contrôles changent
 *   - Bouton "Aperçu PDF réel" qui ouvre un modal avec un iframe pointant
 *     vers /api/students/id-cards/:previewCardId/preview-html
 *
 * ⚠️ L'aperçu PDF réel nécessite une carte déjà générée. Si aucune carte
 *    n'est disponible (previewCardId vide), le bouton est désactivé et un
 *    message indique qu'il faut générer au moins une carte.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import {
  RotateCw,
  Eye,
  FileDown,
  Loader2,
  X,
  ExternalLink,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import IdCardVisual, { type TenantInfo } from './IdCardVisual';
import type { CardDesignSettings } from './card-design.types';

interface Props {
  settings: CardDesignSettings;
  /** Données factices d'une carte pour l'aperçu visuel (sans dépendance backend). */
  sampleCard: {
    cardNumber: string;
    qrPayload?: string;
    qrHash?: string;
    generatedAt: string;
    validUntil?: string;
    student: {
      firstName: string;
      lastName: string;
      matricule?: string;
      photoUrl?: string;
      dateOfBirth?: string;
      gender?: string;
    };
    guardian?: {
      firstName: string;
      lastName: string;
      phone: string;
      address: string;
    } | null;
    className: string;
    levelName: string;
    levelCode?: string;
    academicYearName?: string;
  };
  /** Id d'une carte réelle déjà générée (pour l'aperçu PDF iframe). */
  previewCardId?: string | null;
  /** Identité du tenant (nom école, logo, slogan…). */
  identity: TenantInfo | null;
  /** Contrôle du modal PDF (piloté par le parent CardDesignTab). */
  isPdfModalOpen: boolean;
  onOpenPdfModal?: () => void;
  onClosePdfModal: () => void;
}

export default function CardDesignPreview({
  settings,
  sampleCard,
  previewCardId,
  identity,
  isPdfModalOpen,
  onOpenPdfModal,
  onClosePdfModal,
}: Props) {
  const [face, setFace] = useState<'recto' | 'verso'>('recto');
  const [iframeLoading, setIframeLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // ─── Construit l'objet identity fusionné avec les settings édités ─────────
  // IdCardVisual lit identity.cardPrimaryColor, identity.cardShowPhoto, etc.
  // On fusionne donc les settings édités avec l'identity du tenant pour
  // obtenir un aperçu live sans toucher à l'identity stockée.
  const liveIdentity: TenantInfo | null = identity
    ? {
        ...identity,
        cardPrimaryColor: settings.cardPrimaryColor,
        cardShowQRCode: settings.cardShowQRCode,
        cardShowPhoto: settings.cardShowPhoto,
        cardShowGuardian: settings.cardShowGuardian,
        cardShowEmergencyCall: settings.cardShowEmergencyCall,
        cardShowSchoolAddress: settings.cardShowSchoolAddress,
        cardConditionsText: settings.cardConditionsText,
        maternelleSingleExit: settings.maternelleSingleExit,
        maternellePickupMorning: settings.maternellePickupMorning,
        maternellePickupAfternoon: settings.maternellePickupAfternoon,
        maternelleSingleExitTime: settings.maternelleSingleExitTime,
      }
    : null;

  // ─── Ouvrir le modal PDF : construit l'URL BFF ────────────────────────────
  useEffect(() => {
    if (isPdfModalOpen && previewCardId) {
      setIframeLoading(true);
      setPreviewUrl(`/api/students/id-cards/${encodeURIComponent(previewCardId)}/preview-html`);
    }
  }, [isPdfModalOpen, previewCardId]);

  const canPreviewPdf = Boolean(previewCardId);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ─── En-tête : titre + switch recto/verso + bouton PDF ─── */}
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-800">Aperçu live</h3>
          <Badge variant="outline" className="text-[9px] uppercase tracking-wide">
            {face === 'recto' ? 'Recto' : 'Verso'}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Switch Recto / Verso */}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
            <button
              type="button"
              onClick={() => setFace('recto')}
              className={cn(
                'px-3 py-1 rounded-md text-[11px] font-bold transition',
                face === 'recto'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              Recto
            </button>
            <button
              type="button"
              onClick={() => setFace('verso')}
              className={cn(
                'px-3 py-1 rounded-md text-[11px] font-bold transition',
                face === 'verso'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              Verso
            </button>
          </div>
          {/* Bouton rotation */}
          <button
            type="button"
            onClick={() => setFace(f => (f === 'recto' ? 'verso' : 'recto'))}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
            title="Basculer recto/verso"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          {/* Bouton PDF réel — délègue l'ouverture au parent */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => (canPreviewPdf ? onOpenPdfModal?.() : null)}
            disabled={!canPreviewPdf}
            className="text-xs"
            title={
              canPreviewPdf
                ? 'Aperçu PDF réel (rendu backend Puppeteer)'
                : 'Aucune carte générée — générez au moins une carte pour prévisualiser le PDF réel'
            }
          >
            <FileDown className="w-3.5 h-3.5" />
            Aperçu PDF réel
          </Button>
        </div>
      </div>

      {/* ─── Corps : carte visuelle centrée ─── */}
      <div className="p-6 bg-slate-50">
        <div className="max-w-md mx-auto">
          <IdCardVisual
            card={{
              cardNumber: sampleCard.cardNumber,
              qrPayload: sampleCard.qrPayload,
              qrHash: sampleCard.qrHash,
              generatedAt: sampleCard.generatedAt,
              validUntil: sampleCard.validUntil,
              student: sampleCard.student,
              guardian: sampleCard.guardian,
              className: sampleCard.className,
              levelName: sampleCard.levelName,
              levelCode: sampleCard.levelCode,
              academicYearName: sampleCard.academicYearName,
            }}
            face={face}
            identity={liveIdentity}
          />
        </div>

        {/* Indicateur template actif */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-500">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: settings.cardPrimaryColor }} />
          Template actif : <strong className="text-slate-700">{settings.templateKey || 'CLASSIQUE'}</strong>
          <span className="text-slate-300">·</span>
          <span>Mise à jour temps réel</span>
        </div>

        {!canPreviewPdf && (
          <div className="mt-3 max-w-md mx-auto p-2 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700">
              <strong>Aperçu PDF réel indisponible.</strong> Aucune carte n'a encore été générée.
              Générez au moins une carte dans l'onglet « Liste & Génération » pour activer l'aperçu
              PDF backend (rendu Puppeteer identique à l'impression).
            </p>
          </div>
        )}
      </div>

      {/* ═══ Modal : Aperçu PDF réel (iframe) — piloté par le parent ═══ */}
      {isPdfModalOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !iframeLoading && onClosePdfModal()}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileDown className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Aperçu PDF réel — rendu backend
                </h3>
                {iframeLoading && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}
              </div>
              <div className="flex items-center gap-1.5">
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ouvrir
                  </a>
                )}
                <button
                  type="button"
                  onClick={onClosePdfModal}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 relative">
              {previewUrl && (
                <iframe
                  src={previewUrl}
                  title="Aperçu PDF réel de la carte scolaire"
                  className="w-full h-full border-0"
                  onLoad={() => setIframeLoading(false)}
                />
              )}
              {iframeLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                  <div className="text-center">
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Chargement de l'aperçu backend…</p>
                  </div>
                </div>
              )}
            </div>
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
              <p className="text-[10px] text-slate-500">
                ⚠️ Cet aperçu est généré par le backend (Puppeteer) à partir des paramètres
                actuels du <strong>TenantIdentityProfile</strong>. Pour refléter vos modifications,
                pensez à <strong>enregistrer</strong> avant de rouvrir l'aperçu.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
