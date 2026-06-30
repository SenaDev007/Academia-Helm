/**
 * ============================================================================
 * STAFF MATRICULE SERVICE — Dual Matricule Generation
 * ============================================================================
 *
 * Two distinct matricules for each staff member:
 *
 * 1. **Global Matricule (Academia Helm)**: Unique across the entire platform
 *    Format: AH-STF-YY-XXXXXX
 *    Example: AH-STF-25-000001
 *    - "AH" = Academia Helm prefix
 *    - "STF" = Staff identifier
 *    - "YY" = Year of registration (2 digits)
 *    - "XXXXXX" = Auto-incremented sequence (6 digits, global)
 *
 * 2. **Tenant Matricule (School-specific)**: Unique within each tenant/school
 *    Format: <ABREVIATION>-P-YY-XXXXX
 *    Example: CSPEB-P-25-00001
 *    - "ABREVIATION" = School acronym from tenant_identity_profiles.schoolAcronym
 *      (the abbreviation the school registered in settings), max 6 chars, uppercase
 *    - "P" = Code type local pour Personnel (différencie du Élève=E, Facture=F, etc.)
 *    - "YY" = Year of registration (2 digits)
 *    - "XXXXX" = Auto-incremented sequence (5 digits, per-tenant)
 *
 * Both matricules are generated atomically in a transaction to prevent collisions.
 * The `employeeNumber` field uses the same format as tenantMatricule.
 *
 * ⚠️ IMPORTANT: StaffNumberSequence has a FK to Tenant, so we CANNOT use
 * a fake tenantId like '__GLOBAL_STAFF_SEQ__' for the global sequence.
 * Instead, we count existing Staff records for the global matricule.
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { prismaCreateNoCreatedAt } from '../common/utils/prisma-helpers';

const GLOBAL_SEQUENCE_PAD = 6;
const TENANT_SEQUENCE_PAD = 5;
const MAX_SCHOOL_CODE_LENGTH = 6;

@Injectable()
export class StaffMatriculeService {
  private readonly logger = new Logger(StaffMatriculeService.name);

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
   *
   * Le code est nettoyé, mis en majuscules, et tronqué à 6 caractères
   * pour éviter les doublons dans les matricules.
   *
   * Exemples :
   *   "AH" → "AH"
   *   "CSPEB-Eveil" → "CSPEBE" (nettoyé et tronqué)
   *   "MLK" → "MLK"
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
        if (code) {
          this.logger.log(`School code from schoolAcronym: "${identity.schoolAcronym}" → "${code}"`);
          return code;
        }
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
        if (code) {
          this.logger.log(`School code from school_settings.abbreviation: "${settings.abbreviation}" → "${code}"`);
          return code;
        }
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

    const codeFromSlug = this.sanitizeSchoolCode(tenant.slug || 'AH');
    this.logger.log(`School code from slug (fallback): "${tenant.slug}" → "${codeFromSlug}"`);
    return codeFromSlug || 'AH';
  }

  /**
   * Nettoie et formate un code école :
   * - Majuscules
   * - Supprime les accents
   * - Supprime les caractères non alphanumériques (sauf les tirets devenus rien)
   * - Tronque à MAX_SCHOOL_CODE_LENGTH (6) caractères
   */
  private sanitizeSchoolCode(raw: string): string {
    if (!raw || raw.trim().length === 0) return '';

    let code = raw
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')     // Remove accents
      .replace(/[^A-Z0-9]/g, '')            // Keep only alphanumeric
      .slice(0, MAX_SCHOOL_CODE_LENGTH);

    return code.length >= 2 ? code : '';
  }

  /**
   * Génère le prochain matricule tenant dans une transaction.
   * Format: <CODE_TENANT>-P-<YY>-<SEQUENCE_5>
   *
   * Le préfixe "P" (Personnel) différencie ce matricule de l'Élève (E),
   * Facture (F), Reçu (R), etc. au sein de la même école.
   */
  async generateTenantMatriculeInTransaction(
    tx: Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>,
    tenantId: string,
    schoolCode: string,
    registrationYear: number,
  ): Promise<string> {
    const seq = await tx.staffNumberSequence.upsert({
      where: { tenantId },
      create: { ...prismaCreateNoCreatedAt(), tenantId, current: 1 },
      update: { current: { increment: 1 } },
    });
    const padded = String(seq.current).padStart(TENANT_SEQUENCE_PAD, '0');
    const year2 = registrationYear.toString().slice(-2);
    return `${schoolCode}-P-${year2}-${padded}`;
  }

  /**
   * Génère un matricule global unique.
   * Format: AH-STF-<YY>-<SEQUENCE_6>
   *
   * ⚠️ IMPORTANT: We CANNOT use StaffNumberSequence with a fake tenantId for
   * the global counter because StaffNumberSequence has a FK constraint to Tenant.
   * Instead, we count existing Staff records with matching globalMatricule pattern
   * and increment the sequence number.
   */
  async generateGlobalMatriculeInTransaction(
    tx: Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>,
    registrationYear: number,
  ): Promise<string> {
    const year2 = registrationYear.toString().slice(-2);
    const prefix = `AH-STF-${year2}-`;

    // Count existing Staff records with global matricule matching this year's pattern
    const existingStaff = await tx.staff.findMany({
      where: {
        globalMatricule: { startsWith: prefix },
      },
      select: { globalMatricule: true },
    });

    let maxSeq = 0;
    for (const s of existingStaff) {
      if (s.globalMatricule) {
        const seqStr = s.globalMatricule.replace(prefix, '');
        const seq = parseInt(seqStr, 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }

    const nextSeq = maxSeq + 1;
    const padded = String(nextSeq).padStart(GLOBAL_SEQUENCE_PAD, '0');
    return `${prefix}${padded}`;
  }

  /**
   * Génère les deux matricules (global + tenant) dans une transaction complète.
   * À utiliser lors de la création Staff.
   */
  async generate(tenantId: string): Promise<{
    globalMatricule: string;
    tenantMatricule: string;
    registrationYear: number;
  }> {
    const schoolCode = await this.getSchoolCode(tenantId);
    const registrationYear = new Date().getFullYear();

    const result = await this.prisma.$transaction(async (tx) => {
      const globalMatricule = await this.generateGlobalMatriculeInTransaction(tx, registrationYear);
      const tenantMatricule = await this.generateTenantMatriculeInTransaction(tx, tenantId, schoolCode, registrationYear);
      return { globalMatricule, tenantMatricule };
    });

    return {
      ...result,
      registrationYear,
    };
  }
}
