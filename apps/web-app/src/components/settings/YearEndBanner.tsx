'use client';

import { useState, useMemo } from 'react';
import { AlertTriangle, FastForward, Loader2, RefreshCw } from 'lucide-react';
import * as settingsService from '@/services/settings.service';

interface Props {
  activeYear: any;
  tenantId?: string | null;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

/**
 * Bannière de fin d'année scolaire.
 *
 * S'affiche si l'année active se termine dans ≤ 30 jours ET que l'année
 * suivante n'existe pas encore. Propose à l'utilisateur de :
 *  - Préparer la prochaine année (générer sans activer)
 *  - Passer à l'année suivante (clôturer + activer + promouvoir les élèves)
 *
 * Si l'année est déjà terminée (now > endDate), affiche un message critique.
 */
export default function YearEndBanner({ activeYear, tenantId, showToast }: Props) {
  const [busy, setBusy] = useState<'generate' | 'promote' | null>(null);

  const { daysUntilEnd, isEnded } = useMemo(() => {
    if (!activeYear?.endDate) return { daysUntilEnd: null, isEnded: false };
    const now = new Date();
    const end = new Date(activeYear.endDate);
    const diffMs = end.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    return { daysUntilEnd: days, isEnded: days < 0 };
  }, [activeYear]);

  // Ne rien afficher si pas d'année active ou si la fin est > 30 jours
  if (!activeYear || daysUntilEnd === null || daysUntilEnd > 30) {
    return null;
  }

  const handleGenerateNext = async () => {
    setBusy('generate');
    try {
      const created = await settingsService.generateNextAcademicYear(tenantId);
      showToast('success', `Année ${created.name} préparée. Vous pouvez l'activer ou "Passer à l'année suivante" quand vous êtes prêt.`);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de la préparation de l\'année suivante');
    } finally {
      setBusy(null);
    }
  };

  const handlePromote = async () => {
    if (!confirm(
      `Passer à l'année suivante ? L'année ${activeYear.name} sera clôturée, ` +
      `la suivante activée, et tous les élèves actifs seront automatiquement promus.`
    )) {
      return;
    }
    setBusy('promote');
    try {
      const result = await settingsService.promoteAcademicYear(activeYear.id, tenantId);
      showToast(
        'success',
        `Année ${result.previousYearLabel} clôturée. Année ${result.nextYearLabel} activée. Les élèves ont été promus automatiquement.`,
      );
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors du passage à l\'année suivante');
    } finally {
      setBusy(null);
    }
  };

  // Style selon l'urgence
  const containerClass = isEnded
    ? 'bg-red-50 border-red-300'
    : daysUntilEnd <= 7
      ? 'bg-orange-50 border-orange-300'
      : 'bg-amber-50 border-amber-300';
  const titleClass = isEnded ? 'text-red-900' : daysUntilEnd <= 7 ? 'text-orange-900' : 'text-amber-900';
  const textClass = isEnded ? 'text-red-800' : daysUntilEnd <= 7 ? 'text-orange-800' : 'text-amber-800';
  const iconClass = isEnded ? 'text-red-600' : daysUntilEnd <= 7 ? 'text-orange-600' : 'text-amber-600';

  return (
    <div className={`border rounded-lg p-4 ${containerClass}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconClass}`} />
        <div className="flex-1">
          <h3 className={`text-sm font-semibold mb-1 ${titleClass}`}>
            {isEnded
              ? `Année ${activeYear.name} terminée — action requise`
              : `Année ${activeYear.name} se termine dans ${daysUntilEnd} jour${daysUntilEnd > 1 ? 's' : ''}`}
          </h3>
          <p className={`text-sm mb-3 ${textClass}`}>
            {isEnded
              ? "L'année scolaire active est terminée. Passez à l'année suivante pour permettre la saisie de nouvelles données (inscriptions, notes, paiements)."
              : "Préparez la transition vers la prochaine année scolaire dès maintenant pour éviter toute interruption de service."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePromote}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
            >
              {busy === 'promote' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FastForward className="w-3.5 h-3.5" />}
              Passer à l'année suivante
            </button>
            <button
              type="button"
              onClick={handleGenerateNext}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 disabled:opacity-50 text-sm font-medium"
            >
              {busy === 'generate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Préparer la prochaine année
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
