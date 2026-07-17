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
 * Colonnes (conformes au modèle demandé par l'utilisateur) :
 *   Détail : Noms et Prénoms | Classe | Arriéré | Inscription | Réinscription |
 *            [Tranches dynamiques] | Total dû | Total payé | Reste à payer
 *   Récap  : Effectif | Classe | Arriérés | Inscription | Réinscription |
 *            [Tranches dynamiques] | Total dû | Total payé | Reste à payer |
 *            Solde par classe
 *
 * ⭐ Corrections majeures (Juillet 2026) :
 *   1. Total dû inclut TOUS les types de frais (Inscription + Réinscription +
 *      Scolarité + Arriérés), pas uniquement la scolarité. Avant, Total dû =
 *      totalTuitionExpected seulement, ce qui rendait les chiffres incohérents
 *      (Total payé > Total dû pour les élèves ayant payé l'inscription).
 *   2. Distribution FIFO des paiements de scolarité sur les tranches :
 *      Si un parent paie plus que le montant de la Tranche 1, le surplus est
 *      automatiquement affecté à la Tranche 2, et ainsi de suite. Cela permet
 *      d'absorber les paiements "globaux" qui ne sont pas affectés à une
 *      tranche précise dans la base.
 *   3. Les arriérés sont récupérés depuis le modèle StudentArrear (et non
 *      plus depuis FeeStructure avec feeType='ARREAR' qui n'existe pas dans
 *      l'enum FeeType — INSCRIPTION/REINSCRIPTION/TUITION/CANTEEN/EXAMEN/OTHER).
 *   4. Inscription attendue et Réinscription attendue sont calculées depuis
 *      les FeeStructures correspondantes (matching class > physical class >
 *      level > global), et non plus seulement depuis les paiements effectués.
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

    // ─── 1. Récupérer TOUTES les FeeStructures actives de l'année ──────────────
    // ⭐ On ne se limite plus à feeType='TUITION' : on a aussi besoin des
    //    structures INSCRIPTION et REINSCRIPTION pour calculer les montants
    //    attendus (Total dû) de chaque type de frais.
    //    Les tranches (FeeStructureInstallment) ne s'appliquent qu'aux structures
    //    TUITION isInstallment=true — on ne les charge que pour celles-ci.
    const feeStructures = await this.prisma.feeStructure.findMany({
      where: {
        tenantId,
        academicYearId,
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
      if (fs.feeType !== 'TUITION' || !fs.isInstallment) continue;
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
          amount: Number(alloc.amount) || 0,
        });
      }
      // Si la transaction n'a pas d'allocations (ex: paiement global), créer une entrée générique
      if (!tx.allocations || tx.allocations.length === 0) {
        paymentsByStudent.get(sid)!.push({
          studentId: sid,
          feeType: null,
          feeStructureId: null,
          amount: Number(tx.amount) || 0,
        });
      }
    }

    // ─── 3b. Récupérer les arriérés des élèves pour l'année ──────────────────
    // Les arriérés sont stockés dans StudentArrear (et non FeeStructure avec
    // feeType='ARREAR' — ce feeType n'existe pas dans l'enum).
    // `fromAcademicYearId` indique l'année d'origine de l'arriéré ; l'année
    // courante est celle où l'élève doit le recouvrer.
    const studentArrears = await this.prisma.studentArrear.findMany({
      where: {
        tenantId,
        toAcademicYearId: academicYearId,
        studentId: { in: studentIds },
      },
    });
    const arrearByStudent = new Map<string, number>();
    for (const ar of studentArrears) {
      const current = arrearByStudent.get(ar.studentId) || 0;
      // amountDue = montant total dû pour cet arriéré
      arrearByStudent.set(ar.studentId, current + Number(ar.amountDue));
    }

    // ─── 4. Construire les lignes élèves (détail) ────────────────────────────
    const students = filteredEnrollments.map((enrollment) => {
      const studentPayments = paymentsByStudent.get(enrollment.studentId) || [];

      // Calculer les paiements par type
      let inscriptionPaid = 0;
      let reinscriptionPaid = 0;
      let arrearPaid = 0;
      let totalTuitionPaid = 0;
      let otherPaid = 0; // CANTEEN, EXAMEN, OTHER — inclus dans Total payé mais pas dans une colonne dédiée

      for (const p of studentPayments) {
        const amount = Number(p.amount) || 0;
        switch (p.feeType) {
          case 'INSCRIPTION':
            inscriptionPaid += amount;
            break;
          case 'REINSCRIPTION':
            reinscriptionPaid += amount;
            break;
          case 'TUITION':
            totalTuitionPaid += amount;
            break;
          default:
            // CANTEEN, EXAMEN, OTHER, ou null (paiement global non-allociné)
            // → on l'ajoute à otherPaid pour que Total payé reste cohérent,
            //   mais on ne l'affiche dans aucune colonne dédiée.
            otherPaid += amount;
            break;
        }
      }

      // ─── Matching EXCLUSIF des FeeStructures par type ─────────────────────
      // Priorité : academicClass > physicalClass > level > global (exclusive).
      // On retourne la(les) structure(s) qui matche(nt) au niveau le plus précis.
      const matchByType = (feeType: string) => {
        const classSpecific = feeStructures.filter(fs =>
          fs.feeType === feeType && fs.academicClassId && fs.academicClassId === enrollment.academicClassId
        );
        if (classSpecific.length > 0) return classSpecific;

        const physicalClassSpecific = feeStructures.filter(fs =>
          fs.feeType === feeType && !fs.academicClassId && fs.classId && fs.classId === enrollment.classId
        );
        if (physicalClassSpecific.length > 0) return physicalClassSpecific;

        const levelSpecific = feeStructures.filter(fs =>
          fs.feeType === feeType && !fs.academicClassId && !fs.classId && fs.levelId && fs.levelId === enrollment.class?.schoolLevelId
        );
        if (levelSpecific.length > 0) return levelSpecific;

        return feeStructures.filter(fs =>
          fs.feeType === feeType && !fs.academicClassId && !fs.classId && !fs.levelId
        );
      };

      // ─── Montants attendus (Total dû) par type ────────────────────────────
      const inscriptionStructures = matchByType('INSCRIPTION');
      const inscriptionExpected = inscriptionStructures.reduce(
        (sum, fs) => sum + Number(fs.totalAmount), 0,
      );

      const reinscriptionStructures = matchByType('REINSCRIPTION');
      const reinscriptionExpected = reinscriptionStructures.reduce(
        (sum, fs) => sum + Number(fs.totalAmount), 0,
      );

      const tuitionStructures = matchByType('TUITION');
      const totalTuitionExpected = tuitionStructures.reduce(
        (sum, fs) => sum + Number(fs.totalAmount), 0,
      );

      // Arriéré attendu depuis StudentArrear (importé / reporté de l'année précédente)
      const arrearExpected = arrearByStudent.get(enrollment.studentId) || 0;

      // ─── Distribution FIFO des paiements de scolarité sur les tranches ────
      // Si un parent paie plus que la Tranche 1, le surplus est affecté
      // automatiquement à la Tranche 2, et ainsi de suite. Permet d'absorber
      // les paiements "globaux" non-allocinés à une tranche précise.
      const tuitionInstallments: { [id: string]: number } = {};
      let remainingTuitionPaid = totalTuitionPaid;

      // Récupérer les tranches de la(les) structure(s) TUITION matchée(s),
      // triées par orderIndex. On concatène les tranches de toutes les structures
      // TUITION matchées (en général une seule).
      const matchedInstallments = tuitionStructures
        .flatMap(fs => fs.structureInstallments)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      for (const inst of matchedInstallments) {
        if (remainingTuitionPaid <= 0) {
          tuitionInstallments[inst.id] = 0;
          continue;
        }
        const trancheAmount = Number(inst.amount);
        const allocated = Math.min(remainingTuitionPaid, trancheAmount);
        tuitionInstallments[inst.id] = allocated;
        remainingTuitionPaid -= allocated;
      }
      // Si remainingTuitionPaid > 0 à ce stade, c'est que l'élève a payé PLUS que
      // la somme des tranches configurées. On l'ignore dans les colonnes de
      // tranches (pas de colonne "surplus") mais le montant est bien inclus
      // dans totalTuitionPaid → Total payé.

      // ─── Totaux cohérents ─────────────────────────────────────────────────
      const totalDue = inscriptionExpected + reinscriptionExpected + totalTuitionExpected + arrearExpected;
      const totalPaid = inscriptionPaid + reinscriptionPaid + arrearPaid + totalTuitionPaid + otherPaid;
      const reste = Math.max(0, totalDue - totalPaid);

      const studentName = [
        enrollment.student?.lastName,
        enrollment.student?.firstName,
      ].filter(Boolean).join(' ');

      return {
        studentId: enrollment.studentId,
        studentName,
        className: enrollment.class?.name || enrollment.academicClass?.name || '—',
        classCode: enrollment.class?.code || '',
        // Montants attendus (Total dû)
        inscriptionExpected,
        reinscriptionExpected,
        arrearExpected,
        totalTuitionExpected,
        // Montants payés
        inscriptionPaid,
        reinscriptionPaid,
        arrearPaid,
        tuitionInstallments,
        totalTuitionPaid,
        // Totaux
        totalDue,
        totalPaid,
        reste,
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
          arrieresPaid: 0,
          inscription: 0,
          inscriptionPaid: 0,
          reinscription: 0,
          reinscriptionPaid: 0,
          tuitionInstallments: {},
          totalTuition: 0,
          totalTuitionPaid: 0,
          totalDue: 0,
          totalPaid: 0,
          reste: 0,
          soldeParClasse: 0,
        });
      }
      const row = recapMap.get(classKey)!;
      row.effectif += 1;
      // Attendu
      row.arrieres += student.arrearExpected;
      row.inscription += student.inscriptionExpected;
      row.reinscription += student.reinscriptionExpected;
      row.totalTuition += student.totalTuitionExpected;
      row.totalDue += student.totalDue;
      // Payé
      row.arrieresPaid += student.arrearPaid;
      row.inscriptionPaid += student.inscriptionPaid;
      row.reinscriptionPaid += student.reinscriptionPaid;
      row.totalTuitionPaid += student.totalTuitionPaid;
      row.totalPaid += student.totalPaid;
      // Reste
      row.reste += student.reste;
      // Tranches (payé)
      for (const inst of installments) {
        row.tuitionInstallments[inst.id] =
          (row.tuitionInstallments[inst.id] || 0) + (student.tuitionInstallments[inst.id] || 0);
      }
    }

    // Calculer le solde par classe (total payé - total dû)
    const recap = Array.from(recapMap.values()).map((row) => {
      row.soldeParClasse = row.totalPaid - row.totalDue;
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
  // Attendu
  arrieres: number;
  inscription: number;
  reinscription: number;
  totalTuition: number;
  totalDue: number;
  // Payé
  arrieresPaid: number;
  inscriptionPaid: number;
  reinscriptionPaid: number;
  totalTuitionPaid: number;
  totalPaid: number;
  tuitionInstallments: { [id: string]: number };
  // Reste
  reste: number;
  soldeParClasse: number;
}
