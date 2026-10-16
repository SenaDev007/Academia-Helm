/**
 * ============================================================================
 * HELM ENSEIGNANT — PROVISIONING DE L'ESPACE ENSEIGNANT AUTONOME
 * ============================================================================
 *
 * Réplique le pattern d'onboarding d'une école (OnboardingService.activate)
 * en version allégée pour un enseignant individuel :
 *
 *   1. Transaction atomique :
 *      - Tenant `type: 'TEACHER'` (l'enseignant est son propre tenant)
 *      - 3 SchoolLevels (offerts par défaut, actifs selon le choix)
 *      - AcademicYear courante active + AcademicTrack FR
 *      - SettingsPedagogicalStructure (niveaux activés)
 *      - Teacher (matricule PROF-YY-NNNNN, email = email du User)
 *      - User rôle ENSEIGNANT + UserRole système + UserTenant
 *   2. Après commit (idempotent) :
 *      - EducationStructureService.initializeDefaultStructure → référentiel
 *        officiel (Maternelle 1-2, CI→CM2, 6ème→Terminale) + sync school_levels
 *      - AcademicStructurePrismaService.findAllClasses → matérialise les
 *        AcademicLevel/Cycle/Class de l'année (sync paresseuse idempotente)
 *      - SubjectsPrismaService.syncSubjectsFromSettings → catalogue matières
 *        par niveau (17 maternelle / 9 primaire / 10 secondaire)
 *      - Affectations : ClassSubject + TeacherClassAssignment pour TOUTES les
 *        classes × matières des niveaux activés (l'enseignant possède tout,
 *        il choisira dans l'UI) + TeacherAcademicProfile
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { SubdomainService } from '../../common/services/subdomain.service';
import { EducationStructureService } from '../../settings/services/education-structure.service';
import { AcademicPeriodSettingsService } from '../../settings/services/academic-period-settings.service';
import { AcademicStructurePrismaService } from '../../pedagogy/academic-structure-prisma.service';
import { SubjectsPrismaService } from '../../pedagogy/subjects-prisma.service';
import { TeacherLevelCode } from '../dto/teacher-portal.dto';

/** Libellés canoniques des niveaux (alignés sur getSchoolLevelsForType). */
const LEVEL_CONFIGS: Array<{ code: TeacherLevelCode; name: string; label: string; order: number }> = [
  { code: 'MATERNELLE', name: 'Maternelle', label: 'Maternelle', order: 0 },
  { code: 'PRIMAIRE', name: 'Primaire', label: 'Primaire', order: 1 },
  { code: 'SECONDAIRE', name: 'Secondaire', label: 'Secondaire', order: 2 },
];

const SALT_ROUNDS = 10;

export interface ProvisionTeacherInput {
  email: string;
  password: string;
  /**
   * Hash bcrypt pré-calculé (draft d'onboarding « paiement d'abord »).
   * Quand il est fourni, il PRIME sur password — le mot de passe en clair
   * n'est plus disponible au moment de l'activation (il a été hashé à la
   * création du draft, avant le paiement FedaPay).
   */
  passwordHash?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  levels: TeacherLevelCode[];
}

export interface ProvisionTeacherResult {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  teacherId: string;
  teacherMatricule: string;
  academicYearId: string;
  levels: TeacherLevelCode[];
}

@Injectable()
export class TeacherProvisioningService {
  private readonly logger = new Logger(TeacherProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subdomainService: SubdomainService,
    private readonly educationStructureService: EducationStructureService,
    private readonly academicPeriodSettingsService: AcademicPeriodSettingsService,
    private readonly academicStructureService: AcademicStructurePrismaService,
    private readonly subjectsService: SubjectsPrismaService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  //  INSCRIPTION — création complète de l'univers autonome
  // ─────────────────────────────────────────────────────────────────────────

  async provisionStandaloneTeacher(
    input: ProvisionTeacherInput,
  ): Promise<ProvisionTeacherResult> {
    const email = input.email.trim().toLowerCase();
    const levels = [...new Set(input.levels)];

    // ── Garde-fous ──
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException(
        'Un compte existe déjà avec cet email. Connectez-vous ou utilisez une autre adresse.',
      );
    }

    // Sous-domaine généré avant la transaction (lectures DB)
    const subdomain = await this.subdomainService.generateAndValidate(
      `prof-${input.firstName}-${input.lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    );

    // Matricule enseignant autonome : PROF-<YY>-<NNNNN>
    const yy = String(new Date().getFullYear()).slice(-2);
    const matricule = `PROF-${yy}-${String(Date.now()).slice(-5)}`;

    // Hash pré-calculé du draft (paiement d'abord) ou hash du mot de passe fourni.
    const passwordHash =
      input.passwordHash ?? (await bcrypt.hash(input.password, SALT_ROUNDS));

    // ── Transaction atomique ──
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Pays par défaut (Bénin) — identique au pattern onboarding
      let country = await tx.country.findFirst({ where: { code: 'BJ' } });
      if (!country) {
        country = await tx.country.findFirst({ where: { isDefault: true } });
      }
      if (!country) {
        country = await tx.country.findFirst({ where: { isActive: true } });
      }

      // 2. Tenant — l'enseignant est son propre tenant
      const tenant = await tx.tenant.create({
        data: {
          name: `Espace de ${input.firstName} ${input.lastName}`.trim(),
          slug: subdomain,
          subdomain,
          ...(country ? { countryId: country.id } : {}),
          type: 'TEACHER',
          status: 'active',
          subscriptionStatus: 'TRIAL',
        },
      });

      // 3. Les 3 niveaux scolaires — offerts, actifs selon le choix initial
      for (const cfg of LEVEL_CONFIGS) {
        await tx.schoolLevel.create({
          data: {
            tenantId: tenant.id,
            code: cfg.code,
            name: cfg.name,
            label: cfg.label,
            order: cfg.order,
            isActive: levels.includes(cfg.code),
          },
        });
      }

      // 4. Année académique courante (pattern onboarding)
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      let academicYearId: string | null = null;
      try {
        const academicYear = await tx.academicYear.create({
          data: {
            tenantId: tenant.id,
            name: `${currentYear}-${nextYear}`,
            label: `Année scolaire ${currentYear}-${nextYear}`,
            startDate: new Date(currentYear, 8, 1),
            endDate: new Date(nextYear, 7, 31),
            isActive: true,
            isAutoGenerated: true,
          },
        });
        academicYearId = academicYear.id;
      } catch (e: any) {
        this.logger.warn(`⚠️ Default academic year: ${e.message}`);
      }
      if (!academicYearId) {
        const fallback = await tx.academicYear.findFirst({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: 'desc' },
        });
        if (!fallback) throw new BadRequestException('Impossible de créer l’année scolaire');
        academicYearId = fallback.id;
      }

      // 5. Piste académique FR (défaut — le bilinguisme reste une option école)
      await tx.academicTrack.create({
        data: {
          tenantId: tenant.id,
          code: 'FR',
          name: 'Français',
          description: 'Parcours académique en français',
          order: 0,
          isDefault: true,
          isActive: true,
          metadata: { language: 'fr', bilingual: false },
        },
      });

      // 6. Structure pédagogique (Paramètres > Structure équivalent enseignant)
      await tx.settingsPedagogicalStructure.create({
        data: {
          tenantId: tenant.id,
          maternelleEnabled: levels.includes('MATERNELLE'),
          primaireEnabled: levels.includes('PRIMAIRE'),
          secondaireEnabled: levels.includes('SECONDAIRE'),
        },
      });

      // 7. Le niveau du Teacher = premier niveau activé (schoolLevelId NOT NULL)
      const firstLevel = LEVEL_CONFIGS.find((l) => levels.includes(l.code)) ?? LEVEL_CONFIGS[1];
      const schoolLevel = await tx.schoolLevel.findFirst({
        where: { tenantId: tenant.id, code: firstLevel.code },
      });
      if (!schoolLevel) throw new BadRequestException('Niveau scolaire introuvable');

      // 8. Teacher — email identique au User (liaison par email, pas de FK)
      const teacher = await tx.teacher.create({
        data: {
          tenantId: tenant.id,
          schoolLevelId: schoolLevel.id,
          matricule,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email,
          phone: input.phone || null,
          status: 'active',
          assignedLanguages: ['FR'],
          position: 'Enseignant autonome',
          specialization: 'Helm Enseignant',
          createdBy: null,
        },
      });

      // 9. User ENSEIGNANT
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          role: 'ENSEIGNANT',
          tenantId: tenant.id,
          status: 'active',
        },
      });

      // 10. Rôle système ENSEIGNANT (résilient aux deux variantes de nom)
      try {
        const teacherRole = await tx.role.findFirst({
          where: { name: { in: ['ENSEIGNANT', 'TEACHER'] }, isSystemRole: true },
        });
        if (teacherRole) {
          const existing = await tx.userRole.findFirst({
            where: { userId: user.id, roleId: teacherRole.id, tenantId: tenant.id },
          });
          if (!existing) {
            await tx.userRole.create({
              data: { userId: user.id, roleId: teacherRole.id, tenantId: tenant.id },
            });
          }
        }
      } catch (e: any) {
        this.logger.warn(`⚠️ UserRole assignment skipped: ${e.message}`);
      }

      // 11. UserTenant
      try {
        await tx.userTenant.create({
          data: { userId: user.id, tenantId: tenant.id, role: 'ENSEIGNANT', isActive: true },
        });
      } catch (e: any) {
        this.logger.warn(`⚠️ UserTenant creation skipped: ${e.message}`);
      }

      return {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        userId: user.id,
        teacherId: teacher.id,
        teacherMatricule: teacher.matricule,
        academicYearId,
        levels,
      };
    });

    // ── Après commit : provisionnement différé (idempotent, non-bloquant) ──
    await this.materializeStructure(result.tenantId, result.academicYearId, levels);

    this.logger.log(
      `✅ Helm Enseignant provisioned: ${email} → tenant ${result.tenantId} (${subdomain}), levels=${levels.join(',')}`,
    );

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  ACTIVATION / DÉSACTIVATION DE NIVEAUX (après inscription)
  // ─────────────────────────────────────────────────────────────────────────

  async setTeacherLevels(
    tenantId: string,
    levels: TeacherLevelCode[],
  ): Promise<{ levels: TeacherLevelCode[]; academicYearId: string }> {
    const normalized = [...new Set(levels)];

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.type !== 'TEACHER') {
      throw new BadRequestException('Ce tenant n’est pas un espace enseignant autonome');
    }

    // 1. SettingsPedagogicalStructure
    await this.prisma.settingsPedagogicalStructure.upsert({
      where: { tenantId },
      create: {
        tenantId,
        maternelleEnabled: normalized.includes('MATERNELLE'),
        primaireEnabled: normalized.includes('PRIMAIRE'),
        secondaireEnabled: normalized.includes('SECONDAIRE'),
      },
      update: {
        maternelleEnabled: normalized.includes('MATERNELLE'),
        primaireEnabled: normalized.includes('PRIMAIRE'),
        secondaireEnabled: normalized.includes('SECONDAIRE'),
      },
    });

    // 2. SchoolLevels isActive (les 3 existent dès l'inscription)
    for (const cfg of LEVEL_CONFIGS) {
      await this.prisma.schoolLevel.updateMany({
        where: { tenantId, code: cfg.code },
        data: { isActive: normalized.includes(cfg.code) },
      });
    }

    // 3. Année courante
    const academicYear =
      (await this.prisma.academicYear.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: 'desc' },
      })) ??
      (await this.prisma.academicYear.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }));
    if (!academicYear) throw new BadRequestException('Aucune année scolaire trouvée');

    // 4. Re-provisionner structure + classes + matières + affectations
    await this.materializeStructure(tenantId, academicYear.id, normalized);

    // 5. Si le Teacher pointait vers un niveau désormais inactif, le re-pointer
    const activeLevels = await this.prisma.schoolLevel.findMany({
      where: { tenantId, isActive: true },
      orderBy: { order: 'asc' },
    });
    if (activeLevels.length > 0) {
      await this.prisma.teacher.updateMany({
        where: { tenantId, schoolLevelId: { notIn: activeLevels.map((l) => l.id) } },
        data: { schoolLevelId: activeLevels[0].id },
      });
    }

    this.logger.log(`✅ Levels updated for teacher-tenant ${tenantId}: ${normalized.join(',')}`);
    return { levels: normalized, academicYearId: academicYear.id };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  AFFECTATIONS — l'enseignant possède toutes les classes de ses niveaux
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Crée les ClassSubject manquants (classe × matière) et les
   * TeacherClassAssignment pour TOUTES les classes actives des niveaux activés.
   * Appelée aussi par setTeacherLevels → les nouvelles classes du niveau
   * activé sont automatiquement affectées à l'enseignant.
   */
  async syncTeacherAssignments(tenantId: string, academicYearId: string): Promise<number> {
    const teachers = await this.prisma.teacher.findMany({ where: { tenantId } });
    if (teachers.length === 0) return 0;
    const teacher = teachers[0];

    const activeSchoolLevelIds = await this.prisma.schoolLevel.findMany({
      where: { tenantId, isActive: true },
      select: { id: true },
    });
    const levelIds = activeSchoolLevelIds.map((l) => l.id);
    if (levelIds.length === 0) return 0;

    // Classes pédagogiques actives des niveaux activés (avec leur niveau école)
    const classes = await this.prisma.academicClass.findMany({
      where: {
        tenantId,
        academicYearId,
        isActive: true,
      },
      include: { level: true },
    });
    const levelCodes = new Set(
      (
        await this.prisma.schoolLevel.findMany({
          where: { tenantId, isActive: true },
          select: { code: true },
        })
      ).map((l) => l.code.toUpperCase()),
    );
    const relevantClasses = classes.filter((c) => {
      const schoolLevelId = (c as any).schoolLevelId;
      if (schoolLevelId) return levelIds.includes(schoolLevelId);
      // Fallback : filtrer par le nom du niveau pédagogique
      const levelName = (c.level?.name || '').toUpperCase();
      return (
        (levelName.includes('MATERN') && levelCodes.has('MATERNELLE')) ||
        (levelName.includes('PRIMA') && levelCodes.has('PRIMAIRE')) ||
        (levelName.includes('SECOND') && levelCodes.has('SECONDAIRE'))
      );
    });

    // Matières des niveaux activés pour l'année
    const subjects = await this.prisma.subject.findMany({
      where: { tenantId, academicYearId, schoolLevelId: { in: levelIds } },
    });
    if (subjects.length === 0) return 0;

    const subjectsByLevel = new Map<string, typeof subjects>();
    for (const subject of subjects) {
      const list = subjectsByLevel.get(subject.schoolLevelId) ?? [];
      list.push(subject);
      subjectsByLevel.set(subject.schoolLevelId, list);
    }

    let created = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const cls of relevantClasses) {
        const clsSchoolLevelId = (cls as any).schoolLevelId as string | null;
        const classSubjects = clsSchoolLevelId
          ? subjectsByLevel.get(clsSchoolLevelId) ?? []
          : subjects;

        for (const subject of classSubjects) {
          // ClassSubject (unique : academicClassId + subjectId + academicYearId)
          let classSubject = await tx.classSubject.findFirst({
            where: {
              tenantId,
              academicClassId: cls.id,
              subjectId: subject.id,
              academicYearId,
            },
          });
          if (!classSubject) {
            classSubject = await tx.classSubject.create({
              data: {
                tenantId,
                academicClassId: cls.id,
                subjectId: subject.id,
                academicYearId,
                weeklyHours: subject.weeklyHours ?? 0,
                coefficient: Number(subject.coefficient ?? 1),
              },
            });
            created++;
          }

          // TeacherClassAssignment (unique : teacher + classSubject + year)
          const existing = await tx.teacherClassAssignment.findFirst({
            where: {
              tenantId,
              teacherId: teacher.id,
              classSubjectId: classSubject.id,
              academicYearId,
            },
          });
          if (!existing) {
            await tx.teacherClassAssignment.create({
              data: {
                tenantId,
                teacherId: teacher.id,
                classSubjectId: classSubject.id,
                academicYearId,
              },
            });
            created++;
          }
        }
      }

      // TeacherAcademicProfile (workspace sélecteur de classes / EDT)
      const existingProfile = await tx.teacherAcademicProfile.findFirst({
        where: { tenantId, academicYearId, teacherId: teacher.id },
      });
      if (!existingProfile) {
        await tx.teacherAcademicProfile.create({
          data: {
            tenantId,
            academicYearId,
            teacherId: teacher.id,
            maxWeeklyHours: 40,
            isActive: true,
          },
        });
      }
    });

    this.logger.log(
      `✅ Assignments synced for teacher-tenant ${tenantId}: ${created} row(s) created`,
    );
    return created;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PRIVÉ
  // ─────────────────────────────────────────────────────────────────────────

  /** Provisionne référentiel + classes + matières + affectations (idempotent). */
  private async materializeStructure(
    tenantId: string,
    academicYearId: string,
    levels: TeacherLevelCode[],
  ): Promise<void> {
    // 1. Référentiel officiel des classes (Education*) + sync school_levels.isActive
    try {
      await this.educationStructureService.initializeDefaultStructure(tenantId);
    } catch (e: any) {
      this.logger.warn(`⚠️ Education structure init: ${e.message}`);
    }

    // 2. Matérialisation AcademicLevel/Cycle/Class (sync paresseuse idempotente —
    //    déclenchée ici directement, sans passer par HTTP)
    try {
      await this.academicStructureService.findAllClasses(tenantId, academicYearId, {
        includeInactive: true,
      });
    } catch (e: any) {
      this.logger.warn(`⚠️ Academic classes sync: ${e.message}`);
    }

    // 3. Catalogue de matières par niveau
    try {
      await this.subjectsService.syncSubjectsFromSettings(tenantId, academicYearId);
    } catch (e: any) {
      this.logger.warn(`⚠️ Subjects seed: ${e.message}`);
    }

    // 4. Sections physiques (table classes) — indispensables au module
    //    Examens : Evaluation.classId pointe sur la section physique, et les
    //    élèves sont rattachés via ClassStudent. Une section par AcademicClass
    //    active des niveaux activés (CI → CM2, 6ème → Terminale, Mat 1-2).
    try {
      await this.academicStructureService.syncClassSectionsFromAcademicClasses(
        tenantId,
        academicYearId,
      );
    } catch (e: any) {
      this.logger.warn(`⚠️ Physical class sections sync: ${e.message}`);
    }

    // 5. Trimestres par défaut (T1/T2/T3) — pattern écoles (config Bénin)
    try {
      const existingPeriods = await this.prisma.academicPeriod.count({
        where: { tenantId, academicYearId },
      });
      if (existingPeriods === 0) {
        const year = await this.prisma.academicYear.findUnique({ where: { id: academicYearId } });
        if (year) {
          await this.academicPeriodSettingsService.createDefaultTrimestersForYear(
            tenantId,
            academicYearId,
            year.startDate,
            year.endDate,
            null,
          );
        }
      }
    } catch (e: any) {
      this.logger.warn(`⚠️ Default trimesters: ${e.message}`);
    }

    // 6. Types d'évaluation par défaut (Devoir / Interrogation / Composition)
    //    par niveau activé — le référentiel école vient de SchoolAcademicSettings
    //    (Paramètres > Examens) ; l'enseignant autonome reçoit un socle simple.
    try {
      await this.seedDefaultEvaluationTypes(tenantId);
    } catch (e: any) {
      this.logger.warn(`⚠️ Evaluation types seed: ${e.message}`);
    }

    // 7. Affectations enseignant (classes × matières des niveaux activés)
    try {
      await this.syncTeacherAssignments(tenantId, academicYearId);
    } catch (e: any) {
      this.logger.warn(`⚠️ Teacher assignments sync: ${e.message}`);
    }

    // Journal de traçabilité léger (pas de blocage si échec)
    this.logger.debug(
      `materializeStructure done for ${tenantId} (levels: ${levels.join(',')})`,
    );
  }

  /** Types d'évaluation par défaut, par niveau activé du tenant enseignant. */
  private async seedDefaultEvaluationTypes(tenantId: string): Promise<void> {
    const activeLevels = await this.prisma.schoolLevel.findMany({
      where: { tenantId, isActive: true },
    });

    const DEFAULT_TYPES = [
      { code: 'DEV', name: 'Devoir', defaultCoefficient: 1 },
      { code: 'INT', name: 'Interrogation', defaultCoefficient: 1 },
      { code: 'COMP', name: 'Composition', defaultCoefficient: 2 },
    ];

    for (const level of activeLevels) {
      for (const type of DEFAULT_TYPES) {
        const existing = await this.prisma.evaluationType.findFirst({
          where: { tenantId, code: type.code, schoolLevelId: level.id },
        });
        if (!existing) {
          await this.prisma.evaluationType.create({
            data: {
              tenantId,
              name: type.name,
              code: type.code,
              schoolLevelId: level.id,
              isSystem: false,
              defaultMaxScore: 20,
              defaultCoefficient: type.defaultCoefficient,
            },
          });
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  ÉLÈVES — gestion légère des élèves de l'enseignant autonome
  // ─────────────────────────────────────────────────────────────────────────

  /** Liste les élèves d'une classe (section physique). */
  async listStudents(tenantId: string, classId: string) {
    const classRoom = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
    });
    if (!classRoom) throw new NotFoundException('Classe introuvable');

    const enrollments = await this.prisma.classStudent.findMany({
      where: { tenantId, classId, status: 'ACTIVE' },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            gender: true,
            matricule: true,
            status: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      classId: classRoom.id,
      className: classRoom.name,
      students: enrollments
        .filter((e) => e.student?.isActive !== false)
        .map((e, index) => ({
          id: e.student.id,
          firstName: e.student.firstName,
          lastName: e.student.lastName,
          gender: e.student.gender,
          matricule: e.student.matricule,
          rank: index + 1,
        })),
    };
  }

  /** Ajoute un élève à une classe (Student + ClassStudent, transaction). */
  async addStudent(
    tenantId: string,
    classId: string,
    input: { firstName: string; lastName: string; gender?: string },
  ) {
    const classRoom = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
      include: { schoolLevel: true },
    });
    if (!classRoom) throw new NotFoundException('Classe introuvable');

    const academicYear =
      (await this.prisma.academicYear.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: 'desc' },
      })) ??
      (await this.prisma.academicYear.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      }));
    if (!academicYear) throw new BadRequestException('Aucune année scolaire trouvée');

    const yy = String(new Date().getFullYear()).slice(-2);
    const seq = (await this.prisma.student.count({ where: { tenantId } })) + 1;
    const matricule = `ELV-${yy}-${String(seq).padStart(4, '0')}`;

    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          tenantId,
          academicYearId: academicYear.id,
          currentAcademicYearId: academicYear.id,
          schoolLevelId: classRoom.schoolLevelId,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          gender: input.gender || null,
          matricule,
          status: 'ACTIVE',
          isActive: true,
        },
      });

      await tx.classStudent.create({
        data: {
          tenantId,
          academicYearId: academicYear.id,
          schoolLevelId: classRoom.schoolLevelId,
          classId,
          studentId: student.id,
          enrollmentDate: new Date(),
          status: 'ACTIVE',
        },
      });

      return { id: student.id, firstName: student.firstName, lastName: student.lastName, matricule };
    });
  }

  /** Retire un élève (désactivation + fin d'inscription classe). */
  async removeStudent(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({ where: { id: studentId, tenantId } });
    if (!student) throw new NotFoundException('Élève introuvable');

    await this.prisma.$transaction([
      this.prisma.student.update({
        where: { id: studentId },
        data: { isActive: false, status: 'INACTIVE' },
      }),
      this.prisma.classStudent.updateMany({
        where: { tenantId, studentId, status: 'ACTIVE' },
        data: { status: 'REMOVED', exitDate: new Date() },
      }),
    ]);

    return { success: true };
  }

  /** Types d'évaluation disponibles par niveau (pour le formulaire d'évaluation). */
  async listEvaluationTypes(tenantId: string) {
    const types = await this.prisma.evaluationType.findMany({
      where: { tenantId },
      include: { schoolLevel: { select: { id: true, code: true, name: true } } },
      orderBy: [{ schoolLevelId: 'asc' }, { code: 'asc' }],
    });

    const periods =
      (await this.prisma.academicPeriod.findMany({
        where: { tenantId, isActive: true },
        orderBy: { periodOrder: 'asc' },
      })) ||
      [];

    const allPeriods = periods.length
      ? periods
      : await this.prisma.academicPeriod.findMany({
          where: { tenantId },
          orderBy: { periodOrder: 'asc' },
        });

    return {
      evaluationTypes: types.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        defaultMaxScore: t.defaultMaxScore,
        defaultCoefficient: t.defaultCoefficient,
        schoolLevel: t.schoolLevel,
      })),
      periods: allPeriods.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        periodOrder: p.periodOrder,
        isActive: p.isActive,
      })),
    };
  }
}
