import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service d'intégration ORION pour le MODULE 9 — Modules Complémentaires
 * Refactorisé pour éviter les dépendances circulaires : utilise Prisma directement
 * au lieu d'injecter les autres services frères du même module.
 */
@Injectable()
export class ModulesComplementairesOrionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère tous les KPIs pour tous les sous-modules
   */
  async getAllKPIs(tenantId: string, academicYearId: string) {
    const [
      totalCanteenEnrollments,
      totalTransportAssignments,
      totalLibraryLoans,
      totalLabSessions,
      totalMedicalVisits,
      totalShopOrders,
      totalEducastContents,
    ] = await Promise.all([
      this.prisma.canteenEnrollment.count({ where: { tenantId, academicYearId } }).catch(() => 0),
      this.prisma.transportStudentAssignment.count({ where: { tenantId, academicYearId } }).catch(() => 0),
      this.prisma.libraryLoan.count({ where: { tenantId, academicYearId } }).catch(() => 0),
      this.prisma.labSession.count({ where: { tenantId, academicYearId } }).catch(() => 0),
      this.prisma.infirmaryVisit.count({ where: { tenantId, academicYearId } }).catch(() => 0),
      this.prisma.shopOrder.count({ where: { tenantId } }).catch(() => 0),
      this.prisma.eduCastContent.count({ where: { tenantId } }).catch(() => 0),
    ]);

    return {
      canteen: { enrollments: totalCanteenEnrollments },
      transport: { assignments: totalTransportAssignments },
      library: { loans: totalLibraryLoans },
      labs: { sessions: totalLabSessions },
      medical: { visits: totalMedicalVisits },
      shop: { orders: totalShopOrders },
      educast: { contents: totalEducastContents },
    };
  }

  /**
   * Génère les alertes ORION pour tous les sous-modules
   */
  async generateAlerts(tenantId: string, academicYearId: string) {
    const alerts: any[] = [];

    // Alerte Bibliothèque : Livres en retard
    const overdueCount = await this.prisma.libraryLoan.count({
      where: {
        tenantId,
        academicYearId,
        status: 'BORROWED',
        dueDate: { lt: new Date() },
      },
    }).catch(() => 0);

    if (overdueCount > 5) {
      alerts.push({
        module: 'BIBLIOTHÈQUE',
        severity: 'WARNING',
        title: `${overdueCount} emprunt(s) en retard`,
        description: `Il y a ${overdueCount} livre(s) non retourné(s) après la date d'échéance.`,
        recommendation: 'Envoyer des rappels aux élèves et mettre à jour les pénalités.',
      });
    }

    // Alerte Boutique : Stock faible
    const lowStockCount = await this.prisma.shopProduct.count({
      where: {
        tenantId,
        stockQuantity: { lte: 5 },
        status: 'ACTIVE',
      },
    }).catch(() => 0);

    if (lowStockCount > 3) {
      alerts.push({
        module: 'BOUTIQUE',
        severity: 'INFO',
        title: `${lowStockCount} produit(s) en stock faible`,
        description: `${lowStockCount} produit(s) sont en dessous du seuil minimum.`,
        recommendation: 'Réapprovisionner les produits en stock faible.',
      });
    }

    return alerts;
  }
}
