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

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../database/prisma.service';
import { CollectionSummaryImportService } from './collection-summary-import.service';

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class CollectionSummaryController {
  private readonly logger = new Logger(CollectionSummaryController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly importService: CollectionSummaryImportService,
  ) {}

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
    // ⭐ On charge TOUTES les structures (class-spécifiques + level-spécifiques + globales)
    //    sans filtre classId, car matchByType() fait le matching prioritaire :
    //    academicClass > physicalClass > level > global.
    //    Si on filtre par classId ici, on perd les structures level/globales → totalDue=0.
    //    Le filtre classId s'applique uniquement sur les enrollments (plus bas).
    const feeStructures = await this.prisma.feeStructure.findMany({
      where: {
        tenantId,
        academicYearId,
        isActive: true,
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
    // ⭐ FIX : on garde l'ID pour rétro-compat, mais la CLÉ utilisée pour
    //    tuitionInstallments[...] est le LABEL (pas l'ID) — voir plus bas.
    //    Sinon, un élève de PRIMAIRE (UUID-A) ne matche pas la colonne
    //    installments[i].id (UUID-MATERNELLE du 1er niveau) → colonne vide.
    const installmentsMap = new Map<string, { id: string; label: string; amount: number; orderIndex: number }>();
    for (const fs of feeStructures) {
      if (fs.feeType !== 'TUITION' || !fs.isInstallment) continue;
      for (const inst of fs.structureInstallments) {
        const key = inst.label || `Tranche ${inst.orderIndex + 1}`;
        if (!installmentsMap.has(key)) {
          installmentsMap.set(key, {
            id: inst.id,
            label: key,  // ⭐ utiliser le label normalisé (avec fallback)
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
      // ⭐ Task 23 : exclure les élèves abandonnés (Student.status = 'WITHDRAWN')
      // du bilan des encaissements pour ne pas fausser les totaux.
      student: { status: { not: 'WITHDRAWN' } },
    };
    if (classId) {
      enrollmentWhere.classId = classId;
    }

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: enrollmentWhere,
      include: {
        // ⭐ Inclure schoolLevelId sur student — c'est la source de vérité pour
        //    le niveau scolaire (AcademicClass n'a pas de schoolLevelId direct).
        student: { select: { id: true, firstName: true, lastName: true, matricule: true, schoolLevelId: true } },
        class: { select: { id: true, name: true, code: true, schoolLevelId: true, schoolLevel: true } },
        academicClass: { select: { id: true, name: true, code: true, levelId: true } },
      },
      orderBy: [
        { student: { lastName: 'asc' } },
        { student: { firstName: 'asc' } },
      ],
    });

    // Filtrer par niveau si fourni (levelId = UUID de school_levels)
    // ⭐ FIX : on matche sur class.schoolLevel ET student.schoolLevelId.
    //    AcademicClass n'a PAS de schoolLevelId direct — on utilise student.schoolLevelId
    //    comme fallback (source de vérité : l'élève a toujours un schoolLevelId).
    //    Avant ce fix, les élèves sans classId physique étaient exclus du filtre → "Aucune donnée".
    let filteredEnrollments = enrollments;
    if (levelId) {
      // Charger le niveau scolaire pour récupérer son code (au cas où levelId
      // serait un code plutôt qu'un UUID — robustesse).
      let levelCode: string | null = null;
      try {
        const level = await this.prisma.schoolLevel.findUnique({
          where: { id: levelId },
          select: { code: true },
        });
        levelCode = level?.code || null;
      } catch {
        // Si ce n'est pas un UUID valide, on suppose que c'est déjà un code.
        levelCode = levelId;
      }

      filteredEnrollments = enrollments.filter((e) => {
        // Match par UUID de school_levels sur la classe physique
        if (e.class?.schoolLevel?.id === levelId) return true;
        if (e.class?.schoolLevelId === levelId) return true;
        // ⭐ Match par student.schoolLevelId (source de vérité — l'élève a toujours ce champ)
        if (e.student?.schoolLevelId === levelId) return true;
        // Match par code (au cas où levelId soit un code comme "SECONDAIRE")
        if (levelCode && e.class?.schoolLevel?.code === levelCode) return true;
        return false;
      });

      this.logger.debug(`Filter by level: levelId=${levelId}, levelCode=${levelCode}, total=${enrollments.length}, filtered=${filteredEnrollments.length}`);
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

    // ─── 3b. Récupérer les account_breakdowns par élève ─────────────────────
    // ⭐ SOURCE DE VÉRITÉ pour les montants payés : `account_breakdowns.paidAmount`
    //    est maintenu par les triggers SQL après chaque transaction. On l'utilise
    //    comme référence pour valider les montants payés par type de frais.
    //    Si les allocations de transactions sont incohérentes (ex: bug d'import
    //    qui a mal taggé les paiements), on retombe sur paidAmount qui est fiable.
    const accountIds = new Set<string>();
    for (const tx of transactions) {
      if (tx.studentAccountId) accountIds.add(tx.studentAccountId);
    }
    const studentAccounts = await this.prisma.studentAccount.findMany({
      where: { id: { in: Array.from(accountIds) } },
      select: { id: true, studentId: true },
    });
    const accountIdToStudentId = new Map<string, string>();
    for (const sa of studentAccounts) {
      accountIdToStudentId.set(sa.id, sa.studentId);
    }
    const breakdownsByStudentDb = await this.prisma.accountBreakdown.findMany({
      where: {
        studentAccountId: { in: Array.from(accountIds) },
      },
      include: {
        feeStructure: { select: { feeType: true, id: true } },
      },
    });
    const breakdownsByStudent = new Map<string, { [feeType: string]: { paid: number; expected: number; feeStructureId: string } }>();
    for (const bd of breakdownsByStudentDb) {
      const studentId = accountIdToStudentId.get(bd.studentAccountId);
      if (!studentId) continue;
      if (!breakdownsByStudent.has(studentId)) {
        breakdownsByStudent.set(studentId, {});
      }
      const feeType = bd.feeStructure?.feeType;
      if (!feeType) continue;
      breakdownsByStudent.get(studentId)![feeType] = {
        paid: Number(bd.paidAmount) || 0,
        expected: Number(bd.initialAmount) || 0,
        feeStructureId: bd.feeStructureId,
      };
    }

    // ─── 3c. Récupérer les arriérés des élèves pour l'année ──────────────────
    // Les arriérés sont stockés dans FeeArrear (créés par l'import Excel) et
    // StudentArrear (créés par le report d'année). On combine les deux sources
    // pour avoir une vue complète.
    const feeArrears = await this.prisma.feeArrear.findMany({
      where: {
        tenantId,
        academicYearId,
        studentId: { in: studentIds },
      },
    });
    const studentArrears = await this.prisma.studentArrear.findMany({
      where: {
        tenantId,
        toAcademicYearId: academicYearId,
        studentId: { in: studentIds },
      },
    });
    const arrearByStudent = new Map<string, { expected: number; paid: number }>();
    // Source 1 : FeeArrear (import Excel)
    for (const ar of feeArrears) {
      const current = arrearByStudent.get(ar.studentId) || { expected: 0, paid: 0 };
      arrearByStudent.set(ar.studentId, {
        expected: current.expected + Number(ar.totalDue),
        paid: current.paid + Number(ar.totalPaid),
      });
    }
    // Source 2 : StudentArrear (report d'année)
    for (const ar of studentArrears) {
      const current = arrearByStudent.get(ar.studentId) || { expected: 0, paid: 0 };
      arrearByStudent.set(ar.studentId, {
        expected: current.expected + Number(ar.amountDue),
        paid: current.paid + Number(ar.amountPaid),
      });
    }

    // ─── 3d. Récupérer les FeeOverrides (personnalisations) par élève ──────
    // ⭐ Permet d'afficher la colonne "Personnalisation" qui indique si l'élève
    //    a une dérogation/exonération sur ses frais de scolarité, et le montant
    //    personnalisé (vs montant standard de la FeeStructure).
    // ⭐ FeeOverride n'a PAS de champ tenantId direct — on filtre via
    //    student.tenantId (relation vers Student qui a tenantId).
    //    Avant ce fix : prisma.feeOverride.findMany({ where: { tenantId } })
    //    → erreur "Unknown arg `tenantId`" → backend 500 → "Failed to fetch".
    const feeOverrides = await this.prisma.feeOverride.findMany({
      where: {
        student: { tenantId },
        studentId: { in: studentIds },
      },
      include: {
        feeStructure: { select: { id: true, feeType: true, totalAmount: true } },
      },
    });
    // Map: studentId → { hasPersonalization: boolean, totalCustomAmount: number, totalReduction: number }
    const overrideByStudent = new Map<string, { hasPersonalization: boolean; totalCustomAmount: number; totalReduction: number }>();
    for (const ov of feeOverrides) {
      const standardAmount = Number(ov.feeStructure?.totalAmount || 0);
      const customAmount = Number(ov.customAmount || 0);
      const reduction = Math.max(0, standardAmount - customAmount);
      const current = overrideByStudent.get(ov.studentId) || { hasPersonalization: false, totalCustomAmount: 0, totalReduction: 0 };
      current.hasPersonalization = true;
      current.totalCustomAmount += customAmount;
      current.totalReduction += reduction;
      overrideByStudent.set(ov.studentId, current);
    }

    // ─── 4. Construire les lignes élèves (détail) ────────────────────────────
    const students = filteredEnrollments.map((enrollment) => {
      const studentPayments = paymentsByStudent.get(enrollment.studentId) || [];
      const studentBreakdowns = breakdownsByStudent.get(enrollment.studentId) || {};

      // ⭐ PRIORITÉ aux montants paidAmount des account_breakdowns (source de vérité
      // maintenue par les triggers SQL). Si un type de frais a un breakdown, on
      // utilise son paidAmount directement. Sinon, on retombe sur la somme des
      // allocations de transactions (qui peut être incohérente si bug d'import).
      const inscriptionBd = studentBreakdowns['INSCRIPTION'];
      const reinscriptionBd = studentBreakdowns['REINSCRIPTION'];
      const tuitionBd = studentBreakdowns['TUITION'];

      // Calculer les paiements par type (fallback depuis les allocations)
      let inscriptionPaidFromTx = 0;
      let reinscriptionPaidFromTx = 0;
      let totalTuitionPaidFromTx = 0;
      let otherPaid = 0;

      for (const p of studentPayments) {
        const amount = Number(p.amount) || 0;
        switch (p.feeType) {
          case 'INSCRIPTION':
            inscriptionPaidFromTx += amount;
            break;
          case 'REINSCRIPTION':
            reinscriptionPaidFromTx += amount;
            break;
          case 'TUITION':
            totalTuitionPaidFromTx += amount;
            break;
          default:
            // CANTEEN, EXAMEN, OTHER, ou null (paiement global non-allociné)
            otherPaid += amount;
            break;
        }
      }

      // ⭐ Utiliser paidAmount du breakdown si disponible (plus fiable), sinon fallback
      const inscriptionPaid = inscriptionBd?.paid ?? inscriptionPaidFromTx;
      const reinscriptionPaid = reinscriptionBd?.paid ?? reinscriptionPaidFromTx;
      const totalTuitionPaid = tuitionBd?.paid ?? totalTuitionPaidFromTx;
      const arrearInfo = arrearByStudent.get(enrollment.studentId) || { expected: 0, paid: 0 };
      const arrearPaid = arrearInfo.paid;

      // ─── Matching EXCLUSIF des FeeStructures par type ─────────────────────
      // Priorité : academicClass > physicalClass > level > global (exclusive).
      // On retourne la(les) structure(s) qui matche(nt) au niveau le plus précis.
      // ⭐ FIX : utiliser student.schoolLevelId comme fallback pour le matching
      //    par levelId (AcademicClass n'a pas de schoolLevelId direct).
      const matchByType = (feeType: string) => {
        const classSpecific = feeStructures.filter(fs =>
          fs.feeType === feeType && fs.academicClassId && fs.academicClassId === enrollment.academicClassId
        );
        if (classSpecific.length > 0) return classSpecific;

        const physicalClassSpecific = feeStructures.filter(fs =>
          fs.feeType === feeType && !fs.academicClassId && fs.classId && fs.classId === enrollment.classId
        );
        if (physicalClassSpecific.length > 0) return physicalClassSpecific;

        // ⭐ Match par levelId : utiliser class.schoolLevelId ou student.schoolLevelId
        //    (les deux sont des UUID de school_levels ; AcademicClass n'en a pas).
        const effectiveLevelId = enrollment.class?.schoolLevelId || enrollment.student?.schoolLevelId;
        const levelSpecific = feeStructures.filter(fs =>
          fs.feeType === feeType && !fs.academicClassId && !fs.classId && fs.levelId && fs.levelId === effectiveLevelId
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
      const arrearExpected = arrearInfo.expected;

      // ─── Distribution FIFO des paiements de scolarité sur les tranches ────
      // Si un parent paie plus que la Tranche 1, le surplus est affecté
      // automatiquement à la Tranche 2, et ainsi de suite. Permet d'absorber
      // les paiements "globaux" non-allocinés à une tranche précise.
      //
      // ⭐ FIX : la clé de tuitionInstallments est le LABEL (pas l'ID),
      //    pour matcher avec installments[i].label côté frontend.
      //    Sinon, un élève de PRIMAIRE (UUID-A) ne matche pas la colonne
      //    installments[i].id (UUID-MATERNELLE) → colonne vide.
      const tuitionInstallments: { [label: string]: number } = {};
      let remainingTuitionPaid = totalTuitionPaid;

      // Récupérer les tranches de la(les) structure(s) TUITION matchée(s),
      // triées par orderIndex. On concatène les tranches de toutes les structures
      // TUITION matchées (en général une seule).
      const matchedInstallments = tuitionStructures
        .flatMap(fs => fs.structureInstallments)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      for (const inst of matchedInstallments) {
        const labelKey = inst.label || `Tranche ${inst.orderIndex + 1}`;
        if (remainingTuitionPaid <= 0) {
          tuitionInstallments[labelKey] = 0;
          continue;
        }
        const trancheAmount = Number(inst.amount);
        const allocated = Math.min(remainingTuitionPaid, trancheAmount);
        tuitionInstallments[labelKey] = allocated;
        remainingTuitionPaid -= allocated;
      }
      // Si remainingTuitionPaid > 0 à ce stade, c'est que l'élève a payé PLUS que
      // la somme des tranches configurées. On l'ignore dans les colonnes de
      // tranches (pas de colonne "surplus") mais le montant est bien inclus
      // dans totalTuitionPaid → Total payé.

      // ─── Totaux cohérents ─────────────────────────────────────────────────
      // ⭐ totalTuitionExpected = "Scolarité" (colonne demandée par l'utilisateur)
      //    totalDue = Inscription + Réinscription + Scolarité + Arriérés
      // ⭐ Personnalisation : si l'élève a un FeeOverride, on ajuste totalDue en
      //    remplaçant le montant standard par le montant personnalisé.
      const overrideInfo = overrideByStudent.get(enrollment.studentId) || { hasPersonalization: false, totalCustomAmount: 0, totalReduction: 0 };
      const totalDue = inscriptionExpected + reinscriptionExpected + totalTuitionExpected + arrearExpected - overrideInfo.totalReduction;
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
        // ⭐ Scolarité = totalTuitionExpected (montant standard des frais de scolarité)
        scolarite: totalTuitionExpected,
        totalTuitionExpected,
        // ⭐ Personnalisation : indique si l'élève a un FeeOverride + montant de la réduction
        hasPersonalization: overrideInfo.hasPersonalization,
        personalizationAmount: overrideInfo.totalCustomAmount,
        personalizationReduction: overrideInfo.totalReduction,
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
          // ⭐ Scolarité + Personnalisation (colonnes demandées)
          scolarite: 0,
          personalizationCount: 0,
          personalizationReduction: 0,
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
      // ⭐ Scolarité (alias de totalTuitionExpected pour clarté dans le récap)
      row.scolarite += student.totalTuitionExpected;
      // ⭐ Compteur de personnalisations dans la classe
      if (student.hasPersonalization) row.personalizationCount += 1;
      row.personalizationReduction += student.personalizationReduction || 0;
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
      // ⭐ FIX : clé par LABEL (pas par ID) pour matcher avec installments[i].label
      for (const inst of installments) {
        row.tuitionInstallments[inst.label] =
          (row.tuitionInstallments[inst.label] || 0) + (student.tuitionInstallments[inst.label] || 0);
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

  // ─── Import en masse du bilan des encaissements ─────────────────────────────
  // Workflow : download template → upload → preview → run
  // Détails : apps/api-server/src/finance/collection-summary-import.service.ts

  /**
   * GET /finance/collection-summary/import/template
   * Télécharge le template Excel : une feuille par classe, pré-remplie avec les élèves.
   */
  @Get('collection-summary/import/template')
  async downloadImportTemplate(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Res() res: Response,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis (query param)');
    }
    this.logger.log(`Download bilan import template: tenant=${tenantId}, year=${academicYearId}`);
    await this.importService.downloadTemplate(tenantId, academicYearId, res);
  }

  /**
   * POST /finance/collection-summary/import/preview
   * Valide le fichier Excel sans créer de transactions.
   * Body : { academicYearId, fileDataUrl }
   * Retourne : { totalRows, validRows, invalidRows, rows[], sheetsProcessed[], summary }
   */
  @Post('collection-summary/import/preview')
  async previewImport(
    @TenantId() tenantId: string,
    @Body() body: { academicYearId: string; fileDataUrl: string },
  ) {
    if (!body.fileDataUrl) {
      throw new BadRequestException('fileDataUrl est requis (base64 data URL du fichier Excel)');
    }
    if (!body.academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    return this.importService.previewImport(tenantId, body.academicYearId, body.fileDataUrl);
  }

  /**
   * POST /finance/collection-summary/import/run
   * Importe réellement le bilan : crée une FinanceTransaction par élève valide.
   * Body : { academicYearId, fileDataUrl }
   * Retourne : { total, imported, skipped, errors, results[] }
   */
  @Post('collection-summary/import/run')
  async runImport(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { academicYearId: string; fileDataUrl: string },
  ) {
    if (!body.fileDataUrl) {
      throw new BadRequestException('fileDataUrl est requis (base64 data URL du fichier Excel)');
    }
    if (!body.academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    this.logger.log(`Run bilan import: tenant=${tenantId}, user=${user?.id}`);
    return this.importService.runImport(tenantId, body.academicYearId, body.fileDataUrl, user?.id);
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
  // ⭐ Scolarité (alias de totalTuition pour clarté dans le récap)
  scolarite: number;
  // ⭐ Personnalisation : combien d'élèves de la classe ont un FeeOverride + montant total de la réduction
  personalizationCount: number;
  personalizationReduction: number;
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
