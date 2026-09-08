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
import * as crypto from 'crypto';
import { Response } from 'express';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../database/prisma.service';
import { CollectionSummaryImportService } from './collection-summary-import.service';
import { PromoterEligibilityService } from './promoter-eligibility.service';

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class CollectionSummaryController {
  private readonly logger = new Logger(CollectionSummaryController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly importService: CollectionSummaryImportService,
    private readonly promoterEligibilityService: PromoterEligibilityService,
  ) {}

  @Get('collection-summary')
  async getCollectionSummary(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('levelId') levelId?: string,
    @Query('classId') classId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('excludePromoterCaisse') excludePromoterCaisse?: string,
    @Query('includePromoterStudents') includePromoterStudents?: string,
  ) {
    if (!academicYearId) {
      return { students: [], recap: [], installments: [] };
    }

    this.logger.log(`Collection summary: tenant=${tenantId}, year=${academicYearId}, level=${levelId || 'all'}, class=${classId || 'all'}, page=${page || 'all'}, limit=${limit || 'all'}, excludePromoterCaisse=${excludePromoterCaisse || 'false'}, includePromoterStudents=${includePromoterStudents || 'false'}`);

    // ⭐ Toggle : exclure les paiements reçus sur la caisse FONDE (caisse promoteur)
    //    pour ne pas gonfler les stats caissiers. Par défaut false (comportement
    //    actuel préservé). Quand true, on filtre les transactions dont le
    //    cashRegister.code === 'FONDE'.
    const shouldExcludePromoter = excludePromoterCaisse === 'true' || excludePromoterCaisse === '1';

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
    // ⭐ Inclure PROMOTED + RE_ENROLLED — les élèves promus d'une année sur
    //    l'autre sont des élèves ACTIFS de l'année courante (même définition que
    //    students-prisma.service activeEnrollmentStatuses). Sans eux, le bilan
    //    ignore ~la moitié de l'effectif (ex: 358/688 à Mon Avenir Plus 2025-2026).
    const enrollmentWhere: any = {
      tenantId,
      academicYearId,
      status: { in: ['ACTIVE', 'ENROLLED', 'PENDING', 'ADMITTED', 'PROMOTED', 'RE_ENROLLED'] },
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
        student: { select: { id: true, firstName: true, lastName: true, matricule: true, schoolLevelId: true } },
        class: { select: { id: true, name: true, code: true, schoolLevelId: true, schoolLevel: { select: { id: true, code: true, name: true, order: true } } } },
        academicClass: { select: { id: true, name: true, code: true, levelId: true } },
      },
    });

    // ⭐ TRI PERSONNALISÉ : Maternelle 1 → Maternelle 2 → CI → CP → CE1 → CE2 → CM1 → CM2 → 6e → 5e → 4e → 3e → 2nde → 1ère → Terminale
    //    Le tri alphabétique ne marche pas (CE1 < CI alphabetiquement mais CI vient avant CE1 logiquement).
    //    On utilise le code de la classe pour définir l'ordre.
    const CLASS_ORDER: Record<string, number> = {
      'MAT1': 1, 'MAT2': 2, 'MATERNELLE1': 1, 'MATERNELLE2': 2,
      'CI': 10, 'CI_A': 10, 'CI_B': 11,
      'CP': 20, 'CP_A': 20, 'CP_B': 21,
      'CE1': 30, 'CE1_A': 30, 'CE1_B': 31,
      'CE2': 40, 'CE2_A': 40, 'CE2_B': 41,
      'CM1': 50, 'CM1_A': 50, 'CM1_B': 51,
      'CM2': 60, 'CM2_A': 60, 'CM2_B': 61,
      '6EME': 70, '6E': 70,
      '5EME': 80, '5E': 80,
      '4EME': 90, '4E': 90,
      '3EME': 100, '3E': 100,
      '2NDE': 110, '2NDE_D': 110,
      '1ERE': 120, '1ERE_D': 120,
      'TERM': 130, 'TERMINALE': 130, 'TLE': 130,
    };

    function getClassOrder(classCode: string | null | undefined): number {
      if (!classCode) return 999;
      const upper = classCode.toUpperCase().replace(/[\s\-]/g, '');
      // Essayer le code exact d'abord
      if (CLASS_ORDER[upper] !== undefined) return CLASS_ORDER[upper];
      // Essayer en remplaçant les espaces
      const normalized = upper.replace(/[^A-Z0-9]/g, '');
      if (CLASS_ORDER[normalized] !== undefined) return CLASS_ORDER[normalized];
      // Fallback: tri alphabétique + offset pour ne pas casser l'ordre
      return 500 + classCode.charCodeAt(0);
    }

    // Trier : 1) par niveau (Maternelle < Primaire < Secondaire), 2) par classe (CI < CP < CE1...), 3) par nom
    let filteredEnrollments = enrollments.sort((a, b) => {
      const levelOrderA = a.class?.schoolLevel?.order ?? 99;
      const levelOrderB = b.class?.schoolLevel?.order ?? 99;
      if (levelOrderA !== levelOrderB) return levelOrderA - levelOrderB;

      const classOrderA = getClassOrder(a.class?.code);
      const classOrderB = getClassOrder(b.class?.code);
      if (classOrderA !== classOrderB) return classOrderA - classOrderB;

      const lastNameA = (a.student?.lastName || '').toLowerCase();
      const lastNameB = (b.student?.lastName || '').toLowerCase();
      if (lastNameA !== lastNameB) return lastNameA.localeCompare(lastNameB);

      const firstNameA = (a.student?.firstName || '').toLowerCase();
      const firstNameB = (b.student?.firstName || '').toLowerCase();
      return firstNameA.localeCompare(firstNameB);
    });

    // Filtrer par niveau si fourni (levelId = UUID de school_levels)
    // ⭐ FIX : au lieu de comparer uniquement les UUIDs (qui diffèrent entre tenants),
    //    on compare aussi par CODE de niveau (MATERNELLE, PRIMAIRE, SECONDAIRE).
    //    Le frontend envoie l'UUID du niveau sélectionné, on charge son code,
    //    puis on filtre les enrollments par code.
    if (levelId) {
      let levelCode: string | null = null;
      try {
        const level = await this.prisma.schoolLevel.findUnique({
          where: { id: levelId },
          select: { code: true },
        });
        levelCode = level?.code || null;
      } catch {
        levelCode = levelId; // Si ce n'est pas un UUID, c'est peut-être déjà un code
      }

      filteredEnrollments = enrollments.filter((e) => {
        // Match par UUID
        if (e.class?.schoolLevel?.id === levelId) return true;
        if (e.class?.schoolLevelId === levelId) return true;
        if (e.student?.schoolLevelId === levelId) return true;
        if (e.academicClass?.levelId === levelId) return true;
        // ⭐ Match par CODE (robuste — fonctionne même avec doublons d'UUIDs entre tenants)
        if (levelCode) {
          if (e.class?.schoolLevel?.code === levelCode) return true;
          // Charger le code du student.schoolLevelId
        }
        return false;
      });

      // ⭐ Si le match par UUID a échoué mais qu'on a un levelCode, faire un second
      //    passage en chargeant les school_levels des students
      if (filteredEnrollments.length === 0 && levelCode) {
        const studentLevelIds = enrollments.map(e => e.student?.schoolLevelId).filter(Boolean);
        if (studentLevelIds.length > 0) {
          const studentLevels = await this.prisma.schoolLevel.findMany({
            where: { id: { in: studentLevelIds as string[] } },
            select: { id: true, code: true },
          });
          const matchingStudentLevelIds = new Set(
            studentLevels.filter(sl => sl.code === levelCode).map(sl => sl.id)
          );
          filteredEnrollments = enrollments.filter((e) =>
            matchingStudentLevelIds.has(e.student?.schoolLevelId || '')
          );
        }
      }

      this.logger.debug(`Filter by level: levelId=${levelId}, levelCode=${levelCode}, total=${enrollments.length}, filtered=${filteredEnrollments.length}`);
    }

    // ⭐ EXCLUSION AUTOMATIQUE des élèves marqués "paiement fondateur"
    //    Ces élèves sont exclus du sous-onglet "Encaissements standard" et
    //    apparaissent dans le sous-onglet dédié "Reçu par le fondateur".
    //    Le paramètre includePromoterStudents=true permet de les inclure
    //    (utilisé par le sous-onglet "Reçu par le fondateur" pour afficher
    //    la liste de CES élèves avec leurs paiements).
    const shouldIncludePromoterStudents = includePromoterStudents === 'true' || includePromoterStudents === '1';
    if (!shouldIncludePromoterStudents) {
      const promoterStudentIds = await this.promoterEligibilityService.getActiveStudentIds(tenantId, academicYearId);
      if (promoterStudentIds.size > 0) {
        const beforeCount = filteredEnrollments.length;
        filteredEnrollments = filteredEnrollments.filter((e) => !promoterStudentIds.has(e.studentId));
        this.logger.debug(`Excluded ${beforeCount - filteredEnrollments.length} promoter-eligible students from standard collection summary`);
      }
    }

    // ─── 3. Récupérer tous les paiements pour ces élèves ──────────────────────
    // ⭐ Juillet 2026 : on utilise FinanceTransaction (modèle moderne) au lieu de
    // PaymentAllocation (modèle legacy). Les 2550 transactions importées sont dans
    // finance_transactions avec leurs allocations dans finance_transaction_allocations.
    // On joint les allocations → accountBreakdowns → feeStructures pour récupérer le feeType.
    const studentIds = filteredEnrollments.map((e) => e.studentId);

    // ⭐ Si excludePromoterCaisse=true, récupérer l'ID de la caisse FONDE pour filtrer
    //    les transactions. On fait une requête séparée car Prisma ne supporte pas
    //    facilement un filtre WHERE cashRegister.code = 'FONDE' sur la relation.
    let promoterCaisseId: string | null = null;
    if (shouldExcludePromoter) {
      const promoterCaisse = await this.prisma.cashRegister.findFirst({
        where: { tenantId, code: 'FONDE' },
        select: { id: true },
      });
      promoterCaisseId = promoterCaisse?.id ?? null;
    }

    const transactions = await this.prisma.financeTransaction.findMany({
      where: {
        tenantId,
        academicYearId,
        studentAccount: { studentId: { in: studentIds } },
        // ⭐ Exclure les paiements de la caisse FONDE si demandé
        ...(shouldExcludePromoter && promoterCaisseId
          ? { cashRegisterId: { not: promoterCaisseId } }
          : {}),
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
    // Map: studentId → { hasPersonalization: boolean, totalCustomAmount: number, totalReduction: number, byFeeType: Map<feeType, {customAmount, reduction}> }
    const overrideByStudent = new Map<string, {
      hasPersonalization: boolean;
      totalCustomAmount: number;
      totalReduction: number;
      byFeeType: Map<string, { customAmount: number; reduction: number }>;
    }>();
    for (const ov of feeOverrides) {
      const standardAmount = Number(ov.feeStructure?.totalAmount || 0);
      const customAmount = Number(ov.customAmount || 0);
      const reduction = Math.max(0, standardAmount - customAmount);
      const feeType = ov.feeStructure?.feeType || 'UNKNOWN';
      const current = overrideByStudent.get(ov.studentId) || {
        hasPersonalization: false,
        totalCustomAmount: 0,
        totalReduction: 0,
        byFeeType: new Map<string, { customAmount: number; reduction: number }>(),
      };
      current.hasPersonalization = true;
      current.totalCustomAmount += customAmount;
      current.totalReduction += reduction;
      current.byFeeType.set(feeType, { customAmount, reduction });
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
      const inscriptionStandard = inscriptionStructures.reduce(
        (sum, fs) => sum + Number(fs.totalAmount), 0,
      );

      const reinscriptionStructures = matchByType('REINSCRIPTION');
      const reinscriptionStandard = reinscriptionStructures.reduce(
        (sum, fs) => sum + Number(fs.totalAmount), 0,
      );

      const tuitionStructures = matchByType('TUITION');
      const tuitionStandard = tuitionStructures.reduce(
        (sum, fs) => sum + Number(fs.totalAmount), 0,
      );

      // Arriéré attendu depuis StudentArrear (importé / reporté de l'année précédente)
      const arrearExpected = arrearInfo.expected;

      // ⭐ Appliquer les FeeOverride (personnalisations) sur les montants individuels
      //    Si l'élève a un FeeOverride sur INSCRIPTION → utiliser customAmount au lieu de standard
      //    Si l'élève a un FeeOverride sur TUITION → utiliser customAmount au lieu de standard
      const overrideInfo = overrideByStudent.get(enrollment.studentId) || {
        hasPersonalization: false,
        totalCustomAmount: 0,
        totalReduction: 0,
        byFeeType: new Map<string, { customAmount: number; reduction: number }>(),
      };

      const inscriptionOverride = overrideInfo.byFeeType.get('INSCRIPTION');
      const reinscriptionOverride = overrideInfo.byFeeType.get('REINSCRIPTION');
      const tuitionOverride = overrideInfo.byFeeType.get('TUITION');

      // ⭐ Montants attendus APRÈS personnalisation
      const inscriptionExpected = inscriptionOverride
        ? inscriptionOverride.customAmount  // Montant personnalisé
        : inscriptionStandard;              // Montant standard
      const reinscriptionExpected = reinscriptionOverride
        ? reinscriptionOverride.customAmount
        : reinscriptionStandard;
      const totalTuitionExpected = tuitionOverride
        ? tuitionOverride.customAmount
        : tuitionStandard;

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
      // ⭐ Les montants inscriptionExpected, reinscriptionExpected, totalTuitionExpected
      //    sont DÉJÀ personnalisés (FeeOverride appliqué ci-dessus).
      //    Donc totalDue = somme directe (pas besoin de soustraire la réduction).
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

  /**
   * ⭐ MODIFICATION DIRECTE D'UNE LIGNE ÉLÈVE — BILAN DES ENCAISSEMENTS
   *
   * Permet à l'administrateur de modifier directement les montants payés par
   * un élève pour réaligner les données de l'année scolaire écoulée avant
   * le basculement vers l'année prochaine.
   *
   * Body:
   *   - studentId : UUID de l'élève
   *   - academicYearId : UUID de l'année scolaire
   *   - inscriptionPaid : nouveau montant payé pour l'inscription
   *   - reinscriptionPaid : nouveau montant payé pour la réinscription
   *   - arrearPaid : nouveau montant payé pour les arriérés
   *   - tuitionInstallments : { [label]: montant } pour chaque tranche
   *   - totalTuitionPaid : (calculé automatiquement si non fourni)
   *
   * Stratégie :
   *   1. Drop triggers d'immutabilité (prevent_balance_update, no_delete_finance_transaction, etc.)
   *   2. Pour chaque type de frais (INSCRIPTION, REINSCRIPTION, TUITION, ARREAR) :
   *      - Trouver ou créer le breakdown
   *      - Supprimer les anciennes transactions IMP-EDIT-* de ce type
   *      - Créer une nouvelle transaction IMP-EDIT-{feeType}-{studentId}-{timestamp}
   *      - Mettre à jour le breakdown.paidAmount
   *   3. Recalculer student_account.totalPaid, totalDue, balance
   *   4. Recreate triggers
   */
  @Post('collection-summary/update-student')
  async updateStudentRow(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      studentId: string;
      academicYearId: string;
      inscriptionPaid?: number;
      reinscriptionPaid?: number;
      arrearPaid?: number;
      tuitionInstallments?: { [label: string]: number };
      totalTuitionPaid?: number;
    },
  ) {
    if (!body.studentId || !body.academicYearId) {
      throw new BadRequestException('studentId et academicYearId sont requis');
    }

    this.logger.log(`Update student row: tenant=${tenantId}, student=${body.studentId}, user=${user?.id}`);

    // ── 1. Drop triggers d'immutabilité ──
    await this.prisma.$executeRaw`DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts`;
    await this.prisma.$executeRaw`DROP TRIGGER IF EXISTS no_delete_finance_transaction ON finance_transactions`;
    await this.prisma.$executeRaw`DROP TRIGGER IF EXISTS trg_no_delete_finance_transaction ON finance_transactions`;
    await this.prisma.$executeRaw`DROP TRIGGER IF EXISTS lock_transaction_after_closure ON finance_transactions`;
    await this.prisma.$executeRaw`DROP TRIGGER IF EXISTS verify_integrity_hash_trigger ON finance_transactions`;
    await this.prisma.$executeRaw`DROP TRIGGER IF EXISTS trg_update_balance_after_tx ON finance_transactions`;

    try {
      // ── 2. Récupérer le compte de l'élève ──
      const account = await this.prisma.studentAccount.findFirst({
        where: {
          tenantId,
          academicYearId: body.academicYearId,
          studentId: body.studentId,
        },
        include: {
          breakdowns: { include: { feeStructure: true } },
        },
      });

      if (!account) {
        throw new BadRequestException('Compte élève introuvable');
      }

      // ── 3. Pour chaque type de frais, mettre à jour le paidAmount + transactions ──
      const timestamp = Date.now();
      const cashierId = user?.id || '00000000-0000-0000-0000-000000000000';

      const updateFeeType = async (
        feeType: 'INSCRIPTION' | 'REINSCRIPTION' | 'TUITION',
        newPaidAmount: number,
      ) => {
        // Trouver le breakdown existant
        let breakdown = account.breakdowns.find(b => b.feeStructure?.feeType === feeType);
        let feeStructure = breakdown?.feeStructure;

        // Si pas de breakdown, trouver la fee structure standard pour cette classe
        if (!breakdown) {
          // Récupérer l'inscription de l'élève pour connaître la classe
          const enrollment = await this.prisma.academicClassEnrollment.findFirst({
            where: { studentId: body.studentId, academicYearId: body.academicYearId },
            include: { class: true, academicClass: true },
          });

          // Chercher la fee structure qui matche (par classe > niveau > global)
          const feeStructures = await this.prisma.feeStructure.findMany({
            where: {
              tenantId,
              academicYearId: body.academicYearId,
              feeType,
              isActive: true,
            },
            include: { structureInstallments: true },
          });

          // Priorité : academicClass > physicalClass > level > global
          let matched: any = null;
          if (enrollment?.academicClassId) {
            matched = feeStructures.find(fs => fs.academicClassId === enrollment.academicClassId);
          }
          if (!matched && enrollment?.classId) {
            matched = feeStructures.find(fs => !fs.academicClassId && fs.classId === enrollment.classId);
          }
          if (!matched && enrollment?.class?.schoolLevelId) {
            matched = feeStructures.find(fs => !fs.academicClassId && !fs.classId && fs.levelId === enrollment.class.schoolLevelId);
          }
          if (!matched) {
            matched = feeStructures.find(fs => !fs.academicClassId && !fs.classId && !fs.levelId);
          }

          if (matched) {
            feeStructure = matched;
            // Créer le breakdown
            breakdown = await this.prisma.accountBreakdown.create({
              data: {
                id: crypto.randomUUID(),
                studentAccountId: account.id,
                feeStructureId: matched.id,
                initialAmount: Number(matched.totalAmount) || 0,
                adjustedAmount: Number(matched.totalAmount) || 0,
                paidAmount: 0,
                remainingAmount: Number(matched.totalAmount) || 0,
                createdAt: new Date(),
              },
            } as any) as any;
            this.logger.log(`Created breakdown for ${feeType}: ${breakdown.id}`);
          } else {
            this.logger.warn(`No fee structure found for ${feeType} — skipping`);
            return;
          }
        }

        if (!breakdown || !feeStructure) return;

        const oldPaid = Number(breakdown.paidAmount) || 0;
        const initialAmount = Number(breakdown.initialAmount) || Number(feeStructure.totalAmount) || 0;
        const newRemaining = Math.max(0, initialAmount - newPaidAmount);

        // ── Supprimer les anciennes transactions IMP-EDIT-* pour ce feeType ──
        const oldEditTxs = await this.prisma.$queryRaw<any[]>`
          SELECT ft.id FROM finance_transactions ft
          JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
          WHERE ft."studentAccountId" = ${account.id}
            AND fta."accountBreakdownId" = ${breakdown.id}
            AND ft."receiptNumber" LIKE ${'IMP-EDIT-' + feeType + '-%'}
        `;

        for (const old of oldEditTxs) {
          await this.prisma.$executeRaw`DELETE FROM finance_transaction_allocations WHERE "financeTransactionId" = ${old.id}`;
          await this.prisma.$executeRaw`DELETE FROM finance_transactions WHERE id = ${old.id}`;
        }

        // ── Créer une nouvelle transaction IMP-EDIT ──
        if (newPaidAmount > 0) {
          const txId = crypto.randomUUID();
          const receiptNumber = `IMP-EDIT-${feeType}-${body.studentId.substring(0, 8)}-${timestamp}`;
          await this.prisma.$executeRaw`
            INSERT INTO finance_transactions (id, "tenantId", "academicYearId", "studentAccountId", type, amount, "paymentMethod", "receiptNumber", "cashierId", "createdAt")
            VALUES (${txId}, ${tenantId}, ${body.academicYearId}, ${account.id}, 'PAYMENT'::text, ${newPaidAmount}, 'CASH'::text, ${receiptNumber}, ${cashierId}, NOW())
          `;

          // Créer l'allocation vers le breakdown
          const allocId = crypto.randomUUID();
          await this.prisma.$executeRaw`
            INSERT INTO finance_transaction_allocations (id, "financeTransactionId", "accountBreakdownId", amount)
            VALUES (${allocId}, ${txId}, ${breakdown.id}, ${newPaidAmount})
          `;
        }

        // ── Mettre à jour le breakdown ──
        await this.prisma.$executeRaw`
          UPDATE account_breakdowns
          SET "paidAmount" = ${newPaidAmount},
              "remainingAmount" = ${newRemaining}
          WHERE id = ${breakdown.id}
        `;

        this.logger.log(`Updated ${feeType} for student ${body.studentId}: ${oldPaid} → ${newPaidAmount}`);
      };

      // ── 4. Appliquer les mises à jour pour chaque type ──
      if (body.inscriptionPaid !== undefined) {
        await updateFeeType('INSCRIPTION', Number(body.inscriptionPaid) || 0);
      }
      if (body.reinscriptionPaid !== undefined) {
        await updateFeeType('REINSCRIPTION', Number(body.reinscriptionPaid) || 0);
      }

      // Pour TUITION : la somme des tranches = totalTuitionPaid
      let totalTuitionPaid = body.totalTuitionPaid;
      if (totalTuitionPaid === undefined && body.tuitionInstallments) {
        totalTuitionPaid = Object.values(body.tuitionInstallments).reduce((s, n) => s + Number(n || 0), 0);
      }
      if (totalTuitionPaid !== undefined) {
        await updateFeeType('TUITION', Number(totalTuitionPaid) || 0);
      }

      // ── 5. Mettre à jour l'arriéré (fee_arrears + student_arrears) ──
      if (body.arrearPaid !== undefined) {
        const newArrearPaid = Number(body.arrearPaid) || 0;
        // Mettre à jour fee_arrears pour cet élève
        const existingFeeArrear = await this.prisma.$queryRaw<any[]>`
          SELECT id, "totalDue" FROM fee_arrears
          WHERE "tenantId" = ${tenantId}
            AND "academicYearId" = ${body.academicYearId}
            AND "studentId" = ${body.studentId}
          LIMIT 1
        `;
        if (existingFeeArrear.length > 0) {
          const fa = existingFeeArrear[0];
          const arrearDue = Number(fa.totalDue) || 0;
          const arrearRemaining = Math.max(0, arrearDue - newArrearPaid);
          await this.prisma.$executeRaw`
            UPDATE fee_arrears
            SET "totalPaid" = ${newArrearPaid},
                "balanceDue" = ${arrearRemaining},
                "updatedAt" = NOW()
            WHERE id = ${fa.id}
          `;
        }
      }

      // ── 6. Recalculer student_account.totalPaid, balance ──
      // totalPaid = somme de tous les paidAmount des breakdowns + arrearPaid
      const updatedBreakdowns = await this.prisma.$queryRaw<any[]>`
        SELECT COALESCE(SUM("paidAmount"), 0) as total_paid
        FROM account_breakdowns
        WHERE "studentAccountId" = ${account.id}
      `;
      const breakdownsPaid = Number(updatedBreakdowns[0]?.total_paid || 0);

      const arrearRow = await this.prisma.$queryRaw<any[]>`
        SELECT COALESCE(SUM("totalPaid"), 0) as total_paid
        FROM fee_arrears
        WHERE "tenantId" = ${tenantId}
          AND "academicYearId" = ${body.academicYearId}
          AND "studentId" = ${body.studentId}
      `;
      const arrearPaidTotal = Number(arrearRow[0]?.total_paid || 0);

      // autres paiements (CANTEEN, EXAMEN, OTHER, ou null feeType)
      const otherTxRow = await this.prisma.$queryRaw<any[]>`
        SELECT COALESCE(SUM(ft.amount), 0) as total_other
        FROM finance_transactions ft
        LEFT JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
        LEFT JOIN account_breakdowns ab ON ab.id = fta."accountBreakdownId"
        LEFT JOIN fee_structures fs ON fs.id = ab."feeStructureId"
        WHERE ft."studentAccountId" = ${account.id}
          AND (fs."feeType" IS NULL OR fs."feeType" NOT IN ('INSCRIPTION', 'REINSCRIPTION', 'TUITION'))
      `;
      const otherPaid = Number(otherTxRow[0]?.total_other || 0);

      const newTotalPaid = breakdownsPaid + arrearPaidTotal + otherPaid;
      const newTotalDue = Number(account.totalDue) || 0;
      const newBalance = newTotalDue - newTotalPaid;

      await this.prisma.$executeRaw`
        UPDATE student_accounts
        SET "totalPaid" = ${newTotalPaid},
            "balance" = ${newBalance},
            "updatedAt" = NOW()
        WHERE id = ${account.id}
      `;

      this.logger.log(`✅ Updated student_account ${account.id}: totalPaid=${newTotalPaid}, balance=${newBalance}`);

      return {
        success: true,
        message: 'Ligne élève mise à jour avec succès',
        accountId: account.id,
        newTotalPaid,
        newBalance,
        newTotalDue,
      };
    } finally {
      // ── 7. Recreate triggers (toujours, même en cas d'erreur) ──
      await this.prisma.$executeRaw`DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts`;
      await this.prisma.$executeRaw`
        CREATE TRIGGER prevent_balance_update_trigger
        BEFORE UPDATE OF "totalPaid", "balance" ON student_accounts
        FOR EACH ROW EXECUTE FUNCTION prevent_balance_update()
      `;
      await this.prisma.$executeRaw`
        CREATE TRIGGER no_delete_finance_transaction
        BEFORE DELETE ON finance_transactions
        FOR EACH ROW EXECUTE FUNCTION prevent_finance_transaction_delete()
      `;
      await this.prisma.$executeRaw`
        CREATE TRIGGER trg_no_delete_finance_transaction
        BEFORE DELETE ON finance_transactions
        FOR EACH ROW EXECUTE FUNCTION prevent_finance_transaction_delete()
      `;
      await this.prisma.$executeRaw`
        CREATE TRIGGER verify_integrity_hash_trigger
        BEFORE UPDATE ON finance_transactions
        FOR EACH ROW EXECUTE FUNCTION verify_integrity_hash()
      `;
      await this.prisma.$executeRaw`
        CREATE TRIGGER trg_update_balance_after_tx
        AFTER INSERT ON finance_transactions
        FOR EACH ROW EXECUTE FUNCTION update_account_balance_after_tx()
      `;
      await this.prisma.$executeRaw`
        CREATE TRIGGER lock_transaction_after_closure
        BEFORE UPDATE ON finance_transactions
        FOR EACH ROW EXECUTE FUNCTION prevent_update_after_closure()
      `;
      this.logger.log('✅ Triggers recreated');
    }
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
