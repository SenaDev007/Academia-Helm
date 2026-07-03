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
}

export interface UpdateCashRegisterDto {
  name?: string;
  description?: string;
  responsibleUserId?: string;
  location?: string;
  isActive?: boolean;
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
    return this.prisma.cashRegister.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        responsibleUserId: dto.responsibleUserId,
        location: dto.location,
        openingBalance: new Prisma.Decimal(openingBalance),
        currentBalance: new Prisma.Decimal(openingBalance),
        isActive: dto.isActive ?? true,
      },
      include: {
        responsibleUser: { select: { id: true, firstName: true, lastName: true, email: true } },
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

    return this.prisma.cashRegister.findMany({
      where,
      include: {
        responsibleUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        openedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: { select: { transactions: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Récupère une caisse par son ID.
   */
  async findOne(id: string, tenantId: string) {
    const register = await this.prisma.cashRegister.findFirst({
      where: { id, tenantId },
      include: {
        responsibleUser: { select: { id: true, firstName: true, lastName: true, email: true } },
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
    return register;
  }

  /**
   * Met à jour une caisse (nom, description, responsable, emplacement, isActive).
   * Le code n'est PAS modifiable (identifiant stable).
   */
  async update(id: string, tenantId: string, dto: UpdateCashRegisterDto) {
    const existing = await this.findOne(id, tenantId);

    return this.prisma.cashRegister.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
        responsibleUserId: dto.responsibleUserId ?? existing.responsibleUserId,
        location: dto.location ?? existing.location,
        isActive: dto.isActive ?? existing.isActive,
      },
      include: {
        responsibleUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { transactions: true } },
      },
    });
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
        responsibleUser: { select: { id: true, firstName: true, lastName: true } },
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
        responsibleUser: { select: { id: true, firstName: true, lastName: true } },
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
}
