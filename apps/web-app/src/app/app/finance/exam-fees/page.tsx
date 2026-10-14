'use client';

import ExamFeesContent from '@/components/finance/ExamFeesContent';

/**
 * ⭐ ONGLET « FRAIS DES EXAMENS » (juste après Frais généraux) — route /app/finance/exam-fees
 * Suivi dédié des frais d'examen (CEP / BEPC / Baccalauréat / CAP) par élève :
 * dus / payé / solde pour l'année scolaire, avec déduction automatique après
 * chaque encaissement (même mécanique que Frais généraux / Comptes élèves).
 * Sous-onglets dynamiques selon les niveaux activés (Paramètres > Structure).
 */
export default function ExamFeesPage() {
  return <ExamFeesContent />;
}
