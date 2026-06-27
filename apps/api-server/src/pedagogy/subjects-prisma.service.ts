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
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

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
    abbreviation?: string;
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
        ...prismaCreateDefaults(),
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
      language?: string;
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

    // Mode bilingue : filtrer par langue (FR/EN)
    // IMPORTANT : filtrage STRICT par langue.
    // - language=FR → montre les matières FR + les matières sans langue (null) 
    //   pour rétro-compatibilité (matières créées avant l'activation du bilingue)
    // - language=EN → montre UNIQUEMENT les matières EN (pas les null)
    //   Sinon les matières FR sans langue apparaîtraient en mode EN
    if (filters?.language) {
      if (filters.language === 'EN') {
        where.AND = [
          ...(where.AND as any[] || []),
          { language: 'EN' },
        ];
      } else {
        // FR : inclut les matières FR et null (rétro-compatibilité)
        where.AND = [
          ...(where.AND as any[] || []),
          { OR: [{ language: 'FR' }, { language: null }] },
        ];
      }
    }

    if (filters?.search) {
      // Utiliser AND pour combiner avec un éventuel filtre language (au lieu d'écraser OR)
      where.AND = [
        ...(where.AND as any[] || []),
        {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { code: { contains: filters.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    return this.prisma.subject.findMany({
      where,
      include: {
        schoolLevel: true,
        academicYear: true,
        academicTrack: true,
        subjectPrograms: true,
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
        teacherSubjects: {
          include: {
            teacher: true,
          },
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
      data: { ...prismaUpdateDefaults(), ...data },
      include: {
        schoolLevel: true,
        academicYear: true,
      },
    });
  }

  /**
   * Supprime une matière via SQL direct (bypass Prisma cascade issues).
   * Supprime d'abord toutes les tables qui référencent subjectId, puis la matière.
   */
  async deleteSubject(id: string, tenantId: string) {
    const subject = await this.findSubjectById(id, tenantId);

    // ─── Suppression directe via SQL (bypass Prisma) ──
    // On supprime TOUTES les tables qui pourraient référencer subjectId.
    // Utilisation de $executeRawUnsafe pour éviter les erreurs de cascade Prisma.
    const cleanupTables = [
      { table: 'class_subjects', column: 'subjectId' },
      { table: 'subject_assignments', column: 'subjectId' },
      { table: 'teacher_subjects', column: 'subjectId' },
      { table: 'exam_subjects', column: 'subjectId' },
      { table: 'exam_scores', column: 'subjectId' },
      { table: 'subject_programs', column: 'subjectId' },
      { table: 'lesson_plans', column: 'subjectId' },
      { table: 'lesson_journals', column: 'subjectId' },
      { table: 'homework_entries', column: 'subjectId' },
      { table: 'grades', column: 'subjectId' },
      { table: 'grade_calculations', column: 'subjectId' },
      { table: 'pedagogical_documents', column: 'subjectId' },
      { table: 'daily_logs', column: 'subjectId' },
    ];

    for (const { table, column } of cleanupTables) {
      try {
        await this.prisma.$executeRawUnsafe(
          `DELETE FROM "${table}" WHERE "${column}" = $1`,
          id,
        );
      } catch (err: any) {
        // Table inexistante ou colonne manquante — on continue
        this.logger.warn(`Skip cleanup ${table}.${column} for subject ${id}: ${err.message}`);
      }
    }

    // Suppression physique de la matière via SQL direct
    try {
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM "subjects" WHERE "id" = $1 AND "tenantId" = $2`,
        id, tenantId,
      );
    } catch (err: any) {
      throw new BadRequestException(`Failed to delete subject: ${err.message}`);
    }

    this.logger.log(`Subject ${id} deleted via direct SQL (tenant=${tenantId})`);
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
                ...prismaCreateDefaults(),
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
    const defaultSubjectsByLevel: Record<string, Array<{ name: string; code: string; abbreviation: string }>> = {
      MATERNELLE: [
        { name: 'Éducation pour la santé',             abbreviation: 'ES',    code: 'ES-01'    },
        { name: 'Éducation à des réflexions de santé', abbreviation: 'ERS',   code: 'ERS-02'   },
        { name: 'Éducation du mouvement',              abbreviation: 'EM',    code: 'EM-03'    },
        { name: 'Gestuelle',                           abbreviation: 'GEST',  code: 'GEST-04'  },
        { name: 'Rythmique',                           abbreviation: 'RYTH',  code: 'RYTH-05'  },
        { name: 'Observation',                         abbreviation: 'OBS',   code: 'OBS-06'   },
        { name: 'Éducation sensorielle',               abbreviation: 'ESENS', code: 'ESENS-07' },
        { name: 'Pré-lecture',                         abbreviation: 'PLEC',  code: 'PLEC-08'  },
        { name: 'Pré-écriture',                        abbreviation: 'PECR',  code: 'PECR-09'  },
        { name: 'Pré-mathématique',                    abbreviation: 'PMAT',  code: 'PMAT-10'  },
        { name: 'Expression plastique',                abbreviation: 'EP',    code: 'EP-11'    },
        { name: 'Expression émotionnelle',             abbreviation: 'EE',    code: 'EE-12'    },
        { name: 'Langage',                             abbreviation: 'LANG',  code: 'LANG-13'  },
        { name: 'Conte',                               abbreviation: 'CONT',  code: 'CONT-14'  },
        { name: 'Comptine',                            abbreviation: 'COMP',  code: 'COMP-15'  },
        { name: 'Poésie',                              abbreviation: 'POES',  code: 'POES-16'  },
        { name: 'Chant',                               abbreviation: 'CHAN',  code: 'CHAN-17'   },
      ],
      PRIMAIRE: [
        { name: 'Expression Écrite',                        abbreviation: 'EE',   code: 'EE-01'   },
        { name: 'Lecture',                                  abbreviation: 'LECT', code: 'LECT-02' },
        { name: 'Dictée',                                   abbreviation: 'DICT', code: 'DICT-03' },
        { name: 'Mathématiques',                            abbreviation: 'MATH', code: 'MATH-04' },
        { name: 'Éducation Scientifique et Technologique',  abbreviation: 'EST',  code: 'EST-05'  },
        { name: 'Éducation Sociale',                        abbreviation: 'ES',   code: 'ES-06'   },
        { name: 'Éducation Artistique (EA) Vivant',         abbreviation: 'EAV',  code: 'EAV-07'  },
        { name: 'Éducation Artistique (EA) Plastique',      abbreviation: 'EAP',  code: 'EAP-08'  },
        { name: 'Éducation Physique et Sportive',           abbreviation: 'EPS',  code: 'EPS-09'  },
      ],
      SECONDAIRE: [
        { name: 'Communication Écrite',                     abbreviation: 'CE',   code: 'CE-01'   },
        { name: 'Lecture',                                  abbreviation: 'LECT', code: 'LECT-02' },
        { name: 'Anglais',                                  abbreviation: 'ANG',  code: 'ANG-03'  },
        { name: 'Français',                                 abbreviation: 'FR',   code: 'FR-04'   },
        { name: 'Espagnol',                                 abbreviation: 'ESP',  code: 'ESP-05'  },
        { name: 'Allemand',                                 abbreviation: 'ALL',  code: 'ALL-06'  },
        { name: 'Mathématiques',                            abbreviation: 'MATH', code: 'MATH-07' },
        { name: 'Physique Chimie et Technologie',           abbreviation: 'PCT',  code: 'PCT-08'  },
        { name: 'Science de la Vie et de la Terre',         abbreviation: 'SVT',  code: 'SVT-09'  },
        { name: 'Éducation Physique et Sportive',           abbreviation: 'EPS',  code: 'EPS-10'  },
      ],
    };


    const subjectsToCreate: Array<{
      tenantId: string;
      academicYearId: string;
      schoolLevelId: string;
      name: string;
      code: string;
      coefficient: number;
      abbreviation: string;
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
          abbreviation: subj.abbreviation,
          coefficient: 1.0,
        });
      }
    }


    if (subjectsToCreate.length === 0) return;

    // Insertion groupée dans une transaction
    await this.prisma.$transaction(
      subjectsToCreate.map(data =>
        this.prisma.subject.create({ data: { ...prismaCreateDefaults(), ...data } })
      )
    );
  }
}

