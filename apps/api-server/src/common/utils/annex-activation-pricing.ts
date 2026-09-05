/**
 * ============================================================================
 * ANNEX ACTIVATION PRICING — TARIFICATION ÉCHELONNÉE DU COÛT D'ACTIVATION
 * ============================================================================
 *
 * ⭐ Barème progressif automatique (coût d'activation, contrat Article 4) :
 *
 *   Rang 1 (école principale)  : tarif plein   100 %  →  500 000 FCFA
 *   Rang 2 (2e école du groupe): remise 15 %           →  425 000 FCFA
 *   Rang 3 (3e école)          : remise 20 %           →  400 000 FCFA
 *   Rang 4 (4e école)          : remise 25 %           →  375 000 FCFA
 *   Rang 5 et +                : TARIFICATION NÉGOCIÉE (aucun tarif automatique —
 *                                la plateforme convient d'un tarif ad hoc avec
 *                                le promoteur ; le libre-service s'arrête à 4 écoles).
 *
 * Le barème s'applique UNIQUEMENT au coût d'activation — les frais annuels du
 * plan et l'option bilingue restent au tarif plein, PAR ÉCOLE.
 *
 * Le rang = position de l'école dans le groupe (écoles déjà gérées + 1).
 * Il est appliqué :
 *   - à l'onboarding multi-écoles (signup) : école 1 = rang 1, annexes
 *     déclarées = rangs 2..N ;
 *   - à la création d'annexe depuis les paramètres : rang = nombre d'écoles
 *     déjà gérées + 1 ;
 *   - au contrat (numérique + PDF), à l'éligibilité et au snapshot de prix.
 */

/** Base de calcul par défaut (contrat Article 4 — pricing_plans.initialFee). */
export const ANNEX_ACTIVATION_BASE_FEE = 500000;

/** Remise (en %) appliquée au coût d'activation selon le rang de l'école. */
export const ANNEX_ACTIVATION_DISCOUNTS: Record<number, number> = {
  1: 0, // école principale — tarif plein
  2: 15,
  3: 20,
  4: 25,
};

/** À partir de ce rang : tarification négociée (pas de tarif automatique). */
export const ANNEX_NEGOTIATED_RANK = 5;

export interface AnnexActivationPricing {
  /** Rang de l'école dans le groupe (1 = principale). */
  rank: number;
  /** Tarif de base avant remise (FCFA). */
  baseFee: number;
  /** Tarif applicable (FCFA) — null en tarification négociée. */
  fee: number | null;
  /** Remise appliquée (0 / 15 / 20 / 25) — 0 si négocié. */
  discountPercent: number;
  /** true = tarification négociée (rang ≥ 5). */
  negotiated: boolean;
}

/**
 * Tarif d'activation pour l'école de rang `rank`.
 *
 * @param rank    Rang de l'école (1 = école principale, 2 = 2e école…)
 * @param baseFee Tarif de base (défaut 500 000 FCFA — pricing_plans.initialFee)
 */
export function getAnnexActivationPricing(
  rank: number,
  baseFee: number = ANNEX_ACTIVATION_BASE_FEE,
): AnnexActivationPricing {
  const r = Math.max(1, Math.round(rank));
  const base = Number(baseFee) > 0 ? Math.round(Number(baseFee)) : ANNEX_ACTIVATION_BASE_FEE;
  if (r >= ANNEX_NEGOTIATED_RANK) {
    return { rank: r, baseFee: base, fee: null, discountPercent: 0, negotiated: true };
  }
  const discountPercent = ANNEX_ACTIVATION_DISCOUNTS[r] ?? 0;
  const fee = Math.round((base * (100 - discountPercent)) / 100);
  return { rank: r, baseFee: base, fee, discountPercent, negotiated: false };
}

/** Ligne du barème par rang (contrat Article 3/4 — audit + affichage). */
export interface AnnexActivationTier {
  rank: number;
  fee: number;
  discountPercent: number;
}

/**
 * Barème d'activation d'un groupe de `schoolsCount` établissements :
 * frais d'activation par rang (1..N) + total du groupe.
 *
 * ⚠️ Rangs ≥ 5 : tarification négociée — le total n'est PAS calculable
 * automatiquement (total = null, la ligne est exclue du barème). Les flux
 * libre-service bloquent avant (selectPlan / createAnnexDraft) ; cette
 * fonction est le calcul de référence pour les contrats et snapshots.
 */
export function getGroupActivationTiers(
  schoolsCount: number,
  baseFee: number = ANNEX_ACTIVATION_BASE_FEE,
): { tiers: AnnexActivationTier[]; total: number | null; negotiated: boolean } {
  const n = Math.max(1, Math.round(schoolsCount));
  const tiers: AnnexActivationTier[] = [];
  let total = 0;
  for (let rank = 1; rank <= n; rank++) {
    const pricing = getAnnexActivationPricing(rank, baseFee);
    if (pricing.negotiated) {
      // Rang ≥ 5 : tarification négociée — pas de tarif automatique.
      return { tiers, total: null, negotiated: true };
    }
    tiers.push({ rank, fee: pricing.fee as number, discountPercent: pricing.discountPercent });
    total += pricing.fee as number;
  }
  return { tiers, total, negotiated: false };
}

/** Message standard de la tarification négociée (rang ≥ 5). */
export const ANNEX_NEGOTIATED_MESSAGE =
  "À partir de la 5e école, la tarification du coût d'activation est négociée " +
  'avec Academia Helm (barème automatique limité à 4 établissements : ' +
  '500 000 FCFA la 1re école, −15 % la 2e, −20 % la 3e, −25 % la 4e). ' +
  'Contactez support@academiahelm.com pour convenir d\'un tarif de groupe.';
