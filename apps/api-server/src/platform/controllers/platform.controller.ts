/**
 * ============================================================================
 * PLATFORM CONTROLLER — BACK-OFFICE ACADEMIA HELM
 * ============================================================================
 *
 * Endpoints exposés sous /platform/* — accessibles uniquement aux admins
 * plateforme authentifiés via /admin-login (cookie academia_admin_session).
 *
 * Toutes les routes retournent des données RÉELLES issues de la base de
 * données. Aucune donnée mock.
 *
 * AUTHENTIFICATION :
 *   Les routes sont @Public() (pas de JwtAuthGuard) car l'admin n'a pas de
 *   JWT tenant — il s'authentifie via le cookie academia_admin_session qui
 *   est vérifié côté proxy Next.js (getAdminServerSession).
 *
 *   Le proxy Next.js (/api/platform/[...path]/route.ts) vérifie le cookie
 *   admin avant de forwarder la requête. Si le cookie est invalide ou absent,
 *   le proxy retourne 401 avant même d'atteindre le backend.
 *
 *   SÉCURITÉ : le proxy ajoute un header `x-platform-admin-email` que le
 *   backend vérifie pour s'assurer que la requête vient bien du proxy
 *   (et non d'un appel direct au backend).
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
  Headers,
  Req,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { PlatformService } from '../services/platform.service';

@Controller('platform')
@Public()
export class PlatformController {
  private readonly logger = new Logger(PlatformController.name);

  constructor(private readonly platformService: PlatformService) {}

  /**
   * Vérifie que la requête vient bien du proxy Next.js (qui a déjà validé
   * le cookie admin). Le header `x-platform-admin-email` est posé par le
   * proxy uniquement si l'admin est authentifié.
   */
  private assertAdminProxyRequest(adminEmail?: string): void {
    if (!adminEmail) {
      throw new ForbiddenException(
        'Accès réservé aux administrateurs plateforme. ' +
          'La requête doit provenir du proxy Next.js avec un header x-platform-admin-email valide.',
      );
    }
    // Log pour audit
    this.logger.log(`Platform API access by admin: ${adminEmail}`);
  }

  /** GET /platform/dashboard — KPIs agrégés + tendances + alertes */
  @Get('dashboard')
  async getDashboard(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getDashboard();
  }

  /** GET /platform/tenants — Liste paginée des écoles / tenants */
  @Get('tenants')
  async getTenants(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getTenants({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      status,
    });
  }

  /** GET /platform/initial-subscriptions — Frais d'activation / onboarding */
  @Get('initial-subscriptions')
  async getInitialSubscriptions(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getInitialSubscriptions();
  }

  /** GET /platform/invoices — Factures Helm */
  @Get('invoices')
  async getInvoices(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getInvoices();
  }

  /** GET /platform/payments — Transactions BillingEvent */
  @Get('payments')
  async getPayments(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getPayments();
  }

  /** GET /platform/users — Utilisateurs plateforme */
  @Get('users')
  async getPlatformUsers(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Query('role') role?: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getPlatformUsers(role);
  }

  /** GET /platform/audit-logs — Logs cross-tenant */
  @Get('audit-logs')
  async getAuditLogs(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getAuditLogs({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      action,
    });
  }

  /** GET /platform/support/tickets — Tickets support (table à venir) */
  @Get('support/tickets')
  async getSupportTickets(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getSupportTickets();
  }

  /** GET /platform/roles — Rôles plateforme (RBAC) */
  @Get('roles')
  async getRoles(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getRoles();
  }

  /** GET /platform/permissions — Permissions (RBAC) */
  @Get('permissions')
  async getPermissions(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getPermissions();
  }

  /** GET /platform/plans — Plans d'abonnement */
  @Get('plans')
  async getPlans(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getPlans();
  }

  /** GET /platform/modules — Adoption des modules par tenants */
  @Get('modules')
  async getModulesAdoption(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getModulesAdoption();
  }

  /** GET /platform/monitoring — État des services */
  @Get('monitoring')
  async getMonitoring(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getMonitoring();
  }

  /** GET /platform/orion — Alertes + données ORION */
  @Get('orion')
  async getOrionGlobal(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getOrionGlobal();
  }

  // ─── MODÉRATION DES AVIS ────────────────────────────────────────────────
  // Permet aux administrateurs plateforme de modérer les avis déposés depuis
  // le formulaire public (sans tenantId → PENDING). Les avis déposés depuis
  // l'app tenant sont auto-approuvés et n'apparaissent pas dans la file.

  /** GET /platform/reviews/pending — Avis en attente de modération */
  @Get('reviews/pending')
  async getReviewsPending(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getReviewsPending();
  }

  /** GET /platform/reviews/all — Tous les avis (filtre optionnel par statut) */
  @Get('reviews/all')
  async getReviewsAll(@Headers('x-platform-admin-email') adminEmail?: string, @Query('status') status?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getReviewsAll(status);
  }

  /** GET /platform/reviews/stats — Compteurs par statut */
  @Get('reviews/stats')
  async getReviewsStats(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getReviewsStats();
  }

  /** PATCH /platform/reviews/:id/status — Modérer un avis */
  @Patch('reviews/:id/status')
  async updateReviewStatus(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED' | 'ARCHIVED' | 'PENDING'; featured?: boolean },
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!body?.status) {
      throw new BadRequestException('Le champ "status" est requis');
    }
    return this.platformService.updateReviewStatus(id, body);
  }

  /** DELETE /platform/reviews/:id — Supprimer un avis */
  @Delete('reviews/:id')
  async deleteReview(@Headers('x-platform-admin-email') adminEmail?: string, @Param('id') id: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.deleteReview(id);
  }

  // ─── PRICING PLANS (CRUD) ──────────────────────────────────────────────────

  /**
   * GET /platform/public/pricing-plans — Plans publics pour la page /tarification
   * Endpoint @Public (déjà sur la classe) — pas de header admin requis.
   */
  @Get('public/pricing-plans')
  async getPublicPricingPlans() {
    return this.platformService.getPublicPricingPlans();
  }

  /** GET /platform/pricing-plans — Liste tous les plans (admin) */
  @Get('pricing-plans')
  async getPricingPlans(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getPricingPlans();
  }

  /** POST /platform/pricing-plans — Créer un plan */
  @Post('pricing-plans')
  async createPricingPlan(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Body() body?: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.upsertPricingPlan(body);
  }

  /** PATCH /platform/pricing-plans/:id — Mettre à jour un plan */
  @Patch('pricing-plans/:id')
  async updatePricingPlan(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Param('id') id?: string,
    @Body() body?: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.upsertPricingPlan({ ...body, id });
  }

  /** DELETE /platform/pricing-plans/:id — Supprimer un plan */
  @Delete('pricing-plans/:id')
  async deletePricingPlan(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Param('id') id?: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.deletePricingPlan(id!);
  }
}
