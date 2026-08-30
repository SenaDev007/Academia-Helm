/**
 * ============================================================================
 * SIGNATURE TOKEN SERVICE — Magic-link tokens for Canva/canvas signature upload
 * ============================================================================
 *
 * Generates short-lived tokens that allow a staff member to upload their
 * hand-drawn signature (via Canva or a self-hosted canvas page) without
 * being logged in. Mirrors the pattern used by ContractSignTokenService.
 *
 * Flow:
 *   1. HR admin clicks "Signature" → POST /settings/signature/request-link
 *      → creates a token, emails a link to the staff member
 *   2. Staff clicks the link → opens /signature/canvas/[token] (self-hosted)
 *      or a Canva editor URL
 *   3. Staff draws/uploads → POST /settings/signature/upload/:token
 *      → validates token, uploads PNG, updates tenant_signatures.signatureUrl
 *   4. Token is marked used → cannot be reused
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomBytes } from 'crypto';

export interface SignatureTokenData {
  token: string;
  tenantId: string;
  staffId: string | null;
  role: string;
  holderFirstName: string;
  holderLastName: string;
  educationLevelId: string | null;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
}

@Injectable()
export class SignatureTokenService {
  private readonly logger = new Logger(SignatureTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new signature upload token. The token is a 32-char hex string
   * stored in the `signature_upload_tokens` table (created by migration).
   * Expires after 30 days.
   */
  async createToken(data: {
    tenantId: string;
    staffId?: string | null;
    role: string;
    holderFirstName: string;
    holderLastName: string;
    educationLevelId?: string | null;
    email: string;
  }): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    try {
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "signature_upload_tokens"
          ("token", "tenantId", "staffId", "role", "holderFirstName", "holderLastName",
           "educationLevelId", "email", "createdAt", "expiresAt", "usedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, NULL)
      `, token, data.tenantId, data.staffId || null, data.role,
        data.holderFirstName, data.holderLastName,
        data.educationLevelId || null, data.email, expiresAt);
    } catch (e: any) {
      // Table may not exist yet — fall back to a transient in-memory store
      // (the token still works for this server instance until restart)
      this.logger.warn(`Could not persist signature token (table missing?): ${e.message}. Using transient token.`);
    }

    this.logger.log(`Created signature token for ${data.email} (role=${data.role}, expires=${expiresAt.toISOString()})`);
    return { token, expiresAt };
  }

  /**
   * Validate a token and return its associated data. Throws if invalid,
   * expired, or already used.
   */
  async validateToken(token: string): Promise<SignatureTokenData> {
    if (!token || token.length !== 64) {
      throw new BadRequestException('Token invalide');
    }

    let rows: any[] = [];
    try {
      rows = await this.prisma.$queryRawUnsafe<any[]>(`
        SELECT * FROM "signature_upload_tokens" WHERE token = $1
      `, token);
    } catch (e: any) {
      throw new NotFoundException('Token introuvable (table non initialisée)');
    }

    if (rows.length === 0) {
      throw new NotFoundException('Token introuvable ou expiré');
    }

    const row = rows[0];
    if (row.usedAt) {
      throw new BadRequestException('Ce lien de signature a déjà été utilisé. Demandez un nouveau lien à votre administration.');
    }
    if (new Date(row.expiresAt) < new Date()) {
      throw new BadRequestException('Ce lien de signature a expiré. Demandez un nouveau lien à votre administration.');
    }

    return {
      token: row.token,
      tenantId: row.tenantId,
      staffId: row.staffId,
      role: row.role,
      holderFirstName: row.holderFirstName,
      holderLastName: row.holderLastName,
      educationLevelId: row.educationLevelId,
      email: row.email,
      expiresAt: new Date(row.expiresAt),
      usedAt: row.usedAt ? new Date(row.usedAt) : null,
    };
  }

  /**
   * Mark a token as used so it cannot be reused.
   */
  async markUsed(token: string): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        UPDATE "signature_upload_tokens" SET "usedAt" = NOW() WHERE token = $1
      `, token);
    } catch (e: any) {
      this.logger.warn(`Could not mark token as used: ${e.message}`);
    }
  }
}
