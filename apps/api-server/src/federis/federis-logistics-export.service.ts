/**
 * ============================================================================
 * FEDERIS LOGISTICS EXCEL EXPORT SERVICE (2026-09-30 — demande utilisateur)
 * ============================================================================
 * Exports Excel du module « Centres, salles & Surveillants » — MÊME PATTERN
 * QUE LES EXPORTS HELM / FEDERIS (federis-candidates-export.service.ts) :
 *
 *   • Rendu 100 % BACKEND avec ExcelJS (workbook → buffer) — le frontend
 *     ne fait qu'ouvrir l'URL, aucune génération côté client.
 *   • En-têtes de feuilles (bloc titre bleu royal) + en-tête/pied de page
 *     d'impression (headerFooter ExcelJS) + volets figés + auto-filtres.
 *
 *   1. CENTRES & SALLES (sous-onglet « Centres et salles ») :
 *        GET /federis/exams/:examId/excel/centres
 *      → feuille « Synthèse » (récapitulatif par centre + total) +
 *        feuille « Centres » (code, établissement, adresse/localité, chef de
 *        centre, téléphone, email, salles, capacité, candidats affectés,
 *        statut) + feuille « Salles » (centre, code, désignation, capacité,
 *        occupation, bâtiment/étage, statut).
 *
 *   2. PERSONNEL D'EXAMEN (sous-onglet « Gestion des surveillants ») :
 *        GET /federis/exams/:examId/excel/surveillants?post=
 *      → liste À PART pour chaque poste (SURVEILLANCE | SECRETARIAT |
 *        CORRECTION) ou liste complète : nom, prénom, contacts, école de
 *        provenance, centre d'affectation, salle, poste, rôle, origine.
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
// ⭐ 2026-10-01 — AGRÉGATION NATIONALE : périmètre (national = tous les départements)
import { FederisScopeService } from './federis-scope.service';

// ── Libellés des postes (locaux — zéro import croisé, pattern anti-cycle) ──

const SUPERVISOR_POST_KEYS = ['SURVEILLANCE', 'CORRECTION', 'SECRETARIAT'] as const;

function normalizePost(value?: string | null): string | undefined {
  return SUPERVISOR_POST_KEYS.includes(value as any) ? (value as string) : undefined;
}

function postLabel(post?: string | null): string {
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

/** Libellé du document selon le poste filtré. */
function postDocTitle(post?: string | null): string {
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

function roleLabel(role?: string | null): string {
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

function statusLabel(status?: string | null): string {
  const map: Record<string, string> = {
    ACTIVE: 'Actif',
    INACTIVE: 'Inactif',
    ARCHIVED: 'Archivé',
    AVAILABLE: 'Disponible',
    OCCUPIED: 'Occupée',
    BLOCKED: 'Bloquée',
    ASSIGNED: 'Affecté',
  };
  if (!status) return '—';
  return map[status] ?? status;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A8A' }, // Royal Blue Federis/Helm
};

@Injectable()
export class FederisLogisticsExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patronatService: FederisPatronatService,
    private readonly scopeService: FederisScopeService,
  ) {}

  // ── Contexte & permissions (pattern federis-candidates-export) ───────────

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

  private async getOwnedExam(patronatTenantId: string, examId: string) {
    // ⭐ 2026-10-01 — AGRÉGATION NATIONALE : périmètre étendu aux départements.
    const scope = await this.scopeService.resolveScope(patronatTenantId);
    const exam = await this.prisma.nationalExam.findFirst({
      where: { id: examId, patronatId: { in: scope.scopePatronatIds } },
    });
    if (!exam) throw new NotFoundException('Examen introuvable dans votre périmètre.');
    return exam;
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

  /** En-tête / pied de page IMPRESSION (professionnel, pattern Helm). */
  private applyPrintLayout(sheet: ExcelJS.Worksheet, docTitle: string): void {
    sheet.headerFooter = {
      oddHeader: `&C&"Calibri,Bold"&12Academia Federis — ${docTitle}`,
      oddFooter: `&LDocument officiel généré par Academia Federis&RPage &P / &N`,
    };
    sheet.pageSetup = {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 1. CENTRES & SALLES — classeur Excel
  // ═══════════════════════════════════════════════════════════════════════

  async generateCentersExcel(
    tenantId: string,
    userId: string,
    examId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { patronat } = await this.resolveContext(tenantId, userId);
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

    const rows = centers.map((c) => ({
      code: c.code,
      name: c.name,
      address: c.address ?? '—',
      contactName: c.contactName ?? '—',
      contactPhone: c.contactPhone ?? '—',
      contactEmail: c.contactEmail ?? '—',
      status: statusLabel(c.status),
      rooms: c.examRooms.map((r) => ({
        center: `${c.code} — ${c.name}`,
        code: r.code,
        name: r.name,
        capacity: r.capacity,
        occupancy: r.currentOccupancy,
        building: r.building ?? '—',
        floor: r.floor != null ? String(r.floor) : '—',
        status: statusLabel(r.status),
      })),
      roomsCount: c.examRooms.length,
      roomsCapacity: c.examRooms.reduce((sum, r) => sum + r.capacity, 0),
      assignedCandidates: c._count.candidates,
    }));

    const totalRooms = rows.reduce((s, r) => s + r.roomsCount, 0);
    const totalCapacity = rows.reduce((s, r) => s + r.roomsCapacity, 0);
    const totalAssigned = rows.reduce((s, r) => s + r.assignedCandidates, 0);
    const yearLabel = academicYear?.label ?? academicYear?.name ?? '—';
    const docTitle = 'Liste des centres et des salles d’accueil';

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Federis';
    workbook.created = new Date();

    // ── Feuille 1 : Synthèse ────────────────────────────────────────────────
    const synth = workbook.addWorksheet('Synthèse');
    synth.columns = [
      { header: 'Centre d\u2019accueil', key: 'center', width: 42 },
      { header: 'Chef de centre', key: 'contact', width: 26 },
      { header: 'Salles', key: 'rooms', width: 10 },
      { header: 'Capacité (places)', key: 'capacity', width: 17 },
      { header: 'Candidats affectés', key: 'assigned', width: 18 },
    ];
    this.styleHeader(synth);
    for (const r of rows) {
      synth.addRow({
        center: `${r.code} — ${r.name}`,
        contact: r.contactName,
        rooms: r.roomsCount,
        capacity: r.roomsCapacity,
        assigned: r.assignedCandidates,
      });
    }
    synth.addRow({});
    const totalRow = synth.addRow({
      center: 'TOTAL',
      contact: `${rows.length} centres`,
      rooms: totalRooms,
      capacity: totalCapacity,
      assigned: totalAssigned,
    });
    totalRow.font = { bold: true };
    synth.spliceRows(1, 0, [`Année scolaire : ${yearLabel}`]);
    synth.spliceRows(1, 0, [`Examen : ${exam.name} (${exam.code}) — ${exam.examType}`]);
    synth.spliceRows(1, 0, [`${docTitle} — ${patronat.legalName || patronat.name}`]);
    synth.getRow(1).font = { bold: true, size: 13, color: { argb: 'FF1E3A8A' } };
    synth.getRow(2).font = { bold: true, size: 11 };
    synth.getRow(3).font = { size: 10, color: { argb: 'FF64748B' } };
    this.styleHeader(synth, 4);
    this.applyPrintLayout(synth, docTitle);

    // ── Feuille 2 : Centres ─────────────────────────────────────────────────
    const sheetCenters = workbook.addWorksheet('Centres');
    sheetCenters.columns = [
      { header: 'N°', key: 'order', width: 6 },
      { header: 'Code', key: 'code', width: 14 },
      { header: 'Établissement d\u2019accueil', key: 'name', width: 36 },
      { header: 'Adresse / Localité', key: 'address', width: 32 },
      { header: 'Chef de centre', key: 'contactName', width: 24 },
      { header: 'Téléphone', key: 'contactPhone', width: 16 },
      { header: 'Email', key: 'contactEmail', width: 26 },
      { header: 'Salles', key: 'roomsCount', width: 9 },
      { header: 'Capacité', key: 'roomsCapacity', width: 11 },
      { header: 'Candidats affectés', key: 'assignedCandidates', width: 17 },
      { header: 'Statut', key: 'status', width: 11 },
    ];
    this.styleHeader(sheetCenters);
    rows.forEach((r, i) => {
      sheetCenters.addRow({
        order: i + 1,
        code: r.code,
        name: r.name,
        address: r.address,
        contactName: r.contactName,
        contactPhone: r.contactPhone,
        contactEmail: r.contactEmail,
        roomsCount: r.roomsCount,
        roomsCapacity: r.roomsCapacity,
        assignedCandidates: r.assignedCandidates,
        status: r.status,
      });
    });
    sheetCenters.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 11 },
    };
    sheetCenters.views = [{ state: 'frozen', ySplit: 1 }];
    this.applyPrintLayout(sheetCenters, docTitle);

    // ── Feuille 3 : Salles ──────────────────────────────────────────────────
    const sheetRooms = workbook.addWorksheet('Salles');
    sheetRooms.columns = [
      { header: 'N°', key: 'order', width: 6 },
      { header: 'Centre d\u2019accueil', key: 'center', width: 40 },
      { header: 'Code salle', key: 'code', width: 13 },
      { header: 'Désignation', key: 'name', width: 30 },
      { header: 'Capacité (places)', key: 'capacity', width: 17 },
      { header: 'Places occupées', key: 'occupancy', width: 16 },
      { header: 'Bâtiment', key: 'building', width: 16 },
      { header: 'Étage', key: 'floor', width: 8 },
      { header: 'Statut', key: 'status', width: 13 },
    ];
    this.styleHeader(sheetRooms);
    let roomOrder = 0;
    for (const r of rows) {
      for (const room of r.rooms) {
        roomOrder += 1;
        sheetRooms.addRow({ order: roomOrder, ...room });
      }
    }
    sheetRooms.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 9 },
    };
    sheetRooms.views = [{ state: 'frozen', ySplit: 1 }];
    this.applyPrintLayout(sheetRooms, docTitle);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const filename = `Liste_Centres_Salles_${exam.code}_${new Date().toISOString().split('T')[0]}.xlsx`;

    await this.prisma.auditLog
      .create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_CENTERS_EXCEL',
          resource: 'NationalExam',
          resourceId: exam.id,
          tableName: 'national_exams',
          recordId: exam.id,
          newData: { examCode: exam.code, centers: rows.length, rooms: totalRooms },
        },
      })
      .catch(() => undefined);

    return { buffer, filename };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. PERSONNEL D'EXAMEN (surveillants / secrétaires / correcteurs)
  // ═══════════════════════════════════════════════════════════════════════

  async generateSupervisorsExcel(
    tenantId: string,
    userId: string,
    examId: string,
    post?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { patronat } = await this.resolveContext(tenantId, userId);
    const exam = await this.getOwnedExam(patronat.tenantId, examId);
    const postFilter = normalizePost(post);

    const supervisors = await this.prisma.examSupervisor.findMany({
      where: { examId: exam.id, tenantId: patronat.tenantId, ...(postFilter ? { post: postFilter } : {}) },
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
    });

    if (supervisors.length === 0) {
      throw postFilter
        ? new BadRequestException(`Aucun personnel enregistré pour ce poste (${postLabel(postFilter)}).`)
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
      lastName: s.lastName,
      firstName: s.firstName,
      phone: s.phone ?? '—',
      email: s.email ?? '—',
      school: s.schoolTenantId ? (schoolNameById.get(s.schoolTenantId) ?? 'École') : '—',
      center: s.center ? `${s.center.code} — ${s.center.name}` : '—',
      room: s.room ? `${s.room.code} — ${s.room.name}` : '—',
      post: postLabel(s.post),
      role: roleLabel(s.role),
      source: s.source === 'SCHOOL_NOMINATION' ? 'Nomination d\u2019école' : 'Saisie patronat',
    }));

    const docTitle = postDocTitle(postFilter);
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: exam.academicYearId },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Federis';
    workbook.created = new Date();

    const sheetName =
      postFilter === 'CORRECTION'
        ? 'Correcteurs'
        : postFilter === 'SECRETARIAT'
          ? 'Secrétariat'
          : postFilter === 'SURVEILLANCE'
            ? 'Surveillants'
            : 'Personnel';
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = [
      { header: 'N°', key: 'order', width: 6 },
      { header: 'Nom', key: 'lastName', width: 22 },
      { header: 'Prénom', key: 'firstName', width: 22 },
      { header: 'Téléphone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'École de provenance', key: 'school', width: 34 },
      { header: "Centre d'affectation", key: 'center', width: 34 },
      { header: 'Salle', key: 'room', width: 22 },
      { header: 'Poste', key: 'post', width: 24 },
      { header: 'Rôle', key: 'role', width: 15 },
      { header: 'Origine', key: 'source', width: 17 },
    ];
    this.styleHeader(sheet);
    for (const r of rows) {
      sheet.addRow(r);
    }
    // Bloc titre (pattern Synthèse candidats) — 4 lignes au-dessus du tableau.
    sheet.spliceRows(1, 0, [`Établie le ${new Date().toLocaleDateString('fr-FR')} — Effectif : ${rows.length}`]);
    sheet.spliceRows(1, 0, [
      `Année scolaire : ${academicYear?.label ?? academicYear?.name ?? '—'}`,
    ]);
    sheet.spliceRows(1, 0, [`Examen : ${exam.name} (${exam.code}) — ${exam.examType}`]);
    sheet.spliceRows(1, 0, [`${docTitle} — ${patronat.legalName || patronat.name}`]);
    sheet.getRow(1).font = { bold: true, size: 13, color: { argb: 'FF1E3A8A' } };
    sheet.getRow(2).font = { bold: true, size: 11 };
    sheet.getRow(3).font = { size: 10, color: { argb: 'FF64748B' } };
    sheet.getRow(4).font = { size: 10, color: { argb: 'FF64748B' } };
    this.styleHeader(sheet, 5);
    sheet.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: 5, column: 11 },
    };
    sheet.views = [{ state: 'frozen', ySplit: 4 }];
    this.applyPrintLayout(sheet, docTitle);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const fileSuffix =
      postFilter === 'CORRECTION'
        ? 'Correcteurs'
        : postFilter === 'SECRETARIAT'
          ? 'Secretariat'
          : postFilter === 'SURVEILLANCE'
            ? 'Surveillants'
            : 'Personnel';
    const filename = `Liste_${fileSuffix}_${exam.code}_${new Date().toISOString().split('T')[0]}.xlsx`;

    await this.prisma.auditLog
      .create({
        data: {
          tenantId: patronat.tenantId,
          userId,
          action: 'FEDERIS_SUPERVISORS_EXCEL',
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
}
