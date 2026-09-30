/**
 * FederisPdfService — Documents officiels PDF des examens nationaux
 * ═══════════════════════════════════════════════════════════════════════════
 * Academia Federis — MÊME PATTER QUE LES PDF ACADEMIA HELM
 * (contract-pdf.service.ts / tax-pdf.service.ts) :
 *
 *   • Rendu 100 % BACKEND : template HTML professionnel → Chromium headless
 *     (PuppeteerPoolService) → Buffer PDF A4 — le frontend ne génère rien.
 *   • Bordereaux d'émargement : une section par salle (page-break), table
 *     des candidats avec colonne de signature, effectif et blocs de
 *     signatures officiels (surveillant / chef de centre).
 *   • Palmarès officiel : réservé aux résultats PUBLIÉS — statistiques,
 *     répartition des mentions, classement par moyenne décroissante,
 *     décisions ADMIS / AJOURNÉ, signatures Coordination / Jury.
 *
 * Endpoints (FederisPdfController) :
 *   GET /federis/exams/:examId/pdf/bordereaux?centerId=&roomId=
 *   GET /federis/exams/:examId/pdf/palmares
 *
 * Règles transverses Federis :
 *   - Permissions : lecture réservée aux membres du patronat (federis-roles)
 *   - Examen scopé au tenant du patronat (getOwnedExam)
 *   - AuditLog sur chaque génération
 */

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';
import { FederisPatronatService } from './federis-patronat.service';
// ⭐ Module « Notes et Moyennes » — données des relevés (moyennes, rangs,
//    coefficients : calculs partagés avec la grille et le registre)
import { FederisGradesService } from './federis-grades.service';
// ⭐ Module Délibération — board unifié (décisions du jury) pour la liste
//    officielle de délibération (2026-09-30)
import { FederisDeliberationService } from './federis-deliberation.service';
import {
  ALL_PATRONAT_FUNCTIONS,
  normalizePatronatFunction,
  type PatronatFunction,
} from './federis-roles';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Échappement HTML de toute valeur dynamique injectée dans les templates. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatLongDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatNumber(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Mention nationale (même barème que federis-deliberation.service). */
function mentionFor(average: number): string {
  if (average >= 16) return 'Excellent';
  if (average >= 14) return 'Très Bien';
  if (average >= 12) return 'Bien';
  if (average >= 10) return 'Assez Bien';
  return 'Passable';
}

// ⭐ 2026-09-30 — Comparateur naturel des numéros de table. Les numéros sont
//    désormais ALIGNÉS sur la salle (« S01-001 », « S02-014 »…) : un tri
//    alphabétique ou un parseInt() placerait « S01-100 » avant « S01-99 » ou
//    tomberait sur NaN. On décompose {code salle}-{séquence} puis on trie
//    par salle puis par numéro ; les anciens formats (« 001 ») restent
//    triés numériquement (compatibilité des campagnes déjà numérotées).
function compareTableNumbers(a?: string | null, b?: string | null): number {
  const parse = (v?: string | null) => {
    if (!v) return null;
    const m = /^(.*?)-(\d+)$/.exec(v.trim());
    if (m) return { room: m[1], num: parseInt(m[2], 10) };
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? { room: '', num: n } : null;
  };
  const pa = parse(a);
  const pb = parse(b);
  if (pa && pb) {
    if (pa.room !== pb.room) return pa.room.localeCompare(pb.room, 'fr');
    if (pa.num !== pb.num) return pa.num - pb.num;
    return 0;
  }
  return (a ?? '').localeCompare(b ?? '', 'fr');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Libellés postes / rôles / statuts (module Centres, salles & Surveillants)
//    Locaux — zéro import croisé (pattern anti-dépendance circulaire).

const LOGISTICS_POST_KEYS = ['SURVEILLANCE', 'CORRECTION', 'SECRETARIAT'] as const;

function normalizeLogisticsPost(value?: string | null): string | undefined {
  return LOGISTICS_POST_KEYS.includes(value as any) ? (value as string) : undefined;
}

function logisticsPostLabel(post?: string | null): string {
  switch (post) {
    case 'CORRECTION':
      return 'Correction des épreuves';
    case 'SECRETARIAT':
      return 'Secrétariat — saisie des notes';
    case 'SURVEILLANCE':
      return 'Surveillance des épreuves';
    default:
      return '—';
  }
}

/** Titre du document selon le poste filtré (listes générées À PART). */
function logisticsPostDocTitle(post?: string | null): string {
  switch (post) {
    case 'CORRECTION':
      return 'Liste des correcteurs';
    case 'SECRETARIAT':
      return 'Liste du personnel de secrétariat';
    case 'SURVEILLANCE':
      return 'Liste des surveillants des épreuves';
    default:
      return 'Liste du personnel d’examen';
  }
}

function logisticsRoleLabel(role?: string | null): string {
  const map: Record<string, string> = {
    SURVEILLANT: 'Surveillant',
    CHEF_DE_SALLE: 'Chef de salle',
    CHEF_DE_CENTRE: 'Chef de centre',
    CORRECTEUR: 'Correcteur',
    SECRETAIRE: 'Secrétaire',
  };
  if (!role) return '—';
  return map[role] ?? role;
}

function logisticsStatusLabel(status?: string | null): string {
  const map: Record<string, string> = {
    ACTIVE: 'Actif',
    INACTIVE: 'Inactif',
    AVAILABLE: 'Disponible',
    OCCUPIED: 'Occupée',
    BLOCKED: 'Bloquée',
  };
  if (!status) return '—';
  return map[status] ?? status;
}

// ── Types de rendu ──────────────────────────────────────────────────────────

interface BordereauSection {
  centerCode: string;
  centerName: string;
  centerAddress?: string | null;
  roomCode: string;
  roomName: string;
  capacity: number;
  candidates: {
    tableNumber: string | null;
    matricule: string;
    name: string;
    gender: string | null;
    school: string;
  }[];
}

interface PalmaresRow {
  rank: number | null;
  matricule: string;
  name: string;
  school: string;
  average: number | null;
  mention: string | null;
  decision: string;
  /** Libellé de décision spécifique (ex. « EN COURS ») — défaut ADMIS/AJOURNÉ. */
  decisionLabel?: string;
}

@Injectable()
export class FederisPdfService {
  private readonly logger = new Logger(FederisPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly patronatService: FederisPatronatService,
    private readonly gradesService: FederisGradesService,
    private readonly deliberationService: FederisDeliberationService,
  ) {}

  // ── Contexte & permissions (même structure que les autres services federis) ──

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

  private async getOwnedExam(patronatTenantId: string, examId: string) {
    const exam = await this.prisma.nationalExam.findFirst({
      where: { id: examId, tenantId: patronatTenantId },
    });
    if (!exam) throw new NotFoundException('Examen introuvable dans votre périmètre.');
    return exam;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 1. BORDEREAUX D'ÉMARGEMENT
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Génère les bordereaux d'émargement de l'examen :
   *   - une section par salle (nouvelle page par salle) ;
   *   - filtrable par centre (centerId) ou salle (roomId) ;
   *   - inclut les candidats affectés à un centre mais sans salle (section
   *     « non affectés ») pour un contrôle d'exhaustivité le jour J.
   */
  async generateBordereauxPdf(
    tenantId: string,
    userId: string,
    examId: string,
    opts: { centerId?: string; roomId?: string } = {},
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    const [academicYear, rooms, candidates] = await Promise.all([
      this.prisma.academicYear.findUnique({ where: { id: exam.academicYearId } }),
      this.prisma.examRoom.findMany({
        where: {
          examId: exam.id,
          ...(opts.roomId ? { id: opts.roomId } : {}),
          ...(opts.centerId ? { centerId: opts.centerId } : {}),
        },
        include: { center: { select: { code: true, name: true, address: true } } },
        orderBy: [{ center: { name: 'asc' } }, { code: 'asc' }],
      }),
      this.prisma.examCandidate.findMany({
        where: {
          examId: exam.id,
          ...(opts.roomId
            ? { roomId: opts.roomId }
            : opts.centerId
              ? { centerId: opts.centerId }
              : {}),
        },
        include: {
          room: { select: { id: true } },
          center: { select: { id: true, code: true, name: true, address: true } },
          schoolTenant: { select: { name: true } },
        },
        orderBy: [{ center: { code: 'asc' } }, { room: { code: 'asc' } }, { tableNumber: 'asc' }],
      }),
    ]);

    if (candidates.length === 0) {
      throw new BadRequestException(
        "Aucun candidat à afficher — vérifiez l'affectation des candidats (centres / salles).",
      );
    }

    // Sections = salles, puis regroupement des candidats sans salle
    const sections: BordereauSection[] = [];
    for (const room of rooms) {
      const roomCandidates = candidates
        .filter((c) => c.roomId === room.id)
        .sort((a, b) => {
          // ⭐ Tri naturel des n° de table « S01-001 » (salle puis séquence)
          const cmp = compareTableNumbers(a.tableNumber, b.tableNumber);
          if (cmp !== 0) return cmp;
          return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr');
        });
      if (roomCandidates.length === 0) continue;
      sections.push({
        centerCode: room.center.code,
        centerName: room.center.name,
        centerAddress: room.center.address,
        roomCode: room.code,
        roomName: room.name,
        capacity: room.capacity,
        candidates: roomCandidates.map((c) => ({
          tableNumber: c.tableNumber,
          matricule: c.matricule,
          name: `${c.lastName} ${c.firstName}`,
          gender: c.gender,
          school: c.schoolTenant?.name ?? (c.metadata as any)?.schoolName ?? '—',
        })),
      });
    }

    // Candidats affectés à un centre mais sans salle (contrôle exhaustivité)
    const withoutRoom = candidates.filter((c) => !c.roomId && c.center);
    if (withoutRoom.length > 0 && !opts.roomId) {
      const byCenter = new Map<string, typeof withoutRoom>();
      for (const c of withoutRoom) {
        const key = c.center!.id;
        const list = byCenter.get(key) ?? [];
        list.push(c);
        byCenter.set(key, list);
      }
      for (const list of byCenter.values()) {
        const center = list[0].center!;
        sections.push({
          centerCode: center.code,
          centerName: center.name,
          centerAddress: center.address,
          roomCode: 'N/A',
          roomName: 'Candidats non affectés à une salle',
          capacity: list.length,
          candidates: list
            .sort((a, b) =>
              `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr'),
            )
            .map((c) => ({
              tableNumber: c.tableNumber,
              matricule: c.matricule,
              name: `${c.lastName} ${c.firstName}`,
              gender: c.gender,
              school: c.schoolTenant?.name ?? (c.metadata as any)?.schoolName ?? '—',
            })),
        });
      }
    }

    if (sections.length === 0) {
      throw new BadRequestException(
        "Aucune salle ne contient de candidats pour ce filtre — affectez d'abord les candidats aux salles (numéros de table).",
      );
    }

    const html = this.buildBordereauHtml({
      patronatName: patronat.name,
      patronatTerritory: [patronat.territoryName, patronat.country?.name]
        .filter(Boolean)
        .join(' — '),
      examName: exam.name,
      examCode: exam.code,
      examType: exam.examType,
      level: exam.level,
      period: `${formatDate(exam.startDate)} au ${formatDate(exam.endDate)}`,
      academicYear: academicYear?.label ?? academicYear?.name ?? '',
      generatedAt: new Date(),
      sections,
      totalCandidates: candidates.length,
    });

    const buffer = await this.renderPdf(html);
    const filename = `Bordereaux_Emarginement_${exam.code}_${new Date().toISOString().split('T')[0]}.pdf`;

    await this.prisma.auditLog
      .create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_BORDEREAUX_PDF',
          resource: 'NationalExam',
          resourceId: exam.id,
          tableName: 'national_exams',
          recordId: exam.id,
          newData: {
            examCode: exam.code,
            sections: sections.length,
            candidates: candidates.length,
            filters: opts,
          },
        },
      })
      .catch(() => undefined);

    return { buffer, filename };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2. PALMARÈS OFFICIEL
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Génère le palmarès officiel de l'examen — uniquement après publication
   * des résultats (statut RESULTS_PUBLISHED) : classement des admis par
   * moyenne décroissante, ajournés, statistiques et mentions.
   */
  async generatePalmaresPdf(
    tenantId: string,
    userId: string,
    examId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    if (exam.status !== 'RESULTS_PUBLISHED') {
      throw new BadRequestException(
        "Le palmarès ne peut être généré qu'après la publication officielle des résultats (délibération close + publication).",
      );
    }

    const [academicYear, deliberation, subjects, candidates, results] = await Promise.all([
      this.prisma.academicYear.findUnique({ where: { id: exam.academicYearId } }),
      this.prisma.examDeliberation.findFirst({
        where: { examId: exam.id, status: 'PUBLISHED' },
        orderBy: { deliberatedAt: 'desc' },
      }),
      this.prisma.nationalExamSubject.findMany({
        where: { examId: exam.id },
        select: { id: true, coefficient: true },
      }),
      this.prisma.examCandidate.findMany({
        where: { examId: exam.id },
        include: { schoolTenant: { select: { name: true } } },
      }),
      this.prisma.examResult.findMany({
        where: { examId: exam.id, tenantId: patronat.tenantId },
        select: {
          candidateId: true,
          subjectId: true,
          score: true,
          coefficient: true,
          metadata: true,
        },
      }),
    ]);

    // Moyennes pondérées (même calcul que la délibération)
    const coefBySubject = new Map(subjects.map((s) => [s.id, s.coefficient ?? 1]));
    const acc = new Map<string, { sum: number; coef: number }>();
    const decisionMeta = new Map<
      string,
      {
        decision?: string;
        average?: number;
        mention?: string;
        // ⭐ Clés écrites par publishResults (2026-09-30) — anciennes clés
        //    decision/average conservées en repli.
        finalDecision?: string;
        finalAverage?: number;
      }
    >();
    for (const r of results) {
      if (!decisionMeta.has(r.candidateId)) {
        decisionMeta.set(r.candidateId, (r.metadata as any) ?? {});
      }
      if (!acc.has(r.candidateId)) acc.set(r.candidateId, { sum: 0, coef: 0 });
      const a = acc.get(r.candidateId)!;
      const coef = r.coefficient ?? coefBySubject.get(r.subjectId) ?? 1;
      a.sum += r.score * coef;
      a.coef += coef;
    }

    const rows: PalmaresRow[] = candidates.map((c) => {
      const a = acc.get(c.id);
      const meta = decisionMeta.get(c.id) ?? {};
      const computed = a && a.coef > 0 ? round2(a.sum / a.coef) : null;
      // ⭐ FIX 2026-09-30 — publishResults écrit finalDecision / finalAverage
      //    (anciennes clés decision / average conservées en repli).
      const finalDecision =
        meta.finalDecision === 'ADMIS' || meta.finalDecision === 'AJOURNE'
          ? meta.finalDecision
          : meta.decision === 'ADMIS' || meta.decision === 'AJOURNE'
            ? meta.decision
            : null;
      const metaAverage =
        typeof meta.finalAverage === 'number' && meta.finalAverage !== null
          ? meta.finalAverage
          : typeof meta.average === 'number' && meta.average !== null
            ? meta.average
            : null;
      const average = metaAverage !== null ? round2(metaAverage) : computed;
      return {
        rank: null,
        matricule: c.matricule,
        name: `${c.lastName} ${c.firstName}`,
        school: c.schoolTenant?.name ?? (c.metadata as any)?.schoolName ?? '—',
        average,
        mention:
          finalDecision === 'ADMIS'
            ? (meta.mention ?? (average != null ? mentionFor(average) : null))
            : null,
        decision: finalDecision ?? (average != null && average >= 10 ? 'ADMIS' : 'AJOURNE'),
      };
    });

    // Classement : admis par moyenne décroissante (ex æquo = même rang),
    // ajournés ensuite par ordre alphabétique.
    const admitted = rows
      .filter((r) => r.decision === 'ADMIS')
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
    let currentRank = 0;
    let previousAvg: number | null = null;
    admitted.forEach((r, i) => {
      if (previousAvg === null || r.average !== previousAvg) {
        currentRank = i + 1;
        previousAvg = r.average;
      }
      r.rank = currentRank;
    });
    const failed = rows
      .filter((r) => r.decision !== 'ADMIS')
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const ordered = [...admitted, ...failed];

    const admittedCount = admitted.length;
    const failedCount = failed.length;
    const decided = admittedCount + failedCount;
    const successRate = decided > 0 ? round2((admittedCount / decided) * 100) : 0;
    const mentions = { Excellent: 0, 'Très Bien': 0, Bien: 0, 'Assez Bien': 0, Passable: 0 };
    for (const r of admitted) {
      const m = r.mention != null && r.mention in mentions ? r.mention : 'Passable';
      mentions[m as keyof typeof mentions]++;
    }

    const html = this.buildPalmaresHtml({
      patronatName: patronat.name,
      patronatTerritory: [patronat.territoryName, patronat.country?.name]
        .filter(Boolean)
        .join(' — '),
      examName: exam.name,
      examCode: exam.code,
      examType: exam.examType,
      level: exam.level,
      academicYear: academicYear?.label ?? academicYear?.name ?? '',
      juryName: deliberation?.juryName ?? null,
      publishedAt: (deliberation?.metadata as any)?.publication?.publishedAt ?? null,
      stats: {
        total: rows.length,
        admitted: admittedCount,
        failed: failedCount,
        successRate,
      },
      mentions,
      rows: ordered,
      generatedAt: new Date(),
    });

    const buffer = await this.renderPdf(html);
    const filename = `Palmare_Officiel_${exam.code}_${new Date().toISOString().split('T')[0]}.pdf`;

    await this.prisma.auditLog
      .create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_PALMARES_PDF',
          resource: 'NationalExam',
          resourceId: exam.id,
          tableName: 'national_exams',
          recordId: exam.id,
          newData: {
            examCode: exam.code,
            candidates: rows.length,
            admitted: admittedCount,
            failed: failedCount,
            successRate,
          },
        },
      })
      .catch(() => undefined);

    return { buffer, filename };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 1 bis. LISTE OFFICIELLE DE DÉLIBÉRATION (module Délibération — 2026-09-30)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Liste officielle de délibération — admissibles et ajournés avec la
   * décision du jury (module Délibération). Générable dès que l'examen est
   * DÉLIBÉRÉ (bandeau PROVISOIRE) ; devient la liste définitive après
   * publication des résultats.
   *
   * Décisions et moyennes proviennent du board unifié (moyennes du module
   * Notes : CEP simple / BEPC-BAC-CAP pondérée, absents exclus) — aucune
   * duplication de règle métier.
   */
  async generateDeliberationPdf(
    tenantId: string,
    userId: string,
    examId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    if (exam.status !== 'DELIBERATED' && exam.status !== 'RESULTS_PUBLISHED') {
      throw new BadRequestException(
        'La liste de délibération est générable après le lancement de la délibération du jury (module Délibérations).',
      );
    }

    const board = await this.deliberationService.getDeliberationBoard(
      tenantId,
      userId,
      examId,
    );
    const published = exam.status === 'RESULTS_PUBLISHED';

    // Classement des admissibles (moyenne décroissante, ex æquo = même rang)
    const admissibles = [...board.admissibles];
    let currentRank = 0;
    let previousAvg: number | null = null;
    const rows: PalmaresRow[] = admissibles.map((r, i) => {
      if (previousAvg === null || r.moyenne !== previousAvg) {
        currentRank = i + 1;
        previousAvg = r.moyenne;
      }
      return {
        rank: currentRank,
        matricule: r.matricule,
        name: r.fullName,
        school: r.school,
        average: r.moyenne,
        mention: r.mention,
        decision: 'ADMIS',
      };
    });
    for (const r of board.ajournes) {
      const label =
        r.decision === 'EN_ATTENTE'
          ? 'EN COURS'
          : r.decision === 'NON_DELIBERE'
            ? '—'
            : 'AJOURNÉ';
      rows.push({
        rank: null,
        matricule: r.matricule,
        name: r.fullName,
        school: r.school,
        average: r.moyenne,
        mention: null,
        decision: r.decision === 'AJOURNE' ? 'AJOURNE' : r.decision,
        decisionLabel: label,
      });
    }

    const decided = board.stats.admissibles + board.stats.ajournes;
    const mentions: Record<string, number> = {
      Excellent: 0,
      'Très Bien': 0,
      Bien: 0,
      'Assez Bien': 0,
      Passable: 0,
    };
    for (const r of admissibles) {
      const m = r.mention != null && r.mention in mentions ? r.mention : 'Passable';
      mentions[m]++;
    }

    const html = this.buildPalmaresHtml({
      patronatName: patronat.name,
      patronatTerritory: [patronat.territoryName, patronat.country?.name]
        .filter(Boolean)
        .join(' — '),
      examName: exam.name,
      examCode: exam.code,
      examType: exam.examType,
      level: exam.level,
      academicYear: board.academicYearLabel ?? '',
      juryName: board.deliberation?.juryName ?? null,
      publishedAt: board.deliberation?.publication?.publishedAt ?? null,
      stats: {
        total: board.stats.totalCandidates,
        admitted: board.stats.admissibles,
        failed: board.stats.ajournes,
        successRate:
          decided > 0 ? round2((board.stats.admissibles / decided) * 100) : 0,
      },
      mentions,
      rows,
      generatedAt: new Date(),
      docTitle: published ? 'LISTE DE DÉLIBÉRATION' : 'LISTE DE DÉLIBÉRATION (TRAVAIL)',
      docSubtitle: `Admissibles et ajournés — décision du jury · seuil ${board.rules.passMark}/20`,
      publicationLabel: 'Délibération',
      provisoire: !published,
    });

    const buffer = await this.renderPdf(html);
    const filename = `Liste_Deliberation_${exam.code}_${new Date().toISOString().split('T')[0]}.pdf`;

    await this.prisma.auditLog
      .create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_DELIBERATION_PDF',
          resource: 'NationalExam',
          resourceId: exam.id,
          tableName: 'national_exams',
          recordId: exam.id,
          newData: {
            examCode: exam.code,
            candidates: rows.length,
            admissibles: board.stats.admissibles,
            ajournes: board.stats.ajournes,
            published,
          },
        },
      })
      .catch(() => undefined);

    return { buffer, filename };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2 bis. LISTE OFFICIELLE DES CANDIDATS (2026-09-29)
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Liste officielle des candidats de l'examen (module Candidats) :
   * identité complète (nom, matricule, école de provenance, centre, salle,
   * n° de table, anonymat) — un tableau par centre, récapitulatif global,
   * mention de l'année scolaire et bloc de signatures officielles.
   */
  async generateCandidatesListPdf(
    tenantId: string,
    userId: string,
    examId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    const [academicYear, candidates] = await Promise.all([
      this.prisma.academicYear.findUnique({ where: { id: exam.academicYearId } }),
      this.prisma.examCandidate.findMany({
        where: { examId: exam.id, status: { not: 'CANCELLED' } },
        include: {
          center: { select: { code: true, name: true } },
          room: { select: { code: true, name: true } },
          schoolTenant: { select: { name: true } },
        },
        orderBy: [
          { center: { code: 'asc' } },
          { room: { code: 'asc' } },
          { tableNumber: 'asc' },
        ],
      }),
    ]);

    if (candidates.length === 0) {
      throw new BadRequestException('Aucun candidat enregistré pour cet examen.');
    }

    // ⭐ anonymatCode : colonne récente — lecture brute de secours si le
    //    client Prisma local n'a pas été régénéré (pattern federis-exams).
    let anonymatById = new Map<string, string | null>();
    try {
      const rows: any[] = (await this.prisma.$queryRawUnsafe(
        `SELECT "id", "anonymatCode" FROM "exam_candidates" WHERE "examId" = $1`,
        exam.id,
      )) as any[];
      anonymatById = new Map(rows.map((r) => [r.id, r.anonymatCode ?? null]));
    } catch {
      /* colonne absente → anonymats non affichés */
    }

    const rows = candidates.map((c, i) => ({
      order: i + 1,
      matricule: c.matricule,
      name: `${c.lastName} ${c.firstName}`,
      gender: c.gender,
      dob: formatDate(c.dateOfBirth),
      school: c.schoolTenant?.name ?? (c.metadata as any)?.schoolName ?? '—',
      center: c.center ? `${c.center.code} — ${c.center.name}` : 'Non affecté',
      room: c.room?.code ?? '—',
      tableNumber: c.tableNumber ?? '—',
      anonymat: (c as any).anonymatCode ?? anonymatById.get(c.id) ?? '—',
    }));

    // Regroupement par centre pour le récapitulatif
    const byCenter = new Map<string, number>();
    for (const r of rows) {
      byCenter.set(r.center, (byCenter.get(r.center) ?? 0) + 1);
    }

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 10.5px; }
            .doc { padding: 4px 6px; }
            .header { text-align: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 14px; }
            .header h1 { font-size: 17px; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; }
            .header .sub { font-size: 11px; color: #475569; margin-top: 3px; }
            .meta { display: flex; justify-content: space-between; font-size: 10px; color: #475569; margin-bottom: 10px; }
            .meta b { color: #1e293b; }
            h2 { font-size: 12.5px; color: #1e3a8a; margin: 14px 0 6px; border-left: 4px solid #d97706; padding-left: 8px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            th { background: #1e3a8a; color: #fff; font-size: 9px; text-transform: uppercase; padding: 5px 6px; text-align: left; font-weight: 600; }
            td { border: 1px solid #e2e8f0; padding: 4px 6px; font-size: 9.5px; }
            tr:nth-child(even) td { background: #f8fafc; }
            .center-cell { font-weight: 600; color: #1e3a8a; }
            .table-num { font-weight: 700; text-align: center; }
            .anonymat { font-family: 'Courier New', monospace; font-weight: 700; color: #92400e; }
            .summary { display: flex; gap: 8px; margin: 10px 0 4px; }
            .stat { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 9px; text-align: center; background: #f8fafc; }
            .stat .num { font-size: 15px; font-weight: 800; color: #1e3a8a; }
            .stat .lbl { font-size: 8px; text-transform: uppercase; color: #64748b; letter-spacing: 0.4px; }
            .signatures { margin-top: 26px; display: flex; justify-content: space-around; gap: 30px; }
            .sig { text-align: center; font-size: 9.5px; color: #334155; }
            .sig .line { margin-top: 38px; border-top: 1px solid #94a3b8; padding-top: 4px; width: 200px; }
            .footer-note { margin-top: 16px; font-size: 8.5px; color: #94a3b8; text-align: center; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="doc">
            <div class="header">
              <h1>${esc(patronat.legalName || patronat.name)}</h1>
              <div class="sub">${esc([patronat.territoryName, patronat.country?.name].filter(Boolean).join(' — '))}</div>
              <h1 style="margin-top:8px; font-size:14px;">Liste officielle des candidats</h1>
              <div class="sub">${esc(exam.name)} (${esc(exam.code)}) — ${esc(exam.examType)} — ${esc(academicYear?.label ?? academicYear?.name ?? '')}</div>
            </div>

            <div class="meta">
              <span>Établie le <b>${formatLongDate(new Date())}</b></span>
              <span>Candidats actifs : <b>${rows.length}</b></span>
              <span>Centres : <b>${byCenter.size}</b></span>
            </div>

            <div class="summary">
              <div class="stat"><div class="num">${rows.length}</div><div class="lbl">Candidats</div></div>
              <div class="stat"><div class="num">${byCenter.size}</div><div class="lbl">Centres</div></div>
              <div class="stat"><div class="num">${rows.filter((r) => r.tableNumber !== '—').length}</div><div class="lbl">Tables affectées</div></div>
              <div class="stat"><div class="num">${rows.filter((r) => r.anonymat !== '—').length}</div><div class="lbl">Anonymats émis</div></div>
            </div>

            <h2>Registre général (${esc(exam.code)})</h2>
            <table>
              <thead>
                <tr>
                  <th style="width:3%">N°</th>
                  <th style="width:13%">Matricule</th>
                  <th style="width:17%">Nom et prénoms</th>
                  <th style="width:3%">S</th>
                  <th style="width:6%">Naissance</th>
                  <th style="width:16%">École de provenance</th>
                  <th style="width:16%">Centre</th>
                  <th style="width:5%">Salle</th>
                  <th style="width:5%">Table</th>
                  <th style="width:9%">Anonymat</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map(
                    (r) => `<tr>
                      <td>${r.order}</td>
                      <td>${esc(r.matricule)}</td>
                      <td><b>${esc(r.name)}</b></td>
                      <td>${esc(r.gender === 'M' ? 'M' : r.gender === 'F' ? 'F' : '—')}</td>
                      <td>${esc(r.dob)}</td>
                      <td>${esc(r.school)}</td>
                      <td class="center-cell">${esc(r.center)}</td>
                      <td>${esc(r.room)}</td>
                      <td class="table-num">${esc(r.tableNumber)}</td>
                      <td class="anonymat">${esc(r.anonymat)}</td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>

            <h2>Répartition par centre</h2>
            <table>
              <thead>
                <tr><th style="width:70%">Centre d'examen</th><th style="width:30%">Effectif</th></tr>
              </thead>
              <tbody>
                ${[...byCenter.entries()]
                  .map(
                    ([center, count]) =>
                      `<tr><td class="center-cell">${esc(center)}</td><td class="table-num">${count}</td></tr>`,
                  )
                  .join('')}
              </tbody>
            </table>

            <div class="signatures">
              <div class="sig">Le/La Coordonnateur(trice)<div class="line"></div></div>
              <div class="sig">Le/La Secrétaire général(e)<div class="line"></div></div>
              <div class="sig">Le/La Président(e) du patronat<div class="line"></div></div>
            </div>

            <div class="footer-note">
              Document officiel généré par Academia Federis — ${esc(patronat.name)}.
              L'anonymat est utilisé pour la saisie des notes et la correction (identités masquées).
            </div>
          </div>
        </body>
      </html>
    `;

    const buffer = await this.renderPdf(html);
    const filename = `Liste_Officielle_Candidats_${exam.code}_${new Date().toISOString().split('T')[0]}.pdf`;

    await this.prisma.auditLog
      .create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_CANDIDATES_LIST_PDF',
          resource: 'NationalExam',
          resourceId: exam.id,
          tableName: 'national_exams',
          recordId: exam.id,
          newData: { examCode: exam.code, candidates: rows.length, centers: byCenter.size },
        },
      })
      .catch(() => undefined);

    return { buffer, filename };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 2bis. LISTES OFFICIELLES DU MODULE « CENTRES, SALLES & SURVEILLANTS »
  //       (2026-09-30 — demande utilisateur) — même design que la liste
  //       officielle des candidats : en-tête institutionnel, statistiques,
  //       tableaux professionnels, signatures et pied de document.
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Liste officielle des CENTRES D'ACCUEIL et de leurs SALLES —
   * sous-onglet « Centres et salles » (PDF généré 100 % backend).
   */
  async generateCentersListPdf(
    tenantId: string,
    userId: string,
    examId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    const [academicYear, centers] = await Promise.all([
      this.prisma.academicYear.findUnique({ where: { id: exam.academicYearId } }),
      this.prisma.examCenter.findMany({
        where: { examId: exam.id, status: { not: 'ARCHIVED' } },
        include: {
          _count: { select: { candidates: true } },
          examRooms: { orderBy: { code: 'asc' } },
        },
        orderBy: { code: 'asc' },
      }),
    ]);

    if (centers.length === 0) {
      throw new BadRequestException('Aucun centre enregistré pour cet examen.');
    }

    const totalRooms = centers.reduce((s, c) => s + c.examRooms.length, 0);
    const totalCapacity = centers.reduce(
      (s, c) => s + c.examRooms.reduce((x, r) => x + r.capacity, 0),
      0,
    );
    const totalAssigned = centers.reduce((s, c) => s + c._count.candidates, 0);

    const centerRows = centers
      .map(
        (c) => `<tr>
          <td class="mono">${esc(c.code)}</td>
          <td><b>${esc(c.name)}</b></td>
          <td>${esc(c.address ?? '—')}</td>
          <td>${esc(c.contactName ?? '—')}</td>
          <td>${esc(c.contactPhone ?? '—')}</td>
          <td class="table-num">${c.examRooms.length}</td>
          <td class="table-num">${c.examRooms.reduce((x, r) => x + r.capacity, 0)}</td>
          <td class="table-num">${c._count.candidates}</td>
          <td>${esc(logisticsStatusLabel(c.status))}</td>
        </tr>`,
      )
      .join('');

    const roomBlocks = centers
      .map(
        (c) => `
        <div class="center-block">
          <div class="cb-title">${esc(c.code)} — ${esc(c.name)}</div>
          <div class="cb-sub">${esc(c.address ?? 'Localité non renseignée')}${c.contactName ? ` · Chef de centre : ${esc(c.contactName)}` : ''}${c.contactPhone ? ` · ${esc(c.contactPhone)}` : ''}</div>
          ${
            c.examRooms.length === 0
              ? '<p class="no-room">Aucune salle enregistrée pour ce centre.</p>'
              : `<table>
            <thead>
              <tr>
                <th style="width:12%">Code</th>
                <th style="width:34%">Désignation</th>
                <th style="width:13%">Capacité</th>
                <th style="width:14%">Occupation</th>
                <th style="width:16%">Bâtiment / Étage</th>
                <th style="width:11%">Statut</th>
              </tr>
            </thead>
            <tbody>
              ${c.examRooms
                .map(
                  (r) => `<tr>
                <td class="mono">${esc(r.code)}</td>
                <td>${esc(r.name)}</td>
                <td class="table-num">${r.capacity} pl.</td>
                <td class="table-num">${r.currentOccupancy} / ${r.capacity}</td>
                <td>${esc([r.building, r.floor != null ? `Étage ${r.floor}` : null].filter(Boolean).join(' · ') || '—')}</td>
                <td>${esc(logisticsStatusLabel(r.status))}</td>
              </tr>`,
                )
                .join('')}
            </tbody>
          </table>`
          }
        </div>`,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 10.5px; }
            .doc { padding: 4px 6px; }
            .header { text-align: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 14px; }
            .header h1 { font-size: 17px; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; }
            .header .sub { font-size: 11px; color: #475569; margin-top: 3px; }
            .meta { display: flex; justify-content: space-between; font-size: 10px; color: #475569; margin-bottom: 10px; }
            .meta b { color: #1e293b; }
            h2 { font-size: 12.5px; color: #1e3a8a; margin: 14px 0 6px; border-left: 4px solid #d97706; padding-left: 8px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            th { background: #1e3a8a; color: #fff; font-size: 9px; text-transform: uppercase; padding: 5px 6px; text-align: left; font-weight: 600; }
            td { border: 1px solid #e2e8f0; padding: 4px 6px; font-size: 9.5px; }
            tr:nth-child(even) td { background: #f8fafc; }
            .mono { font-family: 'Courier New', monospace; font-weight: 700; color: #1e3a8a; }
            .table-num { font-weight: 700; text-align: center; }
            .summary { display: flex; gap: 8px; margin: 10px 0 4px; }
            .stat { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 9px; text-align: center; background: #f8fafc; }
            .stat .num { font-size: 15px; font-weight: 800; color: #1e3a8a; }
            .stat .lbl { font-size: 8px; text-transform: uppercase; color: #64748b; letter-spacing: 0.4px; }
            .center-block { border: 1px solid #e2e8f0; border-left: 4px solid #1e3a8a; border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; page-break-inside: avoid; }
            .center-block .cb-title { font-size: 11px; font-weight: 800; color: #1e3a8a; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.3px; }
            .center-block .cb-sub { font-size: 9px; color: #64748b; margin-bottom: 8px; }
            .no-room { font-size: 9.5px; color: #94a3b8; font-style: italic; padding: 4px 0; }
            .signatures { margin-top: 26px; display: flex; justify-content: space-around; gap: 30px; }
            .sig { text-align: center; font-size: 9.5px; color: #334155; }
            .sig .line { margin-top: 38px; border-top: 1px solid #94a3b8; padding-top: 4px; width: 200px; }
            .footer-note { margin-top: 16px; font-size: 8.5px; color: #94a3b8; text-align: center; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="doc">
            <div class="header">
              <h1>${esc(patronat.legalName || patronat.name)}</h1>
              <div class="sub">${esc([patronat.territoryName, patronat.country?.name].filter(Boolean).join(' — '))}</div>
              <h1 style="margin-top:8px; font-size:14px;">Liste des centres et des salles d'accueil</h1>
              <div class="sub">${esc(exam.name)} (${esc(exam.code)}) — ${esc(exam.examType)} — ${esc(academicYear?.label ?? academicYear?.name ?? '')}</div>
            </div>

            <div class="meta">
              <span>Établie le <b>${formatLongDate(new Date())}</b></span>
              <span>Centres : <b>${centers.length}</b></span>
              <span>Salles : <b>${totalRooms}</b></span>
            </div>

            <div class="summary">
              <div class="stat"><div class="num">${centers.length}</div><div class="lbl">Centres d'accueil</div></div>
              <div class="stat"><div class="num">${totalRooms}</div><div class="lbl">Salles</div></div>
              <div class="stat"><div class="num">${totalCapacity}</div><div class="lbl">Capacité (places)</div></div>
              <div class="stat"><div class="num">${totalAssigned}</div><div class="lbl">Candidats affectés</div></div>
            </div>

            <h2>Registre des centres (${esc(exam.code)})</h2>
            <table>
              <thead>
                <tr>
                  <th style="width:9%">Code</th>
                  <th style="width:20%">Établissement d'accueil</th>
                  <th style="width:19%">Adresse / Localité</th>
                  <th style="width:14%">Chef de centre</th>
                  <th style="width:11%">Téléphone</th>
                  <th style="width:6%">Salles</th>
                  <th style="width:7%">Capacité</th>
                  <th style="width:8%">Affectés</th>
                  <th style="width:6%">Statut</th>
                </tr>
              </thead>
              <tbody>${centerRows}</tbody>
            </table>

            <h2>Salles de composition par centre</h2>
            ${roomBlocks}

            <div class="signatures">
              <div class="sig">Le/La Coordonnateur(trice)<div class="line"></div></div>
              <div class="sig">Le/La Secrétaire général(e)<div class="line"></div></div>
              <div class="sig">Le/La Président(e) du patronat<div class="line"></div></div>
            </div>

            <div class="footer-note">
              Document officiel généré par Academia Federis — ${esc(patronat.name)}.
              Un examen peut mobiliser plusieurs centres d'accueil selon les besoins du terrain.
            </div>
          </div>
        </body>
      </html>
    `;

    const buffer = await this.renderPdf(html);
    const filename = `Liste_Centres_Salles_${exam.code}_${new Date().toISOString().split('T')[0]}.pdf`;

    await this.prisma.auditLog
      .create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_CENTERS_LIST_PDF',
          resource: 'NationalExam',
          resourceId: exam.id,
          tableName: 'national_exams',
          recordId: exam.id,
          newData: { examCode: exam.code, centers: centers.length, rooms: totalRooms },
        },
      })
      .catch(() => undefined);

    return { buffer, filename };
  }

  /**
   * Liste officielle du PERSONNEL D'EXAMEN — sous-onglet « Gestion des
   * surveillants ». Chaque poste dispose de sa liste À PART :
   *   ?post=SURVEILLANCE → surveillants des épreuves (centre + salle) ;
   *   ?post=SECRETARIAT  → personnel de secrétariat (saisie des notes) ;
   *   ?post=CORRECTION   → correcteurs ;
   *   (sans paramètre)   → personnel complet (colonne Poste).
   */
  async generateSupervisorsListPdf(
    tenantId: string,
    userId: string,
    examId: string,
    post?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { patronat, fn } = await this.resolveContext(tenantId, userId);
    this.assertRead(fn);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    const postFilter = normalizeLogisticsPost(post);

    const [academicYear, supervisors] = await Promise.all([
      this.prisma.academicYear.findUnique({ where: { id: exam.academicYearId } }),
      this.prisma.examSupervisor.findMany({
        where: {
          examId: exam.id,
          tenantId: patronat.tenantId,
          ...(postFilter ? { post: postFilter } : {}),
        },
        include: {
          center: { select: { code: true, name: true } },
          room: { select: { code: true, name: true } },
        },
        orderBy: [
          { center: { code: 'asc' } },
          { room: { code: 'asc' } },
          { lastName: 'asc' },
          { firstName: 'asc' },
        ],
      }),
    ]);

    if (supervisors.length === 0) {
      throw postFilter
        ? new BadRequestException(
            `Aucun personnel enregistré pour ce poste (${logisticsPostLabel(postFilter)}).`,
          )
        : new BadRequestException('Aucun surveillant enregistré pour cet examen.');
    }

    // Noms des écoles d'origine (nominations des écoles rattachées)
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

    const rows = supervisors.map((s, i) => ({
      order: i + 1,
      name: `${s.lastName} ${s.firstName}`,
      phone: s.phone ?? '—',
      school: s.schoolTenantId ? (schoolNameById.get(s.schoolTenantId) ?? 'École') : '—',
      center: s.center ? `${s.center.code} — ${s.center.name}` : 'Non affecté',
      room: s.room ? `${s.room.code} — ${s.room.name}` : '—',
      post: logisticsPostLabel(s.post),
      role: logisticsRoleLabel(s.role),
      source: s.source === 'SCHOOL_NOMINATION' ? 'Nomination d\u2019école' : 'Saisie patronat',
    }));

    const byCenter = new Map<string, number>();
    for (const r of rows) {
      byCenter.set(r.center, (byCenter.get(r.center) ?? 0) + 1);
    }

    const docTitle = logisticsPostDocTitle(postFilter);
    const postCol = postFilter
      ? ''
      : '<th style="width:12%">Poste</th>';
    const postCell = (r: (typeof rows)[number]) => (postFilter ? '' : `<td class="post-cell">${esc(r.post)}</td>`);

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 10.5px; }
            .doc { padding: 4px 6px; }
            .header { text-align: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 14px; }
            .header h1 { font-size: 17px; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; }
            .header .sub { font-size: 11px; color: #475569; margin-top: 3px; }
            .meta { display: flex; justify-content: space-between; font-size: 10px; color: #475569; margin-bottom: 10px; }
            .meta b { color: #1e293b; }
            h2 { font-size: 12.5px; color: #1e3a8a; margin: 14px 0 6px; border-left: 4px solid #d97706; padding-left: 8px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            th { background: #1e3a8a; color: #fff; font-size: 9px; text-transform: uppercase; padding: 5px 6px; text-align: left; font-weight: 600; }
            td { border: 1px solid #e2e8f0; padding: 4px 6px; font-size: 9.5px; }
            tr:nth-child(even) td { background: #f8fafc; }
            .center-cell { font-weight: 600; color: #1e3a8a; }
            .post-cell { font-weight: 600; color: #92400e; }
            .table-num { font-weight: 700; text-align: center; }
            .summary { display: flex; gap: 8px; margin: 10px 0 4px; }
            .stat { flex: 1; border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 9px; text-align: center; background: #f8fafc; }
            .stat .num { font-size: 15px; font-weight: 800; color: #1e3a8a; }
            .stat .lbl { font-size: 8px; text-transform: uppercase; color: #64748b; letter-spacing: 0.4px; }
            .signatures { margin-top: 26px; display: flex; justify-content: space-around; gap: 30px; }
            .sig { text-align: center; font-size: 9.5px; color: #334155; }
            .sig .line { margin-top: 38px; border-top: 1px solid #94a3b8; padding-top: 4px; width: 200px; }
            .footer-note { margin-top: 16px; font-size: 8.5px; color: #94a3b8; text-align: center; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="doc">
            <div class="header">
              <h1>${esc(patronat.legalName || patronat.name)}</h1>
              <div class="sub">${esc([patronat.territoryName, patronat.country?.name].filter(Boolean).join(' — '))}</div>
              <h1 style="margin-top:8px; font-size:14px;">${esc(docTitle)}</h1>
              <div class="sub">${esc(exam.name)} (${esc(exam.code)}) — ${esc(exam.examType)} — ${esc(academicYear?.label ?? academicYear?.name ?? '')}</div>
            </div>

            <div class="meta">
              <span>Établie le <b>${formatLongDate(new Date())}</b></span>
              <span>Effectif : <b>${rows.length}</b></span>
              <span>Centres mobilisés : <b>${byCenter.size}</b></span>
            </div>

            <div class="summary">
              <div class="stat"><div class="num">${rows.length}</div><div class="lbl">Effectif</div></div>
              <div class="stat"><div class="num">${byCenter.size}</div><div class="lbl">Centres mobilisés</div></div>
              <div class="stat"><div class="num">${rows.filter((r) => r.school !== '—').length}</div><div class="lbl">Nominations d'écoles</div></div>
              <div class="stat"><div class="num">${rows.filter((r) => r.school === '—').length}</div><div class="lbl">Saisies patronat</div></div>
            </div>

            <h2>${esc(docTitle)} (${esc(exam.code)})</h2>
            <table>
              <thead>
                <tr>
                  <th style="width:3%">N°</th>
                  <th style="width:17%">Nom et prénoms</th>
                  <th style="width:10%">Téléphone</th>
                  <th style="width:16%">École de provenance</th>
                  <th style="width:18%">Centre d'affectation</th>
                  <th style="width:11%">Salle</th>
                  ${postCol}
                  <th style="width:10%">Rôle</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map(
                    (r) => `<tr>
                      <td>${r.order}</td>
                      <td><b>${esc(r.name)}</b></td>
                      <td>${esc(r.phone)}</td>
                      <td>${esc(r.school)}</td>
                      <td class="center-cell">${esc(r.center)}</td>
                      <td>${esc(r.room)}</td>
                      ${postCell(r)}
                      <td>${esc(r.role)}</td>
                    </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>

            <h2>Répartition par centre</h2>
            <table>
              <thead>
                <tr><th style="width:70%">Centre d'accueil</th><th style="width:30%">Effectif</th></tr>
              </thead>
              <tbody>
                ${[...byCenter.entries()]
                  .map(
                    ([center, count]) =>
                      `<tr><td class="center-cell">${esc(center)}</td><td class="table-num">${count}</td></tr>`,
                  )
                  .join('')}
              </tbody>
            </table>

            <div class="signatures">
              <div class="sig">Le/La Coordonnateur(trice)<div class="line"></div></div>
              <div class="sig">Le/La Secrétaire général(e)<div class="line"></div></div>
              <div class="sig">Le/La Président(e) du patronat<div class="line"></div></div>
            </div>

            <div class="footer-note">
              Document officiel généré par Academia Federis — ${esc(patronat.name)}.
              ${postFilter ? esc(logisticsPostLabel(postFilter)) : 'Surveillance des épreuves, correction et secrétariat (saisie des notes)'}.
            </div>
          </div>
        </body>
      </html>
    `;

    const buffer = await this.renderPdf(html);
    const fileSuffix =
      postFilter === 'CORRECTION'
        ? 'Correcteurs'
        : postFilter === 'SECRETARIAT'
          ? 'Secretariat'
          : postFilter === 'SURVEILLANCE'
            ? 'Surveillants'
            : 'Personnel';
    const filename = `Liste_${fileSuffix}_${exam.code}_${new Date().toISOString().split('T')[0]}.pdf`;

    await this.prisma.auditLog
      .create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_SUPERVISORS_LIST_PDF',
          resource: 'NationalExam',
          resourceId: exam.id,
          tableName: 'national_exams',
          recordId: exam.id,
          newData: { examCode: exam.code, post: postFilter ?? 'ALL', count: rows.length },
        },
      })
      .catch(() => undefined);

    return { buffer, filename };
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. RENDU PDF (pattern Helm — PuppeteerPool + retry)
  // ══════════════════════════════════════════════════════════════════════

  private async renderPdf(html: string, opts?: { landscape?: boolean }): Promise<Buffer> {
    // ⭐ landscape : relevés de notes (module Notes et Moyennes) — même format
    //    A4 PAYSAGE que les bulletins Helm (bulletin-pdf.service.ts).
    const pdfOptions = {
      format: 'A4' as const,
      landscape: opts?.landscape === true,
      printBackground: true,
      margin: opts?.landscape
        ? { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
        : { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
    };

    const setContent = async (page: any) => {
      // 'domcontentloaded' : les templates Federis n'embarquent aucune
      // ressource externe (logo en data-URL uniquement) — inutile d'attendre
      // networkidle (pattern contract-pdf.service.ts).
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise((resolve) => setTimeout(resolve, 500));
    };

    const generateFromPage = async (page: any): Promise<Buffer> => {
      await setContent(page);
      const pdf = await page.pdf(pdfOptions);
      return Buffer.from(pdf);
    };

    try {
      const { page } = await this.puppeteerPool.acquirePage();
      try {
        return await generateFromPage(page);
      } finally {
        await this.puppeteerPool.releasePage(page);
      }
    } catch (acquireError: any) {
      this.logger.error(
        `Puppeteer acquire/render failed: ${acquireError?.message || acquireError}`,
      );
      try {
        await this.puppeteerPool.closeBrowser();
        this.logger.log('Browser pool reset, retrying PDF generation...');
        const { page } = await this.puppeteerPool.acquirePage();
        try {
          return await generateFromPage(page);
        } finally {
          await this.puppeteerPool.releasePage(page);
        }
      } catch (retryError: any) {
        this.logger.error(`PDF retry also failed: ${retryError?.message || retryError}`);
        throw new Error(
          `Le service de rendu PDF est indisponible. Détail : ${retryError?.message || 'Erreur inconnue'}`,
        );
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. TEMPLATES HTML (design officiel — même exigence que les PDF Helm)
  // ══════════════════════════════════════════════════════════════════════

  /** En-tête commun aux documents officiels Federis. */
  private buildDocHeader(d: {
    patronatName: string;
    patronatTerritory: string;
    examName: string;
    examCode: string;
    examType: string;
    level: string;
    academicYear: string;
    docTitle: string;
    subtitle?: string;
  }): string {
    return `
    <div class="doc-header">
      <div class="org">
        <div class="org-name">${esc(d.patronatName)}</div>
        <div class="org-sub">${esc(d.patronatTerritory || 'Academia Federis')}</div>
        <div class="org-sub">Année scolaire ${esc(d.academicYear || '—')}</div>
      </div>
      <div class="doc-title">
        <div class="doc-kind">${esc(d.docTitle)}</div>
        ${d.subtitle ? `<div class="doc-subtitle">${esc(d.subtitle)}</div>` : ''}
      </div>
      <div class="exam-box">
        <div class="exam-name">${esc(d.examName)}</div>
        <div class="exam-meta">Code : <strong>${esc(d.examCode)}</strong> · ${esc(d.examType)} · ${esc(d.level)}</div>
      </div>
    </div>`;
  }

  /** Template des bordereaux d'émargement (une page par salle). */
  private buildBordereauHtml(d: {
    patronatName: string;
    patronatTerritory: string;
    examName: string;
    examCode: string;
    examType: string;
    level: string;
    period: string;
    academicYear: string;
    generatedAt: Date;
    sections: BordereauSection[];
    totalCandidates: number;
  }): string {
    const sectionsHtml = d.sections
      .map((s, idx) => {
        const rows = s.candidates
          .map(
            (c, i) => `
        <tr>
          <td class="c">${i + 1}</td>
          <td class="c mono">${esc(c.tableNumber ?? '—')}</td>
          <td class="mono">${esc(c.matricule)}</td>
          <td class="name">${esc(c.name)}</td>
          <td class="c">${esc(c.gender === 'FEMALE' || c.gender === 'F' ? 'F' : c.gender === 'MALE' || c.gender === 'M' ? 'M' : '—')}</td>
          <td class="school">${esc(c.school)}</td>
          <td class="sign"></td>
        </tr>`,
          )
          .join('');

        return `
      <section class="sheet ${idx > 0 ? 'page-break' : ''}">
        ${this.buildDocHeader({
          patronatName: d.patronatName,
          patronatTerritory: d.patronatTerritory,
          examName: d.examName,
          examCode: d.examCode,
          examType: d.examType,
          level: d.level,
          academicYear: d.academicYear,
          docTitle: "BORDEREAU D'ÉMARGEMENT",
          subtitle: `Session du ${esc(d.period)}`,
        })}

        <table class="info">
          <tr>
            <td><span class="lbl">Centre d'examen</span>${esc(s.centerName)} <span class="muted">(${esc(s.centerCode)})</span></td>
            <td><span class="lbl">Salle</span>${esc(s.roomName)} <span class="muted">(${esc(s.roomCode)})</span></td>
            <td><span class="lbl">Capacité</span>${esc(s.capacity)}</td>
            <td><span class="lbl">Effectif présent</span><span class="fill"></span></td>
          </tr>
        </table>

        <table class="grid">
          <thead>
            <tr>
              <th class="c" style="width:6%">N°</th>
              <th class="c" style="width:10%">N° Table</th>
              <th style="width:18%">Matricule</th>
              <th style="width:26%">Noms et Prénoms</th>
              <th class="c" style="width:6%">Sexe</th>
              <th style="width:20%">École d'origine</th>
              <th style="width:14%">Émargement</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="total-row">
              <td colspan="6" style="text-align:right">TOTAL — ${esc(s.candidates.length)} candidat(s)</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig">
            <div class="sig-title">Le/La Surveillant(e)</div>
            <div class="sig-hint">Nom et signature</div>
          </div>
          <div class="sig">
            <div class="sig-title">Le/La Chef(fe) de Centre</div>
            <div class="sig-hint">Nom et signature</div>
          </div>
          <div class="sig">
            <div class="sig-title">Visa de l'Organisation</div>
            <div class="sig-hint">Cachet du patronat</div>
          </div>
        </div>
      </section>`;
      })
      .join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; font-size: 10.5px; }
  .page-break { page-break-before: always; }

  /* ── En-tête document ── */
  .doc-header { display: flex; align-items: stretch; border: 2px solid #0b2f73; border-radius: 6px; overflow: hidden; margin-bottom: 10px; }
  .org { flex: 1; padding: 8px 10px; background: #f0f4fa; border-right: 1px solid #0b2f73; }
  .org-name { font-size: 12.5px; font-weight: 800; color: #0b2f73; text-transform: uppercase; line-height: 1.25; }
  .org-sub { font-size: 8.5px; color: #475569; margin-top: 2px; }
  .doc-title { flex: 1.1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 8px; text-align: center; background: #0b2f73; color: #fff; }
  .doc-kind { font-size: 14px; font-weight: 900; letter-spacing: 1px; }
  .doc-subtitle { font-size: 8.5px; margin-top: 3px; color: #fde68a; }
  .exam-box { flex: 1; padding: 8px 10px; display: flex; flex-direction: column; justify-content: center; border-left: 1px solid #0b2f73; background: #f0f4fa; }
  .exam-name { font-size: 11px; font-weight: 700; color: #0b2f73; line-height: 1.2; }
  .exam-meta { font-size: 8.5px; color: #475569; margin-top: 3px; }
  .exam-meta strong { color: #0b2f73; }

  /* ── Bloc infos centre/salle ── */
  .info { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  .info td { border: 1px solid #cbd5e1; padding: 5px 8px; background: #f8fafc; width: 25%; font-size: 9.5px; }
  .info .lbl { display: block; font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; margin-bottom: 2px; }
  .info .fill { display: inline-block; min-width: 60px; border-bottom: 1px dotted #94a3b8; }
  .muted { color: #64748b; }

  /* ── Table des candidats ── */
  .grid { width: 100%; border-collapse: collapse; }
  .grid th { background: #0b2f73; color: #fff; font-size: 9px; padding: 6px 5px; border: 1px solid #0b2f73; text-align: left; text-transform: uppercase; letter-spacing: 0.4px; }
  .grid td { border: 1px solid #cbd5e1; padding: 5px 6px; font-size: 10px; vertical-align: middle; }
  .grid tbody tr:nth-child(even) td { background: #f8fafc; }
  .grid .c { text-align: center; }
  .grid .mono { font-family: 'Courier New', monospace; font-size: 9.5px; }
  .grid .name { font-weight: 600; }
  .grid .school { font-size: 9px; color: #334155; }
  .grid .sign { height: 24px; }
  .grid .total-row td { background: #e8eef8 !important; font-weight: 800; color: #0b2f73; padding: 6px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }

  /* ── Signatures ── */
  .signatures { display: flex; justify-content: space-between; gap: 14px; margin-top: 22px; page-break-inside: avoid; }
  .sig { flex: 1; text-align: center; }
  .sig-title { font-size: 10px; font-weight: 700; color: #0b2f73; }
  .sig-hint { font-size: 8px; color: #64748b; margin: 46px 8px 0 8px; border-top: 1px solid #334155; padding-top: 3px; }

  .footnote { margin-top: 12px; font-size: 7.5px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
${sectionsHtml}
<div class="footnote">
  Document généré par Academia Federis le ${esc(d.generatedAt.toLocaleDateString('fr-FR'))} à ${esc(d.generatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))} — ${esc(d.totalCandidates)} candidat(s) au total.
</div>
</body>
</html>`;
  }

  /** Template du palmarès officiel. */
  private buildPalmaresHtml(d: {
    patronatName: string;
    patronatTerritory: string;
    examName: string;
    examCode: string;
    examType: string;
    level: string;
    academicYear: string;
    juryName: string | null;
    publishedAt: string | null;
    stats: { total: number; admitted: number; failed: number; successRate: number };
    mentions: Record<string, number>;
    rows: PalmaresRow[];
    generatedAt: Date;
    /** Titre du document (défaut « PALMARÈS OFFICIEL »). */
    docTitle?: string;
    /** Sous-titre du document. */
    docSubtitle?: string;
    /** Libellé de la ligne « Publication » de la barre d'état. */
    publicationLabel?: string;
    /** Bandeau provisoire (document de travail avant publication). */
    provisoire?: boolean;
  }): string {
    const docTitle = d.docTitle ?? 'PALMARÈS OFFICIEL';
    const docSubtitle = d.docSubtitle ?? 'Résultats définitifs après délibération du jury';
    const publicationLabel = d.publicationLabel ?? 'Publication';
    const rowsHtml = d.rows
      .map((r) => {
        const admitted = r.decision === 'ADMIS';
        return `
        <tr class="${admitted ? '' : 'failed'}">
          <td class="c rank">${admitted ? esc(r.rank ?? '—') : '—'}</td>
          <td class="mono">${esc(r.matricule)}</td>
          <td class="name">${esc(r.name)}</td>
          <td class="school">${esc(r.school)}</td>
          <td class="c avg">${r.average != null ? formatNumber(r.average) : '—'}</td>
          <td class="c">${esc(r.mention ?? '—')}</td>
          <td class="c decision ${admitted ? 'admitted' : ''}">${esc(r.decisionLabel ?? (admitted ? 'ADMIS' : 'AJOURNÉ'))}</td>
        </tr>`;
      })
      .join('');

    const mentionRows = Object.entries(d.mentions)
      .map(
        ([label, count]) => `
        <div class="mention">
          <span class="mention-count">${esc(count)}</span>
          <span class="mention-label">${esc(label)}</span>
        </div>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; font-size: 10.5px; }

  .doc-header { display: flex; align-items: stretch; border: 2px solid #0b2f73; border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
  .org { flex: 1; padding: 8px 10px; background: #f0f4fa; border-right: 1px solid #0b2f73; }
  .org-name { font-size: 12.5px; font-weight: 800; color: #0b2f73; text-transform: uppercase; line-height: 1.25; }
  .org-sub { font-size: 8.5px; color: #475569; margin-top: 2px; }
  .doc-title { flex: 1.1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 8px; text-align: center; background: #0b2f73; color: #fff; }
  .doc-kind { font-size: 15px; font-weight: 900; letter-spacing: 2px; }
  .doc-subtitle { font-size: 8.5px; margin-top: 3px; color: #fde68a; }
  .exam-box { flex: 1; padding: 8px 10px; display: flex; flex-direction: column; justify-content: center; border-left: 1px solid #0b2f73; background: #f0f4fa; }
  .exam-name { font-size: 11px; font-weight: 700; color: #0b2f73; line-height: 1.2; }
  .exam-meta { font-size: 8.5px; color: #475569; margin-top: 3px; }
  .exam-meta strong { color: #0b2f73; }

  .publish-bar { display: flex; justify-content: space-between; align-items: center; background: #f0f4fa; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; font-size: 9.5px; color: #334155; }
  .publish-bar strong { color: #0b2f73; }

  .stats { display: flex; gap: 10px; margin-bottom: 12px; }
  .stat { flex: 1; border: 1px solid #cbd5e1; border-top: 3px solid #0b2f73; border-radius: 4px; padding: 8px 10px; text-align: center; background: #f8fafc; }
  .stat.gold { border-top-color: #f5b335; }
  .stat-value { font-size: 20px; font-weight: 900; color: #0b2f73; line-height: 1.1; }
  .stat-value small { font-size: 11px; font-weight: 700; }
  .stat-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; margin-top: 3px; font-weight: 700; }

  .mentions { display: flex; gap: 8px; margin-bottom: 12px; }
  .mention { flex: 1; border: 1px solid #e2e8f0; border-radius: 4px; padding: 5px 6px; text-align: center; background: #fff; }
  .mention-count { display: block; font-size: 13px; font-weight: 800; color: #0b2f73; }
  .mention-label { display: block; font-size: 7.5px; text-transform: uppercase; color: #64748b; margin-top: 1px; font-weight: 600; }

  .grid { width: 100%; border-collapse: collapse; }
  .grid th { background: #0b2f73; color: #fff; font-size: 9px; padding: 6px 5px; border: 1px solid #0b2f73; text-align: left; text-transform: uppercase; letter-spacing: 0.4px; }
  .grid td { border: 1px solid #cbd5e1; padding: 5px 6px; font-size: 10px; vertical-align: middle; }
  .grid tbody tr:nth-child(even) td { background: #f8fafc; }
  .grid .c { text-align: center; }
  .grid .mono { font-family: 'Courier New', monospace; font-size: 9.5px; }
  .grid .name { font-weight: 600; }
  .grid .school { font-size: 9px; color: #334155; }
  .grid .rank { font-weight: 800; color: #0b2f73; }
  .grid .avg { font-weight: 700; }
  .grid tr.failed td { color: #64748b; background: #f8fafc; }
  .grid .decision { font-size: 9px; font-weight: 800; letter-spacing: 0.5px; color: #94a3b8; }
  .grid .decision.admitted { color: #047857; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }

  .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 30px; page-break-inside: avoid; }
  .sig { flex: 1; text-align: center; }
  .sig-title { font-size: 10.5px; font-weight: 700; color: #0b2f73; }
  .sig-sub { font-size: 8.5px; color: #64748b; margin-top: 1px; }
  .sig-hint { font-size: 8px; color: #64748b; margin: 52px 20px 0 20px; border-top: 1px solid #334155; padding-top: 3px; }

  .footnote { margin-top: 14px; font-size: 7.5px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 6px; }
</style>
</head>
<body>
  <div class="doc-header">
    <div class="org">
      <div class="org-name">${esc(d.patronatName)}</div>
      <div class="org-sub">${esc(d.patronatTerritory || 'Academia Federis')}</div>
      <div class="org-sub">Année scolaire ${esc(d.academicYear || '—')}</div>
    </div>
    <div class="doc-title">
      <div class="doc-kind">${esc(docTitle)}</div>
      <div class="doc-subtitle">${esc(docSubtitle)}</div>
      ${d.provisoire ? '<div class="doc-subtitle" style="color:#fbbf24; font-weight:800;">DOCUMENT PROVISOIRE — résultats non encore publiés</div>' : ''}
    </div>
    <div class="exam-box">
      <div class="exam-name">${esc(d.examName)}</div>
      <div class="exam-meta">Code : <strong>${esc(d.examCode)}</strong> · ${esc(d.examType)} · ${esc(d.level)}</div>
    </div>
  </div>

  <div class="publish-bar">
    <span>Jury : <strong>${esc(d.juryName ?? 'Jury de délibération')}</strong></span>
    <span>${esc(publicationLabel)} : <strong>${esc(d.publishedAt ? formatDate(d.publishedAt) : '—')}</strong></span>
    <span>Établi le ${esc(formatLongDate(d.generatedAt))}</span>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-value">${esc(d.stats.total)}</div><div class="stat-label">Candidats notés</div></div>
    <div class="stat gold"><div class="stat-value">${esc(d.stats.admitted)}</div><div class="stat-label">Admis</div></div>
    <div class="stat"><div class="stat-value">${esc(d.stats.failed)}</div><div class="stat-label">Ajournés</div></div>
    <div class="stat gold"><div class="stat-value">${formatNumber(d.stats.successRate, 1)}<small> %</small></div><div class="stat-label">Taux de réussite</div></div>
  </div>

  <div class="mentions">${mentionRows}</div>

  <table class="grid">
    <thead>
      <tr>
        <th class="c" style="width:7%">Rang</th>
        <th style="width:17%">Matricule</th>
        <th style="width:27%">Noms et Prénoms</th>
        <th style="width:23%">École d'origine</th>
        <th class="c" style="width:10%">Moyenne /20</th>
        <th class="c" style="width:10%">Mention</th>
        <th class="c" style="width:11%">Décision</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="signatures">
    <div class="sig">
      <div class="sig-title">Le/La Coordonnateur(trice)</div>
      <div class="sig-sub">Du patronat organisateur</div>
      <div class="sig-hint">Nom, signature et cachet</div>
    </div>
    <div class="sig">
      <div class="sig-title">Le/La Président(e) du Jury</div>
      <div class="sig-sub">Délibération ${esc(d.examCode)}</div>
      <div class="sig-hint">Nom et signature</div>
    </div>
  </div>

  <div class="footnote">
    Palmarès officiel généré par Academia Federis le ${esc(d.generatedAt.toLocaleDateString('fr-FR'))} — toute réclamation se fait auprès du patronat organisateur dans les délais réglementaires.
  </div>
</body>
</html>`;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. RELEVÉS DE NOTES (module « Notes et Moyennes » — 2026-09-29)
  //    « Bulletin » dans Academia Helm → « Relevé de notes » dans Federis :
  //      · CEP          → modèle du PRIMAIRE (sans coefficients) ;
  //      · BEPC/BAC/CAP → modèle du SECONDAIRE avec coefficients
  //        (note coefficient = note × coefficient, moyenne pondérée).
  //    Rendu A4 PAYSAGE (même format que bulletin-pdf.service.ts Helm).
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Génère le relevé de notes d'UN candidat (candidateId) ou de TOUS les
   * candidats de l'examen (un relevé par page). Les calculs (moyennes, rangs,
   * coefficients, mentions) sont partagés avec la grille et le registre via
   * FederisGradesService.getReleves — aucune duplication de règle métier.
   */
  async generateRelevePdf(
    tenantId: string,
    userId: string,
    examId: string,
    candidateId?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { patronat } = await this.resolveContext(tenantId, userId);
    const data = await this.gradesService.getReleves(tenantId, userId, examId, candidateId);
    if (!data.releves || data.releves.length === 0) {
      throw new BadRequestException(
        'Aucun relevé à générer — saisissez d\u2019abord les notes (onglet Saisie des notes).',
      );
    }

    const isPrimary = data.exam.isPrimary === true;
    const exam = await this.getOwnedExam(patronat.tenantId, examId);

    // ⭐ En-tête patronat du relevé officiel (remplace le bloc ministériel).
    const header = await this.gradesService.loadPatronatHeaderInfo(patronat.tenantId);

    const sections = data.releves
      .map((releve, idx) =>
        isPrimary
          ? this.buildReleveCepSection(releve, header, idx)
          : this.buildReleveSecondaireSection(releve, header, idx),
      )
      .join('');

    const html = this.buildReleveOfficialDocumentHtml(sections);

    const buffer = await this.renderPdf(html, { landscape: false });
    const dateTag = new Date().toISOString().split('T')[0];
    const filename = candidateId
      ? `Releve_Notes_${exam.code}_${data.releves[0].candidate.matricule}_${dateTag}.pdf`
      : `Releves_Notes_${exam.code}_${dateTag}.pdf`;

    await this.prisma.auditLog
      .create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_RELEVES_PDF',
          resource: 'NationalExam',
          resourceId: exam.id,
          tableName: 'exam_results',
          recordId: exam.id,
          newData: {
            examCode: exam.code,
            model: isPrimary ? 'PRIMAIRE (CEP)' : 'SECONDAIRE (coefficients)',
            releves: data.releves.length,
            single: Boolean(candidateId),
          },
        },
      })
      .catch(() => undefined);

    return { buffer, filename };
  }

  /**
   * ⭐ Relevé de notes — accès ÉCOLE (2026-09-30) : génère le PDF d'un relevé
   * distribué pour l'établissement Helm qui a présenté le candidat. Garde-fous :
   *   1. le candidat appartient à l'école (ExamCandidate.schoolTenantId) ;
   *   2. le relevé a été distribué à l'école (ExamDocument RELEVE_NOTES PUBLISHED).
   * Le rendu est IDENTIQUE au PDF patronat (même template, mêmes calculs via
   * le dataset du patronat propriétaire de l'examen).
   */
  async generateRelevePdfForSchool(
    schoolTenantId: string,
    userId: string,
    examId: string,
    candidateId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    // 1-2. Vérifications d'accès école (appartenance + distribution)
    const schoolData = await this.gradesService.getReleveForSchool(
      schoolTenantId,
      userId,
      examId,
      candidateId,
    );
    const releve = schoolData.releve;
    if (!releve) {
      throw new BadRequestException('Aucun relevé disponible pour ce candidat.');
    }

    // Identité du patronat organisateur (en-tête du document officiel)
    const exam = await this.prisma.nationalExam.findUnique({
      where: { id: examId },
      select: { id: true, code: true, name: true, examType: true, level: true, tenantId: true },
    });
    if (!exam) throw new NotFoundException('Examen introuvable.');

    const isPrimary = schoolData.exam?.isPrimary === true;
    // ⭐ En-tête patronat du relevé officiel (remplace le bloc ministériel).
    const header = await this.gradesService.loadPatronatHeaderInfo(exam.tenantId);
    const sections = isPrimary
      ? this.buildReleveCepSection(releve, header, 0)
      : this.buildReleveSecondaireSection(releve, header, 0);

    const html = this.buildReleveOfficialDocumentHtml(sections);

    const buffer = await this.renderPdf(html, { landscape: false });
    const dateTag = new Date().toISOString().split('T')[0];
    const filename = `Releve_Notes_${exam.code}_${releve.candidate.matricule}_${dateTag}.pdf`;

    // Audit côté école (traçabilité du téléchargement)
    await this.prisma.auditLog
      .create({
        data: {
          tenantId: schoolTenantId,
          userId,
          action: 'FEDERIS_SCHOOL_RELEVE_PDF',
          resource: 'ExamDocument',
          resourceId: candidateId,
          tableName: 'exam_documents',
          recordId: examId,
          newData: {
            examCode: exam.code,
            candidate: `${releve.candidate.firstName} ${releve.candidate.lastName}`,
            matricule: releve.candidate.matricule,
          },
        },
      })
      .catch(() => undefined);

    return { buffer, filename };
  }

  /** Note formatée : 15 → « 15 », 12.5 → « 12.50 », null → « — ». */
  private fmtNote(n: number | null | undefined): string {
    if (n === null || n === undefined || !Number.isFinite(n)) return '—';
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }

  /** Visuel ABS (rouge) pour une absence. */
  private absOr(value: string, isAbsent: boolean): string {
    return isAbsent ? '<span class="abs">ABS</span>' : value;
  }


  // ════════════════════════════════════════════════════════════════════════
  // ⭐ 2026-10-01 — RELEVÉS DE NOTES OFFICIELS (modèles CEP / BEPC-BAC-CAP)
  // Reproduction fidèle des relevés officiels : en-tête PATRONAT (à la place
  // du bloc ministériel), état civil complet du candidat, tableau officiel
  // (CEP : CM/18, minimale exigée, perfectionnement — BEPC/BAC/CAP : coef,
  // note/20, note coef, BILAN), DÉCISION DU JURY et signature du
  // coordonnateur du patronat.
  // ════════════════════════════════════════════════════════════════════════

  /** Note officielle du relevé : 2 décimales avec zéro de tête (00.00, 01.25, 12.50). */
  private fmtReleveNote(n: number | null | undefined): string {
    if (n === null || n === undefined || !Number.isFinite(n)) return '—';
    const v = Math.round(n * 100) / 100;
    const s = Math.abs(v).toFixed(2);
    return (v < 10 && v >= 0 ? '0' : '') + s;
  }

  /** Total du BILAN (2 décimales, sans zéro de tête : 50.00, 232.00, 11.60). */
  private fmtBilan(n: number | null | undefined): string {
    if (n === null || n === undefined || !Number.isFinite(n)) return '—';
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  /** Date de naissance « 17/08/2014 à Ganou » (— si inconnue). */
  private fmtNaissance(dob: Date | string | null | undefined, place: string | null | undefined): string {
    if (!dob) return place ? `à ${place}` : '—';
    const d = new Date(dob);
    const date = Number.isNaN(d.getTime())
      ? String(dob)
      : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return place ? `${date} à ${place}` : date;
  }

  /** Sexe long (BEPC : Masculin / Féminin) et court (CEP : M / F). */
  private genderShort(g: string | null | undefined): string {
    return g === 'F' || g === 'FEMALE' || g === 'Feminin' ? 'F' : g ? 'M' : '—';
  }
  private genderLong(g: string | null | undefined): string {
    return g === 'F' || g === 'FEMALE' ? 'Féminin' : g ? 'Masculin' : '—';
  }

  /** Bloc organisation (gauche de l'en-tête) — PATRONAT à la place du
   *  ministère : nom, territoire, coordination des examens. */
  private releveOrgBlock(header: any, compact = false): string {
    const territory = header?.territoryName
      ? `D\u00e9partement ${header.territoryName}`
      : header?.country ?? '';
    const lines = compact
      ? [esc(String(header?.name ?? 'Patronat').toUpperCase()), esc(territory)]
      : [
          esc(String(header?.name ?? 'Patronat').toUpperCase()),
          esc(territory),
          'COORDINATION DES EXAMENS ET CONCOURS',
        ];
    const sep = '<div class="org-sep">------------------</div>';
    return lines.map((l) => `<div class="org-line">${l}</div>`).join(sep);
  }

  /** Ligne « N° … » du relevé officiel (référence du document). */
  private releveRefNumber(releve: any): string {
    return `N\u00b0 ${esc(releve.candidate?.registrationNumber ?? releve.candidate?.matricule ?? '')}/${esc(releve.examCode ?? '')}`;
  }

  /** Bloc date + signature (coordonnateur du patronat). */
  private releveSignatureBlock(header: any): string {
    const place = header?.place || header?.territoryName || '';
    const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `
    <div class="sig-block">
      <div class="sig-place">${esc(place)}${place ? ', ' : ''}le ${esc(date)}</div>
      <div class="sig-title">LE COORDONNATEUR DU PATRONAT</div>
      <div class="sig-space"></div>
      <div class="sig-name">${esc((header?.coordinatorName ?? '').toUpperCase())}</div>
    </div>`;
  }

  /** État civil du candidat — lignes libellé / valeur du relevé officiel. */
  private releveCivilRows(c: any, rows: Array<[string, string]>): string {
    return rows
      .map(([label, value]) => `<tr><td class="lbl">${esc(label)}</td><td class="val">${esc(value)}</td></tr>`)
      .join('');
  }

  /** Section RELEVÉ OFFICIEL — CEP : MATIÈRE | CEP {NOTE OBTENUE (= CM /18)
   *  | NOTE MINIMALE EXIGÉE} | NOTE DE PERFECTIONNEMENT OBTENUE (= CP /2) +
   *  décision du jury (CEP / entrée en 6ème) — modèle du relevé officiel. */
  private buildReleveCepSection(releve: any, header: any, idx: number): string {
    const c = releve.candidate;
    const adm = releve.cepAdmission ?? null;
    const nbMatieres = (releve.lines ?? []).length;

    const rows = (releve.lines ?? [])
      .map((line: any) => {
        const minReq = line.passingScore ?? 10;
        const ok = line.score !== null && line.score >= minReq;
        return `
        <tr>
          <td class="matiere">${esc(line.name)}${line.perfectionnement ? ' *' : ''}</td>
          <td class="c note ${ok ? 'ok' : 'ko'}">${this.absOr(this.fmtReleveNote(line.cm ?? line.score), line.isAbsent)}</td>
          <td class="c min">${esc(String(minReq).replace('.', ','))}</td>
          <td class="c note ${line.cp != null && line.cp > 0 ? 'ok' : ''}">${this.absOr(this.fmtReleveNote(line.cp), line.isAbsent)}</td>
        </tr>`;
      })
      .join('');

    const admisCep = adm?.admisCep === true;
    const admisSixieme = adm?.admisSixieme === true;

    return `
    <section class="sheet ${idx > 0 ? 'page-break' : ''}">
      <table class="header">
        <tr>
          <td class="org">${this.releveOrgBlock(header)}</td>
          <td class="titles">
            <div class="t1">RELEVE DE NOTES</div>
            <div class="t2">${esc(releve.officialTitle?.main ?? "CERTIFICAT D'\u00c9TUDES PRIMAIRES")}</div>
            <div class="t3">${esc(releve.officialTitle?.sub ?? '(C.E.P.)')}</div>
            <div class="session">${esc(releve.session ?? '')}</div>
          </td>
        </tr>
      </table>
      <div class="ref">${this.releveRefNumber(releve)}</div>

      <table class="civil">
        ${this.releveCivilRows(c, [
          ['NOM', (c.lastName ?? '').toUpperCase()],
          ['PR\u00c9NOMS', c.firstName ?? '—'],
          ['SEXE', this.genderShort(c.gender)],
          ['MATRICULE', c.matricule ?? '—'],
          ['DATE ET LIEU DE NAISSANCE', this.fmtNaissance(c.dateOfBirth, c.placeOfBirth)],
          ['CENTRE DE COMPOSITION', c.centerName ?? '—'],
          ['NUMERO D\u2019INSCRIPTION', c.registrationNumber ?? c.matricule ?? '—'],
          ['NATURE DE LA CANDIDATURE', c.candidatureNature ?? 'Officiel'],
        ])}
      </table>

      <table class="cep-grid">
        <thead>
          <tr>
            <th rowSpan="2" class="matiere">MATIERE</th>
            <th colSpan="2" class="cep-col">CEP</th>
            <th rowSpan="2" class="perf-col">NOTE DE PERFECTION-<br/>NEMENT OBTENUE</th>
          </tr>
          <tr class="sub">
            <th class="c">NOTE OBTENUE</th>
            <th class="c">NOTE MINIMALE EXIGEE</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <table class="decision">
        <tr><th colSpan="2">DECISION DU JURY</th></tr>
        <tr><td>CERTIFICAT D\u2019ETUDES PRIMAIRES</td><td class="dec ${admisCep ? 'ok' : 'ko'}">${admisCep ? 'Admis' : 'Ajourn\u00e9(e)'}</td></tr>
        <tr><td>ENTREE EN SIXIEME</td><td class="dec ${admisSixieme ? 'ok' : 'ko'}">${admisSixieme ? 'Admis' : 'Ajourn\u00e9(e)'}</td></tr>
      </table>

      ${this.releveSignatureBlock(header)}

      <div class="rules">
        <p>Est d\u00e9clar\u00e9(e) admis(e) au CEP tout(e) candidat(e) ayant obtenu la note minimale exig\u00e9e dans au moins ${esc(String(adm?.matieresRequises ?? 6))} des ${esc(String(nbMatieres || 9))} mati\u00e8res.</p>
        <p>Est d\u00e9clar\u00e9(e) admis(e) \u00e0 l\u2019entr\u00e9e en 6\u00e8me tout(e) candidat(e) re\u00e7u(e) au CEP et ayant obtenu une note de perfectionnement diff\u00e9rente de z\u00e9ro (0) dans l\u2019une des trois (03) mati\u00e8res marqu\u00e9es d\u2019un ast\u00e9risque (*).</p>
        <p>La note de perfectionnement n\u2019est attribu\u00e9e que quand le (la) candidat(e) a obtenu la note minimale exig\u00e9e.</p>
      </div>
    </section>`;
  }

  /** Section RELEVÉ OFFICIEL — BEPC / BAC / CAP : MATIÈRES | COEF. | NOTE/20 |
   *  NOTE COEF. | BILAN (Total Français, Total Écrit, Total Final, Moyenne) +
   *  décision du jury — modèle du relevé officiel. */
  private buildReleveSecondaireSection(releve: any, header: any, idx: number): string {
    const c = releve.candidate;
    const bilan = releve.bilan ?? null;
    const lines = releve.lines ?? [];

    // Entrées de la colonne BILAN : sous-totaux empilés (modèle officiel).
    const bilanEntries: Array<{ label: string; value: string }> = [];
    if (bilan?.hasFrancais) {
      bilanEntries.push({ label: 'Total Fran\u00e7ais', value: this.fmtBilan(bilan.totalFrancais) });
    }
    bilanEntries.push({ label: 'Total \u00c9crit', value: this.fmtBilan(bilan?.totalEcrit ?? null) });
    bilanEntries.push({ label: 'Total Final', value: this.fmtBilan(bilan?.totalFinal ?? null) });
    bilanEntries.push({ label: 'Moyenne', value: this.fmtBilan(bilan?.moyenne ?? null) });

    // Position de départ : juste après la dernière matière du groupe Français
    // (fermeture visuelle du groupe — modèle officiel), bornée au tableau.
    const lastFrenchIdx = lines.reduce((acc: number, l: any, i: number) => (l.francais ? i : acc), -1);
    const startRow = Math.max(
      0,
      Math.min(lastFrenchIdx + 1, Math.max(0, lines.length - bilanEntries.length)),
    );
    const bilanByRow = new Map<number, { label: string; value: string }>();
    bilanEntries.forEach((e, i) => bilanByRow.set(startRow + i, e));

    const rows = lines
      .map((line: any, i: number) => {
        const bilanCell = bilanByRow.get(i);
        return `
        <tr>
          <td class="matiere">${esc(line.name)}</td>
          <td class="c coef">${esc(String(line.coefficient ?? 1).replace('.', ','))}</td>
          <td class="c note">${this.absOr(this.fmtReleveNote(line.score), line.isAbsent)}</td>
          <td class="c notecoef">${this.absOr(this.fmtReleveNote(line.noteCoef), line.isAbsent)}</td>
          <td class="c bilan-cell">${bilanCell ? `<div class="bilan-label">${esc(bilanCell.label)}</div><div class="bilan-value">${esc(bilanCell.value)}</div>` : ''}</td>
        </tr>`;
      })
      .join('');

    const admis = releve.decision === 'ADMIS';

    return `
    <section class="sheet ${idx > 0 ? 'page-break' : ''}">
      <table class="header">
        <tr>
          <td class="org">${this.releveOrgBlock(header, true)}</td>
          <td class="titles">
            <div class="t1">RELEV\u00c9 DE NOTES</div>
            <div class="t-sub">Tenant lieu d\u2019attestation provisoire valable 12 mois</div>
            <div class="t2">${esc(releve.officialTitle?.main ?? releve.examName ?? '')}${releve.officialTitle?.sub ? ` <span class="t3">${esc(releve.officialTitle.sub)}</span>` : ''}</div>
          </td>
          <td class="session-cell">${esc(releve.session ?? '')}</td>
        </tr>
      </table>
      <div class="ref">${this.releveRefNumber(releve)}</div>

      <table class="civil">
        ${this.releveCivilRows(c, [
          ['NOM', (c.lastName ?? '').toUpperCase()],
          ['PR\u00c9NOMS', c.firstName ?? '—'],
          ['SEXE', this.genderLong(c.gender)],
          ['MATRICULE', c.matricule ?? '—'],
          ['DATE ET LIEU DE NAISSANCE', this.fmtNaissance(c.dateOfBirth, c.placeOfBirth)],
          ['CENTRE DE COMPOSITION', c.centerName ?? '—'],
          ['NUMERO D\u2019INSCRIPTION', c.registrationNumber ?? c.matricule ?? '—'],
        ])}
      </table>

      <table class="sec-grid">
        <thead>
          <tr>
            <th class="matiere">MATI\u00c8RES</th>
            <th class="c coef-col">COEF.</th>
            <th class="c note-col">NOTE/20</th>
            <th class="c notecoef-col">NOTE COEF.</th>
            <th class="c bilan-col">BILAN</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <table class="decision single">
        <tr><th colSpan="2">D\u00c9CISION DU JURY</th></tr>
        <tr><td></td><td class="dec ${admis ? 'ok' : 'ko'}">${admis ? 'Admis' : 'Ajourn\u00e9(e)'}</td></tr>
      </table>

      ${this.releveSignatureBlock(header)}
    </section>`;
  }

  /** Document officiel des relevés (une page par candidat, A4 portrait). */
  private buildReleveOfficialDocumentHtml(sections: string): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', 'Noto Serif', serif; color: #000; font-size: 11px; }
  .page-break { page-break-before: always; }
  .sheet { padding: 4px 2px; }

  /* ── En-tête officiel ── */
  .header { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 4px; }
  .header td { vertical-align: top; border: none; padding: 2px 4px; }
  .org { width: 34%; text-align: left; }
  .org-line { font-size: 10px; font-weight: bold; text-transform: uppercase; line-height: 1.35; }
  .org-sep { font-size: 9px; color: #000; margin: 1px 0; }
  .titles { text-align: center; width: 44%; }
  .session-cell { width: 22%; text-align: right; font-size: 11px; font-weight: bold; vertical-align: middle; }
  .t1 { font-size: 17px; font-weight: bold; letter-spacing: 1px; }
  .t2 { font-size: 15px; font-weight: bold; margin-top: 2px; }
  .t3 { font-size: 13px; font-weight: bold; margin-top: 1px; }
  .t-sub { font-size: 9.5px; font-style: italic; margin: 2px 0; }
  .session { font-size: 11px; font-weight: bold; margin-top: 6px; }
  .ref { font-size: 10.5px; font-weight: bold; margin: 4px 0 8px 2px; }

  /* ── État civil (libellé / valeur) — coins arrondis ── */
  .civil { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 10px; border: 1px solid #000; border-radius: 6px; overflow: hidden; }
  .civil td { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 8px; font-size: 10.5px; }
  .civil td:last-child { border-right: none; }
  .civil tr:last-child td { border-bottom: none; }
  .civil .lbl { width: 32%; text-transform: uppercase; font-size: 9px; font-weight: bold; letter-spacing: 0.4px; }
  .civil .val { font-weight: bold; }

  /* ── Tableau des notes — coins arrondis (cadre 2px arrondi, filets 1px) ── */
  .cep-grid, .sec-grid { width: 100%; border-collapse: separate; border-spacing: 0; border: 2px solid #000; border-radius: 8px; overflow: hidden; }
  .cep-grid th, .sec-grid th { border-right: 1px solid #000; border-bottom: 1px solid #000; background: #fff; color: #000; font-size: 10px; font-weight: bold; text-transform: uppercase; padding: 5px 4px; text-align: center; }
  .cep-grid td, .sec-grid td { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 5px 8px; font-size: 11px; vertical-align: middle; background: #fff; }
  .cep-grid th:last-child, .sec-grid th:last-child,
  .cep-grid td:last-child, .sec-grid td:last-child { border-right: none; }
  .cep-grid tr:last-child td, .sec-grid tr:last-child td { border-bottom: none; }
  /* En-tête CEP à 2 niveaux (rowSpan/colSpan) : la dernière cellule de la
     ligne « sub » n'est PAS la dernière colonne du tableau → filet rétabli. */
  .cep-grid .sub th:last-child { border-right: 1px solid #000; }
  .cep-grid .sub th, .sec-grid .sub th { font-size: 9.5px; }
  .matiere { text-align: left; font-weight: bold; }
  .c { text-align: center; }
  .note { font-weight: bold; }
  .min { font-weight: normal; }
  .ok { color: #047857; }
  .ko { color: #b91c1c; }
  .coef { font-weight: bold; }
  .notecoef { font-weight: bold; }
  .perf-col { width: 18%; }
  .cep-col { }
  .coef-col { width: 9%; }
  .note-col { width: 12%; }
  .notecoef-col { width: 14%; }
  .bilan-col { width: 20%; }
  .bilan-cell { padding: 2px 4px; }
  .bilan-label { font-size: 9px; font-weight: bold; text-transform: uppercase; }
  .bilan-value { font-size: 12px; font-weight: bold; }
  .abs { color: #b91c1c; font-weight: bold; font-size: 9.5px; }

  /* ── Décision du jury — coins arrondis ── */
  .decision { width: 78%; border-collapse: separate; border-spacing: 0; margin: 12px auto 0 auto; border: 1.5px solid #000; border-radius: 6px; overflow: hidden; }
  .decision th { border-bottom: 1.5px solid #000; background: #fff; padding: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
  .decision td { border-right: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 4px 10px; font-size: 11px; font-weight: bold; }
  .decision td:last-child { border-right: none; }
  .decision tr:last-child td { border-bottom: none; }
  .decision td:first-child { width: 62%; text-align: left; }
  .decision .dec { text-align: center; text-transform: uppercase; }

  /* ── Date + signature ── */
  .sig-block { width: 42%; margin: 18px 6px 0 auto; text-align: center; }
  .sig-place { font-size: 11px; font-weight: bold; margin-bottom: 3px; }
  .sig-title { font-size: 11px; font-weight: bold; text-transform: uppercase; }
  .sig-space { height: 52px; }
  .sig-name { font-size: 11px; font-weight: bold; border-top: 1px solid #000; margin: 0 18px; padding-top: 3px; }

  /* ── Règles d'admission (bas de page CEP) ── */
  .rules { margin-top: 14px; border-top: 1px solid #000; padding-top: 5px; }
  .rules p { font-size: 9px; text-align: justify; margin-bottom: 2px; }
</style>
</head>
<body>
${sections}
</body>
</html>`;
  }
}
