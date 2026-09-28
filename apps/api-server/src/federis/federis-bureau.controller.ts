/**
 * FederisBureauController — Bureau & Membres du patronat (Academia Federis)
 *
 * CRUD complet de la composition du bureau institutionnel (vraies données
 * persistées — remplace l'ancienne page de démonstration) :
 *   GET    /federis/patronat/bureau        — composition du bureau
 *   POST   /federis/patronat/bureau        — ajouter un membre
 *   PATCH  /federis/patronat/bureau/:id    — modifier un membre
 *   DELETE /federis/patronat/bureau/:id    — retirer un membre
 */

import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import {
  FederisBureauService,
  CreateBureauMemberDto,
  UpdateBureauMemberDto,
} from './federis-bureau.service';

@Controller('federis')
export class FederisBureauController {
  constructor(private readonly bureauService: FederisBureauService) {}

  @UseGuards(JwtAuthGuard)
  @Get('patronat/bureau')
  async listBureau(@Req() req: any) {
    return this.bureauService.listBureau(req.user.tenantId, req.user.id || req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('patronat/bureau')
  async createMember(@Req() req: any, @Body() dto: CreateBureauMemberDto) {
    return this.bureauService.createMember(
      req.user.tenantId,
      req.user.id || req.user.sub,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('patronat/bureau/:id')
  async updateMember(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateBureauMemberDto) {
    return this.bureauService.updateMember(
      req.user.tenantId,
      req.user.id || req.user.sub,
      id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('patronat/bureau/:id')
  async deleteMember(@Req() req: any, @Param('id') id: string) {
    return this.bureauService.deleteMember(req.user.tenantId, req.user.id || req.user.sub, id);
  }
}
