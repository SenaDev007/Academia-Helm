import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
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
   * Génère les cartes professionnelles pour TOUS les personnels actifs en une fois.
   * Body: { cardType?: string } (défaut: PROFESSIONAL)
   * Retourne: { generated: number, failed: number, errors: string[] }
   */
  @Post('cards/generate-all')
  async generateAll(@GetTenant() t: any, @Body() b: { cardType?: string }, @Query('tenantId') tid?: string) {
    return this.svc.generateAllCards(t?.id ?? tid, b?.cardType || 'PROFESSIONAL');
  }

  /**
   * Distribue les cartes par email à tous les personnels ayant une carte active.
   * Body: { staffIds?: string[] } (si omis, tous les personnels avec carte active)
   * Retourne: { sent: number, failed: number, errors: string[] }
   */
  @Post('cards/distribute')
  async distribute(@GetTenant() t: any, @Body() b: { staffIds?: string[] }, @Query('tenantId') tid?: string) {
    return this.svc.distributeCardsByEmail(t?.id ?? tid, b?.staffIds);
  }
}

@Controller('staff-card')
export class StaffCardPublicController {
  constructor(private svc: StaffCardService) {}
  @Public() @Get(':token') async getByToken(@Param('token') token: string) { return this.svc.getCardByToken(token); }
}
