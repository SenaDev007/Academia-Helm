/**
 * FederisDeliberationService — Workflow délibération → publication → notifications
 * ═══════════════════════════════════════════════════════════════════════════
 * Academia Federis (cahier des charges §9-10 + règle « délibération obligatoire
 * avant publication »).
 *
 * Chaîne opérationnelle complète :
 *   1. Saisie des notes       POST /federis/exams/:examId/results/bulk
 *      (upsert ExamResult par candidat × matière — statut DRAFT)
 *   2. État de préparation    GET  /federis/exams/:examId/deliberation
 *      (matières, couverture des notes, candidats complets/partiels/sans notes)
 *   3. Simulation             POST /federis/exams/:examId/deliberation/simulate
 *      (calcul des moyennes pondérées SANS écriture — aperçu de la distribution)
 *   4. Délibération           POST /federis/exams/:examId/deliberation
 *      (jury : moyennes → ADMIS / AJOURNÉ + cas limites ExamDeliberationCase
 *       PENDING ; notes verrouillées VALIDATED ; examen → DELIBERATED)
 *   5. Décision des cas       POST /federis/deliberations/:id/cases/:caseId
 *      (APPROVED → ADMIS | REJECTED → AJOURNÉ, avec motif)
 *   6. Clôture                POST /federis/deliberations/:id/close
 *      (tous les cas tranchés → COMPLETED, compteurs + taux de réussite finaux)
 *   7. Publication            POST /federis/deliberations/:id/publish
 *      (résultats → PUBLISHED + mention, examen → RESULTS_PUBLISHED,
 *       NOTIFICATIONS PARENTS via Academia Helm — matching élève → tuteurs →
 *       comptes parents — + notification des équipes des écoles)
 *   8. Consultation           GET  /federis/exams/:examId/results
 *      (résultats publiés — alimente aussi le miroir offline)
 *
 * Règles transverses :
 *   - NO ACADEMIC YEAR = NO DATA ; jamais de suppression physique
 *   - Délibération = coordonnateur / secrétaire / organisateur ;
 *     PUBLICATION = coordonnateur uniquement (validation humaine §Sécurité)
 *   - AuditLog sur chaque mutation + traçabilité publishedBy/publishedAt
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
import { FederisPatronatService } from './federis-patronat.service';
import {
  ALL_PATRONAT_FUNCTIONS,
  WRITE_DELIBERATION,
  PUBLISH_RESULTS,
  normalizePatronatFunction,
  type PatronatFunction,
} from './federis-roles';

// ── DTO ─────────────────────────────────────────────────────────────────────

export class BulkResultsDto {
  /** Lignes de notes : [{ matricule, subjectCode, score }] */
  rows!: { matricule: string; subjectCode: string; score: number }[];
}

export class SimulateDeliberationDto {
  /** Moyenne d'admission (défaut 10/20). */
  passMark?: number;
  /** Seuil de rachat — cas limites soumis au jury (défaut 9.5/20). */
  rescueMark?: number;
}

export class RunDeliberationDto {
  juryName!: string;
  passMark?: number;
  rescueMark?: number;
}

export class DecideCaseDto {
  /** APPROVED → admis sur délibération | REJECTED → ajourné. */
  decision!: 'APPROVED' | 'REJECTED';
  comments?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Mention nationale (barème standard). */
function mentionFor(average: number): string {
  if (average >= 16) return 'Excellent';
  if (average >= 14) return 'Très Bien';
  if (average >= 12) return 'Bien';
  if (average >= 10) return 'Assez Bien';
  return 'Passable';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Normalisation insensible à la casse/accents pour le matching élève ↔ candidat. */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Rôles des équipes d'école à notifier lors d'une publication. */
const SCHOOL_STAFF_ROLES = [
  'DIRECTOR',
  'DIRECTRICE',
  'DIRECTEUR',
  'PROVISEUR',
  'DIRECTEUR_ADJOINT',
  'SECRETAIRE',
  'SECRETAIRE_COMPTABLE',
];

@Injectable()
export class FederisDeliberationService {
  private readonly logger = new Logger(FederisDeliberationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patronatService: FederisPatronatService,
    private readonly notificationService: NotificationService,
  ) {}

  // ── Contexte & permissions ───────────────────────────────────────────────

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

  private assertRead(fn: PatronatFunction): void {
    if (!ALL_PATRONAT_FUNCTIONS.includes(fn)) {
      throw new ForbiddenException('Accès réservé aux membres du patronat.');
    }
  }

  private assertDeliberation(fn: PatronatFunction): void {
    if (!WRITE_DELIBERATION.includes(fn)) {
      throw new ForbiddenException(
        'La délibération est réservée au coordonnateur, au secrétaire et à l\u2019organisateur.',
      );
    }
  }

  private assertPublish(fn: PatronatFunction): void {
    if (!PUBLISH_RESULTS.includes(fn)) {
      throw new ForbiddenException(
        'La publication officielle des résultats est réservée au coordonnateur (validation humaine).',
      );
    }
  }

  private async getOwnedExam(patronatTenantId: string, examId: string) {
    const exam = await this.prisma.nationalExam.findFirst({
      where: { id: examId, tenantId: patronatTenantId },
      include: { subjects: { orderBy: { order: 'asc' } } },
    });
    if (!exam) throw new NotFoundException('Examen introuvable dans votre périmètre.');
    return exam;
  }

  // ── 1. Saisie des notes (upsert par candidat × matière) ───────────────────

  async bulkUpsertResults(
    tenantId: string,
    userId: string,
    examId: string,
    dto: BulkResultsDto,
  ) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertDeliberation(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    if (exam.status === 'RESULTS_PUBLISHED') {
      throw new BadRequestException(
        'Les résultats de cet examen sont déjà publiés — la saisie des notes est verrouillée.',
      );
    }

    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId: patronat.tenantId, isActive: true },
    });
    if (!year) {
      throw new BadRequestException('Aucune année scolaire active (NO ACADEMIC YEAR = NO DATA).');
    }

    if (!dto.rows?.length) {
      throw new BadRequestException('Aucune ligne de note transmise.');
    }
    if (dto.rows.length > 5000) {
      throw new BadRequestException('Trop de lignes (max 5000 par lot).');
    }

    // Index candidats par matricule + matières par code
    const candidates = await this.prisma.examCandidate.findMany({
      where: { examId, tenantId: patronat.tenantId },
      select: { id: true, matricule: true },
    });
    const candidateByMatricule = new Map(candidates.map((c) => [c.matricule, c.id]));
    const subjectByCode = new Map(exam.subjects.map((s) => [s.code, s]));

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of dto.rows) {
      const candidateId = candidateByMatricule.get(row.matricule?.trim());
      const subject = subjectByCode.get(row.subjectCode?.trim());
      if (!candidateId) {
        errors.push(`Matricule inconnu : ${row.matricule}`);
        continue;
      }
      if (!subject) {
        errors.push(`Matière inconnue : ${row.subjectCode}`);
        continue;
      }
      if (row.score === null || row.score === undefined || Number.isNaN(Number(row.score))) {
        errors.push(`Note invalide pour ${row.matricule} / ${row.subjectCode}`);
        continue;
      }
      const score = Math.max(0, Math.min(Number(row.score), subject.maxScore ?? 20));
      const coefficient = subject.coefficient ?? 1;
      const data = {
        score,
        coefficient,
        weightedScore: round2(score * coefficient),
        enteredBy: userId,
        status: 'DRAFT',
      };
      const res = await this.prisma.examResult.upsert({
        where: {
          tenantId_academicYearId_examId_candidateId_subjectId: {
            tenantId: patronat.tenantId,
            academicYearId: year.id,
            examId,
            candidateId,
            subjectId: subject.id,
          },
        },
        create: {
          tenantId: patronat.tenantId,
          academicYearId: year.id,
          examId,
          candidateId,
          subjectId: subject.id,
          maxScore: subject.maxScore ?? 20,
          ...data,
        },
        update: {
          ...data,
          // Une nouvelle saisie rouvre le brouillon (délibération précédente invalidée)
          validatedBy: null,
          validatedAt: null,
        },
      });
      if (res) {
        const existing = await this.prisma.examResult.count({
          where: { examId, candidateId, subjectId: subject.id, createdAt: { lt: res.createdAt } },
        });
        if (existing > 0) updated++;
        else created++;
      }
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_RESULTS_BULK_UPSERT',
        resource: 'NationalExam',
        resourceId: examId,
        tableName: 'exam_results',
        recordId: examId,
        newData: {
          examCode: exam.code,
          received: dto.rows.length,
          created,
          updated,
          errors: errors.length,
        },
      },
    }).catch(() => undefined);

    return {
      received: dto.rows.length,
      created,
      updated,
      errors: errors.slice(0, 50),
      errorCount: errors.length,
    };
  }

  // ── 2. État de préparation de la délibération ─────────────────────────────

  async getDeliberationState(tenantId: string, userId: string, examId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    const [candidates, results, deliberations] = await Promise.all([
      this.prisma.examCandidate.findMany({
        where: { examId },
        select: { id: true },
      }),
      this.prisma.examResult.findMany({
        where: { examId },
        select: { candidateId: true, subjectId: true, score: true, status: true },
      }),
      this.prisma.examDeliberation.findMany({
        where: { examId },
        include: { cases: { include: { candidate: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const subjectIds = new Set(exam.subjects.map((s) => s.id));
    const scoresByCandidate = new Map<string, Set<string>>();
    for (const r of results) {
      if (!scoresByCandidate.has(r.candidateId)) {
        scoresByCandidate.set(r.candidateId, new Set());
      }
      if (subjectIds.has(r.subjectId)) {
        scoresByCandidate.get(r.candidateId)!.add(r.subjectId);
      }
    }

    let complete = 0;
    let partial = 0;
    let missing = 0;
    for (const c of candidates) {
      const covered = scoresByCandidate.get(c.id)?.size ?? 0;
      if (exam.subjects.length > 0 && covered >= exam.subjects.length) complete++;
      else if (covered > 0) partial++;
      else missing++;
    }

    return {
      exam: {
        id: exam.id,
        code: exam.code,
        name: exam.name,
        level: exam.level,
        status: exam.status,
        candidatesCount: candidates.length,
      },
      subjects: exam.subjects.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        coefficient: s.coefficient,
        maxScore: s.maxScore,
        passingScore: s.passingScore,
      })),
      readiness: {
        totalCandidates: candidates.length,
        complete,
        partial,
        missing,
        resultsEntered: results.length,
        totalExpected: candidates.length * exam.subjects.length,
      },
      deliberations: deliberations.map((d) => ({
        id: d.id,
        juryName: d.juryName,
        deliberatedAt: d.deliberatedAt,
        status: d.status,
        totalCandidates: d.totalCandidates,
        passedCount: d.passedCount,
        failedCount: d.failedCount,
        successRate: d.successRate,
        thresholds: (d.metadata as any)?.thresholds ?? null,
        publication: (d.metadata as any)?.publication ?? null,
        pendingCases: d.cases.filter((c) => c.decision === 'PENDING').length,
        cases: d.cases.map((c) => ({
          id: c.id,
          reason: c.reason,
          decision: c.decision,
          comments: c.comments,
          candidate: {
            id: c.candidateId,
            matricule: c.candidate.matricule,
            firstName: c.candidate.firstName,
            lastName: c.candidate.lastName,
          },
          average: (c.metadata as any)?.average ?? null,
        })),
      })),
    };
  }

  // ── 3-4. Calcul des moyennes (partagé simulation / délibération) ──────────

  /** Calcule la moyenne pondérée de chaque candidat + la décision proposée. */
  private async computeAverages(patronatTenantId: string, examId: string) {
    const exam = await this.getOwnedExam(patronatTenantId, examId);
    const [candidates, results] = await Promise.all([
      this.prisma.examCandidate.findMany({
        where: { examId },
        select: { id: true, matricule: true, firstName: true, lastName: true },
      }),
      this.prisma.examResult.findMany({
        where: { examId },
        select: { candidateId: true, subjectId: true, score: true, coefficient: true },
      }),
    ]);

    const subjectIds = new Set(exam.subjects.map((s) => s.id));
    const coefBySubject = new Map(exam.subjects.map((s) => [s.id, s.coefficient ?? 1]));
    const byCandidate = new Map<string, { sum: number; coef: number; subjects: Set<string> }>();
    for (const r of results) {
      if (!subjectIds.has(r.subjectId)) continue;
      if (!byCandidate.has(r.candidateId)) {
        byCandidate.set(r.candidateId, { sum: 0, coef: 0, subjects: new Set() });
      }
      const acc = byCandidate.get(r.candidateId)!;
      const coef = r.coefficient ?? coefBySubject.get(r.subjectId) ?? 1;
      acc.sum += r.score * coef;
      acc.coef += coef;
      acc.subjects.add(r.subjectId);
    }

    const rows = candidates.map((c) => {
      const acc = byCandidate.get(c.id);
      const covered = acc?.subjects.size ?? 0;
      const average = acc && acc.coef > 0 ? round2(acc.sum / acc.coef) : null;
      return {
        candidateId: c.id,
        matricule: c.matricule,
        firstName: c.firstName,
        lastName: c.lastName,
        subjectsCovered: covered,
        subjectsTotal: exam.subjects.length,
        complete: exam.subjects.length > 0 && covered >= exam.subjects.length,
        average,
      };
    });
    return { exam, rows };
  }

  /** Distribution simulée — SANS aucune écriture. */
  async simulate(
    tenantId: string,
    userId: string,
    examId: string,
    dto: SimulateDeliberationDto,
  ) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const passMark = dto.passMark ?? 10;
    const rescueMark = dto.rescueMark ?? 9.5;
    if (rescueMark >= passMark) {
      throw new BadRequestException('Le seuil de rachat doit être inférieur à la moyenne d\u2019admission.');
    }

    const { rows } = await this.computeAverages(patronat.tenantId, examId);
    let admitted = 0;
    let rescue = 0;
    let failed = 0;
    let incomplete = 0;
    const mentions = { Excellent: 0, 'Très Bien': 0, Bien: 0, 'Assez Bien': 0, Passable: 0 };

    for (const r of rows) {
      if (!r.complete || r.average === null) {
        incomplete++;
        continue;
      }
      if (r.average >= passMark) {
        admitted++;
        mentions[mentionFor(r.average) as keyof typeof mentions]++;
      } else if (r.average >= rescueMark) {
        rescue++;
      } else {
        failed++;
      }
    }

    const decided = admitted + rescue + failed;
    return {
      thresholds: { passMark, rescueMark },
      distribution: {
        admitted,
        rescuePending: rescue,
        failed,
        incomplete,
        total: rows.length,
        decided,
      },
      successRate: decided > 0 ? round2(((admitted + rescue * 0.5) / decided) * 100) : 0,
      mentions,
      /** Échantillon des cas limites (max 20) pour préparer le jury. */
      rescueSample: rows
        .filter((r) => r.average !== null && r.average >= rescueMark && r.average < passMark)
        .slice(0, 20)
        .map((r) => ({
          matricule: r.matricule,
          name: `${r.firstName} ${r.lastName}`,
          average: r.average,
        })),
    };
  }

  /** Délibération officielle — écrit les décisions + ouvre les cas limites. */
  async runDeliberation(tenantId: string, userId: string, examId: string, dto: RunDeliberationDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertDeliberation(fn);
    const { exam, rows } = await this.computeAverages(patronat.tenantId, examId);
    if (exam.status === 'RESULTS_PUBLISHED') {
      throw new BadRequestException('Les résultats sont déjà publiés — délibération close.');
    }
    if (exam.subjects.length === 0) {
      throw new BadRequestException('Aucune matière définie pour cet examen.');
    }
    if (!dto.juryName?.trim()) {
      throw new BadRequestException('Le nom du jury est requis.');
    }
    const passMark = dto.passMark ?? 10;
    const rescueMark = dto.rescueMark ?? 9.5;
    if (rescueMark >= passMark) {
      throw new BadRequestException('Le seuil de rachat doit être inférieur à la moyenne d\u2019admission.');
    }

    // Uniquement les candidats avec un dossier de notes COMPLET sont délibérés
    const complete = rows.filter((r) => r.complete && r.average !== null);
    if (complete.length === 0) {
      throw new BadRequestException(
        'Aucun candidat ne dispose de notes complètes sur toutes les matières.',
      );
    }

    let passedCount = 0;
    let failedCount = 0;
    const caseRows: {
      candidateId: string;
      reason: string;
      average: number;
    }[] = [];

    for (const r of complete) {
      const avg = r.average as number;
      if (avg >= passMark) {
        passedCount++;
      } else if (avg >= rescueMark) {
        caseRows.push({
          candidateId: r.candidateId,
          reason: `Moyenne ${avg}/20 comprise entre le seuil de rachat (${rescueMark}) et la moyenne d\u2019admission (${passMark})`,
          average: avg,
        });
      } else {
        failedCount++;
      }
    }

    // Transaction : délibération + cas + verrouillage des notes + statut examen
    const deliberation = await this.prisma.$transaction(async (tx) => {
      const d = await tx.examDeliberation.create({
        data: {
          tenantId: patronat.tenantId,
          examId,
          juryName: dto.juryName.trim(),
          deliberatedAt: new Date(),
          totalCandidates: complete.length,
          passedCount,
          failedCount,
          successRate: complete.length > 0 ? round2((passedCount / complete.length) * 100) : 0,
          status: caseRows.length > 0 ? 'IN_PROGRESS' : 'COMPLETED',
          metadata: {
            thresholds: { passMark, rescueMark },
            incompleteCandidates: rows.length - complete.length,
            createdBy: userId,
          },
        },
      });

      // Cas limites soumis au jury (décision PENDING)
      if (caseRows.length > 0) {
        await tx.examDeliberationCase.createMany({
          data: caseRows.map((c) => ({
            tenantId: patronat.tenantId,
            deliberationId: d.id,
            candidateId: c.candidateId,
            reason: c.reason,
            decision: 'PENDING',
            metadata: { average: c.average },
          })),
        });
      }

      // Verrouillage des notes : statut VALIDATED (cahier des charges :
      // « notes validées verrouillées »)
      await tx.examResult.updateMany({
        where: { examId, tenantId: patronat.tenantId },
        data: { status: 'VALIDATED', validatedBy: userId, validatedAt: new Date() },
      });

      // L'examen passe en phase délibérée (les cas restants n'empêchent pas
      // l'avancement — ils sont tranchés avant la clôture)
      await tx.nationalExam.update({
        where: { id: examId },
        data: { status: 'DELIBERATED' },
      });

      return d;
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_DELIBERATION_RUN',
        resource: 'ExamDeliberation',
        resourceId: deliberation.id,
        tableName: 'exam_deliberations',
        recordId: deliberation.id,
        newData: {
          examCode: exam.code,
          juryName: dto.juryName,
          passMark,
          rescueMark,
          total: complete.length,
          passed: passedCount,
          failed: failedCount,
          pendingCases: caseRows.length,
        },
      },
    }).catch(() => undefined);

    return {
      deliberationId: deliberation.id,
      status: deliberation.status,
      juryName: deliberation.juryName,
      thresholds: { passMark, rescueMark },
      totalCandidates: complete.length,
      passedCount,
      failedCount,
      pendingCases: caseRows.length,
      incompleteCandidates: rows.length - complete.length,
      successRate: deliberation.successRate,
    };
  }

  // ── 5. Décision d'un cas limite (jury) ────────────────────────────────────

  async decideCase(
    tenantId: string,
    userId: string,
    deliberationId: string,
    caseId: string,
    dto: DecideCaseDto,
  ) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertDeliberation(fn);

    const deliberation = await this.prisma.examDeliberation.findFirst({
      where: { id: deliberationId, tenantId: patronat.tenantId },
    });
    if (!deliberation) throw new NotFoundException('Délibération introuvable.');
    if (deliberation.status === 'COMPLETED' || deliberation.status === 'PUBLISHED') {
      throw new BadRequestException('Cette délibération est clôturée — les décisions sont figées.');
    }
    if (dto.decision !== 'APPROVED' && dto.decision !== 'REJECTED') {
      throw new BadRequestException('Décision invalide (APPROVED ou REJECTED).');
    }

    const kase = await this.prisma.examDeliberationCase.findFirst({
      where: { id: caseId, deliberationId },
      include: { candidate: true },
    });
    if (!kase) throw new NotFoundException('Cas de délibération introuvable.');
    if (kase.decision !== 'PENDING') {
      throw new BadRequestException('Ce cas a déjà été tranché.');
    }

    const updated = await this.prisma.examDeliberationCase.update({
      where: { id: caseId },
      data: {
        decision: dto.decision,
        comments: dto.comments ?? null,
        metadata: {
          ...(kase.metadata as any),
          decidedBy: userId,
          decidedAt: new Date().toISOString(),
        },
      },
    });

    // Recalcul immédiat des compteurs
    await this.refreshCounts(patronat.tenantId, deliberationId);

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_DELIBERATION_CASE_DECIDED',
        resource: 'ExamDeliberationCase',
        resourceId: caseId,
        tableName: 'exam_deliberation_cases',
        recordId: caseId,
        newData: {
          deliberationId,
          candidate: `${kase.candidate.firstName} ${kase.candidate.lastName}`,
          decision: dto.decision,
          comments: dto.comments ?? null,
        },
      },
    }).catch(() => undefined);

    return {
      caseId: updated.id,
      decision: updated.decision,
      candidate: `${kase.candidate.firstName} ${kase.candidate.lastName}`,
    };
  }

  /** Recalcule les compteurs admis/ajournés en fonction des cas tranchés. */
  private async refreshCounts(patronatTenantId: string, deliberationId: string) {
    const d = await this.prisma.examDeliberation.findUnique({
      where: { id: deliberationId },
      include: { cases: true },
    });
    if (!d) return;
    const approved = d.cases.filter((c) => c.decision === 'APPROVED').length;
    const rejected = d.cases.filter((c) => c.decision === 'REJECTED').length;
    const pending = d.cases.filter((c) => c.decision === 'PENDING').length;
    const passed = d.passedCount + approved;
    const failed = d.failedCount + rejected;
    const total = passed + failed + pending;
    await this.prisma.examDeliberation.update({
      where: { id: deliberationId },
      data: {
        passedCount: passed,
        failedCount: failed,
        successRate: passed + failed > 0 ? round2((passed / (passed + failed)) * 100) : 0,
        status:
          d.status === 'PUBLISHED'
            ? 'PUBLISHED'
            : total > 0 && pending === 0
              ? 'COMPLETED'
              : 'IN_PROGRESS',
      },
    });
  }

  // ── 6. Clôture de la délibération ─────────────────────────────────────────

  async closeDeliberation(tenantId: string, userId: string, deliberationId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertDeliberation(fn);

    const d = await this.prisma.examDeliberation.findFirst({
      where: { id: deliberationId, tenantId: patronat.tenantId },
      include: { cases: true, exam: true },
    });
    if (!d) throw new NotFoundException('Délibération introuvable.');
    if (d.status === 'PUBLISHED') {
      throw new BadRequestException('Délibération déjà publiée.');
    }

    const pending = d.cases.filter((c) => c.decision === 'PENDING');
    if (pending.length > 0) {
      throw new BadRequestException(
        `${pending.length} cas(s) limite(s) restent à trancher avant la clôture.`,
      );
    }

    await this.refreshCounts(patronat.tenantId, deliberationId);
    const closed = await this.prisma.examDeliberation.update({
      where: { id: deliberationId },
      data: {
        status: 'COMPLETED',
        metadata: {
          ...(d.metadata as any),
          closedBy: userId,
          closedAt: new Date().toISOString(),
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_DELIBERATION_CLOSED',
        resource: 'ExamDeliberation',
        resourceId: deliberationId,
        tableName: 'exam_deliberations',
        recordId: deliberationId,
        newData: {
          examCode: d.exam.code,
          passed: closed.passedCount,
          failed: closed.failedCount,
        },
      },
    }).catch(() => undefined);

    return {
      deliberationId: closed.id,
      status: closed.status,
      passedCount: closed.passedCount,
      failedCount: closed.failedCount,
      successRate: closed.successRate,
    };
  }

  // ── 7. PUBLICATION + NOTIFICATIONS PARENTS (via Academia Helm) ────────────

  async publishResults(tenantId: string, userId: string, deliberationId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertPublish(fn);

    const d = await this.prisma.examDeliberation.findFirst({
      where: { id: deliberationId, tenantId: patronat.tenantId },
      include: { cases: true, exam: true },
    });
    if (!d) throw new NotFoundException('Délibération introuvable.');
    if (d.status === 'PUBLISHED') {
      throw new BadRequestException('Cette délibération est déjà publiée.');
    }
    if (d.status !== 'COMPLETED') {
      throw new BadRequestException(
        'La délibération doit être clôturée (tous les cas tranchés) avant publication.',
      );
    }

    const thresholds = (d.metadata as any)?.thresholds ?? { passMark: 10, rescueMark: 9.5 };
    const { rows } = await this.computeAverages(patronat.tenantId, d.examId);
    const approvedCases = new Set(
      d.cases.filter((c) => c.decision === 'APPROVED').map((c) => c.candidateId),
    );
    const rejectedCases = new Set(
      d.cases.filter((c) => c.decision === 'REJECTED').map((c) => c.candidateId),
    );

    // Décision finale par candidat + mention
    const decisions = new Map<
      string,
      { decision: string; mention: string | null; average: number | null }
    >();
    for (const r of rows) {
      if (approvedCases.has(r.candidateId)) {
        decisions.set(r.candidateId, {
          decision: 'ADMIS',
          mention: mentionFor(r.average ?? 10),
          average: r.average,
        });
      } else if (rejectedCases.has(r.candidateId)) {
        decisions.set(r.candidateId, { decision: 'AJOURNE', mention: null, average: r.average });
      } else if (r.complete && r.average !== null) {
        if (r.average >= thresholds.passMark) {
          decisions.set(r.candidateId, {
            decision: 'ADMIS',
            mention: mentionFor(r.average),
            average: r.average,
          });
        } else if (r.average < thresholds.rescueMark) {
          decisions.set(r.candidateId, { decision: 'AJOURNE', mention: null, average: r.average });
        }
        // Entre les deux sans cas → ne devrait pas arriver (cas créés à la
        // délibération) — on n'écrit rien pour rester conservateur.
      }
    }

    const publishedAt = new Date();

    // Transaction : publication des résultats + statuts examen/délibération
    await this.prisma.$transaction(async (tx) => {
      for (const [candidateId, dec] of decisions) {
        await tx.examResult.updateMany({
          where: { examId: d.examId, candidateId, tenantId: patronat.tenantId },
          data: {
            status: 'PUBLISHED',
            metadata: {
              finalDecision: dec.decision,
              finalAverage: dec.average,
              mention: dec.mention,
              publishedAt: publishedAt.toISOString(),
            },
          },
        });
      }
      await tx.examDeliberation.update({
        where: { id: deliberationId },
        data: {
          status: 'PUBLISHED',
          metadata: {
            ...(d.metadata as any),
            publication: {
              publishedAt: publishedAt.toISOString(),
              publishedBy: userId,
              admitted: [...decisions.values()].filter((v) => v.decision === 'ADMIS').length,
              failed: [...decisions.values()].filter((v) => v.decision === 'AJOURNE').length,
            },
          },
        },
      });
      await tx.nationalExam.update({
        where: { id: d.examId },
        data: { status: 'RESULTS_PUBLISHED', totalCandidates: d.totalCandidates },
      });
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: patronat.tenantId,
        userId,
        action: 'FEDERIS_RESULTS_PUBLISHED',
        resource: 'ExamDeliberation',
        resourceId: deliberationId,
        tableName: 'exam_results',
        recordId: d.examId,
        newData: {
          examCode: d.exam.code,
          publishedAt: publishedAt.toISOString(),
          candidates: decisions.size,
        },
      },
    }).catch(() => undefined);

    // ⭐ NOTIFICATIONS (fire-and-forget — jamais bloquantes)
    const notificationReport = await this.notifyParentsAndSchools(
      patronat.tenantId,
      d.exam,
      decisions,
    ).catch((err) => {
      this.logger.warn(`Notifications publication échouées : ${err.message}`);
      return { parents: 0, schoolStaff: 0, schools: 0 };
    });

    return {
      publishedAt: publishedAt.toISOString(),
      exam: { id: d.exam.id, code: d.exam.code, name: d.exam.name },
      candidatesPublished: decisions.size,
      admitted: [...decisions.values()].filter((v) => v.decision === 'ADMIS').length,
      failed: [...decisions.values()].filter((v) => v.decision === 'AJOURNE').length,
      successRate: d.successRate,
      notifications: notificationReport,
    };
  }

  /**
   * Notifications parents via Academia Helm :
   *   candidat (schoolTenantId) → élève correspondant (nom normalisé) →
   *   tuteur principal → email → compte User actif → InAppNotification (+ push)
   * + notification des équipes de direction des écoles concernées.
   */
  private async notifyParentsAndSchools(
    patronatTenantId: string,
    exam: { id: string; code: string; name: string; level: string },
    decisions: Map<string, { decision: string; mention: string | null; average: number | null }>,
  ) {
    const candidateIds = [...decisions.keys()];
    if (candidateIds.length === 0) return { parents: 0, schoolStaff: 0, schools: 0 };

    const candidates = await this.prisma.examCandidate.findMany({
      where: { id: { in: candidateIds }, schoolTenantId: { not: null } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        matricule: true,
        schoolTenantId: true,
      },
    });

    let parentsNotified = 0;
    const schools = new Set<string>();

    for (const candidate of candidates) {
      const decision = decisions.get(candidate.id);
      if (!decision || !candidate.schoolTenantId) continue;
      schools.add(candidate.schoolTenantId);

      // 1. Matching élève Helm par nom normalisé (même tenant école)
      const normFirst = normalizeName(candidate.firstName);
      const normLast = normalizeName(candidate.lastName);
      if (!normFirst || !normLast) continue;

      const students = await this.prisma.student.findMany({
        where: { tenantId: candidate.schoolTenantId, isActive: true },
        select: { id: true, firstName: true, lastName: true },
      });
      const matched = students.find(
        (s) => normalizeName(s.firstName) === normFirst && normalizeName(s.lastName) === normLast,
      );
      if (!matched) continue;

      // 2. Tuteurs de l'élève → emails
      const guardians = await this.prisma.studentGuardian.findMany({
        where: { studentId: matched.id, tenantId: candidate.schoolTenantId },
        select: {
          isPrimary: true,
          guardian: { select: { email: true } },
        },
      });
      const primary = guardians.find((g) => g.isPrimary) ?? guardians[0];
      const guardianEmail = primary?.guardian?.email;
      if (!guardianEmail) continue;

      // 3. Compte parent actif
      const parentUser = await this.prisma.user.findFirst({
        where: {
          email: guardianEmail,
          tenantId: candidate.schoolTenantId,
          status: 'active',
        },
        select: { id: true },
      });
      if (!parentUser) continue;

      // 4. Notification in-app + push (Web + FCM)
      const admis = decision.decision === 'ADMIS';
      const title = `Résultat ${exam.name} — ${candidate.firstName} ${candidate.lastName}`;
      const body = admis
        ? `Admis(e)${decision.mention ? ` avec la mention « ${decision.mention} »` : ''}${
            decision.average !== null ? ` (moyenne ${decision.average}/20)` : ''
          }. Le détail des résultats est disponible dans l'espace Academia.`
        : `Le jury de délibération n\u2019a pas retenu l\u2019admission pour cette session. Le détail des résultats est disponible dans l\u2019espace Academia.`;

      await this.notificationService
        .create({
          tenantId: candidate.schoolTenantId,
          recipientId: parentUser.id,
          type: 'EXAM_RESULT_PUBLISHED',
          title,
          body,
          priority: 'HIGH',
          data: {
            url: '/app/parent',
            examId: exam.id,
            examName: exam.name,
            matricule: candidate.matricule,
            decision: decision.decision,
            average: decision.average,
          },
          relatedEntityType: 'ExamDeliberation',
          relatedEntityId: exam.id,
        })
        .catch((e) => this.logger.warn(`Notif parent échouée : ${e.message}`));
      parentsNotified++;
    }

    // 5. Équipes des écoles — notification de publication
    let staffNotified = 0;
    for (const schoolTenantId of schools) {
      const staff = await this.prisma.user.findMany({
        where: { tenantId: schoolTenantId, role: { in: SCHOOL_STAFF_ROLES }, status: 'active' },
        select: { id: true },
        take: 25,
      });
      for (const member of staff) {
        await this.notificationService
          .create({
            tenantId: schoolTenantId,
            recipientId: member.id,
            type: 'FEDERIS_RESULTS_PUBLISHED_SCHOOL',
            title: `Résultats publiés — ${exam.name}`,
            body: `Le patronat a publié les résultats officiels de l\u2019examen ${exam.name}. Les résultats de vos candidats sont consultables et les parents ont été notifiés.`,
            priority: 'MEDIUM',
            data: { url: '/app/federis', examId: exam.id, examName: exam.name },
            relatedEntityType: 'ExamDeliberation',
            relatedEntityId: exam.id,
          })
          .catch((e) => this.logger.warn(`Notif école échouée : ${e.message}`));
        staffNotified++;
      }
    }

    this.logger.log(
      `Publication ${exam.code} : ${parentsNotified} parent(s) et ${staffNotified} membre(s) d'écoles notifiés (${schools.size} école(s)).`,
    );

    return { parents: parentsNotified, schoolStaff: staffNotified, schools: schools.size };
  }

  // ── 8. Consultation des résultats (publiés / délibérés) ──────────────────

  async listResults(tenantId: string, userId: string, examId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    const results = await this.prisma.examResult.findMany({
      where: { examId, tenantId: patronat.tenantId },
      include: {
        candidate: { select: { id: true, matricule: true, firstName: true, lastName: true } },
        subject: { select: { code: true, name: true } },
      },
      orderBy: [{ candidate: { lastName: 'asc' } }, { subject: { order: 'asc' } }],
    });

    const byCandidate = new Map<
      string,
      {
        matricule: string;
        name: string;
        scores: { subject: string; code: string; score: number; coefficient: number }[];
        status: string;
        finalDecision: string | null;
        finalAverage: number | null;
        mention: string | null;
      }
    >();
    for (const r of results) {
      if (!byCandidate.has(r.candidateId)) {
        const meta = (r.metadata as any) ?? {};
        byCandidate.set(r.candidateId, {
          matricule: r.candidate.matricule,
          name: `${r.candidate.firstName} ${r.candidate.lastName}`,
          scores: [],
          status: r.status,
          finalDecision: meta.finalDecision ?? null,
          finalAverage: meta.finalAverage ?? null,
          mention: meta.mention ?? null,
        });
      }
      byCandidate.get(r.candidateId)!.scores.push({
        subject: r.subject.name,
        code: r.subject.code,
        score: r.score,
        coefficient: r.coefficient,
      });
    }

    return {
      exam: { id: exam.id, code: exam.code, name: exam.name, status: exam.status },
      published: exam.status === 'RESULTS_PUBLISHED',
      candidates: [...byCandidate.values()],
    };
  }
}
