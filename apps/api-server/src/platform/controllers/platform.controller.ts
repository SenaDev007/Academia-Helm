/**
 * ============================================================================
 * PLATFORM CONTROLLER — BACK-OFFICE ACADEMIA HELM
 * ============================================================================
 *
 * Endpoints exposés sous /platform/* — accessibles uniquement aux rôles
 * plateforme (PLATFORM_OWNER, PLATFORM_SUPER_ADMIN, PLATFORM_ADMIN, SUPER_ADMIN).
 *
 * Toutes les routes retournent des données RÉELLES issues de la base de
 * données. Aucune donnée mock.
 *
 * Le guard d'authentification est JwtAuthGuard (depuis api-server). Le guard
 * métier (vérification du rôle plateforme) est appliqué dans le service via
 * assertPlatformRole(user) — cela évite toute dépendance circulaire avec les
 * guards tenant-scopés.
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformService } from '../services/platform.service';

@Controller('platform')
@UseGuards(JwtAuthGuard)
export class PlatformController {
  private readonly logger = new Logger(PlatformController.name);

  constructor(private readonly platformService: PlatformService) {}

  /** GET /platform/dashboard — KPIs agrégés + tendances + alertes */
  @Get('dashboard')
  async getDashboard(@Req() req: any) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getDashboard();
  }

  /** GET /platform/tenants — Liste paginée des écoles / tenants */
  @Get('tenants')
  async getTenants(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getTenants({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      status,
    });
  }

  /** GET /platform/initial-subscriptions — Frais d'activation / onboarding */
  @Get('initial-subscriptions')
  async getInitialSubscriptions(@Req() req: any) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getInitialSubscriptions();
  }

  /** GET /platform/invoices — Factures Helm */
  @Get('invoices')
  async getInvoices(@Req() req: any) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getInvoices();
  }

  /** GET /platform/payments — Transactions BillingEvent */
  @Get('payments')
  async getPayments(@Req() req: any) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getPayments();
  }

  /** GET /platform/users — Utilisateurs plateforme */
  @Get('users')
  async getPlatformUsers(
    @Req() req: any,
    @Query('role') role?: string,
  ) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getPlatformUsers(role);
  }

  /** GET /platform/audit-logs — Logs cross-tenant */
  @Get('audit-logs')
  async getAuditLogs(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
  ) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getAuditLogs({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      action,
    });
  }

  /** GET /platform/support/tickets — Tickets support (table à venir) */
  @Get('support/tickets')
  async getSupportTickets(@Req() req: any) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getSupportTickets();
  }

  /** GET /platform/roles — Rôles plateforme (RBAC) */
  @Get('roles')
  async getRoles(@Req() req: any) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getRoles();
  }

  /** GET /platform/permissions — Permissions (RBAC) */
  @Get('permissions')
  async getPermissions(@Req() req: any) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getPermissions();
  }

  /** GET /platform/plans — Plans d'abonnement */
  @Get('plans')
  async getPlans(@Req() req: any) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getPlans();
  }

  /** GET /platform/modules — Adoption des modules par tenants */
  @Get('modules')
  async getModulesAdoption(@Req() req: any) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getModulesAdoption();
  }

  /** GET /platform/monitoring — État des services */
  @Get('monitoring')
  async getMonitoring(@Req() req: any) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getMonitoring();
  }

  /** GET /platform/orion — Alertes + données ORION */
  @Get('orion')
  async getOrionGlobal(@Req() req: any) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getOrionGlobal();
  }

  // ─── MODÉRATION DES AVIS ────────────────────────────────────────────────
  // Permet aux administrateurs plateforme de modérer les avis déposés depuis
  // le formulaire public (sans tenantId → PENDING). Les avis déposés depuis
  // l'app tenant sont auto-approuvés et n'apparaissent pas dans la file.

  /** GET /platform/reviews/pending — Avis en attente de modération */
  @Get('reviews/pending')
  async getReviewsPending(@Req() req: any) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getReviewsPending();
  }

  /** GET /platform/reviews/all — Tous les avis (filtre optionnel par statut) */
  @Get('reviews/all')
  async getReviewsAll(@Req() req: any, @Query('status') status?: string) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getReviewsAll(status);
  }

  /** GET /platform/reviews/stats — Compteurs par statut */
  @Get('reviews/stats')
  async getReviewsStats(@Req() req: any) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.getReviewsStats();
  }

  /** PATCH /platform/reviews/:id/status — Modérer un avis */
  @Patch('reviews/:id/status')
  async updateReviewStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED' | 'ARCHIVED' | 'PENDING'; featured?: boolean },
  ) {
    this.platformService.assertPlatformRole(req.user);
    if (!body?.status) {
      throw new BadRequestException('Le champ "status" est requis');
    }
    return this.platformService.updateReviewStatus(id, body);
  }

  /** DELETE /platform/reviews/:id — Supprimer un avis */
  @Delete('reviews/:id')
  async deleteReview(@Req() req: any, @Param('id') id: string) {
    this.platformService.assertPlatformRole(req.user);
    return this.platformService.deleteReview(id);
  }
}
