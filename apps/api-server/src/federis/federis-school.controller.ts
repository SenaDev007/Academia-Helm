/**
 * FederisSchoolController — Portail école (Academia Helm côté établissements)
 *
 * Validation des demandes de rattachement émises par les patronats :
 *   GET   /federis/school/patronats               — demandes reçues
 *   POST  /federis/school/patronats/:id/approve   — valider
 *   POST  /federis/school/patronats/:id/reject    — refuser (motif)
 *   POST  /federis/school/patronats/:id/suspend   — suspendre un rattachement
 *
 * Accessible depuis le portail école Helm (page /app/federis) avec le JWT de
 * l'établissement — le tenant SCHOOL est résolu depuis le JWT (pattern Helm).
 */

import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import {
  FederisSchoolService,
  RejectLinkDto,
  SuspendLinkDto,
} from './federis-school.service';

@Controller('federis/school')
export class FederisSchoolController {
  constructor(private readonly schoolService: FederisSchoolService) {}

  @UseGuards(JwtAuthGuard)
  @Get('patronats')
  async listPatronats(@Req() req: any) {
    return this.schoolService.listPatronats(
      req.user.tenantId,
      req.user.id || req.user.sub,
      req.user.role,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('patronats/:id/approve')
  async approve(@Req() req: any, @Param('id') linkId: string) {
    return this.schoolService.approveLink(
      req.user.tenantId,
      req.user.id || req.user.sub,
      req.user.role,
      linkId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('patronats/:id/reject')
  async reject(@Req() req: any, @Param('id') linkId: string, @Body() dto: RejectLinkDto) {
    return this.schoolService.rejectLink(
      req.user.tenantId,
      req.user.id || req.user.sub,
      req.user.role,
      linkId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('patronats/:id/suspend')
  async suspend(@Req() req: any, @Param('id') linkId: string, @Body() dto: SuspendLinkDto) {
    return this.schoolService.suspendLink(
      req.user.tenantId,
      req.user.id || req.user.sub,
      req.user.role,
      linkId,
      dto,
    );
  }
}
