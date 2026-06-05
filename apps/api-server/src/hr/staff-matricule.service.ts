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
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

const GLOBAL_SEQUENCE_PAD = 6;
const TENANT_SEQUENCE_PAD = 5;

@Injectable()
export class StaffMatriculeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retourne le code école (slug tenant, nettoyé, max 6 caractères)
   */
  async getSchoolCode(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return (tenant.slug || 'AH').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'AH';
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
      create: { tenantId, current: 1 },
      update: { current: { increment: 1 } },
    });
    const padded = String(seq.current).padStart(TENANT_SEQUENCE_PAD, '0');
    const year2 = registrationYear.toString().slice(-2);
    return `${schoolCode}-${year2}-${padded}`;
  }

  /**
   * Génère un matricule global unique.
   * Format: AH-STF-<YY>-<SEQUENCE_6>
   * Uses a global atomic counter (tenantId = 'GLOBAL' in StaffNumberSequence).
   */
  async generateGlobalMatriculeInTransaction(
    tx: Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>,
    registrationYear: number,
  ): Promise<string> {
    // Use a special 'GLOBAL' tenant entry for the global sequence
    const globalSeqId = '__GLOBAL_STAFF_SEQ__';
    const seq = await tx.staffNumberSequence.upsert({
      where: { tenantId: globalSeqId },
      create: { tenantId: globalSeqId, current: 1 },
      update: { current: { increment: 1 } },
    });
    const padded = String(seq.current).padStart(GLOBAL_SEQUENCE_PAD, '0');
    const year2 = registrationYear.toString().slice(-2);
    return `AH-STF-${year2}-${padded}`;
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
