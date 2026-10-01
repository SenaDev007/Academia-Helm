/**
 * ============================================================================
 * DISTINCTIONS CONTROLLER — Tableau d'honneur (Academia Helm)
 * ============================================================================
 *
 * Endpoints :
 *   GET  /api/institutional-exams/distinctions/types
 *     Retourne le catalogue des distinctions par niveau (mention / prix spécial / graduation)
 *
 *   GET  /api/institutional-exams/distinctions/class/:classId
 *     Query: periodId, academicYearId, level (MATERNELLE | PRIMAIRE | SECONDAIRE)
 *     Response: Array de {
 *       id, name, matricule, average, base, rank, classSize,
 *       distinctionCode (résolu via rules.ts resolveDistinction),
 *       distinctionLabel,
 *       specialAwards: DistinctionCode[] (secondaire uniquement — rules.ts resolveSpecialAwards)
 *       specialAwardLabels: string[]
 *     }
 *
 *   POST /api/institutional-exams/distinctions/generate-board
 *     Body: { classId, periodId, academicYearId, level }
 *     Response: PDF binaire
 *
 *   POST /api/institutional-exams/distinctions/generate-certificate
 *     Body: { studentId, studentName, classId, className, periodId, academicYearId, level,
 *            code?, average?, rank?, classSize?, previousAverage?, previousLabel? }
 *     Si code n'est pas fourni, il est résolu via resolveDistinction(average).
 *     Pour SEC_PROGRES, previousAverage est auto-calculé si non fourni.
 *     Response: PDF binaire
 *
 *   POST /api/institutional-exams/distinctions/send-certificate
 *     Idem + envoi email + Helm Connect + bell icon au parent
 *     Response: { success, results: { email, helmConnect, bellIcon } }
 * ============================================================================
 */

import {
  Controller, Post, Get, Body, Param, Query, UseGuards, Res, Headers, Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions.decorator';
import { Public } from '../../../auth/decorators/public.decorator';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { PuppeteerPoolService } from '../../../common/services/puppeteer-pool.service';
import { buildBoardHtml, buildCertificateHtml } from './html-builder';
import {
  resolveDistinction, resolveSpecialAwards, makeVerificationCodeWithNonce, verificationUrl, THEMES,
  DEFAULT_RULES, GRADUATION_CODE,
} from './html-builder';
import type { BoardInput, BoardRow, DistinctionCode, DistinctionInput, Level } from './html-builder';
import { DistinctionsNotificationService } from './distinctions-notification.service';

/**
 * ⭐ Controller public pour la vérification des QR codes (sans JWT — accessible à tout parent
 * qui scanne le QR code d'un certificat). Déclaré séparément pour ne PAS appliquer
 * JwtAuthGuard + PermissionsGuard qui sont appliqués au DistinctionsController principal.
 *
 * @Public() désactive le JwtAuthGuard GLOBAL (APP_GUARD) pour cette route afin que
 * n'importe qui (sans token JWT) puisse vérifier un QR code.
 */
@Controller('public/distinctions')
export class PublicDistinctionsController {
  private readonly logger = new Logger(PublicDistinctionsController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/public/distinctions/verify/:code
   *    Vérifie publiquement un code QR de distinction et retourne les infos
   *    de l'émission (élève, distinction, période, école, statut).
   *    Pas d'authentification — c'est un endpoint public de vérification.
   */
  @Public()
  @Get('verify/:code')
  async verifyDistinction(@Param('code') code: string, @Res() res: Response) {
    if (!code || code.length < 10) {
      return res.status(400).json({ valid: false, error: 'Code invalide' });
    }

    try {
      const record = await this.prisma.distinctionRecord.findUnique({
        where: { verificationCode: code },
        include: {
          student: { select: { firstName: true, lastName: true, matricule: true } },
          academicYear: { select: { label: true } },
          class: { select: { name: true } },
          tenant: { select: { name: true } },
        },
      }).catch(() => null);

      if (!record) {
        return res.json({
          valid: false,
          error: 'Code de vérification introuvable',
          code,
        });
      }

      if (record.status === 'REVOKED') {
        return res.json({
          valid: false,
          error: 'Ce certificat a été révoqué',
          code,
          revokedAt: record.updatedAt,
        });
      }

      const studentName = `${record.student.firstName || ''} ${record.student.lastName || ''}`.trim();
      const theme = THEMES[record.code as DistinctionCode];

      return res.json({
        valid: true,
        code: record.verificationCode,
        nonce: record.nonce,
        status: record.status,
        issuedOn: record.issuedOn,
        // Infos publiques (le parent qui scanne voit ces informations)
        student: {
          name: studentName,
          matricule: record.student.matricule || null,
          className: record.class?.name || null,
        },
        distinction: {
          code: record.code,
          label: record.label,
          title: theme?.title || record.label,
          subtitle: theme?.subtitle || null,
          category: record.category,
        },
        period: {
          academicYear: record.academicYear?.label || null,
        },
        results: record.average != null ? {
          average: record.average,
          base: record.base,
          rank: record.rank,
          classSize: record.classSize,
        } : null,
        school: {
          name: record.tenant?.name || 'Établissement',
        },
        documentType: record.documentType,
        issuedAt: record.createdAt,
        verifiedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      this.logger.error('Erreur verifyDistinction:', err);
      return res.status(500).json({ valid: false, error: 'Erreur serveur' });
    }
  }
}

@Controller('institutional-exams/distinctions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class DistinctionsController {
  private readonly logger = new Logger(DistinctionsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly notificationService: DistinctionsNotificationService,
  ) {}

  private mapLevel(scopeLevel: string): Level {
    const l = (scopeLevel || '').toUpperCase().trim();
    if (l === 'MATERNELLE' || l === 'MAT' || l === 'NURSERY') return 'maternel';
    if (l === 'SECONDAIRE' || l === 'SEC') return 'secondaire';
    return 'primaire';
  }

  /**
   * Récupère le branding complet du tenant pour l'en-tête officiel style bulletin
   * (logo, nom école, slogan, adresse, téléphone, email).
   * ⭐ Les informations sont récupérées depuis TenantIdentityProfile (même source
   *    que les bulletins) pour garantir un en-tête identique.
   */
  private async getTenantBranding(tenantId: string) {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: {
          schoolName: true, logoUrl: true, address: true, city: true,
          phonePrimary: true, email: true, slogan: true, country: true,
        },
      });
      if (profile?.schoolName) {
        const apiBaseUrl = process.env.API_BASE_URL || 'https://api.academiahelm.com';
        return {
          name: profile.schoolName,
          logoUrl: profile.logoUrl ? `${apiBaseUrl}/api/tenants/${tenantId}/logo` : undefined,
          address: profile.address || undefined,
          city: profile.city || undefined,
          phone: profile.phonePrimary || undefined,
          email: profile.email || undefined,
          slogan: profile.slogan || undefined,
          countryCode: profile.country || 'BJ',
        };
      }
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      return { name: tenant?.name || 'Établissement' };
    } catch {
      return { name: 'Établissement' };
    }
  }

  /**
   * ⭐ Résout dynamiquement le nom du directeur de l'établissement pour un niveau scolaire.
   *    Même logique que dans bulletins.controller.ts :
   *    1. staff_admin_assignments (RH) — priorité hiérarchique DIRECTEUR_GENERAL > DIRECTEUR > PROVISEUR
   *    2. school_directors (signature) — fallback pour le nom + signature
   *    3. documentSealsService.getDirectorSeals — fallback final
   */
  private async resolveDirectorName(
    tenantId: string, schoolLevelId: string | null, lang: string = 'FR',
  ): Promise<{ directorName: string | null; directorSignatureUrl: string | null }> {
    if (!tenantId || !schoolLevelId) return { directorName: null, directorSignatureUrl: null };

    let directorName: string | null = null;
    let directorSignatureUrl: string | null = null;

    // 1. Code du niveau scolaire (MAT / PRI / SEC)
    let levelCode = '';
    try {
      const levelRow = await this.prisma.schoolLevel.findUnique({
        where: { id: schoolLevelId },
        select: { code: true },
      }).catch(() => null);
      levelCode = (levelRow?.code || '').toUpperCase().trim();
    } catch { /* ignore */ }

    const targetLevelCodes =
      ['MAT', 'MATERNELLE'].includes(levelCode) ? ['MAT', 'MAT_PRI', 'ALL'] :
      ['PRI', 'PRIMAIRE'].includes(levelCode) ? ['PRI', 'MAT_PRI', 'ALL'] :
      ['SEC', 'SECONDAIRE'].includes(levelCode) ? ['SEC', 'ALL'] :
      ['MAT_PRI'].includes(levelCode) ? ['MAT_PRI', 'ALL'] : null;

    if (targetLevelCodes) {
      try {
        // 1a. UUID de la piste linguistique
        const trackRow = await this.prisma.academicTrack.findFirst({
          where: { tenantId, code: lang },
          select: { id: true },
        }).catch(() => null);
        const trackUuid = trackRow?.id || null;

        // 1b. Affectations actives de direction pour ce niveau + piste + année
        const assignments = await this.prisma.staffAdminAssignment.findMany({
          where: {
            tenantId,
            isActive: true,
            schoolLevelCode: { in: targetLevelCodes },
            adminRole: { in: ['DIRECTEUR_GENERAL', 'DIRECTEUR', 'PROVISEUR', 'DIRECTEUR_DES_ETUDES', 'DIRECTEUR_ADJOINT'] },
            OR: [
              { academicTrackId: null },
              ...(trackUuid ? [{ academicTrackId: trackUuid }] : []),
            ],
            AND: [{ OR: [{ academicYearId: null }] }],
          },
          include: { staff: { select: { firstName: true, lastName: true, gender: true } } },
          orderBy: { startDate: 'desc' },
        }).catch(() => []);

        if (Array.isArray(assignments) && assignments.length > 0) {
          const ROLE_PRIORITY = ['DIRECTEUR_GENERAL', 'DIRECTEUR', 'PROVISEUR', 'DIRECTEUR_DES_ETUDES', 'DIRECTEUR_ADJOINT'];
          const sorted = [...assignments].sort((a: any, b: any) => {
            const pa = ROLE_PRIORITY.indexOf(a.adminRole);
            const pb = ROLE_PRIORITY.indexOf(b.adminRole);
            if (pa !== pb) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
            const ya = a.academicYearId ? 0 : 1;
            const yb = b.academicYearId ? 0 : 1;
            if (ya !== yb) return ya - yb;
            return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
          });
          const best: any = sorted[0];
          if (best?.staff) {
            const last = (best.staff.lastName || '').trim().toUpperCase();
            const first = (best.staff.firstName || '').trim();
            const civility = best.staff.gender === 'F' ? 'Mme' : (best.staff.gender === 'M' ? 'M.' : '');
            directorName = civility ? `${civility} ${last} ${first}`.trim() : `${last} ${first}`.trim();
          }
        }
      } catch { /* silent */ }
    }

    // 2. Fallback : table school_directors (nom + signature)
    try {
      const directorRows: any = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM school_directors
         WHERE "tenantId" = $1 AND "schoolLevelId" = $2 AND "language" = $3 AND "isActive" = true
         LIMIT 1`,
        tenantId, schoolLevelId, lang,
      );
      if (Array.isArray(directorRows) && directorRows.length > 0) {
        const director = directorRows[0];
        directorSignatureUrl = director.signatureDataUrl || director.signatureUploadedUrl || null;
        if (!directorName) directorName = director.fullName || null;
      } else {
        const fallbackLang = lang === 'EN' ? 'FR' : 'EN';
        const fallbackRows: any = await this.prisma.$queryRawUnsafe(
          `SELECT * FROM school_directors
           WHERE "tenantId" = $1 AND "schoolLevelId" = $2 AND "language" = $3 AND "isActive" = true
           LIMIT 1`,
          tenantId, schoolLevelId, fallbackLang,
        );
        if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
          const director = fallbackRows[0];
          directorSignatureUrl = director.signatureDataUrl || director.signatureUploadedUrl || null;
          if (!directorName) directorName = director.fullName || null;
        }
      }
    } catch { /* silent */ }

    return { directorName, directorSignatureUrl };
  }

  /**
   * ⭐ Résout dynamiquement le nom du professeur principal d'une classe.
   *    Source : StudentEnrollment → TeacherClassAssignment → Teacher
   *    Même logique que dans bulletins.controller.ts.
   */
  private async resolveTeacherName(
    tenantId: string, classId: string,
  ): Promise<string | null> {
    try {
      const tca = await this.prisma.teacherClassAssignment.findFirst({
        where: { classId, tenantId },
        select: { teacherId: true },
      }).catch(() => null);

      if (!tca?.teacherId) return null;

      const teacher = await this.prisma.teacher.findFirst({
        where: { id: tca.teacherId },
        select: { firstName: true, lastName: true, gender: true },
      }).catch(() => null);

      if (!teacher) return null;

      const last = (teacher.lastName || '').trim().toUpperCase();
      const first = (teacher.firstName || '').trim();
      const civility = teacher.gender === 'F' ? 'Mme' : (teacher.gender === 'M' ? 'M.' : '');
      return civility ? `${civility} ${last} ${first}`.trim() : `${last} ${first}`.trim();
    } catch {
      return null;
    }
  }

  /**
   * Renvoie le libellé du ministère de tutelle selon le niveau scolaire
   * (identique à bulletin-pdf.service.ts).
   */
  private getMinistryLabel(level: Level): string {
    return level === 'secondaire'
      ? "Ministère de l'Enseignement Secondaire, de la Formation Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes"
      : 'Ministère des Enseignements Maternel et Primaire';
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 150));
      const pdfBuffer = await page.pdf({
        preferCSSPageSize: true,
        printBackground: true,
        timeout: 60000,
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * Récupère les moyennes d'une classe pour une période
   */
  private async getClassAverages(tenantId: string, classId: string, periodId: string, academicYearId: string) {
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { classId, academicYearId, status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'RE_ENROLLED', 'PROMOTED', 'PRE_REGISTERED'] } },
      select: { studentId: true },
    }).catch(() => []);
    const studentIds = enrollments.map(e => e.studentId);
    if (studentIds.length === 0) return [];

    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true, matricule: true },
    }).catch(() => []);

    const evaluations = await this.prisma.evaluation.findMany({
      where: { tenantId, academicYearId, classId, status: 'VALIDATED', periodId },
      select: { id: true, subjectId: true, coefficient: true },
    }).catch(() => []);

    const evalIds = evaluations.map(e => e.id);
    const evalInfoMap = new Map(evaluations.map(e => [e.id, { subjectId: e.subjectId, coef: Number(e.coefficient) || 1 }]));

    const grades = await this.prisma.grade.findMany({
      where: { evaluationId: { in: evalIds }, studentId: { in: studentIds } },
      select: { studentId: true, evaluationId: true, score: true, isAbsent: true, qualitativeCode: true },
    }).catch(() => []);

    const studentMap = new Map<string, { id: string; name: string; subjects: Map<string, { sum: number; count: number; coef: number }> }>();
    for (const s of students) {
      studentMap.set(s.id, {
        id: s.id,
        name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Inconnu',
        subjects: new Map<string, { sum: number; count: number; coef: number }>(),
      });
    }

    for (const g of grades) {
      if (g.isAbsent) continue;
      let scoreNum: number | null = null;
      if (g.score !== null) scoreNum = Number(g.score);
      else if (g.qualitativeCode) {
        const code = String(g.qualitativeCode).toUpperCase();
        if (code === 'TS') scoreNum = 3;
        else if (code === 'S') scoreNum = 2;
        else if (code === 'PS') scoreNum = 1;
      }
      if (scoreNum === null) continue;
      const evalInfo = evalInfoMap.get(g.evaluationId);
      if (!evalInfo) continue;
      const st = studentMap.get(g.studentId);
      if (!st) continue;
      const subj = st.subjects.get(evalInfo.subjectId) || { sum: 0, count: 0, coef: evalInfo.coef };
      subj.sum += scoreNum;
      subj.count += 1;
      st.subjects.set(evalInfo.subjectId, subj);
    }

    const result = Array.from(studentMap.values()).map(st => {
      let total = 0, totalCoef = 0;
      for (const [, subj] of st.subjects) {
        if (subj.count === 0) continue;
        const moyMatiere = subj.sum / subj.count;
        total += moyMatiere * subj.coef;
        totalCoef += subj.coef;
      }
      const avg = totalCoef > 0 ? total / totalCoef : null;
      return { ...st, average: avg };
    }).filter(st => st.average !== null)
      .sort((a, b) => (b.average as number) - (a.average as number));

    return result;
  }

  /**
   * Récupère la moyenne d'un élève pour une période précédente (pour SEC_PROGRES).
   * Cherche d'abord parmi les périodes du même trimestre, sinon la période précédente.
   */
  private async getPreviousPeriodAverage(
    tenantId: string, studentId: string, classId: string,
    academicYearId: string, currentPeriodId: string,
  ): Promise<number | null> {
    try {
      // 1. Récupérer toutes les périodes de l'année scolaire, triées par startDate
      const periods = await this.prisma.academicPeriod.findMany({
        where: { academicYearId },
        orderBy: { startDate: 'asc' },
        select: { id: true, name: true, startDate: true },
      }).catch(() => []);

      // 2. Trouver l'index de la période courante
      const currentIdx = periods.findIndex(p => p.id === currentPeriodId);
      if (currentIdx <= 0) return null; // pas de période précédente
      const previousPeriod = periods[currentIdx - 1];

      // 3. Récupérer les évaluations de la période précédente
      const evaluations = await this.prisma.evaluation.findMany({
        where: { tenantId, academicYearId, classId, status: 'VALIDATED', periodId: previousPeriod.id },
        select: { id: true, subjectId: true, coefficient: true },
      }).catch(() => []);

      if (evaluations.length === 0) return null;

      const evalInfoMap = new Map(evaluations.map(e => [e.id, { subjectId: e.subjectId, coef: Number(e.coefficient) || 1 }]));

      // 4. Notes de l'élève pour ces évaluations
      const grades = await this.prisma.grade.findMany({
        where: { evaluationId: { in: evaluations.map(e => e.id) }, studentId },
        select: { evaluationId: true, score: true, isAbsent: true, qualitativeCode: true },
      }).catch(() => []);

      const subjects = new Map<string, { sum: number; count: number; coef: number }>();
      for (const g of grades) {
        if (g.isAbsent) continue;
        let scoreNum: number | null = null;
        if (g.score !== null) scoreNum = Number(g.score);
        else if (g.qualitativeCode) {
          const code = String(g.qualitativeCode).toUpperCase();
          if (code === 'TS') scoreNum = 3;
          else if (code === 'S') scoreNum = 2;
          else if (code === 'PS') scoreNum = 1;
        }
        if (scoreNum === null) continue;
        const evalInfo = evalInfoMap.get(g.evaluationId);
        if (!evalInfo) continue;
        const subj = subjects.get(evalInfo.subjectId) || { sum: 0, count: 0, coef: evalInfo.coef };
        subj.sum += scoreNum;
        subj.count += 1;
        subjects.set(evalInfo.subjectId, subj);
      }

      let total = 0, totalCoef = 0;
      for (const [, subj] of subjects) {
        if (subj.count === 0) continue;
        const moyMatiere = subj.sum / subj.count;
        total += moyMatiere * subj.coef;
        totalCoef += subj.coef;
      }
      return totalCoef > 0 ? total / totalCoef : null;
    } catch {
      return null;
    }
  }

  /**
   * Récupère les absences injustifiées et retards d'un élève pour une période
   * (depuis AttendanceRecord)
   */
  private async getAttendanceStats(
    studentId: string, classId: string, academicYearId: string, periodId?: string,
  ): Promise<{ unjustifiedAbsences: number; lateCount: number }> {
    try {
      // Déterminer la plage de dates de la période
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      if (periodId) {
        const period = await this.prisma.academicPeriod.findUnique({
          where: { id: periodId },
          select: { startDate: true, endDate: true },
        }).catch(() => null);
        if (period) {
          startDate = period.startDate;
          endDate = period.endDate;
        }
      }

      const where: any = { studentId, classId, academicYearId };
      if (startDate && endDate) {
        where.date = { gte: startDate, lte: endDate };
      }
      const records = await this.prisma.attendanceRecord.findMany({
        where,
        select: { status: true, amStatus: true, pmStatus: true, eveningStatus: true, late: true },
      }).catch(() => []);

      // Absences injustifiées = statut ABSENT (pas EXCUSED)
      let unjustifiedAbsences = 0;
      let lateCount = 0;
      for (const r of records) {
        if (r.status === 'ABSENT' || r.status === 'ABSENT_HALF') unjustifiedAbsences++;
        if (r.late) lateCount++;
      }
      return { unjustifiedAbsences, lateCount };
    } catch {
      return { unjustifiedAbsences: 0, lateCount: 0 };
    }
  }

  /**
   * Récupère la note de conduite d'un élève pour une période (depuis ConductLedger)
   * Retourne le pourcentage de conduite par rapport à la base de référence
   */
  private async getConductPct(
    studentId: string, periodId: string,
  ): Promise<number | null> {
    try {
      const ledger = await this.prisma.conductLedger.findFirst({
        where: { studentId, quarterId: periodId },
        select: { conductFinal: true, conductReference: true },
      }).catch(() => null);
      if (!ledger) return null;
      const ref = Number(ledger.conductReference) || 20;
      const final = Number(ledger.conductFinal);
      if (ref <= 0) return null;
      return (final / ref) * 100;
    } catch {
      return null;
    }
  }

  /**
   * GET /api/institutional-exams/distinctions/class/:classId
   *    Calcule les distinctions résolues pour chaque élève de la classe,
   *    basées sur la moyenne (rules.ts) et, pour le secondaire, sur les prix
   *    spéciaux (resolveSpecialAwards : SEC_PROGRES, SEC_ASSIDUITE, SEC_COMPORTEMENT).
   *
   * Query params: periodId, academicYearId, level (MATERNELLE | PRIMAIRE | SECONDAIRE)
   * Response: Array de {
   *   id, name, matricule, average, rank, classSize,
   *   base, distinctionCode, distinctionLabel, specialAwards: DistinctionCode[]
   * }
   */
  @Get('class/:classId')
  @Permissions('exams.read')
  async getClassDistinctions(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Param('classId') classId: string,
    @Query('periodId') periodId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('level') levelParam: string,
    @Res() res: Response,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];
    if (!classId || !periodId || !academicYearId) {
      return res.status(400).json({ error: 'classId, periodId et academicYearId sont requis' });
    }

    const level = this.mapLevel(levelParam || 'PRIMAIRE');
    const base = level === 'maternel' ? 3 : 20;

    try {
      const ranked = await this.getClassAverages(resolvedTenantId, classId, periodId, academicYearId);
      if (ranked.length === 0) {
        return res.json([]);
      }

      const classSize = ranked.length;
      const result: any[] = [];

      for (let i = 0; i < ranked.length; i++) {
        const st = ranked[i];
        const rank = i + 1;
        const avg = st.average as number;

        // Distinction principale (basée sur la moyenne)
        const mainCode = resolveDistinction(level, avg, base);
        const mainTheme = mainCode ? THEMES[mainCode] : null;

        // Prix spéciaux pour le secondaire
        let specialAwards: DistinctionCode[] = [];
        if (level === 'secondaire') {
          const previousAverage = await this.getPreviousPeriodAverage(
            resolvedTenantId, st.id, classId, academicYearId, periodId,
          );
          const { unjustifiedAbsences, lateCount } = await this.getAttendanceStats(
            st.id, classId, academicYearId, periodId,
          );
          const conductPct = await this.getConductPct(st.id, periodId);

          specialAwards = resolveSpecialAwards({
            average: avg,
            previousAverage: previousAverage ?? undefined,
            base,
            unjustifiedAbsences,
            lateCount,
            conductPct: conductPct ?? undefined,
          });
        }

        result.push({
          id: st.id,
          name: st.name,
          matricule: st.matricule || '',
          average: Number(avg.toFixed(3)),
          base,
          rank,
          classSize,
          distinctionCode: mainCode,
          distinctionLabel: mainTheme?.shortLabel || null,
          specialAwards,
          specialAwardLabels: specialAwards.map(c => THEMES[c]?.shortLabel || c),
        });
      }

      return res.json(result);
    } catch (err: any) {
      this.logger.error('Erreur getClassDistinctions:', err);
      return res.status(500).json({ error: err.message || 'Erreur serveur' });
    }
  }

  /**
   * GET /api/institutional-exams/distinctions/types
   *    Retourne la liste des distinctions disponibles par niveau.
   *    Permet au frontend d'afficher le catalogue des 5+1 types par niveau.
   */
  @Get('types')
  @Permissions('exams.read')
  async getDistinctionTypes(@Res() res: Response) {
    const byLevel: Record<string, any[]> = {
      maternel: [],
      primaire: [],
      secondaire: [],
    };
    for (const code of Object.keys(THEMES) as DistinctionCode[]) {
      const theme = THEMES[code];
      const isGraduation = code === GRADUATION_CODE[theme.level];
      const isSpecial = theme.level === 'secondaire' && ['SEC_PROGRES', 'SEC_ASSIDUITE', 'SEC_COMPORTEMENT'].includes(code);
      const rule = DEFAULT_RULES[theme.level].find(r => r.code === code);
      byLevel[theme.level].push({
        code,
        label: theme.shortLabel,
        title: theme.title,
        subtitle: theme.subtitle,
        icon: theme.icon,
        kicker: theme.kicker,
        category: isGraduation ? 'graduation' : isSpecial ? 'special' : 'mention',
        minPct: rule?.minPct ?? null,
        palette: theme.palette,
      });
    }
    return res.json(byLevel);
  }

  /**
   * POST /api/institutional-exams/distinctions/generate-board
   * Génère le tableau collectif en PDF
   */
  @Post('generate-board')
  @Permissions('exams.read')
  async generateBoard(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];
    const { classId, periodId, academicYearId, level: bodyLevel } = body;
    if (!classId || !periodId || !academicYearId) {
      return res.status(400).json({ error: 'classId, periodId et academicYearId sont requis' });
    }

    const level = this.mapLevel(bodyLevel || 'PRIMAIRE');
    const branding = await this.getTenantBranding(resolvedTenantId);

    try {
      const ranked = await this.getClassAverages(resolvedTenantId, classId, periodId, academicYearId);
      if (ranked.length === 0) {
        return res.status(404).json({ error: 'Aucun élève avec des notes trouvé' });
      }

      const base = level === 'maternel' ? 3 : 20;
      const classSize = ranked.length;
      const boardRows: BoardRow[] = [];

      for (let i = 0; i < ranked.length; i++) {
        const st = ranked[i];
        const rank = i + 1;
        const avg = st.average as number;
        const code = resolveDistinction(level, avg, base);
        if (code) {
          boardRows.push({ rank, fullName: st.name, average: avg, code });
        }
      }

      if (boardRows.length === 0) {
        return res.status(404).json({ error: 'Aucune distinction à afficher (moyennes sous le premier palier)' });
      }

      const className = (await this.prisma.class.findUnique({ where: { id: classId }, select: { name: true, schoolLevelId: true } }).catch(() => null))?.name || 'Classe';
      const period = await this.prisma.academicPeriod.findUnique({ where: { id: periodId }, select: { name: true } }).catch(() => null);
      const academicYear = await this.prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { label: true } }).catch(() => null);

      const boardInput: BoardInput = {
        level,
        school: {
          name: branding.name,
          logoUrl: branding.logoUrl,
          city: branding.city,
          address: branding.address,
          phone: branding.phone,
          email: branding.email,
          slogan: branding.slogan,
          ministry: this.getMinistryLabel(level),
          countryCode: branding.countryCode || 'BJ',
        },
        className,
        period: {
          label: period?.name || 'Trimestre',
          schoolYear: academicYear?.label || '2025-2026',
          issuedOn: new Date().toISOString().slice(0, 10),
        },
        base,
        rows: boardRows,
      };

      const html = await buildBoardHtml(boardInput);
      const pdf = await this.htmlToPdf(html);

      const safeClass = className.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="tableau_honneur_${safeClass}.pdf"`,
        'Content-Length': pdf.length,
      });
      res.end(pdf);
    } catch (err: any) {
      this.logger.error('Erreur génération tableau:', err);
      res.status(500).json({ error: err.message || 'Erreur lors de la génération' });
    }
  }

  /**
   * POST /api/institutional-exams/distinctions/generate-certificate
   * Génère un certificat individuel pour un élève
   * Body: { studentId, studentName, classId, className, periodId, academicYearId, level, code?, average?, rank?, classSize?, previousAverage?, previousLabel? }
   * Note: si code n'est pas fourni, il est résolu depuis average via resolveDistinction.
   *       Pour SEC_PROGRES, previousAverage est auto-calculé si non fourni.
   *       Le QR code inclut un nonce unique → chaque émission a un QR code différent,
   *       même pour le même élève et la même distinction (réémission = nouveau QR).
   */
  @Post('generate-certificate')
  @Permissions('exams.read')
  async generateCertificate(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];
    const { studentId, studentName, classId, className, periodId, academicYearId, level: bodyLevel, code: bodyCode, average, rank, classSize, previousAverage: bodyPrevAvg, previousLabel: bodyPrevLabel } = body;
    if (!studentId || !classId || !periodId || !academicYearId) {
      return res.status(400).json({ error: 'studentId, classId, periodId et academicYearId sont requis' });
    }

    const level = this.mapLevel(bodyLevel || 'PRIMAIRE');
    const branding = await this.getTenantBranding(resolvedTenantId);

    try {
      const base = level === 'maternel' ? 3 : 20;
      const avg = typeof average === 'number' ? average : null;
      const code = bodyCode || (avg !== null ? resolveDistinction(level, avg, base) : null);

      if (!code) {
        return res.status(400).json({ error: 'Aucune distinction pour cet élève' });
      }

      const secret = process.env.DISTINCTION_SECRET || 'academia-helm-dev-secret';
      const verifyBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://academia-helm.academiahelm.com';

      const period = await this.prisma.academicPeriod.findUnique({ where: { id: periodId }, select: { name: true } }).catch(() => null);
      const academicYear = await this.prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { label: true } }).catch(() => null);

      // Pour SEC_PROGRES, auto-calculer previousAverage si non fourni
      let previousAverage = typeof bodyPrevAvg === 'number' ? bodyPrevAvg : null;
      let previousLabel = bodyPrevLabel || undefined;
      if (code === 'SEC_PROGRES' && previousAverage === null) {
        previousAverage = await this.getPreviousPeriodAverage(
          resolvedTenantId, studentId, classId, academicYearId, periodId,
        );
        // Trouver le nom de la période précédente
        try {
          const periods = await this.prisma.academicPeriod.findMany({
            where: { academicYearId },
            orderBy: { startDate: 'asc' },
            select: { id: true, name: true },
          });
          const idx = periods.findIndex(p => p.id === periodId);
          if (idx > 0) previousLabel = periods[idx - 1].name;
        } catch { /* ignore */ }
      }

      // ⭐ Code de vérification unique avec nonce — chaque émission produit un QR code différent
      const { code: vcode, nonce } = makeVerificationCodeWithNonce(secret, {
        schoolId: resolvedTenantId || 'school',
        studentId,
        periodId,
        code,
        schoolYear: academicYear?.label || '2025-2026',
      });
      const vurl = verificationUrl(verifyBaseUrl, vcode);

      // ⭐ Récupérer le schoolLevelId pour résoudre le directeur + choisir le bon en-tête (maternel/primaire vs secondaire)
      const classInfo = await this.prisma.class.findUnique({
        where: { id: classId },
        select: { schoolLevelId: true },
      }).catch(() => null);
      const schoolLevelId = classInfo?.schoolLevelId || null;

      // ⭐ Résoudre le nom du directeur + signature dynamiquement (même logique que bulletins)
      const { directorName, directorSignatureUrl } = await this.resolveDirectorName(
        resolvedTenantId, schoolLevelId, 'FR',
      );

      // ⭐ Résoudre le nom du professeur principal de la classe dynamiquement
      const teacherName = await this.resolveTeacherName(resolvedTenantId, classId);

      const input: DistinctionInput = {
        code,
        school: {
          name: branding.name,
          logoUrl: branding.logoUrl,
          city: branding.city,
          address: branding.address,
          phone: branding.phone,
          email: branding.email,
          slogan: branding.slogan,
          ministry: this.getMinistryLabel(level),
          countryCode: branding.countryCode || 'BJ',
          directorName: directorName || undefined,
          directorSignatureUrl: directorSignatureUrl || undefined,
          teacherName: teacherName || undefined,
        },
        student: { fullName: studentName || 'Élève', className: className || 'Classe' },
        period: {
          label: period?.name || 'Trimestre',
          schoolYear: academicYear?.label || '2025-2026',
          issuedOn: new Date().toISOString().slice(0, 10),
        },
        results: avg !== null ? {
          average: avg, base, rank: rank || undefined, classSize: classSize || undefined,
          previousAverage: previousAverage ?? undefined,
          previousLabel,
        } : undefined,
        verification: { code: vcode, url: vurl },
      };

      const html = await buildCertificateHtml(input);
      const pdf = await this.htmlToPdf(html);

      // ⭐ Persister l'émission en base pour vérification publique du QR code
      const theme = THEMES[code];
      const category = code === GRADUATION_CODE[level] ? 'graduation'
        : (level === 'secondaire' && ['SEC_PROGRES', 'SEC_ASSIDUITE', 'SEC_COMPORTEMENT'].includes(code)) ? 'special'
        : 'mention';
      try {
        await this.prisma.distinctionRecord.create({
          data: {
            tenantId: resolvedTenantId,
            academicYearId,
            schoolLevelId: schoolLevelId || null,
            classId,
            studentId,
            periodId,
            code,
            category,
            label: theme?.shortLabel || code,
            average: avg ?? null,
            base,
            rank: rank ?? null,
            classSize: classSize ?? null,
            previousAverage: previousAverage ?? null,
            verificationCode: vcode,
            nonce,
            verificationUrl: vurl,
            documentType: 'certificate',
            status: 'EMITTED',
            issuedOn: new Date().toISOString().slice(0, 10),
            issuedBy: user?.id || null,
            metadata: {
              schoolName: branding.name,
              periodName: period?.name || null,
              className: className || null,
              studentName: studentName || null,
              previousLabel: previousLabel || null,
              level,
            },
          },
        }).catch(err => this.logger.warn(`DistinctionRecord insert failed: ${err.message}`));
      } catch (err: any) {
        // La persistance ne doit pas bloquer la génération PDF — juste logger
        this.logger.warn(`Impossible de persister DistinctionRecord: ${err.message}`);
      }

      const safeName = (studentName || 'eleve').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="certificat_${safeName}.pdf"`,
        'Content-Length': pdf.length,
      });
      res.end(pdf);
    } catch (err: any) {
      this.logger.error('Erreur génération certificat:', err);
      res.status(500).json({ error: err.message || 'Erreur lors de la génération' });
    }
  }

  /**
   * POST /api/institutional-exams/distinctions/send-certificate
   * Génère le certificat PDF + envoie par email + Helm Connect + bell icon au parent
   * Body: { studentId, studentName, classId, className, periodId, academicYearId, level, code?, average?, rank?, classSize?, distinctionLabel, previousAverage?, previousLabel? }
   * Response: { success, results: { email, helmConnect, bellIcon } }
   */
  @Post('send-certificate')
  @Permissions('exams.read')
  async sendCertificate(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || user?.tenant_id || headers?.['x-tenant-id'] || headers?.['X-Tenant-Id'];
    const { studentId, studentName, classId, className, periodId, academicYearId, level: bodyLevel, code: bodyCode, average, rank, classSize, distinctionLabel, previousAverage: bodyPrevAvg, previousLabel: bodyPrevLabel } = body;
    if (!studentId || !classId || !periodId || !academicYearId) {
      return res.status(400).json({ error: 'studentId, classId, periodId et academicYearId sont requis' });
    }

    const level = this.mapLevel(bodyLevel || 'PRIMAIRE');
    const branding = await this.getTenantBranding(resolvedTenantId);

    try {
      const base = level === 'maternel' ? 3 : 20;
      const avg = typeof average === 'number' ? average : null;
      const code = bodyCode || (avg !== null ? resolveDistinction(level, avg, base) : null);

      if (!code) {
        return res.status(400).json({ error: 'Aucune distinction pour cet élève' });
      }

      const theme = THEMES[code];
      const label = distinctionLabel || theme?.shortLabel || 'Distinction';

      const secret = process.env.DISTINCTION_SECRET || 'academia-helm-dev-secret';
      const verifyBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://academia-helm.academiahelm.com';

      const period = await this.prisma.academicPeriod.findUnique({ where: { id: periodId }, select: { name: true } }).catch(() => null);
      const academicYear = await this.prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { label: true } }).catch(() => null);

      // Pour SEC_PROGRES, auto-calculer previousAverage si non fourni
      let previousAverage = typeof bodyPrevAvg === 'number' ? bodyPrevAvg : null;
      let previousLabel = bodyPrevLabel || undefined;
      if (code === 'SEC_PROGRES' && previousAverage === null) {
        previousAverage = await this.getPreviousPeriodAverage(
          resolvedTenantId, studentId, classId, academicYearId, periodId,
        );
        try {
          const periods = await this.prisma.academicPeriod.findMany({
            where: { academicYearId },
            orderBy: { startDate: 'asc' },
            select: { id: true, name: true },
          });
          const idx = periods.findIndex(p => p.id === periodId);
          if (idx > 0) previousLabel = periods[idx - 1].name;
        } catch { /* ignore */ }
      }

      // ⭐ Code de vérification unique avec nonce — chaque émission produit un QR code différent
      const { code: vcode, nonce } = makeVerificationCodeWithNonce(secret, {
        schoolId: resolvedTenantId || 'school',
        studentId,
        periodId,
        code,
        schoolYear: academicYear?.label || '2025-2026',
      });
      const vurl = verificationUrl(verifyBaseUrl, vcode);

      // ⭐ Récupérer le schoolLevelId pour résoudre le directeur + choisir le bon en-tête
      const classInfo = await this.prisma.class.findUnique({
        where: { id: classId },
        select: { schoolLevelId: true },
      }).catch(() => null);
      const schoolLevelId = classInfo?.schoolLevelId || null;

      // ⭐ Résoudre le nom du directeur + signature dynamiquement
      const { directorName, directorSignatureUrl } = await this.resolveDirectorName(
        resolvedTenantId, schoolLevelId, 'FR',
      );

      // ⭐ Résoudre le nom du professeur principal de la classe dynamiquement
      const teacherName = await this.resolveTeacherName(resolvedTenantId, classId);

      const input: DistinctionInput = {
        code,
        school: {
          name: branding.name,
          logoUrl: branding.logoUrl,
          city: branding.city,
          address: branding.address,
          phone: branding.phone,
          email: branding.email,
          slogan: branding.slogan,
          ministry: this.getMinistryLabel(level),
          countryCode: branding.countryCode || 'BJ',
          directorName: directorName || undefined,
          directorSignatureUrl: directorSignatureUrl || undefined,
          teacherName: teacherName || undefined,
        },
        student: { fullName: studentName || 'Élève', className: className || 'Classe' },
        period: {
          label: period?.name || 'Trimestre',
          schoolYear: academicYear?.label || '2025-2026',
          issuedOn: new Date().toISOString().slice(0, 10),
        },
        results: avg !== null ? {
          average: avg, base, rank: rank || undefined, classSize: classSize || undefined,
          previousAverage: previousAverage ?? undefined,
          previousLabel,
        } : undefined,
        verification: { code: vcode, url: vurl },
      };

      // Générer le PDF
      const html = await buildCertificateHtml(input);
      const pdfBuffer = await this.htmlToPdf(html);

      // Envoyer les notifications (email + Helm Connect + bell icon)
      const results = await this.notificationService.sendDistinctionNotification(
        resolvedTenantId,
        studentId,
        studentName || 'Élève',
        label,
        code,
        pdfBuffer,
        period?.name || 'Trimestre',
        className || 'Classe',
        user?.id || 'system',
      );

      // ⭐ Persister l'émission en base pour vérification publique du QR code
      //    + marquer sentToParent=true si l'envoi email a réussi
      const category = code === GRADUATION_CODE[level] ? 'graduation'
        : (level === 'secondaire' && ['SEC_PROGRES', 'SEC_ASSIDUITE', 'SEC_COMPORTEMENT'].includes(code)) ? 'special'
        : 'mention';
      try {
        await this.prisma.distinctionRecord.create({
          data: {
            tenantId: resolvedTenantId,
            academicYearId,
            schoolLevelId: schoolLevelId || null,
            classId,
            studentId,
            periodId,
            code,
            category,
            label: theme?.shortLabel || code,
            average: avg ?? null,
            base,
            rank: rank ?? null,
            classSize: classSize ?? null,
            previousAverage: previousAverage ?? null,
            verificationCode: vcode,
            nonce,
            verificationUrl: vurl,
            documentType: 'certificate',
            status: 'EMITTED',
            issuedOn: new Date().toISOString().slice(0, 10),
            issuedBy: user?.id || null,
            sentToParent: results?.email === 'sent',
            sentAt: results?.email === 'sent' ? new Date() : null,
            metadata: {
              schoolName: branding.name,
              periodName: period?.name || null,
              className: className || null,
              studentName: studentName || null,
              previousLabel: previousLabel || null,
              level,
              notificationResults: results,
            },
          },
        }).catch(err => this.logger.warn(`DistinctionRecord insert failed: ${err.message}`));
      } catch (err: any) {
        this.logger.warn(`Impossible de persister DistinctionRecord: ${err.message}`);
      }

      res.json({ success: true, results });
    } catch (err: any) {
      this.logger.error('Erreur envoi certificat:', err);
      res.status(500).json({ error: err.message || 'Erreur lors de l\'envoi' });
    }
  }
}
