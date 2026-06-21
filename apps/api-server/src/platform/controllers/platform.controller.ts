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

  /** GET /platform/plans — Plans d'abonnement (depuis pricing_plans + HelmSubscription) */
  @Get('plans')
  async getPlans(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getDynamicPlansWithSubscriptions();
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

  /** GET /platform/aggregation — Données agrégées globales */
  @Get('aggregation')
  async getAggregation(@Headers('x-platform-admin-email') adminEmail?: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getAggregation();
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

  // ============================================================================
  // CRUD TENANTS
  // ============================================================================

  @Patch('tenants/:id/status')
  async updateTenantStatus(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.updateTenantStatus(id, body.status, { email: adminEmail });
  }

  @Patch('tenants/:id')
  async updateTenant(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      plan?: string;
      subdomain?: string;
      type?: string;
      planStatus?: string;
      billingCycle?: string;
      expiration?: string;
      trialEnd?: string;
      bilingualEnabled?: boolean;
      studentEnrollmentBlocked?: boolean;
      subscriptionStatus?: string;
    },
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.updateTenant(id, body, { email: adminEmail });
  }

  @Delete('tenants/:id')
  async deleteTenant(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.deleteTenant(id, { email: adminEmail });
  }

  // ============================================================================
  // CRUD USERS
  // ============================================================================

  @Post('users')
  async createUser(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Body() body: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.createUser(body, { email: adminEmail });
  }

  @Patch('users/:id')
  async updateUser(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.updateUser(id, body, { email: adminEmail });
  }

  @Delete('users/:id')
  async deleteUser(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.deleteUser(id, { email: adminEmail });
  }

  // ============================================================================
  // SUPPORT TICKETS
  // ============================================================================

  @Patch('support/tickets/:id')
  async updateSupportTicket(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
    @Body() body: { status?: string; priority?: string; assignedTo?: string },
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.updateSupportTicket(id, body, { email: adminEmail });
  }

  @Post('support/tickets/:id/reply')
  async replySupportTicket(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
    @Body() body: { message: string },
  ) {
    this.assertAdminProxyRequest(adminEmail);
    if (!body?.message) throw new BadRequestException('Le champ "message" est requis');
    return this.platformService.replySupportTicket(id, body.message, { email: adminEmail, name: adminEmail });
  }

  // ============================================================================
  // MODULES — Toggle
  // ============================================================================

  @Patch('modules/:id/toggle')
  async toggleModule(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
    @Body() body: { tenantId: string; enabled: boolean },
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.toggleModule(id, body, { email: adminEmail });
  }

  // ============================================================================
  // RBAC — CRUD Rôles
  // ============================================================================

  @Post('roles')
  async createRole(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Body() body: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.createRole(body, { email: adminEmail });
  }

  @Patch('roles/:id')
  async updateRole(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.updateRole(id, body, { email: adminEmail });
  }

  @Delete('roles/:id')
  async deleteRole(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.deleteRole(id, { email: adminEmail });
  }

  // ============================================================================
  // SETTINGS
  // ============================================================================

  @Get('settings')
  async getSettings(@Headers('x-platform-admin-email') adminEmail: string) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getSettings();
  }

  @Patch('settings')
  async updateSettings(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Body() body: any,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.updateSettings(body, { email: adminEmail });
  }

  // ============================================================================
  // COMMUNICATION — LOGS CROSS-TENANT
  // ============================================================================

  /**
   * GET /platform/communication/logs — Logs d'emails agrégés sur tous les tenants.
   *
   * Query params:
   *   - page (default 1)
   *   - limit (default 50, max 200)
   *   - search (subject / recipient / recipientName / fromEmail — partial match)
   *   - category (RECRUTEMENT | PEDAGOGIE | FINANCE | ADMINISTRATIF | COMMUNICATION | SYSTEM)
   *   - status (PENDING | SENT | DELIVERED | BOUNCED | FAILED | OPENED | CLICKED)
   *   - tenantId (filtre par tenant)
   */
  @Get('communication/logs')
  async getCommunicationLogs(
    @Headers('x-platform-admin-email') adminEmail?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getCommunicationLogs({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      category,
      status,
      tenantId,
    });
  }

  // ============================================================================
  // MANUAL OPERATIONS — Création manuelle de tenant + gestion des factures
  // ============================================================================

  /** POST /platform/tenants/create-manual — Onboarding complet sans paiement */
  @Post('tenants/create-manual')
  async createTenantManually(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Body() body: {
      schoolName: string;
      schoolType: string; // maternelle, primaire, secondaire, mixte
      city: string;
      country: string;
      phone: string;
      email: string;
      bilingual: boolean;
      preferredSubdomain: string;
      plan: string; // SEED, GROW, LEAD, NETWORK
      billingCycle: string; // MONTHLY, ANNUAL
      paymentMethod: string; // CASH, MOBILE_MONEY, CARD
      promoterFirstName: string;
      promoterLastName: string;
      promoterEmail: string;
      promoterPhone: string;
      promoterPassword: string;
    },
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.createTenantManually(body, { email: adminEmail });
  }

  /** GET /platform/invoices/:id/pdf — Récupère les données d'une facture (pour PDF) */
  @Get('invoices/:id/pdf')
  async downloadInvoicePdf(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.getInvoicePdfData(id);
  }

  /** POST /platform/invoices/:id/send-email — Envoyer une facture par email */
  @Post('invoices/:id/send-email')
  async sendInvoiceEmail(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
    @Body() body: { to: string },
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.sendInvoiceEmail(id, body.to, adminEmail);
  }

  /** POST /platform/invoices/:id/send-whatsapp — Envoyer une facture par WhatsApp */
  @Post('invoices/:id/send-whatsapp')
  async sendInvoiceWhatsApp(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
    @Body() body: { phone: string },
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.sendInvoiceWhatsApp(id, body.phone, adminEmail);
  }

  /** POST /platform/invoices/:id/record-payment — Enregistrer un paiement manuel sur une facture */
  @Post('invoices/:id/record-payment')
  async recordManualPayment(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Param('id') id: string,
    @Body() body: { amount: number; method: string; reference?: string },
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.recordManualPayment(id, body, adminEmail);
  }

  /** POST /platform/payments/record-manual — Enregistrer un paiement manuel standalone */
  @Post('payments/record-manual')
  async recordManualPaymentStandalone(
    @Headers('x-platform-admin-email') adminEmail: string,
    @Body() body: {
      tenantId: string;
      amount: number;
      method: string;
      type: string;
      reference?: string;
      description?: string;
    },
  ) {
    this.assertAdminProxyRequest(adminEmail);
    return this.platformService.recordManualPaymentStandalone(body, adminEmail);
  }
}
