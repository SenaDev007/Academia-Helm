/**
 * ============================================================================
 * LEVEL CATEGORY HELPER — catégorie de niveau scolaire (API)
 * ============================================================================
 * ⭐ 2026-11-26 (retour promoteur) — DOUBLE IDENTITÉ E-MAIL PAR NIVEAU :
 * les écoles combinées (maternelle/primaire + secondaire) ont DEUX adresses
 * d'envoi. Chaque e-mail part de la connexion du niveau concerné :
 *   - classe de l'élève (reçu, bulletin, relance de scolarité…) ;
 *   - niveau du membre du personnel (module RH).
 *
 * La catégorie se déduit du code/nom du niveau scolaire (school_levels) —
 * même détection que le front (useSecondaryLevelEnabled) :
 *   SECOND/COLLEGE/LYCÉE → SECONDARY ; tout le reste → MATERNAL_PRIMARY.
 * Sans information de niveau → MATERNAL_PRIMARY (connexion principale,
 * avec repli transparent côté envoi si la ligne n'existe pas).
 * ============================================================================
 */

import { PrismaService } from '../../database/prisma.service';

export type ApiEmailLevelCategory = 'MATERNAL_PRIMARY' | 'SECONDARY';

/** Catégorie d'un niveau scolaire à partir de son code et/ou nom. */
export function resolveEmailLevelCategory(
  ...codeOrNames: Array<string | null | undefined>
): ApiEmailLevelCategory {
  const raw = codeOrNames.filter(Boolean).join(' ').toUpperCase();
  if (/SECOND|COLL[EÈ]GE|LYC[EÉ]E/.test(raw)) return 'SECONDARY';
  return 'MATERNAL_PRIMARY';
}

/**
 * Catégorie du niveau de la CLASSE d'un élève pour l'année active
 * (dernière inscription trouvée). Repli MATERNAL_PRIMARY si introuvable.
 */
export async function resolveClassEmailLevelCategory(
  prisma: PrismaService,
  tenantId: string,
  studentId: string,
): Promise<ApiEmailLevelCategory> {
  try {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { studentId, tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        class: {
          select: { schoolLevel: { select: { code: true, name: true } } },
        },
      },
    });
    const level = (enrollment as any)?.class?.schoolLevel;
    return resolveEmailLevelCategory(level?.code, level?.name);
  } catch {
    return 'MATERNAL_PRIMARY';
  }
}

/**
 * Catégorie du niveau d'un membre du personnel (fiche Staff) — miroir de la
 * logique front staffLevelCategory : Staff.schoolLevel puis département/poste.
 */
export async function resolveStaffEmailLevelCategory(
  prisma: PrismaService,
  staffId: string,
): Promise<ApiEmailLevelCategory> {
  try {
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        schoolLevel: { select: { code: true, name: true } },
        department: true,
        position: true,
      },
    });
    if (!staff) return 'MATERNAL_PRIMARY';
    return resolveEmailLevelCategory(
      (staff as any).schoolLevel?.code,
      (staff as any).schoolLevel?.name,
      staff.department,
      staff.position,
    );
  } catch {
    return 'MATERNAL_PRIMARY';
  }
}
