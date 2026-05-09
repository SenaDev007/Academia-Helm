import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { PatronatService } from './patronat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('patronat')
@UseGuards(JwtAuthGuard)
export class PatronatController {
  constructor(private readonly patronatService: PatronatService) {}

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
}
