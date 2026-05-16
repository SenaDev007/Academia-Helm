import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ShopOrderStatus, StockMovementType, PurchaseOrderStatus, WalletTxType } from '@prisma/client';

/**
 * Service pour le sous-module 9.6 - Boutique & Économat (Academia Helm)
 * Gère l'intégralité des opérations de vente au détail et de gestion des stocks.
 */
@Injectable()
export class ShopService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // CATALOGUE PRODUITS
  // ============================================================================

  async createProduct(tenantId: string, academicYearId: string, data: any) {
    const product = await this.prisma.shopProduct.create({
      data: {
        tenantId,
        academicYearId,
        categoryId: data.categoryId,
        code: data.code,
        name: data.name,
        description: data.description,
        unitPrice: data.unitPrice,
        costPrice: data.costPrice,
        taxRate: data.taxRate || 0,
        minStock: data.minStock || 5,
        maxStock: data.maxStock,
        imageUrl: data.imageUrl,
        isActive: true,
        stock: {
          create: {
            tenantId,
            quantity: data.initialStock || 0,
            location: data.location,
          }
        }
      },
      include: { stock: true, category: true }
    });

    if (data.initialStock > 0) {
      await this.prisma.shopStockMovement.create({
        data: {
          tenantId,
          productId: product.id,
          type: StockMovementType.IN,
          quantity: data.initialStock,
          reason: 'INITIAL_STOCK',
        }
      });
    }

    return product;
  }

  async findAllProducts(tenantId: string, academicYearId: string, filters?: any) {
    const where: any = { tenantId, academicYearId, isActive: true };
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return this.prisma.shopProduct.findMany({
      where,
      include: { stock: true, category: true },
      orderBy: { name: 'asc' },
    });
  }

  async findAllCategories(tenantId: string) {
    return this.prisma.shopCategory.findMany({
      where: { tenantId },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });
  }

  async findProduct(id: string, tenantId: string) {
    const product = await this.prisma.shopProduct.findFirst({
      where: { id, tenantId },
      include: { stock: true, category: true }
    });
    if (!product) throw new NotFoundException('Produit non trouvé');
    return product;
  }

  async updateProduct(id: string, tenantId: string, data: any) {
    return this.prisma.shopProduct.update({
      where: { id },
      data: {
        ...data,
        stock: data.stock ? { update: data.stock } : undefined
      }
    });
  }

  // ============================================================================
  // VENTES & CAISSE
  // ============================================================================

  async findAllSales(tenantId: string, academicYearId: string, filters?: any) {
    const where: any = { tenantId, academicYearId };
    if (filters?.studentId) where.studentId = filters.studentId;
    if (filters?.paymentMode) where.paymentMode = filters.paymentMode;

    return this.prisma.shopSale.findMany({
      where,
      include: { items: { include: { product: true } }, student: true, seller: true },
      orderBy: { saleDate: 'desc' }
    });
  }

  async findSale(id: string, tenantId: string) {
    return this.prisma.shopSale.findFirst({
      where: { id, tenantId },
      include: { items: { include: { product: true } }, student: true, seller: true }
    });
  }

  async createSale(tenantId: string, academicYearId: string, data: any, soldBy: string) {
    // 1. Validation du stock et calculs
    let subTotal = 0;
    const saleItems = [];

    for (const item of data.items) {
      const product = await this.prisma.shopProduct.findFirst({
        where: { id: item.productId, tenantId },
        include: { stock: true }
      });

      if (!product) throw new NotFoundException(`Produit non trouvé : ${item.productId}`);
      if (!product.stock || product.stock.quantity < item.quantity) {
        throw new BadRequestException(`Stock insuffisant pour ${product.name}`);
      }

      const itemTotal = Number(item.unitPrice) * item.quantity;
      subTotal += itemTotal;
      saleItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: itemTotal,
      });
    }

    const saleCount = await this.prisma.shopSale.count({ where: { tenantId, academicYearId } });
    const saleNumber = `VTE-${new Date().getFullYear()}-${String(saleCount + 1).padStart(5, '0')}`;

    // 2. Création de la vente (Transaction Prisma)
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.shopSale.create({
        data: {
          tenantId,
          academicYearId,
          saleNumber,
          customerType: data.customerType,
          studentId: data.studentId,
          staffId: data.staffId,
          parentId: data.parentId,
          customerName: data.customerName,
          subTotal,
          taxAmount: data.taxAmount || 0,
          discountAmount: data.discountAmount || 0,
          totalAmount: subTotal + (data.taxAmount || 0) - (data.discountAmount || 0),
          paymentMode: data.paymentMode,
          paymentStatus: 'PAID',
          walletUsed: data.paymentMode === 'WALLET',
          soldBy,
          items: { create: saleItems }
        }
      });

      // 3. Mise à jour des stocks
      for (const item of saleItems) {
        await tx.shopStock.update({
          where: { productId: item.productId },
          data: { quantity: { decrement: item.quantity } }
        });

        await tx.shopStockMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            type: StockMovementType.OUT,
            quantity: item.quantity,
            reason: 'SALE',
            referenceId: sale.id,
            performedBy: soldBy
          }
        });
      }

      // 4. Gestion du Portefeuille / Fidélité
      if (data.paymentMode === 'WALLET' && data.studentId) {
        const card = await tx.shopLoyaltyCard.findUnique({ where: { studentId: data.studentId } });
        if (!card || Number(card.balance) < Number(sale.totalAmount)) {
          throw new BadRequestException('Solde portefeuille insuffisant');
        }

        await tx.shopLoyaltyCard.update({
          where: { id: card.id },
          data: { 
            balance: { decrement: sale.totalAmount },
            points: { increment: Math.floor(Number(sale.totalAmount) / 100) }
          }
        });

        await tx.shopWalletTransaction.create({
          data: {
            tenantId,
            cardId: card.id,
            type: WalletTxType.DEBIT,
            amount: sale.totalAmount,
            reference: sale.id,
            description: `Achat boutique #${saleNumber}`,
            performedBy: soldBy
          }
        });
      }

      return sale;
    });
  }

  // ============================================================================
  // GESTION DES COMMANDES (PRE-ORDERS)
  // ============================================================================

  async findAllOrders(tenantId: string, academicYearId: string, filters?: any) {
    const where: any = { tenantId, academicYearId };
    if (filters?.status) where.status = filters.status;

    return this.prisma.shopOrder.findMany({
      where,
      include: { items: { include: { product: true } }, student: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createOrder(tenantId: string, academicYearId: string, data: any) {
    const orderCount = await this.prisma.shopOrder.count({ where: { tenantId, academicYearId } });
    const orderNumber = `CMD-${new Date().getFullYear()}-${String(orderCount + 1).padStart(5, '0')}`;

    return this.prisma.shopOrder.create({
      data: {
        tenantId,
        academicYearId,
        orderNumber,
        studentId: data.studentId,
        parentId: data.parentId,
        totalAmount: data.totalAmount,
        notes: data.notes,
        status: data.status || ShopOrderStatus.PENDING,
        items: {
          create: data.items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: Number(item.unitPrice) * item.quantity
          }))
        }
      }
    });
  }

  async updateOrderStatus(id: string, tenantId: string, status: ShopOrderStatus) {
    return this.prisma.shopOrder.update({
      where: { id },
      data: { status }
    });
  }

  // ============================================================================
  // STOCKS & INVENTAIRES
  // ============================================================================

  async findAllStocks(tenantId: string, academicYearId: string) {
    return this.prisma.shopStock.findMany({
      where: { tenantId, product: { academicYearId } },
      include: { product: { include: { category: true } } },
      orderBy: { product: { name: 'asc' } }
    });
  }

  async findAllStockMovements(tenantId: string, productId?: string) {
    const where: any = { tenantId };
    if (productId) where.productId = productId;

    return this.prisma.shopStockMovement.findMany({
      where,
      include: { product: true, performer: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async updateStock(tenantId: string, data: any) {
    return this.prisma.shopStock.update({
      where: { productId: data.productId },
      data: { quantity: data.quantity, location: data.location }
    });
  }

  // ============================================================================
  // FOURNISSEURS & ACHATS
  // ============================================================================

  async findAllSuppliers(tenantId: string) {
    return this.prisma.shopSupplier.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' }
    });
  }

  async createSupplier(tenantId: string, data: any) {
    return this.prisma.shopSupplier.create({
      data: {
        tenantId,
        ...data
      }
    });
  }

  async findAllPurchaseOrders(tenantId: string, academicYearId: string) {
    return this.prisma.shopPurchaseOrder.findMany({
      where: { tenantId, academicYearId },
      include: { supplier: true, receiver: true },
      orderBy: { date: 'desc' }
    });
  }

  async createPurchaseOrder(tenantId: string, academicYearId: string, data: any) {
    const poCount = await this.prisma.shopPurchaseOrder.count({ where: { tenantId, academicYearId } });
    const poNumber = `ACH-${new Date().getFullYear()}-${String(poCount + 1).padStart(5, '0')}`;

    return this.prisma.shopPurchaseOrder.create({
      data: {
        tenantId,
        academicYearId,
        supplierId: data.supplierId,
        poNumber,
        totalAmount: data.totalAmount,
        notes: data.notes,
        status: PurchaseOrderStatus.PENDING
      }
    });
  }

  // ============================================================================
  // FIDÉLITÉ & PORTEFEUILLE
  // ============================================================================

  async findLoyaltyCard(tenantId: string, studentId?: string, staffId?: string) {
    const where: any = { tenantId };
    if (studentId) where.studentId = studentId;
    else if (staffId) where.staffId = staffId;
    else return null;

    return this.prisma.shopLoyaltyCard.findFirst({
      where,
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } }
    });
  }

  async rechargeWallet(tenantId: string, cardId: string, amount: number, performedBy: string, reference?: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.shopLoyaltyCard.update({
        where: { id: cardId },
        data: { balance: { increment: amount } }
      });

      return tx.shopWalletTransaction.create({
        data: {
          tenantId,
          cardId,
          type: WalletTxType.CREDIT,
          amount,
          reference,
          description: 'Rechargement portefeuille',
          performedBy
        }
      });
    });
  }

  // ============================================================================
  // ANALYTIQUE & STATISTIQUES
  // ============================================================================

  async getShopStats(tenantId: string, academicYearId: string) {
    const products = await this.prisma.shopProduct.findMany({
      where: { tenantId, academicYearId },
      include: { stock: true }
    });

    const sales = await this.prisma.shopSale.findMany({
      where: { tenantId, academicYearId, saleDate: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) } }
    });

    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const lowStockCount = products.filter(p => p.stock && p.stock.quantity <= p.minStock).length;

    return {
      totalProducts: products.length,
      totalSalesMonth: sales.length,
      totalRevenueMonth: totalRevenue,
      lowStockAlerts: lowStockCount,
      inventoryValue: products.reduce((sum, p) => sum + (Number(p.costPrice || 0) * (p.stock?.quantity || 0)), 0),
      topProducts: [], // To be implemented with aggregation if needed
      salesByMode: {} // To be implemented with aggregation if needed
    };
  }

  // ============================================================================
  // RETOURS & ÉCHANGES
  // ============================================================================

  async findAllReturns(tenantId: string, academicYearId: string) {
    return this.prisma.shopReturn.findMany({
      where: { tenantId, academicYearId },
      include: { product: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createReturn(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.$transaction(async (tx) => {
      const shopReturn = await tx.shopReturn.create({
        data: {
          tenantId,
          academicYearId,
          saleId: data.saleId,
          orderId: data.orderId,
          productId: data.productId,
          quantity: data.quantity,
          reason: data.reason,
          status: 'REQUESTED',
          refundAmount: data.refundAmount || 0
        }
      });

      return shopReturn;
    });
  }

  async updateReturnStatus(id: string, tenantId: string, status: string) {
    return this.prisma.$transaction(async (tx) => {
      const shopReturn = await tx.shopReturn.update({
        where: { id },
        data: { status }
      });

      // Si le retour est complété, on réintègre le stock
      if (status === 'COMPLETED') {
        await tx.shopStock.update({
          where: { productId: shopReturn.productId },
          data: { quantity: { increment: shopReturn.quantity } }
        });

        await tx.shopStockMovement.create({
          data: {
            tenantId,
            productId: shopReturn.productId,
            type: StockMovementType.RETURN,
            quantity: shopReturn.quantity,
            reason: `RETOUR #${shopReturn.id}`,
          }
        });
      }

      return shopReturn;
    });
  }

  // ============================================================================
  // KITS SCOLAIRES
  // ============================================================================

  async findAllKits(tenantId: string, academicYearId: string) {
    return this.prisma.shopSchoolKit.findMany({
      where: { tenantId, academicYearId },
      include: { items: { include: { product: true } }, schoolLevel: true },
      orderBy: { name: 'asc' }
    });
  }

  async createKit(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.shopSchoolKit.create({
      data: {
        tenantId,
        academicYearId,
        name: data.name,
        schoolLevelId: data.schoolLevelId,
        price: data.price,
        description: data.description,
        isMandatory: data.isMandatory || false,
        items: {
          create: data.items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity || 1
          }))
        }
      },
      include: { items: true }
    });
  }

  // ============================================================================
  // LIVRAISONS & RETRAITS
  // ============================================================================

  async findAllDeliveries(tenantId: string, academicYearId: string) {
    return this.prisma.shopDelivery.findMany({
      where: { tenantId, academicYearId },
      include: { order: { include: { student: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createDelivery(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.shopDelivery.create({
      data: {
        tenantId,
        academicYearId,
        orderId: data.orderId,
        deliveryMode: data.deliveryMode,
        recipientName: data.recipientName,
        status: 'PENDING'
      }
    });
  }

  async updateDeliveryStatus(id: string, status: string, notes?: string) {
    return this.prisma.shopDelivery.update({
      where: { id },
      data: { 
        status, 
        notes,
        deliveredAt: status === 'DELIVERED' ? new Date() : undefined
      }
    });
  }

  // ============================================================================
  // REMISES & PROMOTIONS
  // ============================================================================

  async findAllDiscounts(tenantId: string, academicYearId: string) {
    return this.prisma.shopDiscount.findMany({
      where: { tenantId, academicYearId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createDiscount(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.shopDiscount.create({
      data: {
        tenantId,
        academicYearId,
        name: data.name,
        type: data.type,
        value: data.value,
        code: data.code,
        startDate: data.startDate,
        endDate: data.endDate
      }
    });
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  async getSettings(tenantId: string) {
    return this.prisma.shopSettings.findUnique({ where: { tenantId } });
  }

  async updateSettings(tenantId: string, data: any) {
    return this.prisma.shopSettings.upsert({
      where: { tenantId },
      update: data,
      create: { tenantId, ...data }
    });
  }
}
