/**
 * ============================================================================
 * PRISMA HELPERS — Compatibilité PrismaPg Adapter
 * ============================================================================
 *
 * Avec l'adaptateur PrismaPg (@prisma/adapter-pg), les fonctionnalités Prisma
 * suivantes NE fonctionnent PLUS automatiquement :
 *   - @default(uuid())       → l'UUID n'est pas généré côté client
 *   - @updatedAt             → le timestamp n'est pas mis à jour automatiquement
 *
 * Ces helpers garantissent que les valeurs sont toujours fournies explicitement
 * dans les appels prisma.xxx.create() / prisma.xxx.update().
 * ============================================================================
 */

import { randomUUID } from 'crypto';

/** Génère un UUID v4 (remplace @default(uuid()) dans les appels create). */
export function uuid(): string {
  return randomUUID();
}

/** Horodatage actuel (remplace @updatedAt dans les appels update). */
export function now(): Date {
  return new Date();
}

/**
 * Champs à inclure systématiquement dans tout appel prisma.xxx.create()
 * pour pallier l'absence de @default(uuid()) et @updatedAt avec PrismaPg.
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
