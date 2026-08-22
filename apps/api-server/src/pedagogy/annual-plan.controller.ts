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

// ⭐ MATERNELLE — Structure des semaines par mois (pagination 1 page = 1 mois)
const MATERNELLE_MONTHS = [
  { month: 'Septembre', trimester: 1 }, { month: 'Octobre', trimester: 1 },
  { month: 'Novembre', trimester: 1 }, { month: 'Décembre', trimester: 1 },
  { month: 'Janvier', trimester: 2 }, { month: 'Février', trimester: 2 },
  { month: 'Mars', trimester: 2 },
  { month: 'Avril', trimester: 3 }, { month: 'Mai', trimester: 3 },
  { month: 'Juin', trimester: 3 },
];

const MATERNELLE_MONTH_WEEKS: Record<string, string[]> = {
  'Septembre': ['3ème semaine', '4ème semaine'],
  'Octobre': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine', '5ème semaine'],
  'Novembre': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'],
  'Décembre': ['Congés'],
  'Janvier': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'],
  'Février': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'],
  'Mars': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'],
  'Avril': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'],
  'Mai': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'],
  'Juin': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'],
};

const MATERNELLE_DOMAINS = [
  { domain: 'Education pour la santé', subDomains: ['Passage aux toilettes', 'Lavage des mains', 'Goûters'] },
  { domain: 'Expression corporelle', subDomains: ['Expression corporelle'] },
  { domain: 'Pré-lecture / Pré-écriture / Pré-mathématique', subDomains: ['Pré-lecture', 'Pré-écriture', 'Pré-mathématique', 'Observation', 'Education sensorielle', 'Travaux manuels'] },
  { domain: 'Expression plastique / Expression émotionnelle', subDomains: ['Expression plastique', 'Expression émotionnelle'] },
  { domain: 'Poésie / Chant / Contes / Comptine / Communication orale', subDomains: ['Poésie', 'Chant', 'Contes', 'Comptine', 'Communication orale'] },
];

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
    @Body() body: { academicYearId: string; schoolLevelId: string; force?: boolean },
  ) {
    if (!body.academicYearId || !body.schoolLevelId) {
      return { error: 'academicYearId and schoolLevelId required' };
    }
    return this.annualPlanService.seedForTenant(
      tenantId, body.academicYearId, body.schoolLevelId, { force: body.force === true }
    );
  }

  /**
   * ⭐ GET /pedagogy/annual-plans/export-pdf?academicYearId=Y&classLevel=CM2
   *    Génère un PDF paysage A4 avec le tableau de planification exact comme le PDF officiel.
   *    Pour la MATERNELLE : génère 10 pages (1 page = 1 mois, table différente par mois).
   *    Pour le PRIMAIRE : génère 1 page avec tous les mois en lignes.
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

    // ─────────────────────────────────────────────────────────────────
    // MATERNELLE — 10 pages, une par mois (chaque mois a un nombre différent
    // de semaines — ex: Septembre=2, Octobre=5, Décembre=1)
    // ─────────────────────────────────────────────────────────────────
    let html: string;
    if (isMaternelle) {
      // Helper: trouver le contenu d'une cellule maternelle
      const getMaternelleCell = (domain: string, subDomain: string, month: string, week: string): string => {
        const p = plans.find(p =>
          p.domain === domain && p.subDomain === subDomain && p.month === month && p.week === week
        );
        return p?.content || '—';
      };

      // Couleurs par trimestre
      const triColor: Record<number, string> = {
        1: '#3b82f6', // blue-500
        2: '#10b981', // emerald-500
        3: '#f59e0b', // amber-500
      };

      // Générer une page HTML par mois (10 pages au total)
      const maternellePages = MATERNELLE_MONTHS.map((monthData, pageIdx) => {
        const weeks = MATERNELLE_MONTH_WEEKS[monthData.month] || [];
        const triColorHex = triColor[monthData.trimester];
        const triLabel = TRIMESTER_LABELS[monthData.trimester];

        // Largeurs de colonnes : 18% Domaine, 14% Sous-domaine, le reste / semaines
        const weekWidth = weeks.length > 0 ? (68 / weeks.length) : 68;

        // Header du tableau (semaines)
        const weekHeaders = weeks.map(wk =>
          `<th style="border:1px solid #${triColorHex.replace('#','')};padding:4px;font-size:8px;background:${triColorHex};color:white;text-align:center;width:${weekWidth}%;vertical-align:top;">${wk}</th>`
        ).join('');

        // Lignes de domaines + sous-domaines
        const domainRows = MATERNELLE_DOMAINS.map(dom => {
          // Ligne titre du domaine (colspan total)
          const totalCols = 2 + weeks.length;
          const domainTitleRow = `<tr>
            <td colspan="${totalCols}" style="border:1px solid #cbd5e1;padding:4px;font-size:9px;font-weight:bold;background:#f1f5f9;color:#334155;">${dom.domain}</td>
          </tr>`;

          // Une ligne par sous-domaine
          const subRows = dom.subDomains.map(sub => {
            const weekCells = weeks.map(wk => {
              const content = getMaternelleCell(dom.domain, sub, monthData.month, wk);
              return `<td style="border:1px solid #cbd5e1;padding:3px;font-size:7px;vertical-align:top;width:${weekWidth}%;text-align:left;line-height:1.2;">${content}</td>`;
            }).join('');
            return `<tr>
              <td style="border:1px solid #cbd5e1;padding:3px;font-size:7px;background:#f8fafc;width:18%;">&nbsp;</td>
              <td style="border:1px solid #cbd5e1;padding:3px;font-size:7px;font-weight:600;background:#ffffff;width:14%;color:#475569;">${sub}</td>
              ${weekCells}
            </tr>`;
          }).join('');

          return domainTitleRow + subRows;
        }).join('');

        // Chaque mois = une page A4 paysage
        return `<div style="page-break-after: always;${pageIdx === MATERNELLE_MONTHS.length - 1 ? 'page-break-after: avoid;' : ''}">
          <div class="header">
            <div>
              <div class="school">${schoolDisplayName}</div>
              <div class="year">Année scolaire ${yearLabel}</div>
            </div>
          </div>
          <div class="title-row">
            <span class="title">Planification annuelle — Maternelle</span>
            <span class="class">Cours : ${classLabel}</span>
          </div>
          <div class="month-banner" style="background:${triColorHex};color:white;padding:6px 10px;border-radius:4px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:11px;font-weight:800;">${monthData.month}</span>
            <span style="font-size:9px;font-weight:600;opacity:0.9;">${triLabel} — Page ${pageIdx + 1} / ${MATERNELLE_MONTHS.length}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
            <thead>
              <tr>
                <th style="border:1px solid ${triColorHex};padding:4px;font-size:8px;background:${triColorHex};color:white;text-align:left;width:18%;">Domaines</th>
                <th style="border:1px solid ${triColorHex};padding:4px;font-size:8px;background:${triColorHex};color:white;text-align:left;width:14%;">Sous-domaine</th>
                ${weekHeaders}
              </tr>
            </thead>
            <tbody>${domainRows}</tbody>
          </table>
        </div>`;
      }).join('');

      html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
        @page { size: A4 landscape; margin: 6mm; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Helvetica, Arial, sans-serif; }
        .header { border-bottom: 3px solid #1a2a6b; padding-bottom: 6px; margin-bottom: 6px; display:flex; align-items:center; gap:10px; }
        .header .school { font-size: 12px; color:#1a2a6b; font-weight: 800; }
        .header .year { font-size: 10px; color:#475569; }
        .title-row { display:flex; justify-content:space-between; margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1; }
        .title-row .title { font-size: 13px; color:#1a2a6b; font-weight: 800; text-transform:uppercase; }
        .title-row .class { font-size: 11px; color:#1e293b; font-weight: 700; }
      </style></head><body>${maternellePages}</body></html>`;
    } else {
      // ─────────────────────────────────────────────────────────────────
      // PRIMAIRE — 1 page avec tableau large (mois en lignes × matières en colonnes)
      // ─────────────────────────────────────────────────────────────────

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

      html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
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
    }

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
