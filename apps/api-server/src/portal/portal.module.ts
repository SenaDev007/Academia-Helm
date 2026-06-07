/**
 * ============================================================================
 * PORTAL MODULE - MODULE D'ACCÈS MULTI-PORTAILS
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { SchoolSearchService } from './services/school-search.service';
import { PortalSessionService } from './services/portal-session.service';
import { OrionInitService } from './services/orion-init.service';
import { PortalAuthService } from './services/portal-auth.service';
import { PublicPortalController } from './controllers/public-portal.controller';
import { PublicPlatformReviewsController } from './controllers/public-platform-reviews.controller';
import { PlatformMarketingReviewService } from './services/platform-marketing-review.service';
import { PortalController } from './controllers/portal.controller';
import { PortalLogController } from './controllers/portal-log.controller';
import { PortalAuthController } from './controllers/portal-auth.controller';
import { OrionModule } from '../orion/orion.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'your-secret-key-change-in-production'),
        signOptions: {
          expiresIn: '24h',
        },
      }),
      inject: [ConfigService],
    }),
    OrionModule,
  ],
  providers: [
    PrismaService,
    PlatformMarketingReviewService,
    SchoolSearchService,
    PortalSessionService,
    OrionInitService,
    PortalAuthService,
  ],
  controllers: [
    PublicPlatformReviewsController,
    PublicPortalController,
    PortalController,
    PortalAuthController,
    PortalLogController,
  ],
  exports: [
    SchoolSearchService,
    PortalSessionService,
    OrionInitService,
    PortalAuthService,
  ],
})
export class PortalModule {}

