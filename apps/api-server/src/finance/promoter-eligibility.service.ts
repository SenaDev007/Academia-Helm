/**
 * Service pour gérer l'éligibilité "paiement fondateur".
 * ⭐ Les colonnes de promoter_payment_eligibility sont en minuscules dans PostgreSQL
 */
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface PromoterEligibilityDto {
  studentId: string;
  academicYearId: string;
  motif: string;
  expectedDate?: string;
  // ⭐ Montants détaillés (avance reçue par le fondateur)
  advanceAmount?: number;
  inscriptionExpected?: number;
  reinscriptionExpected?: number;
  tuitionExpected?: number;
  arrearExpected?: number;
  totalDue?: number;
  remainingAmount?: number;
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
  isSettled: boolean;
  createdAt: string;
  createdByName: string;
  // ⭐ Montants détaillés
  advanceAmount: number;
  inscriptionExpected: number;
  reinscriptionExpected: number;
  tuitionExpected: number;
  arrearExpected: number;
  totalDue: number;
  remainingAmount: number;
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
       WHERE tenantid = $1 AND studentid = $2 AND academicyearid = $3 LIMIT 1`,
      tenantId, dto.studentId, dto.academicYearId,
    );

    if (existing && existing.length > 0) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE promoter_payment_eligibility
         SET isactive = TRUE, motif = $4, expecteddate = $5,
             advanceamount = $6, inscriptionexpected = $7, reinscriptionexpected = $8,
             tuitionexpected = $9, arrearexpected = $10, totaldue = $11, remainingamount = $12,
             issettled = FALSE, settledat = NULL, settledbyid = NULL,
             updatedbyid = $13, updatedat = now(),
             deactivatedat = NULL, deactivatedbyid = NULL
         WHERE id = $14`,
        tenantId, dto.studentId, dto.academicYearId,
        dto.motif, dto.expectedDate || null,
        dto.advanceAmount || 0, dto.inscriptionExpected || 0, dto.reinscriptionExpected || 0,
        dto.tuitionExpected || 0, dto.arrearExpected || 0, dto.totalDue || 0, dto.remainingAmount || 0,
        userId, existing[0].id,
      );
      this.logger.log(`Re-activated promoter eligibility for student ${dto.studentId}`);
      return { success: true, id: existing[0].id };
    }

    const result = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO promoter_payment_eligibility
       (tenantid, studentid, academicyearid, isactive, motif, expecteddate,
        advanceamount, inscriptionexpected, reinscriptionexpected, tuitionexpected,
        arrearexpected, totaldue, remainingamount, issettled,
        createdbyid, createdat)
       VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7, $8, $9, $10, $11, $12, FALSE, $13, now())
       RETURNING id`,
      tenantId, dto.studentId, dto.academicYearId,
      dto.motif, dto.expectedDate || null,
      dto.advanceAmount || 0, dto.inscriptionExpected || 0, dto.reinscriptionExpected || 0,
      dto.tuitionExpected || 0, dto.arrearExpected || 0, dto.totalDue || 0, dto.remainingAmount || 0,
      userId,
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
    // ⭐ Retour promoteur (nov. 2026) : le sous-onglet « Reçu par le
    //    promoteur » ne doit présenter QUE les encaissements RÉELS du
    //    promoteur — une ligne sans montant (élève juste « marqué
    //    fondateur » sans argent reçu) est une ligne vide inutile.
    //    Un encaissement réel du promoteur =
    //      a) l'avance saisie à l'activation (advanceamount), OU
    //      b) des paiements enregistrés sur sa caisse (code FONDE).
    //    ⚠️ L'ancien repli « avance = total payé du compte » est SUPPRIMÉ :
    //    il présentait des paiements de CAISSIERS comme des reçus du
    //    promoteur (source d'erreurs et de lignes vides).
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT
         pe.id, pe.studentid, pe.academicyearid, pe.motif,
         pe.expecteddate, pe.isactive, pe.createdat, pe.issettled,
         pe.advanceamount, pe.inscriptionexpected, pe.reinscriptionexpected,
         pe.tuitionexpected, pe.arrearexpected, pe.totaldue, pe.remainingamount,
         s."firstName", s."lastName", s.matricule,
         c.name as classname,
         u."firstName" as userfirstname, u."lastName" as userlastname,
         sa."totalDue" as sa_totaldue,
         sa."totalPaid" as sa_totalpaid,
         sa."balance" as sa_balance,
         sa."arrearsAmount" as sa_arrears
       FROM promoter_payment_eligibility pe
       INNER JOIN students s ON s.id = pe.studentid
       LEFT JOIN student_accounts sa ON sa."studentId" = pe.studentid
         AND sa."academicYearId" = pe.academicyearid
         AND sa."tenantId" = pe.tenantid
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

    // Encaissements réels du promoteur : paiements sur sa caisse (FONDE)
    const promoterCaisse = await this.prisma.cashRegister.findFirst({
      where: { tenantId, code: 'FONDE' },
      select: { id: true },
    });
    let fondeByStudent = new Map<string, number>();
    if (promoterCaisse) {
      const fondeTx = await this.prisma.financeTransaction.findMany({
        where: {
          tenantId,
          academicYearId,
          type: 'PAYMENT',
          cashRegisterId: promoterCaisse.id,
          studentAccount: { tenantId },
        },
        select: { amount: true, studentAccount: { select: { studentId: true } } },
      });
      for (const t of fondeTx) {
        const sid = (t.studentAccount as any)?.studentId;
        if (!sid) continue;
        fondeByStudent.set(sid, (fondeByStudent.get(sid) || 0) + Number(t.amount) || 0);
      }
    }

    const result: PromoterEligibilityRow[] = [];
    for (const r of rows) {
      const userFirstName = r.userfirstname || '';
      const userLastName = r.userlastname || '';
      const createdByName = `${userFirstName} ${userLastName}`.trim();

      const saTotalDue = Number(r.sa_totaldue || 0);
      const saBalance = Number(r.sa_balance || 0);
      const saArrears = Number(r.sa_arrears || 0);

      // ⭐ Montant réellement reçu par le promoteur : avance saisie à
      //    l'activation, sinon paiements encaissés sur la caisse FONDE.
      const recordedAdvance = Number(r.advanceamount || 0);
      const fondeReceipts = fondeByStudent.get(r.studentid) || 0;
      const advanceAmount = recordedAdvance > 0 ? recordedAdvance : fondeReceipts;

      // ⭐ FILTRE « plus de lignes vides » : sans montant réel, la ligne
      //    n'est PAS retournée (retour promoteur — professionalisme).
      if (advanceAmount <= 0 && fondeReceipts <= 0) {
        this.logger.debug(
          `Promoter eligibility ${r.id} ignorée (aucun encaissement réel du promoteur)`,
        );
        continue;
      }

      const totalDue = Number(r.totaldue) > 0
        ? Number(r.totaldue)
        : saTotalDue; // fallback: total dû depuis student_accounts
      const remainingAmount = Number(r.remainingamount) > 0
        ? Number(r.remainingamount)
        : saBalance > 0 ? saBalance : Math.max(0, totalDue - advanceAmount);

      result.push({
        id: r.id,
        studentId: r.studentid,
        studentName: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
        studentMatricule: r.matricule || '',
        className: r.classname || '—',
        academicYearId: r.academicyearid,
        motif: r.motif,
        expectedDate: r.expecteddate ? new Date(r.expecteddate).toISOString() : null,
        isActive: r.isactive,
        isSettled: r.issettled || false,
        createdAt: r.createdat ? new Date(r.createdat).toISOString() : '',
        createdByName,
        advanceAmount,
        inscriptionExpected: Number(r.inscriptionexpected || 0),
        reinscriptionExpected: Number(r.reinscriptionexpected || 0),
        tuitionExpected: Number(r.tuitionexpected || 0),
        arrearExpected: Number(r.arrearexpected || 0) || saArrears,
        totalDue,
        remainingAmount,
      });
    }
    return result;
  }

  async getActiveStudentIds(tenantId: string, academicYearId: string): Promise<Set<string>> {
    const rows = await this.prisma.$queryRawUnsafe<{ studentid: string }[]>(
      `SELECT studentid FROM promoter_payment_eligibility
       WHERE tenantid = $1 AND academicyearid = $2 AND isactive = TRUE AND issettled = FALSE`,
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

  // ⭐ Marquer comme soldé (l'élève a payé la totalité au fondateur)
  async markAsSettled(tenantId: string, userId: string, eligibilityId: string): Promise<{ success: boolean }> {
    const result = await this.prisma.$executeRawUnsafe(
      `UPDATE promoter_payment_eligibility
       SET issettled = TRUE, settledat = now(), settledbyid = $3,
           remainingamount = 0, updatedat = now(), updatedbyid = $3
       WHERE id = $1 AND tenantid = $2 AND isactive = TRUE`,
      eligibilityId, tenantId, userId,
    );
    if (result === 0) {
      throw new NotFoundException('Eligibilité non trouvée');
    }
    this.logger.log(`Marked eligibility ${eligibilityId} as settled`);
    return { success: true };
  }
}
