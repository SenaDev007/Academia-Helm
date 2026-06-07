/**
 * ============================================================================
 * PRISMA HELPERS — Compatibilité PrismaPg Adapter
 * ============================================================================
 *
 * Avec l'adaptateur PrismaPg (@prisma/adapter-pg), les fonctionnalités Prisma
 * suivantes NE fonctionnent PLUS automatiquement :
 *   - @default(uuid())       → l'UUID n'est pas généré côté client
 *   - @default(now())        → le timestamp n'est pas généré côté client
 *   - @updatedAt             → le timestamp n'est pas mis à jour automatiquement
 *
 * Ces helpers garantissent que les valeurs sont toujours fournies explicitement
 * dans les appels prisma.xxx.create() / prisma.xxx.update().
 *
 * ⚠️ IMPORTANT : Tous les modèles n'ont pas les mêmes champs !
 *   - La plupart des modèles ont : id, createdAt, updatedAt
 *   - Certains modèles n'ont PAS createdAt (ex: StaffNumberSequence, JobNumberSequence)
 *   - Certains modèles n'ont PAS updatedAt (ex: HrTalentPool, AcademicProfile, CandidateDocument)
 *
 * Utilisez le helper approprié selon le modèle cible.
 * ============================================================================
 */

import { randomUUID } from 'crypto';

/** Génère un UUID v4 (remplace @default(uuid()) dans les appels create). */
export function uuid(): string {
  return randomUUID();
}

/** Horodatage actuel (remplace @updatedAt / @default(now()) dans les appels). */
export function now(): Date {
  return new Date();
}

/**
 * Champs à inclure dans prisma.xxx.create() pour les modèles STANDARD
 * qui ont id + createdAt + updatedAt (la majorité des modèles).
 *
 * ⚠️ Ne PAS utiliser pour les modèles sans createdAt ou sans updatedAt !
 * Utilisez prismaCreateId() + les champs manuels à la place.
 *
 * @example
 * prisma.staff.create({
 *   data: {
 *     ...prismaCreateDefaults(),
 *     tenantId: '...',
 *     firstName: '...',
 *   },
 * })
 */
export function prismaCreateDefaults(): { id: string; updatedAt: Date; createdAt: Date } {
  return { id: uuid(), updatedAt: now(), createdAt: now() };
}

/**
 * Champs minimaux pour les modèles qui n'ont QUE id + updatedAt (SANS createdAt).
 * Exemples : StaffNumberSequence, JobNumberSequence
 *
 * @example
 * tx.staffNumberSequence.upsert({
 *   create: { ...prismaCreateNoCreatedAt(), tenantId, current: 1 },
 * })
 */
export function prismaCreateNoCreatedAt(): { id: string; updatedAt: Date } {
  return { id: uuid(), updatedAt: now() };
}

/**
 * Champs minimaux pour les modèles qui n'ont QUE id + createdAt (SANS updatedAt).
 * Exemples : HrTalentPool, AcademicProfile, CandidateDocument
 *
 * @example
 * tx.hrTalentPool.create({
 *   data: { ...prismaCreateNoUpdatedAt(), candidateId, category, status },
 * })
 */
export function prismaCreateNoUpdatedAt(): { id: string; createdAt: Date } {
  return { id: uuid(), createdAt: now() };
}

/**
 * Champs à inclure systématiquement dans tout appel prisma.xxx.update()
 * pour pallier l'absence de @updatedAt avec PrismaPg.
 *
 * @example
 * prisma.staff.update({
 *   where: { id },
 *   data: {
 *     ...prismaUpdateDefaults(),
 *     firstName: '...',
 *   },
 * })
 */
export function prismaUpdateDefaults(): { updatedAt: Date } {
  return { updatedAt: now() };
}
