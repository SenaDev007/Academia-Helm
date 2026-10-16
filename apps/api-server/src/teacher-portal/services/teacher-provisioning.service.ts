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
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { SubdomainService } from '../../common/services/subdomain.service';
import { EducationStructureService } from '../../settings/services/education-structure.service';
import { AcademicPeriodSettingsService } from '../../settings/services/academic-period-settings.service';
import { AcademicStructurePrismaService } from '../../pedagogy/academic-structure-prisma.service';
import { SubjectsPrismaService } from '../../pedagogy/subjects-prisma.service';
import { TeacherLevelCode } from '../dto/teacher-portal.dto';
import { compareClassesCanonically, classOrderKeyFromPrisma } from '../../common/utils/benin-class-order';

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

    // ── Garde-fous — REALM ENSEIGNANT UNIQUEMENT (isolation 2026-10-16) ──
    // ⭐ Le même email peut être utilisé sur les portails Academia Helm
    //    (écoles / patronat) ET sur le portail enseignant : on ne bloque
    //    QUE s'il possède déjà un ESPACE ENSEIGNANT. Sinon, la ligne users
    //    existante est RÉUTILISÉE (rattachement UserTenant) sans toucher à
    //    ses identifiants plateforme (passwordHash / role / tenantId).
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userTenants: { include: { tenant: true } },
        teacherPortalCredential: true,
      },
    });
    if (existingUser) {
      const linkedTeacherTenant = existingUser.userTenants.find(
        (ut) => (ut.tenant as any)?.type === 'TEACHER',
      );
      let legacyDirectTenant = false;
      if (!linkedTeacherTenant && !existingUser.teacherPortalCredential && existingUser.tenantId) {
        const direct = await this.prisma.tenant.findUnique({
          where: { id: existingUser.tenantId },
        });
        legacyDirectTenant = (direct as any)?.type === 'TEACHER';
      }
      if (linkedTeacherTenant || existingUser.teacherPortalCredential || legacyDirectTenant) {
        throw new ConflictException(
          'Un compte enseignant existe déjà avec cet email. Connectez-vous depuis le portail enseignant.',
        );
      }
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

      // 9. User — créée OU réutilisée selon le realm (isolation 2026-10-16)
      //    ⭐ Un email déjà utilisé côté Academia Helm (écoles/patronat)
      //    réutilise SA ligne users — mot de passe plateforme, rôle et
      //    tenant courant INCHANGÉS. Les identifiants du portail enseignant
      //    vivent dans TeacherPortalCredential (mots de passe distincts).
      let user;
      if (existingUser) {
        user = await tx.user.findUnique({ where: { id: existingUser.id } });
        if (!user) throw new BadRequestException('Utilisateur introuvable');
      } else {
        user = await tx.user.create({
          data: {
            email,
            // ⭐ null : les identifiants enseignant sont ISOLÉS dans
            //    TeacherPortalCredential — users.passwordHash reste le realm
            //    Academia Helm (écoles/patronat).
            passwordHash: null,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            role: 'ENSEIGNANT',
            tenantId: tenant.id,
            status: 'active',
          },
        });
      }

      // 9b. Identifiants du REALM ENSEIGNANT (hash du draft — paiement d'abord)
      await tx.teacherPortalCredential.upsert({
        where: { userId: user.id },
        create: { userId: user.id, email, passwordHash },
        update: { email, passwordHash },
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
    // ⭐ FIX 2026-10-16 (deux bugs de production sur le tenant ef67062e) :
    //    1. `(c as any).schoolLevelId` était TOUJOURS undefined (AcademicClass
    //       n'a pas ce champ) → chaque classe recevait TOUTES les matières de
    //       TOUS les niveaux actifs. On résout désormais le niveau scolaire de
    //       chaque classe via son niveau pédagogique (AcademicLevel.name).
    //    2. La transaction interactive Prisma ($transaction(async …)) avec
    //       ~400 creates séquentiels dépassait le TIMEOUT PAR DÉFAUT de 5 s
    //       → rollback silencieux → 0 ClassSubject / 0 TeacherClassAssignment
    //       (« Mes élèves » vide). On utilise createMany + skipDuplicates
    //       (quelques requêtes atomiques et idempotentes, pas de timeout).
    const teachers = await this.prisma.teacher.findMany({ where: { tenantId } });
    if (teachers.length === 0) return 0;
    const teacher = teachers[0];

    const activeSchoolLevels = await this.prisma.schoolLevel.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, code: true },
    });
    const levelIds = activeSchoolLevels.map((l) => l.id);
    if (levelIds.length === 0) return 0;

    // Classes pédagogiques actives (avec leur niveau pédagogique pour résoudre
    // le niveau scolaire — AcademicClass n'a PAS de schoolLevelId direct).
    const classes = await this.prisma.academicClass.findMany({
      where: {
        tenantId,
        academicYearId,
        isActive: true,
      },
      include: { level: true },
    });

    // Résolution classe → niveau scolaire via le nom du niveau pédagogique
    // (« Maternelle » / « Primaire » / « Secondaire »).
    const codeByLevelName = (name: string): string | null => {
      const n = (name || '').toUpperCase();
      if (n.includes('MATERN')) return 'MATERNELLE';
      if (n.includes('PRIMA')) return 'PRIMAIRE';
      if (n.includes('SECOND')) return 'SECONDAIRE';
      return null;
    };
    const activeLevelIdByCode = new Map(activeSchoolLevels.map((l) => [l.code, l.id]));
    const classSchoolLevelId = new Map<string, string>();
    const relevantClasses = classes.filter((c) => {
      const code = codeByLevelName(c.level?.name || '');
      const schoolLevelId = code ? activeLevelIdByCode.get(code) : undefined;
      if (schoolLevelId) {
        classSchoolLevelId.set(c.id, schoolLevelId);
        return true;
      }
      this.logger.warn(
        `syncTeacherAssignments: classe « ${c.name} » sans niveau scolaire résolvable (niveau pédagogique « ${c.level?.name} ») — ignorée`,
      );
      return false;
    });
    if (relevantClasses.length === 0) return 0;

    // Matières des niveaux activés pour l'année
    const subjects = await this.prisma.subject.findMany({
      where: { tenantId, academicYearId, schoolLevelId: { in: levelIds } },
      select: { id: true, schoolLevelId: true, weeklyHours: true, coefficient: true },
    });
    if (subjects.length === 0) return 0;

    const subjectsByLevel = new Map<string, typeof subjects>();
    for (const subject of subjects) {
      if (!subject.schoolLevelId) continue;
      const list = subjectsByLevel.get(subject.schoolLevelId) ?? [];
      list.push(subject);
      subjectsByLevel.set(subject.schoolLevelId, list);
    }

    // ── 1. ClassSubject (classe × matière du niveau) — createMany idempotent ──
    const classSubjectRows = relevantClasses.flatMap((cls) => {
      const levelId = classSchoolLevelId.get(cls.id)!;
      const levelSubjects = subjectsByLevel.get(levelId) ?? [];
      return levelSubjects.map((s) => ({
        tenantId,
        academicClassId: cls.id,
        subjectId: s.id,
        academicYearId,
        weeklyHours: s.weeklyHours ?? 0,
        coefficient: Number(s.coefficient ?? 1),
      }));
    });
    if (classSubjectRows.length === 0) return 0;
    await this.prisma.classSubject.createMany({
      data: classSubjectRows,
      skipDuplicates: true,
    });

    // ── 2. TeacherClassAssignment (enseignant × chaque ClassSubject) ──
    const classSubjects = await this.prisma.classSubject.findMany({
      where: { tenantId, academicYearId, academicClassId: { in: relevantClasses.map((c) => c.id) } },
      select: { id: true },
    });
    if (classSubjects.length === 0) return 0;
    await this.prisma.teacherClassAssignment.createMany({
      data: classSubjects.map((cs) => ({
        tenantId,
        teacherId: teacher.id,
        classSubjectId: cs.id,
        academicYearId,
      })),
      skipDuplicates: true,
    });

    // ── 3. TeacherAcademicProfile (workspace sélecteur de classes / EDT) ──
    await this.prisma.teacherAcademicProfile.upsert({
      where: {
        tenantId_academicYearId_teacherId: { tenantId, academicYearId, teacherId: teacher.id },
      },
      create: {
        tenantId,
        academicYearId,
        teacherId: teacher.id,
        maxWeeklyHours: 40,
        isActive: true,
      },
      update: { isActive: true },
    });

    const created = classSubjectRows.length + classSubjects.length;
    this.logger.log(
      `✅ Assignments synced for teacher-tenant ${tenantId}: ${classSubjects.length} class-subject couvert(s)`,
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
      // ⭐ Les trimestres sont créés INACTIFS (pattern école : un admin les
      //    active). L'enseignant autonome n'a pas d'admin — on active la
      //    période qui contient la date du jour pour que les modules
      //    (évaluations, travaux…) aient une période courante utilisable.
      await this.prisma.academicPeriod.updateMany({
        where: {
          tenantId,
          academicYearId,
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
        data: { isActive: true },
      });
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
      // ⭐ logger.error (et plus seulement warn) : cette étape a échoué
      //    SILENCIEUSEMENT en production (timeout transaction) et « Mes élèves »
      //    restait vide sans aucune trace exploitable dans les logs Railway.
      this.logger.error(
        `⚠️ Teacher assignments sync FAILED for ${tenantId}: ${e?.message}`,
        e instanceof Error ? e.stack : undefined,
      );
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

  // ─────────────────────────────────────────────────────────────────────────
  //  IMPORT EXCEL D'ÉLÈVES — template multi-feuilles + preview + run
  //  (pattern éprouvé du module Élèves des écoles, adapté au tenant
  //   enseignant autonome : une feuille par classe, 4 colonnes simples)
  // ─────────────────────────────────────────────────────────────────────────

  /** En-têtes du template enseignant (4 colonnes volontairement simples). */
  private static readonly IMPORT_HEADERS = ['Prénom', 'Nom', 'Sexe', 'Date de naissance'];

  /**
   * GET /teacher-portal/students/import/template
   * Génère le template Excel : UNE FEUILLE PAR CLASSE de l'espace enseignant
   * (ordre canonique béninois : Mat 1 → Mat 2 → CI → CP → CE1 → CE2 → CM1 →
   * CM2). L'enseignant remplit chaque feuille puis réimporte le fichier.
   */
  async downloadStudentsImportTemplate(tenantId: string, res: Response): Promise<void> {
    const { academicYear, classes } = await this.resolveTeacherClasses(tenantId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm — Helm Enseignant';
    workbook.created = new Date();

    if (classes.length === 0) {
      const ws = workbook.addWorksheet('Élèves');
      this.applyImportSheetLayout(ws);
      this.addImportInstructions(ws, academicYear?.name || '');
    } else {
      const usedSheetNames = new Set<string>();
      for (const cls of classes) {
        let sheetName = this.sanitizeSheetName(cls.name || cls.code || 'Classe');
        if (usedSheetNames.has(sheetName)) {
          let suffix = 2;
          let candidate = sheetName;
          while (usedSheetNames.has(candidate)) {
            candidate = `${sheetName.substring(0, 28)}-${suffix}`;
            suffix++;
          }
          sheetName = candidate;
        }
        usedSheetNames.add(sheetName);
        const ws = workbook.addWorksheet(sheetName);
        this.applyImportSheetLayout(ws);
        this.addImportInstructions(ws, academicYear?.name || '');
      }
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="template-import-eleves-enseignant.xlsx"',
    );
    await workbook.xlsx.write(res);
    res.end();
  }

  /**
   * POST /teacher-portal/students/import/preview
   * Valide le fichier Excel SANS créer d'élèves. Body : { fileDataUrl }.
   */
  async previewStudentsImport(tenantId: string, fileDataUrl: string) {
    const parsed = await this.parseStudentsWorkbook(tenantId, fileDataUrl);
    const validRows = parsed.rows.filter((r) => r.isValid && !r.isExisting).length;
    const invalidRows = parsed.rows.filter((r) => !r.isValid).length;
    const skippedExisting = parsed.rows.filter((r) => r.isValid && r.isExisting).length;

    const byClass: Record<string, number> = {};
    for (const r of parsed.rows) {
      if (r.isValid && !r.isExisting) {
        byClass[r.className] = (byClass[r.className] || 0) + 1;
      }
    }

    return {
      totalRows: parsed.rows.length,
      validRows,
      invalidRows,
      skippedExisting,
      sheetsProcessed: parsed.sheetsProcessed,
      unknownSheets: parsed.unknownSheets,
      summary: { byClass },
      rows: parsed.rows,
    };
  }

  /**
   * POST /teacher-portal/students/import/run
   * Importe réellement les élèves valides (Student + ClassStudent, même
   * logique que addStudent). Les lignes invalides sont ignorées avec leur
   * erreur ; les doublons déjà présents dans la classe sont sautés.
   */
  async runStudentsImport(tenantId: string, fileDataUrl: string) {
    const parsed = await this.parseStudentsWorkbook(tenantId, fileDataUrl);
    const { academicYear, classes } = await this.resolveTeacherClasses(tenantId);
    const classBySheet = this.mapClassesBySheetName(classes);

    // ⭐ Séquence de matricule robuste : max des ELV-<yy>-#### existants + 1
    //    (le simple count+1 de addStudent collide après des suppressions).
    const yy = String(new Date().getFullYear()).slice(-2);
    const prefix = `ELV-${yy}-`;
    const existingMatricules = await this.prisma.student.findMany({
      where: { tenantId, matricule: { startsWith: prefix } },
      select: { matricule: true },
    });
    let seq = existingMatricules.reduce((max, s) => {
      const n = parseInt((s.matricule || '').slice(prefix.length), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);

    const results: Array<{
      sheetName: string;
      rowIndex: number;
      studentName: string;
      status: 'created' | 'skipped' | 'error';
      error?: string;
      studentId?: string;
      matricule?: string;
    }> = [];

    for (const row of parsed.rows) {
      const classRoom = classBySheet.get(row.sheetName.toLowerCase());
      if (!row.isValid || !classRoom) {
        results.push({
          sheetName: row.sheetName,
          rowIndex: row.rowIndex,
          studentName: `${row.firstName} ${row.lastName}`.trim() || '(ligne vide)',
          status: 'error',
          error: row.errors[0] || 'Classe inconnue',
        });
        continue;
      }
      if (row.isExisting) {
        results.push({
          sheetName: row.sheetName,
          rowIndex: row.rowIndex,
          studentName: `${row.firstName} ${row.lastName}`,
          status: 'skipped',
          error: 'Déjà présent dans cette classe',
        });
        continue;
      }

      seq += 1;
      const matricule = `${prefix}${String(seq).padStart(4, '0')}`;
      try {
        const student = await this.prisma.$transaction(async (tx) => {
          const created = await tx.student.create({
            data: {
              tenantId,
              academicYearId: academicYear.id,
              currentAcademicYearId: academicYear.id,
              schoolLevelId: classRoom.schoolLevelId,
              firstName: row.firstName,
              lastName: row.lastName,
              gender: row.gender || null,
              dateOfBirth: row.dateOfBirth,
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
              classId: classRoom.id,
              studentId: created.id,
              enrollmentDate: new Date(),
              status: 'ACTIVE',
            },
          });
          return created;
        });
        results.push({
          sheetName: row.sheetName,
          rowIndex: row.rowIndex,
          studentName: `${row.firstName} ${row.lastName}`,
          status: 'created',
          studentId: student.id,
          matricule,
        });
      } catch (e: any) {
        seq -= 1; // la séquence échouée sera réutilisée par la ligne suivante
        results.push({
          sheetName: row.sheetName,
          rowIndex: row.rowIndex,
          studentName: `${row.firstName} ${row.lastName}`,
          status: 'error',
          error: e?.message || 'Erreur inconnue',
        });
      }
    }

    return {
      totalRows: parsed.rows.length,
      succeeded: results.filter((r) => r.status === 'created').length,
      failed: results.filter((r) => r.status === 'error').length,
      skippedExisting: results.filter((r) => r.status === 'skipped').length,
      results,
    };
  }

  // ── Import : helpers privés ─────────────────────────────────────────────

  /** Année active + classes physiques de l'espace (ordre canonique). */
  private async resolveTeacherClasses(tenantId: string) {
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

    const classes = await this.prisma.class.findMany({
      where: { tenantId, academicYearId: academicYear.id },
      include: { schoolLevel: { select: { id: true, code: true, name: true } } },
    });
    // ⭐ Ordre officiel béninois des feuilles du template (Mat 1 → … → CM2).
    classes.sort((a, b) =>
      compareClassesCanonically(classOrderKeyFromPrisma(a), classOrderKeyFromPrisma(b)),
    );
    return { academicYear, classes };
  }

  /** Map nom de feuille (minuscules) → classe physique. */
  private mapClassesBySheetName(
    classes: Array<{ id: string; name: string; code: string; schoolLevelId: string }>,
  ): Map<string, { id: string; name: string; code: string; schoolLevelId: string }> {
    const map = new Map<string, any>();
    for (const cls of classes) {
      const byName = (cls.name || '').toLowerCase().trim();
      const byCode = (cls.code || '').toLowerCase().trim();
      if (byName && !map.has(byName)) map.set(byName, cls);
      if (byCode && !map.has(byCode)) map.set(byCode, cls);
    }
    return map;
  }

  /** Mise en page d'une feuille du template enseignant. */
  private applyImportSheetLayout(worksheet: ExcelJS.Worksheet): void {
    worksheet.columns = TeacherProvisioningService.IMPORT_HEADERS.map((header) => ({
      header,
      key: header,
      width: header === 'Date de naissance' ? 20 : 26,
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1F6E' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 30;

    // Ligne d'exemple (à supprimer avant import)
    const example = worksheet.addRow(['Awa', 'DOSSOU', 'F', '15/03/2019']);
    example.font = { italic: true, color: { argb: 'FF6B7280' }, size: 10 };

    // Bordures des deux premières lignes
    for (const rowNum of [1, 2]) {
      const row = worksheet.getRow(rowNum);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      });
    }
  }

  /** Lignes d'instructions sous l'exemple. */
  private addImportInstructions(worksheet: ExcelJS.Worksheet, yearName: string): void {
    const startRow = worksheet.rowCount + 1;
    worksheet.addRow([]);
    worksheet.addRow(['⚠️ Supprimez la ligne d’exemple avant l’import. Une ligne = un élève.']);
    worksheet.addRow(['👤 Sexe : M (Garçon) ou F (Fille) — champ optionnel.']);
    worksheet.addRow(['📅 Date de naissance au format JJ/MM/AAAA (ex : 15/03/2019) — champ optionnel.']);
    worksheet.addRow(['📋 Chaque feuille correspond à une classe de votre espace — ne renommez pas les feuilles.']);
    if (yearName) {
      worksheet.addRow([`🏫 Année scolaire : ${yearName}.`]);
    }
    for (let i = startRow + 1; i <= worksheet.rowCount; i++) {
      worksheet.getRow(i).font = { italic: true, color: { argb: 'FF92400E' }, size: 10 };
    }
  }

  /** Nettoie un nom de feuille Excel (max 31 chars, pas de \\ / ? * [ ] :). */
  private sanitizeSheetName(name: string): string {
    let clean = name.replace(/[\\/?*\[\]:]/g, '-').trim();
    if (clean.length > 31) clean = clean.substring(0, 31);
    return clean || 'Feuille';
  }

  /**
   * Parse + valide le classeur complet : une feuille = une classe.
   * Détecte aussi les élèves DÉJÀ présents (anti double-import).
   */
  private async parseStudentsWorkbook(tenantId: string, fileDataUrl: string) {
    if (!fileDataUrl || typeof fileDataUrl !== 'string') {
      throw new BadRequestException('fileDataUrl est requis (base64 data URL du fichier Excel)');
    }

    // Extraction base64 (data URL ou base64 brut) — pattern StudentsImportService
    let buffer: Buffer;
    const match = fileDataUrl.match(/^data:[^;]+;base64,(.+)$/);
    try {
      buffer = Buffer.from(match ? match[1] : fileDataUrl, 'base64');
    } catch {
      throw new BadRequestException('Fichier illisible : base64 invalide');
    }
    let workbook: ExcelJS.Workbook;
    try {
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
    } catch {
      throw new BadRequestException(
        'Fichier Excel invalide (.xlsx attendu — les .xls anciens formats ne sont pas supportés)',
      );
    }

    const { academicYear, classes } = await this.resolveTeacherClasses(tenantId);
    const classBySheet = this.mapClassesBySheetName(classes);

    // Élèves déjà actifs par classe (clé : prénom+nom normalisés)
    const existingByClass = new Map<string, Set<string>>();
    for (const cls of classes) {
      const enrollments = await this.prisma.classStudent.findMany({
        where: { tenantId, classId: cls.id, status: 'ACTIVE' },
        select: { student: { select: { firstName: true, lastName: true, isActive: true } } },
      });
      existingByClass.set(
        cls.id,
        new Set(
          enrollments
            .filter((e) => e.student?.isActive !== false)
            .map((e) =>
              `${(e.student?.firstName || '').trim().toLowerCase()}|${(e.student?.lastName || '').trim().toLowerCase()}`,
            ),
        ),
      );
    }

    const rows: Array<{
      sheetName: string;
      rowIndex: number;
      firstName: string;
      lastName: string;
      gender: string | null;
      dateOfBirth: Date | null;
      className: string;
      errors: string[];
      isValid: boolean;
      isExisting: boolean;
    }> = [];
    const sheetsProcessed: string[] = [];
    const unknownSheets: string[] = [];

    workbook.eachSheet((worksheet) => {
      const sheetName = worksheet.name;
      if (sheetName.startsWith('_') || /instruction/i.test(sheetName)) return;

      const classRoom = classBySheet.get(sheetName.toLowerCase().trim());
      if (!classRoom) {
        unknownSheets.push(sheetName);
        return;
      }
      sheetsProcessed.push(sheetName);
      const existingNames = existingByClass.get(classRoom.id) || new Set<string>();

      let isFirstRow = true;
      worksheet.eachRow((row, rowNumber) => {
        if (isFirstRow) {
          isFirstRow = false;
          return; // ligne 1 = en-têtes
        }
        const getCell = (col: number): string => {
          const val = row.getCell(col).value;
          if (val === null || val === undefined) return '';
          if (typeof val === 'string') return val.trim();
          if (typeof val === 'number') return String(val);
          if (val instanceof Date) return val.toISOString().slice(0, 10);
          if (typeof val === 'object' && 'text' in val) return String((val as any).text || '').trim();
          if (typeof val === 'object' && 'result' in val) return String((val as any).result || '').trim();
          return String(val).trim();
        };

        const firstName = getCell(1);
        const lastName = getCell(2);
        const genderRaw = getCell(3).toUpperCase();
        const dobRaw = getCell(4);

        // Skip lignes vides / instructions
        if (!firstName && !lastName) return;
        if (/^[⚠️📅👤🏫📋💡]/.test((firstName || '').trim())) return;

        const errors: string[] = [];
        if (firstName.length < 2) errors.push('Prénom requis (2 caractères minimum)');
        if (lastName.length < 2) errors.push('Nom requis (2 caractères minimum)');
        if (genderRaw && !['M', 'F', 'MASCULIN', 'FEMININ', 'GARCON', 'FILLE'].includes(genderRaw)) {
          errors.push('Sexe invalide (M ou F attendu)');
        }
        const gender = genderRaw.startsWith('F') || genderRaw === 'FEMININ' || genderRaw === 'FILLE'
          ? 'F'
          : genderRaw.startsWith('M') || genderRaw === 'MASCULIN' || genderRaw === 'GARCON'
            ? 'M'
            : null;

        // Date de naissance (JJ/MM/AAAA, AAAA-MM-JJ, ou Date Excel)
        let dateOfBirth: Date | null = null;
        const dobCell = row.getCell(4).value;
        if (dobCell instanceof Date) {
          dateOfBirth = dobCell;
        } else if (dobRaw) {
          const parts = dobRaw.split(/[\/\-.]/);
          if (parts.length === 3) {
            let d = Number(parts[0]);
            let m = Number(parts[1]);
            let y = Number(parts[2]);
            if (parts[0].length === 4) [y, m, d] = [d, m, y]; // ISO AAAA-MM-JJ
            if (y < 100) y += y > 30 ? 1900 : 2000;
            if (Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(y) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
              dateOfBirth = new Date(Date.UTC(y, m - 1, d, 12));
            }
          }
          if (!dateOfBirth) errors.push('Date de naissance illisible (format attendu JJ/MM/AAAA)');
        }

        const isExisting =
          !errors.length &&
          existingNames.has(`${firstName.toLowerCase()}|${lastName.toLowerCase()}`);

        rows.push({
          sheetName,
          rowIndex: rowNumber,
          firstName,
          lastName,
          gender,
          dateOfBirth,
          className: classRoom.name,
          errors,
          isValid: errors.length === 0,
          isExisting,
        });
      });
    });

    return { academicYear, classes, rows, sheetsProcessed, unknownSheets };
  }

  /** Types d'évaluation disponibles par niveau (pour le formulaire d'évaluation). */
  async listEvaluationTypes(tenantId: string) {
    // ⭐ FIX 2026-10-16 : `include: { schoolLevel: … }` était INVALIDE — le
    //    modèle EvaluationType n'a PAS de relation schoolLevel (seul le scalaire
    //    schoolLevelId existe) → PrismaClientValidationError → 400 « Données
    //    invalides : Champ "schoolLevel" » au premier chargement du module
    //    Évaluations & bulletins. Jointure en mémoire sur school_levels.
    const [types, schoolLevels] = await Promise.all([
      this.prisma.evaluationType.findMany({
        where: { tenantId },
        orderBy: [{ schoolLevelId: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.schoolLevel.findMany({
        where: { tenantId },
        select: { id: true, code: true, name: true, label: true },
      }),
    ]);
    const levelById = new Map(schoolLevels.map((l) => [l.id, l]));

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
        schoolLevel: t.schoolLevelId
          ? (() => {
              const l = levelById.get(t.schoolLevelId);
              return l
                ? { id: l.id, code: l.code, name: l.name ?? l.label }
                : null;
            })()
          : null,
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
