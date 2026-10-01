/**
 * Années scolaires ACTIVES d'un périmètre — helper FEUILLE (zéro import).
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⭐ FIX CRITIQUE (2026-10-01 — crash-loop Railway, deploy T54) :
 * cette fonction vivait dans federis-scope.service.ts et était importée
 * par federis-patronat.service.ts. Or federis-scope.service importe la
 * classe FederisPatronatService pour l'injection DI : les deux fichiers
 * se requéraient mutuellement (IMPORT CIRCULAIRE au niveau des modules).
 * Avec le builder SWC (emitDecoratorMetadata), le chargement de
 * federis-scope.service en pleine initialisation de
 * federis-patronat.service plantait le BOOT au démarrage :
 *   « ReferenceError: Cannot access 'FederisPatronatService' before
 *     initialization » — crash en boucle du conteneur Railway.
 *
 * → extraite dans ce module FEUILLE, exactement comme :
 *   - federis-exam-matching.ts (fix cycle du 2026-09-30) ;
 *   - chunkInPacks dans federis-grades.service.ts (T55).
 *
 * Chaque patronat a son propre tenant et ses propres lignes d'année : on
 * retient, par tenant du périmètre, l'année portant le MÊME libellé que
 * l'année active de référence (repli : année active du tenant).
 */
export async function resolveScopeYearsFor(
  // PrismaService typé `any` : le client local du sandbox n'est pas régénéré
  // (les delegates patronat/academicYear manquent) — en production le
  // postinstall (prisma generate) fournit le client complet.
  prisma: any,
  referenceTenantId: string,
  scopeTenantIds: string[],
): Promise<{ yearIds: string[]; label: string | null }> {
  const reference = await prisma.academicYear.findFirst({
    where: { tenantId: referenceTenantId, isActive: true },
    orderBy: { startDate: 'desc' },
  });

  const yearIds: string[] = [];
  if (reference) yearIds.push(reference.id);

  for (const tenantId of scopeTenantIds) {
    const match = await prisma.academicYear.findFirst({
      where: { tenantId, isActive: true, ...(reference ? { label: reference.label } : {}) },
    });
    const fallback = match
      ? match
      : await prisma.academicYear.findFirst({
          where: { tenantId, isActive: true },
          orderBy: { startDate: 'desc' },
        });
    if (fallback && !yearIds.includes(fallback.id)) yearIds.push(fallback.id);
  }

  return { yearIds, label: reference?.label ?? null };
}
