/**
 * ============================================================================
 * DASHBOARD SERVICE - DASHBOARDS PERSONNALISÉS PAR RÔLE
 * ============================================================================
 * 
 * Génère les données de dashboard selon le rôle de l'utilisateur
 * 
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';
import { PermissionsService } from './permissions.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Récupère les données du dashboard selon le rôle
   */
  async getDashboardData(role: UserRole, tenantId: string, academicYearId?: string) {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return this.getSuperAdminDashboard(tenantId);
      case UserRole.PROMOTEUR:
        return this.getPromoteurDashboard(tenantId, academicYearId);
      case UserRole.DIRECTEUR:
        return this.getDirecteurDashboard(tenantId, academicYearId);
      case UserRole.SECRETAIRE:
        return this.getSecretaireDashboard(tenantId, academicYearId);
      case UserRole.COMPTABLE:
        return this.getComptableDashboard(tenantId, academicYearId);
      case UserRole.SECRETAIRE_COMPTABLE:
        return this.getSecretaireComptableDashboard(tenantId, academicYearId);
      case UserRole.CENSEUR:
        return this.getCenseurDashboard(tenantId, academicYearId);
      case UserRole.SURVEILLANT:
        return this.getSurveillantDashboard(tenantId, academicYearId);
      case UserRole.ENSEIGNANT:
        return this.getEnseignantDashboard(tenantId, academicYearId);
      case UserRole.PARENT:
        return this.getParentDashboard(tenantId, academicYearId);
      case UserRole.ELEVE:
        return this.getEleveDashboard(tenantId, academicYearId);
      default:
        return { message: 'Dashboard not available for this role' };
    }
  }

  /**
   * Super Admin — Dashboard Plateforme
   */
  private async getSuperAdminDashboard(tenantId: string) {
    const [activeTenants, subscriptions, recentSchools] = await Promise.all([
      this.prisma.tenant.count({ where: { status: 'active' } }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.school.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { tenant: { select: { id: true, name: true } } },
      }),
    ]);

    return {
      type: 'PLATEFORME',
      metrics: {
        activeSchools: activeTenants,
        activeSubscriptions: subscriptions,
        recentSchools: recentSchools.length,
      },
      recentSchools,
      accessibleModules: this.permissionsService.getAccessibleModules(UserRole.SUPER_ADMIN),
    };
  }

  /**
   * Promoteur — Dashboard Stratégique
   */
  private async getPromoteurDashboard(tenantId: string, academicYearId?: string) {
    if (!academicYearId) {
      return { message: 'Academic year required' };
    }

    const [totalRevenue, unpaidAmount, totalStudents] = await Promise.all([
      this.getTotalRevenue(tenantId, academicYearId),
      this.getUnpaidAmount(tenantId, academicYearId),
      this.prisma.student.count({
        where: { tenantId, academicYearId },
      }),
    ]);

    return {
      type: 'STRATEGIQUE',
      metrics: {
        totalRevenue,
        unpaidAmount,
        totalStudents,
        paymentRate: totalRevenue > 0 ? ((totalRevenue - unpaidAmount) / totalRevenue) * 100 : 0,
      },
      accessibleModules: this.permissionsService.getAccessibleModules(UserRole.PROMOTEUR),
    };
  }

  /**
   * Directeur — Dashboard Opérationnel
   */
  private async getDirecteurDashboard(tenantId: string, academicYearId?: string) {
    if (!academicYearId) {
      return { message: 'Academic year required' };
    }

    const [totalClasses, totalStudents, todayAbsences, pendingMessages] = await Promise.all([
      this.prisma.class.count({
        where: { tenantId, academicYearId },
      }),
      this.prisma.student.count({
        where: { tenantId, academicYearId },
      }),
      this.getTodayAbsences(tenantId, academicYearId),
      this.getPendingMessages(tenantId),
    ]);

    return {
      type: 'OPERATIONNEL',
      metrics: {
        totalClasses,
        totalStudents,
        todayAbsences,
        pendingMessages,
      },
      accessibleModules: this.permissionsService.getAccessibleModules(UserRole.DIRECTEUR),
    };
  }

  /**
   * Secrétaire — Dashboard Administration
   */
  private async getSecretaireDashboard(tenantId: string, academicYearId?: string) {
    if (!academicYearId) {
      return { message: 'Academic year required' };
    }

    const [pendingRegistrations, newStudents] = await Promise.all([
      this.getPendingRegistrations(tenantId, academicYearId),
      this.prisma.student.count({
        where: {
          tenantId,
          academicYearId,
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7)), // Derniers 7 jours
          },
        },
      }),
    ]);

    return {
      type: 'ADMINISTRATION',
      metrics: {
        pendingRegistrations,
        newStudents,
      },
      accessibleModules: this.permissionsService.getAccessibleModules(UserRole.SECRETAIRE),
    };
  }

  /**
   * Comptable — Dashboard Finances
   */
  private async getComptableDashboard(tenantId: string, academicYearId?: string) {
    if (!academicYearId) {
      return { message: 'Academic year required' };
    }

    const [todayPayments, unpaidCount, todayRevenue] = await Promise.all([
      this.getTodayPayments(tenantId, academicYearId),
      this.getUnpaidCount(tenantId, academicYearId),
      this.getTodayRevenue(tenantId, academicYearId),
    ]);

    return {
      type: 'FINANCES',
      metrics: {
        todayPayments,
        unpaidCount,
        todayRevenue,
      },
      accessibleModules: this.permissionsService.getAccessibleModules(UserRole.COMPTABLE),
    };
  }

  /**
   * Secrétaire-Comptable — Dashboard Fusion
   */
  private async getSecretaireComptableDashboard(tenantId: string, academicYearId?: string) {
    const [secretaireData, comptableData] = await Promise.all([
      this.getSecretaireDashboard(tenantId, academicYearId),
      this.getComptableDashboard(tenantId, academicYearId),
    ]);

    return {
      type: 'FUSION',
      metrics: {
        ...secretaireData.metrics,
        ...comptableData.metrics,
      },
      accessibleModules: this.permissionsService.getAccessibleModules(UserRole.SECRETAIRE_COMPTABLE),
    };
  }

  /**
   * Censeur — Dashboard Secondaire
   */
  private async getCenseurDashboard(tenantId: string, academicYearId?: string) {
    if (!academicYearId) {
      return { message: 'Academic year required' };
    }

    const [criticalAbsences, incidents] = await Promise.all([
      this.getCriticalAbsences(tenantId, academicYearId),
      this.getDisciplinaryIncidents(tenantId, academicYearId),
    ]);

    return {
      type: 'SECONDAIRE',
      metrics: {
        criticalAbsences,
        incidents,
      },
      accessibleModules: this.permissionsService.getAccessibleModules(UserRole.CENSEUR),
    };
  }

  /**
   * Surveillant — Dashboard Surveillance
   */
  private async getSurveillantDashboard(tenantId: string, academicYearId?: string) {
    if (!academicYearId) {
      return { message: 'Academic year required' };
    }

    const [todayAbsences, todayLates] = await Promise.all([
      this.getTodayAbsences(tenantId, academicYearId),
      this.getTodayLates(tenantId, academicYearId),
    ]);

    return {
      type: 'SURVEILLANCE',
      metrics: {
        todayAbsences,
        todayLates,
      },
      accessibleModules: this.permissionsService.getAccessibleModules(UserRole.SURVEILLANT),
    };
  }

  /**
   * Enseignant — Dashboard Pédagogique
   */
  private async getEnseignantDashboard(tenantId: string, academicYearId?: string) {
    if (!academicYearId) {
      return { message: 'Academic year required' };
    }

    return {
      type: 'PEDAGOGIQUE',
      metrics: {
        myClasses: 0, // À implémenter avec l'ID de l'enseignant
        pendingGrades: 0, // À implémenter
      },
      accessibleModules: this.permissionsService.getAccessibleModules(UserRole.ENSEIGNANT),
    };
  }

  /**
   * Parent — Dashboard Famille
   */
  private async getParentDashboard(tenantId: string, academicYearId?: string) {
    if (!academicYearId) {
      return { message: 'Academic year required' };
    }

    return {
      type: 'FAMILLE',
      metrics: {
        childrenCount: 0, // À implémenter avec l'ID du parent
        unpaidAmount: 0, // À implémenter
      },
      accessibleModules: this.permissionsService.getAccessibleModules(UserRole.PARENT),
    };
  }

  /**
   * Élève — Dashboard Personnel
   */
  private async getEleveDashboard(tenantId: string, academicYearId?: string) {
    if (!academicYearId) {
      return { message: 'Academic year required' };
    }

    return {
      type: 'PERSONNEL',
      metrics: {
        myGrades: 0, // À implémenter avec l'ID de l'élève
        myAbsences: 0, // À implémenter
      },
      accessibleModules: this.permissionsService.getAccessibleModules(UserRole.ELEVE),
    };
  }

  // Helpers pour les métriques
  private async getTotalRevenue(tenantId: string, academicYearId: string): Promise<number> {
    const result = await this.prisma.payment.aggregate({
      where: {
        tenantId,
        academicYearId,
        status: 'completed',
      },
      _sum: {
        amount: true,
      },
    });
    return Number(result._sum.amount || 0);
  }

  private async getUnpaidAmount(tenantId: string, academicYearId: string): Promise<number> {
    // À implémenter avec StudentFee ou FeeArrear
    return 0;
  }

  private async getTodayAbsences(tenantId: string, academicYearId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.absence.count({
      where: {
        tenantId,
        date: {
          gte: today,
        },
      },
    });
  }

  private async getPendingMessages(tenantId: string): Promise<number> {
    return this.prisma.message.count({
      where: {
        tenantId,
        status: 'PENDING',
      },
    });
  }

  private async getPendingRegistrations(tenantId: string, academicYearId: string): Promise<number> {
    return this.prisma.studentEnrollment.count({
      where: {
        tenantId,
        academicYearId,
        status: 'PENDING',
      },
    });
  }

  private async getTodayPayments(tenantId: string, academicYearId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.payment.count({
      where: {
        tenantId,
        academicYearId,
        paymentDate: {
          gte: today,
        },
        status: 'completed',
      },
    });
  }

  private async getUnpaidCount(tenantId: string, academicYearId: string): Promise<number> {
    // À implémenter avec StudentFee ou FeeArrear
    return 0;
  }

  private async getTodayRevenue(tenantId: string, academicYearId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.prisma.payment.aggregate({
      where: {
        tenantId,
        academicYearId,
        paymentDate: {
          gte: today,
        },
        status: 'completed',
      },
      _sum: {
        amount: true,
      },
    });
    return Number(result._sum.amount || 0);
  }

  private async getCriticalAbsences(tenantId: string, academicYearId: string): Promise<number> {
    // Absences non justifiées > 3 jours
    return this.prisma.absence.count({
      where: {
        tenantId,
        isJustified: false,
      },
    });
  }

  private async getDisciplinaryIncidents(tenantId: string, academicYearId: string): Promise<number> {
    return this.prisma.discipline.count({
      where: {
        tenantId,
      },
    });
  }

  private async getTodayLates(tenantId: string, academicYearId: string): Promise<number> {
    // À implémenter avec un modèle de retards si disponible
    return 0;
  }
}
