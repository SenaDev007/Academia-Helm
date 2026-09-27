/**
 * FederisPatronatController — Routes patronat Academia Federis
 *
 * Routes publiques (sous-domaine academiafederis.academiahelm.com) :
 *   GET  /federis/public/countries          — pays + niveaux territoriaux
 *   GET  /federis/public/national-patronats — patronats nationaux (rattachement)
 *   POST /federis/public/register           — création de compte patronat
 *   POST /federis/public/fedapay/webhook    — webhook Fedapay (activation auto)
 *
 * Routes protégées (JWT) :
 *   GET  /federis/patronat/profile          — profil + abonnement
 *   GET  /federis/patronat/dashboard        — cockpit institutionnel + ORION
 *   GET  /federis/patronat/children         — patronats territoriaux (national)
 *   POST /federis/patronat/children         — créer un patronat territorial
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
} from './federis-patronat.service';

@Controller('federis')
export class FederisPatronatController {
  private readonly logger = new Logger(FederisPatronatController.name);

  constructor(
    private readonly registerService: FederisRegisterService,
    private readonly patronatService: FederisPatronatService,
    private readonly fedapayService: FederisFedapayService,
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

  @UseGuards(JwtAuthGuard)
  @Get('patronat/schools/search')
  async searchHelmSchools(@Query('q') q?: string) {
    return this.patronatService.searchHelmSchools(q ?? '');
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
