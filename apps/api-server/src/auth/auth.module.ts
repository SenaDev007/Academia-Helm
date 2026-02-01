/**
 * Auth Module
 * 
 * Module d'authentification avec OTP contextuel
 */

import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OtpService } from './services/otp.service';
import { DeviceTrackingService } from './services/device-tracking.service';
import { DeviceSessionService } from './services/device-session.service';
import { SmsService } from './services/sms.service';
import { OtpController } from './controllers/otp.controller';
import { AdminDevicesController } from './controllers/admin-devices.controller';
import { ContextualAuthGuard } from './guards/contextual-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    // ConfigModule est déjà global dans AppModule, pas besoin de l'importer ici
    PassportModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule], // Nécessaire pour JwtModule.registerAsync
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'your-secret-key-change-in-production'),
        signOptions: {
          expiresIn: '24h',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    PrismaService,
    AuthService,
    LocalStrategy,
    JwtStrategy, // Ajout de la stratégie JWT
    SmsService,
    OtpService,
    DeviceTrackingService,
    DeviceSessionService,
    ContextualAuthGuard,
    JwtAuthGuard,
    RolesGuard,
  ],
  controllers: [AuthController, OtpController, AdminDevicesController],
  exports: [
    AuthService,
    SmsService,
    OtpService,
    DeviceTrackingService,
    DeviceSessionService,
    ContextualAuthGuard,
    JwtAuthGuard,
  ],
})
export class AuthModule {}
