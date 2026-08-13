import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * ============================================================================
 * PROMOTER ELIGIBILITY SERVICE — Gestion des élèves "paiement fondateur"
 * ============================================================================
 *
 * Marque certains élèves comme "paiement direct au fondateur/promoteur".
 * Ces élèves sont exclus du sous-onglet "Encaissements standard" et
 * apparaissent dans un sous-onglet dédié "Reçu par le fondateur".
 *
 * ⭐ Multi-tenant strict : tenantId obligatoire sur toutes les requêtes.
 * ============================================================================
 */

export interface PromoterEligibilityDto {
  studentId: string;
  academicYearId: string;
  motif: string;
  expectedDate?: string;
}

export interface PromoterEligibilityRow {
  id: string;
  studentId: string;
  studentName: string;
  studentMatricule: string;
  className: string;
  academicYearId: string;
  motif: string;
  expectedDate: string | null;
  isActive: boolean;
  createdAt: string;
  createdByName: string;
}

@Injectable()
export class PromoterEligibilityService {
  private readonly logger = new Logger(PromoterEligibilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Active le flag "paiement fondateur" pour un élève.
   * Si déjà actif, met à jour le motif + expectedDate.
   */
  async activate(
    tenantId: string,
    userId: string,
    dto: PromoterEligibilityDto,
  ): Promise<{ success: boolean; id: string }> {
    if (!dto.motif?.trim()) {
      throw new BadRequestException('Le motif est obligatoire');
    }

    // Vérifier que l'élève existe et appartient au tenant
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!student) {
      throw new NotFoundException('Élève introuvable');
    }

    // Upsert : si une eligibility existe (active ou non), on la met à jour
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, "isActive" FROM promoter_payment_eligibility
       WHERE "tenantId" = $1 AND "studentId" = $2 AND "academicYearId" = $3
       LIMIT 1`,
      tenantId, dto.studentId, dto.academicYearId,
    );

    if (existing && existing.length > 0) {
      // Update
      await this.prisma.$executeRawUnsafe(
        `UPDATE promoter_payment_eligibility
         SET "isActive" = TRUE, motif = $4, "expectedDate" = $5,
             "updatedById" = $6, "updatedAt" = now(),
             "deactivatedAt" = NULL, "deactivatedById" = NULL
         WHERE id = $7`,
        tenantId, dto.studentId, dto.academicYearId,
        dto.motif, dto.expectedDate || null, userId, existing[0].id,
      );
      this.logger.log(`Re-activated promoter eligibility for student ${dto.studentId}`);
      return { success: true, id: existing[0].id };
    }

    // Insert
    const result = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO promoter_payment_eligibility
       ("tenantId", "studentId", "academicYearId", "isActive", motif, "expectedDate", "createdById", "createdAt")
       VALUES ($1, $2, $3, TRUE, $4, $5, $6, now())
       RETURNING id`,
      tenantId, dto.studentId, dto.academicYearId,
      dto.motif, dto.expectedDate || null, userId,
    );
    this.logger.log(`Created promoter eligibility for student ${dto.studentId}, motif: ${dto.motif}`);
    return { success: true, id: result[0].id };
  }

  /**
   * Désactive le flag (toggle off). L'élève revient dans la liste standard.
   */
  async deactivate(
    tenantId: string,
    userId: string,
    studentId: string,
    academicYearId: string,
  ): Promise<{ success: boolean }> {
    const result = await this.prisma.$executeRawUnsafe(
      `UPDATE promoter_payment_eligibility
       SET "isActive" = FALSE, "deactivatedAt" = now(), "deactivatedById" = $4,
           "updatedAt" = now(), "updatedById" = $4
       WHERE "tenantId" = $1 AND "studentId" = $2 AND "academicYearId" = $3 AND "isActive" = TRUE`,
      tenantId, studentId, academicYearId, userId,
    );
    if (result === 0) {
      throw new NotFoundException('Eligibilité non trouvée ou déjà désactivée');
    }
    this.logger.log(`Deactivated promoter eligibility for student ${studentId}`);
    return { success: true };
  }

  /**
   * Liste tous les élèves marqués "paiement fondateur" actifs pour un tenant + année.
   * Utilisé par le sous-onglet "Reçu par le fondateur".
   */
  async listActive(
    tenantId: string,
    academicYearId: string,
  ): Promise<PromoterEligibilityRow[]> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT
         pe.id, pe."studentId", pe."academicYearId", pe.motif,
         pe."expectedDate", pe."isActive", pe."createdAt",
         s."firstName", s."lastName", s."matricule",
         c.name as "className",
         u.name as "createdByName"
       FROM promoter_payment_eligibility pe
       INNER JOIN students s ON s.id = pe."studentId"
       LEFT JOIN classes c ON c.id = (
         SELECT se."classId" FROM student_enrollments se
         WHERE se."studentId" = pe."studentId"
           AND se."academicYearId" = pe."academicYearId"
         LIMIT 1
       )
       LEFT JOIN users u ON u.id = pe."createdById"
       WHERE pe."tenantId" = $1
         AND pe."academicYearId" = $2
         AND pe."isActive" = TRUE
       ORDER BY pe."createdAt" DESC`,
      tenantId, academicYearId,
    );

    return rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
      studentMatricule: r.matricule || '',
      className: r.className || '—',
      academicYearId: r.academicYearId,
      motif: r.motif,
      expectedDate: r.expectedDate ? new Date(r.expectedDate).toISOString() : null,
      isActive: r.isActive,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
      createdByName: r.createdByName || '',
    }));
  }

  /**
   * Récupère la liste des studentIds marqués "paiement fondateur" actifs.
   * Utilisé par collection-summary.controller.ts pour exclure ces élèves
   * du sous-onglet "Encaissements standard".
   */
  async getActiveStudentIds(
    tenantId: string,
    academicYearId: string,
  ): Promise<Set<string>> {
    const rows = await this.prisma.$queryRawUnsafe<{ studentId: string }[]>(
      `SELECT "studentId" FROM promoter_payment_eligibility
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "isActive" = TRUE`,
      tenantId, academicYearId,
    );
    return new Set(rows.map((r) => r.studentId));
  }

  /**
   * Vérifie si un élève spécifique est marqué "paiement fondateur".
   * Utilisé par le toggle sur la ligne de l'élève dans Compte Élèves.
   */
  async isEligible(
    tenantId: string,
    studentId: string,
    academicYearId: string,
  ): Promise<{ isActive: boolean; motif?: string; expectedDate?: string | null }> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT motif, "expectedDate" FROM promoter_payment_eligibility
       WHERE "tenantId" = $1 AND "studentId" = $2 AND "academicYearId" = $3 AND "isActive" = TRUE
       LIMIT 1`,
      tenantId, studentId, academicYearId,
    );
    if (rows.length === 0) {
      return { isActive: false };
    }
    return {
      isActive: true,
      motif: rows[0].motif,
      expectedDate: rows[0].expectedDate ? new Date(rows[0].expectedDate).toISOString() : null,
    };
  }
}
