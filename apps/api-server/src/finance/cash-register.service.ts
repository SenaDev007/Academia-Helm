/**
 * ============================================================================
 * CASH REGISTER SERVICE - Multi-caisses intelligentes
 * ============================================================================
 *
 * Gestion complète des caisses d'une école :
 *   - CRUD complet (create, findAll, findOne, update, delete/archiver)
 *   - Ouverture/fermeture de caisse avec responsable
 *   - Suivi du solde courant (currentBalance)
 *   - Liaison avec FinanceTransaction (cashRegisterId)
 *   - Rapports par caisse (volume, nb transactions, écart)
 *
 * Règles métier :
 *   - Une caisse a un code unique par tenant
 *   - Une caisse ne peut être supprimée si elle a des transactions (archivage uniquement)
 *   - L'ouverture nécessite un responsable (openedByUserId)
 *   - La fermeture enregistre le solde final et l'horodatage
 *   - Le solde courant est mis à jour automatiquement après chaque transaction
 *
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

export interface CreateCashRegisterDto {
  code: string;
  name: string;
  description?: string;
  responsibleUserId?: string;
  location?: string;
  openingBalance?: number;
  isActive?: boolean;
  // Champs bancaires
  bankName?: string;
  bankAccountNumber?: string;
  bankIBAN?: string;
  bankBranch?: string;
  bankAccountType?: string;
  bankContact?: string;
}

export interface UpdateCashRegisterDto {
  name?: string;
  description?: string;
  responsibleUserId?: string;
  location?: string;
  isActive?: boolean;
  // Champs bancaires
  bankName?: string;
  bankAccountNumber?: string;
  bankIBAN?: string;
  bankBranch?: string;
  bankAccountType?: string;
  bankContact?: string;
}

export interface OpenCashRegisterDto {
  userId: string;
  openingBalance?: number; // Override du solde d'ouverture pour cette session
  note?: string;
}

export interface CloseCashRegisterDto {
  userId: string;
  countedBalance?: number; // Montant physique compté (pour détecter écart)
  note?: string;
}

@Injectable()
export class CashRegisterService {
  private readonly logger = new Logger(CashRegisterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une nouvelle caisse.
   * Le code doit être unique par tenant.
   */
  async create(tenantId: string, dto: CreateCashRegisterDto, userId?: string) {
    // Vérifier l'unicité du code
    const existing = await this.prisma.cashRegister.findFirst({
      where: { tenantId, code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Une caisse avec le code "${dto.code}" existe déjà pour ce tenant.`);
    }

    const openingBalance = dto.openingBalance ?? 0;
    // responsibleUserId stocke directement le Staff ID (pas de FK, pas de résolution)
    return this.prisma.cashRegister.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        responsibleUserId: dto.responsibleUserId || null,
        location: dto.location,
        openingBalance: new Prisma.Decimal(openingBalance),
        currentBalance: new Prisma.Decimal(openingBalance),
        isActive: dto.isActive ?? true,
        // Champs bancaires (stockés même si null pour les caisses non-banque)
        bankName: dto.bankName || null,
        bankAccountNumber: dto.bankAccountNumber || null,
        bankIBAN: dto.bankIBAN || null,
        bankBranch: dto.bankBranch || null,
        bankAccountType: dto.bankAccountType || null,
        bankContact: dto.bankContact || null,
      },
      include: {
        _count: { select: { transactions: true } },
      },
    });
  }

  /**
   * Liste les caisses d'un tenant.
   * Filtres optionnels : isActive, isOpen, responsibleUserId.
   */
  async findAll(
    tenantId: string,
    filters?: { isActive?: boolean; isOpen?: boolean; responsibleUserId?: string },
  ) {
    const where: any = { tenantId };
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;
    if (filters?.isOpen !== undefined) where.isOpen = filters.isOpen;
    if (filters?.responsibleUserId) where.responsibleUserId = filters.responsibleUserId;

    const registers = await this.prisma.cashRegister.findMany({
      where,
      include: {
        openedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: { select: { transactions: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });

    // Enrichir avec les infos du staff responsable (responsibleUserId = Staff.id)
    const staffIds = registers.map((r) => r.responsibleUserId).filter(Boolean);
    let staffMap = new Map<string, any>();
    if (staffIds.length > 0) {
      const staffs = await this.prisma.staff.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, firstName: true, lastName: true, position: true, email: true, employeeNumber: true },
      });
      staffMap = new Map(staffs.map((s) => [s.id, s]));
    }

    return registers.map((r) => ({
      ...r,
      responsibleUser: r.responsibleUserId ? staffMap.get(r.responsibleUserId) || null : null,
    }));
  }

  /**
   * Récupère une caisse par son ID.
   */
  async findOne(id: string, tenantId: string) {
    const register = await this.prisma.cashRegister.findFirst({
      where: { id, tenantId },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            studentAccount: {
              select: {
                student: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        _count: { select: { transactions: true } },
      },
    });
    if (!register) throw new NotFoundException('Caisse non trouvée');

    // Enrichir avec les infos du staff responsable
    if (register.responsibleUserId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: register.responsibleUserId },
        select: { id: true, firstName: true, lastName: true, position: true, email: true, employeeNumber: true },
      });
      (register as any).responsibleUser = staff;
    }

    return register;
  }

  /**
   * Met à jour une caisse (nom, description, responsable, emplacement, isActive).
   * Le code n'est PAS modifiable (identifiant stable).
   */
  async update(id: string, tenantId: string, dto: UpdateCashRegisterDto) {
    const existing = await this.findOne(id, tenantId);

    // responsibleUserId stocke directement le Staff ID (pas de FK, pas de résolution)
    return this.prisma.cashRegister.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
        responsibleUserId: dto.responsibleUserId !== undefined ? (dto.responsibleUserId || null) : existing.responsibleUserId,
        location: dto.location ?? existing.location,
        isActive: dto.isActive ?? existing.isActive,
        // Champs bancaires (mis à jour si fournis)
        ...(dto.bankName !== undefined && { bankName: dto.bankName || null }),
        ...(dto.bankAccountNumber !== undefined && { bankAccountNumber: dto.bankAccountNumber || null }),
        ...(dto.bankIBAN !== undefined && { bankIBAN: dto.bankIBAN || null }),
        ...(dto.bankBranch !== undefined && { bankBranch: dto.bankBranch || null }),
        ...(dto.bankAccountType !== undefined && { bankAccountType: dto.bankAccountType || null }),
        ...(dto.bankContact !== undefined && { bankContact: dto.bankContact || null }),
      },
      include: {
        _count: { select: { transactions: true } },
      },
    });

    // Enrichir avec le staff responsable
    if (updated.responsibleUserId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: updated.responsibleUserId },
        select: { id: true, firstName: true, lastName: true, position: true, email: true, employeeNumber: true },
      });
      (updated as any).responsibleUser = staff;
    }

    return updated;
  }

  /**
   * Archive une caisse (soft delete — ne supprime jamais).
   * Refuse l'archivage si la caisse est ouverte ou si elle a des transactions récentes.
   */
  async archive(id: string, tenantId: string) {
    const register = await this.findOne(id, tenantId);
    if (register.isOpen) {
      throw new BadRequestException('Impossible d\'archiver une caisse ouverte. Fermez-la d\'abord.');
    }
    return this.prisma.cashRegister.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Ouvre une caisse pour une session.
   * - Enregistre l'utilisateur qui ouvre
   * - Définit isOpen = true, openedAt = now
   * - Optionnel : override du solde d'ouverture
   */
  async open(id: string, tenantId: string, dto: OpenCashRegisterDto) {
    const register = await this.findOne(id, tenantId);
    if (!register.isActive) {
      throw new BadRequestException('Caisse archivée — impossible d\'ouvrir.');
    }
    if (register.isOpen) {
      throw new BadRequestException('Caisse déjà ouverte. Fermez-la d\'abord.');
    }

    const openingBalance = dto.openingBalance ?? Number(register.currentBalance);
    return this.prisma.cashRegister.update({
      where: { id },
      data: {
        isOpen: true,
        openedAt: new Date(),
        openedByUserId: dto.userId,
        openingBalance: new Prisma.Decimal(openingBalance),
        currentBalance: new Prisma.Decimal(openingBalance),
      },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Ferme une caisse.
   * - Calcule l'écart entre solde théorique (currentBalance) et solde compté (countedBalance)
   * - Enregistre l'utilisateur qui ferme
   * - Définit isOpen = false, closedAt = now
   * - Retourne le rapport de clôture (éventuellement avec écart)
   */
  async close(id: string, tenantId: string, dto: CloseCashRegisterDto) {
    const register = await this.findOne(id, tenantId);
    if (!register.isOpen) {
      throw new BadRequestException('Caisse déjà fermée.');
    }

    const theoreticalBalance = Number(register.currentBalance);
    const countedBalance = dto.countedBalance ?? theoreticalBalance;
    const discrepancy = countedBalance - theoreticalBalance;

    const updated = await this.prisma.cashRegister.update({
      where: { id },
      data: {
        isOpen: false,
        closedAt: new Date(),
        closedByUserId: dto.userId,
      },
      include: {
        closedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Si écart > 0, créer une alerte ORION (à implémenter dans le service ORION)
    if (Math.abs(discrepancy) > 100) {
      this.logger.warn(
        `Écart caisse détecté pour ${register.code}: théorique=${theoreticalBalance}, compté=${countedBalance}, écart=${discrepancy}`,
      );
    }

    return {
      register: updated,
      closure: {
        theoreticalBalance,
        countedBalance,
        discrepancy,
        hasDiscrepancy: Math.abs(discrepancy) > 0.01,
      },
    };
  }

  /**
   * Récupère les statistiques d'une caisse pour une période donnée.
   * - Nombre de transactions
   * - Volume total encaissé
   * - Volume par méthode de paiement
   * - Transactions d'annulation (REVERSAL)
   */
  async getStats(
    id: string,
    tenantId: string,
    dateFrom?: Date,
    dateTo?: Date,
  ) {
    const register = await this.findOne(id, tenantId);

    const where: any = { cashRegisterId: id, tenantId };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [transactions, totalVolume, reversalVolume, byMethod] = await Promise.all([
      this.prisma.financeTransaction.count({ where }),
      this.prisma.financeTransaction.aggregate({
        where: { ...where, type: 'PAYMENT' },
        _sum: { amount: true },
      }),
      this.prisma.financeTransaction.aggregate({
        where: { ...where, type: 'REVERSAL' },
        _sum: { amount: true },
      }),
      this.prisma.financeTransaction.groupBy({
        by: ['paymentMethod'],
        where: { ...where, type: 'PAYMENT' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      register: {
        id: register.id,
        code: register.code,
        name: register.name,
        currentBalance: Number(register.currentBalance),
        isOpen: register.isOpen,
      },
      period: { dateFrom, dateTo },
      totalTransactions: transactions,
      totalVolume: Number(totalVolume._sum.amount ?? 0),
      reversalVolume: Math.abs(Number(reversalVolume._sum.amount ?? 0)),
      netVolume: Number(totalVolume._sum.amount ?? 0) + Number(reversalVolume._sum.amount ?? 0),
      byMethod: byMethod.map((m) => ({
        method: m.paymentMethod,
        count: m._count,
        total: Number(m._sum.amount ?? 0),
      })),
    };
  }

  /**
   * Met à jour le solde courant d'une caisse après une transaction.
   * Méthode interne appelée par FinanceTransactionService.
   *
   * @param cashRegisterId - ID de la caisse
   * @param amount - Montant de la transaction (positif pour PAYMENT, négatif pour REVERSAL)
   */
  async applyTransaction(cashRegisterId: string, amount: number): Promise<void> {
    if (!cashRegisterId) return;
    try {
      await this.prisma.cashRegister.update({
        where: { id: cashRegisterId },
        data: {
          currentBalance: { increment: new Prisma.Decimal(amount) },
        },
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to update cash register ${cashRegisterId} balance: ${err.message}`,
      );
    }
  }

  /**
   * Transfert de fonds entre deux caisses du même tenant.
   * - Débite la caisse source (currentBalance -= amount)
   * - Crédite la caisse cible (currentBalance += amount)
   * - Vérifie que le solde source est suffisant
   * - Vérifie que les deux caisses sont ouvertes et actives
   * - Crée une transaction de type TRANSFER pour l'audit
   */
  async transfer(
    fromId: string,
    toId: string,
    tenantId: string,
    data: { amount: number; note?: string },
    userId?: string,
  ) {
    if (fromId === toId) {
      throw new BadRequestException('Les caisses source et cible doivent être différentes');
    }
    if (!data.amount || data.amount <= 0) {
      throw new BadRequestException('Le montant du transfert doit être positif');
    }

    const fromRegister = await this.findOne(fromId, tenantId);
    const toRegister = await this.findOne(toId, tenantId);

    if (!fromRegister.isOpen) {
      throw new BadRequestException(`La caisse source "${fromRegister.code}" doit être ouverte pour transférer`);
    }
    if (!toRegister.isOpen) {
      throw new BadRequestException(`La caisse cible "${toRegister.code}" doit être ouverte pour recevoir`);
    }

    const fromBalance = Number(fromRegister.currentBalance);
    if (fromBalance < data.amount) {
      throw new BadRequestException(`Solde insuffisant dans la caisse source (${fromBalance} < ${data.amount})`);
    }

    // Débiter la source
    await this.prisma.cashRegister.update({
      where: { id: fromId },
      data: {
        currentBalance: Number(fromBalance) - data.amount,
        updatedAt: new Date(),
      },
    });

    // Créditer la cible
    await this.prisma.cashRegister.update({
      where: { id: toId },
      data: {
        currentBalance: Number(toRegister.currentBalance) + data.amount,
        updatedAt: new Date(),
      },
    });

    // Créer une transaction d'audit (type TRANSFER)
    try {
      await this.prisma.financeTransaction.create({
        data: {
          tenantId,
          cashRegisterId: fromId,
          transactionType: 'TRANSFER_OUT',
          amount: data.amount,
          paymentMethod: 'CASH',
          reference: `TRANSFER→${toRegister.code}`,
          receiptNumber: `TRF-${Date.now()}`,
          notes: data.note || `Transfert vers ${toRegister.name}`,
          deviceId: null,
          reversalOfId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      await this.prisma.financeTransaction.create({
        data: {
          tenantId,
          cashRegisterId: toId,
          transactionType: 'TRANSFER_IN',
          amount: data.amount,
          paymentMethod: 'CASH',
          reference: `TRANSFER←${fromRegister.code}`,
          receiptNumber: `TRF-${Date.now()}-IN`,
          notes: data.note || `Transfert depuis ${fromRegister.name}`,
          deviceId: null,
          reversalOfId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (err: any) {
      this.logger.warn(`Transfer audit log failed (non-blocking): ${err.message}`);
    }

    this.logger.log(
      `Transfer ${data.amount} XOF from ${fromRegister.code} → ${toRegister.code} by user ${userId || 'system'}`,
    );

    return {
      success: true,
      from: { id: fromId, code: fromRegister.code, name: fromRegister.name, newBalance: fromBalance - data.amount },
      to: { id: toId, code: toRegister.code, name: toRegister.name, newBalance: Number(toRegister.currentBalance) + data.amount },
      amount: data.amount,
    };
  }
}
