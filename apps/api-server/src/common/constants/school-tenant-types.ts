/**
 * ============================================================================
 * TYPES DE TENANT « ÉCOLE » — source unique de vérité
 * ============================================================================
 *
 * Le modèle Tenant.type vaut 'SCHOOL' par défaut, mais l'onboarding crée les
 * tenants avec le TYPE D'ÉTABLISSEMENT déclaré (MATERNELLE / PRIMAIRE /
 * SECONDAIRE / MIXTE — cf. OnboardingService.activate : `type: draft.schoolType`).
 *
 * ⚠️ Conséquence : filtrer `type: 'SCHOOL'` EXCLUT les écoles réelles créées
 * par l'onboarding (ex : « Le Palmares Plus », type MIXTE en production).
 * Tout périmètre « écoles d'un promoteur » (available-tenants, analytics,
 * éligibilité multi-écoles) doit utiliser ces helpers — jamais une comparaison
 * stricte à 'SCHOOL'.
 */

/** Types de tenant représentant un établissement scolaire (insensible à la casse). */
export const SCHOOL_TENANT_TYPES = [
  'SCHOOL',
  'MATERNELLE',
  'PRIMAIRE',
  'SECONDAIRE',
  'MIXTE',
] as const;

/** Filtre Prisma where pour les tenants école (casse-insensible). */
export const schoolTenantTypeFilter = () => ({
  in: SCHOOL_TENANT_TYPES as unknown as string[],
  mode: 'insensitive' as const,
});

/** Ce type de tenant représente-t-il une école ? */
export function isSchoolTenantType(type?: string | null): boolean {
  if (!type) return false;
  const normalized = String(type).trim().toUpperCase();
  return (SCHOOL_TENANT_TYPES as readonly string[]).includes(normalized);
}
