/**
 * ============================================================================
 * STUDENT ANALYTICS CONTENT — ORION, Stats & Audit
 * ============================================================================
 *
 * ⭐ En cours d'implémentation.
 *    Le contenu original (stats, alertes, graphiques, liste de tâches) a été
 *    supprimé du rendu. Il sera réactivé quand les fonctionnalités seront prêtes.
 * ============================================================================
 */

'use client';

import { Activity } from 'lucide-react';

export default function StudentAnalyticsContent() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-8 flex flex-col items-center text-center">
        <div className="p-4 bg-blue-50 rounded-full mb-4">
          <Activity className="w-10 h-10 text-blue-400" />
        </div>
        <h3 className="text-base font-bold text-slate-700 mb-2">En cours d'implémentation</h3>
        <p className="text-sm text-slate-500 max-w-md">
          Les fonctionnalités ORION, Stats &amp; Audit sont en cours de développement.
          Elles seront disponibles prochainement.
        </p>
      </div>
    </div>
  );
}
