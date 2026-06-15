/**
 * ============================================================================
 * MCP CONTEXT COMPOSER — Model Context Protocol
 * ============================================================================
 * Compose le contexte MCP à partir de multiple providers.
 * Chaque requête IA reçoit un contexte enrichi avec école, utilisateur,
 * permissions, année académique et session.
 *
 * Modèle : z-ai/glm-5.1 via OpenRouter
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MCPContext, MCPRequest } from '../types/ai.types';

@Injectable()
export class MCPContextComposer {
  private readonly logger = new Logger(MCPContextComposer.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compose le contexte MCP complet à partir de la requête
   */
  async compose(request: MCPRequest): Promise<MCPContext> {
    const [schoolCtx, userCtx, permCtx, sessionCtx] = await Promise.all([
      this.getSchoolContext(request),
      this.getUserContext(request),
      this.getPermissionContext(request),
      this.getSessionContext(request),
    ]);

    return {
      ...schoolCtx,
      ...userCtx,
      ...permCtx,
      ...sessionCtx,
    } as MCPContext;
  }

  // ─── SCHOOL CONTEXT ─────────────────────────────────────────────────────

  private async getSchoolContext(request: MCPRequest): Promise<Partial<MCPContext>> {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: request.tenantId },
        include: {
          school: true,
          subscription: true,
        },
      });

      if (!tenant) {
        return this.getDefaultSchoolContext(request);
      }

      // Récupérer l'année académique courante
      const currentAcademicYear = await this.prisma.academicYear.findFirst({
        where: { tenantId: request.tenantId, isCurrent: true },
      });

      // Récupérer la période courante
      const currentQuarter = await this.prisma.quarter.findFirst({
        where: { tenantId: request.tenantId, isActive: true },
        orderBy: { startDate: 'desc' },
      });

      return {
        schoolId: request.schoolId || request.tenantId,
        schoolName: tenant.school?.name || tenant.name || 'Établissement',
        currentAcademicYear: currentAcademicYear?.name || currentAcademicYear?.year || 'Non défini',
        currentPeriod: currentQuarter?.name || 'Non défini',
        subscriptionPlan: tenant.subscription?.plan || 'SEED',
        enabledModules: tenant.subscription?.features as string[] || [],
        timezone: 'Africa/Porto-Novo',
        locale: 'fr',
      };
    } catch (error: any) {
      this.logger.warn(`Failed to load school context: ${error?.message}`);
      return this.getDefaultSchoolContext(request);
    }
  }

  private getDefaultSchoolContext(request: MCPRequest): Partial<MCPContext> {
    return {
      schoolId: request.schoolId || request.tenantId,
      schoolName: 'Établissement',
      currentAcademicYear: 'Non défini',
      currentPeriod: 'Non défini',
      subscriptionPlan: 'SEED',
      enabledModules: [],
      timezone: 'Africa/Porto-Novo',
      locale: 'fr',
    };
  }

  // ─── USER CONTEXT ───────────────────────────────────────────────────────

  private async getUserContext(request: MCPRequest): Promise<Partial<MCPContext>> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: request.userId },
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      });

      if (!user) {
        return this.getDefaultUserContext(request);
      }

      const permissions = user.role?.permissions?.map((rp: any) => rp.permission?.key).filter(Boolean) || [];

      // Récupérer les classes assignées pour les enseignants
      let assignedClasses: string[] = [];
      if (user.role?.name === 'ENSEIGNANT' || user.role?.name === 'TEACHER') {
        const assignments = await this.prisma.teachingAssignment.findMany({
          where: { teacherId: user.id, tenantId: request.tenantId },
          select: { classId: true },
        });
        assignedClasses = assignments.map((a: any) => a.classId).filter(Boolean);
      }

      // Récupérer les enfants pour les parents
      let childrenIds: string[] = [];
      if (user.role?.name === 'PARENT') {
        const guardians = await this.prisma.guardian.findMany({
          where: { userId: user.id, tenantId: request.tenantId },
          include: { student: { select: { id: true } } },
        });
        childrenIds = guardians.map((g: any) => g.student?.id).filter(Boolean);
      }

      return {
        userId: user.id,
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        userEmail: user.email,
        userRole: user.role?.name || 'USER',
        userPermissions: permissions,
        assignedClasses,
        childrenIds,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to load user context: ${error?.message}`);
      return this.getDefaultUserContext(request);
    }
  }

  private getDefaultUserContext(request: MCPRequest): Partial<MCPContext> {
    return {
      userId: request.userId,
      userName: 'Utilisateur',
      userEmail: '',
      userRole: 'USER',
      userPermissions: [],
    };
  }

  // ─── PERMISSION CONTEXT ─────────────────────────────────────────────────

  private async getPermissionContext(request: MCPRequest): Promise<Partial<MCPContext>> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: request.userId },
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      });

      const role = user?.role?.name || '';

      // Déterminer les capacités basées sur le rôle et les permissions
      const isAdmin = ['SUPER_ADMIN', 'PROMOTEUR', 'DIRECTEUR', 'SUPER_DIRECTEUR', 'SCHOOL_ADMIN'].includes(role);
      const isTeacher = ['ENSEIGNANT', 'TEACHER'].includes(role);
      const isAccountant = ['COMPTABLE', 'CAISSIER'].includes(role);

      return {
        canViewAllStudents: isAdmin || isTeacher || isAccountant,
        canViewFinance: isAdmin || isAccountant,
        canViewHR: isAdmin,
        canTriggerAtlas: isAdmin || isAccountant,
        canViewOrion: isAdmin,
      };
    } catch (error: any) {
      this.logger.warn(`Failed to load permission context: ${error?.message}`);
      return {
        canViewAllStudents: false,
        canViewFinance: false,
        canViewHR: false,
        canTriggerAtlas: false,
        canViewOrion: false,
      };
    }
  }

  // ─── SESSION CONTEXT ────────────────────────────────────────────────────

  private async getSessionContext(request: MCPRequest): Promise<Partial<MCPContext>> {
    if (!request.sessionId) {
      return {
        sessionId: undefined,
        conversationHistory: [],
        currentContext: {},
      };
    }

    try {
      // Récupérer l'historique de conversation pour la session
      const messages = await this.prisma.atlasMessage.findMany({
        where: {
          tenantId: request.tenantId,
          userId: request.userId,
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });

      const conversationHistory = messages.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: msg.createdAt,
      }));

      return {
        sessionId: request.sessionId,
        conversationHistory,
        currentContext: {},
      };
    } catch (error: any) {
      return {
        sessionId: request.sessionId,
        conversationHistory: [],
        currentContext: {},
      };
    }
  }
}
