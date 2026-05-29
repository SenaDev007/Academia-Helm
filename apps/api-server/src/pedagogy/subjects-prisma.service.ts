/**
 * ============================================================================
 * SUBJECTS PRISMA SERVICE - MODULE 2
 * ============================================================================
 * 
 * Service pour la gestion des matières
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SubjectsPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une matière
   */
  async createSubject(data: {
    tenantId: string;
    academicYearId: string;
    schoolLevelId: string;
    academicTrackId?: string;
    language?: string;
    name: string;
    code: string;
    coefficient?: number;
    weeklyHours?: number;
    description?: string;
  }) {
    // Vérifier l'unicité du code
    const existing = await this.prisma.subject.findFirst({
      where: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId,
        schoolLevelId: data.schoolLevelId,
        code: data.code,
      },
    });

    if (existing) {
      throw new BadRequestException(`Subject with code ${data.code} already exists`);
    }

    return this.prisma.subject.create({
      data: {
        ...data,
        coefficient: data.coefficient || 1.0,
      },
      include: {
        schoolLevel: true,
        academicYear: true,
        academicTrack: true,
      },
    });
  }

  /**
   * Récupère toutes les matières
   */
  async findAllSubjects(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      academicTrackId?: string;
      search?: string;
    }
  ) {
    await this.syncSubjectsFromSettings(tenantId, filters?.academicYearId);

    const where: any = {
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.academicTrackId) {
      where.academicTrackId = filters.academicTrackId;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.subject.findMany({
      where,
      include: {
        schoolLevel: true,
        academicYear: true,
        academicTrack: true,
        programs: true,
      },
      orderBy: [
        { code: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * Récupère une matière par ID
   */
  async findSubjectById(id: string, tenantId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: { id, tenantId },
      include: {
        schoolLevel: true,
        academicYear: true,
        academicTrack: true,
        teachers: {
          // TeacherSubject a une relation teacher, mais elle est déjà accessible via la relation
          // Pas besoin d'include supplémentaire
        },
        classSubjects: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }

    return subject;
  }

  /**
   * Met à jour une matière
   */
  async updateSubject(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      code?: string;
      coefficient?: number;
      language?: string;
      weeklyHours?: number;
      description?: string;
    }
  ) {
    const subject = await this.findSubjectById(id, tenantId);

    // Vérifier l'unicité du code si modifié
    if (data.code && data.code !== subject.code) {
      const existing = await this.prisma.subject.findFirst({
        where: {
          tenantId,
          academicYearId: subject.academicYearId,
          schoolLevelId: subject.schoolLevelId,
          code: data.code,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException(`Subject with code ${data.code} already exists`);
      }
    }

    return this.prisma.subject.update({
      where: { id },
      data,
      include: {
        schoolLevel: true,
        academicYear: true,
      },
    });
  }

  /**
   * Supprime une matière (soft delete via archivage)
   */
  async deleteSubject(id: string, tenantId: string) {
    const subject = await this.findSubjectById(id, tenantId);

    // Vérifier qu'aucune classe n'utilise cette matière
    const classSubjects = await this.prisma.classSubject.count({
      where: {
        subjectId: id,
        tenantId,
      },
    });

    if (classSubjects > 0) {
      throw new BadRequestException(
        `Cannot delete subject: ${classSubjects} class(es) are using it`
      );
    }

    // Suppression physique (ou archivage selon les règles métier)
    await this.prisma.subject.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Synchronise le catalogue des matières pour une année donnée.
   * 1. Copie les matières de l'année précédente si l'année actuelle est vide.
   * 2. Si aucune année précédente, insère le catalogue par défaut selon les niveaux scolaires configurés.
   */
  async syncSubjectsFromSettings(tenantId: string, academicYearId?: string) {
    if (!academicYearId) return;

    // Vérifier si des matières existent déjà
    const count = await this.prisma.subject.count({
      where: { tenantId, academicYearId }
    });

    if (count > 0) return;

    // Tenter de trouver l'année précédente
    const currentYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId }
    });
    if (!currentYear) return;

    const previousYear = await this.prisma.academicYear.findFirst({
      where: { 
        tenantId, 
        startDate: { lt: currentYear.startDate } 
      },
      orderBy: { startDate: 'desc' }
    });

    if (previousYear) {
      // Copier les matières de l'année précédente
      const sourceSubjects = await this.prisma.subject.findMany({
        where: { tenantId, academicYearId: previousYear.id }
      });

      if (sourceSubjects.length > 0) {
        await this.prisma.$transaction(
          sourceSubjects.map(s => {
            const { id, createdAt, updatedAt, ...data } = s;
            return this.prisma.subject.create({
              data: {
                ...data,
                academicYearId: academicYearId
              }
            });
          })
        );
        return;
      }
    }

    // Aucune année précédente ou aucune matière copiée : insérer le catalogue par défaut
    await this.seedDefaultSubjects(tenantId, academicYearId);
  }

  /**
   * Insère le catalogue de matières par défaut selon les niveaux scolaires configurés.
   * Chaque matière est créée avec coefficient 1.0 par défaut (personnalisable par l'utilisateur).
   */
  private async seedDefaultSubjects(tenantId: string, academicYearId: string) {
    // Récupérer tous les niveaux scolaires du tenant
    const schoolLevels = await this.prisma.schoolLevel.findMany({
      where: { tenantId },
    });

    if (schoolLevels.length === 0) return;

    // Catalogue par défaut : Maternelle (code contient MATERNELLE ou MATERNAL)
    const defaultSubjectsByLevel: Record<string, Array<{ name: string; code: string; description?: string }>> = {
      MATERNELLE: [
        { name: 'Éducation pour la santé',             code: 'MAT_ES'   },
        { name: 'Éducation à des réflexions de santé', code: 'MAT_ERS'  },
        { name: 'Éducation du mouvement',              code: 'MAT_EM'   },
        { name: 'Gestuelle',                           code: 'MAT_GEST' },
        { name: 'Rythmique',                           code: 'MAT_RYTH' },
        { name: 'Observation',                         code: 'MAT_OBS'  },
        { name: 'Éducation sensorielle',               code: 'MAT_SENS' },
        { name: 'Pré-lecture',                         code: 'MAT_PLEC' },
        { name: 'Pré-écriture',                        code: 'MAT_PECR' },
        { name: 'Pré-mathématique',                    code: 'MAT_PMAT' },
        { name: 'Expression plastique',                code: 'MAT_EPLA' },
        { name: 'Expression émotionnelle',             code: 'MAT_EEMO' },
        { name: 'Langage',                             code: 'MAT_LANG' },
        { name: 'Conte',                               code: 'MAT_CONT' },
        { name: 'Comptine',                            code: 'MAT_COMP' },
        { name: 'Poésie',                              code: 'MAT_POES' },
        { name: 'Chant',                               code: 'MAT_CHAN' },
      ],
      PRIMAIRE: [
        { name: 'Expression Écrite', code: 'EXPR_EC' },
        { name: 'Lecture', code: 'LECT' },
        { name: 'Dictée', code: 'DICT' },
        { name: 'Mathématiques', code: 'MATH' },
        { name: 'Éducation Scientifique et Technologique', code: 'EST' },
        { name: 'Éducation Sociale', code: 'ES' },
        { name: 'Éducation Artistique Vivant', code: 'EA_VIV' },
        { name: 'Éducation Artistique Plastique', code: 'EA_PLAS' },
        { name: 'Éducation Physique et Sportive', code: 'EPS' },
      ],
      SECONDAIRE: [
        { name: 'Communication Écrite', code: 'COMM_EC' },
        { name: 'Lecture', code: 'LECT' },
        { name: 'Anglais', code: 'ANG' },
        { name: 'Français', code: 'FR' },
        { name: 'Espagnol', code: 'ESP' },
        { name: 'Allemand', code: 'ALL' },
        { name: 'Mathématiques', code: 'MATH' },
        { name: 'Physique Chimie et Technologie', code: 'PCT' },
        { name: 'Science de la Vie et de la Terre', code: 'SVT' },
        { name: 'Éducation Physique et Sportive', code: 'EPS' },
      ],
    };

    const subjectsToCreate: Array<{
      tenantId: string;
      academicYearId: string;
      schoolLevelId: string;
      name: string;
      code: string;
      coefficient: number;
      description?: string;
    }> = [];

    for (const level of schoolLevels) {
      // Matcher le niveau par son code (insensible à la casse, on cherche le mot-clé)
      const levelCodeUpper = level.code.toUpperCase();
      let matchedKey: string | null = null;

      if (levelCodeUpper.includes('MATERN') || levelCodeUpper.includes('MATERNAL')) {
        matchedKey = 'MATERNELLE';
      } else if (levelCodeUpper.includes('PRIMA') || levelCodeUpper.includes('PRIM')) {
        matchedKey = 'PRIMAIRE';
      } else if (levelCodeUpper.includes('SECOND') || levelCodeUpper.includes('SEC') || levelCodeUpper.includes('LYCEA') || levelCodeUpper.includes('LYCEE')) {
        matchedKey = 'SECONDAIRE';
      }

      if (!matchedKey) continue;

      const defaults = defaultSubjectsByLevel[matchedKey];
      for (const subj of defaults) {
        subjectsToCreate.push({
          tenantId,
          academicYearId,
          schoolLevelId: level.id,
          name: subj.name,
          code: subj.code,
          coefficient: 1.0,
          description: subj.description,
        });
      }
    }

    if (subjectsToCreate.length === 0) return;

    // Insertion groupée dans une transaction
    await this.prisma.$transaction(
      subjectsToCreate.map(data =>
        this.prisma.subject.create({ data })
      )
    );
  }
}

