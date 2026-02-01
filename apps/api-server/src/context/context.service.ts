/**
 * ============================================================================
 * CONTEXT SERVICE - SERVICE DE CONTEXTE TENANT
 * ============================================================================
 * 
 * Service pour récupérer et structurer le contexte complet d'un tenant
 * pour l'initialisation du dashboard.
 * 
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ContextService {
  private readonly logger = new Logger(ContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Vérifie si l'utilisateur est PLATFORM_OWNER
   */
  private isPlatformOwner(user: any): boolean {
    if (!user) return false;
    const platformOwnerEmail = this.configService.get<string>('PLATFORM_OWNER_EMAIL');
    if (platformOwnerEmail && user.email === platformOwnerEmail) return true;
    if (user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN') return true;
    return false;
  }

  /**
   * Bootstrap du contexte tenant
   * 
   * Retourne toutes les informations nécessaires pour initialiser le dashboard
   */
  async bootstrap(userId: string, tenantId: string, role: string) {
    // Récupérer l'utilisateur
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Récupérer le tenant
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        country: {
          select: {
            name: true,
            code: true,
          },
        },
        schools: {
          select: {
            id: true,
            name: true,
            logo: true,
            address: true,
            phone: true,
            email: true,
            educationLevels: true,
          },
          take: 1,
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.status !== 'active') {
      throw new NotFoundException(`Tenant is not active. Status: ${tenant.status}`);
    }

    // Récupérer l'année académique active
    const academicYear = await this.prisma.academicYear.findFirst({
      where: {
        tenantId: tenantId,
        isActive: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    if (!academicYear) {
      this.logger.warn(`No active academic year found for tenant ${tenantId}`);
    }

    // Récupérer les permissions selon le rôle
    const permissions = await this.getPermissions(role, tenantId);

    // Récupérer le résumé ORION (si applicable)
    const orionSummary = await this.getOrionSummary(role, tenantId, academicYear?.id);

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        subdomain: tenant.subdomain,
        type: tenant.type,
        status: tenant.status,
        country: tenant.country,
        school: tenant.schools?.[0] || null,
      },
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isPlatformOwner: this.isPlatformOwner(user),
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
      role: role,
      academicYear: academicYear ? {
        id: academicYear.id,
        name: academicYear.name,
        startDate: academicYear.startDate,
        endDate: academicYear.endDate,
        isActive: academicYear.isActive,
      } : null,
      permissions: permissions,
      orionSummary: orionSummary,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Récupère les permissions selon le rôle
   */
  private async getPermissions(role: string, tenantId: string): Promise<any> {
    // TODO: Implémenter la récupération des permissions depuis la table Permissions
    // Pour l'instant, retourner des permissions basiques selon le rôle

    const rolePermissions: Record<string, any> = {
      PLATFORM_OWNER: {
        // Accès total
        canViewAllTenants: true,
        canManageTenants: true,
        canViewOrion: true,
        canManageOrion: true,
      },
      PROMOTER: {
        // Accès complet à l'école
        canViewFinance: true,
        canManageFinance: true,
        canViewStudents: true,
        canManageStudents: true,
        canViewTeachers: true,
        canManageTeachers: true,
        canViewExams: true,
        canManageExams: true,
        canViewSettings: true,
        canManageSettings: true,
        canViewOrion: true,
      },
      DIRECTOR: {
        // Pilotage pédagogique + administratif
        canViewStudents: true,
        canManageStudents: true,
        canViewTeachers: true,
        canManageTeachers: true,
        canViewExams: true,
        canManageExams: true,
        canViewFinance: true,
        canViewOrion: true,
        canManageSettings: false, // Pas de paramétrage avancé
      },
      ACCOUNTANT: {
        // Pilotage financier uniquement
        canViewFinance: true,
        canManageFinance: true,
        canViewStudents: false,
        canViewTeachers: false,
        canViewExams: false,
        canViewOrion: false,
      },
      SECRETARY: {
        // Secrétaire-comptable
        canViewFinance: true,
        canManageFinance: true,
        canViewStudents: true,
        canManageStudents: true,
        canViewTeachers: false,
        canViewExams: false,
        canViewOrion: false,
      },
      TEACHER: {
        // Espace pédagogique personnel
        canViewStudents: true,
        canViewTeachers: false,
        canViewExams: true,
        canManageExams: true,
        canViewFinance: false,
        canViewOrion: false,
      },
      PARENT: {
        // Suivi enfant(s)
        canViewStudents: true,
        canViewFinance: true, // Pour voir la situation financière
        canViewTeachers: false,
        canViewExams: false,
        canViewOrion: false,
      },
      STUDENT: {
        // Consultation uniquement
        canViewStudents: true,
        canViewTeachers: false,
        canViewExams: true,
        canViewFinance: false,
        canViewOrion: false,
      },
    };

    return rolePermissions[role] || {};
  }

  /**
   * Récupère le résumé ORION selon le rôle
   * 
   * ORION n'apparaît que pour :
   * - PLATFORM_OWNER
   * - PROMOTER
   * - DIRECTOR
   */
  private async getOrionSummary(role: string, tenantId: string, academicYearId?: string | null): Promise<any | null> {
    // ORION visible uniquement pour ces rôles
    const orionVisibleRoles = ['PLATFORM_OWNER', 'PROMOTER', 'DIRECTOR'];
    
    if (!orionVisibleRoles.includes(role)) {
      return null;
    }

    // TODO: Implémenter la récupération des données ORION
    // Pour l'instant, retourner un résumé basique

    try {
      // Compter les alertes critiques
      const criticalAlerts = await this.prisma.auditLog.count({
        where: {
          tenantId: tenantId,
          level: 'critical',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Derniers 7 jours
          },
        },
      });

      // Compter les incohérences de données
      const dataInconsistencies = await this.prisma.auditLog.count({
        where: {
          tenantId: tenantId,
          resource: 'DATA_INTEGRITY',
          level: 'warning',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      });

      return {
        criticalAlerts: criticalAlerts,
        dataInconsistencies: dataInconsistencies,
        lastCheck: new Date().toISOString(),
        status: criticalAlerts > 0 ? 'warning' : 'ok',
      };
    } catch (error) {
      this.logger.error(`Error fetching ORION summary: ${error.message}`);
      return null;
    }
  }
}
