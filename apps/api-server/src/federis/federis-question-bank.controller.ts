/**
 * FederisQuestionBankController — Banque d'épreuves (Academia Federis)
 *
 * CRUD complet des sujets et documents d'examen (vraies données persistées —
 * remplace l'ancienne page de démonstration) :
 *   GET    /federis/patronat/question-bank        — ressources du patronat
 *   POST   /federis/patronat/question-bank        — recenser une épreuve
 *   PATCH  /federis/patronat/question-bank/:id    — statut / accès / métadonnées
 *   DELETE /federis/patronat/question-bank/:id    — retirer une épreuve
 */

import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  FederisQuestionBankService,
  CreateQuestionBankResourceDto,
  UpdateQuestionBankResourceDto,
} from './federis-question-bank.service';

@Controller('federis')
export class FederisQuestionBankController {
  constructor(private readonly questionBankService: FederisQuestionBankService) {}

  @UseGuards(JwtAuthGuard)
  @Get('patronat/question-bank')
  async listResources(@Req() req: any) {
    return this.questionBankService.listResources(req.user.tenantId, req.user.id || req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('patronat/question-bank')
  async createResource(@Req() req: any, @Body() dto: CreateQuestionBankResourceDto) {
    return this.questionBankService.createResource(
      req.user.tenantId,
      req.user.id || req.user.sub,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('patronat/question-bank/:id')
  async updateResource(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateQuestionBankResourceDto,
  ) {
    return this.questionBankService.updateResource(
      req.user.tenantId,
      req.user.id || req.user.sub,
      id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('patronat/question-bank/:id')
  async deleteResource(@Req() req: any, @Param('id') id: string) {
    return this.questionBankService.deleteResource(
      req.user.tenantId,
      req.user.id || req.user.sub,
      id,
    );
  }
}
