/**
 * ============================================================================
 * PAYROLL PRISMA SERVICE - MODULE 5 (SCHEMA-ALIGNED v3)
 * ============================================================================
 *
 * Service de gestion des lots de paie et des lignes de paie,
 * strictement aligné sur le schéma Prisma réel.
 *
 * Modèles clés:
 *  - Payroll        : Batch mensuel (DRAFT → CALCULATED → VALIDATED → PAID)
 *  - PayrollItem    : Ligne de paie individuelle par agent/batch
 *  - SalarySlip     : Bulletin PDF généré depuis une ligne de paie
 *  - CNSSRate       : Taux CNSS par pays (global, pas par tenant)
 *  - TaxRate        : Tranches IRPP par pays (global, pas par tenant)
 *  - TaxWithholding : Retenue fiscale calculée par tranche
 *  - StaffAllowance : Indemnités affectées au personnel
 *
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';
import { PayrollEngineService } from './services/payroll-engine.service';
import { TaxDeclarationService } from './taxes/services/tax-declaration.service';
import { PayrollService as TaxPayslipService } from './taxes/services/payroll.service';
// ⭐ FedaPay supprimé — les payouts Mobile Money ne sont plus disponibles
// tant qu'une nouvelle intégration payout n'est pas configurée.
// Les méthodes de paiement de salaire lèveront une erreur explicite.

/**
 * Détermine si un staff est un vacataire (non soumis à la CNSS/IRPP).
 * Un vacataire a contractType='VACATAIRE' sur son contrat ou sur sa fiche staff.
 */
function isVacataire(staff: any): boolean {
  if (staff?.contractType === 'VACATAIRE') return true;
  const contract = staff?.contracts?.[0];
  if (contract?.contractType === 'VACATAIRE') return true;
  return false;
}

/**
 * Extrait le numéro Mobile Money et l'opérateur depuis bankDetails (JSON) ou les champs staff.
 */
function extractMobileMoneyInfo(staff: any): { number: string; operator: string } | null {
  const bd = staff?.bankDetails;
  if (bd && typeof bd === 'object') {
    const number = bd.mobileMoneyNumber || bd.accountNumber || staff?.phone;
    const operator = bd.mobileMoneyOperator as string;
    if (number && operator) {
      return { number, operator };
    }
  }
  // Fallback: use staff.phone with a default operator
  if (staff?.phone && staff?.phone.length >= 8) {
    return { number: staff.phone, operator: 'MTN' };
  }
  return null;
}

@Injectable()
export class PayrollPrismaService {
  private readonly logger = new Logger(PayrollPrismaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payrollEngine: PayrollEngineService,
    private readonly taxDeclarationService: TaxDeclarationService,
    private readonly taxPayslipService: TaxPayslipService,
  ) {}

  // ============================================================================
  // PAYROLL BATCHES (Payroll model = batch mensuel)
  // ============================================================================

  /**
   * Crée un lot de paie pour un mois donné
   */
  async createPayroll(data: {
    tenantId: string;
    academicYearId: string;
    month: string;
    startDate: Date;
    endDate: Date;
    schoolLevelId?: string;
    payrollPeriodId?: string;
    notes?: string;
  }) {
    // Vérifier qu'il n'y a pas déjà un lot pour ce mois (unique constraint)
    const existing = await this.prisma.payroll.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        month: data.month,
      },
    });

    if (existing) {
      throw new BadRequestException(`Un lot de paie existe déjà pour le mois ${data.month}.`);
    }

    return this.prisma.payroll.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId ?? null,
        payrollPeriodId: data.payrollPeriodId ?? null,
        month: data.month,
        startDate: data.startDate,
        endDate: data.endDate,
        status: 'DRAFT',
        totalAmount: new Prisma.Decimal(0),
        notes: data.notes ?? null,
      },
    });
  }

  /**
   * Liste tous les lots de paie avec le nombre de lignes et le montant total
   */
  async findAllPayrolls(tenantId: string, academicYearId?: string) {
    const where: Prisma.PayrollWhereInput = { tenantId };
    if (academicYearId) where.academicYearId = academicYearId;

    const payrolls = await this.prisma.payroll.findMany({
      where,
      include: {
        _count: { select: { items: true } },
        academicYear: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return payrolls.map((p) => ({
      ...p,
      itemCount: p._count.items,
    }));
  }

  /**
   * Récupère un lot de paie avec ses lignes et les infos staff
   * Utilise employeeNumber (NOT staffCode) et roleType (NOT category)
   */
  async findPayrollById(id: string, tenantId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            staff: {
              select: {
                id: true,
                employeeNumber: true,
                firstName: true,
                lastName: true,
                position: true,
                roleType: true,
                contractType: true,
                statutContractuel: true,
                documentPaieType: true,
                ifuNumber: true,
                employeeCNSS: {
                  select: { cnssNumber: true },
                },
              },
            },
            salarySlip: true,
            // Document de paie officiel (FP/EP) — présence = déjà émis (immuable)
            payrollDocument: {
              select: {
                id: true,
                documentNumber: true,
                documentType: true,
                issuedAt: true,
                contentHash: true,
              },
            },
            payments: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        academicYear: {
          select: { id: true, name: true },
        },
      },
    });

    if (!payroll) throw new NotFoundException(`Lot de paie ${id} introuvable.`);

    // Flatten payments[0] → salaryPayment for easier frontend access
    payroll.items = payroll.items.map((item: any) => ({
      ...item,
      salaryPayment: item.payments?.[0] || null,
    }));

    return payroll;
  }

  /**
   * Met à jour le statut d'un lot de paie
   * DRAFT → CALCULATED → VALIDATED → PAID
   */
  async updatePayrollStatus(
    id: string,
    tenantId: string,
    status: string,
    processedBy?: string,
  ) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id, tenantId },
    });

    if (!payroll) {
      throw new NotFoundException(`Lot de paie ${id} introuvable.`);
    }

    const data: Prisma.PayrollUpdateInput = { status };

    if (status === 'CALCULATED' || status === 'VALIDATED') {
      data.processedBy = processedBy ?? null;
      data.processedAt = new Date();
    }

    if (status === 'PAID') {
      data.paidAt = new Date();
    }

    return this.prisma.payroll.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        ...data,
      },
    });
  }

  // ============================================================================
  // PAIEMENT DES SALAIRES VIA FEDAPAY
  // ============================================================================

  /**
   * Paie le salaire d'un seul employé via FedaPay (payout Mobile Money).
   * - Vérifie que le PayrollItem est CALCULATED ou VALIDATED
   * - Récupère le numéro Mobile Money + opérateur du staff
   * - Appelle fedapayService.createPayout()
   * - Crée un enregistrement SalaryPayment (status=PENDING)
   * - Retourne la référence FedaPay
   */
  async disburseSalary(payrollItemId: string, tenantId: string, academicYearId: string) {
    const item = await this.prisma.payrollItem.findFirst({
      where: { id: payrollItemId, tenantId },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            bankDetails: true,
            contractType: true,
          },
        },
        payroll: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`Ligne de paie ${payrollItemId} introuvable.`);
    }

    if (item.status !== 'CALCULATED' && item.status !== 'VALIDATED') {
      throw new BadRequestException(
        `La ligne de paie doit être CALCULATED ou VALIDATED pour être payée (actuel: ${item.status}).`,
      );
    }

    // Vérifier qu'un paiement n'existe pas déjà
    const existingPayment = await this.prisma.salaryPayment.findFirst({
      where: { payrollItemId, status: { in: ['PENDING', 'COMPLETED'] } },
    });
    if (existingPayment) {
      throw new BadRequestException(
        `Un paiement existe déjà (${existingPayment.status}) pour cette ligne de paie. Référence: ${existingPayment.reference || 'N/A'}`,
      );
    }

    // Extraire les infos Mobile Money
    const momoInfo = extractMobileMoneyInfo(item.staff);
    if (!momoInfo) {
      throw new BadRequestException(
        `Aucun numéro Mobile Money configuré pour ${item.staff.firstName} ${item.staff.lastName}. Veuillez configurer le numéro + opérateur dans la fiche du personnel.`,
      );
    }

    const amount = Number(item.netSalary);
    const motif = `Salaire ${item.payroll.month}/${item.payroll.year} — ${item.staff.firstName} ${item.staff.lastName}`;

    // ⭐ FedaPay ne supporte pas les payouts. Paiement de salaire via Mobile Money
    // temporairement indisponible. Lève une erreur explicite.
    throw new BadRequestException(
      "Paiement de salaire via Mobile Money temporairement indisponible. " +
      "Veuillez configurer une nouvelle intégration payout ou payer manuellement."
    );
  }

  /**
   * Paie les salaires de TOUS les employés d'un lot via FedaPay (paiement groupé).
   * - Boucle sur tous les PayrollItems CALCULATED/VALIDATED
   * - Appelle disburseSalary pour chacun
   * - Retourne le récapitulatif (success/failed par staff)
   * - Met à jour le statut du batch → PAID si tous les paiements sont réussis
   */
  async disburseAllSalaries(payrollId: string, tenantId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, tenantId },
      include: {
        items: {
          where: { status: { in: ['CALCULATED', 'VALIDATED'] } },
          select: { id: true, staffId: true },
        },
      },
    });

    if (!payroll) {
      throw new NotFoundException(`Lot de paie ${payrollId} introuvable.`);
    }

    if (payroll.items.length === 0) {
      throw new BadRequestException(
        `Aucune ligne de paie calculée à payer. Générez et calculez d'abord les lignes.`,
      );
    }

    const results = [];
    let successCount = 0;
    let failedCount = 0;

    for (const item of payroll.items) {
      try {
        const result = await this.disburseSalary(item.id, tenantId, payroll.academicYearId);
        results.push({
          payrollItemId: item.id,
          staffId: item.staffId,
          success: result.success,
          reference: result.reference,
          message: result.message,
        });
        if (result.success) successCount++;
        else failedCount++;
      } catch (err: any) {
        results.push({
          payrollItemId: item.id,
          staffId: item.staffId,
          success: false,
          message: err.message,
        });
        failedCount++;
      }
    }

    // Mettre à jour le statut du batch si tous les paiements sont réussis
    if (successCount > 0 && failedCount === 0) {
      await this.prisma.payroll.update({
        where: { id: payrollId },
        data: {
          ...prismaUpdateDefaults(),
          status: 'PAID',
          paidAt: new Date(),
        },
      });
    }

    this.logger.log(
      `Bulk payout for payroll ${payrollId}: ${successCount} success, ${failedCount} failed out of ${payroll.items.length}`,
    );

    return {
      total: payroll.items.length,
      success: successCount,
      failed: failedCount,
      results,
      payrollStatus: failedCount === 0 && successCount > 0 ? 'PAID' : 'PARTIALLY_PAID',
    };
  }

  /**
   * Récupère le statut d'un paiement de salaire (depuis FedaPay + DB locale).
   */
  async getPaymentStatus(payrollItemId: string, tenantId: string) {
    const payment = await this.prisma.salaryPayment.findFirst({
      where: { payrollItemId, tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (!payment) {
      return { hasPayment: false, status: null, reference: null };
    }

    // Si le paiement est PENDING et qu'on a une référence, vérifier le statut FedaPay
    if (payment.status === 'PENDING' && payment.reference) {
      try {
        const fedapayStatus = "PENDING"; // FedaPay supprimé — statut figé en PENDING
        if (fedapayStatus.status === 'SUCCESSFUL') {
          await this.prisma.salaryPayment.update({
            where: { id: payment.id },
            data: { ...prismaUpdateDefaults(), status: 'COMPLETED' },
          });
          payment.status = 'COMPLETED';
        } else if (fedapayStatus.status === 'FAILED') {
          await this.prisma.salaryPayment.update({
            where: { id: payment.id },
            data: { ...prismaUpdateDefaults(), status: 'FAILED' },
          });
          payment.status = 'FAILED';
        }
      } catch (err) {
        this.logger.warn(`Failed to check FedaPay status for ${payment.reference}: ${err.message}`);
      }
    }

    return {
      hasPayment: true,
      status: payment.status,
      reference: payment.reference,
      paymentDate: payment.paymentDate,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
    };
  }

  /**
   * Valide manuellement le paiement d'un salarié (paiement en espèces / hors FedaPay).
   *
   * Utilisé quand l'école a payé en cash ou par virement et veut marquer la ligne
   * comme payée sans passer par FedaPay.
   *
   * Étapes :
   *   1. Charge le PayrollItem + vérifie statut CALCULATED/VALIDATED
   *   2. Vérifie qu'aucun SalaryPayment COMPLETED n'existe déjà
   *   3. Crée un SalaryPayment avec status=COMPLETED, paymentMethod=CASH
   *   4. Met à jour le PayrollItem → status=PAID
   */
  async manualValidatePayment(
    payrollItemId: string,
    tenantId: string,
    academicYearId: string,
    note?: string,
  ) {
    const item = await this.prisma.payrollItem.findFirst({
      where: { id: payrollItemId, tenantId },
      include: { staff: true, payroll: true },
    });

    if (!item) {
      throw new NotFoundException(`Ligne de paie ${payrollItemId} introuvable.`);
    }

    if (!['CALCULATED', 'VALIDATED', 'PAID'].includes(item.status)) {
      throw new BadRequestException(
        `La ligne doit être calculée ou validée avant paiement. Statut actuel: ${item.status}`,
      );
    }

    // Vérifier qu'aucun paiement COMPLETED n'existe déjà
    const existingPaid = await this.prisma.salaryPayment.findFirst({
      where: { payrollItemId, status: 'COMPLETED' },
    });
    if (existingPaid) {
      throw new BadRequestException(
        `Cette ligne est déjà marquée comme payée (paiement ${existingPaid.id}).`,
      );
    }

    // Créer le SalaryPayment (CASH, COMPLETED)
    const salaryPayment = await this.prisma.salaryPayment.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        academicYearId,
        payrollItemId,
        staffId: item.staffId,
        amount: item.netSalary,
        paymentMethod: 'CASH',
        paymentDate: new Date(),
        status: 'COMPLETED',
        notes: note
          ? `Paiement manuel validé (espèces) — ${note}`
          : `Paiement manuel validé (espèces) — ${new Date().toISOString()}`,
      },
    });

    // Mettre à jour le PayrollItem → PAID
    await this.prisma.payrollItem.update({
      where: { id: payrollItemId },
      data: {
        ...prismaUpdateDefaults(),
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    // ⭐ 125 — clôture AUTOMATIQUE du lot : quand toutes les lignes sont
    //    perçues, le lot passe PAID (plus aucun badge « Brouillon »/« Calculé »
    //    sur la période — l'historique de paie reflète la réalité).
    await this.closeBatchIfFullyPaid(item.payrollId, tenantId);

    this.logger.log(
      `Manual payment validated for ${item.staff?.firstName} ${item.staff?.lastName}: amount=${item.netSalary} FCFA (cash)`,
    );

    return {
      success: true,
      salaryPaymentId: salaryPayment.id,
      message: `Paiement manuel validé pour ${item.staff?.firstName} ${item.staff?.lastName} — ${item.netSalary} FCFA (espèces)`,
    };
  }

  /**
   * ⭐ 125 — Marque TOUTES les lignes d'un lot comme PERÇUES (paiement groupé
   * en espèces/virement — quand l'école a remis les salaires aux employés).
   *   - Crée un SalaryPayment COMPLETED (CASH) par ligne non encore payée ;
   *   - Passe chaque ligne → PAID ;
   *   - Clôture le lot → PAID.
   * Idempotent : les lignes déjà perçues sont comptées « skipped ».
   */
  async manualValidateAllForBatch(
    batchId: string,
    tenantId: string,
    academicYearId: string,
    note?: string,
  ) {
    const batch = await this.prisma.payroll.findFirst({
      where: { id: batchId, tenantId },
      include: {
        items: {
          include: {
            staff: { select: { id: true, firstName: true, lastName: true } },
            payments: { where: { status: 'COMPLETED' }, take: 1 },
          },
        },
      },
    });
    if (!batch) throw new NotFoundException(`Lot de paie ${batchId} introuvable.`);

    // Lignes éligibles : calculées (ou validées/paid sans paiement enregistré)
    const eligible = batch.items.filter(
      (it: any) =>
        ['CALCULATED', 'VALIDATED'].includes(it.status) && !(it.payments ?? []).some((p: any) => p.status === 'COMPLETED'),
    );

    let validated = 0;
    const errors: string[] = [];
    for (const item of eligible) {
      try {
        await this.prisma.salaryPayment.create({
          data: {
            ...prismaCreateDefaults(),
            tenantId,
            academicYearId,
            payrollItemId: item.id,
            staffId: item.staffId,
            amount: item.netSalary,
            paymentMethod: 'CASH',
            paymentDate: new Date(),
            status: 'COMPLETED',
            notes: note
              ? `Salaire perçu — ${note}`
              : `Salaire perçu (validation groupée) — ${new Date().toISOString()}`,
          },
        });
        await this.prisma.payrollItem.update({
          where: { id: item.id },
          data: {
            ...prismaUpdateDefaults(),
            status: 'PAID',
            paidAt: new Date(),
          },
        });
        validated += 1;
      } catch (err: any) {
        errors.push(`${(item.staff as any)?.firstName ?? ''} ${(item.staff as any)?.lastName ?? ''}: ${err?.message}`);
      }
    }

    // Clôture du lot : PAID si aucune ligne non perçue ne reste
    const closeInfo = await this.closeBatchIfFullyPaid(batchId, tenantId);

    return {
      total: batch.items.length,
      validated,
      skipped: batch.items.length - validated - errors.length,
      errors,
      batchStatus: closeInfo?.status ?? null,
      message:
        validated > 0
          ? `${validated} salaire(s) marqué(s) comme perçu(s) sur ${batch.items.length} ligne(s).`
          : 'Aucune ligne à marquer — tous les salaires sont déjà perçus.',
    };
  }

  /** ⭐ 125 — Variante PÉRIODE (la page mensuelle pilote la période). */
  async manualValidateAllForPeriod(
    periodId: string,
    tenantId: string,
    academicYearId?: string,
    note?: string,
  ) {
    const batch = await this.resolvePeriodBatch(periodId, tenantId);
    return this.manualValidateAllForBatch(
      batch.id,
      tenantId,
      academicYearId ?? batch.academicYearId,
      note,
    );
  }

  /**
   * ⭐ 125 — Passer le lot à PAID si (et seulement si) toutes ses lignes sont
   * perçues (statut PAID ou SalaryPayment COMPLETED). Retourne le statut
   * effectif, ou null si la clôture ne s'applique pas.
   */
  private async closeBatchIfFullyPaid(batchId: string, tenantId: string) {
    if (!batchId) return null;
    const items = await this.prisma.payrollItem.findMany({
      where: { payrollId: batchId, tenantId },
      select: { id: true, status: true },
    });
    if (items.length === 0) return null;

    // Lignes pas encore perçues ?
    const unpaid = items.filter(
      (it) =>
        !['PAID', 'CANCELLED'].includes(it.status),
    );
    if (unpaid.length > 0) return { status: 'CALCULATED', unpaid: unpaid.length };

    const updated = await this.prisma.payroll.update({
      where: { id: batchId },
      data: {
        ...prismaUpdateDefaults(),
        status: 'PAID',
        paidAt: new Date(),
      },
    });
    return { status: updated.status, unpaid: 0 };
  }

  // ============================================================================
  // PAYROLL ITEMS (Lignes individuelles)
  // ============================================================================

  /**
   * Génère automatiquement les lignes de paie (PayrollItem) pour tous les
   * agents actifs avec un contrat actif dans le lot.
   * Calcule CNSS depuis CNSSRate et IRPP depuis TaxRate brackets.
   */
  async generatePayrollItems(
    payrollId: string,
    tenantId: string,
    academicYearId?: string,
  ) {
    const payroll = await this.findPayrollById(payrollId, tenantId);

    if (payroll.status !== 'DRAFT') {
      throw new BadRequestException('Le lot doit être en statut DRAFT pour générer les lignes.');
    }

    // Récupérer le code pays du tenant pour les taux CNSS/IRPP
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { country: { select: { code: true } } },
    });
    const countryCode = tenant?.country?.code ?? 'GN';

    // Récupérer les taux CNSS actifs
    const cnssRate = await this.findActiveCNSSRate(countryCode);

    // Récupérer les tranches IRPP actives
    const taxRates = await this.findActiveTaxRates(countryCode);

    // Trouver le personnel actif avec contrat actif ou en attente
    // Inclure les vacataires (contractType='VACATAIRE') qui ne sont pas soumis à la CNSS
    const staffWithContracts = await this.prisma.staff.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        contracts: { some: { status: { in: ['ACTIVE', 'PENDING'] } } },
      },
      include: {
        contracts: {
          where: { status: { in: ['ACTIVE', 'PENDING'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        staffAllowances: {
          where: { status: 'ACTIVE' },
          include: { allowanceType: true },
        },
        employeeCNSS: true,
      },
    });

    const generated = await this.prisma.$transaction(async (tx) => {
      const results = [];

      for (const staff of staffWithContracts) {
        // Skip si une ligne existe déjà pour ce staff dans ce lot
        const existing = await tx.payrollItem.findFirst({
          where: { payrollId, staffId: staff.id, tenantId },
        });
        if (existing) {
          results.push(existing);
          continue;
        }

        const contract = staff.contracts[0];
        // Utiliser staff.salary ou contract.baseSalary comme base
        const baseSalary =
          staff.salary ?? contract?.baseSalary ?? new Prisma.Decimal(0);

        // ─── Détection du statut vacataire ──
        // Les vacataires ne sont PAS soumis à la CNSS ni à l'IRPP
        const vacataire = isVacataire(staff);

        // Somme des indemnités actives + DÉTAIL par type figé dans la ligne
        // ⭐ 17/11/2026 — exigence : le brut doit EXPLOITER les types d'indemnité
        //    (base + Σ indemnités + heures supp + primes = salaire réel).
        //    allowancesTotal/allowancesDetail rendent la composition du brut
        //    TRANSPARENTE (page période, documents FP/EP) — figée au calcul.
        const totalAllowances = staff.staffAllowances.reduce(
          (acc, sa) => acc.plus(sa.amount),
          new Prisma.Decimal(0),
        );
        const allowancesDetail = staff.staffAllowances
          .slice()
          .sort((a: any, b: any) => String(a.allowanceType?.code ?? '').localeCompare(String(b.allowanceType?.code ?? '')))
          .map((sa: any) => ({
            code: sa.allowanceType?.code ?? null,
            label: sa.allowanceType?.name ?? 'Indemnité',
            amount: Number(sa.amount),
          }));

        // Calculer les heures supplémentaires validées dans la période
        const overtimeRecords = await this.prisma.overtimeRecord.findMany({
          where: {
            staffId: staff.id,
            tenantId,
            validated: true,
            date: {
              gte: payroll.startDate,
              lte: payroll.endDate,
            },
          },
        });
        const overtimeHours = overtimeRecords.reduce(
          (acc, r) => acc.plus(r.hours),
          new Prisma.Decimal(0),
        );

        // Calculer le taux horaire depuis PayrollRate si disponible, sinon baseSalary / 173.33
        const payrollRate = await this.findActivePayrollRate(tenantId, countryCode, staff.roleType);
        const hourlyRate = payrollRate
          ? payrollRate.hourlyRate
          : baseSalary.div(new Prisma.Decimal(173.33));
        const overtimeMultiplier = payrollRate
          ? payrollRate.overtimeMultiplier
          : new Prisma.Decimal(1.5);
        const overtimeAmount = hourlyRate.times(overtimeHours).times(overtimeMultiplier);

        // Calculer les primes ponctuelles approuvées non affectées
        const bonuses = await this.calculateStaffBonuses(staff.id, tenantId);

        // Salaire brut = base + indemnités + heures supp + primes
        const grossSalary = baseSalary
          .plus(totalAllowances)
          .plus(overtimeAmount)
          .plus(bonuses);

        // ─── ⭐ RH Bénin — moteur à deux branches selon le statut contractuel ───
        //   PRESTATAIRE_SERVICE → état de paiement : retenue AIB uniquement
        //                          (pas de CNSS, pas d'ITS, mention légale)
        //   SALARIE_NON_DECLARE → fiche de paie sans CNSS (ITS uniquement)
        //   SALARIE_DECLARE     → fiche de paie complète (CNSS salariale + ITS
        //                          progressif + charges patronales provisionnées)
        //   Staff sans statut (héritage) → logique historique inchangée ci-dessous.
        //   Tous les taux proviennent de payroll_fiscal_rates (jamais en dur).
        // ⭐ 16/11/2026 — repli sur le contrat ACTIF : le statut contractuel est
        //    défini à l'onboarding (étape Contrat) et miroiré staff ↔ contrat ;
        //    un staff hérité sans miroir est résolu depuis son contrat actif,
        //    exactement comme payroll-documents.service.loadContext.
        const statutContractuel =
          ((staff as any).statutContractuel as string | null) ||
          (contract?.statutContractuel as string | null) ||
          null;
        const engineResult: any = statutContractuel
          ? await this.payrollEngine.calculateForStatut(Number(grossSalary), statutContractuel, {
              ifuPresent: !!(staff as any).ifuNumber,
            })
          : null;
        let aibAmount = new Prisma.Decimal(0);

        // ─── Calcul CNSS (uniquement pour les permanents, PAS les vacataires) ──
        let cnssEmployee = new Prisma.Decimal(0);
        let cnssEmployer = new Prisma.Decimal(0);
        let taxableAmount = grossSalary; // Pour les vacataires, tout le brut est "imposable" mais non taxé

        if (!vacataire && !engineResult && cnssRate) {
          // Vérifier que le staff a un numéro CNSS actif
          const hasCnss = staff.employeeCNSS?.isActive && staff.employeeCNSS?.cnssNumber;
          if (hasCnss) {
            const ceiling = cnssRate.salaryCeiling
              ? Prisma.Decimal.min(baseSalary, cnssRate.salaryCeiling)
              : baseSalary;
            cnssEmployee = ceiling.times(cnssRate.employeeRate);
            cnssEmployer = ceiling.times(cnssRate.employerRate);
            // Montant imposable = brut - cotisation CNSS employé
            taxableAmount = grossSalary.minus(cnssEmployee);
          }
        }

        // ─── Calcul IRPP (uniquement pour les permanents, PAS les vacataires) ──
        let irppAmount = new Prisma.Decimal(0);
        if (!vacataire && !engineResult && taxRates.length > 0 && taxableAmount.greaterThan(0)) {
          let remaining = taxableAmount;

          for (const bracket of taxRates) {
            if (remaining.lessThanOrEqualTo(0)) break;

            const bracketWidth = bracket.bracketMax
              ? Prisma.Decimal.min(remaining, bracket.bracketMax.minus(bracket.bracketMin))
              : remaining;

            const taxableInBracket = Prisma.Decimal.max(
              new Prisma.Decimal(0),
              Prisma.Decimal.min(remaining, bracketWidth),
            );

            irppAmount = irppAmount.plus(
              taxableInBracket.times(bracket.ratePercentage).div(100),
            );

            if (bracket.bracketMax) {
              remaining = remaining.minus(bracket.bracketMax.minus(bracket.bracketMin));
            } else {
              remaining = new Prisma.Decimal(0);
            }
          }
        }

        // ─── ⭐ RH Bénin — override par le moteur (staff avec statut contractuel) ───
        if (engineResult) {
          if (engineResult.documentPaieType === 'ETAT_DE_PAIEMENT') {
            // État de paiement (prestataire) : AIB en retenue, aucune cotisation
            aibAmount = new Prisma.Decimal(engineResult.aib ?? 0);
            cnssEmployee = new Prisma.Decimal(0);
            cnssEmployer = new Prisma.Decimal(0);
            taxableAmount = new Prisma.Decimal(0);
            irppAmount = new Prisma.Decimal(0);
          } else {
            // Fiche de paie : CNSS si déclaré, ITS barème progressif (payroll_fiscal_rates)
            cnssEmployee = new Prisma.Decimal(engineResult.cnssSalarial ?? 0);
            cnssEmployer = new Prisma.Decimal(engineResult.chargesPatronales?.total ?? 0);
            taxableAmount = new Prisma.Decimal(engineResult.brutImposable ?? Number(grossSalary));
            irppAmount = new Prisma.Decimal(engineResult.its ?? 0);
          }
        }

        const otherDeductions = aibAmount;
        const totalDeductions = cnssEmployee
          .plus(irppAmount)
          .plus(otherDeductions);
        const netSalary = grossSalary.minus(totalDeductions);

        const payrollItem = await tx.payrollItem.create({
          data: {
            ...prismaCreateDefaults(),
            tenantId,
            academicYearId: academicYearId ?? payroll.academicYearId,
            schoolLevelId: payroll.schoolLevelId,
            payrollId,
            staffId: staff.id,
            baseSalary,
            overtimeAmount,
            bonuses,
            allowancesTotal,
            allowancesDetail: allowancesDetail as any,
            grossSalary,
            cnssEmployee,
            cnssEmployer,
            taxableAmount,
            irppAmount,
            otherDeductions,
            totalDeductions,
            netSalary,
            // ⭐ 125 — la génération CALCULE déjà les taxes (moteur statut
            //    contractuel ci-dessus) : la ligne naît CALCULÉE, plus jamais
            //    « En attente » (PENDING). Les documents FP/EP et l'aperçu PDF
            //    sont immédiatement disponibles.
            status: 'CALCULATED',
            calculatedAt: new Date(),
          },
        });

        // ⭐ RH Bénin — trace fiscale de la retenue AIB (prestataires) :
        //    audit via tax_withholdings, même mécanique que l'IRPP.
        if (statutContractuel === 'PRESTATAIRE_SERVICE' && aibAmount.greaterThan(0)) {
          try {
            await tx.taxWithholding.create({
              data: {
                ...prismaCreateDefaults(),
                tenantId,
                academicYearId: academicYearId ?? payroll.academicYearId,
                payrollItemId: payrollItem.id,
                staffId: staff.id,
                taxType: 'AIB',
                taxableAmount: grossSalary,
                ratePercentage: new Prisma.Decimal(engineResult?.tauxAib ?? 0),
                withheldAmount: aibAmount,
                calculationDetails: {
                  statutContractuel,
                  documentPaieType: 'ETAT_DE_PAIEMENT',
                  ifuPresent: !!(staff as any).ifuNumber,
                  mention: engineResult?.mention ?? null,
                  source: 'payroll-engine (payroll_fiscal_rates)',
                },
              },
            });
          } catch (twErr: any) {
            this.logger?.warn?.(`AIB withholding trace échoué (non bloquant) : ${twErr?.message}`);
          }
        }

        results.push(payrollItem);
      }

      // Mettre à jour le totalAmount du batch + statut CALCULATED
      // ⭐ 125 — le lot devient CALCULÉ dès la génération (les taxes sont
      //    calculées) : plus de badge « Brouillon » après avoir généré.
      const totalAmount = results.reduce(
        (sum, item) => sum.plus(item.netSalary),
        new Prisma.Decimal(0),
      );
      await tx.payroll.update({
        where: { id: payrollId },
        data: {
          ...prismaUpdateDefaults(),
          totalAmount,
          ...(payroll.status === 'DRAFT' ? { status: 'CALCULATED', processedAt: new Date() } : {}),
        },
      });

      return results;
    });

    // ⭐ 125 — FLUX AUTOMATIQUE vers l'onglet CNSS : chaque génération de paie
    //    alimente immédiatement les déclarations IST/IRPP-VPS, AIB, CNSS du
    //    trimestre et les fiches fiscales (états de paiement / vacataires).
    //    Non bloquant : une erreur de synchronisation ne fait pas échouer la paie.
    try {
      await this.syncTaxCompanionData(
        tenantId,
        (academicYearId ?? (payroll as any).academicYearId) as string,
        payroll.month,
      );
    } catch (syncErr: any) {
      this.logger.warn(`Synchronisation CNSS après génération échouée (non bloquant) : ${syncErr?.message}`);
    }

    return generated;
  }

  /**
   * Récupère une ligne de paie individuelle
   * Utilise employeeNumber (NOT staffCode) et roleType (NOT category)
   */
  async findPayrollItemById(id: string, tenantId: string) {
    const item = await this.prisma.payrollItem.findFirst({
      where: { id, tenantId },
      include: {
        staff: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            position: true,
            roleType: true,
            employeeCNSS: { select: { cnssNumber: true } },
          },
        },
        payroll: true,
        salarySlip: true,
      },
    });
    if (!item) throw new NotFoundException(`Ligne de paie ${id} introuvable.`);
    return item;
  }

  /**
   * Recalcule une ligne de paie individuelle
   * (gross, déductions CNSS/IRPP, net)
   */
  async calculatePayrollItem(id: string, tenantId: string, client?: any) {
    const db = client ?? this.prisma;
    const item = await db.payrollItem.findFirst({
      where: { id, tenantId },
      include: {
        payroll: true,
        staff: {
          include: {
            contracts: {
              where: { status: { in: ['ACTIVE', 'PENDING'] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            staffAllowances: {
              where: { status: 'ACTIVE' },
              include: { allowanceType: true },
            },
            employeeCNSS: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Ligne de paie ${id} introuvable.`);
    }

    // Récupérer le code pays du tenant pour les taux
    const tenantData = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { country: { select: { code: true } } },
    });
    const countryCode = tenantData?.country?.code ?? 'GN';

    const cnssRate = await this.findActiveCNSSRate(countryCode);
    const taxRates = await this.findActiveTaxRates(countryCode);

    // ─── Détection du statut vacataire ──
    const vacataire = isVacataire(item.staff);

    // Base salary
    const baseSalary = item.baseSalary;

    // Allowances + DÉTAIL par type (même figéage que la génération — 17/11/2026)
    const totalAllowances = item.staff.staffAllowances.reduce(
      (acc, sa) => acc.plus(sa.amount),
      new Prisma.Decimal(0),
    );
    const allowancesDetail = item.staff.staffAllowances
      .slice()
      .sort((a: any, b: any) => String(a.allowanceType?.code ?? '').localeCompare(String(b.allowanceType?.code ?? '')))
      .map((sa: any) => ({
        code: sa.allowanceType?.code ?? null,
        label: sa.allowanceType?.name ?? 'Indemnité',
        amount: Number(sa.amount),
      }));

    // Overtime
    const overtimeRecords = await this.prisma.overtimeRecord.findMany({
      where: {
        staffId: item.staffId,
        tenantId,
        validated: true,
        date: {
          gte: item.payroll.startDate,
          lte: item.payroll.endDate,
        },
      },
    });
    const overtimeHours = overtimeRecords.reduce(
      (acc, r) => acc.plus(r.hours),
      new Prisma.Decimal(0),
    );
    // Calculer le taux horaire depuis PayrollRate si disponible, sinon baseSalary / 173.33
    const payrollRate = await this.findActivePayrollRate(tenantId, countryCode, item.staff.roleType);
    const hourlyRate = payrollRate
      ? payrollRate.hourlyRate
      : baseSalary.div(new Prisma.Decimal(173.33));
    const overtimeMultiplier = payrollRate
      ? payrollRate.overtimeMultiplier
      : new Prisma.Decimal(1.5);
    const overtimeAmount = hourlyRate.times(overtimeHours).times(overtimeMultiplier);

    // Calculer les primes ponctuelles approuvées
    const bonuses = await this.calculateStaffBonuses(item.staffId, tenantId);

    // Gross salary
    const grossSalary = baseSalary
      .plus(totalAllowances)
      .plus(overtimeAmount)
      .plus(bonuses);

    // ─── ⭐ RH Bénin — moteur à deux branches selon le statut contractuel ───
    //   16/11/2026 : le recalcul d'une ligne (bouton « Calculer taxes » ou
    //   « Calculer Tout » de la page période) produit désormais les MÊMES
    //   chiffres que la génération, dérivés du TYPE DE CONTRAT défini à
    //   l'onboarding — plus aucune divergence de barème entre générer et
    //   recalculer :
    //     PRESTATAIRE_SERVICE → état de paiement : AIB uniquement
    //     SALARIE_DECLARE     → fiche de paie : CNSS + ITS progressif
    //     SALARIE_NON_DECLARE → fiche de paie : ITS uniquement
    //   Sans statut (héritage) → logique historique ci-dessous, inchangée.
    const contract = item.staff.contracts?.[0];
    const statutContractuel =
      ((item.staff as any).statutContractuel as string | null) ||
      (contract?.statutContractuel as string | null) ||
      null;
    const engineResult: any = statutContractuel
      ? await this.payrollEngine.calculateForStatut(Number(grossSalary), statutContractuel, {
          ifuPresent: !!(item.staff as any).ifuNumber,
        })
      : null;
    let aibAmount = new Prisma.Decimal(0);

    // ─── CNSS (uniquement pour les permanents avec numéro CNSS actif) ──
    let cnssEmployee = new Prisma.Decimal(0);
    let cnssEmployer = new Prisma.Decimal(0);
    let taxableAmount = grossSalary;

    if (!vacataire && !engineResult && cnssRate) {
      const hasCnss = item.staff.employeeCNSS?.isActive && item.staff.employeeCNSS?.cnssNumber;
      if (hasCnss) {
        const ceiling = cnssRate.salaryCeiling
          ? Prisma.Decimal.min(baseSalary, cnssRate.salaryCeiling)
          : baseSalary;
        cnssEmployee = ceiling.times(cnssRate.employeeRate);
        cnssEmployer = ceiling.times(cnssRate.employerRate);
        taxableAmount = grossSalary.minus(cnssEmployee);
      }
    }

    // ─── IRPP (uniquement pour les permanents, PAS les vacataires) ──
    let irppAmount = new Prisma.Decimal(0);
    if (!vacataire && !engineResult && taxRates.length > 0 && taxableAmount.greaterThan(0)) {
      let remaining = taxableAmount;

      for (const bracket of taxRates) {
        if (remaining.lessThanOrEqualTo(0)) break;

        const bracketWidth = bracket.bracketMax
          ? Prisma.Decimal.min(remaining, bracket.bracketMax.minus(bracket.bracketMin))
          : remaining;

        const taxableInBracket = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          Prisma.Decimal.min(remaining, bracketWidth),
        );

        irppAmount = irppAmount.plus(
          taxableInBracket.times(bracket.ratePercentage).div(100),
        );

        if (bracket.bracketMax) {
          remaining = remaining.minus(bracket.bracketMax.minus(bracket.bracketMin));
        } else {
          remaining = new Prisma.Decimal(0);
        }
      }
    }

    // ─── Override par le moteur statut contractuel (identique à generate) ───
    if (engineResult) {
      if (engineResult.documentPaieType === 'ETAT_DE_PAIEMENT') {
        aibAmount = new Prisma.Decimal(engineResult.aib ?? 0);
        cnssEmployee = new Prisma.Decimal(0);
        cnssEmployer = new Prisma.Decimal(0);
        taxableAmount = new Prisma.Decimal(0);
        irppAmount = new Prisma.Decimal(0);
      } else {
        cnssEmployee = new Prisma.Decimal(engineResult.cnssSalarial ?? 0);
        cnssEmployer = new Prisma.Decimal(engineResult.chargesPatronales?.total ?? 0);
        taxableAmount = new Prisma.Decimal(engineResult.brutImposable ?? Number(grossSalary));
        irppAmount = new Prisma.Decimal(engineResult.its ?? 0);
      }
    }

    // Prestataire → la retenue AIB EST la retenue ; fiche de paie → autres
    // retenues historiques de la ligne conservées (avances/oppositions).
    const otherDeductions =
      engineResult && engineResult.documentPaieType === 'ETAT_DE_PAIEMENT'
        ? aibAmount
        : item.otherDeductions;
    const totalDeductions = cnssEmployee
      .plus(irppAmount)
      .plus(otherDeductions);
    const netSalary = grossSalary.minus(totalDeductions);

    // ⭐ RH Bénin — trace fiscale AIB recalculée (idempotente) : la ligne
    //    prestataire garde sa piste d'audit tax_withholdings à jour même après
    //    un recalcul (delete puis recreate — pas d'unicité en base).
    if (statutContractuel === 'PRESTATAIRE_SERVICE' && aibAmount.greaterThan(0)) {
      try {
        await db.taxWithholding.deleteMany({
          where: { payrollItemId: id, taxType: 'AIB', tenantId },
        });
        await db.taxWithholding.create({
          data: {
            ...prismaCreateDefaults(),
            tenantId,
            academicYearId: item.academicYearId ?? item.payroll?.academicYearId,
            payrollItemId: id,
            staffId: item.staffId,
            taxType: 'AIB',
            taxableAmount: grossSalary,
            ratePercentage: new Prisma.Decimal(engineResult?.tauxAib ?? 0),
            withheldAmount: aibAmount,
            calculationDetails: {
              statutContractuel,
              documentPaieType: 'ETAT_DE_PAIEMENT',
              ifuPresent: !!(item.staff as any).ifuNumber,
              mention: engineResult?.mention ?? null,
              source: 'payroll-engine recalc (payroll_fiscal_rates)',
            },
          },
        });
      } catch (twErr: any) {
        this.logger?.warn?.(`AIB withholding trace (recalc) échoué (non bloquant) : ${twErr?.message}`);
      }
    }

    return db.payrollItem.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        overtimeAmount,
        bonuses,
        allowancesTotal: totalAllowances,
        allowancesDetail: allowancesDetail as any,
        grossSalary,
        cnssEmployee,
        cnssEmployer,
        taxableAmount,
        irppAmount,
        // ⭐ 17/11/2026 — FIX cohérence : otherDeductions n'était PAS écrit au
        //    recalcul → une ligne prestataire voyait son net amputé de l'AIB
        //    sans que la retenue soit stockée/affichée (net ≠ brut − retenues
        //    affichées). Désormais la retenue AIB figée = celle soustraite.
        otherDeductions,
        totalDeductions,
        netSalary,
        status: 'CALCULATED',
        calculatedAt: new Date(),
      },
    });
  }

  /**
   * ⭐ 125 — Synchronisation automatique du volet fiscal (onglet CNSS) après
   * chaque opération de paie : déclarations IST/IRPP-VPS + AIB du mois,
   * CNSS du trimestre, fiches fiscales (états de paiement / vacataires).
   * Idempotent — les déclarations déposées (SUBMITTED/PAID) restent figées.
   */
  private async syncTaxCompanionData(tenantId: string, academicYearId: string, monthKey?: string) {
    if (!academicYearId) return;
    try {
      if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
        // Mois explicite (génération/calcul d'une période) — périmètre ciblé
        await this.taxDeclarationService.getOrGenerateIST(tenantId, academicYearId, monthKey);
        await this.taxDeclarationService.getOrGenerateAIB(tenantId, academicYearId, monthKey);
        const [y, m] = monthKey.split('-').map(Number);
        const quarter = Math.floor((m - 1) / 3) + 1;
        await this.taxDeclarationService.getOrGenerateCNSS(tenantId, academicYearId, `${y}-T${quarter}`);
        for (const staffType of ['PERMANENT', 'VACATAIRE']) {
          await this.taxPayslipService.generatePayslips(tenantId, academicYearId, monthKey, staffType);
        }
      } else {
        // Sans mois → tout l'historique de paie du tenant
        await this.taxDeclarationService.syncAllForTenant(tenantId, academicYearId);
      }
    } catch (err: any) {
      this.logger.warn(`syncTaxCompanionData (${monthKey ?? 'all'}) : ${err?.message}`);
      throw err;
    }
  }

  /**
   * Calcule toutes les lignes d'un lot de paie et met à jour le totalAmount
   * ⭐ 125 — alimente aussi automatiquement les sous-onglets CNSS.
   */
  async calculateAllItems(payrollId: string, tenantId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id: payrollId, tenantId },
      include: { items: true },
    });

    if (!payroll) {
      throw new NotFoundException(`Lot de paie ${payrollId} introuvable.`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Calculer chaque ligne
      const calculatedItems = [];
      for (const item of payroll.items) {
        const calculated = await this.calculatePayrollItem(item.id, tenantId, tx);
        calculatedItems.push(calculated);
      }

      // Mettre à jour le totalAmount du batch
      const totalAmount = calculatedItems.reduce(
        (sum, item) => sum.plus(item.netSalary),
        new Prisma.Decimal(0),
      );

      await tx.payroll.update({
        where: { id: payrollId },
        data: {
          ...prismaUpdateDefaults(),
          totalAmount,
          status: 'CALCULATED',
          processedAt: new Date(),
        },
      });

      return {
        payrollId,
        totalAmount,
        itemCount: calculatedItems.length,
        items: calculatedItems,
      };
    });

    // ⭐ 125 — même flux automatique vers l'onglet CNSS après « Calculer Tout ».
    try {
      await this.syncTaxCompanionData(tenantId, payroll.academicYearId as string, payroll.month);
    } catch (syncErr: any) {
      this.logger.warn(`Synchronisation CNSS après calcul échouée (non bloquant) : ${syncErr?.message}`);
    }

    return result;
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Statistiques agrégées depuis les PayrollItems
   * ⭐ 125 — les lignes CALCULÉES comptent désormais (elles portaient tout le
   *    massif à 0 : la génération produit déjà les montants finaux, et une
   *    validation ligne par ligne n'a jamais lieu — « Masse annuelle » et
   *    « Effectif moyen » restaient vides).
   */
  async getPayrollStatistics(tenantId: string, academicYearId?: string) {
    const where: Prisma.PayrollItemWhereInput = { tenantId };
    if (academicYearId) where.academicYearId = academicYearId;

    const itemWhere = {
      ...where,
      status: { in: ['CALCULATED', 'VALIDATED', 'PAID'] } as Prisma.PayrollItemWhereInput['status'],
    };

    // Use Prisma aggregate instead of loading all records into memory
    const [itemStats, itemCount, distinctStaff] = await Promise.all([
      this.prisma.payrollItem.aggregate({
        where: itemWhere,
        _sum: {
          netSalary: true,
          grossSalary: true,
          totalDeductions: true,
          cnssEmployee: true,
          cnssEmployer: true,
          irppAmount: true,
        },
      }),
      this.prisma.payrollItem.count({ where: itemWhere }),
      this.prisma.payrollItem.findMany({
        where: itemWhere,
        select: { staffId: true },
        distinct: ['staffId'],
      }),
    ]);

    // Stats par batch Payroll
    const payrollWhere: Prisma.PayrollWhereInput = { tenantId };
    if (academicYearId) payrollWhere.academicYearId = academicYearId;
    const payrollItemWhere2 = {
      ...payrollWhere,
      status: { in: ['CALCULATED', 'VALIDATED', 'PAID'] } as Prisma.PayrollWhereInput['status'],
    };

    const [payrollStats, payrollCount] = await Promise.all([
      this.prisma.payroll.aggregate({
        where: payrollItemWhere2,
        _sum: { totalAmount: true },
      }),
      this.prisma.payroll.count({ where: payrollItemWhere2 }),
    ]);

    const totalNet = Number(itemStats._sum.netSalary ?? 0);
    const totalGross = Number(itemStats._sum.grossSalary ?? 0);

    return {
      totalNetSalary: totalNet,
      totalGrossSalary: totalGross,
      totalDeductions: Number(itemStats._sum.totalDeductions ?? 0),
      totalCnssEmployee: Number(itemStats._sum.cnssEmployee ?? 0),
      totalCnssEmployer: Number(itemStats._sum.cnssEmployer ?? 0),
      totalIrpp: Number(itemStats._sum.irppAmount ?? 0),
      totalPayrollAmount: Number(payrollStats._sum.totalAmount ?? 0),
      // ⭐ 125 — alias consommés par le front (KPI « Masse annuelle »)
      totalAmount: totalGross,
      totalStaff: distinctStaff.length,
      totalPayrollItems: itemCount,
      totalPayrollBatches: payrollCount,
    };
  }

  // ============================================================================
  // PAYROLL PERIODS
  // ============================================================================

  /**
   * Crée une période de paie
   */
  async createPayrollPeriod(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId?: string;
    name: string;
    periodType?: string;
    month?: string;
    startDate: Date;
    endDate: Date;
  }) {
    return this.prisma.payrollPeriod.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId ?? null,
        name: data.name,
        periodType: data.periodType ?? 'MONTHLY',
        month: data.month ?? null,
        startDate: data.startDate,
        endDate: data.endDate,
        status: 'OPEN',
      },
    });
  }

  /**
   * Liste toutes les périodes de paie d'un tenant
   * ⭐ 125 — AGRÉGATION réelle par période : total net (l'« à payer » était
   *    toujours 0 — PayrollPeriod n'a pas de colonne totalAmount), nombre de
   *    bulletins (lignes de paie, pas le nombre de lots) et statut EFFECTIF
   *    dérivé du lot sous-jacent (DRAFT→CALCULATED→PAID) — l'historique
   *    reflète l'avancement réel de chaque mois.
   */
  async findAllPayrollPeriods(tenantId: string, academicYearId?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (academicYearId) where.academicYearId = academicYearId;

    const periods = await this.prisma.payrollPeriod.findMany({
      where,
      include: {
        _count: { select: { payrolls: true } },
        payrolls: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            month: true,
            totalAmount: true,
            paidAt: true,
            _count: { select: { items: true } },
          },
        },
        academicYear: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    return periods.map((period: any) => {
      const batch = period.payrolls?.[0] ?? null;
      const displayStatus =
        period.status === 'CLOSED' || period.status === 'LOCKED'
          ? period.status
          : batch?.status ?? period.status;
      return {
        ...period,
        payrolls: undefined,
        // Statut effectif (suivre le lot) — consommé par la liste « Historique des Paies »
        status: displayStatus,
        // Total net réel de la période (somme des lots)
        totalAmount: batch?.totalAmount ?? new Prisma.Decimal(0),
        // Bulletins = LIGNES de paie (pas le nombre de lots)
        itemCount: batch?._count?.items ?? 0,
        batchId: batch?.id ?? null,
        batchStatus: batch?.status ?? null,
        paidAt: batch?.paidAt ?? null,
      };
    });
  }

  /**
   * Récupère une période de paie par ID — avec les LIGNES DE PAIE flattées
   * (page front : period.payrolls = lignes items avec staff/salaryPayment/payrollDocument).
   * Le statut affiché suit le LOT sous-jacent (DRAFT→CALCULATED→PAID) dès qu'il existe.
   */
  async findPayrollPeriodById(id: string, tenantId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, tenantId },
      include: {
        payrolls: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            items: {
              include: {
                staff: {
                  select: {
                    id: true,
                    employeeNumber: true,
                    firstName: true,
                    lastName: true,
                    position: true,
                    roleType: true,
                    contractType: true,
                    statutContractuel: true,
                    documentPaieType: true,
                    ifuNumber: true,
                    employeeCNSS: {
                      select: { cnssNumber: true },
                    },
                  },
                },
                salarySlip: true,
                payrollDocument: {
                  select: {
                    id: true,
                    documentNumber: true,
                    documentType: true,
                    issuedAt: true,
                    contentHash: true,
                  },
                },
                payments: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        academicYear: { select: { id: true, name: true } },
      },
    });
    if (!period) throw new NotFoundException(`Période de paie ${id} introuvable.`);

    const batch: any = (period as any).payrolls?.[0] ?? null;
    const items: any[] = batch?.items ?? [];

    // période CLOSE/LOCKED = verrou administratif ; sinon le statut suit le lot
    const displayStatus =
      period.status === 'CLOSED' || period.status === 'LOCKED'
        ? period.status
        : batch?.status ?? period.status;

    return {
      ...period,
      payrolls: items.map((item: any) => ({
        ...item,
        salaryPayment: item.payments?.[0] || null,
      })),
      batchId: batch?.id ?? null,
      batchStatus: batch?.status ?? null,
      status: displayStatus,
    };
  }

  /**
   * Résout le LOT de paie d'une période (find-or-create) : la page mensuelle
   * travaille au niveau PÉRIODE ; le lot est un détail d'implémentation.
   */
  private async resolvePeriodBatch(periodId: string, tenantId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id: periodId, tenantId },
    });
    if (!period) throw new NotFoundException(`Période de paie ${periodId} introuvable.`);
    if (period.status === 'CLOSED' || period.status === 'LOCKED') {
      throw new BadRequestException(`La période est ${period.status} — aucune opération de paie possible.`);
    }

    const existing = await this.prisma.payroll.findFirst({
      where: {
        tenantId,
        academicYearId: period.academicYearId,
        payrollPeriodId: period.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;

    // find-or-create par mois (contrainte unique tenant+année académique+mois)
    const month = period.month
      ?? `${period.startDate.getFullYear()}-${String(period.startDate.getMonth() + 1).padStart(2, '0')}`;
    const byMonth = await this.prisma.payroll.findFirst({
      where: { tenantId, academicYearId: period.academicYearId, month },
    });
    if (byMonth) return byMonth;

    return this.prisma.payroll.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        academicYearId: period.academicYearId,
        schoolLevelId: period.schoolLevelId ?? null,
        payrollPeriodId: period.id,
        month,
        startDate: period.startDate,
        endDate: period.endDate,
        status: 'DRAFT',
        totalAmount: new Prisma.Decimal(0),
        notes: `Lot auto-résolu depuis la période ${period.name}`,
      },
    });
  }

  /** Génération des lignes de paie d'une PÉRIODE (résout/crée le lot, puis délègue). */
  async generatePayrollItemsForPeriod(periodId: string, tenantId: string, academicYearId?: string) {
    const batch = await this.resolvePeriodBatch(periodId, tenantId);
    return this.generatePayrollItems(batch.id, tenantId, academicYearId ?? batch.academicYearId);
  }

  /** Calcul global d'une PÉRIODE. */
  async calculateAllItemsForPeriod(periodId: string, tenantId: string) {
    const batch = await this.resolvePeriodBatch(periodId, tenantId);
    return this.calculateAllItems(batch.id, tenantId);
  }

  /** Changement de statut du lot d'une PÉRIODE (DRAFT→CALCULATED→VALIDATED→PAID). */
  async updatePeriodPayrollStatus(periodId: string, tenantId: string, status: string, processedBy?: string) {
    const batch = await this.resolvePeriodBatch(periodId, tenantId);
    return this.updatePayrollStatus(batch.id, tenantId, status, processedBy);
  }

  /**
   * Ferme une période de paie (empêche toute modification)
   */
  async closePayrollPeriod(id: string, tenantId: string, closedBy: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, tenantId },
    });
    if (!period) throw new NotFoundException(`Période de paie ${id} introuvable.`);
    if (period.status === 'CLOSED' || period.status === 'LOCKED') {
      throw new BadRequestException(`La période est déjà ${period.status}.`);
    }

    return this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        status: 'CLOSED',
        closedBy,
        closedAt: new Date(),
      },
    });
  }

  // ============================================================================
  // PAYROLL RATES (Taux salariaux par rôle/grade)
  // ============================================================================

  /**
   * Crée ou met à jour un taux salarial
   */
  async upsertPayrollRate(data: {
    tenantId: string;
    countryCode: string;
    roleType: string;
    grade?: string;
    monthlyBaseSalary: number;
    hourlyRate: number;
    overtimeMultiplier?: number;
    effectiveFrom: Date;
    effectiveTo?: Date;
  }) {
    const existing = await this.prisma.payrollRate.findFirst({
      where: {
        tenantId: data.tenantId,
        countryCode: data.countryCode,
        roleType: data.roleType,
        grade: data.grade ?? null,
        effectiveFrom: data.effectiveFrom,
      },
    });

    if (existing) {
      return this.prisma.payrollRate.update({
        where: { id: existing.id },
        data: {
          ...prismaUpdateDefaults(),
          monthlyBaseSalary: data.monthlyBaseSalary,
          hourlyRate: data.hourlyRate,
          overtimeMultiplier: data.overtimeMultiplier ?? 1.5,
          effectiveTo: data.effectiveTo ?? null,
        },
      });
    }

    return this.prisma.payrollRate.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        countryCode: data.countryCode,
        roleType: data.roleType,
        grade: data.grade ?? null,
        monthlyBaseSalary: data.monthlyBaseSalary,
        hourlyRate: data.hourlyRate,
        overtimeMultiplier: data.overtimeMultiplier ?? 1.5,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo ?? null,
      },
    });
  }

  /**
   * Liste tous les taux salariaux d'un tenant
   */
  async findAllPayrollRates(tenantId: string, countryCode?: string) {
    const where: Record<string, unknown> = { tenantId, isActive: true };
    if (countryCode) where.countryCode = countryCode;

    return this.prisma.payrollRate.findMany({
      where,
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * Récupère le taux salarial actif pour un rôle/pays
   */
  async findActivePayrollRate(tenantId: string, countryCode: string, roleType: string) {
    const date = new Date();
    return this.prisma.payrollRate.findFirst({
      where: {
        tenantId,
        countryCode,
        roleType,
        isActive: true,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  // ============================================================================
  // ONE-TIME BONUSES
  // ============================================================================

  /**
   * Crée une prime ponctuelle
   */
  async createOneTimeBonus(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId?: string;
    staffId: string;
    amount: number;
    reason: string;
    bonusType?: string;
    authorizedBy: string;
  }) {
    return this.prisma.oneTimeBonus.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId ?? null,
        staffId: data.staffId,
        amount: new Prisma.Decimal(data.amount),
        reason: data.reason,
        bonusType: data.bonusType ?? 'OTHER',
        authorizedBy: data.authorizedBy,
        status: 'PENDING',
      },
      include: {
        staff: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Liste toutes les primes ponctuelles d'un tenant
   */
  async findAllOneTimeBonuses(
    tenantId: string,
    filters?: { staffId?: string; status?: string; bonusType?: string },
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (filters?.staffId) where.staffId = filters.staffId;
    if (filters?.status) where.status = filters.status;
    if (filters?.bonusType) where.bonusType = filters.bonusType;

    return this.prisma.oneTimeBonus.findMany({
      where,
      include: {
        staff: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
        authorizer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Approuve une prime ponctuelle
   */
  async approveOneTimeBonus(id: string, tenantId: string, approvedBy: string) {
    const bonus = await this.prisma.oneTimeBonus.findFirst({
      where: { id, tenantId },
    });
    if (!bonus) throw new NotFoundException(`Prime ${id} introuvable.`);
    if (bonus.status !== 'PENDING') {
      throw new BadRequestException(`La prime est déjà ${bonus.status}.`);
    }

    return this.prisma.oneTimeBonus.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  /**
   * Supprime un lot de paie (seulement si DRAFT)
   */
  async deletePayrollBatch(id: string, tenantId: string) {
    const payroll = await this.prisma.payroll.findFirst({
      where: { id, tenantId },
    });
    if (!payroll) {
      throw new NotFoundException(`Payroll batch ${id} not found`);
    }
    if (payroll.status !== 'DRAFT') {
      throw new BadRequestException('Seuls les lots en brouillon peuvent être supprimés.');
    }
    // Delete associated items first
    await this.prisma.payrollItem.deleteMany({ where: { payrollId: id } });
    return this.prisma.payroll.delete({ where: { id } });
  }

  /**
   * Supprime une période de paie (seulement si OPEN)
   */
  async deletePayrollPeriod(id: string, tenantId: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, tenantId },
    });
    if (!period) {
      throw new NotFoundException(`Payroll period ${id} not found`);
    }
    if (period.status !== 'OPEN') {
      throw new BadRequestException('Seules les périodes ouvertes peuvent être supprimées.');
    }
    return this.prisma.payrollPeriod.delete({ where: { id } });
  }

  /**
   * Supprime une prime ponctuelle
   */
  async deleteOneTimeBonus(id: string, tenantId: string) {
    const bonus = await this.prisma.oneTimeBonus.findFirst({
      where: { id, tenantId },
    });
    if (!bonus) {
      throw new NotFoundException(`Bonus ${id} not found`);
    }
    return this.prisma.oneTimeBonus.delete({ where: { id } });
  }

  /**
   * Calcule le total des primes approuvées pour un staff dans une période
   */
  async calculateStaffBonuses(staffId: string, tenantId: string, payrollItemId?: string) {
    const where: Record<string, unknown> = {
      staffId,
      tenantId,
      status: 'APPROVED',
    };
    if (payrollItemId) where.payrollItemId = null; // Non encore affectées

    const bonuses = await this.prisma.oneTimeBonus.findMany({ where });
    return bonuses.reduce((sum, b) => sum.plus(b.amount), new Prisma.Decimal(0));
  }

  // ============================================================================
  // CNSS RATES (CNSSRate model — global par pays, pas par tenant)
  // ============================================================================

  /**
   * Récupère le taux CNSS actif pour un pays à une date donnée
   */
  async findActiveCNSSRate(countryCode: string, effectiveDate?: Date) {
    const date = effectiveDate ?? new Date();
    return this.prisma.cNSSRate.findFirst({
      where: {
        countryCode,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * Crée ou met à jour un taux CNSS
   */
  async upsertCNSSRate(data: {
    countryCode: string;
    employeeRate: number;
    employerRate: number;
    salaryCeiling?: number;
    effectiveFrom: Date;
    effectiveTo?: Date;
  }) {
    const existing = await this.prisma.cNSSRate.findFirst({
      where: {
        countryCode: data.countryCode,
        effectiveFrom: data.effectiveFrom,
      },
    });

    if (existing) {
      return this.prisma.cNSSRate.update({
        where: { id: existing.id },
        data: {
          ...prismaUpdateDefaults(),
          employeeRate: data.employeeRate,
          employerRate: data.employerRate,
          salaryCeiling: data.salaryCeiling ?? null,
          effectiveTo: data.effectiveTo ?? null,
        },
      });
    }

    return this.prisma.cNSSRate.create({
      data: {
        ...prismaCreateDefaults(),
        countryCode: data.countryCode,
        employeeRate: data.employeeRate,
        employerRate: data.employerRate,
        salaryCeiling: data.salaryCeiling ?? null,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo ?? null,
      },
    });
  }

  // ============================================================================
  // TAX RATES (TaxRate model — global par pays, pas par tenant)
  // ============================================================================

  /**
   * Récupère les tranches IRPP actives pour un pays
   * triées par bracketMin croissant
   */
  async findActiveTaxRates(countryCode: string, taxType?: string) {
    const date = new Date();
    return this.prisma.taxRate.findMany({
      where: {
        countryCode,
        taxType: taxType ?? 'IRPP',
        isActive: true,
        effectiveFrom: { lte: date },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
      },
      orderBy: { bracketMin: 'asc' },
    });
  }

  // ============================================================================
  // SALARY SLIPS
  // ============================================================================

  /**
   * Récupère le bulletin de salaire d'une ligne de paie
   */
  async findSalarySlipByPayrollItemId(payrollItemId: string) {
    return this.prisma.salarySlip.findUnique({
      where: { payrollItemId },
    });
  }

  /**
   * Crée ou récupère le bulletin de salaire pour une ligne de paie
   */
  async ensureSalarySlip(
    payrollItemId: string,
    tenantId: string,
    issuedBy?: string,
  ) {
    const existing = await this.prisma.salarySlip.findUnique({
      where: { payrollItemId },
    });

    if (existing) return existing;

    const item = await this.findPayrollItemById(payrollItemId, tenantId);
    const receiptNumber = `SLP-${Date.now()}-${payrollItemId.substring(0, 8)}`;

    return this.prisma.salarySlip.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        payrollItemId,
        receiptNumber,
        period: item.payroll?.month ?? '',
        pdfGenerated: false,
        issuedBy: issuedBy ?? null,
      },
    });
  }
}
