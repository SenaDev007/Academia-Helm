/**
 * ============================================================================
 * STUDENT IDENTIFIER SERVICE — Matricule GLOBAL élève (plateforme entière)
 * ============================================================================
 *
 * Format UNIFIÉ (aligné sur le standard RH) :
 *   AH-STU-YY-XXXXXX
 *   ex: AH-STU-25-000001
 *
 * - "AH" = Academia Helm prefix
 * - "STU" = Student identifier (équivalent de STF pour le staff)
 * - "YY" = Année d'inscription (2 digits, ex: 25 pour 2025)
 * - "XXXXXX" = Séquence auto-incrémentée (6 digits, globale)
 *
 * ⚠️ Ce service génère UNIQUEMENT le matricule GLOBAL.
 * Le matricule LOCAL (par école) est généré par MatriculeService.
 *
 * Le format est cohérent avec StaffMatriculeService :
 *   - Staff global : AH-STF-YY-XXXXXX (ex: AH-STF-25-000001)
 *   - Élève global : AH-STU-YY-XXXXXX (ex: AH-STU-25-000001)
 *
 * Le matricule global est VERROUILLÉ (locked=true) dès sa création —
 * il ne change jamais, même si l'élève change d'école.
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const GLOBAL_SEQUENCE_PAD = 6;
const STUDENT_TYPE_CODE = 'STU';

@Injectable()
export class StudentIdentifierService {
  private readonly logger = new Logger(StudentIdentifierService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère un matricule global unique pour un élève.
   * Format: AH-STU-YY-XXXXXX  ex: AH-STU-25-000001
   *
   * Le matricule est verrouillé (locked=true) dès sa création.
   * Il est stocké dans StudentIdentifier + sur Student.globalStudentId.
   */
  async generateGlobalMatricule(
    tenantId: string,
    studentId: string,
    countryCode: string = 'BJ',
    generatedBy?: string,
  ) {
    // Vérifier que l'élève existe
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: { academicYear: true },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    // Vérifier qu'il n'a pas déjà un matricule global
    const existing = await this.prisma.studentIdentifier.findUnique({
      where: { studentId },
    });

    if (existing) {
      throw new BadRequestException(
        `Student already has a global matricule: ${existing.globalMatricule}`,
      );
    }

    // Année d'inscription (2 digits)
    const enrollmentYear = student.academicYear?.startDate
      ? new Date(student.academicYear.startDate).getFullYear()
      : new Date().getFullYear();
    const year2 = enrollmentYear.toString().slice(-2);

    // Générer le numéro séquentiel global (6 digits)
    // On compte les StudentIdentifier existants pour cette année
    const prefix = `AH-${STUDENT_TYPE_CODE}-${year2}-`;
    const existingIds = await this.prisma.studentIdentifier.findMany({
      where: { globalMatricule: { startsWith: prefix } },
      select: { globalMatricule: true },
    });

    let maxSeq = 0;
    for (const id of existingIds) {
      const seqStr = id.globalMatricule.replace(prefix, '');
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }

    const nextSeq = maxSeq + 1;
    const paddedSeq = String(nextSeq).padStart(GLOBAL_SEQUENCE_PAD, '0');
    const globalMatricule = `${prefix}${paddedSeq}`;

    // Vérifier l'unicité globale (double-check)
    const duplicate = await this.prisma.studentIdentifier.findUnique({
      where: { globalMatricule },
    });

    if (duplicate) {
      throw new BadRequestException(
        `Matricule collision detected: ${globalMatricule}. Please retry.`,
      );
    }

    // Récupérer le code institution (pour compat avec ancien format)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException(`Tenant not found`);
    const institutionCode = this.extractInstitutionCode(tenant);

    // Créer l'identifiant
    const identifier = await this.prisma.studentIdentifier.create({
      data: {
        tenantId,
        studentId,
        globalMatricule,
        countryCode,
        institutionCode,
        firstEnrollmentYear: enrollmentYear,
        sequenceNumber: nextSeq,
        generatedBy,
        locked: true,
        isOfflineGenerated: false,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
          },
        },
        generator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Mettre à jour Student.globalStudentId uniquement.
    // ⚠️ NE PAS écraser matricule ni studentCode — ce sont les matricules LOCAUX
    // (format <CODE_TENANT>-E-<YY>-<XXXXX> ex: CSPEB-E-26-00001) générés par
    // admit() via MatriculeService.generateInTransaction().
    // globalStudentId est le matricule GLOBAL Academia Helm (AH-STU-YY-XXXXXX)
    // qui est unique sur toute la plateforme et sert d'identifiant inter-écoles.
    //
    // Le frontend affiche student.matricule || student.studentCode (le local),
    // PAS globalStudentId. Si on écrase matricule avec globalMatricule, on perd
    // le matricule local et l'admin ne voit plus le bon identifiant.
    await this.prisma.student.update({
      where: { id: studentId },
      data: { globalStudentId: globalMatricule },
    });

    this.logger.log(`Generated global matricule ${globalMatricule} for student ${studentId} (globalStudentId updated, local matricule preserved)`);

    return identifier;
  }

  /**
   * Génère un matricule temporaire en mode offline
   */
  async generateTemporaryLocalId(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    const existing = await this.prisma.studentIdentifier.findUnique({
      where: { studentId },
    });

    if (existing) {
      if (!existing.isOfflineGenerated) {
        throw new BadRequestException('Student already has a definitive matricule');
      }
      return existing;
    }

    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const temporaryLocalId = `TEMP-${tenantId.substring(0, 8)}-${timestamp}-${random}`;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant not found`);
    }

    const institutionCode = this.extractInstitutionCode(tenant);
    const currentYear = new Date().getFullYear();

    return this.prisma.studentIdentifier.create({
      data: {
        tenantId,
        studentId,
        globalMatricule: temporaryLocalId,
        countryCode: 'BJ',
        institutionCode,
        firstEnrollmentYear: currentYear,
        sequenceNumber: 0,
        temporaryLocalId,
        isOfflineGenerated: true,
        locked: false,
      },
    });
  }

  /**
   * Synchronise un matricule temporaire avec le matricule définitif
   */
  async synchronizeTemporaryIdentifier(
    tenantId: string,
    studentId: string,
    temporaryLocalId: string,
    generatedBy?: string,
  ) {
    const identifier = await this.prisma.studentIdentifier.findFirst({
      where: {
        studentId,
        tenantId,
        temporaryLocalId,
        isOfflineGenerated: true,
        synchronizedAt: null,
      },
    });

    if (!identifier) {
      throw new NotFoundException(
        `Temporary identifier not found or already synchronized`,
      );
    }

    await this.prisma.studentIdentifier.delete({
      where: { id: identifier.id },
    });

    return this.generateGlobalMatricule(
      tenantId,
      studentId,
      identifier.countryCode,
      generatedBy,
    );
  }

  /**
   * Récupère le matricule d'un élève
   */
  async getStudentMatricule(studentId: string, tenantId: string) {
    const identifier = await this.prisma.studentIdentifier.findFirst({
      where: { studentId, tenantId },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!identifier) {
      throw new NotFoundException(`No matricule found for student ${studentId}`);
    }

    return identifier;
  }

  /**
   * Vérifie l'unicité d'un matricule
   */
  async verifyMatriculeUniqueness(globalMatricule: string): Promise<boolean> {
    const existing = await this.prisma.studentIdentifier.findUnique({
      where: { globalMatricule },
    });
    return !existing;
  }

  /**
   * Recherche un élève par matricule global
   */
  async findStudentByMatricule(globalMatricule: string) {
    const identifier = await this.prisma.studentIdentifier.findUnique({
      where: { globalMatricule },
      include: {
        student: {
          include: {
            tenant: { select: { id: true, name: true } },
            academicYear: { select: { id: true, name: true } },
            schoolLevel: { select: { id: true, code: true, label: true } },
            identifier: true,
          },
        },
      },
    });

    if (!identifier) {
      throw new NotFoundException(`No student found with matricule ${globalMatricule}`);
    }

    return identifier.student;
  }

  /**
   * Statistiques des matricules
   */
  async getMatriculeStats(tenantId?: string) {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;

    const identifiers = await this.prisma.studentIdentifier.findMany({
      where,
      include: {
        student: { select: { id: true, status: true } },
      },
    });

    const total = identifiers.length;
    const offlineGenerated = identifiers.filter((i) => i.isOfflineGenerated && !i.synchronizedAt).length;
    const synchronized = identifiers.filter((i) => i.isOfflineGenerated && i.synchronizedAt).length;
    const definitive = identifiers.filter((i) => !i.isOfflineGenerated).length;

    const byYear = identifiers.reduce((acc, id) => {
      acc[id.firstEnrollmentYear] = (acc[id.firstEnrollmentYear] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return {
      total,
      offlineGenerated,
      synchronized,
      definitive,
      byYear,
      pendingSynchronization: offlineGenerated - synchronized,
    };
  }

  /**
   * Extrait le code institution depuis le tenant (compat ancien format)
   */
  private extractInstitutionCode(tenant: any): string {
    if (tenant.code) {
      return tenant.code.substring(0, 4).padEnd(4, '0').toUpperCase();
    }
    if (tenant.slug) {
      return tenant.slug.substring(0, 4).padEnd(4, '0').toUpperCase();
    }
    return tenant.id.substring(0, 4).toUpperCase();
  }
}
