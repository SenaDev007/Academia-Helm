/**
 * FederisSchoolExamsService — Examens nationaux côté établissement (CEP / BEPC / Bac)
 * ═══════════════════════════════════════════════════════════════════════════
 * Academia Helm ↔ Academia Federis (2026-09-27).
 *
 * Le patronat regroupe les écoles privées d'un département et organise les
 * examens inter-écoles. Trois examens nationaux sanctionnent la fin de cycle :
 *
 *   CEP  — Certificat d'Études Primaires    → élèves de CM2
 *   BEPC — Brevet d'Études du Premier Cycle → élèves de 3ème
 *   BAC  — Baccalauréat (séries A1, C, D…)  → élèves de Terminale
 *
 * Depuis le module Examen de l'école (onglet « Examens nationaux ») :
 *
 *   GET  /federis/school/national-exams
 *        Éligibilité dynamique : selon les niveaux activés (structure) et les
 *        classes réellement existantes (CM2 / 3ème / Terminale), seuls les
 *        sous-onglets correspondants s'affichent.
 *   GET  /federis/school/national-exams/:examType/candidates
 *        Liste des élèves éligibles pour l'année courante — CM2 (CEP),
 *        3ème (BEPC), Terminale catégorisés PAR SÉRIE (Bac).
 *   POST /federis/school/national-exams/:examType/selection
 *        Sélection officielle (cases à cocher) — l'école écarte les élèves
 *        en carence qu'elle ne s'engage pas à présenter.
 *   POST /federis/school/national-exams/:examType/submit
 *        Envoi TEMPS RÉEL de la liste au(x) patronat(s) rattaché(s) :
 *        création/mise à jour des ExamCandidate côté Federis + notification
 *        de l'équipe du patronat + double audit école/patronat.
 *
 * Règles transverses :
 *   - NO ACADEMIC YEAR = NO DATA ; jamais de suppression physique
 *     (retrait d'un candidat → status WITHDRAWN, pas de delete).
 *   - Lecture : tout membre de l'établissement ; sélection/envoi : direction
 *     et secrétariat (pattern federis-school.service).
 *   - L'envoi cible uniquement les patronats JOINED disposant d'une campagne
 *     d'examen active correspondante (niveau CM2 / 3EME / TERMINALE).
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { FEDERIS_PLANS, type FederisPlanCode } from './federis-patronat.service';

// ── DTO ─────────────────────────────────────────────────────────────────────

export class SaveSelectionDto {
  /** Identifiants des élèves officiellement présentés (Student.id). */
  studentIds!: string[];
}

export class SubmitSelectionDto {
  /** Optionnel : remplace la sélection enregistrée si fournie. */
  studentIds?: string[];
}

// ── Définitions des examens nationaux ───────────────────────────────────────

export type NationalExamType = 'CEP' | 'BEPC' | 'BAC';

interface ExamTypeDef {
  type: NationalExamType;
  label: string;
  fullLabel: string;
  /** Niveau fédéré correspondant (NationalExam.level côté patronat). */
  federisLevel: string;
  order: number;
  /** Description de la classe éligible (pour l'UI). */
  eligibleClass: string;
  /** Le Bac est catégorisé par séries (A1, C, D…). */
  hasSeries: boolean;
}

const EXAM_DEFS: Record<NationalExamType, ExamTypeDef> = {
  CEP: {
    type: 'CEP',
    label: 'CEP',
    fullLabel: 'Certificat d\u2019Études Primaires',
    federisLevel: 'CM2',
    order: 1,
    eligibleClass: 'Élèves de CM2 (fin du cycle primaire)',
    hasSeries: false,
  },
  BEPC: {
    type: 'BEPC',
    label: 'BEPC',
    fullLabel: 'Brevet d\u2019Études du Premier Cycle',
    federisLevel: '3EME',
    order: 2,
    eligibleClass: 'Élèves de 3ème (fin du premier cycle du secondaire)',
    hasSeries: false,
  },
  BAC: {
    type: 'BAC',
    label: 'Baccalauréat',
    fullLabel: 'Baccalauréat — séries A1, C, D…',
    federisLevel: 'TERMINALE',
    order: 3,
    eligibleClass: 'Élèves de Terminale, par série (fin du second cycle)',
    hasSeries: true,
  },
};

/** Statuts d'examen fédéré qui n'acceptent plus de candidats. */
const EXAM_BLOCKED_STATUSES = ['COMPLETED', 'CANCELLED', 'ARCHIVED', 'RESULTS_PUBLISHED'];

/** Rôles de direction autorisés à sélectionner/envoyer les listes (pattern Helm). */
const SCHOOL_DIRECTION_ROLES = [
  'PROMOTEUR',
  'PROMOTER',
  'SCHOOL_OWNER',
  'DIRECTEUR',
  'DIRECTOR',
  'DIRECTRICE',
  'DIRECTEUR_GENERAL',
  'DIRECTEUR_ETABLISSEMENT',
  'DIRECTEUR_ADJOINT',
  'PROVISEUR',
  'ADMIN',
  'SECRETAIRE',
  'SECRETARY',
  'SECRETAIRE_COMPTABLE',
  'SUPER_ADMIN',
];

const SCHOOL_DIRECTION_ROLE_PREFIX =
  /^(PROMOTEUR|DIRECTEUR|DIRECTRICE|SECRETAIRE|SECRETAIRE_COMPTABLE)_(MAT|PRI|SEC|MAT_PRI)/;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Normalisation insensible à la casse/accents. */
function normalizeUpper(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Une classe physique (ou officielle) correspond-elle au type d'examen ?
 *   CEP  : « CM2 A », « CM2 »…
 *   BEPC : « 3ème 1 », « 3E A », « 3A »…
 *   BAC  : « Terminale C », « Tle D », « Term A1 »…
 */
function classMatchesExam(className: string | null | undefined, type: NationalExamType): boolean {
  const n = normalizeUpper(className);
  if (!n) return false;
  if (type === 'CEP') return n.startsWith('CM2');
  if (type === 'BEPC') return /^3($|[^0-9])/.test(n);
  // BAC
  return n.startsWith('TERM') || n.startsWith('TLE') || n.startsWith('BAC');
}

/** Extrait la série d'un nom de classe de Terminale (« Terminale C » → « C »). */
function seriesFromClassName(className: string | null | undefined): string | null {
  const n = normalizeUpper(className);
  if (!n) return null;
  const match = n.match(/(?:TERM(?:INALE)?|TLE|BAC)\s*(?:SERIE\s*)?([A-Z]\d?|[A-Z]{2})\s*$/);
  return match?.[1] ?? null;
}

/** Niveau fédéré (NationalExam.level) ↔ type d'examen national. */
function federisLevelMatchesType(level: string | null | undefined, type: NationalExamType): boolean {
  const n = normalizeUpper(level);
  if (!n) return false;
  if (type === 'CEP') return n.startsWith('CM2');
  if (type === 'BEPC') return /^3/.test(n);
  return n.startsWith('TERM') || n.startsWith('TLE');
}

@Injectable()
export class FederisSchoolExamsService {
  private readonly logger = new Logger(FederisSchoolExamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  // ── Contexte école ────────────────────────────────────────────────────────

  /**
   * Contexte école : tenant SCHOOL actif + appartenance de l'utilisateur.
   * `requireDirection` réserve la sélection/l'envoi à la direction et au
   * secrétariat (décision officielle de l'établissement).
   */
  private async resolveSchoolContext(
    tenantId: string,
    userId: string,
    role?: string,
    requireDirection = false,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, type: true, status: true },
    });
    if (!tenant || tenant.status !== 'active') {
      throw new ForbiddenException('Tenant introuvable ou inactif.');
    }
    if (tenant.type !== 'SCHOOL') {
      throw new ForbiddenException(
        'Les examens nationaux sont réservés aux établissements Academia Helm.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, role: true, isSuperAdmin: true, status: true },
    });
    if (!user || user.status !== 'active') {
      throw new ForbiddenException('Compte introuvable ou inactif.');
    }

    let belongs = user.tenantId === tenantId || user.isSuperAdmin;
    if (!belongs) {
      const link = await this.prisma.userTenant.findFirst({
        where: { userId, tenantId },
        select: { id: true },
      });
      belongs = !!link;
    }
    if (!belongs) {
      throw new ForbiddenException("Vous n'appartenez pas à cet établissement.");
    }

    if (requireDirection) {
      const effectiveRole = role ?? user.role ?? '';
      if (
        !user.isSuperAdmin &&
        !SCHOOL_DIRECTION_ROLES.includes(effectiveRole) &&
        !SCHOOL_DIRECTION_ROLE_PREFIX.test(effectiveRole)
      ) {
        throw new ForbiddenException(
          "La sélection et l'envoi des candidats aux examens nationaux sont réservés à la direction et au secrétariat de l'établissement.",
        );
      }
    }

    return { tenant, user };
  }

  private async getActiveYear(tenantId: string) {
    return this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
  }

  private assertExamType(examType: string): NationalExamType {
    const t = (examType ?? '').toUpperCase() as NationalExamType;
    if (!(t in EXAM_DEFS)) {
      throw new BadRequestException(
        `Type d'examen inconnu : ${examType} (valeurs attendues : CEP, BEPC, BAC).`,
      );
    }
    return t;
  }

  /**
   * Classes éligibles au type d'examen pour l'année courante :
 * rapprochement par nom de classe physique OU de classe officielle
 * (AcademicClass via officialClassId), avec série éventuelle.
   */
  private async getEligibleClasses(tenantId: string, academicYearId: string, type: NationalExamType) {
    const classes = await this.prisma.class.findMany({
      where: { tenantId, academicYearId },
      include: {
        officialClass: { select: { id: true, name: true, series: { select: { name: true } } } },
      },
      orderBy: { name: 'asc' },
    });

    return classes.filter(
      (c) =>
        classMatchesExam(c.name, type) || classMatchesExam(c.officialClass?.name, type),
    );
  }

  /** Patronats rattachés (JOINED) avec, pour chacun, la campagne fédérée correspondante. */
  private async getJoinedPatronatsWithExam(
    schoolTenantId: string,
    type: NationalExamType,
  ) {
    const links = await this.prisma.patronatSchool.findMany({
      where: { schoolTenantId, status: 'JOINED' },
      include: {
        patronat: { select: { id: true, name: true, tenantId: true, territoryName: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const result: {
      linkId: string;
      patronatId: string | null;
      patronatTenantId: string;
      patronatName: string;
      exam: {
        id: string;
        code: string;
        name: string;
        level: string;
        status: string;
      } | null;
      reason: string | null;
    }[] = [];

    for (const link of links) {
      const patronatTenantId = link.tenantId;
      const patronatName =
        link.patronat?.name ?? 'Patronat';
      let exam: typeof result[number]['exam'] = null;
      let reason: string | null = null;

      const year = await this.getActiveYear(patronatTenantId);
      if (!year) {
        reason = 'Aucune année scolaire active côté patronat.';
      } else {
        const exams = await this.prisma.nationalExam.findMany({
          where: {
            tenantId: patronatTenantId,
            academicYearId: year.id,
          },
          select: { id: true, code: true, name: true, level: true, status: true },
          orderBy: { createdAt: 'desc' },
        });
        exam =
          exams.find(
            (e) =>
              federisLevelMatchesType(e.level, type) &&
              !EXAM_BLOCKED_STATUSES.includes(e.status),
          ) ?? null;
        if (!exam) {
          reason = `Aucune campagne ${EXAM_DEFS[type].label} active pour cette année scolaire.`;
        }
      }

      result.push({
        linkId: link.id,
        patronatId: link.patronatId,
        patronatTenantId,
        patronatName,
        exam,
        reason,
      });
    }

    return result;
  }

  // ── 1. Éligibilité dynamique (onglet + sous-onglets) ─────────────────────

  async getEligibility(tenantId: string, userId: string, role?: string) {
    await this.resolveSchoolContext(tenantId, userId, role);

    const year = await this.getActiveYear(tenantId);
    if (!year) {
      return {
        academicYear: null,
        message:
          'Aucune année scolaire active — activez une année dans Paramètres pour préparer les examens nationaux.',
        patronats: [],
        exams: (Object.values(EXAM_DEFS) as ExamTypeDef[]).map((d) => ({
          ...d,
          available: false,
          classes: [] as string[],
          studentCount: 0,
          submission: null,
        })),
      };
    }

    const submissions = await this.prisma.schoolExamSubmission.findMany({
      where: { tenantId, academicYearId: year.id },
    });
    const submissionByType = new Map(submissions.map((s) => [s.examType, s]));

    const exams = [];
    for (const def of Object.values(EXAM_DEFS) as ExamTypeDef[]) {
      const eligibleClasses = await this.getEligibleClasses(tenantId, year.id, def.type);
      const classIds = eligibleClasses.map((c) => c.id);

      let studentCount = 0;
      if (classIds.length > 0) {
        studentCount = await this.prisma.classStudent.count({
          where: {
            tenantId,
            academicYearId: year.id,
            classId: { in: classIds },
            status: 'ACTIVE',
            student: { isActive: true },
          },
        });
      }

      const submission = submissionByType.get(def.type);
      exams.push({
        ...def,
        available: eligibleClasses.length > 0,
        classes: eligibleClasses.map((c) => c.name),
        studentCount,
        submission: submission
          ? {
              status: submission.status,
              count: Array.isArray(submission.candidateIds)
                ? (submission.candidateIds as string[]).length
                : 0,
              submittedAt: submission.submittedAt,
              patronatIds: submission.patronatIds,
            }
          : null,
      });
    }
    exams.sort((a, b) => a.order - b.order);

    // Patronats rattachés (toutes campagnes confondues) pour l'état général
    const links = await this.prisma.patronatSchool.findMany({
      where: { schoolTenantId: tenantId, status: 'JOINED' },
      include: {
        patronat: { select: { id: true, name: true, territoryName: true } },
      },
    });

    return {
      academicYear: { id: year.id, name: year.name, label: (year as any).label ?? year.name },
      patronats: links.map((l) => ({
        id: l.id,
        name: l.patronat?.name ?? 'Patronat',
        territoryName: l.patronat?.territoryName ?? null,
      })),
      exams,
    };
  }

  // ── 2. Liste des élèves éligibles (par sous-onglet) ───────────────────────

  async getCandidates(
    tenantId: string,
    userId: string,
    role: string | undefined,
    examType: string,
  ) {
    await this.resolveSchoolContext(tenantId, userId, role);
    const type = this.assertExamType(examType);
    const def = EXAM_DEFS[type];

    const year = await this.getActiveYear(tenantId);
    if (!year) {
      throw new BadRequestException(
        'Aucune année scolaire active (NO ACADEMIC YEAR = NO DATA).',
      );
    }

    const eligibleClasses = await this.getEligibleClasses(tenantId, year.id, type);
    if (eligibleClasses.length === 0) {
      return {
        examType: type,
        ...def,
        academicYear: { id: year.id, name: year.name },
        students: [],
        groups: [],
        submission: null,
        patronatCandidates: {},
      };
    }

    const classById = new Map(eligibleClasses.map((c) => [c.id, c]));

    const enrollments = await this.prisma.classStudent.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        classId: { in: eligibleClasses.map((c) => c.id) },
        status: 'ACTIVE',
        student: { isActive: true },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
            studentCode: true,
            dateOfBirth: true,
            gender: true,
            photoUrl: true,
          },
        },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    });

    // Déduplication (un élève peut apparaître dans deux classes après transfert)
    const seen = new Set<string>();
    const students = [];
    for (const e of enrollments) {
      if (seen.has(e.studentId)) continue;
      seen.add(e.studentId);
      const klass = classById.get(e.classId);

      // Série : classe officielle (AcademicSeries) en priorité, sinon le nom
      let series: string | null = klass?.officialClass?.series?.name ?? null;
      if (!series) series = seriesFromClassName(klass?.name);
      if (!series) series = seriesFromClassName(klass?.officialClass?.name);

      students.push({
        id: e.student.id,
        firstName: e.student.firstName,
        lastName: e.student.lastName,
        fullName: `${e.student.firstName} ${e.student.lastName}`,
        matricule: e.student.matricule ?? e.student.studentCode ?? null,
        dateOfBirth: e.student.dateOfBirth,
        gender: e.student.gender,
        photoUrl: e.student.photoUrl,
        className: klass?.name ?? null,
        series: series ? series.toUpperCase() : null,
      });
    }

    // Sélection enregistrée
    const submission = await this.prisma.schoolExamSubmission.findFirst({
      where: { tenantId, academicYearId: year.id, examType: type },
    });
    const selectedIds = new Set(
      submission && Array.isArray(submission.candidateIds)
        ? (submission.candidateIds as string[])
        : [],
    );

    // Candidats déjà transmis aux patronats (par metadata.studentId)
    const targets = await this.getJoinedPatronatsWithExam(tenantId, type);
    const patronatCandidates: Record<string, string> = {};
    for (const t of targets) {
      if (!t.exam) continue;
      const existing = await this.prisma.examCandidate.findMany({
        where: { examId: t.exam.id, schoolTenantId: tenantId },
        select: { id: true, matricule: true, status: true, metadata: true },
      });
      for (const c of existing) {
        const studentId = (c.metadata as any)?.studentId;
        if (studentId) {
          patronatCandidates[studentId] =
            c.status === 'WITHDRAWN' ? 'WITHDRAWN' : 'TRANSMITTED';
        }
      }
    }

    // Groupes (Bac : par série ; CEP/BEPC : par classe)
    const groups: { key: string; label: string; count: number }[] = [];
    if (def.hasSeries) {
      const bySeries = new Map<string, number>();
      for (const s of students) {
        const key = s.series ?? 'NON PRECISEE';
        bySeries.set(key, (bySeries.get(key) ?? 0) + 1);
      }
      for (const [key, count] of [...bySeries.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        groups.push({
          key,
          label: key === 'NON PRECISEE' ? 'Série non précisée' : `Série ${key}`,
          count,
        });
      }
    } else {
      const byClass = new Map<string, number>();
      for (const s of students) {
        const key = s.className ?? 'NON ASSIGNEE';
        byClass.set(key, (byClass.get(key) ?? 0) + 1);
      }
      for (const [key, count] of [...byClass.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        groups.push({
          key,
          label: key === 'NON ASSIGNEE' ? 'Classe non assignée' : key,
          count,
        });
      }
    }

    return {
      examType: type,
      ...def,
      academicYear: { id: year.id, name: year.name },
      students: students.map((s) => ({
        ...s,
        selected: selectedIds.has(s.id),
        patronatStatus: patronatCandidates[s.id] ?? null,
      })),
      groups,
      submission: submission
        ? {
            status: submission.status,
            count: selectedIds.size,
            submittedAt: submission.submittedAt,
          }
        : null,
      patronatTargets: targets.map((t) => ({
        name: t.patronatName,
        exam: t.exam ? { code: t.exam.code, name: t.exam.name } : null,
        ready: !!t.exam,
        reason: t.reason,
      })),
    };
  }

  // ── 3. Sélection officielle (brouillon persistant) ────────────────────────

  async saveSelection(
    tenantId: string,
    userId: string,
    role: string | undefined,
    examType: string,
    dto: SaveSelectionDto,
  ) {
    await this.resolveSchoolContext(tenantId, userId, role, true);
    const type = this.assertExamType(examType);

    const year = await this.getActiveYear(tenantId);
    if (!year) {
      throw new BadRequestException('Aucune année scolaire active.');
    }

    const ids = [...new Set(dto.studentIds ?? [])];
    if (ids.length === 0) {
      throw new BadRequestException(
        'Sélection vide — décochez puis envoyez, ou utilisez la sélection pour officialiser une liste.',
      );
    }
    if (ids.length > 2000) {
      throw new BadRequestException('Sélection limitée à 2 000 élèves par examen.');
    }

    // Les élèves doivent appartenir à l'école et être actifs
    const valid = await this.prisma.student.count({
      where: { id: { in: ids }, tenantId, isActive: true },
    });
    if (valid !== ids.length) {
      throw new BadRequestException(
        `${ids.length - valid} élève(s) de la sélection sont introuvables ou inactifs dans votre établissement.`,
      );
    }

    const existing = await this.prisma.schoolExamSubmission.findFirst({
      where: { tenantId, academicYearId: year.id, examType: type },
    });

    const data = {
      candidateIds: ids as any,
      status: 'DRAFT',
      metadata: {
        ...((existing?.metadata as any) ?? {}),
        lastSavedAt: new Date().toISOString(),
      },
    };

    const saved = existing
      ? await this.prisma.schoolExamSubmission.update({ where: { id: existing.id }, data })
      : await this.prisma.schoolExamSubmission.create({
          data: {
            tenantId,
            academicYearId: year.id,
            examType: type,
            ...data,
          },
        });

    return {
      examType: type,
      status: saved.status,
      count: ids.length,
      savedAt: saved.updatedAt,
    };
  }

  // ── 4. Envoi officiel au(x) patronat(s) rattaché(s) ───────────────────────

  async submitSelection(
    tenantId: string,
    userId: string,
    role: string | undefined,
    examType: string,
    dto: SubmitSelectionDto,
  ) {
    const { tenant: school, user } = await this.resolveSchoolContext(
      tenantId,
      userId,
      role,
      true,
    );
    const type = this.assertExamType(examType);
    const def = EXAM_DEFS[type];

    const year = await this.getActiveYear(tenantId);
    if (!year) {
      throw new BadRequestException('Aucune année scolaire active.');
    }

    // Sélection : payload explicite sinon sélection enregistrée
    let studentIds: string[];
    if (dto.studentIds?.length) {
      studentIds = [...new Set(dto.studentIds)];
    } else {
      const saved = await this.prisma.schoolExamSubmission.findFirst({
        where: { tenantId, academicYearId: year.id, examType: type },
      });
      studentIds =
        saved && Array.isArray(saved.candidateIds) ? (saved.candidateIds as string[]) : [];
    }
    if (studentIds.length === 0) {
      throw new BadRequestException(
        'Aucun candidat sélectionné — cochez les élèves à présenter avant l\u2019envoi.',
      );
    }

    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, tenantId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        matricule: true,
        studentCode: true,
        dateOfBirth: true,
        gender: true,
      },
    });
    if (students.length !== studentIds.length) {
      throw new BadRequestException(
        'La sélection contient des élèves introuvables ou inactifs — rechargez la liste.',
      );
    }
    const studentById = new Map(students.map((s) => [s.id, s]));

    // Classes éligibles (pour conserver classe/série dans les métadonnées)
    const eligibleClasses = await this.getEligibleClasses(tenantId, year.id, type);
    const classById = new Map(eligibleClasses.map((c) => [c.id, c]));
    const enrollments = await this.prisma.classStudent.findMany({
      where: {
        tenantId,
        academicYearId: year.id,
        classId: { in: eligibleClasses.map((c) => c.id) },
        status: 'ACTIVE',
        studentId: { in: studentIds },
      },
    });
    const classByStudent = new Map<string, string>();
    for (const e of enrollments) {
      if (!classByStudent.has(e.studentId)) {
        classByStudent.set(e.studentId, classById.get(e.classId)?.name ?? null);
      }
    }

    // Cibles : patronats rattachés avec campagne active correspondante
    const targets = await this.getJoinedPatronatsWithExam(tenantId, type);
    if (targets.length === 0) {
      throw new BadRequestException(
        "Aucun patronat rattaché — validez d'abord les demandes de rattachement dans le module Patronats & Examens fédérés.",
      );
    }
    const readyTargets = targets.filter((t) => t.exam);
    if (readyTargets.length === 0) {
      const details = targets
        .map((t) => `${t.patronatName} : ${t.reason ?? 'campagne introuvable'}`)
        .join(' ; ');
      throw new BadRequestException(
        `Aucune campagne ${def.label} active chez vos patronats rattachés. Détails : ${details}`,
      );
    }

    const reports: any[] = [];

    for (const target of readyTargets) {
      const exam = target.exam!;
      const patronatTenantId = target.patronatTenantId;

      // Quota de candidats du plan du patronat (portée : année scolaire du patronat)
      const patronat = await this.prisma.patronat.findFirst({
        where: { tenantId: patronatTenantId },
        select: { subscriptionPlan: true, name: true },
      });
      const plan =
        FEDERIS_PLANS[(patronat?.subscriptionPlan as FederisPlanCode)] ??
        FEDERIS_PLANS.ESSENTIEL;
      const patronatYear = await this.getActiveYear(patronatTenantId);
      const yearCount = patronatYear
        ? await this.prisma.examCandidate.count({
            where: { tenantId: patronatTenantId, academicYearId: patronatYear.id },
          })
        : await this.prisma.examCandidate.count({ where: { tenantId: patronatTenantId } });

      // Candidats existants de cette école pour cet examen (par metadata.studentId)
      const existing = await this.prisma.examCandidate.findMany({
        where: { examId: exam.id, schoolTenantId: tenantId },
        select: { id: true, matricule: true, status: true, metadata: true },
      });
      const existingByStudent = new Map<string, (typeof existing)[number]>();
      for (const c of existing) {
        const sid = (c.metadata as any)?.studentId;
        if (sid) existingByStudent.set(sid, c);
      }

      const selectedSet = new Set(studentIds);
      let created = 0;
      let updated = 0;
      let withdrawn = 0;
      const createdIds: string[] = [];

      // Transaction : upsert des candidats + retraits + total
      await this.prisma.$transaction(async (tx) => {
        for (const sid of studentIds) {
          const s = studentById.get(sid);
          if (!s) continue;
          const klass = classByStudent.get(sid) ?? null;
          const already = existingByStudent.get(sid);

          if (already) {
            // Mise à jour (réactivation si retiré auparavant)
            await tx.examCandidate.update({
              where: { id: already.id },
              data: {
                firstName: s.firstName,
                lastName: s.lastName,
                dateOfBirth: s.dateOfBirth,
                gender: s.gender,
                status: 'REGISTERED',
                metadata: {
                  ...((already.metadata as any) ?? {}),
                  studentId: sid,
                  schoolClass: klass,
                  submissionUpdatedAt: new Date().toISOString(),
                },
              },
            });
            updated++;
          } else {
            if (yearCount + created + 1 > plan.maxCandidates) {
              throw new BadRequestException(
                `Quota de candidats de l'offre ${plan.name} du patronat ${target.patronatName} dépassé (${plan.maxCandidates} max). Le patronat doit passer à l'offre Institution.`,
              );
            }
            const matricule = await this.nextMatricule(exam.code, patronatTenantId, tx);
            const c = await tx.examCandidate.create({
              data: {
                tenantId: patronatTenantId,
                // La campagne n'existe que si l'année scolaire du patronat est
                // active — patronatYear est donc toujours défini ici.
                academicYearId: patronatYear!.id,
                examId: exam.id,
                patronatSchoolId: target.linkId,
                schoolTenantId: tenantId,
                firstName: s.firstName,
                lastName: s.lastName,
                dateOfBirth: s.dateOfBirth,
                gender: s.gender,
                matricule,
                registrationNumber: matricule,
                status: 'REGISTERED',
                createdBy: userId,
                metadata: {
                  source: 'SCHOOL_SUBMISSION',
                  studentId: sid,
                  studentMatricule: s.matricule ?? s.studentCode ?? null,
                  schoolClass: klass,
                  schoolName: school.name,
                  submittedAt: new Date().toISOString(),
                },
              },
            });
            created++;
            createdIds.push(c.id);
          }
        }

        // Retraits : candidats transmis auparavant mais décochés depuis
        for (const [sid, already] of existingByStudent) {
          if (!selectedSet.has(sid) && already.status !== 'WITHDRAWN') {
            await tx.examCandidate.update({
              where: { id: already.id },
              data: {
                status: 'WITHDRAWN',
                metadata: {
                  ...((already.metadata as any) ?? {}),
                  withdrawnAt: new Date().toISOString(),
                  withdrawnBySchool: true,
                },
              },
            });
            withdrawn++;
          }
        }

        // Total à jour (candidats non retirés)
        const activeCount = await tx.examCandidate.count({
          where: { examId: exam.id, status: { not: 'WITHDRAWN' } },
        });
        await tx.nationalExam.update({
          where: { id: exam.id },
          data: { totalCandidates: activeCount },
        });
      });

      // Audit côté patronat
      await this.prisma.auditLog
        .create({
          data: {
            tenantId: patronatTenantId,
            userId,
            action: 'FEDERIS_SCHOOL_SUBMISSION',
            resource: 'NationalExam',
            resourceId: exam.id,
            tableName: 'exam_candidates',
            recordId: exam.id,
            newData: {
              schoolTenantId: tenantId,
              schoolName: school.name,
              examType: type,
              created,
              updated,
              withdrawn,
              total: studentIds.length,
            },
          },
        })
        .catch(() => undefined);

      // ⭐ Notification temps réel de l'équipe du patronat (fire-and-forget)
      await this.notifyPatronatTeam(
        patronatTenantId,
        target.patronatName,
        school.name,
        def.label,
        exam,
        studentIds.length,
      ).catch((err) => this.logger.warn(`Notification patronat échouée : ${err.message}`));

      reports.push({
        patronat: target.patronatName,
        exam: { id: exam.id, code: exam.code, name: exam.name },
        created,
        updated,
        withdrawn,
        total: studentIds.length,
      });
    }

    // Enregistrement de la soumission (SUBMITTED)
    const existingSubmission = await this.prisma.schoolExamSubmission.findFirst({
      where: { tenantId, academicYearId: year.id, examType: type },
    });
    const now = new Date();
    const submissionData = {
      candidateIds: studentIds as any,
      status: 'SUBMITTED',
      patronatIds: readyTargets.map((t) => t.patronatTenantId) as any,
      submittedAt: now,
      submittedBy: user.id,
      metadata: {
        ...((existingSubmission?.metadata as any) ?? {}),
        reports,
        lastSubmissionAt: now.toISOString(),
      },
    };
    if (existingSubmission) {
      await this.prisma.schoolExamSubmission.update({
        where: { id: existingSubmission.id },
        data: submissionData,
      });
    } else {
      await this.prisma.schoolExamSubmission.create({
        data: { tenantId, academicYearId: year.id, examType: type, ...submissionData },
      });
    }

    // Audit côté école
    await this.prisma.auditLog
      .create({
        data: {
          tenantId,
          userId,
          action: 'SCHOOL_NATIONAL_EXAM_SUBMITTED',
          resource: 'SchoolExamSubmission',
          resourceId: `${tenantId}:${year.id}:${type}`,
          tableName: 'school_exam_submissions',
          recordId: type,
          newData: {
            examType: type,
            candidates: studentIds.length,
            patronats: readyTargets.map((t) => t.patronatName),
          },
        },
      })
      .catch(() => undefined);

    return {
      examType: type,
      label: def.label,
      submittedAt: now.toISOString(),
      candidates: studentIds.length,
      reports,
      skipped: targets
        .filter((t) => !t.exam)
        .map((t) => ({ patronat: t.patronatName, reason: t.reason })),
    };
  }

  /** Matricule candidat séquentiel (pattern federis-exams.service). */
  private async nextMatricule(
    examCode: string,
    patronatTenantId: string,
    tx?: any,
  ): Promise<string> {
    const client = tx ?? this.prisma;
    const count = await client.examCandidate.count({ where: { tenantId: patronatTenantId } });
    const yr = new Date().getFullYear();
    let seq = count + 1;
    for (let i = 0; i < 50; i++) {
      const candidate = `${examCode}-${yr}-${String(seq).padStart(5, '0')}`;
      const exists = await client.examCandidate.findUnique({ where: { matricule: candidate } });
      if (!exists) return candidate;
      seq++;
    }
    return `${examCode}-${yr}-${Date.now()}`;
  }

  /** Notification in-app de l'équipe du patronat (membres actifs). */
  private async notifyPatronatTeam(
    patronatTenantId: string,
    patronatName: string,
    schoolName: string,
    examLabel: string,
    exam: { id: string; code: string; name: string },
    count: number,
  ) {
    const members = await this.prisma.patronatUser.findMany({
      where: { tenantId: patronatTenantId, isActive: true },
      select: { userId: true },
      take: 50,
    });
    if (members.length === 0) return;

    for (const m of members) {
      await this.notificationService
        .create({
          tenantId: patronatTenantId,
          recipientId: m.userId,
          type: 'FEDERIS_SCHOOL_SUBMISSION',
          title: `Nouveaux candidats ${examLabel} — ${schoolName}`,
          body: `${schoolName} vient d'envoyer sa liste officielle de ${count} candidat(s) pour l'examen ${exam.name} (${exam.code}). Les candidats sont disponibles dans le module Candidats.`,
          priority: 'HIGH',
          data: {
            url: '/federis/candidates',
            examId: exam.id,
            examCode: exam.code,
            schoolTenantId: schoolName,
            count,
          },
          relatedEntityType: 'NationalExam',
          relatedEntityId: exam.id,
        })
        .catch((e) => this.logger.warn(`Notif membre patronat échouée : ${e.message}`));
    }
    this.logger.log(
      `Soumission ${examLabel} de ${schoolName} : ${members.length} membre(s) du patronat ${patronatName} notifié(s).`,
    );
  }
}
