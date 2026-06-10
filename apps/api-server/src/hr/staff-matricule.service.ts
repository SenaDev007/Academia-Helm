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
 *    Format: <CODE>-YY-XXXXX
 *    Example: CSJ-25-00012
 *    - "CODE" = Tenant slug code (max 6 chars, uppercase)
 *    - "YY" = Year of registration (2 digits)
 *    - "XXXXX" = Auto-incremented sequence (5 digits, per-tenant)
 *
 * Both matricules are generated atomically in a transaction to prevent collisions.
 * The `employeeNumber` field is kept as a legacy/internal reference.
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

@Injectable()
export class StaffMatriculeService {
  private readonly logger = new Logger(StaffMatriculeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retourne le code école basé sur le nom de l'établissement.
   * Priorité : nom du tenant → slug du tenant → 'AH'
   * Extrait les initiales des mots du nom, max 6 caractères.
   * Ex: "Academia Helm" → "AHACAD", "Complexe Scolaire Eveil Afrique" → "CSEAFR"
   */
  async getSchoolCode(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    // Try to derive code from the tenant name first
    if (tenant.name) {
      const codeFromName = this.deriveSchoolCode(tenant.name);
      if (codeFromName) return codeFromName;
    }

    // Fallback: use slug
    const codeFromSlug = (tenant.slug || 'AH').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    return codeFromSlug || 'AH';
  }

  /**
   * Derive a school code from the establishment name.
   * Strategy: extract key initials from significant words.
   * Max 6 characters, uppercase, alphabetic only.
   *
   * Examples:
   *   "Academia Helm" → "AHACAD" (3+3 from 2 words)
   *   "Eveil Afrique Education" → "EVAEDU" (3+1+2 prioritized)
   *   "Lycée Saint Michel" → "LYSMIC" (3+3 from 2 significant words)
   */
  private deriveSchoolCode(name: string): string | null {
    if (!name || name.trim().length === 0) return null;

    // Remove common non-significant French words
    const stopWords = new Set([
      'DE', 'DU', 'DES', 'LE', 'LA', 'LES', 'ET', 'D', 'L', 'EN',
      'PRIVÉ', 'PRIVEE', 'PRIVE', 'COMPLEXE', 'SCOLAIRE', 'ETABLISSEMENT',
    ]);
    const words = name.toUpperCase()
      .replace(/[^A-ZÀ-ÿ\s]/g, '')  // Keep only letters and spaces
      .split(/\s+/)
      .filter(w => w.length > 0 && !stopWords.has(w));

    if (words.length === 0) return null;

    // Normalize: remove accents
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    let code = '';
    if (words.length === 1) {
      // Single word: take first 6 letters
      code = normalize(words[0]).substring(0, 6);
    } else if (words.length === 2) {
      // Two words: take first 3 letters of each
      code = normalize(words[0]).substring(0, 3) + normalize(words[1]).substring(0, 3);
    } else {
      // 3+ words: take first 2 letters from first two words, first 1 from the rest
      code = normalize(words[0]).substring(0, 2) + normalize(words[1]).substring(0, 2);
      for (let i = 2; i < words.length && code.length < 6; i++) {
        code += normalize(words[i]).substring(0, 1);
      }
    }

    code = code.slice(0, 6);
    return code.length >= 2 ? code : null;
  }

  /**
   * Génère le prochain matricule tenant dans une transaction.
   * Format: <CODE_TENANT>-<YY>-<SEQUENCE_5>
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
    return `${schoolCode}-${year2}-${padded}`;
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
