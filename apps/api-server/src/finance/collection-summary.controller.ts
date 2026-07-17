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
import { TenantId } from '../common/decorators/tenant-id.decorator';
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
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (!academicYearId) {
      return { students: [], recap: [], installments: [] };
    }

    this.logger.log(`Collection summary: tenant=${tenantId}, year=${academicYearId}, level=${levelId || 'all'}, class=${classId || 'all'}, page=${page || 'all'}, limit=${limit || 'all'}`);

    // ⭐ Pagination optionnelle pour la liste `students` (pas pour `recap` qui reste non paginé).
    const pageNum = page ? parseInt(page, 10) : undefined;
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const isPaginated = !!(pageNum && !isNaN(pageNum) && limitNum && !isNaN(limitNum));
    const pageEff = Math.max(1, pageNum ?? 1);
    const limitEff = Math.min(500, Math.max(1, limitNum ?? 50));

    // ─── 1. Récupérer les FeeStructures de type TUITION avec leurs tranches ───
    const feeStructures = await this.prisma.feeStructure.findMany({
      where: {
        tenantId,
        academicYearId,
        feeType: 'TUITION',
        isInstallment: true,
        isActive: true,
        ...(classId && { OR: [{ classId }, { academicClassId: classId }] }),
      },
      include: {
        structureInstallments: { orderBy: { orderIndex: 'asc' } },
        class: true,
        academicClass: true,
        level: true,
      },
    });

    // Collecter tous les installments uniques — dédupliquer par LABEL (pas par ID)
    // pour éviter d'avoir 5 colonnes "Tranche 1" quand 5 fee_structures ont chacune
    // leur propre "Tranche 1" avec un ID différent.
    const installmentsMap = new Map<string, { id: string; label: string; amount: number; orderIndex: number }>();
    for (const fs of feeStructures) {
      for (const inst of fs.structureInstallments) {
        const key = inst.label || `Tranche ${inst.orderIndex + 1}`;
        if (!installmentsMap.has(key)) {
          installmentsMap.set(key, {
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
    // ⭐ Inclure ADMITTED (statut utilisé par l'import en masse et le bulk-setup)
    const enrollmentWhere: any = {
      tenantId,
      academicYearId,
      status: { in: ['ACTIVE', 'ENROLLED', 'PENDING', 'ADMITTED'] },
    };
    if (classId) {
      enrollmentWhere.classId = classId;
    }

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: enrollmentWhere,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
        class: { select: { id: true, name: true, code: true, schoolLevelId: true, schoolLevel: true } },
        academicClass: { select: { id: true, name: true, code: true } },
      },
      orderBy: [
        { student: { lastName: 'asc' } },
        { student: { firstName: 'asc' } },
      ],
    });

    // Filtrer par niveau si fourni (levelId = UUID de school_levels)
    let filteredEnrollments = enrollments;
    if (levelId) {
      filteredEnrollments = enrollments.filter((e) => {
        // Match par UUID de school_levels
        if (e.class?.schoolLevel?.id === levelId) return true;
        // Match par UUID de schoolLevelId sur la classe
        if (e.class?.schoolLevelId === levelId) return true;
        return false;
      });
    }

    // ─── 3. Récupérer tous les paiements pour ces élèves ──────────────────────
    // ⭐ Juillet 2026 : on utilise FinanceTransaction (modèle moderne) au lieu de
    // PaymentAllocation (modèle legacy). Les 2550 transactions importées sont dans
    // finance_transactions avec leurs allocations dans finance_transaction_allocations.
    // On joint les allocations → accountBreakdowns → feeStructures pour récupérer le feeType.
    const studentIds = filteredEnrollments.map((e) => e.studentId);
    const transactions = await this.prisma.financeTransaction.findMany({
      where: {
        tenantId,
        academicYearId,
        studentAccount: { studentId: { in: studentIds } },
      },
      include: {
        studentAccount: { select: { studentId: true } },
        allocations: {
          include: {
            accountBreakdown: {
              include: {
                feeStructure: { select: { feeType: true, id: true } },
              },
            },
          },
        },
      },
    });

    // Grouper les paiements par élève
    const paymentsByStudent = new Map<string, any[]>();
    for (const tx of transactions) {
      const sid = tx.studentAccount?.studentId || (tx as any).studentAccountId;
      if (!sid) continue;
      if (!paymentsByStudent.has(sid)) {
        paymentsByStudent.set(sid, []);
      }
      // Pour chaque allocation de la transaction, créer une entrée
      for (const alloc of tx.allocations || []) {
        const fs = alloc.accountBreakdown?.feeStructure;
        paymentsByStudent.get(sid)!.push({
          studentId: sid,
          feeType: fs?.feeType || null,
          feeStructureId: fs?.id || null,
          feeStructureInstallmentId: null,
          amount: Number(alloc.amount) || 0,
          classId: null,
        });
      }
      // Si la transaction n'a pas d'allocations (ex: paiement global), créer une entrée générique
      if (!tx.allocations || tx.allocations.length === 0) {
        paymentsByStudent.get(sid)!.push({
          studentId: sid,
          feeType: null,
          feeStructureId: null,
          feeStructureInstallmentId: null,
          amount: Number(tx.amount) || 0,
          classId: null,
        });
      }
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

      // Total scolarité attendu — priorité EXCLUSIVE (pas OR) :
      // 1. Classe officielle (academicClassId) si la fee structure en a une
      // 2. Classe physique (classId) si la fee structure en a une
      // 3. Niveau (levelId) si la fee structure en a un
      // 4. Global (aucun filtre)
      // Cela évite de matcher plusieurs fee structures pour le même élève
      // (ex: 3 structures de niveau Maternelle + 1 structure par classe = total × 4)
      const classSpecific = feeStructures.filter(fs =>
        fs.academicClassId && fs.academicClassId === enrollment.academicClassId
      );
      const physicalClassSpecific = feeStructures.filter(fs =>
        !fs.academicClassId && fs.classId && fs.classId === enrollment.classId
      );
      const levelSpecific = feeStructures.filter(fs =>
        !fs.academicClassId && !fs.classId && fs.levelId && fs.levelId === enrollment.class?.schoolLevelId
      );
      const global = feeStructures.filter(fs =>
        !fs.academicClassId && !fs.classId && !fs.levelId
      );

      const matchingFeeStructures =
        classSpecific.length > 0 ? classSpecific :
        physicalClassSpecific.length > 0 ? physicalClassSpecific :
        levelSpecific.length > 0 ? levelSpecific :
        global;

      const totalTuitionExpected = matchingFeeStructures.reduce(
        (sum, fs) => sum + Number(fs.totalAmount),
        0,
      );

      const totalPaid = inscriptionPaid + reinscriptionPaid + arrearPaid + totalTuitionPaid;
      const reste = totalTuitionExpected - totalTuitionPaid;

      const studentName = [
        enrollment.student?.lastName,
        enrollment.student?.firstName,
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

    // ⭐ Pagination optionnelle de la liste `students`.
    // Le `recap` reste calculé sur TOUS les élèves (non paginé) pour que les totaux
    // par classe et le solde global restent exacts — pattern identique aux autres
    // onglets (KPIs globaux vs page active).
    if (isPaginated) {
      const studentsTotal = students.length;
      const studentsTotalPages = Math.ceil(studentsTotal / limitEff) || 1;
      const pagedStudents = students.slice(
        (pageEff - 1) * limitEff,
        pageEff * limitEff,
      );
      return {
        students: pagedStudents,
        studentsTotal,
        studentsPage: pageEff,
        studentsTotalPages,
        recap,
        installments,
      };
    }

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
