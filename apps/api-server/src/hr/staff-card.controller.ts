import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards, Res } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { StaffCardService } from './services/staff-card.service';

@Controller('hr/staff')
@UseGuards(JwtAuthGuard, TenantGuard)
export class StaffCardController {
  constructor(private svc: StaffCardService) {}
  @Get(':id/cards') async list(@GetTenant() t: any, @Param('id') id: string, @Query('tenantId') tid?: string) { return this.svc.listCards(id, t?.id ?? tid); }
  @Post(':id/cards/generate') async gen(@GetTenant() t: any, @Param('id') id: string, @Body() b: { cardType?: string }, @Query('tenantId') tid?: string) { return this.svc.getOrCreateCard(id, t?.id ?? tid, b?.cardType || 'PROFESSIONAL'); }
  @Delete('cards/:cardId') async revoke(@GetTenant() t: any, @Param('cardId') id: string, @Query('tenantId') tid?: string) { await this.svc.revokeCard(id, t?.id ?? tid); return { success: true }; }

  /**
   * Télécharge directement le PDF d'une carte (évite les problèmes CORS).
   */
  @Get('cards/:cardId/download')
  async downloadCard(@GetTenant() t: any, @Param('cardId') cardId: string, @Res() res: any, @Query('tenantId') tid?: string) {
    const buffer = await this.svc.downloadCardPdf(cardId, t?.id ?? tid);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="carte_professionnelle.pdf"`,
      'Content-Length': buffer.length,
    });
    return res.send(buffer);
  }

  /**
   * Génère les cartes pour TOUS les personnels actifs.
   */
  @Post('cards/generate-all')
  async generateAll(@GetTenant() t: any, @Body() b: { cardType?: string }, @Query('tenantId') tid?: string) {
    return this.svc.generateAllCards(t?.id ?? tid, b?.cardType || 'PROFESSIONAL');
  }

  /**
   * Distribue les cartes par email.
   */
  @Post('cards/distribute')
  async distribute(@GetTenant() t: any, @Body() b: { staffIds?: string[] }, @Query('tenantId') tid?: string) {
    return this.svc.distributeCardsByEmail(t?.id ?? tid, b?.staffIds);
  }

  /**
   * Récupère TOUTES les cartes actives du tenant (pour trombinoscope).
   */
  @Get('cards/all')
  async listAllCards(@GetTenant() t: any, @Query('tenantId') tid?: string) {
    return this.svc.listAllCards(t?.id ?? tid);
  }
}

@Controller('staff-card')
export class StaffCardPublicController {
  constructor(private svc: StaffCardService) {}
  @Public() @Get(':token') async getByToken(@Param('token') token: string) { return this.svc.getCardByToken(token); }
}
