/**
 * FederisPatronatController — Routes patronat Academia Federis
 *
 * Routes publiques (sous-domaine academiafederis.academiahelm.com) :
 *   GET  /federis/public/countries          — pays + niveaux territoriaux
 *   GET  /federis/public/national-patronats — patronats nationaux (rattachement)
 *   POST /federis/public/register           — création de compte patronat
 *   GET  /federis/public/patronat-info/:subdomain — landing page patronat
 *   GET  /federis/public/checkout/by-transaction/:transactionId — lookup Fedapay
 *   POST /federis/public/checkout/verify    — vérification réelle + activation
 *   POST /federis/public/fedapay/webhook    — webhook Fedapay (activation auto)
 *
 * Routes protégées (JWT) :
 *   GET  /federis/patronat/profile          — profil + abonnement
 *   GET  /federis/patronat/dashboard        — cockpit institutionnel + ORION
 *   GET  /federis/patronat/identity         — identité publique (nom, logo…)
 *   PATCH/federis/patronat/identity         — configurer nom + logo (coord.)
 *   GET  /federis/patronat/children         — patronats territoriaux (national)
 *   POST /federis/patronat/children         — créer un patronat territorial
 *   GET  /federis/patronat/territorial-levels — niveaux configurés (national)
 *   GET  /federis/patronat/pricing          — barème par niveau organisationnel
 *   GET  /federis/patronat/schools          — écoles rattachées
 *   GET  /federis/patronat/schools/search   — recherche écoles Academia Helm
 *   POST /federis/patronat/schools/request-link
 *   POST /federis/patronat/schools/manual
 *   GET  /federis/patronat/subscription     — abonnement + factures
 *   POST /federis/patronat/checkout         — init paiement Fedapay
 */

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { Request } from 'express';
import { FederisRegisterService } from './federis-register.service';
import { FederisFedapayService } from './federis-fedapay.service';
import {
  FederisPatronatService,
  CreateChildPatronatDto,
  RequestSchoolLinkDto,
  CreateManualSchoolDto,
  InitCheckoutDto,
  UpdatePatronatIdentityDto,
} from './federis-patronat.service';
// ⭐ Répertoire officiel des établissements (2026-09-30) — suggestions
//    départementales pour écoles provisoires & centres d'examen.
import {
  FederisSchoolDirectoryService,
  CreateProvisionalSchoolDto,
} from './federis-school-directory.service';

@Controller('federis')
export class FederisPatronatController {
  private readonly logger = new Logger(FederisPatronatController.name);

  constructor(
    private readonly registerService: FederisRegisterService,
    private readonly patronatService: FederisPatronatService,
    private readonly fedapayService: FederisFedapayService,
    private readonly schoolDirectoryService: FederisSchoolDirectoryService,
  ) {}

  // ══════════════════════════ ROUTES PUBLIQUES ══════════════════════════

  /** Pays actifs avec niveaux territoriaux configurés (formulaire /register). */
  @Public()
  @Get('public/countries')
  async getCountries() {
    return this.registerService.getCountriesWithLevels();
  }

  /** Patronats nationaux actifs — sélection du rattachement à l'inscription. */
  @Public()
  @Get('public/national-patronats')
  async getNationalPatronats(@Query('countryId') countryId?: string) {
    return this.registerService.getNationalPatronats(countryId);
  }

  /** Création de compte patronat (3 étapes du cahier des charges §6.3). */
  @Public()
  @Post('public/register')
  async register(@Body() dto: any) {
    return this.registerService.registerPatronat(dto);
  }

  /**
   * ⭐ Infos PUBLIQUES d'un patronat par sous-domaine (landing page
   * patronatxxx.academiahelm.com — pattern /tenants/by-subdomain Helm).
   */
  @Public()
  @Get('public/patronat-info/:subdomain')
  async getPublicPatronatInfo(@Param('subdomain') subdomain: string) {
    return this.registerService.getPublicPatronatBySubdomain(subdomain);
  }

  /**
   * ⭐ Retrouve une facture depuis l'ID numérique Fedapay (pattern Helm
   * /onboarding/payment/by-transaction/:transactionId).
   *
   * FedaPay redirige après paiement vers /checkout/success?id=470323&status=approved
   * SANS préserver les query params d'origine (invoiceId) — la page succès
   * appelle cet endpoint pour retrouver la facture puis la vérifier.
   */
  @Public()
  @Get('public/checkout/by-transaction/:transactionId')
  async findInvoiceByTransactionId(@Param('transactionId') transactionId: string) {
    return this.fedapayService.findInvoiceByTransactionId(transactionId);
  }

  /**
   * ⭐ Vérification post-paiement (pattern Helm POST /onboarding/payment/:id/verify).
   *
   * ⚠️ CRITIQUE : interroge l'API Fedapay RÉELLE ; si la transaction est
   * approuvée → activation idempotente de l'abonnement + attribution du
   * sous-domaine patronat + email identifiants. Le frontend ne doit JAMAIS
   * se fier au seul retour navigateur de Fedapay.
   *
   * Body : { invoiceId? , transactionId? } — au moins un des deux.
   */
  @Public()
  @Post('public/checkout/verify')
  @HttpCode(HttpStatus.OK)
  async verifyCheckoutPayment(@Body() body: { invoiceId?: string; transactionId?: string }) {
    return this.fedapayService.verifyInvoicePayment(body ?? {});
  }

  /**
   * Webhook Fedapay — abonnements patronat Academia Federis.
   *
   * ⚠️ CRITIQUE : route publique, vérification de signature obligatoire
   * (MÊME PATTERN QUE HELM — billing/fedapay/webhook).
   *
   * Endpoint : POST /federis/public/fedapay/webhook
   * URL publique prod : https://api.academiahelm.com/api/federis/public/fedapay/webhook
   *
   * transaction.approved / completed → activation automatique de
   * l'abonnement (facture PAYEE + patronat ACTIVE + tenant actif).
   */
  @Public()
  @Post('public/fedapay/webhook')
  @HttpCode(HttpStatus.OK)
  async handleFedapayWebhook(
    @Headers('x-fedapay-signature') xFedaPaySignature: string | string[] | undefined,
    @Body() body: any,
    @Req() req: Request,
  ) {
    // Fedapay signe le body BRUT : req.rawBody est rempli par le middleware
    // global (main.ts) — jamais JSON.stringify(body) en premier choix.
    const rawBody =
      (req as any).rawBody != null
        ? Buffer.isBuffer((req as any).rawBody)
          ? (req as any).rawBody.toString('utf8')
          : String((req as any).rawBody)
        : typeof body === 'string'
          ? body
          : JSON.stringify(body);

    const fromHeader = Array.isArray(xFedaPaySignature) ? xFedaPaySignature[0] : xFedaPaySignature;
    const signatureRaw =
      fromHeader ??
      (req.headers['x-fedapay-signature'] as string | undefined) ??
      (req.headers['x-signature'] as string | undefined) ??
      (req.headers['signature'] as string | undefined) ??
      (req.headers['x-webhook-signature'] as string | undefined);
    const signatureHeader = Array.isArray(signatureRaw) ? signatureRaw[0] : signatureRaw;

    this.logger.log('=== WEBHOOK FEDAPAY FEDERIS REÇU ===');
    this.logger.log(`Événement : ${body?.name ?? body?.event ?? body?.type}`);

    return this.fedapayService.handleWebhook(rawBody, signatureHeader, body);
  }

  // ══════════════════════════ ROUTES PROTÉGÉES ══════════════════════════

  @UseGuards(JwtAuthGuard)
  @Get('patronat/profile')
  async getProfile(@Req() req: any) {
    return this.patronatService.getProfile(req.user.tenantId, req.user.id || req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('patronat/dashboard')
  async getDashboard(@Req() req: any) {
    return this.patronatService.getDashboard(req.user.tenantId, req.user.id || req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('patronat/children')
  async getChildrenPatronats(@Req() req: any) {
    return this.patronatService.getChildrenPatronats(
      req.user.tenantId,
      req.user.id || req.user.sub,
    );
  }

  /**
   * ⭐ Identité publique du patronat (nom, logo, coordonnées) — onglet
   * « Informations » des Paramètres. Le logo + le nom alimentent la landing
   * page du sous-domaine (personnalisation par patronat).
   */
  @UseGuards(JwtAuthGuard)
  @Get('patronat/identity')
  async getIdentity(@Req() req: any) {
    return this.patronatService.getIdentity(req.user.tenantId, req.user.id || req.user.sub);
  }

  /**
   * ⭐ Configuration de l'identité (nom, logo, coordonnées) — coordonnateur
   * uniquement. Synchronise le nom du Tenant (topbar Helm) et personnalise
   * la landing page du sous-domaine du patronat.
   */
  @UseGuards(JwtAuthGuard)
  @Patch('patronat/identity')
  async updateIdentity(@Req() req: any, @Body() dto: UpdatePatronatIdentityDto) {
    return this.patronatService.updateIdentity(
      req.user.tenantId,
      req.user.id || req.user.sub,
      dto,
    );
  }

  /**
   * ⭐ Niveaux territoriaux configurés sous le pays du national (formulaire
   * de création d'un patronat territorial — Département, Commune…).
   */
  @UseGuards(JwtAuthGuard)
  @Get('patronat/territorial-levels')
  async getTerritorialLevels(@Req() req: any) {
    return this.patronatService.getTerritorialLevels(
      req.user.tenantId,
      req.user.id || req.user.sub,
    );
  }

  /**
   * ⭐ Barème dynamique par niveau organisationnel : l'abonnement du patronat
   * NATIONAL est supérieur à celui des territoriaux / départementaux. Alimente
   * la page checkout (montants réels), y compris quand le national règle
   * l'abonnement d'un patronat territorial créé (?patronatId=…).
   */
  @UseGuards(JwtAuthGuard)
  @Get('patronat/pricing')
  async getPricing(@Req() req: any, @Query('patronatId') patronatId?: string) {
    return this.patronatService.getPricing(
      req.user.tenantId,
      req.user.id || req.user.sub,
      patronatId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('patronat/children')
  async createChildPatronat(@Req() req: any, @Body() dto: CreateChildPatronatDto) {
    return this.patronatService.createChildPatronat(
      req.user.tenantId,
      req.user.id || req.user.sub,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('patronat/schools')
  async getSchools(@Req() req: any) {
    return this.patronatService.getSchools(req.user.tenantId, req.user.id || req.user.sub);
  }

  // ⭐ Fiche détail d'une école rattachée (2026-09-29 #3) — clic sur une
  //    école JOINED : informations de l'établissement (adresse, promoteur…),
  //    niveaux scolaires, effectifs des classes d'examen (Terminale PAR
  //    SÉRIE, CAP PAR FILIÈRE — base de données de l'école) et candidats
  //    officiellement présentés par sous-onglets dynamiques CEP/BEPC/BAC/CAP.
  @UseGuards(JwtAuthGuard)
  @Get('patronat/schools/:schoolTenantId/detail')
  async getSchoolDetail(
    @Req() req: any,
    @Param('schoolTenantId') schoolTenantId: string,
  ) {
    return this.patronatService.getSchoolDetail(
      req.user.tenantId,
      req.user.id || req.user.sub,
      schoolTenantId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('patronat/schools/search')
  async searchHelmSchools(@Query('q') q?: string) {
    return this.patronatService.searchHelmSchools(q ?? '');
  }

  // ⭐ Découverte automatique (2026-09-29) : écoles Academia Helm du même
  //    département (patronat territorial) ou du même pays (patronat national),
  //    avec statut de rattachement — alimente « Écoles de votre territoire ».
  @UseGuards(JwtAuthGuard)
  @Get('patronat/schools/discover')
  async discoverTerritorySchools(@Req() req: any) {
    return this.patronatService.discoverTerritorySchools(
      req.user.tenantId,
      req.user.id || req.user.sub,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('patronat/schools/request-link')
  async requestSchoolLink(@Req() req: any, @Body() dto: RequestSchoolLinkDto) {
    return this.patronatService.requestSchoolLink(
      req.user.tenantId,
      req.user.id || req.user.sub,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('patronat/schools/manual')
  async createManualSchool(@Req() req: any, @Body() dto: CreateManualSchoolDto) {
    return this.patronatService.createManualSchool(
      req.user.tenantId,
      req.user.id || req.user.sub,
      dto,
    );
  }

  // ⭐ RÉPERTOIRE OFFICIEL DES ÉTABLISSEMENTS (2026-09-30) — suggestions du
  //    département du patronat pour créer rapidement une école PROVISOIRE
  //    (module Écoles rattachées) ou désigner un CENTRE d'examen (module
  //    Centres). Sources : répertoires ministériels du Bénin (initial :
  //    1 406 établissements secondaires privés 2022-2023, 12 départements).
  @UseGuards(JwtAuthGuard)
  @Get('patronat/schools/directory/search')
  async searchSchoolDirectory(
    @Req() req: any,
    @Query('q') q?: string,
    @Query('level') level?: string,
    @Query('sector') sector?: string,
  ) {
    const patronat = await this.patronatService.resolvePatronat(
      req.user.tenantId,
      req.user.id || req.user.sub,
    );
    return this.schoolDirectoryService.searchDirectory(patronat, {
      q,
      level,
      sector,
    });
  }

  // ⭐ Création d'une école PROVISOIRE depuis le répertoire officiel : fiche
  //    pré-remplie (nom, commune, directeur, téléphone) + message automatique
  //    du patronat invitant le responsable à créer son école sur Academia
  //    Helm (email si adresse connue, message transmissible sinon).
  @UseGuards(JwtAuthGuard)
  @Post('patronat/schools/provisional')
  async createProvisionalSchool(
    @Req() req: any,
    @Body() dto: CreateProvisionalSchoolDto,
  ) {
    const patronat = await this.patronatService.resolvePatronat(
      req.user.tenantId,
      req.user.id || req.user.sub,
    );
    return this.schoolDirectoryService.createProvisionalSchool(
      patronat,
      req.user.id || req.user.sub,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('patronat/subscription')
  async getSubscription(@Req() req: any) {
    return this.patronatService.getSubscription(req.user.tenantId, req.user.id || req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('patronat/checkout')
  async initCheckout(@Req() req: any, @Body() dto: InitCheckoutDto) {
    return this.patronatService.initCheckout(req.user.tenantId, req.user.id || req.user.sub, dto);
  }
}
