'use client';

import GeneralExamFeesContent from '@/components/finance/GeneralExamFeesContent';

/**
 * ⭐ ANCIENNE ROUTE « FRAIS DES EXAMENS » — /app/finance/exam-fees
 *
 * ⭐ Fusion (nov. 2026, demande promoteur) : l'onglet « Frais des examens »
 *    est devenu le SOUS-ONGLET « Frais des examens » de l'onglet unique
 *    « Frais généraux » (route /app/finance/general-fees). Cette route rend
 *    le même composant avec le sous-onglet examens pré-sélectionné afin que
 *    les liens et favoris existants continuent de fonctionner.
 *    Si l'école n'a aucun examen national éligible, le composant replie
 *    automatiquement sur le sous-onglet « Frais généraux ».
 */
export default function ExamFeesPage() {
  return <GeneralExamFeesContent initialSubTab="exam" />;
}
