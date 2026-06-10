/**
 * Génération du matricule élève Academia Helm (identifiant interne par établissement).
 * Trois identifiants distincts : matricule Academia Helm (ici) ; NPI (identification personnelle Bénin) ; numéro Educmaster (plateforme MEMP).
 * Format : [ABREVIATION_ECOLE]-[ANNEE_INSCRIPTION]-[SEQUENCE_6CHIFFRES] ex. AH-2026-000124
 * Jamais exposé côté client en écriture ; génération backend uniquement dans une transaction.
 *
 * Le code école est dérivé de l'abréviation officielle renseignée par l'école
 * dans le module Paramètres (tenant_identity_profiles.schoolAcronym).
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

const SEQUENCE_PAD = 5;
const MAX_SCHOOL_CODE_LENGTH = 6;

@Injectable()
export class MatriculeService {
  private readonly logger = new Logger(MatriculeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retourne le code école basé sur l'abréviation officielle renseignée
   * par l'école dans le module Paramètres (tenant_identity_profiles.schoolAcronym).
   *
   * Priorité :
   *   1. schoolAcronym (abréviation officielle de l'école)
   *   2. school_settings.abbreviation (fallback)
   *   3. tenant.slug (dernier recours)
   *   4. 'AH' (valeur par défaut)
   */
  async getSchoolCode(tenantId: string): Promise<string> {
    // 1. Try schoolAcronym from tenant_identity_profiles (most reliable)
    try {
      const identity = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId },
        select: { schoolAcronym: true },
        orderBy: { createdAt: 'desc' },
      });
      if (identity?.schoolAcronym) {
        const code = this.sanitizeSchoolCode(identity.schoolAcronym);
        if (code) return code;
      }
    } catch (err: any) {
      this.logger.warn(`Could not fetch schoolAcronym: ${err?.message || err}`);
    }

    // 2. Try school_settings.abbreviation
    try {
      const settings = await this.prisma.schoolSettings.findFirst({
        where: { tenantId },
        select: { abbreviation: true },
      });
      if (settings?.abbreviation) {
        const code = this.sanitizeSchoolCode(settings.abbreviation);
        if (code) return code;
      }
    } catch (err: any) {
      this.logger.warn(`Could not fetch school_settings.abbreviation: ${err?.message || err}`);
    }

    // 3. Fallback: use tenant slug
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.sanitizeSchoolCode(tenant.slug || 'AH') || 'AH';
  }

  /**
   * Nettoie et formate un code école :
   * - Majuscules, suppression accents, caractères non alphanumériques
   * - Tronqué à MAX_SCHOOL_CODE_LENGTH (6) caractères
   */
  private sanitizeSchoolCode(raw: string): string {
    if (!raw || raw.trim().length === 0) return '';
    const code = raw
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, MAX_SCHOOL_CODE_LENGTH);
    return code.length >= 2 ? code : '';
  }

  /**
   * GÃ©nÃ¨re le prochain matricule dans une transaction (Ã  appeler depuis une tx existante).
   * IncrÃ©mente la sÃ©quence, retourne le matricule au format <CODE_TENANT>-<ANNEE>-<AUTO_INCREMENT> ex. AH-2025-000124
   */
  async generateInTransaction(
    tx: Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>,
    tenantId: string,
    schoolCode: string,
    enrollmentYear: number,
  ): Promise<string> {
    const seq = await tx.studentNumberSequence.upsert({
      where: { tenantId },
      create: { tenantId, current: 1 },
      update: { current: { increment: 1 } },
    });
    const padded = String(seq.current).padStart(6, '0'); // User example has 6 digits in one place, 4 in another. I'll use 6 as per typical ERP.
    return `${schoolCode}-${enrollmentYear}-${padded}`;
  }

  /**
   * Génère un matricule pour un nouvel élève (transaction complète).
   * À utiliser lors de la création Student (preRegister / admission).
   */
  async generate(
    tenantId: string,
    academicYearId: string,
  ): Promise<{ matricule: string; enrollmentYear: number }> {
    const schoolCode = await this.getSchoolCode(tenantId);
    const year = await this.getEnrollmentYearFromAcademicYear(academicYearId);

    const matricule = await this.prisma.$transaction(async (tx) => {
      return this.generateInTransaction(tx, tenantId, schoolCode, year);
    });

    return { matricule, enrollmentYear: year };
  }

  /**
   * Année d'inscription (4 chiffres) à partir de l'année scolaire — utilisable par lifecycle / create.
   */
  async getEnrollmentYearFromAcademicYear(academicYearId: string): Promise<number> {
    const ay = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { name: true, startDate: true },
    });
    if (!ay) throw new NotFoundException('Academic year not found');
    const match = ay.name?.match(/\d{4}/);
    if (match) return parseInt(match[0], 10);
    return ay.startDate ? new Date(ay.startDate).getFullYear() : new Date().getFullYear();
  }
}
