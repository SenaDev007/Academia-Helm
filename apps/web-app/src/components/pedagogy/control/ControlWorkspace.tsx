/**
 * ============================================================================
 * CONTROL WORKSPACE - MODULE PÉDAGOGIE (Validation Direction)
 * ============================================================================
 *
 * Refonte : interface de validation propre, conforme aux autres modules.
 *
 * Contenu :
 *   - En-tête propre avec titre + description + sélecteur année académique
 *   - Composant DirectorPedagogyControl (validation cahier journal,
 *     fiches pédagogiques, registres d'appel, évaluations mensuelles)
 *
 * Architecture :
 *   - Module Examen → Validation : registre d'appel + évaluation mensuelle
 *     (déjà géré par /app/exams/validation)
 *   - Module Pédagogie → Validation : cahier journal + fiches pédagogiques
 *     (géré ici par DirectorPedagogyControl)
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { DirectorPedagogyControl } from '../production/DirectorPedagogyControl';
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAppSession } from '@/contexts/AppSessionContext';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { cn } from '@/lib/utils';

export default function ControlWorkspace() {
  const { academicYear, tenant } = useModuleContext();
  const { user } = useAppSession();
  const [isOffline, setIsOffline] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const cleanup = networkDetectionService.onNetworkStatusChange((online) => {
      setIsOffline(!online);
    });
    setIsOffline(!networkDetectionService.isConnected());
    return cleanup;
  }, []);

  const refresh = () => setRefreshKey(k => k + 1);

  if (!academicYear?.id) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <ShieldCheck className="h-6 w-6 mr-2 animate-pulse" />
        Chargement de l'année académique…
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* ⭐ Bandeau hors ligne */}
      {isOffline && (
        <div className="bg-amber-50 text-amber-800 p-4 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <p className="text-sm font-medium">
            Vous êtes en mode hors ligne. Certaines données peuvent ne pas être à jour.
          </p>
        </div>
      )}

      {/* ⭐ En-tête propre (conforme aux autres modules) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 border border-blue-100">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Validation Pédagogique
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Validez les cahiers journal, fiches pédagogiques, registres d'appel et
                évaluations mensuelles soumis par les enseignants.
                {academicYear?.label && (
                  <span className="ml-1 text-slate-400">— Année {academicYear.label}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold text-slate-700 transition-colors"
            title="Rafraîchir les données"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>

        {/* ⭐ Légende statuts */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Légende :</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
            <span className="text-xs text-slate-600">Brouillon</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span className="text-xs text-slate-600">Soumis (à valider)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-xs text-slate-600">Validé</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span className="text-xs text-slate-600">Rejeté</span>
          </div>
        </div>
      </div>

      {/* ⭐ Composant de validation (DirectorPedagogyControl) */}
      <DirectorPedagogyControl
        key={refreshKey}
        tenantId={tenant?.id || ''}
        academicYearId={academicYear?.id || ''}
        userId={user?.id || ''}
      />

      {/* ⭐ Note informative sur l'architecture */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Architecture de validation</p>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li>
                <strong>Module Pédagogie → Validation</strong> (ici) : cahier journal +
                fiches pédagogiques soumis par les enseignants.
              </li>
              <li>
                <strong>Module Examen → Validation</strong> :
                registres d'appel + évaluations mensuelles classés par trimestre, classe,
                et évaluation.
              </li>
              <li>
                Les soumissions sont catégorisées par <strong>classe</strong> pour faciliter
                la validation.
              </li>
              <li>
                Le directeur reçoit automatiquement une notification (email + WhatsApp + SMS)
                à chaque soumission.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
