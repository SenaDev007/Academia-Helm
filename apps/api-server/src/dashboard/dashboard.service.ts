/**
 * ============================================================================
 * DASHBOARD SERVICE - SERVICE POUR LES DONNÉES DES DASHBOARDS
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * KPIs pour le dashboard Promoteur
   */
  async getPromoterKpis(tenantId: string, academicYearId?: string): Promise<any[]> {
    try {
      // TODO: Implémenter les vraies requêtes Prisma
      // Pour l'instant, retourner des données de base

      // Situation Financière
      const totalRevenue = await this.getTotalRevenue(tenantId, academicYearId);
      
      // Performance Académique
      const averageGrade = await this.getAverageGrade(tenantId, academicYearId);
      
      // Impayés
      const unpaidAmount = await this.getUnpaidAmount(tenantId);
      
      // Conformité
      const complianceScore = await this.getComplianceScore(tenantId);

      return [
        {
          title: 'Situation Financière',
          value: new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'XOF',
          }).format(totalRevenue),
          subtitle: 'Revenus totaux',
        },
        {
          title: 'Performance Académique',
          value: averageGrade.toFixed(2),
          subtitle: 'Moyenne générale',
        },
        {
          title: 'Impayés',
          value: new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'XOF',
          }).format(unpaidAmount),
          subtitle: 'Montant total',
        },
        {
          title: 'Conformité',
          value: `${complianceScore}%`,
          subtitle: 'Score de conformité',
        },
      ];
    } catch (error) {
      this.logger.error(`Error fetching promoter KPIs: ${error.message}`);
      throw error;
    }
  }

  /**
   * KPIs pour le dashboard Directeur
   */
  async getDirectorKpis(tenantId: string, academicYearId?: string): Promise<any[]> {
    try {
      // Effectifs par niveau
      const enrollmentByLevel = await this.getEnrollmentByLevel(tenantId, academicYearId);
      const totalEnrollment = enrollmentByLevel.reduce((sum: number, item: any) => sum + item.count, 0);
      
      // Absences critiques
      const criticalAbsences = await this.getCriticalAbsencesCount(tenantId, academicYearId);
      
      // Fiches à valider
      const pendingValidations = await this.getPendingValidations(tenantId, academicYearId);
      
      // État recouvrement
      const recoveryRate = await this.getRecoveryRate(tenantId, academicYearId);

      return [
        {
          title: 'Effectifs par Niveau',
          value: totalEnrollment,
          subtitle: 'Total élèves',
        },
        {
          title: 'Absences Critiques',
          value: criticalAbsences,
          subtitle: 'À traiter',
        },
        {
          title: 'Fiches à Valider',
          value: pendingValidations,
          subtitle: 'En attente',
        },
        {
          title: 'État Recouvrement',
          value: `${recoveryRate}%`,
          subtitle: 'Taux de recouvrement',
        },
      ];
    } catch (error) {
      this.logger.error(`Error fetching director KPIs: ${error.message}`);
      throw error;
    }
  }

  /**
   * KPIs pour le dashboard Comptable
   */
  async getAccountantKpis(tenantId: string, academicYearId?: string): Promise<any[]> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Encaissements du jour
      const todayPayments = await this.getTodayPayments(tenantId, today);
      
      // Impayés
      const unpaidInvoices = await this.getUnpaidInvoicesCount(tenantId);
      
      // Rappels envoyés
      const remindersSent = await this.getRemindersSentCount(tenantId, today);
      
      // Clôture quotidienne
      const dailyClosure = await this.getDailyClosure(tenantId, today);

      return [
        {
          title: 'Encaissements du Jour',
          value: new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'XOF',
          }).format(todayPayments.total),
          subtitle: `${todayPayments.count} paiements`,
        },
        {
          title: 'Impayés',
          value: unpaidInvoices.count,
          subtitle: new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'XOF',
          }).format(unpaidInvoices.amount),
        },
        {
          title: 'Rappels Envoyés',
          value: remindersSent,
          subtitle: 'Aujourd\'hui',
        },
        {
          title: 'Clôture Quotidienne',
          value: dailyClosure ? 'Oui' : 'Non',
          subtitle: dailyClosure ? 'Clôturée' : 'En attente',
        },
      ];
    } catch (error) {
      this.logger.error(`Error fetching accountant KPIs: ${error.message}`);
      throw error;
    }
  }

  // Méthodes helper pour les requêtes Prisma
  private async getTotalRevenue(tenantId: string, academicYearId?: string): Promise<number> {
    try {
      const where: any = { tenantId };
      if (academicYearId) {
        where.academicYearId = academicYearId;
      }

      const result = await this.prisma.payment.aggregate({
        where: {
          ...where,
          status: 'completed', // Le statut est en lowercase dans Prisma
        },
        _sum: {
          amount: true,
        },
      });

      return result._sum.amount?.toNumber() || 0;
    } catch (error) {
      this.logger.warn(`Error calculating total revenue: ${error.message}`);
      return 0;
    }
  }

  private async getAverageGrade(tenantId: string, academicYearId?: string): Promise<number> {
    try {
      // TODO: Implémenter le calcul de la moyenne générale
      return 0;
    } catch (error) {
      this.logger.warn(`Error calculating average grade: ${error.message}`);
      return 0;
    }
  }

  private async getUnpaidAmount(tenantId: string): Promise<number> {
    try {
      // Utiliser StudentFee ou TuitionInstallment selon le modèle disponible
      // Pour l'instant, calculer depuis les paiements manquants
      const totalExpected = await this.prisma.payment.aggregate({
        where: { tenantId },
        _sum: { amount: true },
      });

      const totalPaid = await this.prisma.payment.aggregate({
        where: {
          tenantId,
          status: 'completed',
        },
        _sum: { amount: true },
      });

      const expected = totalExpected._sum.amount?.toNumber() || 0;
      const paid = totalPaid._sum.amount?.toNumber() || 0;
      
      return Math.max(0, expected - paid);
    } catch (error) {
      this.logger.warn(`Error calculating unpaid amount: ${error.message}`);
      return 0;
    }
  }

  private async getComplianceScore(tenantId: string): Promise<number> {
    // TODO: Implémenter le calcul du score de conformité
    return 95;
  }

  private async getEnrollmentByLevel(tenantId: string, academicYearId?: string): Promise<any[]> {
    try {
      const where: any = { tenantId, status: 'ACTIVE' };
      if (academicYearId) {
        where.academicYearId = academicYearId;
      }

      // Utiliser StudentEnrollment pour avoir les relations avec les classes et niveaux
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where,
        include: {
          schoolLevel: {
            select: {
              name: true,
            },
          },
        },
      });

      // Grouper par niveau scolaire
      const byLevel: Record<string, number> = {};
      enrollments.forEach((enrollment) => {
        const level = enrollment.schoolLevel?.name || 'Non assigné';
        byLevel[level] = (byLevel[level] || 0) + 1;
      });

      return Object.entries(byLevel).map(([name, count]) => ({ name, count }));
    } catch (error) {
      this.logger.warn(`Error getting enrollment by level: ${error.message}`);
      return [];
    }
  }

  private async getCriticalAbsencesCount(tenantId: string, academicYearId?: string): Promise<number> {
    try {
      const where: any = { tenantId };
      
      // Les absences critiques sont celles non justifiées récentes (7 derniers jours)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      return await this.prisma.absence.count({
        where: {
          ...where,
          isJustified: false,
          date: {
            gte: sevenDaysAgo,
          },
        },
      });
    } catch (error) {
      this.logger.warn(`Error getting critical absences: ${error.message}`);
      return 0;
    }
  }

  private async getPendingValidations(tenantId: string, academicYearId?: string): Promise<number> {
    // TODO: Implémenter le comptage des fiches à valider
    return 0;
  }

  private async getRecoveryRate(tenantId: string, academicYearId?: string): Promise<number> {
    try {
      // Calculer le taux de recouvrement basé sur les paiements
      const totalPayments = await this.prisma.payment.count({
        where: { tenantId },
      });

      const completedPayments = await this.prisma.payment.count({
        where: {
          tenantId,
          status: 'completed',
        },
      });

      if (totalPayments === 0) return 100;
      return Math.round((completedPayments / totalPayments) * 100);
    } catch (error) {
      this.logger.warn(`Error calculating recovery rate: ${error.message}`);
      return 0;
    }
  }

  private async getTodayPayments(tenantId: string, today: Date): Promise<{ total: number; count: number }> {
    try {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const payments = await this.prisma.payment.findMany({
        where: {
          tenantId,
          paymentDate: {
            gte: today,
            lt: tomorrow,
          },
          status: 'completed',
        },
      });

      const total = payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
      return { total, count: payments.length };
    } catch (error) {
      this.logger.warn(`Error getting today payments: ${error.message}`);
      return { total: 0, count: 0 };
    }
  }

  private async getUnpaidInvoicesCount(tenantId: string): Promise<{ count: number; amount: number }> {
    try {
      // Calculer les impayés depuis les paiements non complétés
      const unpaidPayments = await this.prisma.payment.findMany({
        where: {
          tenantId,
          status: {
            not: 'completed',
          },
        },
      });

      const amount = unpaidPayments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
      return { count: unpaidPayments.length, amount };
    } catch (error) {
      this.logger.warn(`Error getting unpaid invoices: ${error.message}`);
      return { count: 0, amount: 0 };
    }
  }

  private async getRemindersSentCount(tenantId: string, today: Date): Promise<number> {
    // TODO: Implémenter le comptage des rappels envoyés
    return 0;
  }

  private async getDailyClosure(tenantId: string, today: Date): Promise<boolean> {
    // TODO: Implémenter la vérification de clôture quotidienne
    return false;
  }
}
