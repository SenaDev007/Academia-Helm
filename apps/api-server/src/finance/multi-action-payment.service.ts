/**
 * ============================================================================
 * MULTI-ACTION PAYMENT SERVICE
 * ============================================================================
 *
 * Permet d'encaisser en une seule opération :
 *   - Les frais scolaires (imputés sur les AccountBreakdowns via FinanceTransaction)
 *   - Des articles de boutique (uniforme, tenue de sport, fournitures…) via ShopSale
 *
 * Le lien entre les deux est assuré par :
 *   - ShopSale.notes = `MULTI_ACTION_TX:{financeTransactionId}` (côté boutique)
 *   - FinanceTransaction.reference peut contenir une référence externe (FedaPay…)
 *
 * Le reçu PDF généré par ReceiptFinanceService détecte la ShopSale liée
 * et affiche une section "Articles Boutique" en plus des frais scolaires.
 *
 * Utilisé par le modal "Nouveau paiement" du module Finance quand l'utilisateur
 * ajoute des articles boutique au panier.
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FinanceTransactionService } from './finance-transaction.service';
import { StockMovementType } from '@prisma/client';
import { AppSequenceService } from '../common/services/app-sequence.service';

export interface MultiActionItem {
  productId: string;
  quantity: number;
  // unitPrice est optionnel — si non fourni, on utilise le prix du produit
  unitPrice?: number;
}

export interface MultiActionPaymentInput {
  academicYearId: string;
  studentAccountId: string;
  // Montant alloué aux frais scolaires (peut être 0 si que de la boutique)
  feeAmount: number;
  // Articles boutique à vendre (peut être vide si que des frais)
  shopItems: MultiActionItem[];
  paymentMethod: 'CASH' | 'FEDAPAY' | 'MOBILE_MONEY' | 'WIRE' | string;
  reference?: string;
  cashierId: string;
  deviceId?: string;
  cashRegisterId?: string;
  // Métadonnées optionnelles (client, observation…)
  customerName?: string;
  notes?: string;
  // ⭐ Espèces : montant remis par le client + reliquat (pour traçabilité reçu)
  // Le total encaissé = feeAmount + shopAmount. Le reliquat est calculé sur ce total.
  tenderedAmount?: number;
  changeGiven?: number;
  // ⭐ RÉPARTITION MANUELLE (flexibilité sept. 2026) : imputations explicites
  //    sur les AccountBreakdown (section frais généraux + répartition
  //    personnalisée du NewPaymentModal). Le feeAmount doit couvrir la somme.
  manualAllocations?: { accountBreakdownId: string; amount: number }[];
  // ⭐ FRAIS GÉNÉRAUX À LA CARTE (sept. 2026) : frais généraux choisis dans le
  //    catalogue (pattern « articles boutique ») — breakdowns créés à la volée
  //    par FinanceTransactionService.create puis imputés explicitement.
  generalFeeAddOns?: { feeStructureId: string; amount: number }[];
}

export interface MultiActionResult {
  transaction: any;
  shopSale: any | null;
  totalAmount: number;
  feeAmount: number;
  shopAmount: number;
}

@Injectable()
export class MultiActionPaymentService {
  private readonly logger = new Logger(MultiActionPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeTransactionService: FinanceTransactionService,
    private readonly appSequences: AppSequenceService,
  ) {}

  /**
   * Crée une FinanceTransaction pour les frais + une ShopSale pour les articles boutique,
   * le tout dans une transaction Prisma pour garantir l'atomicité.
   *
   * Le montant de la FinanceTransaction = feeAmount
   * Le montant de la ShopSale = somme des articles boutique
   * Le total encaissé = feeAmount + shopAmount
   *
   * Le reçu PDF affichera les deux sections.
   */
  async createMultiAction(
    tenantId: string,
    input: MultiActionPaymentInput,
  ): Promise<MultiActionResult> {
    const {
      academicYearId,
      studentAccountId,
      feeAmount,
      shopItems,
      paymentMethod,
      reference,
      cashierId,
      deviceId,
      cashRegisterId,
      customerName,
      notes,
      tenderedAmount,
      changeGiven,
      manualAllocations,
      generalFeeAddOns,
    } = input;

    // ─── Validation ───
    if (feeAmount < 0) {
      throw new BadRequestException('Le montant des frais ne peut pas être négatif');
    }
    if (!shopItems || shopItems.length === 0) {
      if (feeAmount <= 0) {
        throw new BadRequestException(
          'Aucun article boutique et aucun montant de frais — rien à encaisser',
        );
      }
      // Pas d'articles boutique → fallback vers create() standard
      const tx = await this.financeTransactionService.create(tenantId, {
        academicYearId,
        studentAccountId,
        amount: feeAmount,
        paymentMethod,
        reference,
        cashierId,
        deviceId,
        cashRegisterId,
        tenderedAmount,
        changeGiven,
        manualAllocations,
        generalFeeAddOns,
      });
      return {
        transaction: tx,
        shopSale: null,
        totalAmount: feeAmount,
        feeAmount,
        shopAmount: 0,
      };
    }

    // ─── 1. Valider le compte élève ───
    const account = await this.prisma.studentAccount.findFirst({
      where: { id: studentAccountId, tenantId },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!account) {
      throw new NotFoundException('Compte élève introuvable');
    }

    // ─── 2. Valider les produits + calculer le total boutique ───
    const validatedItems: {
      productId: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      product: any;
    }[] = [];

    let shopSubTotal = 0;
    for (const item of shopItems) {
      if (item.quantity <= 0) {
        throw new BadRequestException(`Quantité invalide pour le produit ${item.productId}`);
      }
      const product = await this.prisma.shopProduct.findFirst({
        where: { id: item.productId, tenantId, isActive: true },
        include: { stock: true },
      });
      if (!product) {
        throw new NotFoundException(`Produit boutique introuvable : ${item.productId}`);
      }
      if (!product.stock || product.stock.quantity < item.quantity) {
        throw new BadRequestException(
          `Stock insuffisant pour "${product.name}" (disponible: ${product.stock?.quantity ?? 0}, demandé: ${item.quantity})`,
        );
      }
      const unitPrice = item.unitPrice != null
        ? Number(item.unitPrice)
        : Number(product.unitPrice);
      const totalPrice = unitPrice * item.quantity;
      shopSubTotal += totalPrice;
      validatedItems.push({ productId: product.id, quantity: item.quantity, unitPrice, totalPrice, product });
    }

    const shopAmount = shopSubTotal;

    // ─── 3. Créer la FinanceTransaction pour les frais (si feeAmount > 0) ───
    // ⭐ Pour le multi-action, tenderedAmount et changeGiven sont stockés sur la
    // FinanceTransaction (même si elle ne représente que les frais) car c'est le
    // reçu principal qui sera généré. Le reliquat est calculé sur le TOTAL
    // encaissé (feeAmount + shopAmount), pas juste sur feeAmount.
    let financeTx: any = null;
    if (feeAmount > 0) {
      financeTx = await this.financeTransactionService.create(tenantId, {
        academicYearId,
        studentAccountId,
        amount: feeAmount,
        paymentMethod,
        reference: reference
          ? `${reference}|MULTI_ACTION`
          : undefined,
        cashierId,
        deviceId,
        cashRegisterId,
        // ⭐ Espèces : tenderedAmount + changeGiven sont sur le total combiné
        // (frais + boutique). Le backend re-calculera changeGiven à partir de
        // amount=feeAmount, ce qui serait incorrect pour le multi-action.
        // On passe donc tenderedAmount uniquement, et on calcule changeGiven
        // nous-mêmes sur le total combiné, puis on l'envoie pour qu'il soit stocké.
        tenderedAmount: tenderedAmount != null ? Number(tenderedAmount) : undefined,
        changeGiven: (tenderedAmount != null && changeGiven != null)
          ? Number(changeGiven)
          : (tenderedAmount != null ? Math.max(0, Number(tenderedAmount) - feeAmount - shopSubTotal) : undefined),
        manualAllocations,
        generalFeeAddOns,
      });
      this.logger.log(
        `Multi-action: FinanceTransaction ${financeTx.receiptNumber} créée pour ${feeAmount} FCFA de frais` +
        (tenderedAmount ? ` (montant remis: ${tenderedAmount}, reliquat: ${changeGiven ?? 0})` : ''),
      );
    }

    // ─── 4. Créer la ShopSale + items + mettre à jour le stock ───
    // ⭐ BRIEF PERF 3.3 — numéro de vente ATOMIQUE via app_sequences.
    // Avant : shopSale.count() + 1 — deux ventes simultanées obtenaient le
    // même saleNumber (read-modify-write). Init au count existant (max).
    const saleYear = new Date().getFullYear();
    const saleCount = await this.appSequences.next(tenantId, `SHOPSALE:${saleYear}`, {
      initFrom: () => this.prisma.shopSale.count({ where: { tenantId, academicYearId } }),
    });
    const saleNumber = `VTE-${saleYear}-${String(saleCount).padStart(5, '0')}`;

    const studentName = account.student
      ? `${account.student.lastName} ${account.student.firstName}`
      : customerName || 'Client';

    const shopSale = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.shopSale.create({
        data: {
          tenantId,
          academicYearId,
          saleNumber,
          customerType: 'STUDENT',
          studentId: account.studentId,
          customerName: studentName,
          subTotal: shopSubTotal,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: shopSubTotal,
          paymentMode: paymentMethod,
          paymentStatus: 'PAID',
          walletUsed: false,
          soldBy: cashierId,
          notes: notes
            ? `MULTI_ACTION_TX:${financeTx?.id || 'NO_TX'}|${notes}`.substring(0, 500)
            : `MULTI_ACTION_TX:${financeTx?.id || 'NO_TX'}`,
          items: {
            create: validatedItems.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              totalPrice: it.totalPrice,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      // Mettre à jour le stock + créer les mouvements
      for (const it of validatedItems) {
        await tx.shopStock.update({
          where: { productId: it.productId },
          data: { quantity: { decrement: it.quantity } },
        });

        await tx.shopStockMovement.create({
          data: {
            tenantId,
            productId: it.productId,
            type: StockMovementType.OUT,
            quantity: it.quantity,
            reason: `MULTI_ACTION_SALE:${sale.id}`,
            referenceId: financeTx?.id,
            performedBy: cashierId,
          },
        });
      }

      return sale;
    });

    this.logger.log(
      `Multi-action: ShopSale ${shopSale.saleNumber} créée pour ${shopAmount} FCFA d'articles boutique` +
      (financeTx ? ` (liée à ${financeTx.receiptNumber})` : ''),
    );

    // ─── 5. Retourner le résultat agrégé ───
    const totalAmount = feeAmount + shopAmount;

    return {
      transaction: financeTx,
      shopSale,
      totalAmount,
      feeAmount,
      shopAmount,
    };
  }

  /**
   * Récupère la ShopSale liée à une FinanceTransaction (via notes).
   * Utilisé par ReceiptFinanceService pour afficher les articles boutique dans le reçu.
   */
  async findShopSaleByTransactionId(transactionId: string): Promise<any | null> {
    const sale = await this.prisma.shopSale.findFirst({
      where: {
        notes: { contains: `MULTI_ACTION_TX:${transactionId}` },
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, code: true, imageUrl: true },
            },
          },
        },
      },
    });
    return sale;
  }

  /**
   * Liste toutes les ventes boutique d'un tenant pour une année académique.
   * Utilisé par l'onglet "Encaissements" du module Finance pour afficher
   * les ventes boutique à côté des FinanceTransactions.
   */
  async findAllShopSalesForFinance(
    tenantId: string,
    academicYearId: string,
    filters?: {
      studentId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const where: any = { tenantId, academicYearId };
    if (filters?.studentId) where.studentId = filters.studentId;
    if (filters?.startDate || filters?.endDate) {
      where.saleDate = {};
      if (filters?.startDate) where.saleDate.gte = filters.startDate;
      if (filters?.endDate) where.saleDate.lte = filters.endDate;
    }

    return this.prisma.shopSale.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        student: {
          select: { id: true, firstName: true, lastName: true, matricule: true },
        },
      },
      orderBy: { saleDate: 'desc' },
    });
  }
}
