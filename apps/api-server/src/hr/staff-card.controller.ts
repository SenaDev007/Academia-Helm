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
}

@Controller('staff-card')
export class StaffCardPublicController {
  constructor(private svc: StaffCardService) {}
  @Public() @Get(':token') async getByToken(@Param('token') token: string) { return this.svc.getCardByToken(token); }
}
