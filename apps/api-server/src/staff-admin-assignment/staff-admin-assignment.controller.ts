import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, BadRequestException, Logger,
} from '@nestjs/common';
import { StaffAdminAssignmentService } from './staff-admin-assignment.service';
import { PrismaService } from '../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipAcademicYear } from '../common/decorators/skip-academic-year.decorator';
import * as crypto from 'crypto';

/**
 * ============================================================================
 * StaffAdminAssignmentController — CRUD des affectations administratives
 * ============================================================================
 *
 * Endpoints (tous authentifiés + réservés aux directeurs/admins) :
 *
 *   GET    /api/staff-admin-assignments                    → liste (filtres: staffId, schoolLevelCode, adminRole, isActive)
 *   GET    /api/staff-admin-assignments/:id                → détail
 *   POST   /api/staff-admin-assignments                    → crée
 *   PUT    /api/staff-admin-assignments/:id                → met à jour
 *   DELETE /api/staff-admin-assignments/:id                → supprime
 *   GET    /api/staff-admin-assignments/staff/:staffId     → affectations d'un staff
 *   GET    /api/staff-admin-assignments/resolve-levels/:staffId → niveaux administrés par un staff
 * ============================================================================
 */

function resolveTid(tenant: any, tenantIdFallback?: string): string {
  const tid = tenant?.id || tenantIdFallback;
  if (!tid) throw new BadRequestException('Tenant ID requis pour cette opération');
  return tid;
}

@Controller('staff-admin-assignments')
@SkipAcademicYear() // ⭐ Les affectations admin ne sont pas liées à l'année scolaire
export class StaffAdminAssignmentController {
  private readonly logger = new Logger(StaffAdminAssignmentController.name);

  constructor(
    private readonly service: StaffAdminAssignmentService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get()
  async list(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Query('staffId') staffId?: string,
    @Query('schoolLevelCode') schoolLevelCode?: string,
    @Query('adminRole') adminRole?: string,
    @Query('isActive') isActive?: string,
    // ⭐ FIX 2026-09-09 (« bascule d'année globale ») : filtre année — le module
    //    RH (onglet Administration) doit suivre le sélecteur d'année du header.
    @Query('academicYearId') academicYearId?: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.service.list(tid, {
      staffId,
      schoolLevelCode,
      adminRole,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      academicYearId: academicYearId || undefined,
    });
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get('staff/:staffId')
  async getByStaff(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('staffId') staffId: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.service.getByStaff(tid, staffId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get('resolve-levels/:staffId')
  async resolveLevels(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('staffId') staffId: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    const levels = await this.service.resolveAdminLevelsForStaff(tid, staffId);
    return { staffId, levelCodes: levels };
  }

  /**
   * ⭐ GET /staff-admin-assignments/my-context
   * Retourne le contexte administratif de l'utilisateur connecté :
   *   - adminRole (ex: 'DIRECTEUR', 'SURVEILLANT_GENERAL', 'SECRETAIRE')
   *   - schoolLevelCodes (ex: ['SECONDAIRE'] — niveau scolaire strict)
   *   - schoolLevelIds (UUIDs pour filtrer les requêtes)
   *   - modules accessibles (selon BASE_ROLE_PERMISSIONS)
   *
   * Utilisé par le frontend pour :
   *   1. Filtrer la sidebar (modules visibles)
   *   2. Filtrer TOUTES les données par niveau scolaire (élèves, classes, finances, etc.)
   *   3. Adapter le dashboard selon le rôle
   */
  @UseGuards(JwtAuthGuard)
  @Get('my-context')
  async getMyContext(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    if (!tenantId || !user?.id) {
      return { adminRole: null, schoolLevelCodes: [], schoolLevelIds: [], modules: ['dashboard'] };
    }

    // Trouver le Staff lié à cet User (par email)
    const staff = await this.prisma.staff.findFirst({
      where: {
        tenantId,
        email: user.email,
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!staff) {
      // L'utilisateur n'a pas de fiche Staff → il est probablement PROMOTER
      return {
        adminRole: 'PROMOTER',
        schoolLevelCodes: ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE'],
        schoolLevelIds: [],
        modules: ['*'],
        staffId: null,
      };
    }

    // Récupérer les affectations admin actives de ce staff
    const assignments = await this.service.list(tenantId, { staffId: staff.id, isActive: true });

    if (assignments.length === 0) {
      return {
        adminRole: null,
        schoolLevelCodes: [],
        schoolLevelIds: [],
        modules: ['dashboard'],
        staffId: staff.id,
      };
    }

    // Prendre le premier rôle actif (un staff peut avoir plusieurs affectations
    // mais généralement un seul rôle principal par niveau)
    const adminRole = assignments[0].adminRole;

    // Résoudre les niveaux scolaires
    const schoolLevelCodes = await this.service.resolveAdminLevelsForStaff(tenantId, staff.id);

    // Récupérer les UUIDs des school_levels pour le filtrage des requêtes
    //    schoolLevelCodes sont déjà en format français (PRIMAIRE, SECONDAIRE) — pas besoin de conversion
    const schoolLevelIds = await this.prisma.schoolLevel.findMany({
      where: {
        tenantId,
        code: { in: schoolLevelCodes },
      },
      select: { id: true, code: true },
    });

    this.logger.log(`my-context: user=${user.email}, staff=${staff.id}, role=${adminRole}, levels=${schoolLevelCodes.join(',')}`);

    // ⭐ Récupérer les accréditations supplémentaires (modules accordés par le promoteur)
    const accreditations = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT module FROM staff_accreditations WHERE "tenantId" = $1 AND "staffId" = $2 AND "isActive" = true`,
      [tenantId, staff.id],
    );
    const extraModules = accreditations.map(a => a.module);

    return {
      adminRole,
      schoolLevelCodes,
      schoolLevelIds: schoolLevelIds.map(s => s.id),
      staffId: staff.id,
      extraModules, // Modules supplémentaires accordés par le promoteur
      assignments: assignments.map(a => ({
        id: a.id,
        adminRole: a.adminRole,
        schoolLevelCode: a.schoolLevelCode,
        functionLabel: a.functionLabel,
      })),
    };
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get(':id')
  async getById(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.service.getById(tid, id);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Post()
  async create(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Body() body: {
      staffId: string;
      schoolLevelCode: string;
      adminRole: string;
      /// ⭐ Piste du poste : UUID AcademicTrack ('FR' ou 'EN') | null/omis = les deux pistes (D1).
      ///    Alternative : academicTrackCode 'FR' | 'EN' (résolu serveur).
      academicTrackId?: string | null;
      academicTrackCode?: string | null;
      academicYearId?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    if (!body?.staffId || !body?.schoolLevelCode || !body?.adminRole) {
      throw new BadRequestException('staffId, schoolLevelCode et adminRole sont requis');
    }
    return this.service.create(tid, {
      staffId: body.staffId,
      schoolLevelCode: body.schoolLevelCode,
      adminRole: body.adminRole,
      academicTrackId: body.academicTrackId ?? null,
      academicTrackCode: body.academicTrackCode ?? null,
      academicYearId: body.academicYearId,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Put(':id')
  async update(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('id') id: string,
    @Body() body: {
      schoolLevelCode?: string;
      adminRole?: string;
      /// ⭐ Piste : UUID AcademicTrack | null (= retour bi-piste) | omis (= inchangé).
      ///    Alternative : academicTrackCode 'FR' | 'EN' | null (résolu serveur).
      academicTrackId?: string | null;
      academicTrackCode?: string | null;
      academicYearId?: string | null;
      startDate?: string;
      endDate?: string | null;
      isActive?: boolean;
    },
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.service.update(tid, id, {
      schoolLevelCode: body.schoolLevelCode,
      adminRole: body.adminRole,
      academicTrackId: body.academicTrackId,
      academicTrackCode: body.academicTrackCode,
      academicYearId: body.academicYearId,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      isActive: body.isActive,
    });
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Delete(':id')
  async delete(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    await this.service.delete(tid, id);
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ACCRÉDITATIONS — Le promoteur donne des modules supplémentaires à un staff
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Modules accréditables — alignés sur les clés de pathToModuleKey du
   * front (hooks/useAdminContext) qui pilotent le gating de la sidebar :
   * un module ici = un module débloqué dans le menu du staff accrédité.
   */
  static readonly ACCREDITATION_MODULES = [
    'finance',      // Finances & Économat
    'hr',           // Personnel RH
    'pedagogy',     // Espace Pédagogique / Organisation Pédagogique
    'exams',        // Examens & Bulletins
    'students',     // Élèves
    'communication',// Helm Connect
    'discipline',   // Vie Scolaire
    'censeur',      // Espace Censeur
    'director',     // Espace Directeur
    'settings',     // Paramètres
  ];

  /**
   * GET /staff-admin-assignments/accreditations/overview
   * ⭐ 2026-09-16 — Vue d'ensemble des accréditations ACTIVES du tenant
   *    (avec noms des staff) pour l'UI d'administration RH.
   *    Déclarée AVANT @Get(':id') pour ne pas être capturée par :id.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('PROMOTEUR', 'PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'PLATFORM_OWNER', 'SUPER_DIRECTOR')
  @Get('accreditations/overview')
  async accreditationsOverview(
    @TenantId() tenantId: string,
  ) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT sa.module, sa."grantedAt", s.id AS "staffId",
              s."firstName", s."lastName", s.email, s.position, s."roleType"
       FROM staff_accreditations sa
       JOIN staff s ON s.id = sa."staffId"
       WHERE sa."tenantId" = $1 AND sa."isActive" = true
       ORDER BY s."lastName" ASC, s."firstName" ASC, sa.module ASC`,
      [tenantId],
    );
    return rows;
  }

  /**
   * GET /staff-admin-assignments/:staffId/accreditations
   * Liste les accréditations (modules supplémentaires) d'un staff.
   */
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Get(':staffId/accreditations')
  async listAccreditations(
    @TenantId() tenantId: string,
    @Param('staffId') staffId: string,
  ) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM staff_accreditations WHERE "tenantId" = $1 AND "staffId" = $2 AND "isActive" = true`,
      [tenantId, staffId],
    );
    return rows;
  }

  /**
   * POST /staff-admin-assignments/:staffId/accreditations
   * Accorde un module supplémentaire à un staff (promoteur / direction only).
   * Body: { module } — voir ACCREDITATION_MODULES.
   * ⭐ 2026-09-16 : liste étendue (10 modules) + vérification (a) rôle promoteur
   *    via @Roles, (b) staffId appartient bien au tenant.
   */
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('PROMOTEUR', 'PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'PLATFORM_OWNER', 'SUPER_DIRECTOR')
  @Post(':staffId/accreditations')
  async grantAccreditation(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('staffId') staffId: string,
    @Body() body: { module: string },
  ) {
    const VALID_MODULES = StaffAdminAssignmentController.ACCREDITATION_MODULES;
    if (!body.module || !VALID_MODULES.includes(body.module)) {
      throw new BadRequestException(`Module invalide. Valeurs acceptées: ${VALID_MODULES.join(', ')}`);
    }

    // ⭐ Vérifier que le staff appartient bien à ce tenant (anti cross-tenant)
    const staff = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, "firstName", "lastName" FROM staff WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
      [staffId, tenantId],
    );
    if (!staff || staff.length === 0) {
      throw new BadRequestException('Membre du personnel introuvable dans votre établissement.');
    }

    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO staff_accreditations (id, "tenantId", "staffId", module, granted_by, "isActive")
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT ("tenantId", "staffId", module) DO UPDATE SET "isActive" = true, "updatedAt" = now()`,
      [id, tenantId, staffId, body.module, user?.id || '00000000-0000-0000-0000-000000000000'],
    );

    this.logger.log(
      `Accreditation granted: staff=${staff[0].firstName} ${staff[0].lastName} (${staffId}), module=${body.module}, by=${user?.id}`,
    );
    return { id, success: true, module: body.module };
  }

  /**
   * DELETE /staff-admin-assignments/:staffId/accreditations/:module
   * Retire un module supplémentaire d'un staff (promoteur / direction only).
   */
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('PROMOTEUR', 'PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'PLATFORM_OWNER', 'SUPER_DIRECTOR')
  @Delete(':staffId/accreditations/:module')
  async revokeAccreditation(
    @TenantId() tenantId: string,
    @Param('staffId') staffId: string,
    @Param('module') module: string,
  ) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE staff_accreditations SET "isActive" = false, "updatedAt" = now()
       WHERE "tenantId" = $1 AND "staffId" = $2 AND module = $3`,
      [tenantId, staffId, module],
    );
    this.logger.log(`Accreditation revoked: staff=${staffId}, module=${module}`);
    return { success: true };
  }
}
