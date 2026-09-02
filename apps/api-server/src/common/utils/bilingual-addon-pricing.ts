/**
 * ============================================================================
 * BILINGUAL ADD-ON PRICING — SOURCE CENTRALE (DB) DU TARIF BILINGUE
 * ============================================================================
 *
 * Tarif de l'option bilingue FR/EN : UNE seule source de vérité en base,
 * contrôlable depuis le back-office (https://admin.academiahelm.com →
 * Abonnements & Plans → carte « BILINGUAL — Option bilingue FR/EN »).
 *
 * Priorité de résolution :
 *   1. pricing_plans (code = 'BILINGUAL', isActive)  ← LE point de contrôle
 *      back-office (champs bilingualMonthly / bilingualYearly).
 *   2. pricing_configs (isActive = true)             ← fallback versionné
 *      (bilingualMonthlyAddon / bilingualYearlyAddon, POST /admin/pricing/config).
 *   3. Valeurs par défaut codées                     ← dernier recours si la
 *      base est vide : 5 000 FCFA/mois de référence → 50 000 FCFA/an,
 *      soit 2 mois offerts (12 × 5 000 = 60 000 → 50 000).
 *
 * ⚠️ Règle : ne plus jamais coder le tarif bilingue « 50 000 » en dur dans
 *    les services. Toujours passer par getBilingualAddonPrice(prisma).
 *
 * Le résultat est mis en cache 60 secondes (lu à chaud par la page publique
 * /tarification, le wizard d'onboarding, la facturation et l'onglet
 * « Bilingue » des paramètres). Toute écriture sur pricing_plans ou
 * pricing_configs DOIT appeler invalidateBilingualAddonPriceCache().
 */

import { PrismaService } from '../../database/prisma.service';

export type BilingualAddonSource = 'PLAN' | 'CONFIG' | 'DEFAULT';

export interface BilingualAddonPrice {
  /** Tarif mensuel de référence (FCFA) — null = pas d'affichage mensuel */
  monthly: number | null;
  /** Tarif annuel réellement facturé (FCFA) — seul cycle facturable (contrat Article 4) */
  yearly: number;
  currency: string;
  /** D'où vient le tarif : plan add-on BILINGUAL, pricing_configs, ou défaut */
  source: BilingualAddonSource;
  /** Mois offerts si annuel < 12 × mensuel (ex. 50 000 vs 60 000 → 2) */
  monthsFree: number;
}

/**
 * Dernier recours — aligné sur le tarif officiel :
 * 5 000 FCFA/mois de référence → 50 000 FCFA/an (2 mois offerts).
 */
export const BILINGUAL_ADDON_DEFAULTS: BilingualAddonPrice = {
  monthly: 5000,
  yearly: 50000,
  currency: 'XOF',
  source: 'DEFAULT',
  monthsFree: 2,
};

const CACHE_TTL_MS = 60_000;
let cache: { value: BilingualAddonPrice; expiry: number } | null = null;

function computeMonthsFree(monthly: number | null, yearly: number): number {
  if (!monthly || monthly <= 0) return 0;
  const saved = monthly * 12 - yearly;
  if (saved <= 0) return 0;
  // Arrondi vers le bas (prudent) : ne jamais surestimer la réduction.
  // Cas officiel : 5 000/mois → 50 000/an → 10 000 économisés = 2 mois offerts.
  const months = Math.floor(saved / monthly);
  return months >= 1 ? months : 0;
}

/**
 * Retourne le tarif courant de l'option bilingue (mensuel de référence +
 * annuel facturé), lu depuis la base avec cache de 60 s.
 *
 * @param prisma PrismaService (service global, injecté dans les services appelants)
 */
export async function getBilingualAddonPrice(prisma: PrismaService): Promise<BilingualAddonPrice> {
  const now = Date.now();
  if (cache && cache.expiry > now) {
    return cache.value;
  }

  // 1. Plan add-on BILINGUAL (pricing_plans) — contrôlé depuis le back-office
  try {
    const addonPlan = await prisma.pricingPlan.findFirst({
      where: { code: 'BILINGUAL', isActive: true },
      select: { bilingualMonthly: true, bilingualYearly: true },
    });
    if (addonPlan && (addonPlan.bilingualMonthly != null || addonPlan.bilingualYearly != null)) {
      const monthly =
        addonPlan.bilingualMonthly != null && Number(addonPlan.bilingualMonthly) > 0
          ? Number(addonPlan.bilingualMonthly)
          : null;
      const yearly =
        addonPlan.bilingualYearly != null && Number(addonPlan.bilingualYearly) > 0
          ? Number(addonPlan.bilingualYearly)
          : BILINGUAL_ADDON_DEFAULTS.yearly;
      const value: BilingualAddonPrice = {
        monthly,
        yearly,
        currency: 'XOF',
        source: 'PLAN',
        monthsFree: computeMonthsFree(monthly, yearly),
      };
      cache = { value, expiry: now + CACHE_TTL_MS };
      return value;
    }
  } catch {
    // Table pricing_plans absente (base non migrée) → fallback
  }

  // 2. Config pricing active (pricing_configs) — fallback versionné
  try {
    const config = await prisma.pricingConfig.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
      select: { bilingualMonthlyAddon: true, bilingualYearlyAddon: true, currency: true },
    });
    if (config && (config.bilingualMonthlyAddon > 0 || config.bilingualYearlyAddon > 0)) {
      const monthly = config.bilingualMonthlyAddon > 0 ? config.bilingualMonthlyAddon : null;
      const yearly =
        config.bilingualYearlyAddon > 0 ? config.bilingualYearlyAddon : BILINGUAL_ADDON_DEFAULTS.yearly;
      const value: BilingualAddonPrice = {
        monthly,
        yearly,
        currency: config.currency || 'XOF',
        source: 'CONFIG',
        monthsFree: computeMonthsFree(monthly, yearly),
      };
      cache = { value, expiry: now + CACHE_TTL_MS };
      return value;
    }
  } catch {
    // Table pricing_configs absente → fallback
  }

  // 3. Dernier recours (défauts documentés)
  cache = { value: { ...BILINGUAL_ADDON_DEFAULTS }, expiry: now + CACHE_TTL_MS };
  return cache.value;
}

/**
 * Invalide le cache du tarif bilingue — À APPELER après toute écriture sur
 * pricing_plans (PATCH /platform/pricing-plans) ou pricing_configs
 * (POST /admin/pricing/config) pour que le nouveau tarif s'applique immédiatement.
 */
export function invalidateBilingualAddonPriceCache(): void {
  cache = null;
}
