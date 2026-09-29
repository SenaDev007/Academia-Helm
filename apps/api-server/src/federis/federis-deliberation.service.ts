/**
 * FederisDeliberationService — Délibération du jury & publication des résultats
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ REFONTE 2026-09-30 (cahier des charges utilisateur) :
 *   Le module Délibération n'est PLUS un espace de saisie des notes ni de
 *   simulation de seuils — la saisie vit dans le module « Notes et Moyennes »,
 *   les seuils vivent dans le module « Paramètres — Règles de calcul »
 *   (source de vérité). Le module devient la salle de délibération du jury :
 *
 *   1. Tableau de délibération   GET  /federis/exams/:examId/deliberation/board
 *      (admissibles / ajournés, moyenne, décision du jury — moyennes
 *       UNIFIÉES avec le module Notes : CEP moyenne simple, BEPC/BAC/CAP
 *       moyenne pondérée, ABSENTS exclus — buildGradesDataset)
 *   2. Délibération              POST /federis/exams/:examId/deliberation
 *      (jury : seuils des règles effectives → ADMIS / AJOURNÉ + cas limites
 *       ExamDeliberationCase PENDING ; notes verrouillées VALIDATED ;
 *       examen → DELIBERATED)
 *   3. Décision des cas          POST /federis/deliberations/:id/cases/:caseId
 *   4. Clôture                   POST /federis/deliberations/:id/close
 *   5. Publication               POST /federis/deliberations/:id/publish
 *      (résultats → PUBLISHED + mention, examen → RESULTS_PUBLISHED,
 *       notifications parents + écoles via Academia Helm)
 *   6. Envoi des relevés         POST /federis/exams/:examId/releves/dispatch
 *      (chaque relevé de notes est distribué à l'école du candidat :
 *       ledger ExamDocument + notification de direction — les écoles
 *       consultent dans Examen → Examens nationaux → Délibération et relevés)
 *   7. Consultation              GET  /federis/exams/:examId/results
 *
 * Règles transverses :
 *   - NO ACADEMIC YEAR = NO DATA ; jamais de suppression physique
 *   - Délibération = coordonnateur / secrétaire / organisateur ;
 *     PUBLICATION = coordonnateur uniquement (validation humaine §Sécurité)
 *   - Seuils TOUJOURS issus des règles de calcul effectives (Paramètres >
 *     défauts backend 10/20 et 9,5/20) — jamais saisis dans l'interface
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
import { FederisGradesService } from './federis-grades.service';
import { FederisGradingRulesService } from './federis-grading-rules.service';
import {
  ALL_PATRONAT_FUNCTIONS,
  WRITE_DELIBERATION,
  PUBLISH_RESULTS,
  normalizePatronatFunction,
  type PatronatFunction,
} from './federis-roles';

// ── DTO ─────────────────────────────────────────────────────────────────────

// ⭐ FIX 2026-09-29 — décorateurs class-validator OBLIGATOIRES (ValidationPipe
//    global whitelist + forbidNonWhitelisted, pattern federis-patronat.service).
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RunDeliberationDto {
  /** Nom officiel du jury (ex. « Jury national BEPC 2026 — Session principale »). */
  @IsString()
  @MinLength(2)
  @MaxLength(190)
  juryName!: string;
}

export class DecideCaseDto {
  /** APPROVED → admis sur délibération | REJECTED → ajourné. */
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
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

/** Rôles des équipes d'école à notifier (publication + distribution relevés). */
const SCHOOL_STAFF_ROLES = [
  'DIRECTOR',
  'DIRECTRICE',
  'DIRECTEUR',
  'PROVISEUR',
  'DIRECTEUR_ADJOINT',
  'SECRETAIRE',
  'SECRETAIRE_COMPTABLE',
];

/** Décision affichée dans le tableau de délibération. */
export type DeliberationDecision = 'ADMIS' | 'AJOURNE' | 'EN_ATTENTE' | 'NON_DELIBERE';

/** Provenance de la décision (couleur du badge UI). */
export type DecisionSource = 'PUBLIE' | 'JURY' | 'CAS_JURY' | 'PROJECTION';

export interface DeliberationBoardRow {
  candidateId: string;
  matricule: string;
  fullName: string;
  school: string;
  centerName: string | null;
  moyenne: number | null;
  rank: number | null;
  nbEval: number;
  complete: boolean;
  mention: string | null;
  decision: DeliberationDecision;
  decisionLabel: string;
  source: DecisionSource;
  caseId: string | null;
  caseDecision: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  caseReason: string | null;
  releveDispatched: boolean;
}

@Injectable()
export class FederisDeliberationService {
  private readonly logger = new Logger(FederisDeliberationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly patronatService: FederisPatronatService,
    private readonly notificationService: NotificationService,
    private readonly gradesService: FederisGradesService,
    private readonly gradingRulesService: FederisGradingRulesService,
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

  // ═══════════════════════════════════════════════════════════════════════
  // 1. TABLEAU DE DÉLIBÉRATION (admissibles / ajournés — décision du jury)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Tout l'état de délibération d'un examen sur UNE seule réponse :
   * règles effectives, session de saisie, admissibles, ajournés, cas du
   * jury, historique des délibérations et état de distribution des relevés.
   *
   * Décision par candidat (ordre de priorité) :
   *   1. PUBLIÉ  → ExamResult.metadata.finalDecision (résultats publiés) ;
   *   2. CAS JURY→ cas tranché (APPROVED=ADMIS / REJECTED=AJOURNÉ) ou
   *                PENDING (cas limite en attente) ;
   *   3. JURY    → seuils de la délibération (passants / ajournés directs) ;
   *   4. PROJECTION → règles effectives (aucune délibération lancée).
   */
  async getDeliberationBoard(tenantId: string, userId: string, examId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    return this.buildDeliberationBoard(patronat.tenantId, examId);
  }

  /**
   * Board brut, scopé au tenant patronat propriétaire de l'examen — sans
   * vérification d'utilisateur. Réutilisé par l'accès ÉCOLE (FederisSchool-
   * ExamsService) après ses propres garde-fous d'appartenance.
   */
  async buildDeliberationBoard(patronatTenantId: string, examId: string) {
    const ds = await this.gradesService.buildGradesDataset(patronatTenantId, examId);
    const rules = ds.rules;
    const exam = await this.getOwnedExam(patronatTenantId, examId);

    const [deliberations, dispatchDocs, publishedMetaRows] = await Promise.all([
      this.prisma.examDeliberation.findMany({
        where: { examId },
        include: { cases: { include: { candidate: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.examDocument.findMany({
        where: { examId, documentType: 'RELEVE_NOTES', status: 'PUBLISHED' },
        select: { candidateId: true, publishedAt: true, metadata: true },
      }),
      ds.exam.status === 'RESULTS_PUBLISHED'
        ? this.prisma.examResult.findMany({
            where: { examId, tenantId: patronatTenantId },
            select: { candidateId: true, metadata: true },
          })
        : Promise.resolve([] as Array<{ candidateId: string; metadata: any }>),
    ]);

    const latest = deliberations[0] ?? null;
    const publishedMeta = new Map<string, any>();
    for (const row of publishedMetaRows) {
      if (!publishedMeta.has(row.candidateId)) publishedMeta.set(row.candidateId, row.metadata);
    }
    const caseByCandidate = new Map<string, (typeof deliberations)[number]['cases'][number]>();
    if (latest) {
      for (const kase of latest.cases) caseByCandidate.set(kase.candidateId, kase);
    }
    const dispatchedAt = new Map<string, Date | null>();
    for (const doc of dispatchDocs) dispatchedAt.set(doc.candidateId, doc.publishedAt);

    // Seuils de la délibération en cours (figés au lancement) sinon règles effectives
    const activeThresholds = (latest?.metadata as any)?.thresholds ?? {
      passMark: rules.passMark,
      rescueMark: rules.rescueMark,
    };

    const rows: DeliberationBoardRow[] = ds.candidates.map((c) => {
      const comp = ds.computed.get(c.id);
      const moyenne = comp?.finalAverage ?? null;
      const nbEval = comp?.nbEval ?? 0;
      const hasRows = Object.keys(c.scores).length > 0;
      const kase = caseByCandidate.get(c.id) ?? null;
      const meta = publishedMeta.get(c.id) ?? null;

      let decision: DeliberationDecision = 'NON_DELIBERE';
      let source: DecisionSource = 'PROJECTION';
      let decisionLabel = 'À délibérer';

      const finalDecision = meta?.finalDecision ?? meta?.decision;
      if (finalDecision === 'ADMIS' || finalDecision === 'AJOURNE') {
        decision = finalDecision;
        source = 'PUBLIE';
        decisionLabel = finalDecision === 'ADMIS' ? 'Admis' : 'Ajourné';
      } else if (kase) {
        source = 'CAS_JURY';
        if (kase.decision === 'APPROVED') {
          decision = 'ADMIS';
          decisionLabel = 'Admis (jury)';
        } else if (kase.decision === 'REJECTED') {
          decision = 'AJOURNE';
          decisionLabel = 'Ajourné (jury)';
        } else {
          decision = 'EN_ATTENTE';
          decisionLabel = 'Cas du jury — à trancher';
        }
      } else if (latest) {
        source = 'JURY';
        if (moyenne === null) {
          decision = hasRows ? 'AJOURNE' : 'NON_DELIBERE';
          decisionLabel = hasRows ? 'Ajourné (sans note)' : 'À délibérer';
        } else if (moyenne >= activeThresholds.passMark) {
          decision = 'ADMIS';
          decisionLabel = 'Admis';
        } else if (moyenne < activeThresholds.rescueMark) {
          decision = 'AJOURNE';
          decisionLabel = 'Ajourné';
        } else {
          decision = 'EN_ATTENTE';
          decisionLabel = 'Cas du jury — à trancher';
        }
      } else {
        // Projection au seuil des règles effectives (aucune délibération lancée)
        if (moyenne === null) {
          decision = 'NON_DELIBERE';
          decisionLabel = hasRows ? 'Ajourné (sans note)' : 'À délibérer';
        } else if (moyenne >= activeThresholds.passMark) {
          decision = 'ADMIS';
          decisionLabel = 'Admis (projeté)';
        } else if (moyenne >= activeThresholds.rescueMark) {
          decision = 'EN_ATTENTE';
          decisionLabel = 'Cas limite (projeté)';
        } else {
          decision = 'AJOURNE';
          decisionLabel = 'Ajourné (projeté)';
        }
      }

      return {
        candidateId: c.id,
        matricule: c.matricule,
        fullName: `${c.lastName} ${c.firstName}`,
        school: c.school,
        centerName: c.centerName,
        moyenne,
        rank: ds.ranks.get(c.id) ?? null,
        nbEval,
        complete: ds.subjects.length > 0 && nbEval === ds.subjects.length,
        mention: decision === 'ADMIS' ? (meta?.mention ?? (moyenne !== null ? mentionFor(moyenne) : null)) : null,
        decision,
        decisionLabel,
        source,
        caseId: kase?.id ?? null,
        caseDecision: (kase?.decision as any) ?? null,
        caseReason: kase?.reason ?? null,
        releveDispatched: dispatchedAt.has(c.id),
      };
    });

    const admissibles = rows
      .filter((r) => r.decision === 'ADMIS')
      .sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1));
    const ajournes = rows
      .filter((r) => r.decision !== 'ADMIS')
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fr'));

    const decided = rows.filter((r) => r.decision === 'ADMIS' || r.decision === 'AJOURNE').length;
    const stats = {
      totalCandidates: rows.length,
      admissibles: admissibles.length,
      ajournes: rows.filter((r) => r.decision === 'AJOURNE').length,
      enAttente: rows.filter((r) => r.decision === 'EN_ATTENTE').length,
      nonDeliberes: rows.filter((r) => r.decision === 'NON_DELIBERE').length,
      successRate: decided > 0 ? round2((admissibles.length / decided) * 100) : null,
    };

    const dispatchDates = dispatchDocs.map((d) => d.publishedAt).filter(Boolean) as Date[];

    return {
      exam: {
        id: exam.id,
        code: exam.code,
        name: exam.name,
        examType: exam.examType,
        level: exam.level,
        status: exam.status,
        isPrimary: ds.exam.isPrimary,
      },
      academicYearLabel: ds.academicYearLabel,
      rules: {
        ...rules,
        ...activeThresholds,
        fromDeliberation: Boolean((latest?.metadata as any)?.thresholds),
      },
      session: ds.session,
      filling: ds.filling,
      subjectsCount: ds.subjects.length,
      stats,
      deliberation: latest
        ? {
            id: latest.id,
            juryName: latest.juryName,
            deliberatedAt: latest.deliberatedAt,
            status: latest.status,
            totalCandidates: latest.totalCandidates,
            passedCount: latest.passedCount,
            failedCount: latest.failedCount,
            successRate: latest.successRate,
            thresholds: (latest.metadata as any)?.thresholds ?? null,
            publication: (latest.metadata as any)?.publication ?? null,
            closedAt: (latest.metadata as any)?.closedAt ?? null,
            pendingCases: latest.cases.filter((c) => c.decision === 'PENDING').length,
            cases: latest.cases.map((c) => ({
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
          }
        : null,
      deliberationsHistory: deliberations.slice(1, 6).map((d) => ({
        id: d.id,
        juryName: d.juryName,
        status: d.status,
        deliberatedAt: d.deliberatedAt,
        passedCount: d.passedCount,
        failedCount: d.failedCount,
      })),
      dispatch: {
        dispatchedCount: dispatchDocs.length,
        lastDispatchAt: dispatchDates.length > 0 ? new Date(Math.max(...dispatchDates.map((x) => x.getTime()))) : null,
        schoolsCount: new Set(
          dispatchDocs.map((d) => (d.metadata as any)?.schoolTenantId).filter(Boolean),
        ).size,
      },
      admissibles,
      ajournes,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. DÉLIBÉRATION OFFICIELLE (jury — seuils = règles de calcul effectives)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Délibération officielle du jury. Les seuils ne sont PLUS saisis dans
   * l'interface : ils proviennent des règles de calcul effectives (module
   * Paramètres — source de vérité — ou défauts backend 10/20 et 9,5/20).
   *
   * Sont délibérés TOUS les candidats ayant au moins une ligne de note
   * (notes ou absences) — pattern Promotion & Redoublement Helm : un candidat
   * absent à toutes les épreuves est AJOURNÉ (moyenne nulle).
   */
  async runDeliberation(tenantId: string, userId: string, examId: string, dto: RunDeliberationDto) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertDeliberation(fn);

    const ds = await this.gradesService.buildGradesDataset(patronat.tenantId, examId);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    if (exam.status === 'RESULTS_PUBLISHED') {
      throw new BadRequestException('Les résultats sont déjà publiés — délibération close.');
    }
    if (ds.subjects.length === 0) {
      throw new BadRequestException('Aucune matière définie pour cet examen.');
    }
    if (!dto.juryName?.trim()) {
      throw new BadRequestException('Le nom du jury est requis.');
    }
    if (ds.filling.gradedCells + ds.filling.absentCells === 0) {
      throw new BadRequestException(
        'Aucune note saisie pour cet examen — complétez la saisie dans le module « Notes et Moyennes ».',
      );
    }

    // ⭐ Seuils = règles de calcul effectives (Paramètres > défauts backend)
    const rules = await this.gradingRulesService.resolveEffectiveRules(
      patronat.tenantId,
      exam.examType,
    );
    const { passMark, rescueMark } = rules;

    // Candidats délibérables : au moins une ligne de note (évaluée ou absence)
    const deliberable = ds.candidates.filter((c) => Object.keys(c.scores).length > 0);
    if (deliberable.length === 0) {
      throw new BadRequestException('Aucun candidat ne dispose de notes pour cet examen.');
    }

    let passedCount = 0;
    let failedCount = 0;
    const caseRows: { candidateId: string; reason: string; average: number | null }[] = [];

    for (const c of deliberable) {
      const avg = ds.computed.get(c.id)?.finalAverage ?? null;
      if (avg !== null && avg >= passMark) {
        passedCount++;
      } else if (avg !== null && avg >= rescueMark) {
        caseRows.push({
          candidateId: c.id,
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
          totalCandidates: deliberable.length,
          passedCount,
          failedCount,
          successRate:
            deliberable.length > 0 ? round2((passedCount / deliberable.length) * 100) : 0,
          status: caseRows.length > 0 ? 'IN_PROGRESS' : 'COMPLETED',
          metadata: {
            thresholds: { passMark, rescueMark },
            rulesSource: rules.isCustom ? 'PARAMETRES' : 'DEFAUTS_BACKEND',
            candidatesWithoutNotes: ds.candidates.length - deliberable.length,
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

    await this.prisma.auditLog
      .create({
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
            rulesSource: rules.isCustom ? 'PARAMETRES' : 'DEFAUTS_BACKEND',
            total: deliberable.length,
            passed: passedCount,
            failed: failedCount,
            pendingCases: caseRows.length,
          },
        },
      })
      .catch(() => undefined);

    return {
      deliberationId: deliberation.id,
      status: deliberation.status,
      juryName: deliberation.juryName,
      thresholds: { passMark, rescueMark },
      rulesSource: rules.isCustom ? 'PARAMETRES' : 'DEFAUTS_BACKEND',
      totalCandidates: deliberable.length,
      passedCount,
      failedCount,
      pendingCases: caseRows.length,
      candidatesWithoutNotes: ds.candidates.length - deliberable.length,
      successRate: deliberation.successRate,
      message:
        caseRows.length > 0
          ? `Délibération lancée — ${caseRows.length} cas(s) limite(s) à trancher par le jury.`
          : 'Délibération lancée et terminée — clôture puis publication possibles.',
    };
  }

  // ── 3. Décision d'un cas limite (jury) ────────────────────────────────────

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

    await this.prisma.auditLog
      .create({
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
      })
      .catch(() => undefined);

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

  // ── 4. Clôture de la délibération ─────────────────────────────────────────

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

    await this.prisma.auditLog
      .create({
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
      })
      .catch(() => undefined);

    return {
      deliberationId: closed.id,
      status: closed.status,
      passedCount: closed.passedCount,
      failedCount: closed.failedCount,
      successRate: closed.successRate,
    };
  }

  // ── 5. PUBLICATION + NOTIFICATIONS PARENTS (via Academia Helm) ────────────

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

    const thresholds =
      (d.metadata as any)?.thresholds ??
      (await this.gradingRulesService.resolveEffectiveRules(patronat.tenantId, d.exam.examType));

    // ⭐ Moyennes UNIFIÉES avec le module Notes (CEP simple / autres pondérée,
    //    absents exclus) — plus jamais de double calcul divergent.
    const ds = await this.gradesService.buildGradesDataset(patronat.tenantId, d.examId);
    const approvedCases = new Set(
      d.cases.filter((c) => c.decision === 'APPROVED').map((c) => c.candidateId),
    );
    const rejectedCases = new Set(
      d.cases.filter((c) => c.decision === 'REJECTED').map((c) => c.candidateId),
    );

    // Décision finale par candidat + mention (tous les candidats délibérés,
    // pattern Promotion Helm : sans note → AJOURNÉ)
    const decisions = new Map<
      string,
      { decision: string; mention: string | null; average: number | null }
    >();
    for (const c of ds.candidates) {
      if (Object.keys(c.scores).length === 0) continue; // jamais délibéré
      const average = ds.computed.get(c.id)?.finalAverage ?? null;
      if (approvedCases.has(c.id)) {
        decisions.set(c.id, {
          decision: 'ADMIS',
          mention: average !== null ? mentionFor(average) : 'Passable',
          average,
        });
      } else if (rejectedCases.has(c.id)) {
        decisions.set(c.id, { decision: 'AJOURNE', mention: null, average });
      } else if (average !== null && average >= thresholds.passMark) {
        decisions.set(c.id, {
          decision: 'ADMIS',
          mention: mentionFor(average),
          average,
        });
      } else {
        // Sous le seuil d'admission sans cas tranché (seuils modifiés après
        // délibération, ou absent à toutes les épreuves) → AJOURNÉ conservateur
        decisions.set(c.id, { decision: 'AJOURNE', mention: null, average });
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

    await this.prisma.auditLog
      .create({
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
      })
      .catch(() => undefined);

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
      message:
        'Résultats publiés — pensez à envoyer les relevés de notes aux écoles (bouton « Envoyer les relevés »).',
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
        : `Le jury de délibération n\u2019a pas retenu l\u2019admission pour cette session. Le détail des résultats est disponible dans l'espace Academia.`;

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
            body: `Le patronat a publié les résultats officiels de l\u2019examen ${exam.name}. Les résultats de vos candidats sont consultables dans Examen → Examens nationaux → Délibération et relevés de notes.`,
            priority: 'MEDIUM',
            data: {
              url: '/app/exams/national-exams?view=deliberation',
              examId: exam.id,
              examName: exam.name,
            },
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

  // ═══════════════════════════════════════════════════════════════════════
  // 6. ENVOI DES RELEVÉS DE NOTES AUX ÉCOLES (distribution intelligente)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Distribue le relevé de notes de CHAQUE candidat à son école de
   * provenance : une ligne ExamDocument (documentType RELEVE_NOTES, statut
   * PUBLISHED) par candidat — l'école consulte le relevé et le télécharge
   * dans Examen → Examens nationaux → « Délibération et relevés de notes ».
   *
   * Idempotent : un nouvel envoi actualise les documents existants
   * (décision/moyenne à jour) sans créer de doublons.
   *
   * Accessible depuis le module Délibération ET le module Notes et Moyennes
   * (onglet Relevés de notes) — même endpoint, mêmes garde-fous.
   */
  async dispatchReleves(tenantId: string, userId: string, examId: string) {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertDeliberation(fn);

    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    if (exam.status !== 'DELIBERATED' && exam.status !== 'RESULTS_PUBLISHED') {
      throw new BadRequestException(
        'L\u2019examen doit être délibéré avant l\u2019envoi des relevés — lancez la délibération du jury.',
      );
    }

    const board = await this.getDeliberationBoard(tenantId, userId, examId);
    const deliberation = board.deliberation;

    // Candidats délibérés (ayant composé / au moins une ligne de note)
    const dispatchable = [...board.admissibles, ...board.ajournes].filter(
      (r) => r.decision !== 'NON_DELIBERE',
    );
    if (dispatchable.length === 0) {
      throw new BadRequestException('Aucun candidat délibéré — rien à envoyer.');
    }

    const now = new Date();
    let created = 0;
    let updated = 0;
    let withoutSchool = 0;
    const schools = new Map<string, string[]>(); // schoolTenantId → candidate names

    for (const row of dispatchable) {
      // Rattachement école du candidat (ExamCandidate.schoolTenantId)
      const candidate = await this.prisma.examCandidate.findUnique({
        where: { id: row.candidateId },
        select: { schoolTenantId: true, metadata: true },
      });
      const schoolTenantId = candidate?.schoolTenantId ?? null;
      if (!schoolTenantId) {
        withoutSchool++;
        continue;
      }

      const metadata = {
        schoolTenantId,
        examCode: exam.code,
        examName: exam.name,
        examType: exam.examType,
        decision: row.decision,
        decisionLabel: row.decisionLabel,
        average: row.moyenne,
        mention: row.mention,
        rank: row.rank,
        juryName: deliberation?.juryName ?? null,
        deliberationStatus: deliberation?.status ?? null,
        published: exam.status === 'RESULTS_PUBLISHED',
      };

      const existing = await this.prisma.examDocument.findFirst({
        where: { examId, candidateId: row.candidateId, documentType: 'RELEVE_NOTES' },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.examDocument.update({
          where: { id: existing.id },
          data: { status: 'PUBLISHED', publishedBy: userId, publishedAt: now, metadata: metadata as any },
        });
        updated++;
      } else {
        await this.prisma.examDocument.create({
          data: {
            tenantId: patronat.tenantId,
            academicYearId: exam.academicYearId,
            examId,
            candidateId: row.candidateId,
            documentType: 'RELEVE_NOTES',
            title: `Relevé de notes — ${row.fullName} (${exam.code})`,
            fileUrl: `/federis/exams/${examId}/pdf/releve/${row.candidateId}`,
            status: 'PUBLISHED',
            generatedBy: userId,
            generatedAt: now,
            publishedBy: userId,
            publishedAt: now,
            metadata: metadata as any,
          },
        });
        created++;
      }
      if (!schools.has(schoolTenantId)) schools.set(schoolTenantId, []);
      schools.get(schoolTenantId)!.push(row.fullName);
    }

    // ⭐ Notification de la direction de chaque école (pattern superviseurs)
    let staffNotified = 0;
    for (const [schoolTenantId, names] of schools) {
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
            type: 'FEDERIS_RELEVES_DISPATCHED',
            title: `Relevés de notes reçus — ${exam.name}`,
            body: `Le patronat a transmis ${names.length} relevé(s) de notes de vos candidats à l'examen ${exam.name}. Consultez-les dans Examen → Examens nationaux → Délibération et relevés de notes.`,
            priority: 'HIGH',
            data: {
              url: '/app/exams/national-exams?view=deliberation',
              examId,
              examName: exam.name,
              examType: exam.examType,
              count: names.length,
            },
            relatedEntityType: 'ExamDocument',
            relatedEntityId: examId,
          })
          .catch((e) => this.logger.warn(`Notif distribution échouée : ${e.message}`));
        staffNotified++;
      }
    }

    await this.prisma.auditLog
      .create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_RELEVES_DISPATCHED',
          resource: 'ExamDocument',
          resourceId: examId,
          tableName: 'exam_documents',
          recordId: examId,
          newData: {
            examCode: exam.code,
            created,
            updated,
            schools: schools.size,
            withoutSchool,
            staffNotified,
          },
        },
      })
      .catch(() => undefined);

    this.logger.log(
      `Relevés ${exam.code} distribués : ${created + updated} document(s) à ${schools.size} école(s)${withoutSchool > 0 ? `, ${withoutSchool} candidat(s) sans école rattachée` : ''}.`,
    );

    return {
      documents: created + updated,
      created,
      updated,
      schools: schools.size,
      schoolStaff: schools.size > 0 ? [...schools.keys()] : [],
      withoutSchool,
      staffNotified,
      message:
        schools.size > 0
          ? `${created + updated} relevé(s) envoyé(s) à ${schools.size} école(s)${withoutSchool > 0 ? ` — ${withoutSchool} candidat(s) sans école rattachée ignoré(s)` : ''}.`
          : `Aucune école rattachée à ces candidats — ${withoutSchool} candidat(s) sans rattachement.`,
    };
  }

  // ── 7. Consultation des résultats (publiés / délibérés) ──────────────────

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
          finalDecision: meta.finalDecision ?? meta.decision ?? null,
          finalAverage: meta.finalAverage ?? meta.average ?? null,
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
