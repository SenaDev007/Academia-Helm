/**
 * ============================================================================
 * STUDENT IDENTIFIER SERVICE - MODULE 1
 * ============================================================================
 * 
 * Service pour génération de matricule global unique
 * Format: AH-BJ-XXXX-YYYY-NNNNN
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class StudentIdentifierService {
  private readonly logger = new Logger(StudentIdentifierService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère un matricule global unique pour un élève
   * Format: AH-BJ-XXXX-YYYY-NNNNN
   * Règle : ❌ Génération backend uniquement, jamais manuelle
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
      include: {
        academicYear: true,
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    // Vérifier qu'il n'a pas déjà un matricule
    const existing = await this.prisma.studentIdentifier.findUnique({
      where: { studentId },
    });

    if (existing) {
      throw new BadRequestException(
        `Student already has a global matricule: ${existing.globalMatricule}`,
      );
    }

    // Récupérer le tenant pour le code institution
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        country: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    // Générer ou récupérer le code institution (4 caractères)
    // Utiliser slug ou générer depuis ID si pas de code défini
    let institutionCode = this.extractInstitutionCode(tenant);
    
    // Année de première inscription (année scolaire de création)
    const firstEnrollmentYear = new Date(student.academicYear.startDate).getFullYear();

    // Générer le numéro séquentiel global
    // Chercher le dernier numéro pour cette combinaison institution-année
    const lastIdentifier = await this.prisma.studentIdentifier.findFirst({
      where: {
        institutionCode,
        firstEnrollmentYear,
        countryCode,
      },
      orderBy: { sequenceNumber: 'desc' },
    });

    const nextSequenceNumber = lastIdentifier ? lastIdentifier.sequenceNumber + 1 : 1;

    // Formater le numéro séquentiel (5 chiffres, zero-padded)
    const formattedSequence = String(nextSequenceNumber).padStart(5, '0');

    // Construire le matricule global : AH-BJ-XXXX-YYYY-NNNNN
    const globalMatricule = `AH-${countryCode}-${institutionCode}-${firstEnrollmentYear}-${formattedSequence}`;

    // Vérifier l'unicité globale (contrainte SQL mais vérification supplémentaire)
    const duplicate = await this.prisma.studentIdentifier.findUnique({
      where: { globalMatricule },
    });

    if (duplicate) {
      throw new BadRequestException(
        `Matricule collision detected: ${globalMatricule}. Please retry.`,
      );
    }

    // Créer l'identifiant
    const identifier = await this.prisma.studentIdentifier.create({
      data: {
        tenantId,
        studentId,
        globalMatricule,
        countryCode,
        institutionCode,
        firstEnrollmentYear,
        sequenceNumber: nextSequenceNumber,
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

    this.logger.log(`Generated global matricule ${globalMatricule} for student ${studentId}`);

    return identifier;
  }

  /**
   * Génère un matricule temporaire en mode offline
   * À synchroniser avec le backend pour obtenir le matricule définitif
   */
  async generateTemporaryLocalId(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    // Vérifier qu'il n'a pas déjà un identifiant (même temporaire)
    const existing = await this.prisma.studentIdentifier.findUnique({
      where: { studentId },
    });

    if (existing) {
      if (!existing.isOfflineGenerated) {
        throw new BadRequestException('Student already has a definitive matricule');
      }
      return existing; // Retourner l'existant
    }

    // Générer un ID temporaire local : TEMP-{tenantId}-{timestamp}-{random}
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const temporaryLocalId = `TEMP-${tenantId.substring(0, 8)}-${timestamp}-${random}`;

    // Récupérer le tenant pour le code institution
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    const institutionCode = this.extractInstitutionCode(tenant);
    const currentYear = new Date().getFullYear();

    return this.prisma.studentIdentifier.create({
      data: {
        tenantId,
        studentId,
        globalMatricule: temporaryLocalId, // Temporaire, sera remplacé
        countryCode: 'BJ',
        institutionCode,
        firstEnrollmentYear: currentYear,
        sequenceNumber: 0, // Sera calculé à la synchronisation
        temporaryLocalId,
        isOfflineGenerated: true,
        locked: false, // Non verrouillé jusqu'à synchronisation
      },
    });
  }

  /**
   * Synchronise un matricule temporaire avec le matricule définitif
   * Appelé après reconnexion en mode offline
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
        `Temporary identifier with local ID ${temporaryLocalId} not found or already synchronized`,
      );
    }

    // Supprimer l'ancien temporaire
    await this.prisma.studentIdentifier.delete({
      where: { id: identifier.id },
    });

    // Générer le matricule définitif
    const definitiveIdentifier = await this.generateGlobalMatricule(
      tenantId,
      studentId,
      identifier.countryCode,
      generatedBy,
    );

    this.logger.log(
      `Synchronized temporary ${temporaryLocalId} to definitive ${definitiveIdentifier.globalMatricule}`,
    );

    return definitiveIdentifier;
  }

  /**
   * Récupère le matricule d'un élève
   */
  async getStudentMatricule(studentId: string, tenantId: string) {
    const identifier = await this.prisma.studentIdentifier.findFirst({
      where: { studentId, tenantId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!identifier) {
      throw new NotFoundException(`No matricule found for student ${studentId}`);
    }

    return identifier;
  }

  /**
   * Vérifie l'unicité d'un matricule (utilitaire)
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
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
            academicYear: {
              select: {
                id: true,
                name: true,
              },
            },
            schoolLevel: {
              select: {
                id: true,
                code: true,
                label: true,
              },
            },
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
   * Récupère les statistiques des matricules
   */
  async getMatriculeStats(tenantId?: string, academicYearId?: string) {
    const where: any = {};
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const identifiers = await this.prisma.studentIdentifier.findMany({
      where,
      include: {
        student: {
          // On ne peut pas utiliser where dans include, filtrer au niveau du where principal
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    const total = identifiers.length;
    const offlineGenerated = identifiers.filter((i) => i.isOfflineGenerated && !i.synchronizedAt).length;
    const synchronized = identifiers.filter((i) => i.isOfflineGenerated && i.synchronizedAt).length;
    const definitive = identifiers.filter((i) => !i.isOfflineGenerated).length;

    // Statistiques par année
    const byYear = identifiers.reduce((acc, id) => {
      const year = id.firstEnrollmentYear;
      acc[year] = (acc[year] || 0) + 1;
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
   * Extrait le code institution depuis le tenant
   * Génère un code depuis slug ou ID si pas de code défini
   */
  private extractInstitutionCode(tenant: any): string {
    // Si le tenant a un champ code ou institutionCode, l'utiliser
    // Sinon, générer depuis slug ou ID
    if (tenant.code) {
      return tenant.code.substring(0, 4).padEnd(4, '0').toUpperCase();
    }
    if (tenant.slug) {
      // Prendre les 4 premiers caractères du slug, uppercase, pad si nécessaire
      return tenant.slug.substring(0, 4).padEnd(4, '0').toUpperCase();
    }
    // Dernier recours : utiliser les 4 premiers caractères de l'ID
    return tenant.id.substring(0, 4).toUpperCase();
  }
}

