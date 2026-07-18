/**
 * ============================================================================
 * SAISIEMASTER MODULE — Lead capture for Academia Helm
 * ============================================================================
 *
 * SaisieMaster is a free tool for school directors to enter grades in the
 * EducMaster format (Benin). It is integrated at /saisiemaster in the
 * Academia Helm web-app.
 *
 * Strategy: directors create a free account (name, school name, email) →
 * their data is captured as leads/prospects in the DB → after 3 days, an
 * automated email pitches Academia Helm.
 *
 * The SaisieMaster auth is SEPARATE from Academia Helm's auth:
 *   - No shared JWT
 *   - No shared users table
 *   - Frictionless: NO password, just email + name + school name
 *   - The "login" is just entering the email
 *
 * Endpoints (all prefixed with /api/saisiemaster via global prefix):
 *   POST   /signup         — create/update prospect, returns token
 *   POST   /login          — find prospect by email, returns token
 *   GET    /profile        — current prospect (Bearer token)
 *   POST   /sessions       — save a grade session
 *   GET    /sessions       — list sessions for current prospect
 *   DELETE /sessions/:id   — delete a session
 *   POST   /track          — track activity (login | grade_entered | export)
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SaisieMasterController } from './saisiemaster.controller';
import { SaisieMasterService } from './saisiemaster.service';

@Module({
  imports: [
    // SaisieMaster uses its OWN JWT signing (separate from Academia Helm auth).
    // The token is frictionless (no password) and contains { prospectId, email }.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_SECRET') ||
          'saisiemaster-default-secret',
        signOptions: { expiresIn: '365d' }, // Long-lived: free tool, frictionless
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SaisieMasterController],
  providers: [SaisieMasterService],
  exports: [SaisieMasterService],
})
export class SaisieMasterModule {}
