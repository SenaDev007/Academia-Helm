/**
 * ============================================================================
 * PRÉPARATION D'EXAMEN — Service (épreuves d'évaluation)
 * ============================================================================
 *
 * ⭐ Pattern exact des fiches pédagogiques / cahier journal, adapté à la
 *    préparation des ÉPREUVES d'évaluation :
 *
 * 1. DÉTECTION (pattern « FichesAPreparer ») :
 *    getPendingSessions() liste les évaluations PROGRAMMÉES (PLANNED /
 *    OPEN_FOR_GRADING) des classes de l'enseignant, groupées par SESSION
 *    (classe × type d'évaluation × période). Chaque matière de la session =
 *    une épreuve à préparer. Le système dit à l'enseignant : « telle
 *    évaluation est programmée, voici les matières à préparer ».
 *
 * 2. SAUVEGARDE : CRUD SQL brut (comme pedagogical-space) —
 *    POST get-or-create du bloc (idempotent, unique par session) +
 *    PUT autosave whitelist des champs épreuve.
 *
 * 3. WORKFLOW PAR BLOC (pas par épreuve) :
 *    DRAFT → SUBMITTED (envoi au directeur) → VALIDATED | REJECTED
 *    → SENT_TO_SECRETARIAT (envoi au secrétariat pour impression).
 *
 * 4. CATALOGUE hiérarchisé : Classes → Années → Trimestres → Mois → Sessions.
 *
 * 5. GÉNÉRATION PDF PROFESSIONNELLE (Puppeteer) conforme aux modèles
 *    officiels fournis (CP / CE2 / CM1) : entête école + classe + année +
 *    durée + devise, champs Nom/Prénoms, « EPREUVE : matière », Situation
 *    d'évaluation / Tâche / Consignes-Items, clé + grille de correction.
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';
import { NotificationService } from '../notifications/notification.service';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

@Injectable()
export class ExamPreparationService {
  private readonly logger = new Logger(ExamPreparationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly notificationService: NotificationService,
  ) {}

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /** Résout l'ID Teacher depuis un userId ou teacherId (pattern fiches). */
  private async resolveTeacherId(tenantId: string, id: string): Promise<string | null> {
    if (!id) return null;
    // 1. L'ID est-il déjà un Teacher ?
    const asTeacher = await this.prisma.teacher.findFirst({
      where: { id, tenantId },
      select: { id: true },
    }).catch(() => null);
    if (asTeacher) return asTeacher.id;
    // 2. ID User → Teacher par email
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: { email: true },
    }).catch(() => null);
    if (user?.email) {
      const byEmail = await this.prisma.teacher.findFirst({
        where: { tenantId, email: { equals: user.email, mode: 'insensitive' } },
        select: { id: true },
      }).catch(() => null);
      if (byEmail) return byEmail.id;
    }
    return null;
  }

  /** Assainit le HTML riche (conserve img/svg/tableaux, supprime script/on*). */
  private sanitizeRichHtml(html: string): string {
    if (!html) return '';
    let s = html;
    s = s.replace(
      /<(script|iframe|object|embed|style|link|meta|noscript|template|form|input|button|select|textarea|video|audio)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      '',
    );
    s = s.replace(
      /<(script|iframe|object|embed|style|link|meta|noscript|template|form|input|button|select|textarea|video|audio)\b[^>]*\/?>/gi,
      '',
    );
    s = s.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    s = s.replace(
      /(src|href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+|"vbscript:[^"]*"|'vbscript:[^']*')/gi,
      '$1="#"',
    );
    s = s.replace(/\s+contenteditable\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    s = s.replace(/style\s*=\s*"[^"]*expression\s*\(/gi, 'style="');
    return s.trim();
  }

  private hasText(html: string | null | undefined): boolean {
    if (!html) return false;
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;
  }

  // ===========================================================================
  // 1. DÉTECTION — Évaluations programmées → épreuves à préparer
  //    (pattern « FichesAPreparer » du cahier journal)
  // ===========================================================================

  /**
   * Liste les SESSIONS d'évaluation programmées pour les classes de
   * l'enseignant : chaque session (classe × type × période) contient les
   * matières évaluées et le statut de préparation de chaque épreuve.
   */
  async getPendingSessions(tenantId: string, teacherIdRaw: string, academicYearId: string) {
    const teacherId = await this.resolveTeacherId(tenantId, teacherIdRaw);
    if (!teacherId) {
      return { sessions: [], teacherClasses: [], stats: { totalSessions: 0, totalEpreuves: 0, epreuvesPreparees: 0, epreuvesManquantes: 0 } };
    }

    // Classes de l'enseignant : classes où il a une affectation (titulaire ou
    // spécialiste) + classes des évaluations qui lui sont assignées.
    const classRows: any = await this.prisma.$queryRawUnsafe(
      `SELECT DISTINCT c."id", c."name", sl."code" as "levelCode"
       FROM teacher_class_assignments tca
       JOIN classes c ON c."id" = tca."classId"
       LEFT JOIN school_levels sl ON sl."id" = c."schoolLevelId"
       WHERE tca."tenantId" = $1 AND tca."academicYearId" = $2 AND tca."teacherId" = $3
         AND tca."classId" IS NOT NULL`,
      tenantId, academicYearId, teacherId,
    ).catch(() => []);
    const myClassIds = classRows.map((r: any) => r.id);

    // Évaluations programmées (PLANNED / OPEN_FOR_GRADING) de ces classes
    // OU assignées directement à l'enseignant.
    const evalRows: any = await this.prisma.$queryRawUnsafe(
      `SELECT e."id", e."classId", e."subjectId", e."periodId", e."evaluationTypeId",
              e."title", e."evaluationDate", e."maxScore", e."coefficient", e."teacherId", e."status",
              c."name" AS "className", sl."code" AS "levelCode",
              s."name" AS "subjectName", s."code" AS "subjectCode",
              et."name" AS "evaluationTypeName", et."code" AS "evaluationTypeCode",
              ap."name" AS "periodName", ap."type" AS "periodType", ap."periodOrder",
              ap."startDate" AS "periodStartDate", ap."endDate" AS "periodEndDate"
       FROM evaluations e
       JOIN classes c ON c."id" = e."classId"
       LEFT JOIN school_levels sl ON sl."id" = c."schoolLevelId"
       LEFT JOIN subjects s ON s."id" = e."subjectId"
       LEFT JOIN evaluation_types et ON et."id" = e."evaluationTypeId"
       LEFT JOIN academic_periods ap ON ap."id" = e."periodId"
       WHERE e."tenantId" = $1 AND e."academicYearId" = $2
         AND e."status" IN ('PLANNED', 'OPEN_FOR_GRADING')
         AND (e."teacherId" = $3 ${myClassIds.length ? `OR e."classId" = ANY($4::text[])` : ''})
       ORDER BY e."evaluationDate" ASC, c."name" ASC, s."name" ASC`,
      ...(myClassIds.length
        ? [tenantId, academicYearId, teacherId, myClassIds]
        : [tenantId, academicYearId, teacherId]),
    ).catch(() => []);

    if (!evalRows || evalRows.length === 0) {
      return { sessions: [], teacherClasses: classRows, stats: { totalSessions: 0, totalEpreuves: 0, epreuvesPreparees: 0, epreuvesManquantes: 0 } };
    }

    // Blocs existants (pour rattacher les sessions déjà préparées)
    const blockRows: any = await this.prisma.$queryRawUnsafe(
      `SELECT b.*, COUNT(sh."id")::int AS "sheetsCount"
       FROM exam_preparation_blocks b
       LEFT JOIN exam_preparation_sheets sh ON sh."blockId" = b."id"
       WHERE b."tenantId" = $1 AND b."academicYearId" = $2
       GROUP BY b."id"`,
      tenantId, academicYearId,
    ).catch(() => []);
    const blockBySession = new Map<string, any>();
    for (const b of blockRows || []) {
      blockBySession.set(`${b.classId}|${b.evaluationTypeId || ''}|${b.periodId || ''}`, b);
    }

    // Épreuves existantes rattachées aux évaluations
    const sheetRows: any = await this.prisma.$queryRawUnsafe(
      `SELECT sh."id", sh."blockId", sh."evaluationId", sh."subjectId", sh."subjectName",
              sh."epreuveTitle", sh."situation", sh."consignes", sh."status"
       FROM exam_preparation_sheets sh
       WHERE sh."tenantId" = $1 AND sh."academicYearId" = $2`,
      tenantId, academicYearId,
    ).catch(() => []);
    const sheetByEvaluation = new Map<string, any>();
    for (const sh of sheetRows || []) {
      if (sh.evaluationId) sheetByEvaluation.set(sh.evaluationId, sh);
    }

    // Groupement par session (classe × type × période)
    const sessionMap = new Map<string, any>();
    for (const ev of evalRows) {
      const key = `${ev.classId}|${ev.evaluationTypeId || ''}|${ev.periodId || ''}`;
      if (!sessionMap.has(key)) {
        const periodStart = ev.periodStartDate ? new Date(ev.periodStartDate) : null;
        const examDate = ev.evaluationDate ? new Date(ev.evaluationDate) : null;
        // Trimestre : nom de la période si TRIMESTER/SEMESTER, sinon déduit de la date
        let trimesterLabel = '';
        if (ev.periodName && (ev.periodType === 'TRIMESTER' || ev.periodType === 'SEMESTER' || ev.periodType === 'SEQUENCE')) {
          trimesterLabel = ev.periodName;
        } else if (examDate || periodStart) {
          const d = examDate || periodStart;
          const q = Math.floor((d.getMonth()) / 3) + 1;
          trimesterLabel = `Trimestre ${q}`;
        }
        const monthRef = examDate || periodStart || new Date();
        sessionMap.set(key, {
          sessionKey: key,
          classId: ev.classId,
          className: ev.className,
          levelCode: ev.levelCode,
          evaluationTypeId: ev.evaluationTypeId,
          evaluationTypeName: ev.evaluationTypeName || 'Évaluation',
          periodId: ev.periodId,
          periodName: ev.periodName,
          title: ev.title || ev.evaluationTypeName || 'Évaluation',
          evaluationDate: ev.evaluationDate,
          examDate: examDate ? examDate.toISOString().slice(0, 10) : null,
          monthLabel: MONTH_NAMES[(monthRef.getMonth())] || '',
          monthNumber: monthRef.getMonth() + 1,
          trimesterLabel,
          matieres: [],
          block: null,
        });
      }
      const session = sessionMap.get(key);
      const sheet = sheetByEvaluation.get(ev.id) || null;
      session.matieres.push({
        evaluationId: ev.id,
        subjectId: ev.subjectId,
        subjectName: ev.subjectName || '—',
        subjectCode: ev.subjectCode,
        maxScore: ev.maxScore,
        coefficient: ev.coefficient,
        assignedTeacherId: ev.teacherId,
        isMine: !ev.teacherId || ev.teacherId === teacherId,
        epreuveId: sheet?.id || null,
        epreuvePreparee: !!sheet && (this.hasText(sheet.situation) || this.hasText(sheet.consignes)),
        epreuveStatus: sheet?.status || null,
      });
    }

    // Rattachement des blocs + stats
    let totalEpreuves = 0;
    let epreuvesPreparees = 0;
    const sessions = Array.from(sessionMap.values()).map((s: any) => {
      s.block = blockBySession.get(s.sessionKey) || null;
      s.totalEpreuves = s.matieres.length;
      s.epreuvesPreparees = s.matieres.filter((m: any) => m.epreuvePreparee).length;
      s.epreuvesManquantes = s.totalEpreuves - s.epreuvesPreparees;
      s.toutesEpreuvesPreparees = s.epreuvesManquantes === 0;
      totalEpreuves += s.totalEpreuves;
      epreuvesPreparees += s.epreuvesPreparees;
      return s;
    });
    sessions.sort((a: any, b: any) => (a.examDate || '').localeCompare(b.examDate || '') || a.className.localeCompare(b.className));

    return {
      sessions,
      teacherClasses: classRows,
      stats: {
        totalSessions: sessions.length,
        totalEpreuves,
        epreuvesPreparees,
        epreuvesManquantes: totalEpreuves - epreuvesPreparees,
      },
    };
  }

  // ===========================================================================
  // 2. BLOCS — CRUD (get-or-create idempotent par session)
  // ===========================================================================

  /** Liste les blocs de l'enseignant (avec compteurs d'épreuves). */
  async getBlocks(tenantId: string, teacherIdRaw: string, academicYearId: string, classId?: string) {
    const teacherId = await this.resolveTeacherId(tenantId, teacherIdRaw);
    if (!teacherId) return [];
    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT b.*,
              (SELECT COUNT(*)::int FROM exam_preparation_sheets sh WHERE sh."blockId" = b."id") AS "sheetsCount",
              (SELECT COUNT(*)::int FROM exam_preparation_sheets sh WHERE sh."blockId" = b."id"
                 AND (COALESCE(sh."situation",'') NOT IN ('','<p></p>','<p><br></p>','<p><br/></p>')
                      OR COALESCE(sh."consignes",'') NOT IN ('','<p></p>','<p><br></p>','<p><br/></p>'))) AS "sheetsFilled"
       FROM exam_preparation_blocks b
       WHERE b."tenantId" = $1 AND b."academicYearId" = $2 AND b."teacherId" = $3
         ${classId ? `AND b."classId" = $4` : ''}
       ORDER BY b."examDate" DESC NULLS LAST, b."createdAt" DESC`,
      ...(classId ? [tenantId, academicYearId, teacherId, classId] : [tenantId, academicYearId, teacherId]),
    ).catch(() => []);
    return rows || [];
  }

  /** Détail d'un bloc avec ses épreuves (triées par ordre). */
  async getBlock(tenantId: string, blockId: string) {
    const blockRows: any = await this.prisma.$queryRawUnsafe(
      `SELECT b.* FROM exam_preparation_blocks b
       WHERE b."id" = $1 AND b."tenantId" = $2`,
      blockId, tenantId,
    ).catch(() => []);
    if (!blockRows || blockRows.length === 0) throw new NotFoundException('Bloc d\'épreuves non trouvé');
    const block = blockRows[0];
    const sheetRows: any = await this.prisma.$queryRawUnsafe(
      `SELECT sh.* FROM exam_preparation_sheets sh
       WHERE sh."blockId" = $1 AND sh."tenantId" = $2
       ORDER BY sh."orderIndex" ASC, sh."subjectName" ASC`,
      blockId, tenantId,
    ).catch(() => []);
    return { ...block, sheets: sheetRows || [] };
  }

  /**
   * Get-or-create du bloc pour une session (idempotent — unique par
   * classe × type × période) + squelettes d'épreuves par matière.
   * ⭐ Chaque matière de la session = UNE épreuve à préparer (pattern
   *    « __fichesAPreparer__ » : une sous-matière = une fiche).
   */
  async createBlock(
    tenantId: string,
    body: {
      teacherId: string;
      academicYearId: string;
      classId: string;
      evaluationTypeId?: string;
      periodId?: string;
      evaluationIds?: string[];
      title?: string;
    },
  ) {
    const teacherId = await this.resolveTeacherId(tenantId, body.teacherId);
    if (!teacherId) throw new BadRequestException('Enseignant non résolu');
    const { classId, evaluationTypeId, periodId } = body;

    // 1. Bloc existant ?
    const existing: any = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM exam_preparation_blocks
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "classId" = $3
         AND "evaluationTypeId" = $4 AND "periodId" = $5
       LIMIT 1`,
      tenantId, body.academicYearId, classId, evaluationTypeId || '', periodId || '',
    ).catch(() => []);
    if (existing && existing.length > 0) {
      return this.getBlock(tenantId, existing[0].id);
    }

    // 2. Récupérer les évaluations de la session (infos complètes)
    const evalIds = body.evaluationIds || [];
    const evalRows: any = evalIds.length
      ? await this.prisma.$queryRawUnsafe(
          `SELECT e."id", e."subjectId", e."evaluationDate", e."maxScore", e."coefficient",
                  s."name" AS "subjectName",
                  c."name" AS "className",
                  et."name" AS "evaluationTypeName",
                  ap."name" AS "periodName", ap."type" AS "periodType"
           FROM evaluations e
           LEFT JOIN subjects s ON s."id" = e."subjectId"
           LEFT JOIN classes c ON c."id" = e."classId"
           LEFT JOIN evaluation_types et ON et."id" = e."evaluationTypeId"
           LEFT JOIN academic_periods ap ON ap."id" = e."periodId"
           WHERE e."id" = ANY($1::text[]) AND e."tenantId" = $2`,
          evalIds, tenantId,
        ).catch(() => [])
      : [];
    if (!evalRows || evalRows.length === 0) {
      throw new BadRequestException('Aucune évaluation trouvée pour cette session');
    }

    const first = evalRows[0];
    const examDate = first.evaluationDate ? new Date(first.evaluationDate) : null;
    let trimesterLabel = '';
    if (first.periodName && ['TRIMESTER', 'SEMESTER', 'SEQUENCE'].includes(first.periodType)) {
      trimesterLabel = first.periodName;
    } else if (examDate) {
      trimesterLabel = `Trimestre ${Math.floor(examDate.getMonth() / 3) + 1}`;
    }
    const monthRef = examDate || new Date();

    // 3. Nom de l'enseignant (pour l'entête des épreuves)
    const teacherRow = await this.prisma.teacher.findFirst({
      where: { id: teacherId, tenantId },
      select: { firstName: true, lastName: true, gender: true },
    }).catch(() => null);
    const teacherName = teacherRow
      ? `${teacherRow.gender === 'F' ? 'Mme' : 'M.'} ${(teacherRow.lastName || '').toUpperCase()} ${teacherRow.firstName || ''}`.trim()
      : '';

    // 4. Créer le bloc
    const blockId = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO exam_preparation_blocks
        ("id", "tenantId", "academicYearId", "teacherId", "classId",
         "evaluationId", "periodId", "evaluationTypeId",
         "title", "className", "monthLabel", "trimesterLabel", "examDate",
         "status", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'DRAFT',NOW(),NOW())`,
      blockId, tenantId, body.academicYearId, teacherId, classId,
      first.id, periodId || null, evaluationTypeId || null,
      body.title || first.evaluationTypeName || 'Évaluation',
      first.className || '', MONTH_NAMES[monthRef.getMonth()], trimesterLabel,
      examDate ? examDate.toISOString().slice(0, 10) : null,
    );

    // 5. Squelettes d'épreuves (une par matière, ordre = ordre des évaluations)
    let order = 0;
    for (const ev of evalRows) {
      // Éviter les doublons de matière dans le même bloc
      const dup: any = await this.prisma.$queryRawUnsafe(
        `SELECT id FROM exam_preparation_sheets
         WHERE "blockId" = $1 AND "evaluationId" = $2 LIMIT 1`,
        blockId, ev.id,
      ).catch(() => []);
      if (dup && dup.length > 0) continue;
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO exam_preparation_sheets
          ("id", "tenantId", "academicYearId", "blockId", "teacherId", "classId",
           "subjectId", "evaluationId", "subjectName", "epreuveTitle",
           "maxScoreLabel", "coefficient", "teacherName", "orderIndex", "status",
           "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'DRAFT',NOW(),NOW())`,
        crypto.randomUUID(), tenantId, body.academicYearId, blockId, teacherId, classId,
        ev.subjectId || null, ev.id, ev.subjectName || '—',
        `Épreuve de ${(ev.subjectName || '—').toUpperCase()}`,
        ev.maxScore != null ? `${ev.maxScore}` : null,
        ev.coefficient != null ? `${ev.coefficient}` : null,
        teacherName, order++,
      );
    }

    this.logger.log(`Bloc d'épreuves créé : ${blockId} (${evalRows.length} épreuve(s))`);
    return this.getBlock(tenantId, blockId);
  }

  /** Supprime un bloc (et ses épreuves en cascade) — DRAFT uniquement. */
  async deleteBlock(tenantId: string, blockId: string) {
    const block = await this.getBlock(tenantId, blockId);
    if (block.status !== 'DRAFT') {
      throw new BadRequestException('Impossible de supprimer un bloc déjà soumis ou validé');
    }
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM exam_preparation_blocks WHERE "id" = $1 AND "tenantId" = $2`,
      blockId, tenantId,
    );
    return { deleted: true };
  }

  // ===========================================================================
  // 3. ÉPREUVES — CRUD + AUTOSAVE (pattern updatePedagogicalFiche)
  // ===========================================================================

  /** Champs autorisés à la mise à jour (whitelist + casts SQL). */
  private readonly SHEET_FIELD_MAP: Record<string, string> = {
    subjectName: 'text',
    epreuveTitle: 'text',
    durationLabel: 'text',
    maxScoreLabel: 'text',
    coefficient: 'text',
    showIdentityFields: 'bool',
    situation: 'text',
    tache: 'text',
    consignes: 'text',
    cleCorrection: 'text',
    grilleCorrection: 'text',
    teacherName: 'text',
    orderIndex: 'int',
  };

  async getSheet(tenantId: string, sheetId: string) {
    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT sh.*, b."title" AS "blockTitle", b."className" AS "blockClassName",
              b."monthLabel", b."trimesterLabel", b."status" AS "blockStatus",
              b."examDate" AS "blockExamDate"
       FROM exam_preparation_sheets sh
       JOIN exam_preparation_blocks b ON b."id" = sh."blockId"
       WHERE sh."id" = $1 AND sh."tenantId" = $2`,
      sheetId, tenantId,
    ).catch(() => []);
    if (!rows || rows.length === 0) throw new NotFoundException('Épreuve non trouvée');
    return rows[0];
  }

  /** Création d'une épreuve (manuelle, hors session détectée). */
  async createSheet(
    tenantId: string,
    body: {
      teacherId: string; academicYearId: string; blockId: string;
      subjectName?: string; subjectId?: string; epreuveTitle?: string;
      durationLabel?: string; maxScoreLabel?: string; coefficient?: string;
    },
  ) {
    const block = await this.getBlock(tenantId, body.blockId);
    if (block.status !== 'DRAFT') {
      throw new BadRequestException('Le bloc a déjà été transmis — impossible d\'ajouter une épreuve');
    }
    const teacherId = await this.resolveTeacherId(tenantId, body.teacherId);
    const sheetId = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO exam_preparation_sheets
        ("id", "tenantId", "academicYearId", "blockId", "teacherId", "classId",
         "subjectId", "subjectName", "epreuveTitle", "durationLabel",
         "maxScoreLabel", "coefficient", "orderIndex", "status", "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'DRAFT',NOW(),NOW())`,
      sheetId, tenantId, body.academicYearId, body.blockId,
      teacherId || block.teacherId, block.classId,
      body.subjectId || null, body.subjectName || '—',
      body.epreuveTitle || `Épreuve de ${(body.subjectName || '—').toUpperCase()}`,
      body.durationLabel || null, body.maxScoreLabel || null, body.coefficient || null,
      (block.sheets?.length || 0) + 1,
    );
    return this.getSheet(tenantId, sheetId);
  }

  /**
   * ⭐ AUTOSAVE d'une épreuve — whitelist dynamique (pattern fiches) :
   *    ne met à jour que les champs présents dans le body, avec casts PG.
   */
  async updateSheet(tenantId: string, sheetId: string, body: any) {
    const current = await this.getSheet(tenantId, sheetId);
    if (current.blockStatus !== 'DRAFT') {
      throw new BadRequestException('Le bloc a déjà été transmis — épreuve en lecture seule');
    }
    const sets: string[] = [];
    const values: any[] = [];
    let p = 1;
    for (const [field, cast] of Object.entries(this.SHEET_FIELD_MAP)) {
      if (body[field] === undefined) continue;
      if (cast === 'text') {
        sets.push(`"${field}" = $${p}::text`); values.push(body[field] ?? null);
      } else if (cast === 'int') {
        sets.push(`"${field}" = $${p}::int`); values.push(Number(body[field]) || 0);
      } else if (cast === 'bool') {
        sets.push(`"${field}" = $${p}::boolean`); values.push(!!body[field]);
      }
      p++;
    }
    if (sets.length === 0) return current;
    sets.push('"updatedAt" = NOW()');
    values.push(sheetId, tenantId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE exam_preparation_sheets SET ${sets.join(', ')}
       WHERE "id" = $${p} AND "tenantId" = $${p + 1}`,
      ...values,
    );
    return this.getSheet(tenantId, sheetId);
  }

  async deleteSheet(tenantId: string, sheetId: string) {
    const current = await this.getSheet(tenantId, sheetId);
    if (current.blockStatus !== 'DRAFT') {
      throw new BadRequestException('Le bloc a déjà été transmis — impossible de supprimer');
    }
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM exam_preparation_sheets WHERE "id" = $1 AND "tenantId" = $2`,
      sheetId, tenantId,
    );
    return { deleted: true };
  }

  // ===========================================================================
  // 4. WORKFLOW — soumission du BLOC, validation direction, secrétariat
  // ===========================================================================

  /** Envoi du BLOC d'épreuves au directeur (DRAFT|REJECTED → SUBMITTED). */
  async submitBlock(tenantId: string, blockId: string) {
    const block = await this.getBlock(tenantId, blockId);
    // ⭐ REJECTED → re-soumission possible après correction (pattern fiches)
    if (block.status !== 'DRAFT' && block.status !== 'REJECTED') {
      throw new BadRequestException(`Le bloc est déjà ${block.status}`);
    }
    if (!block.sheets || block.sheets.length === 0) {
      throw new BadRequestException('Aucune épreuve dans le bloc — ajoutez au moins une épreuve');
    }
    // Garde-fou : au moins une épreuve avec du contenu réel
    const filled = block.sheets.filter((s: any) => this.hasText(s.situation) || this.hasText(s.consignes));
    if (filled.length === 0) {
      throw new BadRequestException('Aucune épreuve préparée (situation ou consignes vides)');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE exam_preparation_blocks
       SET "status" = 'SUBMITTED', "submittedAt" = NOW(), "rejectionReason" = NULL, "updatedAt" = NOW()
       WHERE "id" = $1 AND "tenantId" = $2`,
      blockId, tenantId,
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE exam_preparation_sheets SET "status" = 'SUBMITTED', "updatedAt" = NOW()
       WHERE "blockId" = $1 AND "tenantId" = $2`,
      blockId, tenantId,
    );

    // ⭐ Notifier les directeurs (pattern notifyDirectorsOfCahierJournalSubmission)
    void this.notifyDirectorsOfBlockSubmission(tenantId, block).catch((err) =>
      this.logger.warn(`notifyDirectorsOfBlockSubmission failed: ${err.message}`),
    );

    return this.getBlock(tenantId, blockId);
  }

  /** Validation / rejet par le directeur. */
  async validateBlock(
    tenantId: string,
    blockId: string,
    action: 'VALIDATED' | 'REJECTED',
    validatedBy?: string,
    rejectionReason?: string,
    directorObservation?: string,
  ) {
    const block = await this.getBlock(tenantId, blockId);
    if (block.status !== 'SUBMITTED' && block.status !== 'VALIDATED') {
      throw new BadRequestException(`Le bloc doit être SUBMITTED (actuel : ${block.status})`);
    }
    if (action === 'REJECTED' && !rejectionReason) {
      throw new BadRequestException('Un motif de rejet est requis');
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE exam_preparation_blocks
       SET "status" = $3, "validatedAt" = ${action === 'VALIDATED' ? 'NOW()' : '"validatedAt"'},
           "validatedBy" = $4, "rejectionReason" = $5,
           "directorObservation" = COALESCE($6, "directorObservation"),
           "updatedAt" = NOW()
       WHERE "id" = $1 AND "tenantId" = $2`,
      blockId, tenantId, action, validatedBy || null,
      action === 'REJECTED' ? rejectionReason : null,
      directorObservation ?? null,
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE exam_preparation_sheets SET "status" = $3, "updatedAt" = NOW()
       WHERE "blockId" = $1 AND "tenantId" = $2`,
      blockId, tenantId, action,
    );

    // ⭐ Notifier l'enseignant de la décision (pattern notifyTeacherOfFicheDecision)
    void this.notifyTeacherOfBlockDecision(tenantId, block, action, rejectionReason).catch((err) =>
      this.logger.warn(`notifyTeacherOfBlockDecision failed: ${err.message}`),
    );

    return this.getBlock(tenantId, blockId);
  }

  /** Envoi au SECRÉTARIAT après validation (VALIDATED → SENT_TO_SECRETARIAT). */
  async sendBlockToSecretariat(tenantId: string, blockId: string) {
    const block = await this.getBlock(tenantId, blockId);
    if (block.status !== 'VALIDATED') {
      throw new BadRequestException(`Le bloc doit être VALIDATED par la direction avant l'envoi au secrétariat (actuel : ${block.status})`);
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE exam_preparation_blocks
       SET "status" = 'SENT_TO_SECRETARIAT', "sentToSecretariatAt" = NOW(), "updatedAt" = NOW()
       WHERE "id" = $1 AND "tenantId" = $2`,
      blockId, tenantId,
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE exam_preparation_sheets SET "status" = 'SENT_TO_SECRETARIAT', "updatedAt" = NOW()
       WHERE "blockId" = $1 AND "tenantId" = $2`,
      blockId, tenantId,
    );

    // ⭐ Notifier les secrétaires
    void this.notifySecretariesOfBlockReception(tenantId, block).catch((err) =>
      this.logger.warn(`notifySecretariesOfBlockReception failed: ${err.message}`),
    );

    return this.getBlock(tenantId, blockId);
  }

  // ===========================================================================
  // 5. DIRECTION — file d'attente des blocs
  // ===========================================================================

  async getDirectorPendingBlocks(tenantId: string, academicYearId: string, status?: string) {
    const statusFilter = status && status !== 'ALL' ? `AND b."status" = $3` : '';
    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT b.*,
              (SELECT COUNT(*)::int FROM exam_preparation_sheets sh WHERE sh."blockId" = b."id") AS "sheetsCount",
              t."firstName" AS "teacherFirstName", t."lastName" AS "teacherLastName", t."gender" AS "teacherGender"
       FROM exam_preparation_blocks b
       LEFT JOIN teachers t ON t."id" = b."teacherId"
       WHERE b."tenantId" = $1 AND b."academicYearId" = $2 ${statusFilter}
       ORDER BY (CASE b."status" WHEN 'SUBMITTED' THEN 0 ELSE 1 END), b."submittedAt" DESC NULLS LAST`,
      ...(statusFilter ? [tenantId, academicYearId, status] : [tenantId, academicYearId]),
    ).catch(() => []);
    return rows || [];
  }

  // ===========================================================================
  // 6. SECRÉTARIAT — réception des épreuves, hiérarchisées
  //    classe → trimestre → mois (pattern catalogue fiches)
  // ===========================================================================

  async getSecretariatEpreuves(tenantId: string, academicYearId: string) {
    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT b."id", b."title", b."className", b."classId", b."monthLabel", b."trimesterLabel",
              b."examDate", b."status", b."sentToSecretariatAt", b."validatedAt", b."submittedAt",
              (SELECT COUNT(*)::int FROM exam_preparation_sheets sh WHERE sh."blockId" = b."id") AS "sheetsCount",
              (SELECT string_agg(sh."subjectName", ' · ' ORDER BY sh."orderIndex")
               FROM exam_preparation_sheets sh WHERE sh."blockId" = b."id") AS "subjectsLabel",
              t."firstName" AS "teacherFirstName", t."lastName" AS "teacherLastName"
       FROM exam_preparation_blocks b
       LEFT JOIN teachers t ON t."id" = b."teacherId"
       WHERE b."tenantId" = $1 AND b."academicYearId" = $2
         AND b."status" IN ('SENT_TO_SECRETARIAT', 'VALIDATED', 'SUBMITTED')
       ORDER BY b."classId" ASC, b."trimesterLabel" ASC, b."monthLabel" ASC, b."examDate" ASC`,
      tenantId, academicYearId,
    ).catch(() => []);

    // Hiérarchisation : classe → trimestre → mois → blocs
    const parClasse = new Map<string, any>();
    for (const b of rows || []) {
      if (!parClasse.has(b.classId)) {
        parClasse.set(b.classId, {
          classId: b.classId, className: b.className || '—', parTrimestre: new Map<string, any>(),
        });
      }
      const cls = parClasse.get(b.classId);
      const tri = b.trimesterLabel || '—';
      if (!cls.parTrimestre.has(tri)) {
        cls.parTrimestre.set(tri, { trimesterLabel: tri, parMois: new Map<string, any>() });
      }
      const triGroup = cls.parTrimestre.get(tri);
      const mois = b.monthLabel || '—';
      if (!triGroup.parMois.has(mois)) {
        triGroup.parMois.set(mois, { monthLabel: mois, blocs: [] });
      }
      triGroup.parMois.get(mois).blocs.push(b);
    }
    // Conversion Maps → tableaux
    const classes = Array.from(parClasse.values()).map((c: any) => ({
      classId: c.classId, className: c.className,
      trimestres: Array.from(c.parTrimestre.values()).map((t: any) => ({
        trimesterLabel: t.trimesterLabel,
        mois: Array.from(t.parMois.values()),
      })),
    }));
    return { classes, total: (rows || []).length };
  }

  // ===========================================================================
  // 7. CATALOGUE — hiérarchisé Classes → Trimestres → Mois → Sessions
  // ===========================================================================

  async getCatalogue(tenantId: string, academicYearId: string, teacherIdRaw?: string, classId?: string) {
    let teacherId: string | null = null;
    if (teacherIdRaw) teacherId = await this.resolveTeacherId(tenantId, teacherIdRaw);

    const rows: any = await this.prisma.$queryRawUnsafe(
      `SELECT b."id", b."title", b."className", b."classId", b."monthLabel", b."trimesterLabel",
              b."examDate", b."status", b."createdAt",
              (SELECT COUNT(*)::int FROM exam_preparation_sheets sh WHERE sh."blockId" = b."id") AS "sheetsCount",
              (SELECT string_agg(sh."subjectName", ' · ' ORDER BY sh."orderIndex")
               FROM exam_preparation_sheets sh WHERE sh."blockId" = b."id") AS "subjectsLabel"
       FROM exam_preparation_blocks b
       WHERE b."tenantId" = $1 AND b."academicYearId" = $2
         ${teacherId ? `AND b."teacherId" = $3` : ''}
         ${classId ? `AND b."classId" = $4` : ''}
       ORDER BY b."className" ASC, b."trimesterLabel" ASC, b."monthLabel" ASC, b."examDate" ASC`,
      ...(teacherId && classId ? [tenantId, academicYearId, teacherId, classId]
        : teacherId ? [tenantId, academicYearId, teacherId]
        : [tenantId, academicYearId]),
    ).catch(() => []);

    const parClasse = new Map<string, any>();
    for (const b of rows || []) {
      if (!parClasse.has(b.classId)) {
        parClasse.set(b.classId, { classId: b.classId, className: b.className || '—', trimestres: new Map<string, any>() });
      }
      const cls = parClasse.get(b.classId);
      const tri = b.trimesterLabel || '—';
      if (!cls.trimestres.has(tri)) cls.trimestres.set(tri, { trimesterLabel: tri, mois: new Map<string, any>() });
      const triGroup = cls.trimestres.get(tri);
      const mois = b.monthLabel || '—';
      if (!triGroup.mois.has(mois)) triGroup.mois.set(mois, { monthLabel: mois, blocs: [] });
      triGroup.mois.get(mois).blocs.push(b);
    }
    const classes = Array.from(parClasse.values()).map((c: any) => ({
      classId: c.classId, className: c.className,
      trimestres: Array.from(c.trimestres.values()).map((t: any) => ({
        trimesterLabel: t.trimesterLabel,
        mois: Array.from(t.mois.values()),
      })),
    }));
    return { classes, total: (rows || []).length };
  }

  // ===========================================================================
  // 8. NOTIFICATIONS (patterns fiches : directeurs / enseignant / secrétaires)
  // ===========================================================================

  private async getSchoolName(tenantId: string): Promise<string> {
    try {
      const profile: any = await this.prisma.$queryRawUnsafe(
        `SELECT "schoolName" FROM "tenant_identity_profiles"
         WHERE "tenantId" = $1 AND "isActive" = true LIMIT 1`, tenantId,
      );
      if (profile && profile.length > 0) return profile[0].schoolName || 'Établissement scolaire';
    } catch { /* silent */ }
    return 'Établissement scolaire';
  }

  /** Notifie les directeurs qu'un bloc d'épreuves a été soumis. */
  private async notifyDirectorsOfBlockSubmission(tenantId: string, block: any) {
    const directorRoles = ['PROMOTER', 'SCHOOL_OWNER', 'DIRECTOR', 'DIRECTEUR_GENERAL',
      'DIRECTEUR_ETAPE', 'DIRECTEUR_PEDAGOGIQUE', 'ADMIN', 'SUPER_ADMIN', 'PLATFORM_OWNER'];
    const directors: any = await this.prisma.$queryRawUnsafe(
      `SELECT id, "firstName", "lastName", role FROM "users"
       WHERE "tenantId" = $1 AND role = ANY($2::text[]) AND "isActive" = true`,
      tenantId, directorRoles,
    ).catch(() => []);
    if (!directors || directors.length === 0) return;

    const schoolName = await this.getSchoolName(tenantId);
    const className = block.className || '—';
    const title = block.title || 'Évaluation';
    const sheetsCount = block.sheets?.length || 0;
    const notifTitle = `Épreuves d'évaluation soumises — ${className}`;
    const notifBody = `Bloc « ${title} » (${sheetsCount} épreuve(s)) — ${block.monthLabel || ''} ${block.trimesterLabel || ''}. Veuillez le valider dans Contrôle direction → Épreuves d'évaluation.`;

    for (const d of directors) {
      await this.notificationService.create({
        tenantId,
        recipientId: d.id,
        type: 'EXAM_PREP_SUBMITTED',
        title: notifTitle,
        body: notifBody,
        priority: 'HIGH',
        data: { url: '/app/pedagogy/control?onglet=epreuves', blockId: block.id, className, schoolName },
        relatedEntityType: 'ExamPreparationBlock',
        relatedEntityId: block.id,
      }).catch(() => null);
    }
    this.logger.log(`Directeurs notifiés (${directors.length}) — bloc ${block.id}`);
  }

  /** Notifie l'enseignant de la décision du directeur. */
  private async notifyTeacherOfBlockDecision(
    tenantId: string, block: any, action: string, rejectionReason?: string,
  ) {
    // Résolution Teacher → User par email
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: block.teacherId, tenantId },
      select: { email: true, firstName: true, lastName: true },
    }).catch(() => null);
    if (!teacher?.email) return;
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: teacher.email, mode: 'insensitive' }, tenantId },
      select: { id: true },
    }).catch(() => null);
    if (!user) return;

    const validated = action === 'VALIDATED';
    await this.notificationService.create({
      tenantId,
      recipientId: user.id,
      type: validated ? 'EXAM_PREP_VALIDATED' : 'EXAM_PREP_REJECTED',
      title: validated
        ? `Épreuves validées — ${block.className || ''}`
        : `Épreuves rejetées — ${block.className || ''}`,
      body: validated
        ? `Le bloc « ${block.title || 'Évaluation'} » a été validé par la direction. Vous pouvez maintenant l'envoyer au secrétariat pour impression.`
        : `Le bloc « ${block.title || 'Évaluation'} » a été rejeté. Motif : ${rejectionReason || '—'}`,
      priority: validated ? 'MEDIUM' : 'HIGH',
      data: { url: '/app/teacher/exam-preparation', blockId: block.id },
      relatedEntityType: 'ExamPreparationBlock',
      relatedEntityId: block.id,
    }).catch(() => null);
    this.logger.log(`Enseignant notifié de la décision (${action}) — bloc ${block.id}`);
  }

  /** Notifie les secrétaires qu'un bloc d'épreuves est arrivé. */
  private async notifySecretariesOfBlockReception(tenantId: string, block: any) {
    const secretaryRoles = ['SECRETAIRE', 'SECRETAIRE_GENERAL',
      'SECRETAIRE_MATERNELLE', 'SECRETAIRE_PRIMAIRE', 'SECRETAIRE_SECONDAIRE', 'SECRETAIRE_MAT_PRI',
      'SECRETARY', 'SCOLARITE', 'RESP_SCOLARITE',
      'SECRETAIRE_COMPTABLE', 'SECRETAIRE_COMPTABLE_MATERNELLE', 'SECRETAIRE_COMPTABLE_PRIMAIRE',
      'SECRETAIRE_COMPTABLE_SECONDAIRE', 'SECRETAIRE_COMPTABLE_MAT_PRI', 'SECRETARY_ACCOUNTANT'];
    const secretaries: any = await this.prisma.$queryRawUnsafe(
      `SELECT id, "firstName", "lastName", role FROM "users"
       WHERE "tenantId" = $1 AND role = ANY($2::text[]) AND "isActive" = true`,
      tenantId, secretaryRoles,
    ).catch(() => []);
    if (!secretaries || secretaries.length === 0) return;

    const sheetsCount = block.sheets?.length || 0;
    for (const s of secretaries) {
      await this.notificationService.create({
        tenantId,
        recipientId: s.id,
        type: 'EXAM_PREP_SECRETARIAT',
        title: `Épreuves reçues — ${block.className || ''}`,
        body: `Bloc « ${block.title || 'Évaluation'} » (${sheetsCount} épreuve(s)) — ${block.monthLabel || ''} ${block.trimesterLabel || ''}. Disponible pour visualisation et impression dans Réception des épreuves.`,
        priority: 'HIGH',
        data: { url: '/app/exam-reception', blockId: block.id },
        relatedEntityType: 'ExamPreparationBlock',
        relatedEntityId: block.id,
      }).catch(() => null);
    }
    this.logger.log(`Secrétaires notifiés (${secretaries.length}) — bloc ${block.id}`);
  }

  // ===========================================================================
  // 9. EXPORT PDF PROFESSIONNEL (Puppeteer — pattern exportFichePdf)
  //    Conforme aux modèles officiels CP / CE2 / CM1 fournis
  // ===========================================================================

  /** Export PDF d'UNE épreuve. */
  async exportSheetPdf(tenantId: string, sheetId: string): Promise<Buffer> {
    const sheet = await this.getSheet(tenantId, sheetId);
    return this.renderEpreuvePdf(tenantId, [sheet]);
  }

  /** Export PDF du BLOC complet (toutes les épreuves, page par matière). */
  async exportBlockPdf(tenantId: string, blockId: string): Promise<Buffer> {
    const block = await this.getBlock(tenantId, blockId);
    return this.renderEpreuvePdf(tenantId, block.sheets || []);
  }

  private async renderEpreuvePdf(tenantId: string, sheets: any[]): Promise<Buffer> {
    if (!sheets || sheets.length === 0) throw new NotFoundException('Aucune épreuve à exporter');

    // Identité école + année scolaire (pattern fiches)
    const identityRows: any = await this.prisma.$queryRawUnsafe(
      `SELECT tip."schoolName", tip."schoolAcronym", tip."logoUrl",
              (SELECT "name" FROM "academic_years" WHERE "id" = $2 LIMIT 1) AS "academicYearName"
       FROM "tenant_identity_profiles" tip
       WHERE tip."tenantId" = $1 AND tip."isActive" = true
       ORDER BY tip."version" DESC LIMIT 1`,
      tenantId, sheets[0].academicYearId,
    ).catch(() => []);
    const identity = identityRows?.[0] || {};

    // Téléphone de l'école (tenant)
    let phone = '';
    try {
      const sch: any = await this.prisma.$queryRawUnsafe(
        `SELECT "phoneNumber" FROM "schools" WHERE "tenantId" = $1 LIMIT 1`, tenantId,
      );
      if (sch && sch.length > 0) phone = sch[0].phoneNumber || '';
    } catch { /* silent */ }

    // Logo en data-URL pour Puppeteer
    let logoDataUrl = '';
    if (identity.logoUrl) {
      if (identity.logoUrl.startsWith('data:') || identity.logoUrl.startsWith('http')) {
        logoDataUrl = identity.logoUrl;
      } else {
        const apiBaseUrl = this.configService.get<string>('APP_PUBLIC_URL')
          || this.configService.get<string>('API_URL')
          || 'https://api.academiahelm.com';
        logoDataUrl = `${apiBaseUrl}${identity.logoUrl.startsWith('/') ? '' : '/'}${identity.logoUrl}`;
      }
    }

    const html = this.buildEpreuvesPdfHtml(sheets, {
      schoolName: identity.schoolName || 'Établissement scolaire',
      academicYearName: identity.academicYearName || '',
      phone,
      logoDataUrl,
    });

    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 500));
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
        headerTemplate: '<div></div>',
        footerTemplate: '<div></div>',
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * Construit le HTML des épreuves (une page par matière) — structure
   * conforme aux modèles officiels :
   *   Entête : école + logo + tel | année scolaire | classe
   *   Titre de l'évaluation + Nom / Prénoms + EPREUVE : matière + durée
   *   Situation d'évaluation / Tâche / Consignes-Items (HTML riche assaini)
   *   Clé de correction + Grille (pages séparées si présentes)
   */
  private buildEpreuvesPdfHtml(
    sheets: any[],
    ctx: { schoolName: string; academicYearName: string; phone: string; logoDataUrl: string },
  ): string {
    const pagesHtml = sheets.map((sh) => {
      const situation = this.sanitizeRichHtml(sh.situation || '');
      const tache = this.sanitizeRichHtml(sh.tache || '');
      const consignes = this.sanitizeRichHtml(sh.consignes || '');
      const cle = this.sanitizeRichHtml(sh.cleCorrection || '');
      const grille = this.sanitizeRichHtml(sh.grilleCorrection || '');

      const identityBlock = sh.showIdentityFields !== false ? `
        <div class="identity">
          <div class="id-field"><span>Nom :</span><span class="dots"></span></div>
          <div class="id-field"><span>Prénoms :</span><span class="dots"></span></div>
        </div>` : '';

      const epreuvePages = [];

      // Page principale de l'épreuve
      epreuvePages.push(`
      <div class="epreuve-page">
        <div class="header">
          <div class="school-line">
            ${ctx.logoDataUrl ? `<img src="${ctx.logoDataUrl}" class="logo" />` : ''}
            <div class="school-name">« ${ctx.schoolName} »</div>
          </div>
          <div class="meta-row">
            <div class="meta-left">${ctx.phone ? `Tél : ${ctx.phone}` : ''}</div>
            <div class="meta-center">${ctx.academicYearName ? `Année scolaire : ${ctx.academicYearName}` : ''}</div>
            <div class="meta-right">Classe : <b>${sh.blockClassName || ''}</b></div>
          </div>
          <div class="eval-title">${(sh.blockTitle || 'ÉVALUATION').toUpperCase()}</div>
          ${identityBlock}
          <div class="epreuve-title">EPREUVE : ${(sh.subjectName || '—').toUpperCase()}</div>
          ${sh.durationLabel ? `<div class="duration">Durée : ${sh.durationLabel}</div>` : ''}
        </div>

        ${situation ? `
        <div class="section">
          <div class="section-label">Situation d'évaluation</div>
          <div class="section-body">${situation}</div>
        </div>` : ''}

        ${tache ? `
        <div class="section">
          <div class="section-label">Tâche</div>
          <div class="section-body">${tache}</div>
        </div>` : ''}

        ${consignes ? `
        <div class="section">
          <div class="section-label">Consigne</div>
          <div class="section-body consignes">${consignes}</div>
        </div>` : ''}

        ${sh.maxScoreLabel || sh.coefficient ? `
        <div class="score-line">
          ${sh.maxScoreLabel ? `<span>Barème : ${sh.maxScoreLabel}${String(sh.maxScoreLabel).includes('pt') ? '' : ' pts'}</span>` : ''}
          ${sh.coefficient ? `<span>Coefficient : ${sh.coefficient}</span>` : ''}
        </div>` : ''}
      </div>`);

      // Clé de correction (page séparée — document enseignant)
      if (cle) {
        epreuvePages.push(`
        <div class="epreuve-page correction">
          <div class="correction-banner">CLÉ DE CORRECTION — ${(sh.subjectName || '—').toUpperCase()} — ${sh.blockClassName || ''} <span>(document enseignant)</span></div>
          <div class="section-body">${cle}</div>
        </div>`);
      }
      // Grille de correction (page séparée)
      if (grille) {
        epreuvePages.push(`
        <div class="epreuve-page correction">
          <div class="correction-banner">GRILLE DE CORRECTION — ${(sh.subjectName || '—').toUpperCase()} — ${sh.blockClassName || ''} <span>(document enseignant)</span></div>
          <div class="section-body">${grille}</div>
        </div>`);
      }
      return epreuvePages.join('\n');
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=Patrick+Hand&display=swap" rel="stylesheet">
<style>
  @page { size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Times New Roman', 'Noto Serif', serif; color: #111; font-size: 12px; line-height: 1.55; }
  .epreuve-page { page-break-after: always; padding: 4mm 2mm; }
  .epreuve-page:last-child { page-break-after: auto; }

  .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; }
  .school-line { display: flex; align-items: center; justify-content: center; gap: 10px; }
  .logo { height: 52px; max-width: 130px; object-fit: contain; }
  .school-name { font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.4px; }
  .meta-row { display: flex; justify-content: space-between; font-size: 10.5px; margin-top: 4px; gap: 8px; }
  .eval-title { font-size: 14px; font-weight: bold; margin-top: 10px; text-decoration: underline; }
  .epreuve-title { font-size: 13px; font-weight: bold; margin-top: 12px; padding: 4px 10px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 3px; display: inline-block; }
  .duration { font-size: 11px; margin-top: 6px; font-weight: bold; }

  .identity { display: flex; gap: 24px; margin-top: 12px; font-size: 11.5px; }
  .id-field { flex: 1; display: flex; align-items: flex-end; gap: 4px; }
  .id-field .dots { flex: 1; border-bottom: 1px dotted #444; height: 14px; }

  .section { margin-top: 14px; }
  .section-label { font-weight: bold; font-size: 12px; margin-bottom: 4px; color: #1e3a8a; }
  .section-body { font-size: 12px; }
  .section-body img { max-width: 100%; height: auto; }
  .section-body table { border-collapse: collapse; width: 100%; margin: 6px 0; }
  .section-body td, .section-body th { border: 1px solid #444; padding: 4px 6px; vertical-align: top; }
  .section-body svg { max-width: 100%; height: auto; }

  /* Lignes calligraphiques insérées par l'éditeur (classes dédiées) */
  .calli-lines { border: none !important; background: none !important; }
  .calli-line { height: 26px; border-bottom: 1px solid #999; position: relative; }
  .calli-line.dotted-mid::after { content: ''; position: absolute; left: 0; right: 0; top: 13px; border-bottom: 1px dotted #bbb; }
  .calli-model { font-size: 20px; color: #9aa4b2; letter-spacing: 2px; line-height: 26px; }
  .calli-model.cursive { font-family: 'Segoe Script', 'Brush Script MT', cursive; }
  .calli-model.script { font-family: 'Comic Sans MS', 'Calibri', sans-serif; }

  .score-line { display: flex; justify-content: flex-end; gap: 18px; font-size: 11px; margin-top: 10px; font-weight: bold; }

  .correction-banner { background: #111; color: #fff; padding: 8px 12px; font-weight: bold; font-size: 13px; margin-bottom: 12px; }
  .correction-banner span { font-weight: normal; font-size: 10px; font-style: italic; }
  .correction .section-body { font-size: 11.5px; }
</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
  }
}
