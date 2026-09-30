/**
 * FederisSupervisorsService — Gestion des surveillants (Academia Federis)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ 2026-09-29 — module « Centres, salles & Surveillants » → onglet
 *    « Gestion des surveillants ». Workflow complet patronat ↔ écoles :
 *
 *   1. DEMANDE — le patronat demande aux écoles rattachées (JOINED) de
 *      présenter leurs enseignants comme surveillants pour un examen :
 *        POST /federis/supervisors/requests          (notif. directions écoles)
 *   2. SÉLECTION — chaque école, depuis Academia Helm (module « Patronats &
 *      Examens » → « Gestion des surveillants »), sélectionne ses
 *      enseignants dans SA base (Teacher) et envoie sa liste :
 *        POST /federis/school/supervisors/requests/:id/submit
 *      (snapshot des enseignants + notification de l'équipe du patronat)
 *   3. RÉPARTITION — le patronat consulte les listes PAR ÉCOLE + le récap
 *      global (toutes écoles confondues), puis affecte chaque enseignant
 *      à un CENTRE et à une SALLE de composition :
 *        GET  /federis/supervisors/requests/:id/submissions
 *        POST /federis/supervisors/requests/:id/assignments
 *      À la validation : création des ExamSupervisor + notification des
 *      directions des écoles (interface admin).
 *   4. TRANSMISSION — l'école voit les affectations reçues (enseignant →
 *      centre → salle) et clique pour notifier chaque enseignant dans SON
 *      UI (notification in-app, résolution Teacher.email → User) :
 *        POST /federis/school/supervisors/assignments/:id/notify-teacher
 *        POST /federis/school/supervisors/assignments/notify-all
 *
 * Le registre des affectations (ExamSupervisor) conserve également les
 * surveillants créés MANUELLEMENT par le patronat :
 *   GET    /federis/supervisors?examId=      — registre par examen
 *   POST   /federis/supervisors              — création manuelle
 *   PATCH  /federis/supervisors/:id          — changement centre / salle
 *   DELETE /federis/supervisors/:id          — retrait
 *
 * Règles transverses :
 *   - Isolation territoriale STRICTE par tenant (pattern FederisExamsService).
 *   - Écritures patronat : COORDONNATEUR + ORGANISATEUR (WRITE_EXAM_ORG).
 *   - Côté école : lecture pour tout le personnel, sélection/envoi et
 *     transmission aux enseignants réservés à la direction + secrétariat
 *     (pattern federis-school-exams.service).
 *   - Auto-guérison du schéma (ensureSchema — pattern FederisEpreuveService) :
 *     miroir EXACT de la migration 20260929160000_federis_supervisors.
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
import {
  PatronatFunction,
  WRITE_EXAM_ORG,
  normalizePatronatFunction,
} from './federis-roles';
// ⭐ FIX « tenant SCHOOL » : les écoles réelles ont type MATERNELLE / PRIMAIRE /
//    SECONDAIRE / MIXTE (source : common/constants/school-tenant-types).
import { isSchoolTenantType } from '../common/constants/school-tenant-types';

// ── DTO ─────────────────────────────────────────────────────────────────────

// ⭐ FIX 2026-09-29 — décorateurs class-validator OBLIGATOIRES : le
//    ValidationPipe global (whitelist + forbidNonWhitelisted) rejette toute
//    propriété sans décorateur et l'AcademicYearEnforcementInterceptor injecte
//    academicYearId quand le DTO n'a aucune règle → double rejet 400 sur tous
//    les POST/PATCH du module surveillants (pattern federis-patronat.service).
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSupervisorRequestDto {
  /** Titre lisible (ex : « Enseignants surveillants — BEPC 2027 »). */
  @IsString()
  @MinLength(3)
  @MaxLength(190)
  title!: string;

  /** Message adressé aux écoles (consigne, nombre attendu…).
   * ⭐ 2026-10-01 — porté à 5000 caractères (demande utilisateur) : la note
   *    circulaire auto-générée couvre désormais les TROIS postes
   *    (surveillance, correction, secrétariat) et dépasse les 2000 car. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  message?: string;

  /** NationalExam concerné — REQUIS (la répartition se fait par centre et
   *  par salle DE l'examen, pattern ExamCenter/ExamRoom). */
  @IsString()
  examId!: string;

  /** Date limite de réponse des écoles (optionnelle). */
  @IsOptional()
  @IsString()
  deadline?: string;
}

export class UpdateSupervisorRequestDto {
  @IsIn(['OPEN', 'CLOSED'])
  status!: 'OPEN' | 'CLOSED';
}

export class SubmitNominationDto {
  /** Identifiants des enseignants présentés (Teacher.id de l'école). */
  @IsArray()
  @IsString({ each: true })
  teacherIds!: string[];
}

export class SupervisorAssignmentDto {
  /** SchoolSupervisorSubmission d'où provient l'enseignant. */
  @IsString()
  submissionId!: string;

  /** Teacher (BD de l'école) à affecter. */
  @IsString()
  teacherId!: string;

  /** ⭐ 2026-10-01 — POSTE de l'enseignant : surveillance des épreuves,
   *  correction des copies ou secrétariat (saisie des notes).
   *  Défaut SURVEILLANCE (comportement historique). */
  @IsOptional()
  @IsIn(SUPERVISOR_POSTS)
  post?: SupervisorPost;

  /** ExamCenter cible (requis pour la surveillance, optionnel sinon). */
  @IsOptional()
  @IsString()
  centerId?: string;

  /** ExamRoom cible (optionnelle — centre seul). */
  @IsOptional()
  @IsString()
  roomId?: string;
}

export class AssignSupervisorsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupervisorAssignmentDto)
  assignments!: SupervisorAssignmentDto[];
}

export class CreateSupervisorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(190)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsString()
  examId!: string;

  /** ⭐ 2026-10-01 — poste (surveillance / correction / secrétariat). */
  @IsOptional()
  @IsIn(SUPERVISOR_POSTS)
  post?: SupervisorPost;

  @IsOptional()
  @IsString()
  centerId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsIn(['SURVEILLANT', 'CHEF_DE_SALLE', 'CHEF_DE_CENTRE'])
  role?: string;
}

export class UpdateSupervisorDto {
  @IsOptional()
  @IsString()
  centerId?: string | null;

  @IsOptional()
  @IsString()
  roomId?: string | null;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  role?: string;
}

// ── Constantes ──────────────────────────────────────────────────────────────

/** ⭐ 2026-10-01 — Postes de répartition des enseignants envoyés par les
 *    écoles : surveillance des épreuves, correction des copies, secrétariat
 *    (saisie des notes). Le patronat répartit chaque enseignant sur l'un de
 *    ces trois postes au moment de la validation de la répartition. */
export type SupervisorPost = 'SURVEILLANCE' | 'CORRECTION' | 'SECRETARIAT';

export const SUPERVISOR_POSTS: SupervisorPost[] = ['SURVEILLANCE', 'CORRECTION', 'SECRETARIAT'];

export function normalizeSupervisorPost(value?: string | null): SupervisorPost {
  return SUPERVISOR_POSTS.includes(value as SupervisorPost)
    ? (value as SupervisorPost)
    : 'SURVEILLANCE';
}

/** Libellé court d'un poste (notifications, registres). */
export function supervisorPostLabel(post?: string | null): string {
  switch (normalizeSupervisorPost(post)) {
    case 'CORRECTION':
      return 'Correction des épreuves';
    case 'SECRETARIAT':
      return 'Secrétariat — saisie des notes';
    default:
      return 'Surveillance des épreuves';
  }
}

/** Rôles de direction autorisés (notification + actions côté école). */
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

/** Snapshot enseignant conservé dans SchoolSupervisorSubmission.teachers. */
interface TeacherSnapshot {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string | null;
  phone: string | null;
  email: string | null;
  subject: string | null;
}

function isDirectionRole(role?: string | null): boolean {
  const r = role ?? '';
  return SCHOOL_DIRECTION_ROLES.includes(r) || SCHOOL_DIRECTION_ROLE_PREFIX.test(r);
}

@Injectable()
export class FederisSupervisorsService {
  private readonly logger = new Logger(FederisSupervisorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  // ── Auto-guérison du schéma (pattern ensure-tables main.ts) ─────────────
  //
  // Miroir EXACT de la migration 20260929160000_federis_supervisors :
  // le déploiement Railway n'exécute pas prisma migrate deploy au démarrage
  // (SKIP_MIGRATIONS=true) — les tables et colonnes sont créées
  // idempotemment au premier appel du service.

  private schemaReady = false;

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    try {
      await this.prisma.$queryRawUnsafe(`SELECT 1 FROM "supervisor_requests" LIMIT 1`);
      await this.prisma.$queryRawUnsafe(
        `SELECT 1 FROM "school_supervisor_submissions" LIMIT 1`,
      );
      const cols: any[] = (await this.prisma.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name='exam_supervisors' AND column_name IN
         ('source','schoolTenantId','teacherId','requestId','submissionId','teacherNotifiedAt','post')`,
      )) as any[];
      if (!cols || cols.length < 7) throw new Error('colonnes exam_supervisors absentes');
      this.schemaReady = true;
      return;
    } catch {
      /* tables ou colonnes absentes → création idempotente ci-dessous */
    }

    const statements = [
      `CREATE TABLE IF NOT EXISTS "supervisor_requests" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "academicYearId" TEXT NOT NULL,
          "examId" TEXT,
          "examLabel" TEXT,
          "title" TEXT NOT NULL,
          "message" TEXT,
          "status" TEXT NOT NULL DEFAULT 'OPEN',
          "deadline" TIMESTAMP(3),
          "createdBy" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "supervisor_requests_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE INDEX IF NOT EXISTS "supervisor_requests_tenantId_idx"
          ON "supervisor_requests"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "supervisor_requests_academicYearId_idx"
          ON "supervisor_requests"("academicYearId")`,
      `CREATE INDEX IF NOT EXISTS "supervisor_requests_examId_idx"
          ON "supervisor_requests"("examId")`,
      `CREATE INDEX IF NOT EXISTS "supervisor_requests_status_idx"
          ON "supervisor_requests"("status")`,
      `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supervisor_requests_tenantId_fkey') THEN
              ALTER TABLE "supervisor_requests"
                  ADD CONSTRAINT "supervisor_requests_tenantId_fkey"
                  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;
          END IF;
      END $$`,
      `CREATE TABLE IF NOT EXISTS "school_supervisor_submissions" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "requestId" TEXT NOT NULL,
          "teacherIds" JSONB NOT NULL,
          "teachers" JSONB,
          "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
          "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "submittedBy" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "school_supervisor_submissions_pkey" PRIMARY KEY ("id")
      )`,
      `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_supervisor_submissions_tenantId_requestId_key') THEN
              ALTER TABLE "school_supervisor_submissions"
                  ADD CONSTRAINT "school_supervisor_submissions_tenantId_requestId_key"
                  UNIQUE ("tenantId", "requestId");
          END IF;
      END $$`,
      `CREATE INDEX IF NOT EXISTS "school_supervisor_submissions_tenantId_idx"
          ON "school_supervisor_submissions"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "school_supervisor_submissions_requestId_idx"
          ON "school_supervisor_submissions"("requestId")`,
      `CREATE INDEX IF NOT EXISTS "school_supervisor_submissions_status_idx"
          ON "school_supervisor_submissions"("status")`,
      `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_supervisor_submissions_tenantId_fkey') THEN
              ALTER TABLE "school_supervisor_submissions"
                  ADD CONSTRAINT "school_supervisor_submissions_tenantId_fkey"
                  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;
          END IF;
      END $$`,
      `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_supervisor_submissions_requestId_fkey') THEN
              ALTER TABLE "school_supervisor_submissions"
                  ADD CONSTRAINT "school_supervisor_submissions_requestId_fkey"
                  FOREIGN KEY ("requestId") REFERENCES "supervisor_requests"("id") ON DELETE CASCADE;
          END IF;
      END $$`,
      `ALTER TABLE "exam_supervisors" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL'`,
      `ALTER TABLE "exam_supervisors" ADD COLUMN IF NOT EXISTS "schoolTenantId" TEXT`,
      `ALTER TABLE "exam_supervisors" ADD COLUMN IF NOT EXISTS "teacherId" TEXT`,
      `ALTER TABLE "exam_supervisors" ADD COLUMN IF NOT EXISTS "requestId" TEXT`,
      `ALTER TABLE "exam_supervisors" ADD COLUMN IF NOT EXISTS "submissionId" TEXT`,
      `ALTER TABLE "exam_supervisors" ADD COLUMN IF NOT EXISTS "teacherNotifiedAt" TIMESTAMP(3)`,
      // ⭐ 2026-10-01 — poste : SURVEILLANCE | CORRECTION | SECRETARIAT
      //    (migration 20261001000000_federis_supervisor_posts)
      `ALTER TABLE "exam_supervisors" ADD COLUMN IF NOT EXISTS "post" TEXT NOT NULL DEFAULT 'SURVEILLANCE'`,
      `CREATE INDEX IF NOT EXISTS "exam_supervisors_post_idx"
          ON "exam_supervisors"("post")`,
      `CREATE INDEX IF NOT EXISTS "exam_supervisors_schoolTenantId_idx"
          ON "exam_supervisors"("schoolTenantId")`,
      `CREATE INDEX IF NOT EXISTS "exam_supervisors_requestId_idx"
          ON "exam_supervisors"("requestId")`,
      `CREATE INDEX IF NOT EXISTS "exam_supervisors_submissionId_idx"
          ON "exam_supervisors"("submissionId")`,
    ];
    for (const sql of statements) {
      await this.prisma.$executeRawUnsafe(sql);
    }
    this.schemaReady = true;
    this.logger.log('Schéma surveillants assuré (supervisor_requests + school_supervisor_submissions + exam_supervisors enrichi).');
  }

  // ── Contexte patronat (pattern FederisEpreuveService) ───────────────────

  /** Résout le patronat + la fonction du demandeur — scopé par TENANT. */
  private async resolvePatronatContext(tenantId: string, userId?: string) {
    const patronat = await this.prisma.patronat.findFirst({
      where: { tenantId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        orgLevel: true,
      },
    });
    if (!patronat) {
      throw new NotFoundException('Aucun espace patronat associé à ce compte.');
    }

    let fn: PatronatFunction = 'VIEWER';
    if (userId) {
      const link = await this.prisma.patronatUser.findFirst({
        where: { tenantId, userId, isActive: true },
        select: { role: true },
      });
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      fn = normalizePatronatFunction(link?.role ?? user?.role);
    }
    return { patronat, fn };
  }

  private assertCanWrite(fn: PatronatFunction): void {
    if (!WRITE_EXAM_ORG.includes(fn)) {
      throw new ForbiddenException(
        'La gestion des surveillants est réservée au coordonnateur et à l\u2019organisateur du patronat.',
      );
    }
  }

  /** Année scolaire active du patronat. */
  private async getActiveYear(tenantId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!year) {
      throw new BadRequestException(
        'Aucune année scolaire active — configurez l\u2019année courante du patronat.',
      );
    }
    return year;
  }

  /** Examen possédé par le patronat (isolation territoriale). */
  private async getOwnedExam(patronatTenantId: string, examId: string) {
    const exam = await this.prisma.nationalExam.findFirst({
      where: { id: examId, tenantId: patronatTenantId },
      select: { id: true, code: true, name: true, examType: true, status: true },
    });
    if (!exam) {
      throw new NotFoundException('Examen introuvable pour ce patronat.');
    }
    return exam;
  }

  // ── Contexte école (pattern FederisSchoolExamsService) ──────────────────

  /**
   * Contexte école : tenant école actif + appartenance de l'utilisateur.
   * `requireDirection` réserve la sélection/l'envoi et la transmission des
   * notifications enseignants à la direction et au secrétariat.
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
    if (!isSchoolTenantType(tenant.type)) {
      throw new ForbiddenException(
        'La gestion des surveillants est réservée aux établissements Academia Helm.',
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
      if (!user.isSuperAdmin && !isDirectionRole(effectiveRole)) {
        throw new ForbiddenException(
          "La sélection des enseignants surveillants et la transmission des affectations sont réservés à la direction et au secrétariat de l'établissement.",
        );
      }
    }

    return { tenant, user };
  }

  /** Écoles rattachées (JOINED) du patronat — destinataires des demandes. */
  private async joinedSchools(patronatTenantId: string) {
    const links = await this.prisma.patronatSchool.findMany({
      where: { tenantId: patronatTenantId, status: 'JOINED' },
      select: {
        schoolTenantId: true,
        schoolTenant: { select: { id: true, name: true } },
      },
      orderBy: { schoolTenant: { name: 'asc' } },
    });
    return links
      .filter((l) => !!l.schoolTenant)
      .map((l) => ({
        tenantId: l.schoolTenantId,
        name: l.schoolTenant!.name,
      }));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PATRONAT — 1. Demandes aux écoles
  // ═══════════════════════════════════════════════════════════════════════

  /** Liste des demandes du patronat avec compteurs de progression. */
  async listRequests(tenantId: string, userId: string) {
    await this.ensureSchema();
    const { fn } = await this.resolvePatronatContext(tenantId, userId);

    const requests = await this.prisma.supervisorRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const ids = requests.map((r) => r.id);
    const schools = await this.joinedSchools(tenantId);

    const submissions = ids.length
      ? await this.prisma.schoolSupervisorSubmission.findMany({
          where: { requestId: { in: ids } },
          select: {
            id: true,
            requestId: true,
            tenantId: true,
            teacherIds: true,
            submittedAt: true,
          },
        })
      : [];

    const assigned = ids.length
      ? await this.prisma.examSupervisor.groupBy({
          by: ['requestId'],
          where: { tenantId, requestId: { in: ids } },
          _count: { _all: true },
        })
      : [];

    const assignedByRequest = new Map<string, number>();
    for (const a of assigned) {
      if (a.requestId) assignedByRequest.set(a.requestId, a._count._all);
    }

    return {
      canManage: WRITE_EXAM_ORG.includes(fn),
      schoolsCount: schools.length,
      requests: requests.map((r) => {
        const subs = submissions.filter((s) => s.requestId === r.id);
        const proposed = subs.reduce(
          (sum, s) => sum + (Array.isArray(s.teacherIds) ? (s.teacherIds as unknown[]).length : 0),
          0,
        );
        return {
          id: r.id,
          title: r.title,
          message: r.message,
          examId: r.examId,
          examLabel: r.examLabel,
          status: r.status,
          deadline: r.deadline,
          createdAt: r.createdAt,
          respondedCount: subs.length,
          teachersProposed: proposed,
          supervisorsAssigned: assignedByRequest.get(r.id) ?? 0,
        };
      }),
    };
  }

  /**
   * Création d'une demande : le patronat demande aux écoles rattachées de
   * présenter leurs enseignants comme surveillants pour un examen.
   * → notification in-app des directions de toutes les écoles JOINED.
   */
  async createRequest(tenantId: string, userId: string, dto: CreateSupervisorRequestDto) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolvePatronatContext(tenantId, userId);
    this.assertCanWrite(fn);

    if (!dto.title || dto.title.trim().length < 3) {
      throw new BadRequestException('Le titre de la demande est requis (3 caractères minimum).');
    }
    if (!dto.examId) {
      throw new BadRequestException(
        'Sélectionnez l\u2019examen concerné — la répartition des surveillants se fait par centre et par salle de cet examen.',
      );
    }

    const year = await this.getActiveYear(tenantId);
    const exam = await this.getOwnedExam(tenantId, dto.examId);

    const request = await this.prisma.supervisorRequest.create({
      data: {
        tenantId,
        academicYearId: year.id,
        examId: exam.id,
        examLabel: `${exam.name} (${exam.code})`,
        title: dto.title.trim(),
        message: dto.message?.trim() || null,
        status: 'OPEN',
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        createdBy: userId,
      },
    });

    // Notification des directions des écoles rattachées (interface admin Helm)
    const schools = await this.joinedSchools(tenantId);
    let notifiedSchools = 0;
    for (const school of schools) {
      const ok = await this.notifySchoolDirection(
        school.tenantId,
        {
          title: `Désignation d'enseignants — ${exam.name}`,
          body: `${patronat.name} sollicite votre établissement : présentez vos enseignants pour l'organisation de l'examen ${exam.name} (${exam.code}) — surveillance des épreuves, correction des copies et secrétariat (saisie des notes). Ouvrez le module « Patronats & Examens → Gestion des surveillants » pour sélectionner vos enseignants.`,
          priority: 'HIGH',
          data: {
            url: '/app/federis?tab=surveillants',
            requestId: request.id,
            examCode: exam.code,
          },
          relatedEntityType: 'SupervisorRequest',
          relatedEntityId: request.id,
        },
        'FEDERIS_SUPERVISOR_REQUEST',
      );
      if (ok) notifiedSchools++;
    }

    this.logger.log(
      `Demande de surveillants « ${request.title} » créée — ${schools.length} école(s) destinataire(s), ${notifiedSchools} notifiée(s).`,
    );

    return {
      request,
      schoolsCount: schools.length,
      notifiedSchools,
    };
  }

  /** Clôture / réouverture d'une demande. */
  async updateRequest(
    tenantId: string,
    userId: string,
    requestId: string,
    dto: UpdateSupervisorRequestDto,
  ) {
    await this.ensureSchema();
    const { fn } = await this.resolvePatronatContext(tenantId, userId);
    this.assertCanWrite(fn);

    const existing = await this.prisma.supervisorRequest.findFirst({
      where: { id: requestId, tenantId },
    });
    if (!existing) throw new NotFoundException('Demande introuvable.');

    return this.prisma.supervisorRequest.update({
      where: { id: requestId },
      data: { status: dto.status },
    });
  }

  /**
   * ⭐ 2026-10-01 — Signataires de la note circulaire : nom de l'utilisateur
   * courant (avec sa fonction) et nom du COORDONNATEUR du patronat. Sert au
   * pré-remplissage du champ « Signataire » du formulaire de demande — le
   * nom du coordonnateur est proposé par défaut (la note est signée « Pour
   * le Patronat du département » par le Coordinateur), l'utilisateur garde
   * la liberté de modifier la valeur proposée.
   */
  async listSignatories(tenantId: string, userId: string) {
    const { patronat } = await this.resolvePatronatContext(tenantId, userId);

    const links = await this.prisma.patronatUser.findMany({
      where: { tenantId: patronat.tenantId, isActive: true },
      select: {
        role: true,
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const fullName = (u: { firstName: string | null; lastName: string | null } | null) =>
      u ? [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || null : null;

    const myLink = links.find((l) => l.user?.id === userId) ?? null;
    const coordinatorLink = links.find((l) => l.role === 'COORDONNATEUR') ?? links[0] ?? null;

    return {
      current: myLink?.user
        ? { name: fullName(myLink.user), function: myLink.role }
        : null,
      coordinator: coordinatorLink?.user
        ? { name: fullName(coordinatorLink.user) }
        : null,
    };
  }

  /**
   * ⭐ 2026-10-01 — Renvoi de la même note circulaire aux écoles rattachées
   * qui n'ont PAS encore répondu (en particulier les écoles rattachées
   * APRÈS l'envoi initial, qui n'ont jamais reçu la note). Évite de recréer
   * une demande : la note d'origine (objet + message) est retransmise telle
   * quelle, avec rappel de la date limite.
   */
  async resendRequest(tenantId: string, userId: string, requestId: string) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolvePatronatContext(tenantId, userId);
    this.assertCanWrite(fn);

    const request = await this.prisma.supervisorRequest.findFirst({
      where: { id: requestId, tenantId },
    });
    if (!request) throw new NotFoundException('Demande introuvable.');

    const schools = await this.joinedSchools(tenantId);
    const responded = await this.prisma.schoolSupervisorSubmission.findMany({
      where: { requestId, tenantId: { in: schools.map((s) => s.tenantId) } },
      select: { tenantId: true },
    });
    const respondedSet = new Set(responded.map((r) => r.tenantId));
    const targets = schools.filter((s) => !respondedSet.has(s.tenantId));

    if (targets.length === 0) {
      throw new BadRequestException(
        "Toutes les écoles rattachées ont déjà répondu à cette demande — aucun renvoi nécessaire.",
      );
    }

    const examLabel = request.examLabel ?? "l'examen";
    const noteExcerpt = (request.message ?? request.title ?? '').slice(0, 600);
    const noteSuffix = (request.message ?? request.title ?? '').length > 600 ? '…' : '';
    const deadlineTxt = request.deadline
      ? ` Répondre avant le ${new Date(request.deadline).toLocaleDateString('fr-FR')}.`
      : '';

    let notifiedSchools = 0;
    for (const school of targets) {
      const ok = await this.notifySchoolDirection(
        school.tenantId,
        {
          title: `Note circulaire (rappel) — ${request.title}`,
          body: `${patronat.name} vous rappelle sa demande de désignation d'enseignants pour ${examLabel} : « ${noteExcerpt}${noteSuffix} ». Ouvrez le module « Patronats & Examens → Gestion des surveillants » de votre espace Academia Helm pour sélectionner vos enseignants (surveillance, correction, secrétariat).${deadlineTxt}`,
          priority: 'HIGH',
          data: {
            url: '/app/federis?tab=surveillants',
            requestId: request.id,
          },
          relatedEntityType: 'SupervisorRequest',
          relatedEntityId: request.id,
        },
        'FEDERIS_SUPERVISOR_REQUEST',
      );
      if (ok) notifiedSchools++;
    }

    this.logger.log(
      `Note circulaire « ${request.title} » renvoyée — ${targets.length} école(s) destinataire(s), ${notifiedSchools} notifiée(s).`,
    );

    return {
      targetsCount: targets.length,
      notifiedSchools,
      schools: targets.map((s) => s.name),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PATRONAT — 2. Listes reçues par école + récapitulatif global
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Consultation d'une demande : listes d'enseignants reçues PAR ÉCOLE,
   * récapitulatif global (toutes écoles confondues) et centres + salles de
   * l'examen pour préparer la répartition.
   */
  async listRequestSubmissions(tenantId: string, userId: string, requestId: string) {
    await this.ensureSchema();
    const { fn } = await this.resolvePatronatContext(tenantId, userId);

    const request = await this.prisma.supervisorRequest.findFirst({
      where: { id: requestId, tenantId },
    });
    if (!request) throw new NotFoundException('Demande introuvable.');

    const schools = await this.joinedSchools(tenantId);
    const schoolNameByTenant = new Map(schools.map((s) => [s.tenantId, s.name]));

    const submissions = await this.prisma.schoolSupervisorSubmission.findMany({
      where: { requestId },
      orderBy: { submittedAt: 'desc' },
    });

    // Affectations déjà réalisées pour cette demande (par enseignant)
    const existing = await this.prisma.examSupervisor.findMany({
      where: { tenantId, requestId },
      select: {
        teacherId: true,
        centerId: true,
        roomId: true,
        post: true,
        center: { select: { id: true, name: true, code: true } },
        room: { select: { id: true, name: true, code: true } },
      },
    });
    const assignedByTeacher = new Map(existing.map((a) => [a.teacherId, a]));

    const parseTeachers = (raw: unknown): TeacherSnapshot[] =>
      Array.isArray(raw) ? (raw as TeacherSnapshot[]) : [];

    const bySchool = schools.map((school) => {
      const sub = submissions.find((s) => s.tenantId === school.tenantId);
      const teachers = sub ? parseTeachers(sub.teachers) : [];
      return {
        schoolTenantId: school.tenantId,
        schoolName: school.name,
        responded: !!sub,
        submissionId: sub?.id ?? null,
        submittedAt: sub?.submittedAt ?? null,
        teachers: teachers.map((t) => ({
          ...t,
          assigned: assignedByTeacher.get(t.id) ?? null,
        })),
      };
    });

    // Récapitulatif global : toutes les écoles confondues
    const recap = submissions.flatMap((s) =>
      parseTeachers(s.teachers).map((t) => ({
        ...t,
        submissionId: s.id,
        schoolTenantId: s.tenantId,
        schoolName: schoolNameByTenant.get(s.tenantId) ?? 'École',
        assigned: assignedByTeacher.get(t.id) ?? null,
      })),
    );

    // Centres + salles de l'examen (pour la répartition)
    // ⭐ FIX 2026-10-01 — la relation Prisma du modèle ExamCenter s'appelle
    //    `examRooms` (et non `rooms`) : l'ancien select provoquait une
    //    PrismaClientValidationError « Unknown field `rooms` » → 400 « Champ
    //    rooms » après l'envoi de la note circulaire (détail demande).
    let centers: any[] = [];
    if (request.examId) {
      const rows = await this.prisma.examCenter.findMany({
        where: { tenantId, examId: request.examId, status: 'ACTIVE' },
        select: {
          id: true,
          code: true,
          name: true,
          address: true,
          examRooms: {
            where: { status: 'AVAILABLE' },
            select: { id: true, code: true, name: true, capacity: true },
            orderBy: { code: 'asc' },
          },
        },
        orderBy: { code: 'asc' },
      });
      // Forme de réponse conservée pour le front : `rooms` (tableau).
      centers = rows.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        address: c.address,
        rooms: c.examRooms,
      }));
    }

    return {
      canManage: WRITE_EXAM_ORG.includes(fn),
      request: {
        id: request.id,
        title: request.title,
        message: request.message,
        examId: request.examId,
        examLabel: request.examLabel,
        status: request.status,
        deadline: request.deadline,
        createdAt: request.createdAt,
      },
      schoolsCount: schools.length,
      bySchool,
      recap,
      centers,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PATRONAT — 3. Répartition par centre et par salle + validation
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Validation de la répartition : chaque enseignant proposé par une école
   * est affecté à un CENTRE et à une SALLE de composition de l'examen.
   * Création des ExamSupervisor (source SCHOOL_NOMINATION) en une
   * transaction, puis notification des directions des écoles concernées.
   */
  async assignSupervisors(
    tenantId: string,
    userId: string,
    requestId: string,
    dto: AssignSupervisorsDto,
  ) {
    await this.ensureSchema();
    const { patronat, fn } = await this.resolvePatronatContext(tenantId, userId);
    this.assertCanWrite(fn);

    if (!Array.isArray(dto.assignments) || dto.assignments.length === 0) {
      throw new BadRequestException('Aucune affectation fournie.');
    }

    const request = await this.prisma.supervisorRequest.findFirst({
      where: { id: requestId, tenantId },
    });
    if (!request) throw new NotFoundException('Demande introuvable.');
    if (!request.examId) {
      throw new BadRequestException(
        'La demande n\u2019est rattachée à aucun examen — impossible de répartir par centre.',
      );
    }
    const exam = await this.getOwnedExam(tenantId, request.examId);

    // Regroupement des affectations par école (pour les notifications)
    const bySchoolTenant = new Map<string, { schoolName: string; items: string[] }>();

    // ⭐ 2026-10-01 — rôle d'encadrement associé au poste (le champ `role`
    //    historique reste alimenté pour compatibilité des registres).
    const roleByPost: Record<SupervisorPost, string> = {
      SURVEILLANCE: 'SURVEILLANT',
      CORRECTION: 'CORRECTEUR',
      SECRETARIAT: 'SECRETARIAT',
    };

    const created = await this.prisma.$transaction(async (tx) => {
      const results: any[] = [];
      for (const a of dto.assignments) {
        // ⭐ Poste : surveillance / correction / secrétariat (défaut surveillance)
        const post = normalizeSupervisorPost(a.post);

        const submission = await tx.schoolSupervisorSubmission.findFirst({
          where: { id: a.submissionId, requestId },
        });
        if (!submission) {
          throw new BadRequestException(
            `Soumission ${a.submissionId} introuvable pour cette demande.`,
          );
        }

        const teachers = Array.isArray(submission.teachers)
          ? (submission.teachers as TeacherSnapshot[])
          : [];
        const teacher = teachers.find((t) => t.id === a.teacherId);
        if (!teacher) {
          throw new BadRequestException(
            `L'enseignant ${a.teacherId} ne figure pas dans la liste envoyée par l'école.`,
          );
        }

        // Déjà affecté pour cette demande ? (nouvelle affectation = remplacement)
        await tx.examSupervisor.deleteMany({
          where: { tenantId, requestId, teacherId: a.teacherId },
        });

        // Validations centre / salle (appartenance au patronat + examen).
        // ⭐ Le centre/salle est requis UNIQUEMENT pour le poste de
        //    surveillance ; correction et secrétariat n'y sont pas assujettis.
        if (post === 'SURVEILLANCE' && !a.centerId) {
          throw new BadRequestException(
            `Le centre d'accueil est requis pour la surveillance (${teacher.firstName} ${teacher.lastName}).`,
          );
        }
        const center = a.centerId
          ? await tx.examCenter.findFirst({
              where: { id: a.centerId, tenantId, examId: request.examId! },
              select: { id: true, name: true, code: true },
            })
          : null;
        if (a.centerId && !center) {
          throw new BadRequestException(
            `Centre ${a.centerId} introuvable pour cet examen (isolation territoriale).`,
          );
        }
        let room: { id: string; name: string; code: string } | null = null;
        if (a.roomId && center) {
          const r = await tx.examRoom.findFirst({
            where: { id: a.roomId, tenantId, centerId: center.id },
            select: { id: true, name: true, code: true },
          });
          if (!r) {
            throw new BadRequestException(
              `Salle ${a.roomId} introuvable pour le centre ${center.code}.`,
            );
          }
          room = r;
        }

        const supervisor = await tx.examSupervisor.create({
          data: {
            tenantId,
            academicYearId: request.academicYearId,
            examId: request.examId!,
            centerId: center?.id ?? null,
            roomId: room?.id ?? null,
            firstName: teacher.firstName,
            lastName: teacher.lastName,
            email: teacher.email,
            phone: teacher.phone,
            role: roleByPost[post],
            post,
            status: 'ASSIGNED',
            source: 'SCHOOL_NOMINATION',
            schoolTenantId: submission.tenantId,
            teacherId: teacher.id,
            requestId,
            submissionId: submission.id,
            createdBy: userId,
          },
        });

        // Regroupement pour notification école — libellé adapté au poste
        const entry = bySchoolTenant.get(submission.tenantId) ?? {
          schoolName: '',
          items: [],
        };
        const schoolTenant = await tx.tenant.findUnique({
          where: { id: submission.tenantId },
          select: { name: true },
        });
        entry.schoolName = schoolTenant?.name ?? 'École';
        const placeTxt =
          post === 'SURVEILLANCE'
            ? ` (${center ? `centre ${center.name}` : 'centre non défini'}${room ? `, salle ${room.name}` : ''})`
            : '';
        entry.items.push(
          `${teacher.firstName} ${teacher.lastName} — ${supervisorPostLabel(post)}${placeTxt}`,
        );
        bySchoolTenant.set(submission.tenantId, entry);

        results.push(supervisor);
      }
      return results;
    });

    // Notification des directions des écoles concernées (interface admin)
    let notifiedSchools = 0;
    for (const [schoolTenantId, info] of bySchoolTenant) {
      const ok = await this.notifySchoolDirection(
        schoolTenantId,
        {
          title: `Affectation de vos enseignants surveillants — ${exam.name}`,
          body: `${patronat.name} a validé la répartition de ${info.items.length} enseignant(s) de votre établissement : ${info.items.join(' ; ')}. Ouvrez « Patronats & Examens → Gestion des surveillants » pour transmettre ces affectations à vos enseignants.`,
          priority: 'HIGH',
          data: {
            url: '/app/federis?tab=surveillants',
            requestId,
            examCode: exam.code,
            count: info.items.length,
          },
          relatedEntityType: 'SupervisorRequest',
          relatedEntityId: requestId,
        },
        'FEDERIS_SUPERVISOR_ASSIGNMENT',
      );
      if (ok) notifiedSchools++;
    }

    this.logger.log(
      `Répartition validée — ${created.length} affectation(s), ${bySchoolTenant.size} école(s), ${notifiedSchools} notifiée(s).`,
    );

    return {
      created: created.length,
      bySchool: Array.from(bySchoolTenant.entries()).map(([schoolTenantId, info]) => ({
        schoolTenantId,
        schoolName: info.schoolName,
        count: info.items.length,
      })),
      notifiedSchools,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PATRONAT — 4. Registre des surveillants affectés (ExamSupervisor)
  // ═══════════════════════════════════════════════════════════════════════

  /** Registre des surveillants de l'examen (nominations écoles + saisie manuelle). */
  async listSupervisors(tenantId: string, userId: string, examId?: string) {
    await this.ensureSchema();
    const { fn } = await this.resolvePatronatContext(tenantId, userId);

    const supervisors = await this.prisma.examSupervisor.findMany({
      where: examId ? { tenantId, examId } : { tenantId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      include: {
        center: { select: { id: true, code: true, name: true } },
        room: { select: { id: true, code: true, name: true } },
        exam: { select: { id: true, code: true, name: true, examType: true } },
      },
    });

    // Noms des écoles d'origine (nominations)
    const schoolIds = Array.from(
      new Set(supervisors.map((s) => s.schoolTenantId).filter((v): v is string => !!v)),
    );
    const schoolTenants = schoolIds.length
      ? await this.prisma.tenant.findMany({
          where: { id: { in: schoolIds } },
          select: { id: true, name: true },
        })
      : [];
    const schoolNameById = new Map(schoolTenants.map((t) => [t.id, t.name]));

    return {
      canManage: WRITE_EXAM_ORG.includes(fn),
      supervisors: supervisors.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        phone: s.phone,
        role: s.role,
        post: s.post,
        postLabel: supervisorPostLabel(s.post),
        status: s.status,
        source: s.source,
        teacherNotifiedAt: s.teacherNotifiedAt,
        assignedDate: s.assignedDate,
        schoolName: s.schoolTenantId ? (schoolNameById.get(s.schoolTenantId) ?? null) : null,
        center: s.center,
        room: s.room,
        exam: s.exam,
      })),
    };
  }

  /** Création MANUELLE d'un surveillant + affectation directe centre / salle. */
  async createSupervisor(tenantId: string, userId: string, dto: CreateSupervisorDto) {
    await this.ensureSchema();
    const { fn } = await this.resolvePatronatContext(tenantId, userId);
    this.assertCanWrite(fn);

    if (!dto.firstName?.trim() || !dto.lastName?.trim()) {
      throw new BadRequestException('Le nom et le prénom du surveillant sont requis.');
    }
    const year = await this.getActiveYear(tenantId);
    const exam = await this.getOwnedExam(tenantId, dto.examId);

    let center: { id: string; code: string; name: string } | null = null;
    if (dto.centerId) {
      center = await this.prisma.examCenter.findFirst({
        where: { id: dto.centerId, tenantId, examId: exam.id },
        select: { id: true, code: true, name: true },
      });
      if (!center) {
        throw new BadRequestException('Centre introuvable pour cet examen.');
      }
    }
    let room: { id: string; code: string; name: string } | null = null;
    if (dto.roomId && center) {
      room = await this.prisma.examRoom.findFirst({
        where: { id: dto.roomId, tenantId, centerId: center.id },
        select: { id: true, code: true, name: true },
      });
      if (!room) {
        throw new BadRequestException('Salle introuvable pour ce centre.');
      }
    }

    return this.prisma.examSupervisor.create({
      data: {
        tenantId,
        academicYearId: year.id,
        examId: exam.id,
        centerId: center?.id ?? null,
        roomId: room?.id ?? null,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: dto.email?.trim() || null,
        phone: dto.phone?.trim() || null,
        // ⭐ 2026-10-01 — poste (surveillance / correction / secrétariat) + rôle
        //    d'encadrement cohérent si le rôle n'est pas explicitement fourni.
        post: normalizeSupervisorPost(dto.post),
        role:
          dto.role?.trim() ||
          (normalizeSupervisorPost(dto.post) === 'CORRECTION'
            ? 'CORRECTEUR'
            : normalizeSupervisorPost(dto.post) === 'SECRETARIAT'
              ? 'SECRETARIAT'
              : 'SURVEILLANT'),
        status: 'ASSIGNED',
        source: 'MANUAL',
        createdBy: userId,
      },
    });
  }

  /** Modification d'une affectation (changement de centre / de salle). */
  async updateSupervisor(
    tenantId: string,
    userId: string,
    supervisorId: string,
    dto: UpdateSupervisorDto,
  ) {
    await this.ensureSchema();
    const { fn } = await this.resolvePatronatContext(tenantId, userId);
    this.assertCanWrite(fn);

    const existing = await this.prisma.examSupervisor.findFirst({
      where: { id: supervisorId, tenantId },
    });
    if (!existing) throw new NotFoundException('Surveillant introuvable.');

    const data: Record<string, unknown> = {};
    if (dto.centerId !== undefined) {
      if (dto.centerId === null || dto.centerId === '') {
        data.centerId = null;
        data.roomId = null;
      } else {
        const center = await this.prisma.examCenter.findFirst({
          where: { id: dto.centerId, tenantId, examId: existing.examId },
          select: { id: true },
        });
        if (!center) throw new BadRequestException('Centre introuvable pour cet examen.');
        data.centerId = center.id;
      }
    }
    if (dto.roomId !== undefined) {
      if (dto.roomId === null || dto.roomId === '') {
        data.roomId = null;
      } else {
        const room = await this.prisma.examRoom.findFirst({
          where: {
            id: dto.roomId,
            tenantId,
            centerId: (data.centerId as string) ?? existing.centerId ?? undefined,
          },
          select: { id: true },
        });
        if (!room) throw new BadRequestException('Salle introuvable pour ce centre.');
        data.roomId = room.id;
      }
    }
    if (dto.status) data.status = dto.status;
    if (dto.role) data.role = dto.role;

    return this.prisma.examSupervisor.update({
      where: { id: supervisorId },
      data,
    });
  }

  /** Retrait d'un surveillant du registre. */
  async removeSupervisor(tenantId: string, userId: string, supervisorId: string) {
    await this.ensureSchema();
    const { fn } = await this.resolvePatronatContext(tenantId, userId);
    this.assertCanWrite(fn);

    const existing = await this.prisma.examSupervisor.findFirst({
      where: { id: supervisorId, tenantId },
    });
    if (!existing) throw new NotFoundException('Surveillant introuvable.');

    await this.prisma.examSupervisor.delete({ where: { id: supervisorId } });
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ÉCOLE (portail Helm) — Gestion des surveillants
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Vue d'ensemble côté école : demandes ouvertes des patronats rattachés,
   * soumissions déjà envoyées et affectations reçues (enseignant → centre →
   * salle) avec leur statut de transmission à l'UI enseignant.
   */
  async getSchoolOverview(tenantId: string, userId: string, role?: string) {
    await this.ensureSchema();
    await this.resolveSchoolContext(tenantId, userId, role);

    // Patronats rattachés (JOINED) — source des demandes
    const links = await this.prisma.patronatSchool.findMany({
      where: { schoolTenantId: tenantId, status: 'JOINED' },
      select: {
        tenantId: true,
        patronat: { select: { id: true, name: true } },
      },
    });
    const patronatIds = Array.from(new Set(links.map((l) => l.tenantId)));
    const patronatNameByTenant = new Map(
      links.filter((l) => l.patronat).map((l) => [l.tenantId, l.patronat!.name]),
    );

    // Demandes ouvertes de ces patronats + toutes les demandes déjà répondues
    const requests = patronatIds.length
      ? await this.prisma.supervisorRequest.findMany({
          where: {
            tenantId: { in: patronatIds },
            OR: [{ status: 'OPEN' }, { status: 'CLOSED' }],
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
        })
      : [];

    const requestIds = requests.map((r) => r.id);
    const mySubmissions = requestIds.length
      ? await this.prisma.schoolSupervisorSubmission.findMany({
          where: { tenantId, requestId: { in: requestIds } },
        })
      : [];

    // Affectations reçues par les enseignants de l'école
    const assignments = await this.prisma.examSupervisor.findMany({
      where: { schoolTenantId: tenantId },
      orderBy: { assignedDate: 'desc' },
      include: {
        center: { select: { id: true, code: true, name: true, address: true } },
        room: { select: { id: true, code: true, name: true } },
        exam: { select: { id: true, code: true, name: true } },
      },
    });

    const parseTeachers = (raw: unknown): TeacherSnapshot[] =>
      Array.isArray(raw) ? (raw as TeacherSnapshot[]) : [];

    return {
      patronatsCount: patronatIds.length,
      requests: requests.map((r) => {
        const sub = mySubmissions.find((s) => s.requestId === r.id);
        const teachers = sub ? parseTeachers(sub.teachers) : [];
        return {
          id: r.id,
          patronatName: patronatNameByTenant.get(r.tenantId) ?? 'Patronat',
          title: r.title,
          message: r.message,
          examLabel: r.examLabel,
          status: r.status,
          deadline: r.deadline,
          createdAt: r.createdAt,
          mySubmission: sub
            ? {
                id: sub.id,
                submittedAt: sub.submittedAt,
                teachersCount: teachers.length,
                teacherIds: teachers.map((t) => t.id),
              }
            : null,
        };
      }),
      assignments: assignments.map((a) => ({
        id: a.id,
        firstName: a.firstName,
        lastName: a.lastName,
        phone: a.phone,
        email: a.email,
        exam: a.exam,
        center: a.center,
        room: a.room,
        post: a.post,
        postLabel: supervisorPostLabel(a.post),
        requestId: a.requestId,
        teacherNotifiedAt: a.teacherNotifiedAt,
        assignedDate: a.assignedDate,
      })),
    };
  }

  /** Enseignants actifs de l'école (base Teacher — pour la sélection). */
  async listTeachers(tenantId: string, userId: string, role?: string, search?: string) {
    await this.ensureSchema();
    await this.resolveSchoolContext(tenantId, userId, role);

    const teachers = await this.prisma.teacher.findMany({
      where: {
        tenantId,
        status: 'active',
        ...(search && search.trim()
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { matricule: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        matricule: true,
        phone: true,
        email: true,
        position: true,
        specialization: true,
        subject: { select: { name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 500,
    });

    return {
      teachers: teachers.map((t) => ({
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        matricule: t.matricule,
        phone: t.phone,
        email: t.email,
        subject: t.subject?.name ?? t.specialization ?? null,
      })),
    };
  }

  /**
   * Envoi de la sélection d'enseignants au patronat : la liste officielle
   * de l'école (snapshot conservé) + notification de l'équipe du patronat.
   * L'école peut renvoyer une nouvelle sélection tant que la demande est OUVERTE.
   */
  async submitNomination(
    tenantId: string,
    userId: string,
    role: string | undefined,
    requestId: string,
    dto: SubmitNominationDto,
  ) {
    await this.ensureSchema();
    const { tenant } = await this.resolveSchoolContext(tenantId, userId, role, true);

    if (!Array.isArray(dto.teacherIds) || dto.teacherIds.length === 0) {
      throw new BadRequestException('Sélectionnez au moins un enseignant à présenter.');
    }

    const request = await this.prisma.supervisorRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Demande introuvable.');
    if (request.status !== 'OPEN') {
      throw new BadRequestException(
        'Cette demande est clôturée — le patronat n\u2019accepte plus de liste.',
      );
    }

    // L'école doit être rattachée (JOINED) au patronat émetteur
    const link = await this.prisma.patronatSchool.findFirst({
      where: { tenantId: request.tenantId, schoolTenantId: tenantId, status: 'JOINED' },
      select: { id: true },
    });
    if (!link) {
      throw new ForbiddenException(
        'Votre établissement n\u2019est pas rattaché à ce patronat (statut JOINED requis).',
      );
    }

    // Les enseignants appartiennent à la base de l'école
    const teachers = await this.prisma.teacher.findMany({
      where: { id: { in: dto.teacherIds }, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        matricule: true,
        phone: true,
        email: true,
        specialization: true,
        subject: { select: { name: true } },
      },
    });
    if (teachers.length !== dto.teacherIds.length) {
      throw new BadRequestException(
        'Certains enseignants sélectionnés sont introuvables dans votre base.',
      );
    }

    const snapshot: TeacherSnapshot[] = teachers.map((t) => ({
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      matricule: t.matricule,
      phone: t.phone,
      email: t.email,
      subject: t.subject?.name ?? t.specialization ?? null,
    }));

    const submission = await this.prisma.schoolSupervisorSubmission.upsert({
      where: { tenantId_requestId: { tenantId, requestId } },
      create: {
        tenantId,
        requestId,
        teacherIds: dto.teacherIds as unknown as object,
        teachers: snapshot as unknown as object,
        status: 'SUBMITTED',
        submittedBy: userId,
      },
      update: {
        teacherIds: dto.teacherIds as unknown as object,
        teachers: snapshot as unknown as object,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedBy: userId,
      },
    });

    // Notification de l'équipe du patronat (pattern notifyPatronatTeam)
    const patronatName = await this.patronatNameByRequest(request.tenantId);
    await this.notifyPatronatTeam(
      request.tenantId,
      tenant.name,
      request.title,
      snapshot.length,
    );

    this.logger.log(
      `Liste de ${snapshot.length} surveillant(s) envoyée par ${tenant.name} pour « ${request.title} » (patronat ${patronatName}).`,
    );

    return {
      submission,
      teachersCount: snapshot.length,
    };
  }

  /**
   * Transmission d'une affectation à l'UI de l'enseignant : notification
   * in-app (résolution Teacher.email → User du même tenant, pattern Helm
   * notifyTeachersEvaluationScheduled) + horodatage teacherNotifiedAt.
   */
  async notifyTeacher(
    tenantId: string,
    userId: string,
    role: string | undefined,
    supervisorId: string,
  ) {
    await this.ensureSchema();
    await this.resolveSchoolContext(tenantId, userId, role, true);

    const supervisor = await this.prisma.examSupervisor.findFirst({
      where: { id: supervisorId, schoolTenantId: tenantId },
      include: {
        center: { select: { name: true, code: true, address: true } },
        room: { select: { name: true, code: true } },
        exam: { select: { name: true, code: true } },
      },
    });
    if (!supervisor) {
      throw new NotFoundException('Affectation introuvable pour votre établissement.');
    }

    const notified = await this.sendTeacherNotification(supervisor);

    await this.prisma.examSupervisor.update({
      where: { id: supervisorId },
      data: { teacherNotifiedAt: new Date() },
    });

    return {
      supervisorId,
      teacherName: `${supervisor.firstName} ${supervisor.lastName}`,
      notified,
    };
  }

  /** Transmission en lot : toutes les affectations pas encore notifiées. */
  async notifyAllTeachers(
    tenantId: string,
    userId: string,
    role: string | undefined,
  ) {
    await this.ensureSchema();
    await this.resolveSchoolContext(tenantId, userId, role, true);

    const pending = await this.prisma.examSupervisor.findMany({
      where: { schoolTenantId: tenantId, teacherNotifiedAt: null },
      include: {
        center: { select: { name: true, code: true, address: true } },
        room: { select: { name: true, code: true } },
        exam: { select: { name: true, code: true } },
      },
    });

    let notified = 0;
    let withoutAccount = 0;
    for (const supervisor of pending) {
      const ok = await this.sendTeacherNotification(supervisor);
      if (ok) {
        notified++;
      } else {
        withoutAccount++;
      }
      await this.prisma.examSupervisor.update({
        where: { id: supervisor.id },
        data: { teacherNotifiedAt: new Date() },
      });
    }

    return { total: pending.length, notified, withoutAccount };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Notifications
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Notification in-app de la DIRECTION d'une école (rôles de direction,
   * pattern SCHOOL_DIRECTION_ROLES du portail Helm).
   */
  private async notifySchoolDirection(
    schoolTenantId: string,
    payload: {
      title: string;
      body: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH';
      data?: any;
      relatedEntityType?: string;
      relatedEntityId?: string;
    },
    type: string,
  ): Promise<boolean> {
    const users = await this.prisma.user.findMany({
      where: { tenantId: schoolTenantId, status: 'active' },
      select: { id: true, role: true, isSuperAdmin: true },
      take: 60,
    });
    const direction = users
      .filter((u) => u.isSuperAdmin || isDirectionRole(u.role))
      .slice(0, 10);
    if (direction.length === 0) return false;

    for (const u of direction) {
      await this.notificationService
        .create({
          tenantId: schoolTenantId,
          recipientId: u.id,
          type,
          title: payload.title,
          body: payload.body,
          priority: payload.priority ?? 'MEDIUM',
          data: payload.data,
          relatedEntityType: payload.relatedEntityType,
          relatedEntityId: payload.relatedEntityId,
        })
        .catch((e) => this.logger.warn(`Notif direction école échouée : ${e.message}`));
    }
    return true;
  }

  /** Notification in-app de l'équipe du patronat (membres actifs). */
  private async notifyPatronatTeam(
    patronatTenantId: string,
    schoolName: string,
    requestTitle: string,
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
          type: 'FEDERIS_SUPERVISOR_SUBMISSION',
          title: `Surveillants proposés — ${schoolName}`,
          body: `${schoolName} vient d'envoyer sa liste de ${count} enseignant(s) surveillant(s) pour « ${requestTitle} ». Consultez la répartition par centre et par salle dans « Centres, salles & Surveillants ».`,
          priority: 'HIGH',
          data: {
            url: '/federis/centers',
            requestTitle,
            schoolName,
            count,
          },
        })
        .catch((e) => this.logger.warn(`Notif membre patronat échouée : ${e.message}`));
    }
  }

  /**
   * Notification in-app d'un enseignant affecté : résolution
   * Teacher.email → User (même tenant — pattern Helm). Retourne false si
   * l'enseignant n'a pas de compte utilisateur rattaché.
   * ⭐ 2026-10-01 — libellé adapté au POSTE (surveillance avec centre/salle,
   * correction des épreuves, secrétariat pour la saisie des notes).
   */
  private async sendTeacherNotification(supervisor: {
    teacherId: string | null;
    schoolTenantId: string | null;
    firstName: string;
    lastName: string;
    post?: string | null;
    center: { name: string; code: string; address: string | null } | null;
    room: { name: string; code: string } | null;
    exam: { name: string; code: string } | null;
  }): Promise<boolean> {
    if (!supervisor.teacherId || !supervisor.schoolTenantId) return false;

    const teacher = await this.prisma.teacher.findFirst({
      where: { id: supervisor.teacherId, tenantId: supervisor.schoolTenantId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!teacher?.email) {
      this.logger.warn(
        `Enseignant ${supervisor.teacherId} sans email — notification impossible.`,
      );
      return false;
    }

    const user = await this.prisma.user.findFirst({
      where: { email: teacher.email, tenantId: supervisor.schoolTenantId },
      select: { id: true },
    });
    if (!user) {
      this.logger.warn(
        `Aucun compte User pour l'enseignant ${teacher.email} — notification impossible.`,
      );
      return false;
    }

    const post = normalizeSupervisorPost(supervisor.post);
    const examTxt = supervisor.exam ? ` pour l'examen ${supervisor.exam.name}` : '';
    const missionTxt: Record<SupervisorPost, string> = {
      SURVEILLANCE: (() => {
        const centerTxt = supervisor.center
          ? `centre ${supervisor.center.name}${supervisor.center.address ? ` (${supervisor.center.address})` : ''}`
          : 'centre à confirmer';
        const roomTxt = supervisor.room ? `, salle ${supervisor.room.name}` : '';
        return `vous êtes désigné(e) comme surveillant${examTxt} — ${centerTxt}${roomTxt}. Veuillez vous présenter avant le début des épreuves.`;
      })(),
      CORRECTION: `vous êtes désigné(e) au poste de CORRECTION des épreuves${examTxt}. Vous participerez à la correction des copies selon le calendrier et les consignes qui vous seront communiqués par le patronat.`,
      SECRETARIAT: `vous êtes désigné(e) au poste de SECRÉTARIAT${examTxt} — saisie des notes. Vous serez chargé(e) de la saisie et de la consolidation des notes au sein du secrétariat de l'examen.`,
    };

    await this.notificationService
      .create({
        tenantId: supervisor.schoolTenantId,
        recipientId: user.id,
        type: 'FEDERIS_SUPERVISOR_ASSIGNMENT',
        title: `Affectation — ${supervisorPostLabel(post)}`,
        body: `Bonjour ${teacher.firstName} ${teacher.lastName}, ${missionTxt[post]}`,
        priority: 'HIGH',
        data: {
          examCode: supervisor.exam?.code,
          post,
          centerName: supervisor.center?.name,
          roomName: supervisor.room?.name,
        },
        relatedEntityType: 'ExamSupervisor',
        relatedEntityId: supervisor.teacherId,
      })
      .catch((e) => this.logger.warn(`Notif enseignant échouée : ${e.message}`));
    return true;
  }

  /** Nom du patronat par tenant (journalisation). */
  private async patronatNameByRequest(patronatTenantId: string): Promise<string> {
    const patronat = await this.prisma.patronat.findFirst({
      where: { tenantId: patronatTenantId },
      select: { name: true },
    });
    return patronat?.name ?? 'Patronat';
  }
}
