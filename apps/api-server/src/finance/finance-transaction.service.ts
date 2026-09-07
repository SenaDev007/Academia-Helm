/**
 * SOUS-MODULE 3 — Encaissements (FinanceTransaction)
 * Reçu AH-YYYY-NNNNNN, imputation prioritaire, hash d'intégrité (spec extension).
 *
 * EXTENSION MULTI-CAISSES :
 * - Accepte cashRegisterId optionnel pour lier la transaction à une caisse
 * - Met à jour le currentBalance de la caisse après chaque transaction
 * - Valide que la caisse est ouverte avant d'accepter un paiement
 */
import * as crypto from 'crypto';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionType, PaymentMethod } from '@prisma/client';
import { ReceiptFinanceService } from './receipt-finance.service';
import { ReceiptNotificationFinanceService } from './receipt-notification-finance.service';
import { ArrearAccumulationService } from './arrear-accumulation.service';
import { AccessScope } from '../common/context/access-scope.service';

// ⭐ Ordre de priorité d'imputation des paiements. GENERAL (frais généraux)
//    est imputé APRÈS les frais pédagogiques classiques — cohérent avec le
//    NewPaymentModal (front) et ParentFinancePanel.
const PRIORITY_ORDER = ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'GENERAL', 'OTHER'];
const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'MOBILE_MONEY', 'WIRE', 'FEDAPAY'];

// ⭐ Libellés des types de frais pour les messages d'erreur de l'encaissement
//    dédié (targetFeeType) — compréhensibles par l'utilisateur final.
const FEE_TYPE_LABELS: Record<string, string> = {
  INSCRIPTION: 'Inscription',
  REINSCRIPTION: 'Réinscription',
  TUITION: 'Scolarité',
  CANTEEN: 'Cantine',
  EXAMEN: "Frais d'examen",
  GENERAL: 'Frais généraux',
  OTHER: 'Autre',
};

@Injectable()
export class FinanceTransactionService {
  private readonly logger = new Logger(FinanceTransactionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptFinanceService: ReceiptFinanceService,
    private readonly receiptNotificationService: ReceiptNotificationFinanceService,
    @Inject(forwardRef(() => ArrearAccumulationService))
    private readonly arrearAccumulationService: ArrearAccumulationService,
  ) {}

  /** Expose prisma pour le controller (downloadReceipt, resendReceipt) */
  get prismaClient() {
    return this.prisma;
  }

  /**
   * Récupère ou crée une caisse virtuelle pour les paiements en ligne
   * (Fedapay / FedaPay). Cette caisse est automatiquement créée pour chaque
   * tenant afin d'assurer la traçabilité des paiements en ligne dans
   * l'onglet multi-caisses.
   */
  private async getOrCreateOnlinePaymentCashRegister(tenantId: string): Promise<string> {
    // Chercher une caisse existante avec le code 'ONLINE' pour ce tenant
    const existing = await this.prisma.cashRegister.findFirst({
      where: { tenantId, code: 'ONLINE' },
    });
    if (existing) return existing.id;

    // Créer la caisse virtuelle
    const register = await this.prisma.cashRegister.create({
      data: {
        tenantId,
        code: 'ONLINE',
        name: 'Caisse Paiements en Ligne',
        description: 'Caisse virtuelle pour les paiements Fedapay et FedaPay (Mobile Money, carte bancaire)',
        location: 'En ligne',
        openingBalance: 0,
        currentBalance: 0,
        isOpen: true, // Toujours ouverte (paiements 24/7)
        isActive: true,
        openedAt: new Date(),
      },
    });
    this.logger.log(`Caisse virtuelle 'ONLINE' créée pour tenant ${tenantId}: ${register.id}`);
    return register.id;
  }

  private async nextReceiptNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `AH-${year}-`;
    const last = await this.prisma.financeTransaction.findFirst({
      where: { tenantId, receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: 'desc' },
    });
    let seq = 1;
    if (last) {
      const part = last.receiptNumber.replace(prefix, '');
      const n = parseInt(part, 10);
      if (!isNaN(n)) seq = n + 1;
    }
    return `${prefix}${seq.toString().padStart(6, '0')}`;
  }

  /**
   * Mapping feeType → code de la caisse de destination.
   * Quand un paiement en ligne arrive dans la caisse ONLINE, le système
   * crédite virtuellement la caisse de destination selon le type de frais.
   */
  private static readonly FEE_TYPE_TO_CAISSE: Record<string, string> = {
    INSCRIPTION: 'ACCUEIL',
    REINSCRIPTION: 'ACCUEIL',
    TUITION: 'ACCUEIL',
    CANTEEN: 'CANTEEN',
    EXAMEN: 'EXAMEN',
    TRANSPORT: 'TRANSPORT',
    OTHER: 'MAIN',
  };

  /**
   * Allocation intelligente : crédite virtuellement les caisses de destination
   * selon le type de frais. La caisse ONLINE n'est JAMAIS débitée.
   *
   * @param tenantId - ID du tenant
   * @param transactionId - ID de la transaction
   * @param updates - Allocations par breakdown (avec feeType)
   * @param onlineCaisseId - ID de la caisse ONLINE (source, non débitée)
   */
  private async allocateToDestinationCaisses(
    tenantId: string,
    transactionId: string,
    updates: { breakdownId: string; paidDelta: number; feeType: string }[],
    onlineCaisseId: string | null,
  ): Promise<void> {
    if (!updates.length || !onlineCaisseId) return;

    // Regrouper les montants par type de frais
    const allocationsByFeeType: Record<string, number> = {};
    for (const u of updates) {
      const feeType = u.feeType || 'OTHER';
      allocationsByFeeType[feeType] = (allocationsByFeeType[feeType] || 0) + u.paidDelta;
    }

    // Récupérer toutes les caisses du tenant (pour trouver les destinations)
    const allCaisses = await this.prisma.cashRegister.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, code: true, name: true, currentBalance: true },
    });

    for (const [feeType, amount] of Object.entries(allocationsByFeeType)) {
      if (amount <= 0) continue;

      // Déterminer la caisse de destination
      const destCaisseCode = FinanceTransactionService.FEE_TYPE_TO_CAISSE[feeType] || 'MAIN';
      let destCaisse = allCaisses.find(c => c.code === destCaisseCode);

      // Fallback : si la caisse de destination n'existe pas, utiliser MAIN
      if (!destCaisse) {
        destCaisse = allCaisses.find(c => c.code === 'MAIN');
      }

      // Si toujours pas de caisse, skip
      if (!destCaisse) {
        this.logger.warn(`Allocation: caisse de destination "${destCaisseCode}" introuvable pour feeType="${feeType}" — allocation ignorée.`);
        continue;
      }

      // Ne pas s'auto-allouer (si la dest est la même que la source)
      if (destCaisse.id === onlineCaisseId) continue;

      try {
        // 1. Créditer la caisse de destination (sans débiter la ONLINE)
        await this.prisma.cashRegister.update({
          where: { id: destCaisse.id },
          data: { currentBalance: { increment: amount } },
        });

        // 2. Enregistrer le transfert d'allocation (pour traçabilité)
        // Status 'AUTO_ALLOCATION' indique que la source n'est PAS débitée
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO "cash_register_transfers" ("id", "tenantId", "fromCashRegisterId", "toCashRegisterId", "amount", "note", "reference", "userId", "status", "createdAt")
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NULL, 'AUTO_ALLOCATION', NOW())
        `, tenantId, onlineCaisseId, destCaisse.id, amount,
          `Allocation automatique — ${feeType} (transaction ${transactionId.substring(0, 8)})`,
          `AUTO-${transactionId.substring(0, 8)}-${feeType}`
        );

        this.logger.log(
          `Allocation automatique: ${amount} FCFA → caisse ${destCaisse.code} (${destCaisse.name}) ` +
          `pour feeType=${feeType} (transaction ${transactionId.substring(0, 8)})`
        );
      } catch (err: any) {
        this.logger.error(`Allocation failed for feeType=${feeType}: ${err.message}`);
      }
    }
  }

  /**
   * Enregistre un encaissement et impute automatiquement sur les breakdowns (priorité Inscription > Arriérés > Scolarité > Annexes).
   */
  async create(
    tenantId: string,
    data: {
      academicYearId: string;
      studentAccountId: string;
      amount: number;
      paymentMethod: PaymentMethod | string;
      reference?: string;
      cashierId: string;
      cashierRole?: string;  // ⭐ rôle du caissier pour vérif caisse FONDE
      deviceId?: string;
      receiptUrl?: string;
      cashRegisterId?: string;  // ← NOUVEAU : caisse utilisée pour ce paiement
      // ⭐ Espèces : montant remis par le client + reliquat rendu (pour traçabilité reçu)
      tenderedAmount?: number;  // Montant remis (ex: 50000 pour un paiement de 45000)
      changeGiven?: number;     // Reliquat rendu (ex: 5000)
      // ⭐ Encaissement DÉDIÉ (sept. 2026 — frais généraux) : imputer UNIQUEMENT
      //    aux AccountBreakdown de ce type (ex: 'GENERAL'). Voir CreateTransactionDto.
      targetFeeType?: string;
      // ⭐ RÉPARTITION MANUELLE (sept. 2026 — flexibilité encaissement) :
      //    imputations EXPLICITES décidées par la comptable / secrétaire comptable.
      //    Ex: parent paie inscription + uniforme + frais généraux, mais pas la
      //    scolarité (ou partiellement). Chaque ligne = (breakdown, montant).
      //    Validation : appartient au compte, > 0, ≤ restant dû ; le reliquat
      //    éventuel passe par la cascade de priorité classique.
      manualAllocations?: { accountBreakdownId: string; amount: number }[];
      // ⭐ FRAIS GÉNÉRAUX À LA CARTE (sept. 2026) : frais généraux sélectionnés
      //    dans le catalogue au moment de l'encaissement (pattern « articles
      //    boutique »). Les breakdowns manquants sont créés à la volée, puis
      //    les montants sont fusionnés dans les imputations explicites.
      generalFeeAddOns?: { feeStructureId: string; amount: number }[];
    },
  ) {
    const paymentMethod = (typeof data.paymentMethod === 'string' && PAYMENT_METHODS.includes(data.paymentMethod as PaymentMethod))
      ? (data.paymentMethod as PaymentMethod) : 'CASH';

    // ✅ Pour les paiements en ligne (Fedapay/FedaPay), rattacher automatiquement
    // à la caisse virtuelle "Caisse Paiements en Ligne" si aucune caisse n'est fournie.
    // Cela assure la traçabilité dans l'onglet multi-caisses.
    let effectiveCashRegisterId = data.cashRegisterId;
    if (!effectiveCashRegisterId && (paymentMethod === 'FEDAPAY' || paymentMethod === 'FEDAPAY')) {
      try {
        effectiveCashRegisterId = await this.getOrCreateOnlinePaymentCashRegister(tenantId);
        this.logger.log(`Paiement ${paymentMethod} rattaché à la caisse virtuelle ONLINE: ${effectiveCashRegisterId}`);
      } catch (err: any) {
        this.logger.warn(`Impossible de créer/récupérer la caisse ONLINE (non bloquant): ${err.message}`);
      }
    }

    // Validation de la caisse si fournie (uniquement pour les caisses physiques,
    // pas pour la caisse virtuelle ONLINE qui est toujours ouverte)
    if (data.cashRegisterId) {
      const register = await this.prisma.cashRegister.findFirst({
        where: { id: data.cashRegisterId, tenantId },
      });
      if (!register) {
        throw new NotFoundException('Caisse non trouvée');
      }
      if (!register.isActive) {
        throw new BadRequestException('Caisse archivée — paiements interdits.');
      }
      if (!register.isOpen) {
        throw new BadRequestException('Caisse fermée — ouvrez-la avant d\'encaisser.');
      }

      // ⭐ RESTRICTION CAISSE FONDE (caisse promoteur/fondateur)
      //    Seuls les rôles PROMOTER/PROMOTEUR/PLATFORM_OWNER/SUPER_ADMIN peuvent
      //    encaisser sur la caisse FONDE. Empêche un caissier (ACCOUNTANT) de
      //    détourner des paiements destinés au promoteur.
      //
      //    Convention : la caisse promoteur est identifiée par son code 'FONDE'.
      //    Cette convention est documentée dans CashRegistersContent.tsx
      //    (PREDEFINED_CAISSES) et ne peut pas être changée par l'utilisateur
      //    sans casser cette restriction.
      if (register.code === 'FONDE') {
        const PROMOTER_CAISSE_ALLOWED_ROLES = [
          'PROMOTER', 'PROMOTEUR',
          'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN',
        ];
        const userRole = (data.cashierRole || '').toUpperCase();
        if (!PROMOTER_CAISSE_ALLOWED_ROLES.includes(userRole)) {
          this.logger.warn(
            `Tentative d'encaissement sur caisse FONDE refusée — user ${data.cashierId} (role=${userRole})`,
          );
          throw new ForbiddenException(
            'Seul le promoteur/fondateur peut encaisser sur la caisse FONDE. ' +
            'Veuillez sélectionner une autre caisse.',
          );
        }
      }
    }

    const account = await this.prisma.studentAccount.findFirst({
      where: { id: data.studentAccountId, tenantId },
      include: {
        breakdowns: {
          include: { feeStructure: true },
          orderBy: { feeStructure: { feeType: 'asc' } },
        },
      },
    });
    if (!account) throw new NotFoundException('StudentAccount not found');

    // ✅ Idempotence : si une transaction existe déjà avec cette référence (Fedapay/FedaPay),
    // on la retourne sans en créer une nouvelle (évite les doublons si le webhook
    // arrive après le onComplete du widget, ou vice-versa).
    if (data.reference) {
      const existing = await this.prisma.financeTransaction.findFirst({
        where: { reference: data.reference, tenantId },
      });
      if (existing) {
        return existing;
      }
    }

    let remaining = data.amount;
    const updates: { breakdownId: string; paidDelta: number; remainingDelta: number; feeType: string }[] = [];

    // ─── FRAIS GÉNÉRAUX À LA CARTE (sept. 2026) ───
    // Frais généraux sélectionnés dans le catalogue du modal de paiement
    // (pattern « articles boutique » — NewPaymentModal, flux post-inscription
    // comme module Finance). Pour chaque ligne :
    //   1. valider la FeeStructure (GENERAL + active + tenant) ;
    //   2. retrouver le breakdown sur le compte — ou le CRÉER à la volée
    //      (initialAmount = montant de la structure) en ajustant totalDue et
    //      balance du compte (le trigger DB ne réagit qu'aux transactions) ;
    //   3. fusionner le montant dans les imputations explicites → tout le
    //      mécanisme existant (validation ≤ restant dû, Σ ≤ amount, reliquat
    //      en cascade, FIFO sauté) s'applique ensuite naturellement.
    let effectiveManualAllocations: { accountBreakdownId: string; amount: number }[] | undefined =
      data.manualAllocations;
    if (data.generalFeeAddOns?.length) {
      if (data.targetFeeType) {
        throw new BadRequestException(
          'Les frais généraux à la carte sont incompatibles avec le type de frais cible (encaissement dédié).',
        );
      }
      const merged: { accountBreakdownId: string; amount: number }[] = [
        ...(data.manualAllocations ?? []),
      ];
      for (const addOn of data.generalFeeAddOns) {
        const structure = await this.prisma.feeStructure.findFirst({
          where: {
            id: addOn.feeStructureId,
            tenantId,
            feeType: 'GENERAL',
            isActive: true,
          },
        });
        if (!structure) {
          throw new BadRequestException(
            'Un frais général sélectionné est introuvable, inactif ou n\u2019est pas un frais général.',
          );
        }
        const amt = Number(addOn.amount);
        if (!(amt > 0)) {
          throw new BadRequestException(
            `Montant invalide pour « ${structure.name} » : ${amt}.`,
          );
        }
        let breakdown = account.breakdowns.find((x) => x.feeStructureId === structure.id);
        if (breakdown) {
          // Ligne déjà présente sur le compte (paiement partiel antérieur) :
          // le montant est plafonné au restant dû (validation commune ci-dessous).
          merged.push({ accountBreakdownId: breakdown.id, amount: amt });
        } else {
          // Création à la volée + cohérence des totaux du compte.
          if (amt > Number(structure.totalAmount) + 1e-9) {
            throw new BadRequestException(
              `Le montant saisi pour « ${structure.name} » (${amt.toLocaleString('fr-FR')} FCFA) ` +
              `dépasse le montant du frais (${Number(structure.totalAmount).toLocaleString('fr-FR')} FCFA).`,
            );
          }
          // ⚠️ Le trigger prevent_balance_update bloque les UPDATE directs des
          // champs de solde : on passe par $transaction + SET LOCAL
          // app.allow_balance_update (pattern FeeStructureService) pour que le
          // breakdown ET l'ajustement du compte soient atomiques et autorisés.
          const structAmount = Number(structure.totalAmount);
          breakdown = await this.prisma.$transaction(async (tx) => {
            const created = await tx.accountBreakdown.create({
              data: {
                studentAccountId: account.id,
                feeStructureId: structure.id,
                initialAmount: structure.totalAmount,
                adjustedAmount: structure.totalAmount,
                paidAmount: 0,
                remainingAmount: structure.totalAmount,
              },
              include: { feeStructure: true },
            });
            await tx.$executeRawUnsafe(`SET LOCAL app.allow_balance_update = 'true'`);
            await tx.studentAccount.update({
              where: { id: account.id },
              data: {
                totalDue: { increment: structAmount },
                balance: { increment: structAmount },
              },
            });
            return created;
          });
          account.breakdowns.push(breakdown);
          account.totalDue = Number(account.totalDue) + structAmount;
          account.balance = Number(account.balance) + structAmount;
          merged.push({ accountBreakdownId: breakdown.id, amount: amt });
          this.logger.log(
            `Frais général à la carte : breakdown « ${structure.name} » créé sur le compte ` +
            `${account.id} (${structAmount.toLocaleString('fr-FR')} FCFA) — imputation de ${amt.toLocaleString('fr-FR')} FCFA.`,
          );
        }
      }
      effectiveManualAllocations = merged.length > 0 ? merged : undefined;
    }

    // ─── RÉPARTITION MANUELLE (flexibilité sept. 2026) ───
    // La comptable précise elle-même le dispatching (toggle « répartition
    // personnalisée » du NewPaymentModal + section frais généraux). Chaque
    // ligne est imputée EXACTEMENT comme spécifié — le FIFO des arriérés est
    // SAUTÉ (décision explicite) et le reliquat éventuel passe par la cascade
    // de priorité classique sur les restants non couverts.
    const manualAllocMap = new Map<string, number>();
    if (effectiveManualAllocations?.length) {
      if (data.targetFeeType) {
        throw new BadRequestException(
          'Répartition manuelle et type de frais cible sont mutuellement exclusifs.',
        );
      }
      let manualSum = 0;
      for (const m of effectiveManualAllocations) {
        const b = account.breakdowns.find((x) => x.id === m.accountBreakdownId);
        if (!b) {
          throw new BadRequestException(
            'Une ligne de répartition ne correspond à aucun frais du compte de cet élève.',
          );
        }
        const amt = Number(m.amount);
        if (!(amt > 0)) {
          throw new BadRequestException(
            `Montant invalide pour « ${b.feeStructure.name} » : ${amt}.`,
          );
        }
        const prev = manualAllocMap.get(b.id) ?? 0;
        if (prev + amt > Number(b.remainingAmount) + 1e-9) {
          throw new BadRequestException(
            `Le montant saisi pour « ${b.feeStructure.name} » (${amt.toLocaleString('fr-FR')} FCFA) ` +
            `dépasse le restant dû (${Number(b.remainingAmount).toLocaleString('fr-FR')} FCFA).`,
          );
        }
        manualAllocMap.set(b.id, prev + amt);
        manualSum += amt;
      }
      if (manualSum > data.amount + 1e-9) {
        throw new BadRequestException(
          `La somme des imputations manuelles (${manualSum.toLocaleString('fr-FR')} FCFA) ` +
          `dépasse le montant du paiement (${data.amount.toLocaleString('fr-FR')} FCFA).`,
        );
      }
      // Construire les updates depuis la répartition manuelle
      for (const [breakdownId, pay] of manualAllocMap) {
        const b = account.breakdowns.find((x) => x.id === breakdownId)!;
        updates.push({
          breakdownId,
          paidDelta: pay,
          remainingDelta: -pay,
          feeType: b.feeStructure.feeType,
        });
      }
      remaining = Math.max(0, data.amount - manualSum);
      this.logger.log(
        `Répartition manuelle: ${manualAllocMap.size} ligne(s) imputée(s) pour ${manualSum.toLocaleString('fr-FR')} FCFA` +
        (remaining > 0 ? `, reliquat de ${remaining.toLocaleString('fr-FR')} FCFA en cascade` : ''),
      );
    }

    // ─── PHASE 3 : Paiement FIFO — solder d'abord les arriérés anciens ───
    // Avant d'allouer le paiement aux AccountBreakdown de l'année en cours,
    // on solde d'abord les FeeArrear des années antérieures (FIFO).
    // Le montant restant après cette étape sera alloué aux frais de l'année.
    //
    // ⭐ Encaissement DÉDIÉ (targetFeeType) : on SAUTE cette phase — le
    //    paiement cible explicitement les frais de l'année en cours pour ce
    //    type (ex: frais généraux), pas les arriérés de scolarité.
    // ⭐ Répartition manuelle : FIFO sauté également — la comptable a précisé
    //    explicitement où imputer le paiement (les arriérés éventuels seront
    //    gérés par l'onglet dédié Arriérés).
    if (remaining > 0 && !data.targetFeeType && !effectiveManualAllocations) {
      try {
        const fifoResult = await this.arrearAccumulationService.allocatePaymentFIFO(
          tenantId,
          account.studentId,
          remaining,
        );

        // Logger les allocations FIFO
        if (fifoResult.allocations.length > 0) {
          this.logger.log(
            `FIFO: ${fifoResult.allocations.length} arriéré(s) soldé(s) pour ${data.amount - fifoResult.remainingAmount} FCFA. ` +
            `Reste ${fifoResult.remainingAmount} FCFA pour les frais de l'année en cours.`,
          );
        }

        // Le reste est alloué aux AccountBreakdown
        remaining = fifoResult.remainingAmount;
      } catch (err: any) {
        this.logger.warn(`FIFO allocation failed (non-blocking): ${err.message}`);
        // En cas d'erreur, on continue avec le montant original (non bloquant)
      }
    }

    // ⭐ Encaissement DÉDIÉ : restreindre l'allocation aux breakdowns du type
    //    cible uniquement (ex: GENERAL pour l'encaissement dédié des frais
    //    généraux). Le reste de la mécanique (allocations, caisse, reçu,
    //    déduction du solde) est IDENTIQUE au paiement standard.
    const allocatableBreakdowns = data.targetFeeType
      ? account.breakdowns.filter((b) => b.feeStructure.feeType === data.targetFeeType)
      : account.breakdowns;

    // Sécurité : l'encaissement dédié exige qu'il y ait des frais de ce type
    // sur le compte (sinon le paiement flotterait sans allocation).
    if (data.targetFeeType && (allocatableBreakdowns.length === 0 || remaining <= 0)) {
      const label = FEE_TYPE_LABELS[data.targetFeeType] ?? data.targetFeeType;
      throw new BadRequestException(
        `Aucun frais du type « ${label} » à payer pour cet élève sur l'année en cours.`,
      );
    }

    const sortedBreakdowns = [...allocatableBreakdowns].sort((a, b) => {
      const ia = PRIORITY_ORDER.indexOf(a.feeStructure.feeType);
      const ib = PRIORITY_ORDER.indexOf(b.feeStructure.feeType);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    // Cascade de priorité sur le restant non couvert par la répartition
    // manuelle (effective remaining = remainingAmount − déjà imputé manuellement).
    // ⚠️ MERGE obligatoire dans updates : la contrainte @@unique
    // (financeTransactionId, accountBreakdownId) interdit deux allocations
    // de la même ligne de frais pour une même transaction.
    for (const b of sortedBreakdowns) {
      if (remaining <= 0) break;
      const alreadyManual = manualAllocMap.get(b.id) ?? 0;
      const rem = Number(b.remainingAmount) - alreadyManual;
      if (rem <= 0) continue;
      const pay = Math.min(remaining, rem);
      const existing = updates.find((u) => u.breakdownId === b.id);
      if (existing) {
        existing.paidDelta += pay;
        existing.remainingDelta -= pay;
      } else {
        updates.push({
          breakdownId: b.id,
          paidDelta: pay,
          remainingDelta: -pay,
          feeType: b.feeStructure.feeType,
        });
      }
      remaining -= pay;
    }

    // ⭐ Répartition manuelle (ou frais généraux à la carte) : refuser un
    //    paiement qui dépasserait le total restant dû du compte (comme pour
    //    l'encaissement dédié — on ne crée jamais de transaction avec de
    //    l'argent flottant via ce flux).
    if (effectiveManualAllocations && remaining > 0) {
      const totalDue = account.breakdowns.reduce((s, b) => s + Number(b.remainingAmount), 0);
      throw new BadRequestException(
        `Le montant (${data.amount.toLocaleString('fr-FR')} FCFA) dépasse le total restant dû de cet élève ` +
        `(${totalDue.toLocaleString('fr-FR')} FCFA). Réduisez le montant ou ajustez la répartition.`,
      );
    }

    // ⭐ Encaissement DÉDIÉ : refuser un montant supérieur au restant dû pour
    //    ce type de frais (on ne crée jamais de transaction partiellement
    //    non allouée via ce flux — l'utilisateur voit un message clair).
    if (data.targetFeeType && remaining > 0) {
      const label = FEE_TYPE_LABELS[data.targetFeeType] ?? data.targetFeeType;
      const alreadyPlanned = updates.reduce((s, u) => s + u.paidDelta, 0);
      throw new BadRequestException(
        `Le montant (${data.amount.toLocaleString('fr-FR')} FCFA) dépasse le restant dû pour les frais « ${label} » ` +
        `de cet élève (${alreadyPlanned.toLocaleString('fr-FR')} FCFA). ` +
        `Encaissez au plus ${alreadyPlanned.toLocaleString('fr-FR')} FCFA, ou utilisez « Nouveau paiement » pour un paiement global.`,
      );
    }

    // Génération du numéro de reçu avec vérification d'unicité + retry
    // (évite l'erreur "champ unique existe déjà" en cas de race condition)
    let receiptNumber = await this.receiptFinanceService.generateReceiptNumber(tenantId, data.academicYearId)
      .then((r) => r.local)
      .catch((err) => {
        this.logger.warn(`MatriculeGeneratorService failed, fallback to AH-YYYY-NNNNNN: ${err.message}`);
        return this.nextReceiptNumber(tenantId);
      });

    // Vérifier l'unicité — si le numéro existe déjà, incrémenter jusqu'à trouver un numéro libre
    for (let attempt = 0; attempt < 10; attempt++) {
      const existing = await this.prisma.financeTransaction.findFirst({
        where: { receiptNumber },
        select: { id: true },
      });
      if (!existing) break; // Numéro libre
      // Numéro déjà pris — incrémenter la séquence
      this.logger.warn(`Receipt number ${receiptNumber} already exists, trying next (attempt ${attempt + 1})`);
      const parts = receiptNumber.split('-');
      const seq = parseInt(parts[parts.length - 1], 10);
      const nextSeq = (isNaN(seq) ? 0 : seq) + 1;
      parts[parts.length - 1] = String(nextSeq).padStart(5, '0');
      receiptNumber = parts.join('-');
    }

    // Génération de la référence de transaction (si non fournie par l'utilisateur)
    // Format : TX-{YY}{MM}-{SEQ}  ex: TX-2607-001
    let transactionReference = data.reference ?? null;
    if (!transactionReference) {
      const now = new Date();
      const ym = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const prefix = `TX-${ym}-`;
      const lastRef = await this.prisma.financeTransaction.findFirst({
        where: { tenantId, reference: { startsWith: prefix } },
        select: { reference: true },
        orderBy: { reference: 'desc' },
      });
      let refSeq = 1;
      if (lastRef?.reference) {
        const part = lastRef.reference.replace(prefix, '');
        const n = parseInt(part, 10);
        if (!isNaN(n)) refSeq = n + 1;
      }
      transactionReference = `${prefix}${String(refSeq).padStart(3, '0')}`;
    }

    // ⭐ Re-vérification backend du reliquat (sécurité) — uniquement pour CASH
    // Le frontend envoie tenderedAmount + changeGiven. Pour les paiements standards,
    // on re-calcule changeGiven = max(0, tenderedAmount - amount).
    // ⚠️ Exception : pour le multi-action (frais + boutique), le changeGiven est
    // calculé par MultiActionPaymentService sur le TOTAL combiné (feeAmount + shopAmount),
    // pas juste sur amount. Dans ce cas, le multi-action passe un changeGiven déjà
    // calculé qu'on doit respecter. On détecte ce cas via la présence d'une référence
    // contenant "MULTI_ACTION".
    let computedTendered: number | undefined;
    let computedChange: number | undefined;
    if (paymentMethod === 'CASH' && data.tenderedAmount != null && data.tenderedAmount > 0) {
      computedTendered = Number(data.tenderedAmount);
      const isMultiAction = (data.reference ?? '').includes('MULTI_ACTION');
      if (isMultiAction && data.changeGiven != null) {
        // Multi-action : respecter le changeGiven fourni (calculé sur total combiné)
        computedChange = Number(data.changeGiven);
      } else {
        // Paiement standard : re-calculer changeGiven = max(0, tendered - amount)
        computedChange = Math.max(0, computedTendered - data.amount);
        // Log si le frontend a envoyé un changeGiven incohérent (à des fins de debug)
        if (data.changeGiven != null && Math.abs(Number(data.changeGiven) - computedChange) > 0.01) {
          this.logger.warn(
            `changeGiven incohérent reçu du frontend: ${data.changeGiven} vs calculé ${computedChange} ` +
            `(tendered=${computedTendered}, amount=${data.amount}). Utilisation de la valeur calculée.`,
          );
        }
      }
    }

    const tx = await this.prisma.financeTransaction.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        studentAccountId: data.studentAccountId,
        type: TransactionType.PAYMENT,
        amount: data.amount,
        paymentMethod,
        reference: transactionReference,
        cashierId: data.cashierId,
        deviceId: data.deviceId ?? null,
        receiptNumber,
        receiptUrl: data.receiptUrl ?? null,
        cashRegisterId: effectiveCashRegisterId ?? null,
        // ⭐ Espèces : tracer le montant remis + reliquat pour le reçu PDF/WhatsApp/SMS
        tenderedAmount: computedTendered ?? null,
        changeGiven: computedChange ?? null,
        allocations: updates.length
          ? { create: updates.map((u) => ({ accountBreakdownId: u.breakdownId, amount: u.paidDelta })) }
          : undefined,
      },
    });
    const integrityHash = crypto
      .createHash('sha256')
      .update(
        `${tenantId}|${data.studentAccountId}|${data.amount}|${TransactionType.PAYMENT}|${tx.createdAt.toISOString()}`,
      )
      .digest('hex');
    await this.prisma.financeTransaction.update({
      where: { id: tx.id },
      data: { integrityHash },
    });

    for (const u of updates) {
      await this.prisma.accountBreakdown.update({
        where: { id: u.breakdownId },
        data: {
          paidAmount: { increment: u.paidDelta },
          remainingAmount: { decrement: u.paidDelta },
        },
      });
    }

    // Mise à jour du solde de la caisse (multi-caisses)
    if (effectiveCashRegisterId) {
      try {
        await this.prisma.cashRegister.update({
          where: { id: effectiveCashRegisterId },
          data: { currentBalance: { increment: data.amount } },
        });
      } catch (err: any) {
        this.logger.error(`Failed to update cash register balance: ${err.message}`);
      }
    }

    // ─── Allocation intelligente : caisse ONLINE → caisses de destination ───
    // Quand un paiement arrive dans la caisse ONLINE (Fedapay/FedaPay),
    // le système crédite virtuellement les caisses de destination selon le
    // type de frais (scolarité → ACCUEIL, cantine → CANTEEN, etc.).
    // La caisse ONLINE n'est JAMAIS débitée — son solde reste croissant
    // (il représente le volume total des paiements en ligne).
    if (paymentMethod === 'FEDAPAY' || paymentMethod === 'FEDAPAY') {
      await this.allocateToDestinationCaisses(tenantId, tx.id, updates, effectiveCashRegisterId);
    }

    // Note: totalPaid, balance and status are now updated via the DB Trigger 'update_balance_after_transaction'
    // on the finance_transactions table to ensure atomicity.

    // ─── Génération du reçu PDF + notifications automatiques (fire-and-forget) ─
    // Le PDF est généré en arrière-plan, puis les notifications (email, WhatsApp,
    // SMS) sont envoyées automatiquement au parent de l'élève.
    this.receiptFinanceService
      .generateForTransaction(tx.id, tenantId)
      .then(({ receiptUrl }) => {
        this.logger.log(`Reçu PDF généré pour transaction ${tx.receiptNumber}: ${receiptUrl}`);
        // ⭐ Envoyer automatiquement les notifications (email + Helm Connect)
        //    Helm Connect remplace WhatsApp + SMS : le parent reçoit le reçu PDF
        //    directement dans son compte Helm Connect (il se connecte au portail
        //    parent avec son numéro de téléphone). Email conservé pour archivage.
        //    Fire-and-forget — ne bloque jamais la réponse API
        return this.receiptNotificationService.sendReceiptNotifications(
          tx.id,
          tenantId,
          ['email', 'helm_connect'],
        );
      })
      .then((results) => {
        const sent = Object.entries(results)
          .filter(([, v]: any) => v.status === 'sent')
          .map(([k]) => k);
        const skipped = Object.entries(results)
          .filter(([, v]: any) => v.status === 'skipped')
          .map(([k]) => k);
        this.logger.log(
          `Notifications auto pour ${tx.receiptNumber}: envoyées=[${sent.join(',')}] skip=[${skipped.join(',')}]`,
        );
      })
      .catch((err) => {
        this.logger.error(`Échec génération reçu/notifications pour ${tx.receiptNumber}: ${err.message}`);
      });

    return this.prisma.financeTransaction.findUnique({
      where: { id: tx.id },
      include: {
        studentAccount: { include: { breakdowns: true, student: true } },
        allocations: true,
        cashRegister: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async findAll(
    tenantId: string,
    filters: {
      academicYearId?: string;
      studentAccountId?: string;
      type?: string;
      // ⭐ Filtre par type de frais (ex: GENERAL pour le sous-onglet « Frais
      //    généraux ») : ne renvoie que les transactions ayant au moins une
      //    allocation vers un AccountBreakdown de ce type.
      feeType?: string;
      page?: number;
      limit?: number;
    },
    scope?: AccessScope | null,
  ) {
    const where: any = { tenantId };
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.studentAccountId) where.studentAccountId = filters.studentAccountId;
    if (filters.type) where.type = filters.type;

    // ⭐ FIX 2026-09-06 (D6 — matrice P5) : périmètre IMPOSÉ par le scope serveur.
    //    Avant : la liste renvoyait TOUTES les transactions du tenant, y compris
    //    pour les comptes restreints à un niveau/piste (ex: SECRETAIRE_COMPTABLE_SEC
    //    voyait les encaissements de la Maternelle).
    //    - Niveau : via le compte élève (studentAccount → student.schoolLevelId)
    //    - Piste  : colonne dénormalisée academicTrackId (null = héritage FR)
    if (scope?.resolved && !scope.allLevels) {
      where.studentAccount = {
        student: { schoolLevelId: { in: scope.levelIds } },
      };
    }
    if (scope?.resolved && !scope.allTracks) {
      const enOnly = scope.trackCodes.includes('EN') && !scope.trackCodes.includes('FR');
      if (enOnly) {
        where.academicTrackId = { in: scope.trackIds };
      } else {
        // Piste FR : transactions marquées FR + non marquées (null = héritage FR)
        where.OR = [
          { academicTrackId: { in: scope.trackIds } },
          { academicTrackId: null },
        ];
      }
    }
    if (filters.feeType) {
      where.allocations = {
        some: { accountBreakdown: { feeStructure: { feeType: filters.feeType } } },
      };
    }

    // ⭐ Inclure les allocations + breakdowns quand un feeType est demandé :
    //    le frontend (sous-onglet « Frais généraux ») affiche la part imputée
    //    à ce type de frais pour chaque transaction.
    const include: any = {
      studentAccount: { include: { student: true } },
    };
    if (filters.feeType) {
      include.allocations = {
        include: {
          accountBreakdown: {
            include: {
              feeStructure: { select: { id: true, name: true, feeType: true, totalAmount: true } },
            },
          },
        },
      };
    }

    // ⭐ Pagination optionnelle : si page/limit fournis → retour paginé
    // { data, total, page, limit, totalPages }.
    // Sinon → retour array (rétro-compatibilité).
    if (filters.page && filters.limit) {
      const page = Math.max(1, filters.page);
      const limit = Math.min(500, Math.max(1, filters.limit));
      const [data, total] = await Promise.all([
        this.prisma.financeTransaction.findMany({
          where,
          include,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.financeTransaction.count({ where }),
      ]);
      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    return this.prisma.financeTransaction.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Annulation par écriture inverse (REVERSAL). Revertit les imputations sur les breakdowns via les allocations enregistrées.
   */
  async reverse(
    transactionId: string,
    tenantId: string,
    reason: string,
    cashierId: string,
  ) {
    const original = await this.prisma.financeTransaction.findFirst({
      where: { id: transactionId, tenantId },
      include: { studentAccount: true, allocations: { include: { accountBreakdown: true } } },
    });
    if (!original) throw new NotFoundException('Transaction not found');
    if (original.type === TransactionType.REVERSAL) throw new BadRequestException('Cannot reverse a reversal');

    const reversalAmount = -Number(original.amount);
    const receiptNumber = await this.nextReceiptNumber(tenantId);

    const reversal = await this.prisma.financeTransaction.create({
      data: {
        tenantId,
        academicYearId: original.academicYearId,
        studentAccountId: original.studentAccountId,
        type: TransactionType.REVERSAL,
        amount: reversalAmount,
        paymentMethod: original.paymentMethod,
        reference: `Annulation: ${original.receiptNumber}. ${reason}`,
        reversedFromId: original.id,
        cashierId,
        receiptNumber,
      },
    });

    for (const alloc of original.allocations) {
      const amt = Number(alloc.amount);
      await this.prisma.accountBreakdown.update({
        where: { id: alloc.accountBreakdownId },
        data: {
          paidAmount: { decrement: amt },
          remainingAmount: { increment: amt },
        },
      });
    }

    // Note: totalPaid, balance and status are now updated via the DB Trigger.


    return this.prisma.financeTransaction.findUnique({
      where: { id: reversal.id },
      include: { studentAccount: true, reversedFrom: true },
    });
  }
}
