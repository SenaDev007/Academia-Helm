/**
 * SOUS-MODULE 2 — Comptes élèves (StudentAccount, AccountBreakdown)
 * Création automatique à admission, calcul totalDue/totalPaid/balance, statut dynamique, injection arriérés N→N+1.
 *
 * SÉCURITÉ SQL :
 * - Les champs balance/totalDue/totalPaid/arrearsAmount sont protégés par le trigger
 *   `prevent_balance_update` qui exige `app.allow_balance_update = 'true'` en session.
 * - Le champ `isBlocked` est protégé par `prevent_manual_block_update` qui exige
 *   `app.allow_block_update = 'true'`.
 * - Ce service configure ces flags via `prisma.$executeRaw` avant chaque update légitime.
 */
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const STATUS_ACTIVE = 'ACTIVE';
const STATUS_PARTIAL = 'PARTIAL';
const STATUS_PAID = 'PAID';
const STATUS_OVERDUE = 'OVERDUE';
const STATUS_BLOCKED = 'BLOCKED';
const STATUS_CLOSED = 'CLOSED';

/**
 * ⭐ FIX (sept. 2026 — bug « mauvais frais appliqués aux comptes élèves ») :
 * Sélectionne les FeeStructures applicables à un élève, avec la priorité :
 *
 *   Classe PHYSIQUE (classId, ex: CE1-A)  >  Classe OFFICIELLE (academicClassId, ex: CE1)
 *   >  Niveau (levelId, ex: Primaire)  >  Global (aucun scope)
 *
 * AVANT ce fix : `academicClassId` était IGNORÉ dans le matching. Or le modal
 * « Configuration des frais » crée les frais par classe OFFICIELLE (le frontend
 * envoie academicClassId, pas classId). Résultat : tous les frais d'un même
 * niveau entraient en collision sur la clé de déduplication (feeType) et un
 * SEUL frais — choisi dans un ordre arbitraire renvoyé par la DB — était
 * appliqué à TOUS les élèves du niveau. Concrètement à La Gaité (2026-2027) :
 * le « Frais de scolarité — 4ème » (80 000) appliqué aux 3ème/5ème/6ème/2nde D
 * (au lieu de 95 000 pour les 3ème), et le frais CE1 (50 000) appliqué aux
 * CI/CP (au lieu de 47 000).
 *
 * Déduplication : pour un même feeType, la structure la plus SPÉCIFIQUE gagne.
 * Exception : les frais GENERAUX (feeType = GENERAL) sont transversaux — ils se
 * dédupliquent par NOM (même nom = la plus spécifique gagne), ce qui permet à
 * plusieurs frais généraux distincts de coexister.
 *
 * @param allStructures Toutes les FeeStructures actives de l'année (avec installments)
 * @param student Scope de l'élève : classe physique, classe officielle, niveau
 */
export function selectApplicableStructures(
  allStructures: any[],
  student: { classId: string | null; academicClassId: string | null; levelId: string | null },
): any[] {
  const byType = new Map<string, { fs: any; specificity: number }>();
  for (const fs of allStructures) {
    let specificity = -1;
    if (fs.classId) {
      // Frais scoped à une classe PHYSIQUE : ne matche QUE cette classe.
      if (fs.classId === student.classId) specificity = 3;
    } else if (fs.academicClassId) {
      // Frais scoped à une classe OFFICIELLE : ne matche QUE cette classe officielle.
      if (fs.academicClassId === student.academicClassId) specificity = 2;
    } else if (fs.levelId) {
      // Frais scoped à un niveau (sans classe) : matche les élèves du niveau.
      if (fs.levelId === student.levelId) specificity = 1;
    } else {
      // Frais global : applicable à tous.
      specificity = 0;
    }
    if (specificity < 0) continue;

    const key =
      fs.feeType === 'GENERAL' ? `GENERAL::${(fs.name ?? '').trim().toLowerCase()}` : fs.feeType;
    const existing = byType.get(key);
    if (!existing || specificity > existing.specificity) {
      byType.set(key, { fs, specificity });
    }
  }
  return Array.from(byType.values()).map((v) => v.fs);
}

/**
 * Plan de recalcul d'un compte élève — sortie PURE de buildAccountRecalcPlan().
 * Contient toutes les écritures à effectuer, sans aucun accès DB : le chemin
 * mono-élève (recalculate) et le chemin batch (recalculateAccountsWhere)
 * partagent EXACTEMENT les mêmes règles métier via ce plan.
 */
export interface RecalcPlan {
  /** Breakdowns à supprimer (non payés — qu'ils soient applicables ou orphelins). */
  deleteIds: string[];
  /** Breakdowns conservés (payés) dont le montant doit être mis à jour. */
  updateBreakdowns: {
    id: string;
    initialAmount: number;
    adjustedAmount: number;
    remainingAmount: number;
  }[];
  /** Nouveaux breakdowns à créer (frais applicables pas encore présents). */
  createBreakdowns: {
    studentAccountId: string;
    feeStructureId: string;
    initialAmount: number;
    adjustedAmount: number;
    paidAmount: number;
    remainingAmount: number;
  }[];
  totalDue: number;
  totalPaid: number;
  balance: number;
}

@Injectable()
export class StudentAccountService {
  private readonly logger = new Logger(StudentAccountService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Active le flag SQL `app.allow_balance_update` pour la transaction courante.
   * À appeler AVANT toute mise à jour légitime de totalDue/totalPaid/balance/arrearsAmount.
   */
  private async allowBalanceUpdate(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`SET LOCAL app.allow_balance_update = 'true'`);
  }

  /**
   * Active le flag SQL `app.allow_block_update` pour la transaction courante.
   * À appeler AVANT toute mise à jour légitime de isBlocked.
   */
  private async allowBlockUpdate(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`SET LOCAL app.allow_block_update = 'true'`);
  }

  /**
   * ⚠️ RÈGLE MÉTIER : Nouvel élève vs ancien élève
   *
   * Filtre les FeeStructure selon le type d'enrollment pour appliquer
   * les bons frais d'inscription / réinscription :
   *   - enrollmentType === 'NEW' → frais d'INSCRIPTION (exclut REINSCRIPTION)
   *   - enrollmentType ∈ ['REPEAT', 'PROMOTION', 'TRANSFER'] → frais de
   *     REINSCRIPTION (exclut INSCRIPTION)
   *
   * Un élève ne doit JAMAIS payer à la fois INSCRIPTION et REINSCRIPTION.
   *
   * @param feeStructuresRaw Liste brute des FeeStructure (déjà dédupliquées par priorité)
   * @param enrollmentType Type d'enrollment ('NEW', 'REPEAT', 'PROMOTION', 'TRANSFER')
   * @returns Liste filtrée selon la règle métier
   */
  private filterFeesByEnrollmentType(feeStructuresRaw: any[], enrollmentType: string): any[] {
    const isNewStudent = enrollmentType === 'NEW';
    return feeStructuresRaw.filter((fs) => {
      if (isNewStudent) {
        // Nouvel élève : exclure REINSCRIPTION (il paie INSCRIPTION)
        return fs.feeType !== 'REINSCRIPTION';
      } else {
        // Ancien élève : exclure INSCRIPTION (il paie REINSCRIPTION)
        return fs.feeType !== 'INSCRIPTION';
      }
    });
  }

  /**
   * ⭐ FRAIS GÉNÉRAUX À LA CARTE (sept. 2026) — les FeeStructures GENERAL avec
   * isMandatory=false sont OPTIONNELLES : elles ne sont PAS appliquées
   * automatiquement aux comptes élèves (sinon chaque élève devrait ce frais).
   * Elles forment le « catalogue » de la section Frais généraux du modal de
   * paiement : le breakdown est créé À LA VOLÉE quand la secrétaire le
   * sélectionne dans l'encaissement (FinanceTransactionService.create,
   * generalFeeAddOns).
   *
   * Les GENERAL isMandatory=true (défaut) restent appliqués automatiquement
   * à tous les comptes — comportement historique inchangé.
   */
  private filterOptionalGeneralFees(feeStructures: any[]): any[] {
    return feeStructures.filter(
      (fs) => !(fs.feeType === 'GENERAL' && fs.isMandatory === false),
    );
  }

  /**
   * ⚠️ RÈGLE MÉTIER : Régimes tarifaires (FeeRegime)
   *
   * Charge le StudentFeeProfile de l'élève pour l'année, et si un régime
   * est appliqué (REDUCTION, ENFANT_ENSEIGNANT, BOURSE), calcule le montant
   * ajusté pour chaque FeeStructure selon les règles du régime.
   *
   * Types de règles :
   *   - reductionPercentage : pourcentage de réduction (ex: 20 = -20%)
   *   - fixedAmount : montant fixe (ex: 0 = exonération totale)
   *
   * Priorité : override personnalisé > régime tarifaire > montant standard
   *
   * @returns Un Map<feeStructureId, adjustedAmount> avec les montants ajustés
   */
  private async loadFeeRegimeAdjustments(
    tenantId: string,
    studentId: string,
    academicYearId: string,
  ): Promise<Map<string, number>> {
    const adjustments = new Map<string, number>();

    // Charger le profil tarifaire de l'élève
    const profile = await this.prisma.studentFeeProfile.findFirst({
      where: { studentId, academicYearId },
      include: {
        feeRegime: {
          include: { rules: true },
        },
      },
    });

    if (!profile?.feeRegime?.rules?.length) {
      return adjustments; // Pas de régime → pas d'ajustement
    }

    this.logger.log(
      `loadFeeRegimeAdjustments: régime "${profile.feeRegime.label}" appliqué ` +
      `(élève ${studentId}, ${profile.feeRegime.rules.length} règle(s))`,
    );

    // Pour chaque règle, calculer le montant ajusté
    for (const rule of profile.feeRegime.rules) {
      if (rule.feeStructureId) {
        // Règle spécifique à une FeeStructure
        const baseAmount = Number(rule.baseAmount ?? 0);
        let adjusted = baseAmount;

        if (rule.reductionPercentage != null && rule.reductionPercentage > 0) {
          adjusted = baseAmount * (1 - rule.reductionPercentage / 100);
        } else if (rule.fixedAmount != null) {
          adjusted = rule.fixedAmount;
        }

        adjustments.set(rule.feeStructureId, Math.round(adjusted));
      }
    }

    return adjustments;
  }

  /**
   * Résout la date d'échéance réelle d'une tranche en fonction de son mode.
   *
   * - FIXED                 : retourne installment.dueDate
   * - AT_ENROLLMENT         : retourne enrollmentDate (date d'inscription de l'élève)
   * - DAYS_AFTER_ENROLLMENT : retourne enrollmentDate + daysOffset jours
   *
   * Si enrollmentDate est null/undefined (élève sans inscription), on fallback sur
   * installment.dueDate (ou maintenant si pas de dueDate non plus).
   */
  private resolveDueDate(
    installment: any,
    enrollmentDate: Date | null | undefined,
  ): Date | null {
    const dueDateType = installment.dueDateType ?? 'FIXED';

    if (dueDateType === 'AT_ENROLLMENT') {
      if (enrollmentDate) return new Date(enrollmentDate);
      // Fallback : maintenant si pas d'inscription
      return installment.dueDate ? new Date(installment.dueDate) : new Date();
    }

    if (dueDateType === 'DAYS_AFTER_ENROLLMENT') {
      const base = enrollmentDate ? new Date(enrollmentDate) : new Date();
      const offset = installment.daysOffset ?? 0;
      const result = new Date(base);
      result.setDate(result.getDate() + offset);
      return result;
    }

    // FIXED
    return installment.dueDate ? new Date(installment.dueDate) : null;
  }

  /**
   * Crée ou récupère le compte élève pour une année.
   * Construit les AccountBreakdown à partir des FeeStructure applicables (priorité Classe > Niveau > Override).
   */
  async getOrCreate(
    tenantId: string,
    studentId: string,
    academicYearId: string,
  ): Promise<{ account: any; created: boolean }> {
    let account = await this.prisma.studentAccount.findUnique({
      where: { studentId_academicYearId: { studentId, academicYearId } },
      include: { breakdowns: { include: { feeStructure: true } } },
    });
    if (account) return { account, created: false };

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: { studentEnrollments: { where: { academicYearId }, include: { class: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');

    const enrollment = student.studentEnrollments?.[0];
    const classId = enrollment?.classId ?? null;
    /// ⭐ Classe officielle de l'élève (CE1, 4ème…) — utilisée par le matching
    ///    des frais scoped par classe officielle (voir selectApplicableStructures).
    const academicClassId = enrollment?.academicClassId ?? null;
    const levelId = student.schoolLevelId;
    const enrollmentType = enrollment?.enrollmentType ?? 'NEW';
    const previousArrears = Number(enrollment?.previousArrears ?? 0);

    const allStructures = await this.prisma.feeStructure.findMany({
      where: { tenantId, academicYearId, isActive: true },
      include: { structureInstallments: true, overrides: { where: { studentId } } },
    });
    // RÈGLE MÉTIER : Priorité d'application
    //   (Classe physique > Classe officielle > Niveau > Global)
    // ⭐ selectApplicableStructures honore academicClassId (fix sept. 2026).
    const feeStructuresRaw = selectApplicableStructures(allStructures, { classId, academicClassId, levelId });
    const feeStructures = this.filterOptionalGeneralFees(
      this.filterFeesByEnrollmentType(feeStructuresRaw, enrollmentType),
    );

    // ⚠️ RÈGLE MÉTIER : Régimes tarifaires (FeeRegime)
    //   Charge les ajustements du régime appliqué à l'élève (réductions, exonérations)
    //   Priorité : override personnalisé > régime tarifaire > montant standard
    const regimeAdjustments = await this.loadFeeRegimeAdjustments(tenantId, studentId, academicYearId);

    const totalDue = feeStructures.reduce((sum, fs) => {
      const override = fs.overrides[0];
      let amount: number;
      if (override) {
        amount = Number(override.customAmount);
      } else if (regimeAdjustments.has(fs.id)) {
        amount = regimeAdjustments.get(fs.id)!;
      } else {
        amount = Number(fs.totalAmount);
      }
      return sum + amount;
    }, 0);
    // (nouveaux clients qui ont des arriérés sur papier). Injectés dans le
    // StudentAccount pour être visibles dans le compte financier et inclus
    // dans le total dû et le solde.
    const totalDueWithArrears = totalDue + previousArrears;

    account = await this.prisma.studentAccount.create({
      data: {
        tenantId,
        studentId,
        academicYearId,
        totalDue: totalDueWithArrears,
        totalPaid: 0,
        balance: totalDueWithArrears,
        arrearsAmount: previousArrears,
        status: totalDueWithArrears > 0 ? STATUS_ACTIVE : STATUS_PAID,
        isBlocked: false,
        updatedAt: new Date(),
        breakdowns: {
          create: feeStructures.map((fs) => {
            const override = fs.overrides[0];
            let initialAmount: number;
            if (override) {
              initialAmount = Number(override.customAmount);
            } else if (regimeAdjustments.has(fs.id)) {
              initialAmount = regimeAdjustments.get(fs.id)!;
            } else {
              initialAmount = Number(fs.totalAmount);
            }
            return {
              feeStructureId: fs.id,
              initialAmount,
              adjustedAmount: initialAmount,
              paidAmount: 0,
              remainingAmount: initialAmount,
            };
          }),
        },
      },
      include: { breakdowns: { include: { feeStructure: true } } },
    });

    return { account, created: true };
  }

  /**
   * Recalcule le compte élève : recrée les breakdowns à partir des FeeStructures
   * actuelles + FeeOverrides. Utilisé après création/modification d'une personnalisation.
   */
  async recalculate(studentId: string, tenantId: string, academicYearId: string) {
    let account = await this.prisma.studentAccount.findUnique({
      where: { studentId_academicYearId: { studentId, academicYearId } },
      include: { breakdowns: true },
    });

    if (!account) {
      const result = await this.getOrCreate(tenantId, studentId, academicYearId);
      return result.account;
    }

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: { studentEnrollments: { where: { academicYearId }, include: { class: true } } },
    });
    if (!student) throw new NotFoundException('Student not found');

    const enrollment = student.studentEnrollments?.[0];
    const classId = enrollment?.classId ?? null;
    /// ⭐ Classe officielle de l'élève — pour le matching academicClassId (fix sept. 2026).
    const academicClassId = enrollment?.academicClassId ?? null;
    const levelId = student.schoolLevelId;
    const enrollmentType = enrollment?.enrollmentType ?? 'NEW';

    const allStructures = await this.prisma.feeStructure.findMany({
      where: { tenantId, academicYearId, isActive: true },
      include: { structureInstallments: true, overrides: { where: { studentId } } },
    });
    // Overrides de CET élève, à plat (le planner prend les structures SANS overrides attachées)
    const studentOverrides: any[] = allStructures.flatMap((fs: any) => fs.overrides ?? []);

    // ⚠️ RÈGLE MÉTIER : Régimes tarifaires (FeeRegime)
    const regimeAdjustments = await this.loadFeeRegimeAdjustments(tenantId, studentId, academicYearId);

    // Plan de recalcul (règles métier partagées avec le chemin batch — voir buildAccountRecalcPlan)
    const plan = this.buildAccountRecalcPlan({
      account: { id: account.id },
      breakdowns: account.breakdowns as any[],
      classId,
      academicClassId,
      levelId,
      enrollmentType,
      structures: allStructures,
      studentOverrides,
      regimeAdjustments,
    });

    // ── Application du plan (mêmes écritures qu'avant le refactor) ──

    // Supprimer les anciens breakdowns (non payés)
    if (plan.deleteIds.length > 0) {
      await this.prisma.accountBreakdown.deleteMany({
        where: { id: { in: plan.deleteIds } },
      });
    }

    // Mettre à jour les breakdowns conservés (applicables + orphelins resynchronisés)
    for (const u of plan.updateBreakdowns) {
      await this.prisma.accountBreakdown.update({
        where: { id: u.id },
        data: {
          initialAmount: u.initialAmount,
          adjustedAmount: u.adjustedAmount,
          remainingAmount: u.remainingAmount,
        },
      });
    }

    // Créer les nouveaux breakdowns
    if (plan.createBreakdowns.length > 0) {
      await this.prisma.accountBreakdown.createMany({ data: plan.createBreakdowns });
    }

    // Recalculer totalDue et balance
    // ⭐ Juillet 2026 : SET LOCAL app.allow_balance_update doit être dans la MÊME
    // transaction que l'UPDATE du studentAccount, sinon le trigger prevent_balance_update
    // déclenche l'erreur "Direct modification of balance fields is forbidden".
    // Avant : allowBalanceUpdate() + prisma.studentAccount.update() étaient dans 2
    // transactions séparées → le flag était perdu.
    // Maintenant : tout est dans une seule $transaction (pattern identique à
    // fee-structure.service.ts lignes 641-652 qui fonctionne correctement).
    const accountId = account.id;
    account = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.allow_balance_update = 'true'`);
      return tx.studentAccount.update({
        where: { id: accountId },
        data: {
          totalDue: plan.totalDue,
          totalPaid: plan.totalPaid,
          balance: plan.balance,
          updatedAt: new Date(),
        },
        include: { breakdowns: { include: { feeStructure: true } } },
      });
    });

    return account;
  }

  /**
   * ⭐ PLAN DE RECALCUL (sept. 2026) — cœur métier PUR (aucune requête DB).
   *
   * Calcule, pour UN compte élève, l'ensemble des écritures à effectuer pour
   * resynchroniser ses breakdowns avec les FeeStructures applicables :
   *
   *   1. Structures applicables = selectApplicableStructures (priorité
   *      Classe physique > Classe officielle > Niveau > Global, dédup par
   *      feeType — GENERAL dédup par nom), puis filtres métier :
   *      - filterFeesByEnrollmentType (NEW → INSCRIPTION, ancien → REINSCRIPTION)
   *      - filterOptionalGeneralFees (GENERAL isMandatory=false hors catalogue)
   *   2. Montant = override élève > régime tarifaire > totalAmount.
   *   3. Breakdowns non payés → supprimés (recréés si applicables).
   *      Breakdowns payés conservés → montants resynchronisés (applicables
   *      ET orphelins — cf. fix « suppression d'override »).
   *   4. Totaux = somme des breakdowns à l'état final.
   *
   * Ce planner est partagé par le chemin mono-élève (recalculate, utilisé par
   * les paiements/personnalisations) et le chemin batch
   * (recalculateAccountsWhere) → une seule source de vérité pour les règles.
   */
  private buildAccountRecalcPlan(input: {
    account: { id: string };
    breakdowns: any[];
    classId: string | null;
    academicClassId: string | null;
    levelId: string | null;
    enrollmentType: string;
    structures: any[];
    studentOverrides: any[];
    regimeAdjustments: Map<string, number>;
  }): RecalcPlan {
    const { breakdowns } = input;
    const structuresById = new Map<string, any>(input.structures.map((fs) => [fs.id, fs]));
    const overrideByFsId = new Map<string, any>(
      input.studentOverrides.map((o) => [o.feeStructureId, o]),
    );

    const applicable = this.filterOptionalGeneralFees(
      this.filterFeesByEnrollmentType(
        selectApplicableStructures(input.structures, {
          classId: input.classId,
          academicClassId: input.academicClassId,
          levelId: input.levelId,
        }),
        input.enrollmentType,
      ),
    );
    const applicableIds = new Set(applicable.map((fs) => fs.id));

    // Priorité : override personnalisé > régime tarifaire > montant standard
    const computeAmount = (fs: any): number => {
      const override = overrideByFsId.get(fs.id);
      if (override) return Number(override.customAmount);
      if (input.regimeAdjustments.has(fs.id)) return input.regimeAdjustments.get(fs.id)!;
      return Number(fs.totalAmount);
    };

    // 1) Évaluer CHAQUE breakdown en place.
    //    - orphelin NON PAYÉ (structure sortie du périmètre) → à supprimer
    //      (comportement historique : deleteMany des non payés) ;
    //    - tous les autres (payés OU non payés d'une structure applicable) →
    //      conservés et mis à jour SUR PLACE si besoin. ⭐ Amélioration vs
    //      l'ancien code qui supprimait PUIS recréait les breakdowns non payés
    //      à chaque recalcul : ici on préserve les ids de lignes (et donc les
    //      FinanceTransactionAllocation qui les référencent), on ne réécrit
    //      que ce qui a réellement changé → recalcul idempotent et rapide.
    const deleteIds: string[] = [];
    const kept: any[] = [];
    for (const b of breakdowns) {
      const isApplicable = applicableIds.has(b.feeStructureId);
      if (!isApplicable && Number(b.paidAmount) === 0) {
        deleteIds.push(b.id);
        continue;
      }
      kept.push(b);
    }
    const keptFsIds = new Set(kept.map((b) => b.feeStructureId));

    // 2) Breakdowns conservés : resynchroniser les montants.
    //    - breakdown d'une structure APPLICABLE → montant recalculé (override/régime/total)
    //    - breakdown ORPHELIN PAYÉ (structure sortie du périmètre : élève changé
    //      de classe, frais désactivé, enrollmentType changé) → override actif
    //      éventuel, sinon montant d'origine de la structure. On resynchronise
    //      toujours adjustedAmount avec initialAmount et on recalcule
    //      remainingAmount (cf. fix « badge Pers. » après suppression d'override).
    const updateBreakdowns: RecalcPlan['updateBreakdowns'] = [];
    for (const b of kept) {
      const fs = structuresById.get(b.feeStructureId);
      let newAmount: number;
      if (applicableIds.has(b.feeStructureId) && fs) {
        newAmount = computeAmount(fs);
      } else {
        const override = overrideByFsId.get(b.feeStructureId);
        newAmount = override
          ? Number(override.customAmount)
          : fs
            ? Number(fs.totalAmount)
            : Number(b.initialAmount);
      }
      if (Number(b.initialAmount) !== newAmount || Number(b.adjustedAmount) !== newAmount) {
        updateBreakdowns.push({
          id: b.id,
          initialAmount: newAmount,
          adjustedAmount: newAmount,
          remainingAmount: newAmount - Number(b.paidAmount),
        });
      }
    }

    // 3) Breakdowns applicables manquants (aucune ligne existante, payée ou
    //    non) → à créer
    const createBreakdowns: RecalcPlan['createBreakdowns'] = applicable
      .filter((fs) => !keptFsIds.has(fs.id))
      .map((fs) => {
        const initialAmount = computeAmount(fs);
        return {
          studentAccountId: input.account.id,
          feeStructureId: fs.id,
          initialAmount,
          adjustedAmount: initialAmount,
          paidAmount: 0,
          remainingAmount: initialAmount,
        };
      });

    // 4) Totaux sur l'état final (conservés mis à jour + créations)
    let totalDue = 0;
    let totalPaid = 0;
    for (const b of kept) {
      const upd = updateBreakdowns.find((u) => u.id === b.id);
      totalDue += upd ? upd.initialAmount : Number(b.initialAmount);
      totalPaid += Number(b.paidAmount);
    }
    for (const c of createBreakdowns) totalDue += c.initialAmount;

    return {
      deleteIds,
      updateBreakdowns,
      createBreakdowns,
      totalDue,
      totalPaid,
      balance: totalDue - totalPaid,
    };
  }

  /**
   * ⭐ RECALCUL EN BATCH (sept. 2026 — fix « le modal de configuration des frais
   * charge indéfiniment / délai d'attente dépassé »).
   *
   * AVANT : recalculateAllAccounts exécutait ~12 requêtes SÉQUENTIELLES par élève
   * (426 comptes × 173 ms ≈ 177 s) dans le fil de la requête HTTP → les timeouts
   * (30 s côté navigateur, 55 s côté BFF Vercel) tuaient la réponse alors que
   * l'enregistrement était déjà créé côté Railway → « échec » affiché à tort.
   *
   * MAINTENANT : ce runner remplace le N+1 par du bulk :
   *   - ~6 lectures groupées (comptes, structures, overrides, régimes, breakdowns, élèves)
   *   - calcul des plans en mémoire (buildAccountRecalcPlan — mêmes règles métier
   *     que le chemin mono-élève)
   *   - 4 écritures groupées : deleteMany + createMany + 2 UPDATE…FROM unnest
   * → une année entière est recalculée en quelques secondes, quel que soit
   *   l'effectif. Utilisé en arrière-plan par la création/modification de frais
   * (fee-structure.service) et par l'endpoint explicite recalculate-accounts.
   *
   * @param accountWhere Filtre Prisma optionnel sur student_accounts — permet de
   *        ne recalculer que les comptes du périmètre d'un frais (classe officielle,
   *        classe physique, niveau, ou tout le tenant).
   */
  async recalculateAccountsWhere(
    tenantId: string,
    academicYearId: string | undefined,
    accountWhere?: any,
  ): Promise<{
    success: boolean;
    accountsRecalculated: number;
    breakdownsUpdated: number;
    accountsTotal: number;
  }> {
    const accounts = await this.prisma.studentAccount.findMany({
      where: {
        tenantId,
        ...(academicYearId ? { academicYearId } : {}),
        ...(accountWhere ?? {}),
      },
      select: { id: true, studentId: true, academicYearId: true },
    });
    if (accounts.length === 0) {
      return { success: true, accountsRecalculated: 0, breakdownsUpdated: 0, accountsTotal: 0 };
    }

    // Grouper par année scolaire (les structures/régimes sont résolus PAR année,
    // exactement comme le chemin mono-élève qui filtrait sur academicYearId).
    const accountsByYear = new Map<string, { id: string; studentId: string }[]>();
    for (const a of accounts) {
      const list = accountsByYear.get(a.academicYearId) ?? [];
      list.push({ id: a.id, studentId: a.studentId });
      accountsByYear.set(a.academicYearId, list);
    }

    const allDeleteIds: string[] = [];
    const allUpdates: RecalcPlan['updateBreakdowns'] = [];
    const allCreates: RecalcPlan['createBreakdowns'] = [];
    const accountTotals: { id: string; totalDue: number; totalPaid: number; balance: number }[] = [];
    let accountsRecalculated = 0;

    for (const [year, yearAccounts] of accountsByYear) {
      // ── Contexte partagé de l'année (6 lectures au total, année entière) ──
      const structures = await this.prisma.feeStructure.findMany({
        where: { tenantId, academicYearId: year, isActive: true },
        include: { structureInstallments: true },
      });
      const structureIds = structures.map((fs) => fs.id);

      const overrides = structureIds.length
        ? await this.prisma.feeOverride.findMany({
            where: { feeStructureId: { in: structureIds } },
          })
        : [];
      const overridesByStudent = new Map<string, any[]>();
      for (const o of overrides) {
        const list = overridesByStudent.get(o.studentId) ?? [];
        list.push(o);
        overridesByStudent.set(o.studentId, list);
      }

      // Régimes tarifaires : même calcul que loadFeeRegimeAdjustments, en une requête
      const regimeAdjustmentsByStudent = new Map<string, Map<string, number>>();
      const profiles = await this.prisma.studentFeeProfile.findMany({
        where: { academicYearId: year },
        include: { feeRegime: { include: { rules: true } } },
      });
      for (const profile of profiles) {
        const adjustments = new Map<string, number>();
        for (const rule of profile.feeRegime?.rules ?? []) {
          if (rule.feeStructureId) {
            const baseAmount = Number(rule.baseAmount ?? 0);
            let adjusted = baseAmount;
            if (rule.reductionPercentage != null && rule.reductionPercentage > 0) {
              adjusted = baseAmount * (1 - rule.reductionPercentage / 100);
            } else if (rule.fixedAmount != null) {
              adjusted = rule.fixedAmount;
            }
            adjustments.set(rule.feeStructureId, Math.round(adjusted));
          }
        }
        regimeAdjustmentsByStudent.set(profile.studentId, adjustments);
      }

      const yearAccountIds = yearAccounts.map((a) => a.id);
      const breakdowns = await this.prisma.accountBreakdown.findMany({
        where: { studentAccountId: { in: yearAccountIds } },
      });
      const breakdownsByAccount = new Map<string, any[]>();
      for (const b of breakdowns) {
        const list = breakdownsByAccount.get(b.studentAccountId) ?? [];
        list.push(b);
        breakdownsByAccount.set(b.studentAccountId, list);
      }

      const yearStudentIds = Array.from(new Set(yearAccounts.map((a) => a.studentId)));
      const students: any[] = await this.prisma.student.findMany({
        where: { id: { in: yearStudentIds }, tenantId },
        include: {
          studentEnrollments: {
            where: { academicYearId: year },
            select: { classId: true, academicClassId: true, enrollmentType: true },
          },
        },
      });
      const studentById = new Map(students.map((s) => [s.id, s]));

      // ── Plans (pur, en mémoire) ──
      for (const account of yearAccounts) {
        const student = studentById.get(account.studentId);
        if (!student) continue; // élève introuvable → ignoré (non bloquant, comme avant)
        const enrollment = student.studentEnrollments?.[0];
        const plan = this.buildAccountRecalcPlan({
          account,
          breakdowns: breakdownsByAccount.get(account.id) ?? [],
          classId: enrollment?.classId ?? null,
          academicClassId: enrollment?.academicClassId ?? null,
          levelId: (student as any).schoolLevelId ?? null,
          enrollmentType: enrollment?.enrollmentType ?? 'NEW',
          structures,
          studentOverrides: overridesByStudent.get(account.studentId) ?? [],
          regimeAdjustments: regimeAdjustmentsByStudent.get(account.studentId) ?? new Map(),
        });
        allDeleteIds.push(...plan.deleteIds);
        allUpdates.push(...plan.updateBreakdowns);
        allCreates.push(...plan.createBreakdowns);
        accountTotals.push({
          id: account.id,
          totalDue: plan.totalDue,
          totalPaid: plan.totalPaid,
          balance: plan.balance,
        });
        accountsRecalculated++;
      }
    }

    // ── Application groupée (4 écritures, quelle que soit la taille du batch) ──
    if (allDeleteIds.length > 0) {
      await this.prisma.accountBreakdown.deleteMany({ where: { id: { in: allDeleteIds } } });
    }
    if (allCreates.length > 0) {
      await this.prisma.accountBreakdown.createMany({ data: allCreates });
    }
    if (allUpdates.length > 0) {
      const ids = allUpdates.map((u) => u.id);
      const initials = allUpdates.map((u) => u.initialAmount);
      const adjusteds = allUpdates.map((u) => u.adjustedAmount);
      const remainings = allUpdates.map((u) => u.remainingAmount);
      await this.prisma.$executeRaw`
        UPDATE account_breakdowns AS ab
        SET "initialAmount" = t.ia, "adjustedAmount" = t.aa, "remainingAmount" = t.ra
        FROM unnest(
          ${ids}::text[],
          ${initials}::float8[],
          ${adjusteds}::float8[],
          ${remainings}::float8[]
        ) AS t(bid, ia, aa, ra)
        WHERE ab.id = t.bid
      `;
    }
    if (accountTotals.length > 0) {
      const ids = accountTotals.map((a) => a.id);
      const dues = accountTotals.map((a) => a.totalDue);
      const paids = accountTotals.map((a) => a.totalPaid);
      const bals = accountTotals.map((a) => a.balance);
      const now = new Date();
      // SET LOCAL app.allow_balance_update dans la MÊME transaction que l'UPDATE
      // (pattern obligatoire — cf. trigger prevent_balance_update_trigger).
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.allow_balance_update = 'true'`);
        await tx.$executeRaw`
          UPDATE student_accounts AS sa
          SET "totalDue" = t.due, "totalPaid" = t.paid, "balance" = t.bal, "updatedAt" = ${now}
          FROM unnest(
            ${ids}::text[],
            ${dues}::float8[],
            ${paids}::float8[],
            ${bals}::float8[]
          ) AS t(aid, due, paid, bal)
          WHERE sa.id = t.aid
        `;
      });
    }

    console.log(
      `[StudentAccount] Recalcul batch: ${accountsRecalculated}/${accounts.length} comptes, ` +
        `${allCreates.length} créations, ${allUpdates.length} mises à jour, ` +
        `${allDeleteIds.length} suppressions (tenant=${tenantId}${academicYearId ? `, year=${academicYearId}` : ''})`,
    );

    return {
      success: true,
      accountsRecalculated,
      breakdownsUpdated: allUpdates.length + allCreates.length,
      accountsTotal: accounts.length,
    };
  }

  /**
   * Met à jour le statut du compte à partir du solde et des échéances.
   */
  async updateStatus(accountId: string, tenantId: string): Promise<string> {
    const account = await this.prisma.studentAccount.findFirst({
      where: { id: accountId, tenantId },
      include: {
        breakdowns: {
          include: { feeStructure: { include: { structureInstallments: true } } },
        },
      },
    });
    if (!account) throw new NotFoundException('StudentAccount not found');

    // Charger la date d'inscription de l'élève pour résoudre les échéances
    // AT_ENROLLMENT et DAYS_AFTER_ENROLLMENT
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { studentId: account.studentId, academicYearId: account.academicYearId },
      select: { enrollmentDate: true },
      orderBy: { enrollmentDate: 'desc' },
    });
    const enrollmentDate = enrollment?.enrollmentDate ?? null;

    const balance = Number(account.balance);
    let status = account.status;
    let isBlocked = account.isBlocked;

    // RÈGLE MÉTIER : Vérification du seuil de blocage automatique
    const settings = await this.prisma.financialSettings.findUnique({ where: { tenantId } });
    if (settings && balance > Number(settings.blockingThreshold) && !isBlocked) {
      isBlocked = true;
      // Note: Le trigger 'trg_audit_account_blocking' créera automatiquement le log d'audit
    }

    if (isBlocked) status = STATUS_BLOCKED;
    else if (balance <= 0) status = STATUS_PAID;
    else {
      const now = new Date();
      const hasOverdue = account.breakdowns?.some((b) => {
        const rem = Number(b.remainingAmount);
        if (rem <= 0) return false;
        const fs = b.feeStructure;
        const installments = fs?.structureInstallments ?? [];
        // Résoudre les échéances en tenant compte du mode (FIXED / AT_ENROLLMENT / DAYS_AFTER_ENROLLMENT)
        const nextDue = installments
          .filter((i) => Number(b.paidAmount) < Number(fs?.totalAmount ?? 0))
          .map((i) => ({ installment: i, resolvedDue: this.resolveDueDate(i, enrollmentDate) }))
          .filter((x) => x.resolvedDue !== null)
          .sort((a, b) => a.resolvedDue!.getTime() - b.resolvedDue!.getTime())[0];
        return nextDue && nextDue.resolvedDue! < now;
      });
      status = hasOverdue ? STATUS_OVERDUE : STATUS_PARTIAL;
    }

    // Active le flag SQL pour autoriser la mise à jour de isBlocked (si changement)
    if (isBlocked !== account.isBlocked) {
      await this.allowBlockUpdate();
    }
    await this.prisma.studentAccount.update({
      where: { id: accountId },
      data: { status, isBlocked, updatedAt: new Date() },
    });
    return status;
  }

  /**
   * Injecte les arriérés de l'année N dans le compte N+1 (arrearsAmount + breakdown).
   */
  async injectArrearsFromPreviousYear(
    tenantId: string,
    studentId: string,
    fromAcademicYearId: string,
    toAcademicYearId: string,
    arrearsAmount: number,
  ) {
    if (arrearsAmount <= 0) return null;

    const { account } = await this.getOrCreate(tenantId, studentId, toAcademicYearId);

    const newTotalDue = Number(account.totalDue) + arrearsAmount;
    const newBalance = Number(account.balance) + arrearsAmount;

    // ⭐ Juillet 2026 : SET LOCAL + UPDATE dans la MÊME $transaction (sinon le flag
    // est perdu entre les deux appels et le trigger prevent_balance_update déclenche).
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.allow_balance_update = 'true'`);
      await tx.studentAccount.update({
        where: { id: account.id },
        data: {
          arrearsAmount: Number(account.arrearsAmount) + arrearsAmount,
          totalDue: newTotalDue,
          balance: newBalance,
          updatedAt: new Date(),
        },
      });
    });

    return this.prisma.studentAccount.findUnique({
      where: { id: account.id },
      include: { breakdowns: true },
    });
  }

  async findAll(
    tenantId: string,
    filters: {
      academicYearId: string;
      classId?: string;
      status?: string;
      isBlocked?: boolean;
      search?: string;
      page?: number;
      limit?: number;
      // ⭐ Task 20-a : si true, lève la limite de 500 (export PDF/Excel tous les comptes)
      exportAll?: boolean;
      // ⭐ Task 23 : si true, inclut les élèves abandonnés (status=WITHDRAWN).
      // Par défaut (false), les élèves abandonnés sont EXCLUS de la liste
      // pour éviter les confusions dans le module Comptes élèves.
      includeWithdrawn?: boolean;
    },
  ) {
    const where: any = { tenantId, academicYearId: filters.academicYearId };
    if (filters.status) where.status = filters.status;
    if (filters.isBlocked !== undefined) where.isBlocked = filters.isBlocked;
    // ⭐ Task 23 : exclure les élèves abandonnés par défaut
    // (status = 'WITHDRAWN' sur Student + isActive=false).
    // Si filters.includeWithdrawn=true, on les inclut (utile pour audit/historique).
    if (!filters.includeWithdrawn) {
      where.student = {
        ...(where.student || {}),
        status: { not: 'WITHDRAWN' },
      };
    }
    if (filters.classId) {
      where.student = {
        ...(where.student || {}),
        studentEnrollments: {
          some: { academicYearId: filters.academicYearId, classId: filters.classId },
        },
      };
    }
    // ⭐ Recherche côté backend (mode insensible à la casse) sur nom/prénom/matricule/studentCode
    // — pattern identique au module Élève (Task 9-a)
    // ⭐ Task 23 : la recherche est combinée AVEC le filtre student.status (AND logique)
    // pour ne jamais remonter les élèves abandonnés (sauf si includeWithdrawn=true).
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      // Construire un filtre student combiné : status NOT WITHDRAWN + (OR sur les champs)
      const studentFilter: any = { ...(where.student || {}) };
      studentFilter.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { matricule: { contains: q, mode: 'insensitive' } },
        { studentCode: { contains: q, mode: 'insensitive' } },
      ];
      where.student = studentFilter;
      // Supprimer where.OR (qui était utilisé avant et entrait en conflit avec where.student)
      delete where.OR;
    }

    // ⭐ Pagination optionnelle : si page/limit fournis → retour paginé avec sommes agrégées
    // { data, total, page, limit, totalPages, sums: { totalDue, totalPaid, balance, actualArrears } }
    // Les sommes sont calculées sur TOUS les comptes (pas seulement la page active)
    // pour que les KPIs affichés soient les vrais totaux serveur.
    const isPaginated = !!(filters.page && filters.limit);
    const page = Math.max(1, filters.page ?? 1);
    // ⭐ Task 20-a : si exportAll=true, on lève la limite à 100 000 (export tous les comptes)
    const limit = filters.exportAll
      ? 100000
      : Math.min(500, Math.max(1, filters.limit ?? 50));

    const findManyArgs = {
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
            matricule: true,
            // ⭐ Task 20-a : inclure le niveau scolaire (name + code) pour les exports PDF/Excel
            schoolLevel: { select: { id: true, name: true, code: true } },
            studentEnrollments: {
              where: { academicYearId: filters.academicYearId },
              select: {
                id: true,
                classId: true,
                class: { select: { id: true, name: true } },
                // ⭐ enrollmentType pour afficher le badge Nouvel/Ancien élève
                enrollmentType: true,
              },
            },
          },
        },
        breakdowns: {
          include: {
            feeStructure: {
              select: { id: true, name: true, feeType: true, totalAmount: true, customFeeTypeLabel: true },
            },
          },
        },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
      ...(isPaginated
        ? { skip: (page - 1) * limit, take: limit }
        // ⭐ Task 20-a : si exportAll=true, on ne cappe pas à 500
        : { take: filters.exportAll ? 100000 : 500 }),
    };

    const baseAccounts = await this.prisma.studentAccount.findMany(findManyArgs);

    // ⭐ Task 31 : Récupérer les overrides PAR ÉLÈVE pour hasOverride
    // On ne peut pas utiliser feeStructure.overrides dans le include Prisma car
    // ça retournerait TOUS les overrides de la feeStructure (pas filtrés par
    // studentId). À la place, on charge les overrides séparément et on les
    // joint manuellement par (studentId, feeStructureId).
    //
    // ⚠️ FIX : studentIds DOIT être déclaré AVANT son utilisation (TDZ).
    // Avant ce fix, studentIds était déclaré à la ligne 729 (après son
    // utilisation à la ligne 709), ce qui provoquait :
    //   ReferenceError: Cannot access 'studentIds' before initialization
    // → caught by global exception filter → "Erreur interne (ReferenceError)"
    // → frontend toast "erreur interne, erreur référence account not access student ID"
    const studentIds = baseAccounts.map((a) => a.studentId);

    const overridesForStudents = studentIds.length > 0
      ? await this.prisma.feeOverride.findMany({
          where: {
            studentId: { in: studentIds },
            feeStructure: { tenantId, academicYearId: filters.academicYearId },
          },
          select: { id: true, studentId: true, feeStructureId: true, customAmount: true },
        })
      : [];
    // Index: "studentId|feeStructureId" → override
    const overrideMap = new Map<string, any>();
    for (const o of overridesForStudents) {
      overrideMap.set(`${o.studentId}|${o.feeStructureId}`, o);
    }

    // ─── Multi-année : récupérer les arriérés réels (FeeArrear) pour chaque élève ───
    // Les champs StudentAccount.arrearsAmount et carriedArrears ne sont pas toujours
    // synchronisés avec les FeeArrear (ex: arriérés créés manuellement via le module
    // Recouvrement). On agrège donc les FeeArrear ouverts (OPEN ou PARTIALLY_PAID)
    // pour afficher le vrai total d'arriérés dans la colonne "Arriérés".
    const openArrears: any[] = studentIds.length > 0
      ? await this.prisma.feeArrear.findMany({
          where: {
            tenantId,
            studentId: { in: studentIds },
            status: { in: ['OPEN', 'PARTIALLY_PAID'] },
            balanceDue: { gt: 0 },
          },
          include: {
            academicYear: { select: { name: true, startDate: true } },
          },
          orderBy: [{ academicYear: { startDate: 'asc' } }],
        })
      : [];

    // Grouper par studentId
    const arrearsByStudent = new Map<string, { total: number; items: any[] }>();
    for (const arrear of openArrears) {
      const existing = arrearsByStudent.get(arrear.studentId) || { total: 0, items: [] };
      existing.total += Number(arrear.balanceDue ?? 0);
      existing.items.push({
        id: arrear.id,
        academicYearId: arrear.academicYearId,
        academicYearName: arrear.academicYear?.name || '—',
        totalDue: Number(arrear.totalDue ?? 0),
        totalPaid: Number(arrear.totalPaid ?? 0),
        balanceDue: Number(arrear.balanceDue ?? 0),
        status: arrear.status,
        notes: arrear.notes,
      });
      arrearsByStudent.set(arrear.studentId, existing);
    }

    // Attacher les infos d'arriérés à chaque compte.
    // ⚠️ IMPORTANT : Le `totalDue` et `balance` affichés doivent INCLURE les arriérés
    // (FIFO) pour refléter la vraie dette de l'élève envers l'établissement.
    // On conserve aussi `baseTotalDue` / `baseBalance` (sans arriérés) pour référence.
    const accounts = baseAccounts.map((account) => {
      const arrearData = arrearsByStudent.get(account.studentId);
      const actualArrears = arrearData?.total ?? 0;
      const baseTotalDue = Number(account.totalDue ?? 0);
      const baseBalance = Number(account.balance ?? 0);
      // ⭐ Task 31 : déterminer hasOverride en vérifiant si CET élève spécifique
      // a un override pour AU MOINS UNE de ses feeStructures.
      // On utilise overrideMap (chargé séparément, filtré par studentId) au lieu
      // de feeStructure.overrides (qui n'est PAS filtré par studentId et donc
      // retourne les overrides de TOUS les élèves pour cette feeStructure).
      const hasOverride = (account.breakdowns ?? []).some(
        (b: any) => overrideMap.has(`${account.studentId}|${b.feeStructureId}`)
      );
      // Enrichir chaque breakdown avec hasOverride pour le frontend
      const enrichedBreakdowns = (account.breakdowns ?? []).map((b: any) => ({
        ...b,
        hasOverride: overrideMap.has(`${account.studentId}|${b.feeStructureId}`),
      }));
      return {
        ...account,
        breakdowns: enrichedBreakdowns,
        hasOverride,
        // Montants "de base" (sans arriérés) — pour info / debug
        baseTotalDue,
        baseBalance,
        // actualArrears : total des FeeArrear ouverts (toutes années confondues)
        actualArrears,
        // feeArrears : détails des arriérés (pour le modal de détail)
        feeArrears: arrearData?.items ?? [],
        // ⚠️ Surcharge : totalDue et balance INCLUENT maintenant les arriérés
        // (compatibilité avec le FIFO — ce sont ces montants qui seront déduits
        // au fur et à mesure des paiements)
        totalDue: baseTotalDue + actualArrears,
        balance: baseBalance + actualArrears,
      };
    });

    // ⭐ Si non paginé → retourne l'array (rétro-compatibilité avec RecoveryContent,
    // FinanceReportsContent, StudentIdentityContent qui attendent un array)
    if (!isPaginated) {
      return accounts;
    }

    // ⭐ Si paginé → calcule le total + sommes agrégées (KPIs globaux) en parallèle
    // Pour les KPIs "total dû / payé / reste" on a besoin de la somme sur TOUS les
    // comptes (pas seulement la page active). Pour les arriérés (FeeArrear), on
    // doit récupérer tous les studentIds matchés puis agréger les FeeArrear ouverts.
    const allMatchingStudentIds = (await this.prisma.studentAccount.findMany({
      where,
      select: { studentId: true },
    })).map((s) => s.studentId);

    const [total, sums, globalArrearsAgg] = await Promise.all([
      this.prisma.studentAccount.count({ where }),
      // ⭐ Sommes agrégées sur TOUS les comptes (pas seulement la page active)
      // pour que les KPIs affichés soient les vrais totaux serveur.
      this.prisma.studentAccount.aggregate({
        where,
        _sum: { totalDue: true, totalPaid: true, balance: true },
      }),
      // ⭐ Total global des arriérés (FeeArrear ouverts) pour TOUS les élèves matchés
      allMatchingStudentIds.length > 0
        ? this.prisma.feeArrear.aggregate({
            where: {
              tenantId,
              studentId: { in: allMatchingStudentIds },
              status: { in: ['OPEN', 'PARTIALLY_PAID'] },
              balanceDue: { gt: 0 },
            },
            _sum: { balanceDue: true },
          })
        : Promise.resolve({ _sum: { balanceDue: null } }),
    ]);

    // ⚠️ Pour les KPIs, on INCLUT les arriérés réels (FIFO) — sinon les KPIs
    // sous-estimeraient la vraie dette (le `balance` de la table est sans arriérés).
    const totalActualArrears = Number(globalArrearsAgg._sum.balanceDue ?? 0);

    return {
      data: accounts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      sums: {
        totalDue: Number(sums._sum.totalDue ?? 0) + totalActualArrears,
        totalPaid: Number(sums._sum.totalPaid ?? 0),
        balance: Number(sums._sum.balance ?? 0) + totalActualArrears,
        actualArrears: totalActualArrears,
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const account = await this.prisma.studentAccount.findFirst({
      where: { id, tenantId },
      include: {
        student: true,
        academicYear: true,
        breakdowns: { include: { feeStructure: true } },
        transactions: { orderBy: { createdAt: 'desc' }, take: 50 },
        recoveryReminders: { orderBy: { sentAt: 'desc' }, take: 20 },
        // Inclure les overrides de l'élève pour cette année (section Personnalisations)
        // via la relation inverse — FeeOverride.studentId pointe vers Student.id
      },
    });
    if (!account) throw new NotFoundException('StudentAccount not found');

    // Charger les overrides séparément (FeeOverride n'a pas de relation directe avec StudentAccount)
    const overrides = await this.prisma.feeOverride.findMany({
      where: {
        studentId: account.studentId,
        feeStructure: { academicYearId: account.academicYearId, tenantId },
      },
      include: {
        feeStructure: { include: { class: true, level: true } },
        creator: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ─── Multi-année : récupérer les arriérés réels (FeeArrear) pour cet élève ───
    // Toutes années confondues, OPEN ou PARTIALLY_PAID — pour le détail multi-année.
    const openArrears = await this.prisma.feeArrear.findMany({
      where: {
        tenantId,
        studentId: account.studentId,
        status: { in: ['OPEN', 'PARTIALLY_PAID'] },
        balanceDue: { gt: 0 },
      },
      include: { academicYear: { select: { name: true, startDate: true } } },
      orderBy: [{ academicYear: { startDate: 'asc' } }],
    });

    const feeArrears = openArrears.map((a) => ({
      id: a.id,
      academicYearId: a.academicYearId,
      academicYearName: a.academicYear?.name || '—',
      totalDue: Number(a.totalDue ?? 0),
      totalPaid: Number(a.totalPaid ?? 0),
      balanceDue: Number(a.balanceDue ?? 0),
      status: a.status,
      notes: a.notes,
    }));
    const actualArrears = feeArrears.reduce((sum, a) => sum + a.balanceDue, 0);

    // ⚠️ Surcharge : totalDue et balance INCLUENT les arriérés (FIFO)
    const baseTotalDue = Number(account.totalDue ?? 0);
    const baseBalance = Number(account.balance ?? 0);

    return {
      ...account,
      overrides,
      feeArrears,
      actualArrears,
      baseTotalDue,
      baseBalance,
      totalDue: baseTotalDue + actualArrears,
      balance: baseBalance + actualArrears,
    };
  }

  /**
   * Levée de blocage (directeur uniquement côté RBAC). Motif obligatoire, audit recommandé.
   */
  async unblock(accountId: string, tenantId: string, reason: string, userId?: string) {
    const account = await this.prisma.studentAccount.findFirst({
      where: { id: accountId, tenantId },
    });
    if (!account) throw new NotFoundException('StudentAccount not found');
    if (!account.isBlocked) return account;

    // Active le flag SQL pour autoriser la mise à jour de isBlocked
    await this.allowBlockUpdate();
    return this.prisma.studentAccount.update({
      where: { id: accountId },
      data: {
        isBlocked: false,
        status: Number(account.balance) > 0 ? STATUS_PARTIAL : STATUS_PAID,
        updatedAt: new Date(),
      },
      include: { student: true, breakdowns: true },
    });
  }

  /**
   * ⭐ ONGLET « FRAIS GÉNÉRAUX » — listing par élève pour un type de frais
   * transversal (feeType = GENERAL par défaut).
   *
   * Demande utilisateur (sept. 2026) : « créer l'onglet frais généraux afin de
   * pouvoir lister exactement comme on l'a fait pour l'onglet compte élèves…
   * un seul tableau pour récupérer les frais généraux des élèves pour que
   * l'école puisse savoir ce qui doit être récupéré pour cette année scolaire. »
   *
   * Structure identique à Comptes élèves (pagination serveur + KPIs globaux) :
   *   { data: rows[], total, page, limit, totalPages, sums: { due, paid, remaining } }
   *
   * Chaque row = {
   *   accountId, student {…}, className,
   *   generalDue, generalPaid, generalBalance,   ← agrégats sur les breakdowns GENERAL
   *   status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'NONE',
   *   breakdowns: [ { feeStructure {name, totalAmount}, initialAmount, paidAmount, remainingAmount, hasOverride } ]
   * }
   *
   * Les montants utilisent `adjustedAmount` (montant personnalisé après
   * override/régime) → cohérent avec le décompte réel des paiements.
   */
  async findGeneralFeeAccounts(
    tenantId: string,
    filters: {
      academicYearId: string;
      feeType?: string; // défaut 'GENERAL'
      classId?: string;
      schoolLevelId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const feeType = filters.feeType || 'GENERAL';

    // ── Filtres de base (élèves actifs, année, tenant) ──
    const studentFilter: any = { status: { not: 'WITHDRAWN' } };
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      studentFilter.AND = [
        {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { matricule: { contains: q, mode: 'insensitive' } },
            { studentCode: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }
    if (filters.classId) {
      studentFilter.studentEnrollments = {
        some: {
          academicYearId: filters.academicYearId,
          classId: filters.classId,
          ...(filters.schoolLevelId ? { class: { schoolLevelId: filters.schoolLevelId } } : {}),
        },
      };
    } else if (filters.schoolLevelId) {
      studentFilter.studentEnrollments = {
        some: { academicYearId: filters.academicYearId, class: { schoolLevelId: filters.schoolLevelId } },
      };
    }

    const where: any = {
      tenantId,
      academicYearId: filters.academicYearId,
      student: studentFilter,
      // Uniquement les comptes qui ont AU MOINS un breakdown du type demandé
      breakdowns: {
        some: { feeStructure: { feeType } },
      },
    };

    // ── Pagination (pattern Task 9-a / identique à findAll) ──
    const isPaginated = !!(filters.page && filters.limit);
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(500, Math.max(1, filters.limit ?? 50));

    // ── Requête principale : comptes + breakdowns filtrés sur le type ──
    const findManyArgs: any = {
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
            matricule: true,
            schoolLevel: { select: { id: true, name: true, code: true } },
            studentEnrollments: {
              where: { academicYearId: filters.academicYearId },
              select: {
                classId: true,
                class: { select: { id: true, name: true } },
                enrollmentType: true,
              },
            },
          },
        },
        // ⭐ Seuls les breakdowns du type demandé (frais généraux)
        breakdowns: {
          where: { feeStructure: { feeType } },
          include: {
            feeStructure: {
              select: { id: true, name: true, feeType: true, totalAmount: true, customFeeTypeLabel: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
      ...(isPaginated ? { skip: (page - 1) * limit, take: limit } : { take: 500 }),
    };

    const accounts = await this.prisma.studentAccount.findMany(findManyArgs);

    // ── Overrides par élève (hasOverride par breakdown — pattern Task 31) ──
    const studentIds = accounts.map((a) => a.studentId);
    const overridesForStudents = studentIds.length > 0
      ? await this.prisma.feeOverride.findMany({
          where: {
            studentId: { in: studentIds },
            feeStructure: { tenantId, academicYearId: filters.academicYearId, feeType },
          },
          select: { id: true, studentId: true, feeStructureId: true, customAmount: true, reason: true },
        })
      : [];
    const overrideMap = new Map<string, any>();
    for (const o of overridesForStudents) {
      overrideMap.set(`${o.studentId}|${o.feeStructureId}`, o);
    }

    // ── Mise en forme des rows ──
    const rows = accounts.map((account) => {
      const enroll = account.student?.studentEnrollments?.[0];
      const className = enroll?.class?.name || null;

      let generalDue = 0;
      let generalPaid = 0;
      const breakdowns = (account.breakdowns ?? []).map((b: any) => {
        const due = Number(b.adjustedAmount ?? b.initialAmount ?? 0);
        const paid = Number(b.paidAmount ?? 0);
        generalDue += due;
        generalPaid += paid;
        return {
          id: b.id,
          feeStructure: b.feeStructure,
          initialAmount: Number(b.initialAmount ?? 0),
          adjustedAmount: due,
          paidAmount: paid,
          remainingAmount: Number(b.remainingAmount ?? Math.max(0, due - paid)),
          hasOverride: overrideMap.has(`${account.studentId}|${b.feeStructureId}`),
        };
      });
      const generalBalance = Math.max(0, generalDue - generalPaid);

      let rowStatus: string;
      if (generalDue <= 0 && generalPaid <= 0) rowStatus = 'NONE';
      else if (generalBalance <= 0) rowStatus = 'PAID';
      else if (generalPaid > 0) rowStatus = 'PARTIAL';
      else rowStatus = 'UNPAID';

      return {
        accountId: account.id,
        studentId: account.studentId,
        student: account.student,
        className,
        generalDue,
        generalPaid,
        generalBalance,
        status: rowStatus,
        breakdowns,
      };
    });

    // ── Non paginé : retour simple (rétro-compat) ──
    if (!isPaginated) {
      return rows;
    }

    // ── KPIs globaux : agrégats sur TOUS les comptes matchés (pas la page) ──
    const [total, sumsAgg] = await Promise.all([
      this.prisma.studentAccount.count({ where }),
      this.prisma.accountBreakdown.aggregate({
        where: {
          feeStructure: { feeType },
          studentAccount: where,
        },
        _sum: {
          adjustedAmount: true,
          paidAmount: true,
          remainingAmount: true,
        },
      }),
    ]);

    const due = Number(sumsAgg._sum.adjustedAmount ?? 0);
    const paid = Number(sumsAgg._sum.paidAmount ?? 0);
    const remaining = Number(sumsAgg._sum.remainingAmount ?? 0);

    return {
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      sums: {
        due,
        paid,
        remaining,
        studentsWithGeneralFees: total,
      },
    };
  }
}
