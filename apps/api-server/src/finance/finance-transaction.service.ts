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
import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionType, PaymentMethod } from '@prisma/client';
import { ReceiptFinanceService } from './receipt-finance.service';
import { ReceiptNotificationFinanceService } from './receipt-notification-finance.service';
import { ArrearAccumulationService } from './arrear-accumulation.service';

const PRIORITY_ORDER = ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'OTHER'];
const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'MOBILE_MONEY', 'WIRE', 'FEDAPAY'];

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
      deviceId?: string;
      receiptUrl?: string;
      cashRegisterId?: string;  // ← NOUVEAU : caisse utilisée pour ce paiement
      // ⭐ Espèces : montant remis par le client + reliquat rendu (pour traçabilité reçu)
      tenderedAmount?: number;  // Montant remis (ex: 50000 pour un paiement de 45000)
      changeGiven?: number;     // Reliquat rendu (ex: 5000)
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

    // ─── PHASE 3 : Paiement FIFO — solder d'abord les arriérés anciens ───
    // Avant d'allouer le paiement aux AccountBreakdown de l'année en cours,
    // on solde d'abord les FeeArrear des années antérieures (FIFO).
    // Le montant restant après cette étape sera alloué aux frais de l'année.
    if (remaining > 0) {
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

    const sortedBreakdowns = [...account.breakdowns].sort((a, b) => {
      const ia = PRIORITY_ORDER.indexOf(a.feeStructure.feeType);
      const ib = PRIORITY_ORDER.indexOf(b.feeStructure.feeType);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    for (const b of sortedBreakdowns) {
      if (remaining <= 0) break;
      const rem = Number(b.remainingAmount);
      if (rem <= 0) continue;
      const pay = Math.min(remaining, rem);
      updates.push({
        breakdownId: b.id,
        paidDelta: pay,
        remainingDelta: -pay,
        feeType: b.feeStructure.feeType,
      });
      remaining -= pay;
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
        // Envoyer automatiquement les notifications (email + WhatsApp + SMS)
        // Fire-and-forget — ne bloque jamais la réponse API
        return this.receiptNotificationService.sendReceiptNotifications(
          tx.id,
          tenantId,
          ['email', 'whatsapp', 'sms'],
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
      page?: number;
      limit?: number;
    },
  ) {
    const where: any = { tenantId };
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.studentAccountId) where.studentAccountId = filters.studentAccountId;
    if (filters.type) where.type = filters.type;

    // ⭐ Pagination optionnelle : si page/limit fournis → retour paginé
    // { data, total, page, limit, totalPages }.
    // Sinon → retour array (rétro-compatibilité).
    if (filters.page && filters.limit) {
      const page = Math.max(1, filters.page);
      const limit = Math.min(500, Math.max(1, filters.limit));
      const [data, total] = await Promise.all([
        this.prisma.financeTransaction.findMany({
          where,
          include: { studentAccount: { include: { student: true } } },
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
      include: { studentAccount: { include: { student: true } } },
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
