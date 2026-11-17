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
import * as fs from 'fs';
import * as path from 'path';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionType, PaymentMethod, AccountStatus } from '@prisma/client';
import { ReceiptFinanceService } from './receipt-finance.service';
import { ReceiptNotificationFinanceService } from './receipt-notification-finance.service';
import { ArrearAccumulationService } from './arrear-accumulation.service';
import { StudentAccountService } from './student-account.service';
import { AccessScope } from '../common/context/access-scope.service';
import { AppSequenceService } from '../common/services/app-sequence.service';

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
    private readonly appSequences: AppSequenceService,
    // ⭐ FIX (nov. 2026 — « scolarité 0 F », Mon Avenir Plus) : matérialise les
    //    frais applicables d'un compte sans AUCUN breakdown AVANT encaissement
    //    (cf. create ci-dessous). Aucune dépendance circulaire : le service de
    //    comptes n'importe pas FinanceTransactionService.
    private readonly studentAccountService: StudentAccountService,
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

  /**
   * ⭐ BRIEF PERF 3.3 — Numéro de reçu ATOMIQUE (AH-YYYY-NNNNNN).
   *
   * Avant : findFirst(orderBy receiptNumber desc) + parse + 1 — pattern
   * lecture-modification-écriture. Deux comptables validant un paiement au
   * même moment obtenaient le MÊME numéro (course entre le find et le create).
   *
   * Maintenant : upsert atomique sur app_sequences (INSERT ... ON CONFLICT
   * DO UPDATE current = current + 1 RETURNING) — le verrou de ligne n'est tenu
   * que pendant le statement (< 1ms), aucun doublon possible. À la première
   * utilisation, la séquence est initialisée au max existant (initFrom) pour
   * respecter la numérotation déjà en production.
   */
  private async nextReceiptNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `AH-${year}-`;
    const seq = await this.appSequences.next(tenantId, `RECEIPT_AH:${year}`, {
      initFrom: async () => {
        const last = await this.prisma.financeTransaction.findFirst({
          where: { tenantId, receiptNumber: { startsWith: prefix } },
          orderBy: { receiptNumber: 'desc' },
          select: { receiptNumber: true },
        });
        if (!last?.receiptNumber) return 0;
        const n = parseInt(last.receiptNumber.replace(prefix, ''), 10);
        return isNaN(n) ? 0 : n;
      },
    });
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
      // ⭐ IMPORT DE MASSE (sept. 2026) : sauter le reçu PDF + les notifications
      //    (email / Helm Connect). Un import Excel de bilan historique ne doit pas
      //    déclencher 300+ PDF/emails — lourd en ressources et trompeur pour les
      //    parents (paiements passés). Les reçus restent générables à la demande.
      skipReceiptSideEffects?: boolean;
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

    // ⭐ FIX (nov. 2026 — « scolarité 0 F », Mon Avenir Plus) : un compte SANS
    //    AUCUN breakdown (comptes créés par la promotion de fin d'année AVANT la
    //    configuration des frais — ex. 604 comptes Mon Avenir Plus 2026-2027)
    //    laissait l'encaissement flotter sans imputation : totalPaid > 0,
    //    balance < 0, aucune ligne de frais, « Scolarité 0 F » dans le module
    //    Comptes élèves. On matérialise les frais applicables (recalculate —
    //    mêmes règles que la configuration des frais) AVANT la cascade
    //    d'allocation : le paiement s'impute alors normalement (FIFO arriérés
    //    → priorité des frais). Non bloquant : si aucune structure n'existe
    //    encore pour l'année, on garde le comportement historique.
    if (account.breakdowns.length === 0) {
      try {
        await this.studentAccountService.recalculate(
          account.studentId,
          tenantId,
          account.academicYearId,
        );
        const refreshed = await this.prisma.studentAccount.findFirst({
          where: { id: data.studentAccountId, tenantId },
          include: {
            breakdowns: {
              include: { feeStructure: true },
              orderBy: { feeStructure: { feeType: 'asc' } },
            },
          },
        });
        if (refreshed) {
          account.breakdowns = refreshed.breakdowns;
          account.totalDue = refreshed.totalDue;
          account.totalPaid = refreshed.totalPaid;
          account.balance = refreshed.balance;
          this.logger.log(
            `Compte sans frais détecté : ${account.breakdowns.length} ligne(s) de frais ` +
              `matérialisée(s) avant encaissement (compte ${account.id}).`,
          );
        }
      } catch (err: any) {
        this.logger.warn(
          `Matérialisation des frais avant encaissement échouée (non bloquant) : ${err?.message}`,
        );
      }
    }

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

    // Génération du numéro de reçu — chaîne atomique (MatriculeGenerator
    // patché séquence atomique, fallback AH-YYYY-NNNNNN atomique également).
    // L'ancienne boucle de 10 vérifications d'unicité (jusqu'à 10 requêtes
    // de plus par paiement) est supprimée : la séquence ON CONFLICT rend
    // structurellement impossible l'obtention du même numéro par deux
    // requêtes concurrentes.
    let receiptNumber = await this.receiptFinanceService
      .generateReceiptNumber(tenantId, data.academicYearId)
      .then((r) => r.local)
      .catch((err: any) => {
        this.logger.warn(`MatriculeGeneratorService failed, fallback to AH-YYYY-NNNNNN: ${err.message}`);
        return this.nextReceiptNumber(tenantId);
      });

    // Génération de la référence de transaction (si non fournie par l'utilisateur)
    // Format : TX-{YY}{MM}-{SEQ}  ex: TX-2607-001
    // ⭐ BRIEF PERF 3.3 — séquence atomique (avant : findFirst max+1, même course)
    let transactionReference = data.reference ?? null;
    if (!transactionReference) {
      const now = new Date();
      const ym = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const prefix = `TX-${ym}-`;
      const refSeq = await this.appSequences.next(tenantId, `TXREF:${ym}`);
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

    // ⭐ BRIEF PERF 3.3 + 3.4 — Écritures du paiement regroupées en UNE
    // transaction interactive : create + hash d'intégrité + imputations des
    // breakdowns + solde de caisse.
    // Avant : chaque écriture partait en autocommit séparé — une déconnexion
    // en cours de route laissait la transaction créée SANS imputation (incohérence
    // de solde), et chaque aller-retour occupait le pool de connexions pendant
    // les pics de charge.
    // Maintenant : atomique (tout ou rien) + un seul BEGIN/COMMIT.
    // Le trigger DB update_balance_after_transaction maintient les totaux du
    // compte élève à l'INSERT exactement comme avant (incrément atomique).
    const tx = await this.prisma.$transaction(async (prismaTx) => {
      const created = await prismaTx.financeTransaction.create({
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

      // Hash d'intégrité — calculé depuis le createdAt réel de la ligne, dans
      // la même transaction (format d'entrée identique à l'existant).
      const integrityHash = crypto
        .createHash('sha256')
        .update(
          `${tenantId}|${data.studentAccountId}|${data.amount}|${TransactionType.PAYMENT}|${created.createdAt.toISOString()}`,
        )
        .digest('hex');
      await prismaTx.financeTransaction.update({
        where: { id: created.id },
        data: { integrityHash },
      });

      // Imputations sur les breakdowns — incrémentations SQL atomiques
      for (const u of updates) {
        await prismaTx.accountBreakdown.update({
          where: { id: u.breakdownId },
          data: {
            paidAmount: { increment: u.paidDelta },
            remainingAmount: { decrement: u.paidDelta },
          },
        });
      }

      // Mise à jour du solde de la caisse (multi-caisses) — increment atomique
      if (effectiveCashRegisterId) {
        try {
          await prismaTx.cashRegister.update({
            where: { id: effectiveCashRegisterId },
            data: { currentBalance: { increment: data.amount } },
          });
        } catch (err: any) {
          this.logger.error(`Failed to update cash register balance: ${err.message}`);
        }
      }

      return created;
    });

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
    // ⭐ Sauf pour les IMPORTS DE MASSE (skipReceiptSideEffects) : un import Excel
    //    de bilan ne doit pas déclencher des centaines de PDF/emails — lourd en
    //    ressources, ralentit l'import et notifie les parents de paiements passés.
    if (!data.skipReceiptSideEffects) {
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
    }

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

  // ═══════════════════════════════════════════════════════════════════
  //  ÉDITION / SUPPRESSION D'UN ENCAISSEMENT (sept. 2026 — PROMOTEUR)
  // ═══════════════════════════════════════════════════════════════════
  //  Le promoteur doit pouvoir aligner les encaissements saisis sur les
  //  documents papier fournis par les écoles (montant, mode, date, caisse).
  //  Contraintes d'intégrité respectées :
  //   - imputations (allocations) réversées puis ré-échelonnées au prorata ;
  //   - le solde du compte (totalPaid/balance) est ajusté manuellement car
  //     le trigger update_account_balance_after_tx ne réagit qu'aux INSERT
  //     (bypass app.allow_balance_update — même pattern que la Task 37) ;
  //   - le hash d'intégrité est recalculé EN SQL avec l'expression exacte
  //     du trigger verify_integrity_hash (pgcrypto) pour passer la vérification ;
  //   - les caisses (multi-caisses) sont ajustées du delta, y compris les
  //     allocations automatiques FEDAPAY (caisse ONLINE → caisses métier) ;
  //   - chaque opération est tracée dans financial_audit_logs ;
  //   - la suppression physique passe par le flag session
  //     app.allow_transaction_delete (trigger prevent_finance_transaction_delete).

  /** Charge une transaction avec tout le contexte nécessaire à l'édition/suppression. */
  private async loadEditableTransaction(tenantId: string, transactionId: string) {
    const original = await this.prisma.financeTransaction.findFirst({
      where: { id: transactionId, tenantId },
      include: {
        allocations: {
          include: { accountBreakdown: { include: { feeStructure: { select: { feeType: true, name: true } } } } },
        },
        reversals: { select: { id: true, receiptNumber: true } },
        cashRegister: { select: { id: true, code: true, name: true } },
        studentAccount: { select: { id: true, isBlocked: true, status: true } },
      },
    });
    if (!original) throw new NotFoundException('Transaction introuvable');
    if (original.type !== TransactionType.PAYMENT) {
      throw new BadRequestException('Seuls les encaissements (paiements) peuvent être modifiés ou supprimés — pas les annulations.');
    }
    if (original.reversals.length > 0) {
      throw new BadRequestException(
        `Ce paiement a été annulé par une écriture inverse (reçu ${original.reversals[0].receiptNumber}) — il ne peut plus être modifié ni supprimé.`,
      );
    }
    return original;
  }

  /** Traduit une erreur SQL de trigger en message métier clair. */
  private friendlyTriggerError(err: any, fallback: string): never {
    const msg = String(err?.message || '');
    if (msg.includes('Transaction locked after daily closure')) {
      throw new BadRequestException(
        'Cette transaction appartient à une journée déjà clôturée (clôture de caisse) — la modification est verrouillée.',
      );
    }
    if (msg.includes('Integrity hash mismatch')) {
      throw new BadRequestException('Incohérence du hash d’intégrité détectée — opération refusée.');
    }
    if (msg.includes('Suppression de transaction interdite')) {
      throw new BadRequestException(
        'La suppression physique est encore verrouillée en base (redémarrage du backend requis pour activer le bypass contrôlé).',
      );
    }
    if (msg.includes('Direct modification of balance fields')) {
      throw new BadRequestException('Ajustement du solde bloqué par le trigger de protection — opération annulée.');
    }
    throw new BadRequestException(fallback);
  }

  /**
   * Ajuste les allocations automatiques FEDAPAY (caisse ONLINE → caisses métier)
   * après un changement de montant : met à jour les transferts AUTO_ALLOCATION
   * et les soldes des caisses de destination, groupés par type de frais.
   */
  private async adjustFedapayAutoAllocations(
    tx: any,
    tenantId: string,
    transactionId: string,
    oldAllocsByFeeType: Record<string, number>,
    newAllocsByFeeType: Record<string, number>,
  ): Promise<void> {
    const idPrefix = `AUTO-${transactionId.substring(0, 8)}-`;
    const transfers: any[] = await tx.$queryRawUnsafe(
      `SELECT "id", "toCashRegisterId", "amount" FROM "cash_register_transfers"
       WHERE "tenantId" = $1 AND "status" = 'AUTO_ALLOCATION' AND "reference" LIKE $2`,
      tenantId, `${idPrefix}%`,
    ).catch(() => [] as any[]);

    // ⭐ Approche cumulative robuste : pour chaque type de frais, appliquer le
    //    delta (nouveau − ancien) à la caisse de destination correspondante et
    //    ajuster le transfert existant (ou le supprimer si le nouveau montant
    //    groupé tombe à 0).
    const allCaisses = await tx.cashRegister.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, code: true },
    });
    const findDest = (feeType: string) => {
      const code = FinanceTransactionService.FEE_TYPE_TO_CAISSE[feeType] || 'MAIN';
      return allCaisses.find((c) => c.code === code) ?? allCaisses.find((c) => c.code === 'MAIN');
    };

    for (const feeType of new Set([...Object.keys(oldAllocsByFeeType), ...Object.keys(newAllocsByFeeType)])) {
      const oldSum = oldAllocsByFeeType[feeType] ?? 0;
      const newSum = newAllocsByFeeType[feeType] ?? 0;
      const delta = newSum - oldSum;
      if (Math.abs(delta) < 0.005) continue;

      const dest = findDest(feeType);
      if (!dest) {
        this.logger.warn(`adjustFedapayAutoAllocations: caisse de destination introuvable pour feeType=${feeType} — ajustement ignoré`);
        continue;
      }
      // Ajuster le solde de la caisse de destination du delta
      await tx.cashRegister.update({
        where: { id: dest.id },
        data: { currentBalance: { increment: delta } },
      });
      // Ajuster le transfert de traçabilité (montant du flux, ≥ 0)
      const transfer = transfers.find((t) => t.toCashRegisterId === dest.id);
      if (transfer) {
        const newTransferAmount = Number(transfer.amount) + delta;
        if (newTransferAmount > 0.005) {
          await tx.$executeRawUnsafe(
            `UPDATE "cash_register_transfers" SET "amount" = $1 WHERE "id" = $2`,
            newTransferAmount, transfer.id,
          );
        } else {
          await tx.$executeRawUnsafe(
            `DELETE FROM "cash_register_transfers" WHERE "id" = $1`,
            transfer.id,
          );
        }
      } else if (newSum > 0.005) {
        // Nouveau type de frais apparu à l'édition → créer le transfert de traçabilité
        await tx.$executeRawUnsafe(
          `INSERT INTO "cash_register_transfers" ("id", "tenantId", "fromCashRegisterId", "toCashRegisterId", "amount", "note", "reference", "userId", "status", "createdAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NULL, 'AUTO_ALLOCATION', NOW())`,
          tenantId, null, dest.id, newSum,
          `Allocation automatique (édition) — ${feeType} (transaction ${transactionId.substring(0, 8)})`,
          `${idPrefix}${feeType}`,
        );
      }
    }
  }

  /**
   * ⭐ ÉDITER UN ENCAISSEMENT (promoteur uniquement — garde dans le controller).
   * Aligne les données sur les documents papier de l'école.
   */
  async update(
    tenantId: string,
    transactionId: string,
    user: any,
    data: {
      amount?: number;
      paymentMethod?: string;
      createdAt?: string;
      reference?: string;
      cashRegisterId?: string | null;
      tenderedAmount?: number;
      reason: string;
    },
  ) {
    const original = await this.loadEditableTransaction(tenantId, transactionId);

    const oldAmount = Number(original.amount);
    const newAmount = data.amount != null ? Number(data.amount) : oldAmount;
    if (!(newAmount > 0)) throw new BadRequestException('Le montant doit être supérieur à 0.');

    const isFedapay = original.paymentMethod === ('FEDAPAY' as any) || original.paymentMethod === ('FEEXPAY' as any);

    // ── Mode de paiement ──
    let newMethod: string = original.paymentMethod as string;
    if (data.paymentMethod && data.paymentMethod !== original.paymentMethod) {
      if (isFedapay) {
        throw new BadRequestException(
          'Le mode de paiement d’un encaissement en ligne (Fedapay) ne peut pas être changé. Supprimez-le et recréez-le si nécessaire.',
        );
      }
      newMethod = data.paymentMethod;
    }

    // ── Caisse ──
    let newCashRegisterId: string | null = original.cashRegisterId ?? null;
    if (data.cashRegisterId !== undefined && (data.cashRegisterId || null) !== (original.cashRegisterId ?? null)) {
      if (isFedapay) {
        throw new BadRequestException(
          'La caisse d’un encaissement en ligne (Fedapay) ne peut pas être changée. Supprimez-le et recréez-le si nécessaire.',
        );
      }
      if (data.cashRegisterId) {
        const register = await this.prisma.cashRegister.findFirst({
          where: { id: data.cashRegisterId, tenantId },
        });
        if (!register) throw new NotFoundException('Caisse non trouvée');
        if (!register.isActive) throw new BadRequestException('Caisse archivée — sélection impossible.');
        newCashRegisterId = data.cashRegisterId;
      } else {
        newCashRegisterId = null;
      }
    }

    // ── Date (alignement documents) ──
    let newCreatedAt: Date = original.createdAt;
    if (data.createdAt) {
      const d = new Date(data.createdAt);
      if (isNaN(d.getTime())) throw new BadRequestException('Date de paiement invalide.');
      newCreatedAt = d;
    }

    // ── Référence ──
    const newReference = data.reference !== undefined ? (data.reference?.trim() || null) : original.reference;

    // ── Espèces : montant remis / reliquat ──
    let newTendered: number | null = original.tenderedAmount != null ? Number(original.tenderedAmount) : null;
    let newChange: number | null = original.changeGiven != null ? Number(original.changeGiven) : null;
    if (newMethod === 'CASH') {
      if (data.tenderedAmount != null && Number(data.tenderedAmount) > 0) {
        newTendered = Number(data.tenderedAmount);
        newChange = Math.max(0, newTendered - newAmount);
      } else if (data.amount != null && newTendered != null) {
        // Montant changé sans remise re-saisie → on aligne la remise sur le nouveau montant
        newTendered = newAmount;
        newChange = 0;
      }
    } else {
      newTendered = null;
      newChange = null;
    }

    // ── Anciennes imputations groupées par type (pour l'ajustement FEDAPAY) ──
    const oldAllocs = original.allocations.map((a: any) => ({
      breakdownId: a.accountBreakdownId,
      amount: Number(a.amount),
      feeType: String(a.accountBreakdown?.feeStructure?.feeType ?? 'OTHER'),
    }));
    const oldAllocTotal = oldAllocs.reduce((s, a) => s + a.amount, 0);

    // ── Nouvelles imputations : même répartition, montants rescaling au prorata ──
    //    (on travaille en centimes pour éviter les artefacts flottants)
    let newAllocs: { breakdownId: string; amount: number; feeType: string }[] = [];
    let unallocatedAmount = 0;
    if (oldAllocs.length > 0 && oldAllocTotal > 0) {
      const factor = newAmount / oldAllocTotal;
      const cents = oldAllocs.map((a) => ({ ...a, cents: Math.round(a.amount * 100 * factor) }));
      let diff = Math.round(newAmount * 100) - cents.reduce((s, c) => s + c.cents, 0);
      // Reporter l'arrondi sur la plus grosse ligne (stable, déterministe)
      if (diff !== 0 && cents.length > 0) {
        const biggest = [...cents].sort((a, b) => b.cents - a.cents)[0];
        biggest.cents += diff;
      }
      newAllocs = cents.map((c) => ({ breakdownId: c.breakdownId, amount: c.cents / 100, feeType: c.feeType }));
    } else if (oldAllocs.length === 0 && newAmount > 0) {
      // Paiement historique sans imputations (argent flottant / import) → reste flottant
      unallocatedAmount = newAmount;
    }

    // ── Transaction atomique : réversion + ré-imputation + UPDATE + soldes ──
    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Réverser les anciennes imputations sur les breakdowns
        for (const alloc of original.allocations) {
          const amt = Number(alloc.amount);
          await tx.accountBreakdown.update({
            where: { id: alloc.accountBreakdownId },
            data: {
              paidAmount: { decrement: amt },
              remainingAmount: { increment: amt },
            },
          });
        }

        // 2. Supprimer les anciennes lignes d'allocation
        if (original.allocations.length > 0) {
          await tx.financeTransactionAllocation.deleteMany({
            where: { financeTransactionId: original.id },
          });
        }

        // 3. Ré-imputer au prorata (plafonné au restant dû — le reliquat éventuel flotte,
        //    même comportement que la cascade de create())
        const applied: { breakdownId: string; amount: number; feeType: string }[] = [];
        if (newAllocs.length > 0) {
          const freshBreakdowns = await tx.accountBreakdown.findMany({
            where: { studentAccountId: original.studentAccountId },
            select: { id: true, remainingAmount: true },
          });
          const remainingById = new Map<string, number>(
            freshBreakdowns.map((b: any) => [String(b.id), Number(b.remainingAmount)] as [string, number]),
          );
          for (const na of newAllocs) {
            const room = remainingById.get(na.breakdownId);
            if (room == null) {
              // Breakdown disparu (frais supprimé en cascade ?) → la part flotte
              unallocatedAmount += na.amount;
              continue;
            }
            const pay = Math.min(na.amount, room);
            if (pay > 0.005) {
              await tx.accountBreakdown.update({
                where: { id: na.breakdownId },
                data: {
                  paidAmount: { increment: pay },
                  remainingAmount: { decrement: pay },
                },
              });
              applied.push({ ...na, amount: pay });
              remainingById.set(na.breakdownId, room - pay);
              if (pay < na.amount - 0.005) {
                unallocatedAmount += na.amount - pay;
              }
            } else {
              unallocatedAmount += na.amount;
            }
          }
          if (applied.length > 0) {
            await tx.financeTransactionAllocation.createMany({
              data: applied.map((a) => ({
                financeTransactionId: original.id,
                accountBreakdownId: a.breakdownId,
                amount: a.amount,
              })),
            });
          }
        }

        // 4. UPDATE de la transaction — hash d'intégrité recalculé EN SQL avec
        //    l'expression EXACTE du trigger verify_integrity_hash (pgcrypto) :
        //    stored_hash == expected_hash → validation passée, hash rafraîchi.
        const newAllocsByFeeType: Record<string, number> = {};
        for (const a of applied) {
          newAllocsByFeeType[a.feeType] = (newAllocsByFeeType[a.feeType] ?? 0) + a.amount;
        }
        await tx.$executeRawUnsafe(
          `UPDATE "finance_transactions"
           SET
             "amount"        = $2::numeric(10,2),
             "paymentMethod" = $3::"PaymentMethod",
             "reference"     = $4,
             "createdAt"     = $5::timestamptz,
             "cashRegisterId" = $6,
             "tenderedAmount" = $7,
             "changeGiven"   = $8,
             "integrityHash" = COALESCE(
               encode(digest(
                 "tenantId" || '|' || "studentAccountId" || '|' ||
                 $2::numeric(10,2)::text || '|' ||
                 "type"::text || '|' ||
                 $5::timestamptz::text,
                 'sha256'
               ), 'hex'),
               "integrityHash"
             )
           WHERE "id" = $1`,
          original.id,
          newAmount,
          newMethod,
          newReference,
          newCreatedAt.toISOString(),
          newCashRegisterId,
          newTendered,
          newChange,
        );

        // 5. Solde du compte élève : le trigger ne réagit qu'aux INSERT →
        //    ajustement manuel du delta (bypass contrôlé app.allow_balance_update)
        const delta = newAmount - oldAmount;
        if (Math.abs(delta) > 0.005) {
          await tx.$executeRawUnsafe(`SET LOCAL app.allow_balance_update = 'true'`);
          const account: any = await tx.studentAccount.findUnique({
            where: { id: original.studentAccountId },
            select: { balance: true, totalDue: true, totalPaid: true, isBlocked: true },
          });
          const newBalance = Number(account.balance) - delta;
          const newStatus = account.isBlocked
            ? AccountStatus.BLOCKED
            : newBalance <= 0.005
              ? AccountStatus.PAID
              : newBalance < Number(account.totalDue) - 0.005
                ? AccountStatus.PARTIAL
                : AccountStatus.ACTIVE;
          await tx.studentAccount.update({
            where: { id: original.studentAccountId },
            data: {
              totalPaid: { increment: delta },
              balance: { decrement: delta },
              status: newStatus,
            },
          });
        }

        // 6. Caisses : ajuster du delta (ou transférer si caisse changée)
        if (!isFedapay) {
          if (newCashRegisterId === (original.cashRegisterId ?? null)) {
            if (original.cashRegisterId && Math.abs(delta) > 0.005) {
              await tx.cashRegister.update({
                where: { id: original.cashRegisterId },
                data: { currentBalance: { increment: delta } },
              });
            }
          } else {
            if (original.cashRegisterId) {
              await tx.cashRegister.update({
                where: { id: original.cashRegisterId },
                data: { currentBalance: { decrement: oldAmount } },
              });
            }
            if (newCashRegisterId) {
              await tx.cashRegister.update({
                where: { id: newCashRegisterId },
                data: { currentBalance: { increment: newAmount } },
              });
            }
          }
        } else if (Math.abs(delta) > 0.005) {
          // FEDAPAY : la caisse ONLINE porte le volume total → delta simple ;
          // les caisses métier suivent via les allocations automatiques.
          if (original.cashRegisterId) {
            await tx.cashRegister.update({
              where: { id: original.cashRegisterId },
              data: { currentBalance: { increment: delta } },
            });
          }
          const oldByType: Record<string, number> = {};
          for (const a of oldAllocs) {
            oldByType[a.feeType] = (oldByType[a.feeType] ?? 0) + a.amount;
          }
          await this.adjustFedapayAutoAllocations(tx, tenantId, original.id, oldByType, newAllocsByFeeType);
        }

        // 7. Trace d'audit
        await tx.financialAuditLog.create({
          data: {
            tenantId,
            entityType: 'FinanceTransaction',
            entityId: original.id,
            action: 'UPDATE',
            oldValue: {
              amount: oldAmount,
              paymentMethod: original.paymentMethod,
              reference: original.reference,
              createdAt: original.createdAt,
              cashRegisterId: original.cashRegisterId,
              allocations: oldAllocs.map((a) => ({ breakdownId: a.breakdownId, amount: a.amount })),
            },
            newValue: {
              amount: newAmount,
              paymentMethod: newMethod,
              reference: newReference,
              createdAt: newCreatedAt,
              cashRegisterId: newCashRegisterId,
              allocations: applied.map((a) => ({ breakdownId: a.breakdownId, amount: a.amount })),
              unallocatedAmount,
            },
            performedById: user?.id ?? '',
          },
        });
      });
    } catch (err: any) {
      this.logger.error(`update transaction ${transactionId} failed: ${err?.message}`);
      this.friendlyTriggerError(err, `Échec de la modification : ${err?.message || 'erreur inconnue'}`);
    }

    // 8. Régénérer le reçu PDF (fire-and-forget — le PDF reflète les nouveaux montants)
    this.receiptFinanceService
      .generateForTransaction(original.id, tenantId)
      .then(() => this.logger.log(`Reçu ${original.receiptNumber} régénéré après édition (promoteur)`))
      .catch((err) => this.logger.warn(`Reçu ${original.receiptNumber} non régénéré: ${err?.message}`));

    const updated: any = await this.prisma.financeTransaction.findUnique({
      where: { id: original.id },
      include: {
        studentAccount: { include: { student: true } },
        allocations: true,
        cashRegister: { select: { id: true, code: true, name: true } },
      },
    });
    return {
      ...(updated ?? {}),
      unallocatedAmount,
      warning: unallocatedAmount > 0.005
        ? `${unallocatedAmount.toLocaleString('fr-FR')} FCFA ne sont plus imputés à des frais précis (restant dû insuffisant) — ils restent comptés comme payés sur le compte.`
        : undefined,
    };
  }

  /**
   * ⭐ SUPPRIMER UN ENCAISSEMENT (promoteur uniquement — garde dans le controller).
   * Suppression physique exceptionnelle : réverse imputations, soldes, caisses,
   * trace d'audit, puis supprime la transaction (flag session contrôlé).
   */
  async remove(
    tenantId: string,
    transactionId: string,
    user: any,
    reason: string,
  ) {
    const original = await this.loadEditableTransaction(tenantId, transactionId);
    const amount = Number(original.amount);
    const isFedapay = original.paymentMethod === ('FEDAPAY' as any) || original.paymentMethod === ('FEEXPAY' as any);

    const oldAllocs = original.allocations.map((a: any) => ({
      breakdownId: a.accountBreakdownId,
      amount: Number(a.amount),
      feeType: String(a.accountBreakdown?.feeStructure?.feeType ?? 'OTHER'),
    }));
    const allocTotal = oldAllocs.reduce((s, a) => s + a.amount, 0);
    const unallocatedAmount = amount - allocTotal; // part FIFO/flottante non tracée dans les allocations

    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Réverser les imputations sur les breakdowns
        for (const alloc of original.allocations) {
          const amt = Number(alloc.amount);
          await tx.accountBreakdown.update({
            where: { id: alloc.accountBreakdownId },
            data: {
              paidAmount: { decrement: amt },
              remainingAmount: { increment: amt },
            },
          });
        }

        // 2. Supprimer les lignes d'allocation
        if (original.allocations.length > 0) {
          await tx.financeTransactionAllocation.deleteMany({
            where: { financeTransactionId: original.id },
          });
        }

        // 3. Solde du compte : réverser le montant (trigger INSERT-only → manuel)
        await tx.$executeRawUnsafe(`SET LOCAL app.allow_balance_update = 'true'`);
        const account: any = await tx.studentAccount.findUnique({
          where: { id: original.studentAccountId },
          select: { balance: true, totalDue: true, isBlocked: true },
        });
        const newBalance = Number(account.balance) + amount;
        const newStatus = account.isBlocked
          ? AccountStatus.BLOCKED
          : newBalance <= 0.005
            ? AccountStatus.PAID
            : newBalance < Number(account.totalDue) - 0.005
              ? AccountStatus.PARTIAL
              : AccountStatus.ACTIVE;
        await tx.studentAccount.update({
          where: { id: original.studentAccountId },
          data: {
            totalPaid: { decrement: amount },
            balance: { increment: amount },
            status: newStatus,
          },
        });

        // 4. Caisses : réverser le crédit
        if (!isFedapay) {
          if (original.cashRegisterId) {
            await tx.cashRegister.update({
              where: { id: original.cashRegisterId },
              data: { currentBalance: { decrement: amount } },
            });
          }
        } else {
          // FEDAPAY : débiter la caisse ONLINE du montant total + réverser les
          // allocations automatiques vers les caisses métier (transferts AUTO)
          if (original.cashRegisterId) {
            await tx.cashRegister.update({
              where: { id: original.cashRegisterId },
              data: { currentBalance: { decrement: amount } },
            });
          }
          const idPrefix = `AUTO-${original.id.substring(0, 8)}-`;
          const transfers: any[] = await tx.$queryRawUnsafe(
            `SELECT "id", "toCashRegisterId", "amount" FROM "cash_register_transfers"
             WHERE "tenantId" = $1 AND "status" = 'AUTO_ALLOCATION' AND "reference" LIKE $2`,
            tenantId, `${idPrefix}%`,
          ).catch(() => [] as any[]);
          for (const t of transfers) {
            await tx.cashRegister.update({
              where: { id: t.toCashRegisterId },
              data: { currentBalance: { decrement: Number(t.amount) } },
            });
            await tx.$executeRawUnsafe(`DELETE FROM "cash_register_transfers" WHERE "id" = $1`, t.id);
          }
        }

        // 5. Trace d'audit (AVANT la suppression — snapshot complet)
        await tx.financialAuditLog.create({
          data: {
            tenantId,
            entityType: 'FinanceTransaction',
            entityId: original.id,
            action: 'DELETE',
            oldValue: {
              receiptNumber: original.receiptNumber,
              amount,
              paymentMethod: original.paymentMethod,
              reference: original.reference,
              createdAt: original.createdAt,
              cashRegisterId: original.cashRegisterId,
              studentAccountId: original.studentAccountId,
              academicYearId: original.academicYearId,
              allocations: oldAllocs.map((a) => ({ breakdownId: a.breakdownId, amount: a.amount })),
              unallocatedAmount,
              reason,
            },
            newValue: null,
            performedById: user?.id ?? '',
          },
        });

        // 6. Suppression physique — flag session posé par le service promoteur
        //    (le trigger prevent_finance_transaction_delete l'autorise)
        await tx.$executeRawUnsafe(`SET LOCAL app.allow_transaction_delete = 'true'`);
        await tx.financeTransaction.delete({ where: { id: original.id } });
      });
    } catch (err: any) {
      this.logger.error(`delete transaction ${transactionId} failed: ${err?.message}`);
      this.friendlyTriggerError(err, `Échec de la suppression : ${err?.message || 'erreur inconnue'}`);
    }

    // 7. Nettoyer le fichier reçu PDF (best effort, après commit)
    //    Convention de ReceiptFinanceService : uploads/receipts/<tenant>/<année>/receipt-<n°>.pdf
    try {
      const receiptPath = path.join(
        process.cwd(), 'uploads', 'receipts', tenantId, original.academicYearId,
        `receipt-${original.receiptNumber.replace(/[/\\?%*:|"<>]/g, '-')}.pdf`,
      );
      if (fs.existsSync(receiptPath)) {
        fs.unlinkSync(receiptPath);
        this.logger.log(`Reçu PDF supprimé: ${receiptPath}`);
      }
    } catch (e: any) {
      this.logger.warn(`Reçu PDF non supprimé: ${e?.message}`);
    }

    return {
      success: true,
      deleted: true,
      receiptNumber: original.receiptNumber,
      amount,
      unallocatedAmount,
    };
  }
}
