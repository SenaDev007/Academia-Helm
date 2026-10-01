/**
 * ============================================================================
 * FEDERIS CANDIDATES EXCEL EXPORT SERVICE (2026-09-29)
 * ============================================================================
 * Export Excel de la liste officielle des candidats d'un examen national —
 * MÊME PATTERN QUE LES EXPORTS HELM (educmaster-excel-export.service.ts) :
 *
 *   • Rendu 100 % BACKEND avec ExcelJS (workbook → buffer) — le frontend
 *     ne fait qu'ouvrir l'URL, aucune génération côté client.
 *   • Une feuille par CENTRE D'EXAMEN (comme une feuille par classe dans
 *     le pattern Educmaster) + une feuille « Synthèse » en tête.
 *   • Colonnes : N° ordre, Matricule, Nom, Prénom, Sexe, Date de naissance,
 *     École de provenance, Centre, Salle, N° de table, Anonymat.
 *
 * Endpoints (FederisExamsController) :
 *   GET /federis/exams/:examId/excel/candidats
 *
 * Règles transverses :
 *   - Lecture réservée aux membres du patronat (federis-roles)
 *   - Examen scopé au tenant du patronat (getOwnedExam pattern)
 *   - AuditLog sur chaque génération
 * ============================================================================
 */

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../database/prisma.service';
import { FederisPatronatService } from './federis-patronat.service';
import {
  ALL_PATRONAT_FUNCTIONS,
  normalizePatronatFunction,
  type PatronatFunction,
} from './federis-roles';

interface CandidateRow {
  order: number;
  matricule: string;
  lastName: string;
  firstName: string;
  gender: string | null;
  dateOfBirth: Date | null;
  school: string;
  centerCode: string | null;
  centerName: string | null;
  roomCode: string | null;
  tableNumber: string | null;
  anonymat: string | null;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A8A' }, // Royal Blue Federis/Helm
};

const COLUMNS: Partial<ExcelJS.Column>[] = [
  { header: 'N°', key: 'order', width: 6 },
  { header: 'Matricule', key: 'matricule', width: 22 },
  { header: 'Nom', key: 'lastName', width: 22 },
  { header: 'Prénom', key: 'firstName', width: 22 },
  { header: 'Sexe', key: 'gender', width: 7 },
  { header: 'Date de naissance', key: 'dateOfBirth', width: 16 },
  { header: 'École de provenance', key: 'school', width: 34 },
  { header: 'Centre', key: 'center', width: 28 },
  { header: 'Salle', key: 'roomCode', width: 9 },
  { header: 'N° de table', key: 'tableNumber', width: 11 },
  { header: 'Anonymat', key: 'anonymat', width: 13 },
];

@Injectable()
export class FederisCandidatesExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronatService: FederisPatronatService,
  ) {}

  private async resolveContext(tenantId: string, userId: string) {
    const patronat = await this.patronatService.resolvePatronat(tenantId, userId);
    if (!patronat) throw new NotFoundException('Aucun espace patronat associé à ce compte.');
    const link = await this.prisma.patronatUser.findFirst({
      where: { tenantId: patronat.tenantId, userId, isActive: true },
      select: { role: true },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const fn: PatronatFunction = normalizePatronatFunction(link?.role ?? user?.role);
    if (!ALL_PATRONAT_FUNCTIONS.includes(fn)) {
      throw new NotFoundException('Accès réservé aux membres du patronat.');
    }
    return { patronat, fn };
  }

  /**
   * Génère le classeur Excel de la liste officielle des candidats :
   * feuille « Synthèse » + une feuille par centre d'examen.
   */
  async generateCandidatesExcel(
    tenantId: string,
    userId: string,
    examId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { patronat } = await this.resolveContext(tenantId, userId);

    const exam = await this.prisma.nationalExam.findFirst({
      where: { id: examId, tenantId: patronat.tenantId },
    });
    if (!exam) throw new NotFoundException('Examen introuvable dans votre périmètre.');

    const [academicYear, candidates] = await Promise.all([
      this.prisma.academicYear.findUnique({ where: { id: exam.academicYearId } }),
      this.prisma.examCandidate.findMany({
        where: { examId: exam.id, status: { not: 'CANCELLED' } },
        include: {
          center: { select: { code: true, name: true } },
          room: { select: { code: true } },
          schoolTenant: { select: { name: true } },
        },
        orderBy: [{ center: { code: 'asc' } }, { room: { code: 'asc' } }, { tableNumber: 'asc' }],
      }),
    ]);

    if (candidates.length === 0) {
      throw new BadRequestException('Aucun candidat enregistré pour cet examen.');
    }

    // ⭐ anonymatCode : lecture brute de secours si client Prisma non régénéré
    let anonymatById = new Map<string, string | null>();
    try {
      const rows: any[] = (await this.prisma.$queryRawUnsafe(
        `SELECT "id", "anonymatCode" FROM "exam_candidates" WHERE "examId" = $1`,
        exam.id,
      )) as any[];
      anonymatById = new Map(rows.map((r) => [r.id, r.anonymatCode ?? null]));
    } catch {
      /* colonne absente → anonymats non exportés */
    }

    const allRows: CandidateRow[] = candidates.map((c, i) => ({
      order: i + 1,
      matricule: c.matricule,
      lastName: c.lastName,
      firstName: c.firstName,
      gender: c.gender,
      dateOfBirth: c.dateOfBirth,
      school: c.schoolTenant?.name ?? (c.metadata as any)?.schoolName ?? '—',
      centerCode: c.center?.code ?? null,
      centerName: c.center?.name ?? null,
      roomCode: c.room?.code ?? null,
      tableNumber: c.tableNumber,
      anonymat: (c as any).anonymatCode ?? anonymatById.get(c.id) ?? null,
    }));

    // ── Classeur : Synthèse + une feuille par centre ──────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Federis';
    workbook.created = new Date();

    const centerGroups = new Map<string, CandidateRow[]>();
    for (const r of allRows) {
      const key = r.centerName ? `${r.centerCode} — ${r.centerName}` : 'Non affectés';
      if (!centerGroups.has(key)) centerGroups.set(key, []);
      centerGroups.get(key)!.push(r);
    }

    // Feuille 1 : Synthèse
    const synth = workbook.addWorksheet('Synthèse');
    synth.columns = [
      { header: 'Centre d\u2019examen', key: 'center', width: 40 },
      { header: 'Effectif candidats', key: 'count', width: 18 },
      { header: 'Tables affectées', key: 'tables', width: 18 },
      { header: 'Anonymats émis', key: 'anonymats', width: 18 },
    ];
    this.styleHeader(synth);
    for (const [center, rows] of centerGroups) {
      synth.addRow({
        center,
        count: rows.length,
        tables: rows.filter((r) => r.tableNumber).length,
        anonymats: rows.filter((r) => r.anonymat).length,
      });
    }
    synth.addRow({});
    const totalRow = synth.addRow({
      center: 'TOTAL',
      count: allRows.length,
      tables: allRows.filter((r) => r.tableNumber).length,
      anonymats: allRows.filter((r) => r.anonymat).length,
    });
    totalRow.font = { bold: true };
    // Métadonnées d'en-tête
    synth.spliceRows(1, 0, []);
    synth.spliceRows(1, 0, [`Année scolaire : ${academicYear?.label ?? academicYear?.name ?? '—'}`]);
    synth.spliceRows(1, 0, [`Examen : ${exam.name} (${exam.code}) — ${exam.examType}`]);
    synth.spliceRows(
      1,
      0,
      [`Liste officielle des candidats — ${patronat.legalName || patronat.name}`],
    );
    synth.getRow(1).font = { bold: true, size: 13, color: { argb: 'FF1E3A8A' } };
    synth.getRow(2).font = { bold: true, size: 11 };
    synth.getRow(3).font = { size: 10, color: { argb: 'FF64748B' } };
    synth.getRow(4).font = { size: 10, color: { argb: 'FF64748B' } } as ExcelJS.Font;
    // La ligne 5 contient les en-têtes de colonnes (déjà stylés par styleHeader)
    // ⚠️ spliceRows décale les lignes : re-stylise la ligne d'en-têtes (5).
    this.styleHeader(synth, 5);

    // Feuilles suivantes : une par centre (limite Excel 31 caractères/onglet)
    for (const [center, rows] of centerGroups) {
      const safeName = center
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[*?:\\/[\]]/g, '-')
        .slice(0, 31);
      const sheet = workbook.addWorksheet(safeName || 'Centre');
      sheet.columns = COLUMNS;
      this.styleHeader(sheet);
      for (const r of rows) {
        sheet.addRow({
          ...r,
          center: r.centerName ? `${r.centerCode} — ${r.centerName}` : 'Non affecté',
          roomCode: r.roomCode ?? '—',
          tableNumber: r.tableNumber ?? '—',
          anonymat: r.anonymat ?? '—',
          dateOfBirth: r.dateOfBirth
            ? new Date(r.dateOfBirth).toLocaleDateString('fr-FR')
            : '—',
        });
      }
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: COLUMNS.length },
      };
      // Figer la ligne d'en-têtes
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const filename = `Liste_Candidats_${exam.code}_${new Date().toISOString().split('T')[0]}.xlsx`;

    await this.prisma.auditLog
      .create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_CANDIDATES_EXCEL',
          resource: 'NationalExam',
          resourceId: exam.id,
          tableName: 'national_exams',
          recordId: exam.id,
          newData: { examCode: exam.code, candidates: allRows.length, centers: centerGroups.size },
        },
      })
      .catch(() => undefined);

    return { buffer, filename };
  }

  /** Style la ligne d'en-têtes (bleu royal, gras, texte blanc). */
  private styleHeader(sheet: ExcelJS.Worksheet, rowNum = 1): void {
    const headerRow = sheet.getRow(rowNum);
    headerRow.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    headerRow.height = 22;
  }
}
