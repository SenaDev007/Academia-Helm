/**
 * ============================================================================
 * ANNUAL PLAN CONTROLLER — Planification pédagogique annuelle
 * ============================================================================
 * 
 * Endpoints :
 *   GET  /pedagogy/annual-plans?academicYearId=Y&classLevel=CI
 *   GET  /pedagogy/annual-plans/classes?academicYearId=Y
 *   GET  /pedagogy/annual-plans/export-pdf?academicYearId=Y&classLevel=CM2
 *   PUT  /pedagogy/annual-plans/:id  (body: { content })
 *   POST /pedagogy/annual-plans/seed (body: { academicYearId, schoolLevelId })
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Body, Param, Query, Res,
  UseGuards, Logger, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { AnnualPlanService } from './annual-plan.service';
import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';
import { PrismaService } from '../database/prisma.service';

const PRIMAIRE_COLUMNS = [
  { key: 'Français', label: 'Français', group: '' },
  { key: 'Mathématiques', label: 'Maths', group: '' },
  { key: 'EST', label: 'EST', group: '' },
  { key: 'EPS', label: 'EPS', group: '' },
  { key: 'Morale', label: 'Morale', group: 'Éducation Sociale' },
  { key: 'Civisme', label: 'Civisme', group: 'Éducation Sociale' },
  { key: 'Histoire', label: 'Histoire', group: 'Éducation Sociale' },
  { key: 'Géographie', label: 'Géographie', group: 'Éducation Sociale' },
  { key: 'Chant', label: 'Chant', group: 'Éducation Artistique' },
  { key: 'Poésie', label: 'Poésie', group: 'Éducation Artistique' },
  { key: 'Conte', label: 'Conte', group: 'Éducation Artistique' },
  { key: 'Dessin', label: 'Dessin', group: 'Éducation Artistique' },
  { key: 'Couture', label: 'Couture', group: 'Éducation Artistique' },
];

const PRIMAIRE_ROWS = [
  { trimester: 1, month: 'Septembre' }, { trimester: 1, month: 'Octobre' },
  { trimester: 1, month: 'Novembre' }, { trimester: 1, month: 'Décembre' },
  { trimester: 2, month: 'Janvier' }, { trimester: 2, month: 'Février' },
  { trimester: 2, month: 'Mars' },
  { trimester: 3, month: 'Avril' }, { trimester: 3, month: 'Mai' },
  { trimester: 3, month: 'Juin' },
];

const TRIMESTER_LABELS: Record<number, string> = { 1: '1er Trim.', 2: '2e Trim.', 3: '3e Trim.' };

@Controller('pedagogy/annual-plans')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AnnualPlanController {
  private readonly logger = new Logger(AnnualPlanController.name);

  constructor(
    private readonly annualPlanService: AnnualPlanService,
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
  ) {}

  @Get()
  async getPlans(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classLevel') classLevel: string,
    @Query('trimester') trimester?: string,
  ) {
    if (!academicYearId || !classLevel) return [];
    const tri = trimester ? parseInt(trimester, 10) : undefined;
    return this.annualPlanService.getPlans(tenantId, academicYearId, classLevel, tri);
  }

  @Get('classes')
  async getAvailableClasses(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.annualPlanService.getAvailableClasses(tenantId, academicYearId);
  }

  @Put(':id')
  async updatePlan(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { content?: string },
  ) {
    return this.annualPlanService.updatePlan(id, tenantId, body);
  }

  @Post('seed')
  async seedPlans(
    @TenantId() tenantId: string,
    @Body() body: { academicYearId: string; schoolLevelId: string },
  ) {
    if (!body.academicYearId || !body.schoolLevelId) {
      return { error: 'academicYearId and schoolLevelId required' };
    }
    return this.annualPlanService.seedForTenant(tenantId, body.academicYearId, body.schoolLevelId);
  }

  /**
   * ⭐ GET /pedagogy/annual-plans/export-pdf?academicYearId=Y&classLevel=CM2
   *    Génère un PDF paysage A4 avec le tableau de planification exact comme le PDF officiel.
   */
  @Get('export-pdf')
  async exportPdf(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classLevel') classLevel: string,
    @Res() res: any,
  ) {
    if (!academicYearId || !classLevel) {
      throw new BadRequestException('academicYearId et classLevel requis');
    }

    // 1. Récupérer les plans
    const plans: any[] = await this.annualPlanService.getPlans(tenantId, academicYearId, classLevel);

    // 2. Récupérer l'identité de l'école
    const schoolInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT "schoolName", "schoolAcronym", "logoUrl" FROM "tenant_identity_profiles" WHERE "tenantId" = $1 AND "isActive" = true ORDER BY "version" DESC LIMIT 1`,
      tenantId,
    );
    const school = schoolInfo?.[0] || {};
    const schoolDisplayName = school.schoolName || school.schoolAcronym || 'École';

    // 3. Récupérer l'année scolaire
    const yearInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT "label" FROM "academic_years" WHERE "id" = $1 LIMIT 1`,
      academicYearId,
    ).catch(() => []);
    const yearLabel = yearInfo?.[0]?.label || new Date().getFullYear().toString();

    // 4. Construire le HTML
    const isMaternelle = classLevel === 'MATERNELLE_GRANDS';
    const classLabel = isMaternelle ? 'Maternelle (Grands)' : classLevel;

    // Helper: trouver le contenu d'une cellule primaire
    const getCell = (tri: number, month: string, domainKey: string): string => {
      const p = plans.find(p => p.trimester === tri && p.month === month && (p.domain === domainKey || p.subDomain === domainKey));
      return p?.content || '—';
    };

    // Group headers pour le tableau
    const groups: { group: string; count: number }[] = [];
    for (const col of PRIMAIRE_COLUMNS) {
      const last = groups[groups.length - 1];
      if (last && last.group === col.group) last.count++;
      else groups.push({ group: col.group, count: 1 });
    }

    // Construire les lignes du tableau primaire
    const rowsHtml = PRIMAIRE_ROWS.map((row, idx) => {
      const prev = idx > 0 ? PRIMAIRE_ROWS[idx - 1] : null;
      const showTri = !prev || prev.trimester !== row.trimester;
      const cells = PRIMAIRE_COLUMNS.map(col => {
        const content = getCell(row.trimester, row.month, col.key);
        return `<td style="border:1px solid #cbd5e1;padding:3px;font-size:7px;vertical-align:top;">${content}</td>`;
      }).join('');
      return `<tr style="${row.trimester === 1 ? 'background:#eff6ff;' : row.trimester === 2 ? 'background:#ecfdf5;' : 'background:#fffbeb;'}">
        <td style="border:1px solid #cbd5e1;padding:3px;font-weight:bold;font-size:7px;text-align:center;">${showTri ? TRIMESTER_LABELS[row.trimester] : ''}</td>
        <td style="border:1px solid #cbd5e1;padding:3px;font-weight:bold;font-size:7px;">${row.month}</td>
        ${cells}
      </tr>`;
    }).join('');

    const groupHeaderRow = groups.map(g =>
      g.group
        ? `<th colspan="${g.count}" style="border:1px solid #1a2a6b;padding:4px;font-size:8px;background:${g.group === 'Éducation Sociale' ? '#4338ca' : '#7e22ce'};color:white;text-align:center;">${g.group}</th>`
        : `<th style="border:1px solid #1a2a6b;padding:4px;font-size:8px;background:#1a2a6b;color:white;"></th>`
    ).join('');

    const columnHeaders = PRIMAIRE_COLUMNS.map(col =>
      `<th style="border:1px solid #1a2a6b;padding:4px;font-size:8px;background:${col.group === 'Éducation Sociale' ? '#4f46e5' : col.group === 'Éducation Artistique' ? '#9333ea' : '#1a2a6b'};color:white;text-align:center;">${col.label}</th>`
    ).join('');

    // Évaluation sommative separator lines
    const evalRows = [
      { after: 'Décembre', label: 'ÉVALUATION SOMMATIVE D\'ÉTAPE 1' },
      { after: 'Mars', label: 'ÉVALUATION SOMMATIVE D\'ÉTAPE 2' },
      { after: 'Juin', label: 'ÉVALUATION SOMMATIVE D\'ÉTAPE 3' },
    ];

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
      @page { size: A4 landscape; margin: 6mm; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Helvetica, Arial, sans-serif; }
      .header { border-bottom: 3px solid #1a2a6b; padding-bottom: 6px; margin-bottom: 6px; display:flex; align-items:center; gap:10px; }
      .header .school { font-size: 12px; color:#1a2a6b; font-weight: 800; }
      .header .year { font-size: 10px; color:#475569; }
      .title-row { display:flex; justify-content:space-between; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1; }
      .title-row .title { font-size: 14px; color:#1a2a6b; font-weight: 800; text-transform:uppercase; }
      .title-row .class { font-size: 12px; color:#1e293b; font-weight: 700; }
      table { width:100%; border-collapse:collapse; table-layout:fixed; }
      th, td { font-size: 7px; }
      .footer { margin-top:6px; font-size:7px; color:#94a3b8; text-align:center; }
    </style></head><body>
      <div class="header">
        <div>
          <div class="school">${schoolDisplayName}</div>
          <div class="year">Année scolaire ${yearLabel}</div>
        </div>
      </div>
      <div class="title-row">
        <span class="title">Planification annuelle des activités pédagogiques</span>
        <span class="class">Cours : ${classLabel}</span>
      </div>
      <table>
        <thead>
          <tr>${groupHeaderRow}</tr>
          <tr>
            <th style="border:1px solid #1a2a6b;padding:4px;font-size:8px;background:#1e3a8a;color:white;text-align:center;">Trim.</th>
            <th style="border:1px solid #1a2a6b;padding:4px;font-size:8px;background:#1e3a8a;color:white;text-align:center;">Mois</th>
            ${columnHeaders}
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="footer">Planification pédagogique officielle — Academia Helm</div>
    </body></html>`;

    // 5. Générer le PDF via Puppeteer
    let page: any;
    try {
      const acquired = await this.puppeteerPool.acquirePage();
      page = acquired.page;
    } catch (e: any) {
      throw new BadRequestException(`Puppeteer unavailable: ${e?.message}`);
    }
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 300));
      const pdfBuffer = await page.pdf({
        format: 'A4', landscape: true, printBackground: true,
        margin: { top: '6mm', bottom: '6mm', left: '6mm', right: '6mm' },
      });
      const buffer = Buffer.from(pdfBuffer);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="planification_${classLevel}_${yearLabel}.pdf"`,
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }
}
