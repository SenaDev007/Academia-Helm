/**
 * ============================================================================
 * COMMUNITY MODULE — Academia Community (espace clients & prospects)
 * ============================================================================
 *
 * Module plateforme (hors tenant) : l'espace communautaire DANS le produit
 * Academia Helm — la stratégie marketing « on utilise notre propre produit ».
 *
 * Référence fonctionnelle : Yeshua Connect (Mouvement-Christ-Libere) :
 * canaux, rôles, réactions, sondages, posts programmés.
 * Différenciation business (aller au-delà) : tags PROSPECT/CLIENT/PARTNER,
 * invitations trackées (funnel), stats d'engagement, broadcast, équipe.
 *
 * Le bootstrap (tables + canaux par défaut + admin env) est appelé depuis
 * main.ts (après l'init Prisma) — même politique que les modules finance/hr.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { CommunityRepository } from './community.repository';
import { CommunityAuthService } from './community-auth.service';
import { CommunityProvisionService } from './community-provision.service';
import { CommunityService } from './community.service';
import { CommunityAdminService } from './community-admin.service';
import { CommunityScheduledDispatcher } from './community-scheduled-dispatcher';
import { CommunityBootstrap } from './community.bootstrap';
import { CommunityController } from './community.controller';
import { CommunityAdminController } from './community-admin.controller';

@Module({
  imports: [
    ConfigModule,
    // JWT dédié communauté (claim typ:'community') — même secret, 7 jours
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'your-secret-key-change-in-production'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [CommunityController, CommunityAdminController],
  providers: [
    CommunityRepository,
    CommunityAuthService,
    CommunityProvisionService,
    CommunityService,
    CommunityAdminService,
    CommunityScheduledDispatcher,
    CommunityBootstrap,
  ],
  exports: [CommunityBootstrap, CommunityAuthService, CommunityRepository, CommunityProvisionService],
})
export class CommunityModule {}
