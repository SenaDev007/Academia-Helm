/**
 * FederisSaisieService — Saisie des notes par les SECRÉTAIRES d'examen
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ 2026-10-01 — Chaîne complète « secrétariat → saisie des notes » :
 *
 *   1. COMPTES PROVISOIRES — dès qu'un enseignant est affecté au poste de
 *      SECRÉTARIAT (module Centres, salles & Surveillants), un compte
 *      provisoire (User.role = PATRONAT_SAISIE_NOTES, tenant du patronat)
 *      est créé AUTOMATIQUEMENT. Identifiants retournés au patronat qui les
 *      transmet à l'enseignant. ⭐ Task 24 : l'identifiant est l'EMAIL RÉEL
 *      de l'enseignant (repli simulé prenom.nom@academiafederis.com, un seul
 *      compte réutilisé par enseignant). Le compte est GELÉ (suspended) après
 *      l'examen, puis SUPPRIMÉ — jamais un membre du bureau (pas de
 *      PatronatUser) : la connexion passe par user.tenantId (portail
 *      PATRONAT, pattern auth.service).
 *
 *   2. UI DU SECRÉTAIRE (/federis/saisie) — l'enseignant voit son poste
 *      (secrétariat — saisie des notes), l'examen (CEP/BEPC/BAC/CAP + session
 *      + année scolaire), le CENTRE et la SALLE attribués, puis la liste des
 *      CANDIDATS de son périmètre pour saisir leurs notes (grille candidats ×
 *      matières). La RÈGLE ÉPREUVE PRÉPARÉE s'applique aussi à lui : une
 *      matière sans épreuve préparée est verrouillée.
 *
 *   3. SUIVI TEM RÉEL (patronat) — GET /federis/exams/:examId/grades/live :
 *      par secrétaire (centre + salle), notes saisies / total, statut
 *      (à commencer / en cours / soumis), dernière activité — les
 *      soumissions sont « mises au propre » en temps réel côté patronat.
 *
 *   4. GESTION DES COMPTES (patronat) — provisionner / geler / réactiver /
 *      réinitialiser le mot de passe / supprimer le compte provisoire.
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../database/prisma.service';
import { FederisPatronatService } from './federis-patronat.service';
// ⭐ Règle épreuve préparée — même calcul que la grille patronat
// ⭐ Modèle CEP (CM/18 + CP/2 = note/20) — mêmes règles que la grille patronat
import {
  computeEpreuvePreparedMap,
  isPrimaryExamType,
  isCepPerfectionnementSubject,
  splitCepScore,
  CEP_CM_MAX,
  CEP_CP_MAX,
} from './federis-grades.service';
import {
  ALL_PATRONAT_FUNCTIONS,
  WRITE_EXAM_ORG,
  normalizePatronatFunction,
  type PatronatFunction,
} from './federis-roles';
// ⭐ 2026-10-01 — AGRÉGATION NATIONALE : périmètre (national = tous les départements)
import { FederisScopeService } from './federis-scope.service';

/** Rôle technique du compte provisoire (User.role — portail PATRONAT). */
export const SAISIE_USER_ROLE = 'PATRONAT_SAISIE_NOTES';

/** ⭐ Task 24 (2026-10-01) — Identifiant du compte de saisie : EMAIL RÉEL de
 *  l'enseignant en priorité (ExamSupervisor.email, repli Teacher.email) ; ce
 *  domaine ne sert qu'aux adresses SIMULÉES des enseignants sans email
 *  (prenom.nom@academiafederis.com) et aux replis d'unicité (email déjà pris
 *  par un compte Helm / homonyme…). */
const SAISIE_FALLBACK_EMAIL_DOMAIN = '@academiafederis.com';

// ═══════════════════════════════════════════════════════════════════════════
// DTOs (décorateurs class-validator obligatoires — ValidationPipe whitelist)
// ═══════════════════════════════════════════════════════════════════════════

/** Cellule de note (candidateId × subjectId) — même forme que la grille.
 *  ⭐ CEP : détail CM (/18) + CP (/2) ; note /20 = CM + CP. */
export class SaisieGradeCellDto {
  @IsString()
  candidateId!: string;

  @IsString()
  subjectId!: string;

  /** Note sur le barème de la matière ; null = effacement. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number | null;

  /** CEP — note de base sur 18. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(18)
  cm?: number | null;

  /** CEP — note de perfectionnement sur 2 (0 si CM < note minimale exigée). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  cp?: number | null;

  /** Candidat absent → score 0 exclu des calculs. */
  @IsOptional()
  @IsBoolean()
  isAbsent?: boolean;
}

/** LOT de cellules saisies par le secrétaire (max 2000 par lot). */
export class SaisieBulkGradesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaisieGradeCellDto)
  grades!: SaisieGradeCellDto[];
}

/** Résultat de provisionnement d'un compte provisoire. */
export interface ProvisionAccountResult {
  status: 'created' | 'exists' | 'reactivated';
  supervisorId: string;
  teacherName: string;
  login: string;
  /** Mot de passe temporaire — retourné UNE SEULE fois (création / réinit.). */
  tempPassword: string | null;
  userId: string;
  examName?: string;
  centerName?: string | null;
}

/** Affectation SECRÉTARIAT + contexte examen/centre (provisionnement saisie). */
type SaisieSupervisorContext = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  teacherId: string | null;
  createdBy: string | null;
  metadata: unknown;
  exam?: { id: string; name: string; code: string } | null;
  center?: { id: string; name: string } | null;
};

/** Génère un mot de passe temporaire lisible (sans caractères ambigus). */
function generateTempPassword(length = 10): string {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += CHARS[randomInt(CHARS.length)];
  return out;
}

/** Slug d'un nom pour l'identifiant provisoire (jean.dupont.sec.x1y2z3@…). */
function slugifyName(raw: string | null | undefined): string {
  return (raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 24);
}

/** Format d'adresse email minimal et valide (local@domaine.tld). */
function isEmail(raw: string | null | undefined): boolean {
  return (
    typeof raw === 'string' &&
    /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(raw.trim().toLowerCase())
  );
}

@Injectable()
export class FederisSaisieService {
  private readonly logger = new Logger(FederisSaisieService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patronatService: FederisPatronatService,
    private readonly scopeService: FederisScopeService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // 0. CONTEXTE PATRONAT (gestion des comptes + suivi — pattern grades)
  // ═══════════════════════════════════════════════════════════════════════

  private async resolveContext(tenantId: string, userId: string) {
    const patronat = await this.patronatService.resolvePatronat(tenantId, userId);
    const link = await this.prisma.patronatUser.findFirst({
      where: { tenantId: patronat.tenantId, userId, isActive: true },
      select: { role: true },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const fn = normalizePatronatFunction(link?.role ?? user?.role);
    return { patronat, fn };
  }

  private assertCanManage(fn: PatronatFunction): void {
    if (!WRITE_EXAM_ORG.includes(fn)) {
      throw new ForbiddenException(
        'La gestion des comptes de saisie est réservée au coordonnateur et à l\u2019organisateur du patronat.',
      );
    }
  }

  private async getOwnedExam(tenantId: string, examId: string) {
    // ⭐ 2026-10-01 — AGRÉGATION NATIONALE : l'examen peut appartenir au
    //    patronat connecté OU à l'un de ses départements (patronat national).
    const scope = await this.scopeService.resolveScope(tenantId);
    const exam = await this.prisma.nationalExam.findFirst({
      where: { id: examId, patronatId: { in: scope.scopePatronatIds } },
    });
    if (!exam) throw new NotFoundException('Examen introuvable dans votre périmètre.');
    return exam;
  }

  private async audit(
    tenantId: string,
    userId: string,
    action: string,
    resourceId: string,
    newData: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.auditLog
      .create({
        data: {
          tenantId,
          userId,
          action,
          resource: 'ExamSupervisor',
          resourceId,
          tableName: 'exam_supervisors',
          recordId: resourceId,
          newData,
        },
      })
      .catch(() => undefined);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 1. COMPTES PROVISOIRES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Crée (ou réactive) le compte provisoire de saisie d'une affectation
   * SECRÉTARIAT. Appelé AUTOMATIQUEMENT à la validation de la répartition et
   * à la création manuelle (federis-supervisors.service) + bouton
   * « Provisionner » du registre (affectations antérieures / reprise).
   */
  async provisionAccountForSupervisor(
    tenantId: string,
    supervisorId: string,
    createdBy?: string,
  ): Promise<ProvisionAccountResult> {
    const supervisor = await this.prisma.examSupervisor.findFirst({
      where: { id: supervisorId, tenantId },
      include: {
        exam: { select: { id: true, name: true, code: true } },
        center: { select: { id: true, name: true } },
      },
    });
    if (!supervisor) throw new NotFoundException('Affectation introuvable.');
    if (supervisor.post !== 'SECRETARIAT') {
      throw new BadRequestException(
        'Les comptes provisoires ne concernent que le poste de SECRÉTARIAT (saisie des notes).',
      );
    }
    const teacherName = `${supervisor.firstName} ${supervisor.lastName}`.trim();
    const md = ((supervisor.metadata ?? {}) as Record<string, any>) ?? {};

    // Compte déjà provisionné ?
    const existingId: string | null = md.provisionalAccount?.userId ?? null;
    if (existingId) {
      const existing = await this.prisma.user.findUnique({
        where: { id: existingId },
        select: { id: true, email: true, status: true },
      });
      if (existing && existing.status === 'active') {
        return {
          status: 'exists',
          supervisorId: supervisor.id,
          teacherName,
          login: existing.email,
          tempPassword: null,
          userId: existing.id,
          examName: supervisor.exam?.name,
          centerName: supervisor.center?.name ?? null,
        };
      }
      // Compte gelé → réactivation + NOUVEAU mot de passe (le patronat
      // ré-affecte l'enseignant : intention explicite de rouvrir l'accès).
      if (existing && existing.status === 'suspended') {
        const tempPassword = generateTempPassword();
        await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash: await bcrypt.hash(tempPassword, 10),
            status: 'active',
          },
        });
        await this.audit(tenantId, createdBy ?? supervisor.createdBy ?? '', 'FEDERIS_SAISIE_ACCOUNT_REACTIVATED', supervisor.id, { login: existing.email });
        return {
          status: 'reactivated',
          supervisorId: supervisor.id,
          teacherName,
          login: existing.email,
          tempPassword,
          userId: existing.id,
          examName: supervisor.exam?.name,
          centerName: supervisor.center?.name ?? null,
        };
      }
    }

    // ⭐ Task 24 — Identifiant du compte de saisie = EMAIL RÉEL de l'enseignant
    // (ExamSupervisor.email, repli Teacher.email). Sans email → adresse simulée
    // prenom.nom@academiafederis.com. Si l'adresse est déjà prise par le compte
    // de saisie du MÊME enseignant (autre examen) → RÉUTILISATION du compte (un
    // seul identifiant par enseignant) ; prise par un autre compte (Helm,
    // patronat…) → repli sur l'adresse simulée (unicité globale User.email).
    const resolved = await this.resolveSaisieAccount(tenantId, supervisor);
    if (resolved.kind === 'reuse') {
      return this.attachExistingSaisieAccount(tenantId, supervisor, resolved.user, createdBy);
    }
    const login = resolved.login;
    const tempPassword = generateTempPassword();
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: login,
        passwordHash: await bcrypt.hash(tempPassword, 10),
        firstName: supervisor.firstName,
        lastName: supervisor.lastName,
        role: SAISIE_USER_ROLE,
        status: 'active',
      },
    });
    await this.prisma.examSupervisor.update({
      where: { id: supervisor.id },
      data: {
        userId: user.id,
        metadata: {
          ...md,
          provisionalAccount: {
            userId: user.id,
            login,
            createdAt: new Date().toISOString(),
            createdBy: createdBy ?? null,
          },
        },
      },
    });
    await this.audit(tenantId, createdBy ?? supervisor.createdBy ?? '', 'FEDERIS_SAISIE_ACCOUNT_CREATED', supervisor.id, { login, userId: user.id });
    this.logger.log(`Compte provisoire de saisie créé — ${teacherName} (${login})`);
    return {
      status: 'created',
      supervisorId: supervisor.id,
      teacherName,
      login,
      tempPassword,
      userId: user.id,
      examName: supervisor.exam?.name,
      centerName: supervisor.center?.name ?? null,
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // ⭐ Task 24 — Résolution de l'identifiant du compte de saisie
  // ───────────────────────────────────────────────────────────────────────

  /** Email réel de l'enseignant : ExamSupervisor.email (copié à la nomination
   *  d'école / à la création manuelle), repli Teacher.email via teacherId.
   *  Normalisé en minuscules, format vérifié. */
  private async resolveTeacherEmail(supervisor: {
    email: string | null;
    teacherId: string | null;
  }): Promise<string | null> {
    const direct = (supervisor.email ?? '').trim().toLowerCase();
    if (isEmail(direct)) return direct;
    if (supervisor.teacherId) {
      const teacher = await this.prisma.teacher.findUnique({
        where: { id: supervisor.teacherId },
        select: { email: true },
      });
      const fromTeacher = (teacher?.email ?? '').trim().toLowerCase();
      if (isEmail(fromTeacher)) return fromTeacher;
    }
    return null;
  }

  /**
   * Résout l'identifiant (User.email) du compte de saisie :
   *   1. EMAIL RÉEL de l'enseignant s'il est libre ;
   *   2. RÉUTILISATION du compte existant si l'adresse appartient au compte
   *      de saisie du MÊME enseignant (autre examen / ré-affectation) ;
   *   3. Adresse simulée prenom.nom@academiafederis.com (enseignant sans
   *      email, ou email déjà pris par un autre compte — Helm, patronat…) ;
   *   4. Suffixe numérique (prenom.nom2@…) si la simulée est prise, puis
   *      repli déterministe prenom.nom.sec.{id}@academiafederis.com.
   */
  private async resolveSaisieAccount(
    tenantId: string,
    supervisor: SaisieSupervisorContext,
  ): Promise<
    | { kind: 'login'; login: string }
    | { kind: 'reuse'; user: { id: string; email: string; status: string } }
  > {
    const teacherEmail = await this.resolveTeacherEmail(supervisor);
    const nameBase =
      [slugifyName(supervisor.firstName), slugifyName(supervisor.lastName)]
        .filter(Boolean)
        .join('.') || 'enseignant';
    const candidates: string[] = [];
    if (teacherEmail) candidates.push(teacherEmail);
    candidates.push(`${nameBase}${SAISIE_FALLBACK_EMAIL_DOMAIN}`);

    for (const candidate of candidates) {
      const existing = await this.prisma.user.findUnique({
        where: { email: candidate },
        select: { id: true, email: true, status: true, role: true, tenantId: true },
      });
      if (!existing) return { kind: 'login', login: candidate };
      if (
        existing.role === SAISIE_USER_ROLE &&
        existing.tenantId === tenantId &&
        (await this.isSameTeacherAsAccount(supervisor, existing.id))
      ) {
        return { kind: 'reuse', user: existing };
      }
    }

    // Adresse simulée déjà prise (homonyme sans email, autre tenant…) →
    // suffixe numérique, puis repli déterministe sur l'id de l'affectation.
    for (let n = 2; n <= 25; n++) {
      const candidate = `${nameBase}${n}${SAISIE_FALLBACK_EMAIL_DOMAIN}`;
      const taken = await this.prisma.user.findUnique({
        where: { email: candidate },
        select: { id: true },
      });
      if (!taken) return { kind: 'login', login: candidate };
    }
    return {
      kind: 'login',
      login: `${nameBase}.sec.${supervisor.id}${SAISIE_FALLBACK_EMAIL_DOMAIN}`,
    };
  }

  /** Le compte de saisie existant appartient-il au MÊME enseignant ? Vérifié
   *  via une autre affectation liée à ce compte : même teacherId (nomination
   *  d'école) ou, à défaut, mêmes nom + prénom normalisés (création manuelle
   *  — un homonyme parfait resterait théoriquement possible). */
  private async isSameTeacherAsAccount(
    supervisor: { id: string; teacherId: string | null; firstName: string; lastName: string },
    accountId: string,
  ): Promise<boolean> {
    const other = await this.prisma.examSupervisor.findFirst({
      where: { userId: accountId, id: { not: supervisor.id } },
      select: { teacherId: true, firstName: true, lastName: true },
    });
    if (!other) return false;
    if (other.teacherId && supervisor.teacherId) {
      return other.teacherId === supervisor.teacherId;
    }
    return (
      slugifyName(other.firstName) === slugifyName(supervisor.firstName) &&
      slugifyName(other.lastName) === slugifyName(supervisor.lastName)
    );
  }

  /** Rattache un compte de saisie EXISTANT (même enseignant, autre examen) à
   *  cette affectation : UN SEUL identifiant par enseignant. Compte gelé →
   *  réactivation + nouveau mot de passe temporaire (retourné une seule fois). */
  private async attachExistingSaisieAccount(
    tenantId: string,
    supervisor: SaisieSupervisorContext,
    existing: { id: string; email: string; status: string },
    createdBy?: string,
  ): Promise<ProvisionAccountResult> {
    const teacherName = `${supervisor.firstName} ${supervisor.lastName}`.trim();
    const md = ((supervisor.metadata ?? {}) as Record<string, any>) ?? {};
    let tempPassword: string | null = null;
    if (existing.status === 'suspended') {
      tempPassword = generateTempPassword();
      await this.prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash: await bcrypt.hash(tempPassword, 10), status: 'active' },
      });
    }
    await this.prisma.examSupervisor.update({
      where: { id: supervisor.id },
      data: {
        userId: existing.id,
        metadata: {
          ...md,
          provisionalAccount: {
            userId: existing.id,
            login: existing.email,
            createdAt: new Date().toISOString(),
            createdBy: createdBy ?? null,
          },
        },
      },
    });
    await this.audit(
      tenantId,
      createdBy ?? supervisor.createdBy ?? '',
      tempPassword ? 'FEDERIS_SAISIE_ACCOUNT_REACTIVATED' : 'FEDERIS_SAISIE_ACCOUNT_ATTACHED',
      supervisor.id,
      { login: existing.email, reused: true },
    );
    this.logger.log(
      `Compte de saisie ${tempPassword ? 'réactivé' : 'rattaché'} — ${teacherName} (${existing.email})`,
    );
    return {
      status: tempPassword ? 'reactivated' : 'exists',
      supervisorId: supervisor.id,
      teacherName,
      login: existing.email,
      tempPassword,
      userId: existing.id,
      examName: supervisor.exam?.name,
      centerName: supervisor.center?.name ?? null,
    };
  }

  /** Hydrate les lignes du registre avec l'état du compte provisoire. */
  async hydrateAccounts(
    supervisors: Array<{ id: string; post: string; metadata?: unknown }>,
  ): Promise<Map<string, { login: string; status: string; createdAt: string | null }>> {
    const out = new Map<string, { login: string; status: string; createdAt: string | null }>();
    const pairs: Array<{ supervisorId: string; userId: string; login: string; createdAt: string | null }> = [];
    for (const s of supervisors) {
      if (s.post !== 'SECRETARIAT') continue;
      const md = ((s.metadata ?? {}) as Record<string, any>) ?? {};
      const acc = md.provisionalAccount;
      if (acc?.userId) {
        pairs.push({
          supervisorId: s.id,
          userId: acc.userId,
          login: acc.login ?? '—',
          createdAt: acc.createdAt ?? null,
        });
      }
    }
    if (pairs.length === 0) return out;
    const users = await this.prisma.user.findMany({
      where: { id: { in: pairs.map((p) => p.userId) } },
      select: { id: true, email: true, status: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));
    for (const p of pairs) {
      const u = userById.get(p.userId);
      out.set(p.supervisorId, {
        login: u?.email ?? p.login,
        status: u ? u.status : 'deleted',
        createdAt: p.createdAt,
      });
    }
    return out;
  }

  /** Provisionne en lot les affectations SECRÉTARIAT (répartition validée). */
  async provisionAccountsForSupervisors(
    tenantId: string,
    supervisorIds: string[],
    createdBy?: string,
  ): Promise<{ provisioned: ProvisionAccountResult[]; errors: Array<{ supervisorId: string; error: string }> }> {
    const provisioned: ProvisionAccountResult[] = [];
    const errors: Array<{ supervisorId: string; error: string }> = [];
    for (const id of supervisorIds) {
      try {
        provisioned.push(await this.provisionAccountForSupervisor(tenantId, id, createdBy));
      } catch (e: any) {
        errors.push({ supervisorId: id, error: e?.message ?? 'Erreur inconnue' });
      }
    }
    return { provisioned, errors };
  }

  /** Gestion du compte provisoire par le patronat :
   *  freeze (gel) · reactivate · reset-password · delete. */
  async manageAccount(
    tenantId: string,
    userId: string,
    supervisorId: string,
    action: 'freeze' | 'reactivate' | 'reset-password' | 'delete',
  ) {
    const { fn } = await this.resolveContext(tenantId, userId);
    this.assertCanManage(fn);
    const supervisor = await this.prisma.examSupervisor.findFirst({
      where: { id: supervisorId, tenantId },
    });
    if (!supervisor) throw new NotFoundException('Affectation introuvable.');
    if (supervisor.post !== 'SECRETARIAT') {
      throw new BadRequestException('Aucun compte de saisie pour ce poste.');
    }
    const md = ((supervisor.metadata ?? {}) as Record<string, any>) ?? {};
    const accountId: string | null = md.provisionalAccount?.userId ?? null;
    if (!accountId) {
      throw new NotFoundException(
        "Aucun compte provisoire associé — cliquez d'abord sur « Provisionner ».",
      );
    }
    const account = await this.prisma.user.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new NotFoundException('Compte provisoire déjà supprimé.');
    }

    if (action === 'freeze') {
      await this.prisma.user.update({ where: { id: accountId }, data: { status: 'suspended' } });
      await this.audit(tenantId, userId, 'FEDERIS_SAISIE_ACCOUNT_FROZEN', supervisorId, { login: account.email });
      return { action, status: 'suspended', login: account.email };
    }
    if (action === 'reactivate') {
      await this.prisma.user.update({ where: { id: accountId }, data: { status: 'active' } });
      await this.audit(tenantId, userId, 'FEDERIS_SAISIE_ACCOUNT_REACTIVATED', supervisorId, { login: account.email });
      return { action, status: 'active', login: account.email };
    }
    if (action === 'reset-password') {
      const tempPassword = generateTempPassword();
      await this.prisma.user.update({
        where: { id: accountId },
        data: { passwordHash: await bcrypt.hash(tempPassword, 10), status: 'active' },
      });
      await this.audit(tenantId, userId, 'FEDERIS_SAISIE_ACCOUNT_PASSWORD_RESET', supervisorId, { login: account.email });
      return { action, status: 'active', login: account.email, tempPassword };
    }
    // delete — le compte provisoire disparaît (les notes saisies restent :
    // ExamResult.enteredBy est mis à NULL par la relation optionnelle).
    await this.prisma.$transaction([
      this.prisma.examSupervisor.update({
        where: { id: supervisorId },
        data: {
          userId: null,
          metadata: { ...md, provisionalAccount: null },
        },
      }),
      this.prisma.user.delete({ where: { id: accountId } }),
    ]);
    await this.audit(tenantId, userId, 'FEDERIS_SAISIE_ACCOUNT_DELETED', supervisorId, { login: account.email });
    return { action, status: 'deleted', login: account.email };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. UI DU SECRÉTAIRE — mes affectations / saisie / soumission
  // ═══════════════════════════════════════════════════════════════════════

  /** Charge l'affectation du secrétaire connecté + vérifie la propriété. */
  private async getOwnedAssignment(tenantId: string, userId: string, supervisorId: string) {
    const supervisor = await this.prisma.examSupervisor.findFirst({
      where: { id: supervisorId, tenantId, userId, post: 'SECRETARIAT' },
      include: {
        exam: true,
        center: { select: { id: true, code: true, name: true } },
        room: { select: { id: true, code: true, name: true } },
      },
    });
    if (!supervisor) {
      throw new NotFoundException(
        "Affectation introuvable — ce compte n'est rattaché à aucune affectation de secrétariat.",
      );
    }
    return supervisor;
  }

  /** Candidats du périmètre de l'affectation (centre + salle si définie). */
  private async scopeCandidates(examId: string, centerId: string | null, roomId: string | null) {
    if (!centerId) return [];
    return this.prisma.examCandidate.findMany({
      where: { examId, centerId, ...(roomId ? { roomId } : {}) },
      orderBy: [{ tableNumber: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        matricule: true,
        anonymatCode: true,
        tableNumber: true,
      },
    });
  }

  /** Notes existantes du périmètre (avec repli isAbsent — pattern
   *  federis-grades : requête par examen, filtre JS par candidats — le
   *  paramètre tableau en raw SQL n'est pas éprouvé côté Prisma déployé). */
  private async loadResults(examId: string, candidateIds: string[]) {
    if (candidateIds.length === 0) return [];
    const scope = new Set(candidateIds);
    try {
      const rows = (await this.prisma.$queryRawUnsafe(
        `SELECT "candidateId", "subjectId", "score", "isAbsent", "status", "enteredBy", "updatedAt", "metadata"
         FROM "exam_results" WHERE "examId" = $1`,
        examId,
      )) as Array<{
        candidateId: string;
        subjectId: string;
        score: number;
        isAbsent: boolean;
        status: string;
        enteredBy: string | null;
        updatedAt: Date;
        metadata: unknown;
      }>;
      return rows.filter((r) => scope.has(r.candidateId));
    } catch {
      const rows = await this.prisma.examResult.findMany({
        where: { examId, candidateId: { in: candidateIds } },
        select: { candidateId: true, subjectId: true, score: true, status: true, updatedAt: true, metadata: true },
      });
      return rows.map((r) => ({
        ...r,
        isAbsent: false,
        enteredBy: null,
      })) as any[];
    }
  }

  /** Mes affectations de secrétariat (examens, périmètre, candidats, notes). */
  async myAssignments(tenantId: string, userId: string) {
    const supervisors = await this.prisma.examSupervisor.findMany({
      where: { tenantId, userId, post: 'SECRETARIAT' },
      orderBy: { assignedDate: 'desc' },
      include: {
        exam: { select: { id: true, code: true, name: true, examType: true, status: true, academicYearId: true } },
        center: { select: { id: true, code: true, name: true } },
        room: { select: { id: true, code: true, name: true } },
      },
    });

    // Libellés d'année scolaire (batch)
    const yearIds = Array.from(new Set(supervisors.map((s) => s.exam?.academicYearId).filter((v): v is string => !!v)));
    const years = yearIds.length
      ? await this.prisma.academicYear.findMany({ where: { id: { in: yearIds } }, select: { id: true, label: true, name: true } })
      : [];
    const yearLabelById = new Map(years.map((y) => [y.id, y.label ?? y.name ?? '']));

    const assignments = [];
    for (const s of supervisors) {
      if (!s.exam) continue;
      const [subjectsRaw, candidatesRaw] = await Promise.all([
        this.prisma.nationalExamSubject.findMany({
          where: { examId: s.exam.id },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
        }),
        this.scopeCandidates(s.exam.id, s.centerId, s.roomId),
      ]);
      const preparedMap = await computeEpreuvePreparedMap(
        this.prisma,
        tenantId,
        s.exam.academicYearId,
        s.exam.examType,
        subjectsRaw as any,
      );
      const subjects = subjectsRaw.map((sub) => ({
        id: sub.id,
        code: sub.code,
        name: sub.name,
        coefficient: sub.coefficient ?? 1,
        maxScore: sub.maxScore ?? 20,
        epreuvePrepared: preparedMap.get(sub.id)?.prepared ?? false,
        preparedSource: preparedMap.get(sub.id)?.source ?? null,
        // ⭐ CEP — note minimale exigée (porte du CP) + matière étoilée.
        passingScore: sub.passingScore ?? 10,
        perfectionnement: isCepPerfectionnementSubject(sub.code, sub.name),
      }));
      const candidateIds = candidatesRaw.map((c) => c.id);
      const results = await this.loadResults(s.exam.id, candidateIds);
      // ⭐ CEP : scission automatique des notes héritées (CM/18 + CP/2).
      const isCep = isPrimaryExamType(s.exam.examType);
      const scores = new Map<
        string,
        Record<string, { score: number; isAbsent: boolean; status: string; cm: number | null; cp: number | null }>
      >();
      for (const r of results) {
        if (!scores.has(r.candidateId)) scores.set(r.candidateId, {});
        const md = (r.metadata ?? {}) as any;
        let cm: number | null =
          md.cm !== undefined && md.cm !== null && Number.isFinite(Number(md.cm)) ? Number(md.cm) : null;
        let cp: number | null =
          md.cp !== undefined && md.cp !== null && Number.isFinite(Number(md.cp)) ? Number(md.cp) : null;
        if (isCep && !r.isAbsent && r.score != null && cm === null) {
          const split = splitCepScore(r.score);
          cm = split.cm;
          cp = split.cp;
        }
        if (!isCep) {
          cm = null;
          cp = null;
        }
        scores.get(r.candidateId)![r.subjectId] = {
          score: r.score,
          isAbsent: Boolean((r as any).isAbsent),
          status: r.status,
          cm,
          cp,
        };
      }
      const preparedCount = subjects.filter((x) => x.epreuvePrepared).length;
      const cellsTotal = candidateIds.length * preparedCount;
      const cellsEntered = results.filter((r) => subjects.find((x) => x.id === r.subjectId)?.epreuvePrepared).length;
      const cellsSubmitted = results.filter((r) => r.status === 'SUBMITTED').length;
      const lastActivityAt = results.reduce<Date | null>(
        (acc, r) => (!acc || r.updatedAt > acc ? r.updatedAt : acc),
        null,
      );
      assignments.push({
        id: s.id,
        assignedDate: s.assignedDate,
        post: 'SECRETARIAT',
        exam: {
          id: s.exam.id,
          code: s.exam.code,
          name: s.exam.name,
          examType: s.exam.examType,
          status: s.exam.status,
          academicYearLabel: yearLabelById.get(s.exam.academicYearId) ?? null,
        },
        center: s.center,
        room: s.room,
        scopeLabel: s.center
          ? `${s.center.code} — ${s.center.name}${s.room ? ` · Salle ${s.room.code}` : ' · Toutes les salles'}`
          : null,
        subjects,
        candidates: candidatesRaw.map((c) => ({
          ...c,
          scores: scores.get(c.id) ?? {},
        })),
        progress: {
          candidates: candidateIds.length,
          subjectsPrepared: preparedCount,
          cellsTotal,
          cellsEntered,
          cellsSubmitted,
          submitted: cellsEntered > 0 && cellsSubmitted >= cellsEntered,
          lastActivityAt,
        },
      });
    }

    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });
    return {
      me: {
        name: me ? `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim() : null,
        login: me?.email ?? null,
        role: SAISIE_USER_ROLE,
        functionLabel: 'Secrétaire de saisie (compte provisoire)',
      },
      assignments,
    };
  }

  /** Enregistre les notes saisies par le secrétaire (périmètre vérifié +
   *  règle épreuve préparée + verrous examen / soumission). */
  async saveGrades(
    tenantId: string,
    userId: string,
    supervisorId: string,
    dto: SaisieBulkGradesDto,
  ) {
    const s = await this.getOwnedAssignment(tenantId, userId, supervisorId);
    if (!s.centerId) {
      throw new BadRequestException(
        'Affectation sans centre — demandez au patronat de préciser le périmètre de saisie.',
      );
    }
    if (s.exam.status === 'RESULTS_PUBLISHED') {
      throw new BadRequestException(
        'Les résultats de cet examen sont publiés — la saisie des notes est verrouillée.',
      );
    }
    if (!dto.grades?.length) throw new BadRequestException('Aucune cellule transmise.');
    if (dto.grades.length > 2000) throw new BadRequestException('Trop de cellules (max 2000 par lot).');

    const [candidates, subjectsRaw] = await Promise.all([
      this.scopeCandidates(s.exam.id, s.centerId, s.roomId),
      this.prisma.nationalExamSubject.findMany({
        where: { examId: s.exam.id },
        select: { id: true, name: true, code: true, coefficient: true, maxScore: true, passingScore: true, metadata: true },
      }),
    ]);
    const candidateIds = new Set(candidates.map((c) => c.id));
    const subjectById = new Map(subjectsRaw.map((x) => [x.id, x]));

    // ⭐ RÈGLE ÉPREUVE PRÉPARÉE — même garde que la grille patronat
    const preparedMap = await computeEpreuvePreparedMap(
      this.prisma,
      tenantId,
      s.exam.academicYearId,
      s.exam.examType,
      subjectsRaw as any,
    );
    const unprepared = new Set<string>();
    for (const cell of dto.grades) {
      const subj = subjectById.get(cell.subjectId);
      if (subj && !(preparedMap.get(subj.id)?.prepared ?? false)) unprepared.add(subj.name);
    }
    if (unprepared.size > 0) {
      throw new BadRequestException(
        `Saisie refusée — notes bloquées pour ${unprepared.size} matière(s) sans épreuve préparée : ` +
          `${Array.from(unprepared).join(', ')}. Le patronat doit préparer l'épreuve (ou la marquer « déjà préparée ») pour débloquer la saisie.`,
      );
    }

    // Verrou soumission : les cellules déjà soumises ne sont plus modifiables.
    const existing = await this.loadResults(s.exam.id, Array.from(candidateIds));
    const submittedCells = new Set(
      existing.filter((r) => r.status === 'SUBMITTED').map((r) => `${r.candidateId}|${r.subjectId}`),
    );
    // ⭐ Métadonnées existantes (décisions jury éventuelles) — fusion CM/CP.
    const metaByCell = new Map<string, any>(
      existing.map((r) => [`${r.candidateId}|${r.subjectId}`, (r.metadata ?? {}) as any]),
    );
    const hitSubmitted = dto.grades.find((c) => submittedCells.has(`${c.candidateId}|${c.subjectId}`));
    if (hitSubmitted) {
      throw new BadRequestException(
        'Notes déjà soumises (verrouillées) — demandez la réouverture au patronat avant toute modification.',
      );
    }

    // Année scolaire de l'examen (clé upsert identique à la grille patronat)
    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!year) throw new BadRequestException('Aucune année scolaire active.');

    let saved = 0;
    let deleted = 0;
    let absent = 0;
    const errors: string[] = [];
    for (const cell of dto.grades) {
      const subject = subjectById.get(cell.subjectId);
      if (!candidateIds.has(cell.candidateId)) {
        errors.push('Candidat hors de votre périmètre de saisie.');
        continue;
      }
      if (!subject) {
        errors.push(`Matière inconnue : ${cell.subjectId}`);
        continue;
      }
      const isAbsent = cell.isAbsent === true;
      const scoreEmpty =
        cell.score === null || cell.score === undefined || Number.isNaN(Number(cell.score));
      const cmEmpty = cell.cm === null || cell.cm === undefined || Number.isNaN(Number(cell.cm));
      if (!isAbsent && scoreEmpty && cmEmpty) {
        const res = await this.prisma.examResult
          .deleteMany({
            where: { examId: s.exam.id, candidateId: cell.candidateId, subjectId: subject.id },
          })
          .catch(() => ({ count: 0 }));
        deleted += res.count ?? 0;
        continue;
      }
      // ⭐ CEP — CM (/18) + CP (/2) = note (/20), CP forcé à 0 sous la note
      //    minimale exigée (règle officielle — même logique que la grille
      //    patronat). Si seul `score` est transmis : scission automatique.
      const isCep = isPrimaryExamType(s.exam.examType);
      let score: number;
      let cepDetail: { cm: number; cp: number } | null = null;
      if (isCep) {
        const minRequise = subject.passingScore ?? 10;
        let cm: number;
        let cp: number;
        if (!cmEmpty) {
          cm = Math.max(0, Math.min(Number(cell.cm), CEP_CM_MAX));
          cp =
            cell.cp !== undefined && cell.cp !== null && Number.isFinite(Number(cell.cp))
              ? Math.max(0, Math.min(Number(cell.cp), CEP_CP_MAX))
              : 0;
          if (cm < minRequise) cp = 0;
        } else {
          const split = splitCepScore(isAbsent ? 0 : Number(cell.score) || 0);
          cm = split.cm;
          cp = split.cp;
        }
        cepDetail = { cm, cp };
        score = isAbsent ? 0 : Math.max(0, Math.min(Math.round((cm + cp) * 100) / 100, subject.maxScore ?? 20));
        // Fusion avec les métadonnées existantes (décisions jury conservées).
        const prevMeta = metaByCell.get(`${cell.candidateId}|${subject.id}`) ?? {};
        cepDetail = { ...prevMeta, cm, cp };
      } else {
        score = isAbsent ? 0 : Math.max(0, Math.min(Number(cell.score), subject.maxScore ?? 20));
      }
      const coefficient = subject.coefficient ?? 1;
      await this.prisma.examResult
        .upsert({
          where: {
            tenantId_academicYearId_examId_candidateId_subjectId: {
              tenantId,
              academicYearId: year.id,
              examId: s.exam.id,
              candidateId: cell.candidateId,
              subjectId: subject.id,
            },
          },
          create: {
            tenantId,
            academicYearId: year.id,
            examId: s.exam.id,
            candidateId: cell.candidateId,
            subjectId: subject.id,
            score,
            maxScore: subject.maxScore ?? 20,
            coefficient,
            weightedScore: score * coefficient,
            isAbsent,
            status: 'DRAFT',
            enteredBy: userId,
            ...(cepDetail ? { metadata: { cm: cepDetail.cm, cp: cepDetail.cp } } : {}),
          },
          update: {
            score,
            maxScore: subject.maxScore ?? 20,
            coefficient,
            weightedScore: score * coefficient,
            isAbsent,
            status: 'DRAFT',
            enteredBy: userId,
            ...(cepDetail ? { metadata: { cm: cepDetail.cm, cp: cepDetail.cp } } : {}),
          },
        })
        .catch((e: any) => {
          errors.push(`Candidat ${cell.candidateId} / ${subject.name} : ${e?.message ?? 'erreur'}`);
        });
      if (isAbsent) absent++;
      else saved++;
    }
    await this.audit(tenantId, userId, 'FEDERIS_SAISIE_GRADES_BULK', s.exam.id, {
      supervisorId,
      saved,
      deleted,
      absent,
    });
    return { saved, deleted, absent, errors };
  }

  /** Soumet la saisie du secrétaire : ses lignes DRAFT → SUBMITTED. */
  async submitAssignment(tenantId: string, userId: string, supervisorId: string) {
    const s = await this.getOwnedAssignment(tenantId, userId, supervisorId);
    if (!s.centerId) throw new BadRequestException('Affectation sans périmètre de saisie.');
    if (s.exam.status === 'RESULTS_PUBLISHED') {
      throw new BadRequestException('Résultats publiés — soumission impossible.');
    }
    const candidates = await this.scopeCandidates(s.exam.id, s.centerId, s.roomId);
    const candidateIds = candidates.map((c) => c.id);
    if (candidateIds.length === 0) {
      throw new BadRequestException('Aucun candidat dans votre périmètre de saisie.');
    }
    const res = await this.prisma.examResult.updateMany({
      where: { examId: s.exam.id, candidateId: { in: candidateIds }, status: 'DRAFT' },
      data: { status: 'SUBMITTED' },
    });
    await this.audit(tenantId, userId, 'FEDERIS_SAISIE_SUBMITTED', s.exam.id, {
      supervisorId,
      submitted: res.count,
    });
    return { submitted: res.count };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. SUIVI TEMPS RÉEL (patronat)
  // ═══════════════════════════════════════════════════════════════════════

  /** État live de la saisie : par secrétaire (centre + salle), progression,
   *  statut, dernière activité + activité récente nominative. */
  async getLive(tenantId: string, userId: string, examId: string) {
    const { fn } = await this.resolveContext(tenantId, userId);
    if (!ALL_PATRONAT_FUNCTIONS.includes(fn)) {
      throw new ForbiddenException('Accès réservé aux membres du patronat.');
    }
    const exam = await this.getOwnedExam(tenantId, examId);

    const [supervisors, subjectsRaw, candidatesRaw] = await Promise.all([
      this.prisma.examSupervisor.findMany({
        where: { tenantId, examId: exam.id, post: 'SECRETARIAT' },
        orderBy: [{ centerId: 'asc' }, { lastName: 'asc' }],
        include: {
          center: { select: { id: true, code: true, name: true } },
          room: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.nationalExamSubject.findMany({
        where: { examId: exam.id },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.examCandidate.findMany({
        where: { examId: exam.id },
        select: { id: true, centerId: true, roomId: true, firstName: true, lastName: true, tableNumber: true },
      }),
    ]);

    const preparedMap = await computeEpreuvePreparedMap(
      this.prisma,
      tenantId,
      exam.academicYearId,
      exam.examType,
      subjectsRaw as any,
    );
    const subjects = subjectsRaw.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      epreuvePrepared: preparedMap.get(s.id)?.prepared ?? false,
    }));
    const preparedSubjects = subjects.filter((s) => s.epreuvePrepared);

    const results = await this.loadResults(exam.id, candidatesRaw.map((c) => c.id));
    const accounts = await this.hydrateAccounts(supervisors);

    // Périmètre par affectation + progression
    const candById = new Map(candidatesRaw.map((c) => [c.id, c]));
    const assignments = supervisors.map((s) => {
      const scope = candidatesRaw.filter(
        (c) => c.centerId === s.centerId && (!s.roomId || c.roomId === s.roomId),
      );
      const scopeIds = new Set(scope.map((c) => c.id));
      const cells = results.filter((r) => scopeIds.has(r.candidateId));
      const entered = cells.filter((r) => preparedSubjects.some((ps) => ps.id === r.subjectId)).length;
      const submitted = cells.filter((r) => r.status === 'SUBMITTED').length;
      const cellsTotal = scope.length * preparedSubjects.length;
      const lastActivityAt = cells.reduce<Date | null>(
        (acc, r) => (!acc || r.updatedAt > acc ? r.updatedAt : acc),
        null,
      );
      const account = accounts.get(s.id) ?? null;
      const status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' =
        entered === 0 ? 'NOT_STARTED' : submitted >= entered ? 'SUBMITTED' : 'IN_PROGRESS';
      return {
        id: s.id,
        teacherName: `${s.firstName} ${s.lastName}`,
        phone: s.phone,
        schoolTenantId: s.schoolTenantId,
        center: s.center ? { id: s.center.id, code: s.center.code, name: s.center.name } : null,
        room: s.room ? { id: s.room.id, code: s.room.code, name: s.room.name } : null,
        scopeCandidates: scope.length,
        cellsTotal,
        cellsEntered: entered,
        cellsSubmitted: submitted,
        lastActivityAt,
        status,
        account,
      };
    });

    // Activité récente (20 dernières lignes modifiées, nominatives)
    const entererIds = Array.from(new Set(results.map((r) => (r as any).enteredBy).filter((v): v is string => !!v)));
    const enterers = entererIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: entererIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const entererName = new Map(
      enterers.map((u) => [u.id, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()]),
    );
    const subjectById = new Map(subjectsRaw.map((s) => [s.id, s.name]));
    const recentActivity = [...results]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 20)
      .map((r) => {
        const c = candById.get(r.candidateId);
        return {
          candidateName: c ? `${c.firstName} ${c.lastName}` : '—',
          tableNumber: c?.tableNumber ?? null,
          subjectName: subjectById.get(r.subjectId) ?? '—',
          score: r.score,
          isAbsent: Boolean((r as any).isAbsent),
          status: r.status,
          by: (r as any).enteredBy ? entererName.get((r as any).enteredBy) ?? '—' : 'Patronat',
          at: r.updatedAt,
        };
      });

    const globalCellsTotal = candidatesRaw.length * preparedSubjects.length;
    return {
      exam: { id: exam.id, code: exam.code, name: exam.name, examType: exam.examType, status: exam.status },
      subjects,
      assignments,
      recentActivity,
      global: {
        candidates: candidatesRaw.length,
        subjectsPrepared: preparedSubjects.length,
        cellsTotal: globalCellsTotal,
        cellsEntered: results.filter((r) => preparedSubjects.some((ps) => ps.id === r.subjectId)).length,
        cellsSubmitted: results.filter((r) => r.status === 'SUBMITTED').length,
        secretaries: supervisors.length,
      },
    };
  }
}
