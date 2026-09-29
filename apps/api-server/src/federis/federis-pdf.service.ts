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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
}

@Injectable()
export class FederisPdfService {
  private readonly logger = new Logger(FederisPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly patronatService: FederisPatronatService,
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
          const na = parseInt(a.tableNumber ?? '', 10);
          const nb = parseInt(b.tableNumber ?? '', 10);
          if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
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
      { decision?: string; average?: number; mention?: string }
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
      const decision =
        meta.decision === 'ADMIS' || meta.decision === 'AJOURNE' ? meta.decision : null;
      const average =
        typeof meta.average === 'number' && meta.average !== null ? round2(meta.average) : computed;
      return {
        rank: null,
        matricule: c.matricule,
        name: `${c.lastName} ${c.firstName}`,
        school: c.schoolTenant?.name ?? (c.metadata as any)?.schoolName ?? '—',
        average,
        mention:
          decision === 'ADMIS'
            ? (meta.mention ?? (average != null ? mentionFor(average) : null))
            : null,
        decision: decision ?? (average != null && average >= 10 ? 'ADMIS' : 'AJOURNE'),
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
  // 3. RENDU PDF (pattern Helm — PuppeteerPool + retry)
  // ══════════════════════════════════════════════════════════════════════

  private async renderPdf(html: string): Promise<Buffer> {
    const pdfOptions = {
      format: 'A4' as const,
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
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
  }): string {
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
          <td class="c decision ${admitted ? 'admitted' : ''}">${admitted ? 'ADMIS' : 'AJOURNÉ'}</td>
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
      <div class="doc-kind">PALMARÈS OFFICIEL</div>
      <div class="doc-subtitle">Résultats définitifs après délibération du jury</div>
    </div>
    <div class="exam-box">
      <div class="exam-name">${esc(d.examName)}</div>
      <div class="exam-meta">Code : <strong>${esc(d.examCode)}</strong> · ${esc(d.examType)} · ${esc(d.level)}</div>
    </div>
  </div>

  <div class="publish-bar">
    <span>Jury : <strong>${esc(d.juryName ?? 'Jury de délibération')}</strong></span>
    <span>Publication : <strong>${esc(d.publishedAt ? formatDate(d.publishedAt) : '—')}</strong></span>
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
}
