/**
 * ============================================================================
 * SCHOOL DIRECTORS SERVICE
 * ============================================================================
 * 
 * Gestion des directeurs par niveau scolaire + piste linguistique.
 * Le promoteur définit qui sont les directeurs pour :
 *   - Maternelle (FR / EN si bilingue)
 *   - Primaire (FR / EN si bilingue)
 *   - Secondaire (FR / EN si bilingue)
 * 
 * Supporte les signatures : upload PNG ou signature électronique (canvas).
 * ============================================================================
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class SchoolDirectorsService {
  private readonly logger = new Logger(SchoolDirectorsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDirectors(tenantId: string) {
    return this.prisma.$queryRawUnsafe<any[]>(`
      SELECT sd.*, sl.code AS "schoolLevelCode", sl.name AS "schoolLevelName"
      FROM school_directors sd
      LEFT JOIN school_levels sl ON sl.id = sd."schoolLevelId"
      WHERE sd."tenantId" = $1 AND sd."isActive" = true
      ORDER BY sl.code, sd.language
    `, tenantId).catch(() => []);
  }

  async upsertDirector(tenantId: string, data: {
    schoolLevelId: string;
    language?: string;
    fullName: string;
    functionLabel?: string;
    email?: string;
    phone?: string;
    signatureDataUrl?: string;
    signatureUploadedUrl?: string;
    createdById?: string;
  }) {
    const id = crypto.randomUUID();
    const language = data.language || 'FR';

    await this.prisma.$executeRawUnsafe(`
      INSERT INTO school_directors (id, "tenantId", "schoolLevelId", "language",
        "fullName", "functionLabel", "email", "phone",
        "signatureDataUrl", "signatureUploadedUrl", "isActive", "createdById",
        "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, NOW(), NOW())
      ON CONFLICT ("tenantId", "schoolLevelId", "language") DO UPDATE SET
        "fullName" = $5, "functionLabel" = $6, "email" = $7, "phone" = $8,
        "signatureDataUrl" = $9, "signatureUploadedUrl" = $10,
        "updatedAt" = NOW()
    `, id, tenantId, data.schoolLevelId, language,
      data.fullName, data.functionLabel || null, data.email || null, data.phone || null,
      data.signatureDataUrl || null, data.signatureUploadedUrl || null,
      data.createdById || null);

    return { success: true, schoolLevelId: data.schoolLevelId, language, fullName: data.fullName };
  }

  async deleteDirector(tenantId: string, directorId: string) {
    await this.prisma.$executeRawUnsafe(`
      UPDATE school_directors SET "isActive" = false, "updatedAt" = NOW()
      WHERE id = $1 AND "tenantId" = $2
    `, directorId, tenantId);
    return { success: true };
  }

  async getDirectorByLevel(tenantId: string, schoolLevelId: string, language?: string) {
    const lang = language || 'FR';
    const directors = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT * FROM school_directors
      WHERE "tenantId" = $1 AND "schoolLevelId" = $2 AND "language" = $3 AND "isActive" = true
      LIMIT 1
    `, tenantId, schoolLevelId, lang).catch(() => []);
    return directors[0] || null;
  }
}
