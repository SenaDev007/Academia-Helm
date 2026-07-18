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
    const levelId = student.schoolLevelId;
    const enrollmentType = enrollment?.enrollmentType ?? 'NEW';
    const previousArrears = Number(enrollment?.previousArrears ?? 0);

    const allStructures = await this.prisma.feeStructure.findMany({
      where: { tenantId, academicYearId, isActive: true },
      include: { structureInstallments: true, overrides: { where: { studentId } } },
    });
    // RÈGLE MÉTIER : Priorité d'application (Classe > Niveau > Global)
    // Pour chaque type de frais (feeType), on ne garde que la structure la plus spécifique.
    const structuresByType = new Map<string, any>();

    allStructures.forEach((fs) => {
      const isClassMatch = fs.classId && fs.classId === classId;
      const isLevelMatch = fs.levelId === levelId && !fs.classId;
      const isGlobalMatch = !fs.levelId && !fs.classId;

      if (isClassMatch || isLevelMatch || isGlobalMatch) {
        const existing = structuresByType.get(fs.feeType);
        if (!existing) {
          structuresByType.set(fs.feeType, fs);
        } else {
          // Remplacement si plus spécifique
          const existingIsClass = existing.classId;
          const existingIsLevel = existing.levelId && !existing.classId;
          
          if (isClassMatch) {
            structuresByType.set(fs.feeType, fs); // La classe gagne toujours
          } else if (isLevelMatch && !existingIsClass) {
            structuresByType.set(fs.feeType, fs); // Le niveau gagne contre le global
          }
        }
      }
    });

    // ⚠️ RÈGLE MÉTIER : Nouvel élève vs ancien élève
    //   - enrollmentType === 'NEW' → frais d'INSCRIPTION (pas de REINSCRIPTION)
    //   - enrollmentType ∈ ['REPEAT', 'PROMOTION', 'TRANSFER'] → frais de REINSCRIPTION (pas d'INSCRIPTION)
    //   Un élève ne doit JAMAIS payer à la fois INSCRIPTION et REINSCRIPTION.
    //   (Logique extraite dans filterFeesByEnrollmentType() pour éviter la duplication)
    const feeStructuresRaw = Array.from(structuresByType.values());
    const feeStructures = this.filterFeesByEnrollmentType(feeStructuresRaw, enrollmentType);

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
    const levelId = student.schoolLevelId;
    const enrollmentType = enrollment?.enrollmentType ?? 'NEW';

    const allStructures = await this.prisma.feeStructure.findMany({
      where: { tenantId, academicYearId, isActive: true },
      include: { structureInstallments: true, overrides: { where: { studentId } } },
    });

    // Priorité Classe > Niveau > Global
    const structuresByType = new Map<string, any>();
    allStructures.forEach((fs) => {
      const isClassMatch = fs.classId && fs.classId === classId;
      const isLevelMatch = fs.levelId === levelId && !fs.classId;
      const isGlobalMatch = !fs.levelId && !fs.classId;

      if (isClassMatch || isLevelMatch || isGlobalMatch) {
        const existing = structuresByType.get(fs.feeType);
        if (!existing) {
          structuresByType.set(fs.feeType, fs);
        } else {
          const existingIsClass = existing.classId;
          const existingIsLevel = existing.levelId && !existing.classId;
          if (isClassMatch) {
            structuresByType.set(fs.feeType, fs);
          } else if (isLevelMatch && !existingIsClass) {
            structuresByType.set(fs.feeType, fs);
          }
        }
      }
    });

    // ⚠️ RÈGLE MÉTIER : Nouvel élève vs ancien élève (même logique que getOrCreate)
    //   (Logique extraite dans filterFeesByEnrollmentType() pour éviter la duplication)
    const feeStructuresRaw = Array.from(structuresByType.values());
    const feeStructures = this.filterFeesByEnrollmentType(feeStructuresRaw, enrollmentType);

    // ⚠️ RÈGLE MÉTIER : Régimes tarifaires (FeeRegime)
    const regimeAdjustments = await this.loadFeeRegimeAdjustments(tenantId, studentId, academicYearId);

    // Helper : calculer le montant ajusté pour une FeeStructure
    const computeAmount = (fs: any): number => {
      const override = fs.overrides[0];
      if (override) return Number(override.customAmount);
      if (regimeAdjustments.has(fs.id)) return regimeAdjustments.get(fs.id)!;
      return Number(fs.totalAmount);
    };

    const totalDue = feeStructures.reduce((sum, fs) => sum + computeAmount(fs), 0);

    // Supprimer les anciens breakdowns (non payés)
    await this.prisma.accountBreakdown.deleteMany({
      where: { studentAccountId: account.id, paidAmount: 0 },
    });

    // Récupérer les breakdowns restants (ceux avec paiements)
    const existingBreakdowns = await this.prisma.accountBreakdown.findMany({
      where: { studentAccountId: account.id },
    });
    const existingFeeStructureIds = new Set(existingBreakdowns.map((b) => b.feeStructureId));

    // Créer les nouveaux breakdowns (seulement pour les frais pas déjà présents)
    const newBreakdowns = feeStructures.filter((fs) => !existingFeeStructureIds.has(fs.id));

    // Mettre à jour les breakdowns existants avec les overrides/régimes
    for (const b of existingBreakdowns) {
      const fs = feeStructures.find((f) => f.id === b.feeStructureId);
      if (fs) {
        const newAmount = computeAmount(fs);
        if (Number(b.initialAmount) !== newAmount) {
          await this.prisma.accountBreakdown.update({
            where: { id: b.id },
            data: {
              initialAmount: newAmount,
              adjustedAmount: newAmount,
              remainingAmount: newAmount - Number(b.paidAmount),
            },
          });
        }
      }
    }

    // Créer les nouveaux breakdowns
    if (newBreakdowns.length > 0) {
      await this.prisma.accountBreakdown.createMany({
        data: newBreakdowns.map((fs) => {
          const initialAmount = computeAmount(fs);
          return {
            studentAccountId: account.id,
            feeStructureId: fs.id,
            initialAmount,
            adjustedAmount: initialAmount,
            paidAmount: 0,
            remainingAmount: initialAmount,
          };
        }),
      });
    }

    // ⭐ FIX (suppression d'override) : Traiter les breakdowns « orphelins » — ceux dont
    // la feeStructure n'est plus dans la liste filtrée `feeStructures` (par ex. l'élève a
    // changé de classe, la feeStructure a été désactivée, ou l'enrollmentType a changé).
    //
    // Sans ce bloc, ces breakdowns conservent leur ancien `initialAmount` = montant de
    // l'override supprimé (ex: 35000), et le badge « Pers. » reste affiché côté frontend
    // (StudentAccountsContent compare `b.initialAmount` à `b.feeStructure.totalAmount`).
    //
    // Pour chaque breakdown orphelin :
    //   - Si un override actif existe encore pour (student, feeStructure) → l'appliquer
    //   - Sinon → reset à `feeStructure.totalAmount` (montant original)
    //   - Recalculer `remainingAmount = adjustedAmount - paidAmount`
    const filteredFeeStructureIds = new Set(feeStructures.map((fs) => fs.id));
    const orphanedBreakdowns = await this.prisma.accountBreakdown.findMany({
      where: {
        studentAccountId: account.id,
        feeStructureId: { notIn: Array.from(filteredFeeStructureIds) },
      },
      include: {
        feeStructure: {
          select: {
            id: true,
            totalAmount: true,
            isActive: true,
            overrides: { where: { studentId } },
          },
        },
      },
    });

    for (const b of orphanedBreakdowns) {
      const override = b.feeStructure?.overrides?.[0];
      const newAmount = override
        ? Number(override.customAmount)
        : Number(b.feeStructure?.totalAmount ?? 0);
      // Toujours resynchroniser adjustedAmount avec initialAmount (au cas où ils auraient
      // divergé), et recalculer remainingAmount.
      if (
        Number(b.initialAmount) !== newAmount ||
        Number(b.adjustedAmount) !== newAmount
      ) {
        await this.prisma.accountBreakdown.update({
          where: { id: b.id },
          data: {
            initialAmount: newAmount,
            adjustedAmount: newAmount,
            remainingAmount: newAmount - Number(b.paidAmount),
          },
        });
      }
    }

    // Recalculer totalDue et balance
    const allBreakdowns = await this.prisma.accountBreakdown.findMany({
      where: { studentAccountId: account.id },
    });
    const newTotalDue = allBreakdowns.reduce((sum, b) => sum + Number(b.initialAmount), 0);
    const totalPaid = allBreakdowns.reduce((sum, b) => sum + Number(b.paidAmount), 0);

    // ⭐ Juillet 2026 : SET LOCAL app.allow_balance_update doit être dans la MÊME
    // transaction que l'UPDATE du studentAccount, sinon le trigger prevent_balance_update
    // déclenche l'erreur "Direct modification of balance fields is forbidden".
    // Avant : allowBalanceUpdate() + prisma.studentAccount.update() étaient dans 2
    // transactions séparées → le flag était perdu.
    // Maintenant : tout est dans une seule $transaction (pattern identique à
    // fee-structure.service.ts lignes 641-652 qui fonctionne correctement).
    account = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.allow_balance_update = 'true'`);
      return tx.studentAccount.update({
        where: { id: account.id },
        data: {
          totalDue: newTotalDue,
          totalPaid,
          balance: newTotalDue - totalPaid,
          updatedAt: new Date(),
        },
        include: { breakdowns: { include: { feeStructure: true } } },
      });
    });

    return account;
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
              select: { id: true, classId: true, class: { select: { id: true, name: true } } },
            },
          },
        },
        breakdowns: {
          include: {
            feeStructure: {
              select: { id: true, name: true, feeType: true, totalAmount: true, customFeeTypeLabel: true,
                // ⭐ Task 29 : inclure les overrides pour déterminer hasOverride
                overrides: { select: { id: true }, take: 1 },
              },
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

    // ─── Multi-année : récupérer les arriérés réels (FeeArrear) pour chaque élève ───
    // Les champs StudentAccount.arrearsAmount et carriedArrears ne sont pas toujours
    // synchronisés avec les FeeArrear (ex: arriérés créés manuellement via le module
    // Recouvrement). On agrège donc les FeeArrear ouverts (OPEN ou PARTIALLY_PAID)
    // pour afficher le vrai total d'arriérés dans la colonne "Arriérés".
    const studentIds = baseAccounts.map((a) => a.studentId);
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
      // ⭐ Task 29 : déterminer hasOverride depuis les breakdowns
      // (breakdown.feeStructure.overrides est chargé via Prisma include)
      const hasOverride = (account.breakdowns ?? []).some(
        (b: any) => b?.feeStructure?.overrides?.length > 0
      );
      return {
        ...account,
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
}
