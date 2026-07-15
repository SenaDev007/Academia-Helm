/**
 * ============================================================================
 * COLLECTION SUMMARY CONTROLLER — Bilan des encaissements + Récapitulatif
 * ============================================================================
 *
 * GET /finance/collection-summary?academicYearId=...&levelId=...&classId=...
 *
 * Retourne :
 *   - students[] : liste détaillée par élève avec tranches de scolarité
 *   - recap[] : agrégation par classe
 *
 * Colonnes (conformes au modèle Excel fourni par l'utilisateur) :
 *   Détail : Noms et Prénoms | Classe | Arriéré | Inscription | Réinscription |
 *            [Tranches dynamiques] | Total Scolarité | Reste | Total des paiements
 *   Récap  : Effectif | Classe | Arriérés | Inscription | Réinscription |
 *            [Tranches dynamiques] | Total Scolarité | Reste | Total des payements |
 *            Solde par classe
 * ============================================================================
 */

import { Controller, Get, Query, Logger } from '@nestjs/common';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { PrismaService } from '../database/prisma.service';

@Controller('finance')
export class CollectionSummaryController {
  private readonly logger = new Logger(CollectionSummaryController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get('collection-summary')
  async getCollectionSummary(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('levelId') levelId?: string,
    @Query('classId') classId?: string,
  ) {
    if (!academicYearId) {
      return { students: [], recap: [], installments: [] };
    }

    this.logger.log(`Collection summary: tenant=${tenantId}, year=${academicYearId}, level=${levelId || 'all'}, class=${classId || 'all'}`);

    // ─── 1. Récupérer les FeeStructures de type TUITION avec leurs tranches ───
    const feeStructures = await this.prisma.feeStructure.findMany({
      where: {
        tenantId,
        academicYearId,
        feeType: 'TUITION',
        isInstallment: true,
        isActive: true,
        ...(classId && { classId }),
      },
      include: {
        structureInstallments: { orderBy: { orderIndex: 'asc' } },
        class: true,
        academicClass: true,
        level: true,
      },
    });

    // Collecter tous les installments uniques
    const installmentsMap = new Map<string, { id: string; label: string; amount: number; orderIndex: number }>();
    for (const fs of feeStructures) {
      for (const inst of fs.structureInstallments) {
        if (!installmentsMap.has(inst.id)) {
          installmentsMap.set(inst.id, {
            id: inst.id,
            label: inst.label,
            amount: Number(inst.amount),
            orderIndex: inst.orderIndex,
          });
        }
      }
    }
    const installments = Array.from(installmentsMap.values()).sort((a, b) => a.orderIndex - b.orderIndex);

    // ─── 2. Récupérer les élèves (enrollments) avec leurs classes ─────────────
    const enrollmentWhere: any = {
      tenantId,
      academicYearId,
      status: { in: ['ACTIVE', 'ENROLLED', 'PENDING'] },
    };
    if (classId) {
      enrollmentWhere.classId = classId;
    }

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: enrollmentWhere,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, middleName: true } },
        class: { select: { id: true, name: true, code: true, schoolLevelId: true, schoolLevel: true } },
        academicClass: { select: { id: true, name: true, code: true } },
      },
    });

    // Filtrer par niveau si fourni
    let filteredEnrollments = enrollments;
    if (levelId) {
      filteredEnrollments = enrollments.filter((e) => {
        const enrollmentLevelCode = (e.class?.schoolLevel?.code || '').toLowerCase();
        const levelCode = (levelId || '').toLowerCase();
        // Comparer par code (MATERNELLE/PRIMAIRE/SECONDAIRE)
        const matchingLevel = e.class?.schoolLevel?.id === levelId;
        const matchingCode = enrollmentLevelCode === levelCode;
        return matchingLevel || matchingCode;
      });
    }

    // ─── 3. Récupérer tous les paiements pour ces élèves ──────────────────────
    const studentIds = filteredEnrollments.map((e) => e.studentId);
    const payments = await this.prisma.paymentAllocation.findMany({
      where: {
        tenantId,
        academicYearId,
        studentId: { in: studentIds },
      },
      select: {
        studentId: true,
        feeType: true,
        feeStructureId: true,
        feeStructureInstallmentId: true,
        amount: true,
        classId: true,
      },
    });

    // Grouper les paiements par élève
    const paymentsByStudent = new Map<string, any[]>();
    for (const p of payments) {
      if (!paymentsByStudent.has(p.studentId)) {
        paymentsByStudent.set(p.studentId, []);
      }
      paymentsByStudent.get(p.studentId)!.push(p);
    }

    // ─── 4. Construire les lignes élèves (détail) ────────────────────────────
    const students = filteredEnrollments.map((enrollment) => {
      const studentPayments = paymentsByStudent.get(enrollment.studentId) || [];

      // Calculer les paiements par type
      let inscriptionPaid = 0;
      let reinscriptionPaid = 0;
      let arrearPaid = 0;
      const tuitionInstallments: { [id: string]: number } = {};
      let totalTuitionPaid = 0;

      for (const p of studentPayments) {
        const amount = Number(p.amount) || 0;
        switch (p.feeType) {
          case 'INSCRIPTION':
            inscriptionPaid += amount;
            break;
          case 'REINSCRIPTION':
            reinscriptionPaid += amount;
            break;
          case 'ARREAR':
          case 'ARREARS':
            arrearPaid += amount;
            break;
          case 'TUITION':
            if (p.feeStructureInstallmentId) {
              tuitionInstallments[p.feeStructureInstallmentId] =
                (tuitionInstallments[p.feeStructureInstallmentId] || 0) + amount;
            }
            totalTuitionPaid += amount;
            break;
          default:
            // Autres frais — inclus dans le total
            break;
        }
      }

      // Total scolarité attendu (somme des montants des fee structures TUITION pour cette classe)
      const matchingFeeStructures = feeStructures.filter((fs) => {
        return (
          (fs.classId && fs.classId === enrollment.classId) ||
          (fs.academicClassId && fs.academicClassId === enrollment.academicClassId) ||
          (fs.levelId && fs.levelId === enrollment.class?.schoolLevelId) ||
          (!fs.classId && !fs.academicClassId && !fs.levelId)
        );
      });

      const totalTuitionExpected = matchingFeeStructures.reduce(
        (sum, fs) => sum + Number(fs.totalAmount),
        0,
      );

      const totalPaid = inscriptionPaid + reinscriptionPaid + arrearPaid + totalTuitionPaid;
      const reste = totalTuitionExpected - totalTuitionPaid;

      const studentName = [
        enrollment.student?.lastName,
        enrollment.student?.firstName,
        enrollment.student?.middleName,
      ].filter(Boolean).join(' ');

      return {
        studentId: enrollment.studentId,
        studentName,
        className: enrollment.class?.name || enrollment.academicClass?.name || '—',
        classCode: enrollment.class?.code || '',
        inscriptionPaid,
        reinscriptionPaid,
        arrearPaid,
        tuitionInstallments,
        totalTuitionExpected,
        totalTuitionPaid,
        reste: Math.max(0, reste),
        totalPaid,
      };
    });

    // ─── 5. Construire le récapitulatif par classe ────────────────────────────
    const recapMap = new Map<string, RecapRow>();

    for (const student of students) {
      const classKey = student.className;
      if (!recapMap.has(classKey)) {
        recapMap.set(classKey, {
          effectif: 0,
          className: classKey,
          arrieres: 0,
          inscription: 0,
          reinscription: 0,
          tuitionInstallments: {},
          totalTuition: 0,
          reste: 0,
          totalPaid: 0,
          soldeParClasse: 0,
        });
      }
      const row = recapMap.get(classKey)!;
      row.effectif += 1;
      row.arrieres += student.arrearPaid;
      row.inscription += student.inscriptionPaid;
      row.reinscription += student.reinscriptionPaid;
      row.totalTuition += student.totalTuitionExpected;
      row.reste += student.reste;
      row.totalPaid += student.totalPaid;
      for (const inst of installments) {
        row.tuitionInstallments[inst.id] =
          (row.tuitionInstallments[inst.id] || 0) + (student.tuitionInstallments[inst.id] || 0);
      }
    }

    // Calculer le solde par classe (total payé - total scolarité - arriérés - inscription)
    const recap = Array.from(recapMap.values()).map((row) => {
      row.soldeParClasse = row.totalPaid - row.totalTuition;
      return row;
    });

    return { students, recap, installments };
  }
}

interface RecapRow {
  effectif: number;
  className: string;
  arrieres: number;
  inscription: number;
  reinscription: number;
  tuitionInstallments: { [id: string]: number };
  totalTuition: number;
  reste: number;
  totalPaid: number;
  soldeParClasse: number;
}
