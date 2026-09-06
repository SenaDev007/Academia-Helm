'use client';

import GeneralFeesContent from '@/components/finance/GeneralFeesContent';

/**
 * ⭐ ONGLET « FRAIS GÉNÉRAUX » (juste après Comptes élèves) — route /app/finance/general-fees
 * Listing par élève : dus / payé / solde pour l'année scolaire, avec déduction
 * automatique après chaque encaissement (même mécanique que Comptes élèves).
 */
export default function GeneralFeesPage() {
  return <GeneralFeesContent />;
}
