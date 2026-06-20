/**
 * ============================================================================
 * STUDENTS PRISMA SERVICE - MODULE 1
 * ============================================================================
 * 
 * Service Prisma pour la gestion complète des élèves
 * Module 1 : Gestion des Élèves & Scolarité
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MatriculeService } from './services/matricule.service';
import { PublicVerificationService } from './services/public-verification.service';
import { StudentCountVerifierService } from '../billing/services/student-count-verifier.service';

@Injectable()
export class StudentsPrismaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matriculeService: MatriculeService,
    private readonly publicVerificationService: PublicVerificationService,
    private readonly studentCountVerifier: StudentCountVerifierService,
  ) {}

  /**
   * Vérifie si le tenant peut inscrire un nouvel élève (plan d'abonnement).
   * Lance une ForbiddenException si l'ajout est bloqué.
   */
  private async assertCanEnroll(tenantId: string): Promise<void> {
    const check = await this.studentCountVerifier.canEnrollNewStudent(tenantId);
    if (!check.allowed) {
      const planLabel = check.currentPlan || 'plan actuel';
      const recommendedLabel = check.recommendedPlan || 'plan supérieur';
      const currentCount = check.currentCount ?? 0;
      const planLimit = check.planLimit ?? 0;
      throw new ForbiddenException({
        code: 'STUDENT_ENROLLMENT_BLOCKED',
        message: `L'ajout de nouveaux élèves est suspendu. Votre établissement a ${currentCount} élèves inscrits, ce qui dépasse la limite de votre ${planLabel} (${planLimit} élèves max). Veuillez mettre à niveau vers le plan ${recommendedLabel} pour reprendre les inscriptions.`,
        details: {
          currentCount,
          planLimit,
          currentPlan: check.currentPlan,
          recommendedPlan: check.recommendedPlan,
          graceEndsAt: check.graceEndsAt,
        },
      });
    }
  }

  /**
   * Crée un nouvel élève avec matricule institutionnel (généré backend, immuable).
   */
  async createStudent(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: Date;
    gender?: string;
    nationality?: string;
    primaryLanguage?: string;
    photoUrl?: string;
    npi?: string;
    createdById?: string;
  }) {
    // Vérifier que le tenant peut inscrire un nouvel élève (plan d'abonnement)
    await this.assertCanEnroll(data.tenantId);

    const schoolCode = await this.matriculeService.getSchoolCode(data.tenantId);
    const enrollmentYear = await this.matriculeService.getEnrollmentYearFromAcademicYear(data.academicYearId);

    const result = await this.prisma.$transaction(async (tx) => {
      const matricule = await this.matriculeService.generateInTransaction(
        tx,
        data.tenantId,
        schoolCode,
        enrollmentYear,
      );
      return tx.student.create({
        data: {
          ...data,
          matricule,
          enrollmentYear,
          studentCode: matricule,
          currentAcademicYearId: data.academicYearId,
          status: 'ACTIVE',
        },
        include: {
          schoolLevel: true,
          academicYear: true,
          studentGuardians: {
            include: {
              guardian: true,
            },
          },
          studentEnrollments: {
            include: {
              class: true,
            },
          },
        },
      });
    });

    // Vérifier le nombre d'élèves vs plan d'abonnement (best-effort, asynchrone)
    this.studentCountVerifier.verifyAfterEnrollment(data.tenantId).catch(() => {
      // Silencieux : le verifyAfterEnrollment log déjà les erreurs
    });

    return result;
  }

  /**
   * Récupère tous les élèves d'un tenant
   *
   * Mode "année stricte" : academicYearId est fortement recommandé.
   * Si non fourni, un warning est loggé pour aider à identifier les callers
   * à corriger. L'interceptor injecte automatiquement academicYearId dans
   * les query params, donc en pratique il est toujours présent.
   */
  async findAllStudents(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      status?: string;
      classId?: string;
      search?: string;
      regimeType?: string;
      hasArrears?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    // Mode "année stricte" : warning si pas d'academicYearId
    if (!filters?.academicYearId) {
      console.warn('STUDENTS_FINDALL_WITHOUT_ACADEMIC_YEAR', {
        tenantId,
        message: 'findAllStudents appelé sans academicYearId — mode non-strict',
      });
    }

    const where: any = {
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    // Niveau scolaire : filtrer sauf en mode 'ALL' (plateforme)
    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.regimeType) {
      where.regimeType = filters.regimeType;
    }

    if (filters?.classId || filters?.hasArrears === true || filters?.hasArrears === false) {
      const enrollmentWhere: any = { status: 'ACTIVE' };
      if (filters?.classId) {
        enrollmentWhere.classId = filters.classId;
      }
      if (filters?.hasArrears === true) {
        enrollmentWhere.previousArrears = { gt: 0 };
      }
      if (filters?.hasArrears === false) {
        enrollmentWhere.previousArrears = { lte: 0 };
      }
      where.studentEnrollments = { some: enrollmentWhere };
    }

    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { studentCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Pagination: défaut 50, max 200 pour éviter OOM
    const pageSize = Math.min(filters?.limit || 50, 200);
    const pageNumber = Math.max(filters?.page || 1, 1);
    const skip = (pageNumber - 1) * pageSize;

    return this.prisma.student.findMany({
      where,
      include: {
        schoolLevel: true,
        academicYear: true,
        studentEnrollments: {
          where: { status: 'ACTIVE' },
          include: {
            class: true,
          },
        },
        studentGuardians: {
          where: { isPrimary: true },
          include: {
            guardian: true,
          },
        },
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
      skip,
      take: pageSize,
    });
  }

  /**
   * Récupère un élève par ID
   */
  async findStudentById(id: string, tenantId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
      include: {
        schoolLevel: true,
        academicYear: true,
        studentGuardians: {
          include: {
            guardian: true,
          },
        },
        studentEnrollments: {
          include: {
            class: true,
            academicYear: true,
            schoolLevel: true,
          },
          orderBy: { enrollmentDate: 'desc' },
        },
        studentDocuments: {
          orderBy: { createdAt: 'desc' },
        },
        absences: {
          take: 10,
          orderBy: { date: 'desc' },
        },
        disciplinaryActions: {
          take: 10,
          orderBy: { actionDate: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    return student;
  }

  /**
   * Met à jour un élève
   */
  async updateStudent(
    id: string,
    tenantId: string,
    data: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: Date;
      gender?: string;
      nationality?: string;
      primaryLanguage?: string;
      npi?: string;
      status?: string;
    }
  ) {
    await this.findStudentById(id, tenantId);
    const { matricule: _m, enrollmentYear: _e, ...safeData } = data as typeof data & { matricule?: string; enrollmentYear?: number };
    const updated = await this.prisma.student.update({
      where: { id },
      data: safeData,
      include: {
        schoolLevel: true,
        academicYear: true,
      },
    });
    if (safeData.status === 'SUSPENDED' || safeData.status === 'TRANSFERRED') {
      this.publicVerificationService.deactivateTokensForStudent(id).catch(() => {});
    }
    return updated;
  }

  /**
   * Archive un élève (pas de suppression physique)
   */
  async archiveStudent(id: string, tenantId: string, reason?: string) {
    const student = await this.findStudentById(id, tenantId);

    return this.prisma.student.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
      },
    });
  }

  /**
   * Inscrit un élève dans une classe
   */
  async enrollStudent(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    studentId: string;
    classId: string;
    enrollmentType: 'NEW' | 'REPEAT' | 'TRANSFER';
    enrollmentDate: Date;
  }) {
    // Vérifier que le tenant peut inscrire un élève (plan d'abonnement)
    // L'élève existe déjà mais son enrollment pour l'année active peut faire
    // grandir le nombre d'élèves comptés (currentAcademicYearId non mis à jour ici).
    await this.assertCanEnroll(data.tenantId);

    // Vérifier que l'élève existe
    const student = await this.findStudentById(data.studentId, data.tenantId);

    // Vérifier que la classe existe
    const classExists = await this.prisma.class.findFirst({
      where: {
        id: data.classId,
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
      },
    });

    if (!classExists) {
      throw new NotFoundException(`Class with ID ${data.classId} not found`);
    }

    // Désactiver les inscriptions actives précédentes pour cette année
    await this.prisma.studentEnrollment.updateMany({
      where: {
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        status: 'ACTIVE',
      },
      data: {
        status: 'TRANSFERRED',
        exitDate: new Date(),
        exitReason: 'Nouvelle inscription',
      },
    });

    // Créer la nouvelle inscription
    const result = await this.prisma.studentEnrollment.create({
      data: {
        ...data,
        status: 'VALIDATED',
      },
      include: {
        class: true,
        student: true,
      },
    });

    // Vérifier le nombre d'élèves vs plan d'abonnement (best-effort, asynchrone)
    this.studentCountVerifier.verifyAfterEnrollment(data.tenantId).catch(() => {
      // Silencieux : le verifyAfterEnrollment log déjà les erreurs
    });

    return result;
  }

  /**
   * Récupère les statistiques des élèves
   */
  async getStudentStatistics(tenantId: string, academicYearId: string, schoolLevelId?: string) {
    const where: any = {
      tenantId,
      academicYearId,
    };

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }

    const [total, active, archived, byGender, byStatus] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.count({ where: { ...where, status: 'ACTIVE' } }),
      this.prisma.student.count({ where: { ...where, status: 'ARCHIVED' } }),
      this.prisma.student.groupBy({
        by: ['gender'],
        where,
        _count: true,
      }),
      this.prisma.student.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
    ]);

    return {
      total,
      active,
      archived,
      byGender,
      byStatus,
    };
  }
}

