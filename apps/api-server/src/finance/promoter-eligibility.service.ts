/**
 * Service pour gérer l'éligibilité "paiement fondateur".
 * ⭐ Les colonnes de promoter_payment_eligibility sont en minuscules dans PostgreSQL
 *    (studentid, academicyearid, isactive, etc.) car la migration SQL ne les
 *    avait pas créées avec guillemets doubles. Les requêtes raw utilisent donc
 *    les noms en minuscules.
 */
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

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

  async activate(tenantId: string, userId: string, dto: PromoterEligibilityDto): Promise<{ success: boolean; id: string }> {
    if (!dto.motif?.trim()) {
      throw new BadRequestException('Le motif est obligatoire');
    }

    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!student) {
      throw new NotFoundException('Élève introuvable');
    }

    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, isactive FROM promoter_payment_eligibility
       WHERE tenantid = $1 AND studentid = $2 AND academicyearid = $3
       LIMIT 1`,
      tenantId, dto.studentId, dto.academicYearId,
    );

    if (existing && existing.length > 0) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE promoter_payment_eligibility
         SET isactive = TRUE, motif = $4, expecteddate = $5,
             updatedbyid = $6, updatedat = now(),
             deactivatedat = NULL, deactivatedbyid = NULL
         WHERE id = $7`,
        tenantId, dto.studentId, dto.academicYearId,
        dto.motif, dto.expectedDate || null, userId, existing[0].id,
      );
      this.logger.log(`Re-activated promoter eligibility for student ${dto.studentId}`);
      return { success: true, id: existing[0].id };
    }

    const result = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO promoter_payment_eligibility
       (tenantid, studentid, academicyearid, isactive, motif, expecteddate, createdbyid, createdat)
       VALUES ($1, $2, $3, TRUE, $4, $5, $6, now())
       RETURNING id`,
      tenantId, dto.studentId, dto.academicYearId,
      dto.motif, dto.expectedDate || null, userId,
    );
    this.logger.log(`Created promoter eligibility for student ${dto.studentId}`);
    return { success: true, id: result[0].id };
  }

  async deactivate(tenantId: string, userId: string, studentId: string, academicYearId: string): Promise<{ success: boolean }> {
    const result = await this.prisma.$executeRawUnsafe(
      `UPDATE promoter_payment_eligibility
       SET isactive = FALSE, deactivatedat = now(), deactivatedbyid = $4,
           updatedat = now(), updatedbyid = $4
       WHERE tenantid = $1 AND studentid = $2 AND academicyearid = $3 AND isactive = TRUE`,
      tenantId, studentId, academicYearId, userId,
    );
    if (result === 0) {
      throw new NotFoundException('Eligibilité non trouvée ou déjà désactivée');
    }
    this.logger.log(`Deactivated promoter eligibility for student ${studentId}`);
    return { success: true };
  }

  async listActive(tenantId: string, academicYearId: string): Promise<PromoterEligibilityRow[]> {
    // ⭐ Utiliser les noms de colonnes en minuscules (PostgreSQL convention)
    //    et alias avec guillemets doubles pour le mapping côté TypeScript
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT
         pe.id, pe.studentid, pe.academicyearid, pe.motif,
         pe.expecteddate, pe.isactive, pe.createdat,
         s."firstName", s."lastName", s.matricule,
         c.name as classname,
         u."firstName" as userfirstname, u."lastName" as userlastname
       FROM promoter_payment_eligibility pe
       INNER JOIN students s ON s.id = pe.studentid
       LEFT JOIN classes c ON c.id = (
         SELECT se."classId" FROM student_enrollments se
         WHERE se."studentId" = pe.studentid
           AND se."academicYearId" = pe.academicyearid
         LIMIT 1
       )
       LEFT JOIN users u ON u.id = pe.createdbyid
       WHERE pe.tenantid = $1
         AND pe.academicyearid = $2
         AND pe.isactive = TRUE
       ORDER BY pe.createdat DESC`,
      tenantId, academicYearId,
    );

    return rows.map((r) => {
      const userFirstName = r.userfirstname || '';
      const userLastName = r.userlastname || '';
      const createdByName = `${userFirstName} ${userLastName}`.trim();
      return {
        id: r.id,
        studentId: r.studentid,
        studentName: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
        studentMatricule: r.matricule || '',
        className: r.classname || '—',
        academicYearId: r.academicyearid,
        motif: r.motif,
        expectedDate: r.expecteddate ? new Date(r.expecteddate).toISOString() : null,
        isActive: r.isactive,
        createdAt: r.createdat ? new Date(r.createdat).toISOString() : '',
        createdByName,
      };
    });
  }

  async getActiveStudentIds(tenantId: string, academicYearId: string): Promise<Set<string>> {
    const rows = await this.prisma.$queryRawUnsafe<{ studentid: string }[]>(
      `SELECT studentid FROM promoter_payment_eligibility
       WHERE tenantid = $1 AND academicyearid = $2 AND isactive = TRUE`,
      tenantId, academicYearId,
    );
    return new Set(rows.map((r) => r.studentid));
  }

  async isEligible(tenantId: string, studentId: string, academicYearId: string): Promise<{ isActive: boolean; motif?: string; expectedDate?: string | null }> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT motif, expecteddate FROM promoter_payment_eligibility
       WHERE tenantid = $1 AND studentid = $2 AND academicyearid = $3 AND isactive = TRUE
       LIMIT 1`,
      tenantId, studentId, academicYearId,
    );
    if (rows.length === 0) {
      return { isActive: false };
    }
    return {
      isActive: true,
      motif: rows[0].motif,
      expectedDate: rows[0].expecteddate ? new Date(rows[0].expecteddate).toISOString() : null,
    };
  }
}
