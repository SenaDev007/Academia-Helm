/**
 * FederisUsersController — Gestion des comptes membres (Academia Federis)
 *
 * Réservé au COORDONNATEUR du patronat (garde côté service) :
 *   GET   /federis/patronat/users                     — liste des membres
 *   POST  /federis/patronat/users                     — créer un compte membre
 *   PATCH /federis/patronat/users/:id                 — fonction / état / identité
 *   POST  /federis/patronat/users/:id/reset-password  — réinitialiser le mot de passe
 */

import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import {
  FederisUsersService,
  CreatePatronatUserDto,
  UpdatePatronatUserDto,
  ResetPatronatUserPasswordDto,
} from './federis-users.service';

@Controller('federis')
export class FederisUsersController {
  constructor(private readonly usersService: FederisUsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('patronat/users')
  async listUsers(@Req() req: any) {
    return this.usersService.listUsers(req.user.tenantId, req.user.id || req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('patronat/users')
  async createUser(@Req() req: any, @Body() dto: CreatePatronatUserDto) {
    return this.usersService.createUser(req.user.tenantId, req.user.id || req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('patronat/users/:id')
  async updateUser(@Req() req: any, @Body() dto: UpdatePatronatUserDto) {
    return this.usersService.updateUser(
      req.user.tenantId,
      req.user.id || req.user.sub,
      req.params.id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('patronat/users/:id/reset-password')
  async resetPassword(@Req() req: any, @Body() dto: ResetPatronatUserPasswordDto) {
    return this.usersService.resetPassword(
      req.user.tenantId,
      req.user.id || req.user.sub,
      req.params.id,
      dto,
    );
  }
}
