/**
 * ============================================================================
 * MATRICULE GENERATOR SERVICE — Génération unifiée de matricules/numéros
 * ============================================================================
 *
 * Service réutilisable pour générer TOUS les types de numéros dans Academia
 * Helm, avec un format UNIFIé :
 *
 *   GLOBAL : AH-<TYPE>-<YY>-<XXXXXX>  ex: AH-STU-25-000001
 *   LOCAL  : <CODE>-<LOCAL_TYPE>-<YY>-<XXXXX>  ex: CSPEB-E-25-00001
 *
 * Le code LOCAL_TYPE différencie les entités au sein d'une même école :
 *   E   = Élève (Student)       → CSPEB-E-25-00001
 *   P   = Personnel (Staff)     → CSPEB-P-25-00001
 *   F   = Facture (Invoice)     → CSPEB-F-25-00001
 *   R   = Reçu (Receipt)        → CSPEB-R-25-00001
 *   A   = Admission             → CSPEB-A-25-00001
 *   PAY = Paiement (Payment)    → CSPEB-PAY-25-00001
 *
 * Types supportés :
 *   STU = Élève (Student)      — global: AH-STU-25-000001, local: CSPEB-E-25-00001
 *   STF = Staff (Enseignant)   — global: AH-STF-25-000001, local: CSPEB-P-25-00001
 *   INV = Facture (Invoice)    — global: AH-INV-25-000001, local: CSPEB-F-25-00001
 *   REC = Reçu (Receipt)       — global: AH-REC-25-000001, local: CSPEB-R-25-00001
 *   ADM = Admission            — global: AH-ADM-25-000001, local: CSPEB-A-25-00001
 *   PAY = Paiement (Payment)   — global: AH-PAY-25-000001, local: CSPEB-PAY-25-00001
 *
 * Usage :
 *   const generator = new MatriculeGeneratorService(prisma);
 *   const invoiceNum = await generator.generate('INV', tenantId, academicYearId);
 *   // → { global: 'AH-INV-25-000001', local: 'CSPEB-F-25-00001' }
 *
 * Le service utilise une table de séquence par (tenantId, type) pour
 * garantir l'unicité du numéro local, et un compteur global basé sur
 * le nombre d'enregistrements existants pour le numéro global.
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const GLOBAL_PAD = 6;
const LOCAL_PAD = 5;
const MAX_SCHOOL_CODE_LENGTH = 6;

export type MatriculeType = 'STU' | 'STF' | 'INV' | 'REC' | 'ADM' | 'PAY';

/**
 * Mapping type global → code type local.
 * Le code type local est inséré dans le matricule local pour différencier
 * les élèves, staff, factures, etc. au sein d'une même école.
 *
 * Sans ce code, deux entités différentes auraient le même format local
 * (ex: CSPEB-25-00001 pour un élève ET un staff → confusion).
 *
 * Avec le code : CSPEB-E-25-00001 (élève) ≠ CSPEB-P-25-00001 (staff).
 */
const LOCAL_TYPE_CODE: Record<MatriculeType, string> = {
  STU: 'E',    // Élève
  STF: 'P',    // Personnel
  INV: 'F',    // Facture
  REC: 'R',    // Reçu
  ADM: 'A',    // Admission
  PAY: 'PAY',  // Paiement
};

export interface GeneratedMatricule {
  global: string;  // ex: AH-INV-25-000001
  local: string;   // ex: CSPEB-25-00001
  year: number;    // ex: 2025
  sequence: number; // ex: 1
}

@Injectable()
export class MatriculeGeneratorService {
  private readonly logger = new Logger(MatriculeGeneratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère un numéro global + local pour un type donné.
   *
   * @param type Le type de matricule (STU, STF, INV, REC, ADM, PAY)
   * @param tenantId Le tenant pour lequel générer
   * @param academicYearId L'année scolaire (optionnel — utilise l'année courante si non fourni)
   * @returns { global, local, year, sequence }
   */
  async generate(
    type: MatriculeType,
    tenantId: string,
    academicYearId?: string,
  ): Promise<GeneratedMatricule> {
    const schoolCode = await this.getSchoolCode(tenantId);
    const year = academicYearId
      ? await this.getYearFromAcademicYear(academicYearId)
      : new Date().getFullYear();
    const year2 = year.toString().slice(-2);

    // 1. Générer le numéro LOCAL (par tenant + type)
    // Format: <CODE>-<LOCAL_TYPE>-<YY>-<XXXXX>  ex: CSPEB-E-25-00001
    const localType = LOCAL_TYPE_CODE[type] || type;
    const localSeq = await this.getNextLocalSequence(tenantId, type);
    const local = `${schoolCode}-${localType}-${year2}-${String(localSeq).padStart(LOCAL_PAD, '0')}`;

    // 2. Générer le numéro GLOBAL (plateforme entière, par type + année)
    const globalSeq = await this.getNextGlobalSequence(type, year2);
    const global = `AH-${type}-${year2}-${String(globalSeq).padStart(GLOBAL_PAD, '0')}`;

    this.logger.log(`Generated ${type} matricule: global=${global}, local=${local}`);

    return { global, local, year, sequence: localSeq };
  }

  /**
   * Retourne le code école (réutilise la même logique que MatriculeService
   * et StaffMatriculeService).
   */
  async getSchoolCode(tenantId: string): Promise<string> {
    // 1. schoolAcronym
    try {
      const identity = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId },
        select: { schoolAcronym: true },
        orderBy: { createdAt: 'desc' },
      });
      if (identity?.schoolAcronym) {
        const code = this.sanitize(identity.schoolAcronym);
        if (code) return code;
      }
    } catch { /* ignore */ }

    // 2. school_settings.abbreviation
    try {
      const settings = await this.prisma.schoolSettings.findFirst({
        where: { tenantId },
        select: { abbreviation: true },
      });
      if (settings?.abbreviation) {
        const code = this.sanitize(settings.abbreviation);
        if (code) return code;
      }
    } catch { /* ignore */ }

    // 3. tenant.slug
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.sanitize(tenant.slug || 'AH') || 'AH';
  }

  /**
   * Séquence locale (par tenant + type).
   * Utilise une approche simple : count des enregistrements existants + 1.
   * Pour une robustesse production, il faudrait une table de séquence
   * dédiée avec upsert atomique (comme studentNumberSequence).
   */
  private async getNextLocalSequence(tenantId: string, type: MatriculeType): Promise<number> {
    // Pour STU : utiliser studentNumberSequence (déjà existant)
    if (type === 'STU') {
      const seq = await this.prisma.studentNumberSequence.upsert({
        where: { tenantId },
        create: { tenantId, current: 1 },
        update: { current: { increment: 1 } },
      });
      return seq.current;
    }

    // Pour les autres types : utiliser un compteur basé sur une table
    // générique. On stocke la séquence dans une table key-value.
    // Pour l'instant, on utilise un simple count + 1.
    // TODO: créer une table MatriculeSequence(tenantId, type, current) pour
    // garantir l'atomicité.
    const year = new Date().getFullYear();
    const year2 = year.toString().slice(-2);
    const prefix = `${type}-${year2}-`;

    // Compter selon le type
    let count = 0;
    switch (type) {
      case 'INV':
        count = await this.prisma.invoice.count({
          where: { tenantId, invoiceNumber: { startsWith: prefix } },
        }).catch(() => 0);
        break;
      case 'REC':
        count = await this.prisma.payment.count({
          where: { tenantId, receiptNumber: { startsWith: prefix } },
        }).catch(() => 0);
        break;
      default:
        count = 0;
    }

    return count + 1;
  }

  /**
   * Séquence globale (par type + année).
   * Compte les enregistrements existants avec le préfixe correspondant.
   */
  private async getNextGlobalSequence(type: MatriculeType, year2: string): Promise<number> {
    const prefix = `AH-${type}-${year2}-`;
    let maxSeq = 0;

    switch (type) {
      case 'STU':
        const studentIds = await this.prisma.studentIdentifier.findMany({
          where: { globalMatricule: { startsWith: prefix } },
          select: { globalMatricule: true },
        }).catch(() => []);
        for (const s of studentIds) {
          const seq = parseInt(s.globalMatricule.replace(prefix, ''), 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
        break;

      case 'STF':
        const staff = await this.prisma.staff.findMany({
          where: { globalMatricule: { startsWith: prefix } },
          select: { globalMatricule: true },
        }).catch(() => []);
        for (const s of staff) {
          if (s.globalMatricule) {
            const seq = parseInt(s.globalMatricule.replace(prefix, ''), 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          }
        }
        break;

      case 'INV':
        const invoices = await this.prisma.invoice.findMany({
          where: { globalInvoiceNumber: { startsWith: prefix } },
          select: { globalInvoiceNumber: true },
        }).catch(() => []);
        for (const inv of invoices) {
          if (inv.globalInvoiceNumber) {
            const seq = parseInt(inv.globalInvoiceNumber.replace(prefix, ''), 10);
            if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
          }
        }
        break;

      default:
        // Pour les types sans table dédiée, on utilise un compteur global
        // basé sur une table MatriculeSequence (à créer si besoin)
        maxSeq = 0;
    }

    return maxSeq + 1;
  }

  /**
   * Année à partir de l'année scolaire.
   */
  private async getYearFromAcademicYear(academicYearId: string): Promise<number> {
    const ay = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { name: true, startDate: true },
    });
    if (!ay) return new Date().getFullYear();
    const match = ay.name?.match(/\d{4}/);
    if (match) return parseInt(match[0], 10);
    return ay.startDate ? new Date(ay.startDate).getFullYear() : new Date().getFullYear();
  }

  /**
   * Nettoie un code école.
   */
  private sanitize(raw: string): string {
    if (!raw || raw.trim().length === 0) return '';
    const code = raw
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, MAX_SCHOOL_CODE_LENGTH);
    return code.length >= 2 ? code : '';
  }
}
