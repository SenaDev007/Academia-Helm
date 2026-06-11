import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { FederisService } from './federis.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('federis')
@UseGuards(JwtAuthGuard)
export class FederisController {
  constructor(private readonly patronatService: FederisService) {}

  @Get('profile')
  async getProfile(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.patronatService.getPatronatProfile(tenantId);
  }

  @Get('schools')
  async getSchools(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.patronatService.getAffiliatedSchools(tenantId);
  }

  @Get('stats/consolidated')
  async getConsolidatedStats(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.patronatService.getConsolidatedStats(tenantId);
  }

  @Get('bureau')
  async getBureau(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.patronatService.getBureauMembers(tenantId);
  }

  @Get('exams/compositions-summary')
  async getCompositionsSummary(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.patronatService.getExamsCompositionSummary(tenantId);
  }

  @Get('exams/deliberations-summary')
  async getDeliberationsSummary(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.patronatService.getExamsDeliberationSummary(tenantId);
  }

  @Get('incidents')
  async getIncidents(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.patronatService.getIncidents(tenantId);
  }

  @Get('subject-vault')
  async getSubjectVault(@Req() req: any) {
    const tenantId = req.user.tenantId;
    // Note: Pourrait nécessiter un examId en query param
    return this.patronatService.getSubjectVault(tenantId, ''); 
  }

  @Get('manual-schools')
  async getManualSchools(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.patronatService.getManualSchools(tenantId);
  }

  @Get('invoices')
  async getInvoices(@Req() req: any) {
    const tenantId = req.user.tenantId;
    return this.patronatService.getInvoices(tenantId);
  }
}
