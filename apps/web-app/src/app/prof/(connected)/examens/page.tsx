'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — ÉVALUATIONS & BULLETINS (MODULE MASQUÉ)
 * ============================================================================
 *
 * ⭐ 2026-10-16 (demande promoteur) : le module « Évaluation et bulletin » est
 *    MASQUÉ du portail autonome « Helm Enseignant » pour le moment — la saisie
 *    de notes et la génération de bulletins sont rattachées au fonctionnement
 *    d'une école (classes institutionnelles, périodes et référentiels de
 *    l'établissement), pas à l'espace autonome de l'enseignant non lié.
 *
 *    - Retiré de la navigation (ProfShell NAV_ITEMS) et des accès rapides du
 *      tableau de bord ;
 *    - Cette route REDIRIGE vers le tableau de bord (plus aucune entrée
 *      n'y mène, mais un lien/bookmark hérité ne doit pas afficher le module) ;
 *    - Le code fonctionnel complet est conservé dans l'historique Git
 *      (page d'origine de 570 lignes : création d'évaluation, saisie des
 *      notes via GradingSheet, génération des bulletins) — réactivable à
 *      tout moment en restaurant le fichier depuis Git.
 * ============================================================================
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ProfExamensPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/prof/dashboard');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400 mb-3" />
      <p className="text-sm font-medium text-slate-600">
        Le module Évaluations &amp; bulletins n&apos;est pas disponible pour le moment.
      </p>
      <p className="text-xs text-slate-400 mt-1">Redirection vers votre tableau de bord…</p>
    </div>
  );
}
