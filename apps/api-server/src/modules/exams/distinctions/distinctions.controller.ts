/**
 * ============================================================================
 * DISTINCTIONS CONTROLLER — Tableau d'honneur (Academia Helm)
 * ============================================================================
 *
 * Endpoints :
 *   POST /api/institutional-exams/distinctions/generate-board
 *     Génère le tableau collectif pour une classe.
 *     Body: { classId, periodId, academicYearId, level }
 *     Response: PDF binaire
 *
 *   POST /api/institutional-exams/distinctions/generate-certificate
 *     Génère un certificat individuel pour un élève.
 *     Body: { studentId, studentName, classId, className, periodId, academicYearId, level, code }
 *     Response: PDF binaire
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
import { buildBoardHtml, buildCertificateHtml } from './html-builder';
import { resolveDistinction, makeVerificationCode, verificationUrl, THEMES } from './html-builder';
import type { BoardInput, BoardRow, DistinctionInput, Level } from './html-builder';
import { DistinctionsNotificationService } from './distinctions-notification.service';

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

  private async getTenantBranding(tenantId: string) {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: { schoolName: true, logoUrl: true, address: true },
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

      const className = (await this.prisma.class.findUnique({ where: { id: classId }, select: { name: true } }).catch(() => null))?.name || 'Classe';
      const period = await this.prisma.academicPeriod.findUnique({ where: { id: periodId }, select: { name: true } }).catch(() => null);
      const academicYear = await this.prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { label: true } }).catch(() => null);

      const boardInput: BoardInput = {
        level,
        school: { name: branding.name, logoUrl: branding.logoUrl, city: branding.city },
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
    const { studentId, studentName, classId, className, periodId, academicYearId, level: bodyLevel, code: bodyCode, average, rank, classSize } = body;
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

      const vcode = makeVerificationCode(secret, {
        schoolId: resolvedTenantId || 'school',
        studentId,
        periodId,
        code,
        schoolYear: academicYear?.label || '2025-2026',
      });

      const input: DistinctionInput = {
        code,
        school: { name: branding.name, logoUrl: branding.logoUrl, city: branding.city },
        student: { fullName: studentName || 'Élève', className: className || 'Classe' },
        period: {
          label: period?.name || 'Trimestre',
          schoolYear: academicYear?.label || '2025-2026',
          issuedOn: new Date().toISOString().slice(0, 10),
        },
        results: avg !== null ? { average: avg, base, rank: rank || undefined, classSize: classSize || undefined } : undefined,
        verification: { code: vcode, url: verificationUrl(verifyBaseUrl, vcode) },
      };

      const html = await buildCertificateHtml(input);
      const pdf = await this.htmlToPdf(html);

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
   * Body: { studentId, studentName, classId, className, periodId, academicYearId, level, code, average, rank, classSize, distinctionLabel }
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
    const { studentId, studentName, classId, className, periodId, academicYearId, level: bodyLevel, code: bodyCode, average, rank, classSize, distinctionLabel } = body;
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

      const vcode = makeVerificationCode(secret, {
        schoolId: resolvedTenantId || 'school',
        studentId,
        periodId,
        code,
        schoolYear: academicYear?.label || '2025-2026',
      });

      const input: DistinctionInput = {
        code,
        school: { name: branding.name, logoUrl: branding.logoUrl, city: branding.city },
        student: { fullName: studentName || 'Élève', className: className || 'Classe' },
        period: {
          label: period?.name || 'Trimestre',
          schoolYear: academicYear?.label || '2025-2026',
          issuedOn: new Date().toISOString().slice(0, 10),
        },
        results: avg !== null ? { average: avg, base, rank: rank || undefined, classSize: classSize || undefined } : undefined,
        verification: { code: vcode, url: verificationUrl(verifyBaseUrl, vcode) },
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

      res.json({ success: true, results });
    } catch (err: any) {
      this.logger.error('Erreur envoi certificat:', err);
      res.status(500).json({ error: err.message || 'Erreur lors de l\'envoi' });
    }
  }
}
