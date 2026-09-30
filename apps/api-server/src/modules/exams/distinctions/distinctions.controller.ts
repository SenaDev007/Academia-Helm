/**
 * ============================================================================
 * DISTINCTIONS CONTROLLER — Tableau d'honneur (Academia Helm)
 * ============================================================================
 *
 * Endpoints :
 *   POST /api/institutional-exams/distinctions/generate-class
 *     Génère les certificats + tableau collectif pour une classe entière.
 *     Body : { classId, periodId, academicYearId, level }
 *     Response : { issued, skipped, certificates: [{studentName, code, fileName}], boardPdf, mergedPdf }
 *
 *   POST /api/institutional-exams/distinctions/generate-board
 *     Génère uniquement le tableau collectif.
 *     Body : { classId, periodId, academicYearId, level }
 *     Response : PDF binaire (application/pdf)
 *
 *   POST /api/institutional-exams/distinctions/generate-certificate
 *     Génère un certificat individuel.
 *     Body : { studentId, code, classId, periodId, academicYearId, level }
 *     Response : PDF binaire (application/pdf)
 * ============================================================================
 */

import {
  Controller, Post, Body, UseGuards, Res, Headers, Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { Permissions } from '../../../auth/decorators/permissions.decorator';
import { TenantId } from '../../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { PuppeteerPoolService } from '../../../common/services/puppeteer-pool.service';
import { DistinctionsRenderService, BatchFile } from './render.service';
import { resolveDistinction, resolveSpecialAwards, GRADUATION_CODE, DEFAULT_RULES } from './rules';
import { makeVerificationCode, verificationUrl } from './security';
import { THEMES } from './themes';
import type { BoardInput, BoardRow, DistinctionCode, DistinctionInput, Level } from './types';

@Controller('institutional-exams/distinctions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class DistinctionsController {
  private readonly logger = new Logger(DistinctionsController.name);
  private renderService: DistinctionsRenderService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
  ) {
    this.renderService = new DistinctionsRenderService(puppeteerPool);
  }

  private mapLevel(scopeLevel: string): Level {
    const l = (scopeLevel || '').toUpperCase().trim();
    if (l === 'MATERNELLE' || l === 'MAT' || l === 'NURSERY') return 'maternel';
    if (l === 'SECONDAIRE' || l === 'SEC') return 'secondaire';
    return 'primaire';
  }

  private async getTenantBranding(tenantId: string) {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: { schoolName: true, logoUrl: true, address: true, phonePrimary: true, email: true, slogan: true },
      });
      if (profile?.schoolName) {
        const apiBaseUrl = 'https://api.academiahelm.com';
        return {
          name: profile.schoolName,
          logoUrl: profile.logoUrl ? `${apiBaseUrl}/api/tenants/${tenantId}/logo` : undefined,
          city: profile.address || undefined,
        };
      }
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      return { name: tenant?.name || 'Établissement' };
    } catch {
      return { name: 'Établissement' };
    }
  }

  /**
   * POST /api/institutional-exams/distinctions/generate-class
   * Génère les certificats + tableau collectif pour une classe entière.
   */
  @Post('generate-class')
  @Permissions('exams.read')
  async generateClass(
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

    const level = this.mapLevel(bodyLevel || 'primaire');
    const branding = await this.getTenantBranding(resolvedTenantId);

    try {
      // 1. Récupérer les élèves + leurs moyennes pour cette classe/période
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: { classId, academicYearId, status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'RE_ENROLLED', 'PROMOTED', 'PRE_REGISTERED'] } },
        select: { studentId: true },
      }).catch(() => []);
      const studentIds = enrollments.map(e => e.studentId);
      if (studentIds.length === 0) {
        return res.status(404).json({ error: 'Aucun élève trouvé dans cette classe' });
      }

      const students = await this.prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, firstName: true, lastName: true, matricule: true },
      }).catch(() => []);

      // 2. Récupérer les évaluations validées
      const evaluations = await this.prisma.evaluation.findMany({
        where: { tenantId: resolvedTenantId, academicYearId, classId, status: 'VALIDATED', periodId },
        select: { id: true, subjectId: true, coefficient: true },
      }).catch(() => []);

      const evalIds = evaluations.map(e => e.id);
      const evalInfoMap = new Map(evaluations.map(e => [e.id, { subjectId: e.subjectId, coef: Number(e.coefficient) || 1 }]));

      // 3. Récupérer toutes les notes
      const grades = await this.prisma.grade.findMany({
        where: { evaluationId: { in: evalIds }, studentId: { in: studentIds } },
        select: { studentId: true, evaluationId: true, score: true, isAbsent: true, qualitativeCode: true },
      }).catch(() => []);

      // 4. Grouper par élève × matière → moyenne par matière
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

      // 5. Calculer moyennes + distinctions
      const base = level === 'maternel' ? 3 : 20;
      const isMaternelle = level === 'maternel';
      const PASS_THRESHOLD = isMaternelle ? 2 : 10;

      const ranked = Array.from(studentMap.values())
        .map(st => {
          let total = 0, totalCoef = 0;
          for (const [, subj] of st.subjects) {
            if (subj.count === 0) continue;
            const moyMatiere = subj.sum / subj.count;
            total += moyMatiere * subj.coef;
            totalCoef += subj.coef;
          }
          const avg = totalCoef > 0 ? total / totalCoef : null;
          return { ...st, average: avg };
        })
        .filter(st => st.average !== null)
        .sort((a, b) => (b.average as number) - (a.average as number));

      const classSize = ranked.length;
      const inputs: DistinctionInput[] = [];
      const boardRows: BoardRow[] = [];
      const skipped: { studentId: string; fullName: string; reason: string }[] = [];
      const records: { studentId: string; code: DistinctionCode; verificationCode: string }[] = [];

      const secret = process.env.DISTINCTION_SECRET || 'academia-helm-dev-secret';
      const verifyBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://academia-helm.academiahelm.com';
      const className = (await this.prisma.class.findUnique({ where: { id: classId }, select: { name: true } }).catch(() => null))?.name || 'Classe';
      const period = (await this.prisma.academicPeriod.findUnique({ where: { id: periodId }, select: { name: true } }).catch(() => null));
      const academicYear = await this.prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { label: true } }).catch(() => null);
      const periodInfo = {
        label: period?.name || 'Trimestre',
        schoolYear: academicYear?.label || '2025-2026',
        issuedOn: new Date().toISOString().slice(0, 10),
      };

      for (let i = 0; i < ranked.length; i++) {
        const st = ranked[i];
        const rank = i + 1;
        const avg = st.average as number;

        const code = resolveDistinction(level, avg, base);
        if (code) {
          const vcode = makeVerificationCode(secret, {
            schoolId: resolvedTenantId || 'school',
            studentId: st.id,
            periodId,
            code,
            schoolYear: periodInfo.schoolYear,
          });
          records.push({ studentId: st.id, code, verificationCode: vcode });
          inputs.push({
            code,
            school: { name: branding.name, logoUrl: branding.logoUrl, city: branding.city },
            student: { fullName: st.name, className },
            period: periodInfo,
            results: { average: avg, base, rank, classSize },
            verification: { code: vcode, url: verificationUrl(verifyBaseUrl, vcode) },
          });
          boardRows.push({ rank, fullName: st.name, average: avg, code });
        } else {
          skipped.push({ studentId: st.id, fullName: st.name, reason: 'Moyenne sous le premier palier' });
        }
      }

      // 6. Générer les PDF
      const result: { issued: number; skipped: number; certificates: any[]; boardPdf?: Buffer; mergedPdf?: Buffer } = {
        issued: inputs.length,
        skipped: skipped.length,
        certificates: [],
      };

      if (inputs.length > 0) {
        const batch = await this.renderService.generateBatch(inputs);
        result.mergedPdf = batch.merged;
        result.certificates = batch.files.map((f: BatchFile) => ({
          studentName: f.input.student.fullName,
          code: f.input.code,
          fileName: f.fileName,
        }));
      }

      if (boardRows.length > 0) {
        const boardInput: BoardInput = {
          level,
          school: { name: branding.name, logoUrl: branding.logoUrl, city: branding.city },
          className,
          period: periodInfo,
          base,
          rows: boardRows,
        };
        result.boardPdf = await this.renderService.generateBoardPdf(boardInput);
      }

      // 7. Retourner le tableau collectif en PDF (le plus demandé)
      if (result.boardPdf) {
        const safeClass = className.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="tableau_honneur_${safeClass}.pdf"`,
          'Content-Length': result.boardPdf.length,
        });
        res.end(result.boardPdf);
      } else {
        res.json({ issued: result.issued, skipped: result.skipped, certificates: result.certificates });
      }
    } catch (err: any) {
      this.logger.error('Erreur génération distinctions:', err);
      res.status(500).json({ error: err.message || 'Erreur lors de la génération des distinctions' });
    }
  }
}
