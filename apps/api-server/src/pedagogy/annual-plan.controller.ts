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
import { ConfigService } from '@nestjs/config';
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
  { domain: 'I', subDomains: ['Education pour la santé', 'Passage aux toilettes', 'Lavage des mains', 'Goûters'] },
  { domain: 'II', subDomains: ['Expression corporelle'] },
  { domain: 'III', subDomains: ['Pré-lecture', 'Pré-écriture', 'Pré-mathématique', 'Observation', 'Education sensorielle', 'Travaux manuels'] },
  { domain: 'IV', subDomains: ['Expression plastique', 'Expression émotionnelle'] },
  { domain: 'V', subDomains: ['Poésie', 'Chant', 'Contes', 'Comptine', 'Communication orale'] },
];

@Controller('pedagogy/annual-plans')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AnnualPlanController {
  private readonly logger = new Logger(AnnualPlanController.name);

  constructor(
    private readonly annualPlanService: AnnualPlanService,
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly configService: ConfigService,
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
   *    Génère un PDF paysage A4 — STRUCTURE IDENTIQUE à l'emploi du temps :
   *      - En-tête : logo + nom école + contact (séparateur 3px #1a2a6b)
   *      - Titre : "Planification annuelle" + classe (sous l'en-tête)
   *      - Tableau
   *      - Pied de page : "Document généré par Academia Helm — [date]"
   *
   *    Pour la MATERNELLE : 10 pages (1 page = 1 mois, table différente par mois).
   *      Pour les mois longs (Octobre = 5 semaines), le tableau est split :
   *        - Page A : Domaines I + II + III
   *        - Page B : Domaines IV + V
   *      Pour les autres mois, tout tient sur 1 page.
   *    Pour le PRIMAIRE : 1 page avec tous les mois en lignes.
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

    // 2. Récupérer l'identité de l'école (toutes les infos pour l'en-tête)
    const schoolInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT "schoolName", "schoolAcronym", "logoUrl", "address", "city", "department", "phonePrimary", "email"
       FROM "tenant_identity_profiles"
       WHERE "tenantId" = $1 AND "isActive" = true
       ORDER BY "version" DESC LIMIT 1`,
      tenantId,
    );
    const school = schoolInfo?.[0] || {};
    const schoolDisplayName = school.schoolName || school.schoolAcronym || 'École';

    // ⭐ Infos contact (adresse + téléphone + email) — affiché sous le nom école
    const contactParts: string[] = [];
    if (school.address) {
      const cityPart = school.city ? `, ${school.city}` : '';
      const deptPart = school.department ? ` (${school.department})` : '';
      contactParts.push(`${school.address}${cityPart}${deptPart}`);
    } else if (school.city) {
      contactParts.push(school.city + (school.department ? ` (${school.department})` : ''));
    }
    if (school.phonePrimary) contactParts.push(`Tél: ${school.phonePrimary}`);
    if (school.email) contactParts.push(school.email);
    const contactHtml = contactParts.length > 0
      ? `<div class="contact">${contactParts.join(' · ')}</div>`
      : '';

    // ⭐ Logo — gère les URLs absolues (http/data:) et relatives (préfixées par l'API)
    const logoUrl = school.logoUrl
      ? (school.logoUrl.startsWith('data:') || school.logoUrl.startsWith('http')
        ? school.logoUrl
        : `${this.configService.get<string>('APP_PUBLIC_URL') || 'https://api.academiahelm.com'}${school.logoUrl.startsWith('/') ? '' : '/'}${school.logoUrl}`)
      : '';
    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="logo" class="logo" />` : '<div class="logo"></div>';

    // 3. Récupérer l'année scolaire
    const yearInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT "label" FROM "academic_years" WHERE "id" = $1 LIMIT 1`,
      academicYearId,
    ).catch(() => []);
    const yearLabel = yearInfo?.[0]?.label || new Date().getFullYear().toString();

    // 4. Date du jour pour le pied de page
    const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // 5. Construire le HTML
    const isMaternelle = classLevel === 'MATERNELLE_GRANDS';
    const classLabel = isMaternelle ? 'Maternelle (Grands)' : classLevel;

    // ⭐ CSS commun — aligné sur le pattern du PDF d'emploi du temps
    const commonCss = `
      @page { size: A4 landscape; margin: 8mm; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; font-size: 10px; }
      /* ⭐ EN-TÊTE : logo + nom école + contact (PAS de titre ici) */
      .header { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid #1a2a6b; padding-bottom: 6px; margin-bottom: 0; }
      .header .logo { width: 55px; height: 55px; object-fit: contain; flex-shrink: 0; }
      .header .school-info { flex: 1; }
      .header .school-name { font-size: 14px; color: #1a2a6b; font-weight: 800; letter-spacing: 0.3px; }
      .header .contact { font-size: 8px; color: #64748b; margin-top: 2px; }
      /* ⭐ TITRE : sous l'en-tête */
      .title-row { display: flex; align-items: baseline; justify-content: space-between; padding: 6px 0 4px 0; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; }
      .title-row .title { font-size: 16px; color: #1a2a6b; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
      .title-row .class-label { font-size: 12px; color: #1e293b; font-weight: 700; }
      .title-row .class-label strong { color: #1a2a6b; font-size: 13px; }
      /* ⭐ Tableau */
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { vertical-align: top; }
      /* ⭐ Pied de page */
      .footer { margin-top: 6px; font-size: 8px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 4px; }
    `;

    // ─────────────────────────────────────────────────────────────────
    // MATERNELLE — pages paginées par mois + page break pour mois longs
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

      // ⭐ Génère le HTML d'un "bloc domaines" (subset de MATERNELLE_DOMAINS)
      //    utilisé pour split un mois long en 2 pages
      const renderDomainBlocks = (domainSubset: typeof MATERNELLE_DOMAINS, weeks: string[], monthData: any) => {
        const triColorHex = triColor[monthData.trimester];
        const weekWidth = weeks.length > 0 ? (68 / weeks.length) : 68;

        // Header du tableau (semaines)
        const weekHeaders = weeks.map(wk =>
          `<th style="border:1px solid ${triColorHex};padding:4px;font-size:8px;background:${triColorHex};color:white;text-align:center;width:${weekWidth}%;vertical-align:top;">${wk}</th>`
        ).join('');

        // ⭐ Lignes de domaines — utilisation de ROWSPAN pour la colonne Domaine
        //    Au lieu d'une ligne "titre" qui spanne toutes les colonnes, on met
        //    le Domaine (I, II, III, IV, V) dans la 1ère ligne de chaque groupe
        //    avec rowspan = nombre de sous-domaines du domaine.
        const rows: string[] = [];
        for (const dom of domainSubset) {
          const subCount = dom.subDomains.length;
          for (let i = 0; i < subCount; i++) {
            const sub = dom.subDomains[i];
            const weekCells = weeks.map(wk => {
              const content = getMaternelleCell(dom.domain, sub, monthData.month, wk);
              return `<td style="border:1px solid #cbd5e1;padding:3px;font-size:7px;vertical-align:top;width:${weekWidth}%;text-align:left;line-height:1.2;">${content}</td>`;
            }).join('');
            if (i === 0) {
              // Première ligne du domaine : afficher le numéro romain (rowspan)
              rows.push(`<tr>
                <td rowspan="${subCount}" style="border:1px solid ${triColorHex};padding:4px;font-size:11px;font-weight:800;background:${triColorHex};color:white;text-align:center;vertical-align:middle;width:10%;">${dom.domain}</td>
                <td style="border:1px solid #cbd5e1;padding:3px;font-size:7px;font-weight:600;background:#ffffff;width:22%;color:#475569;">${sub}</td>
                ${weekCells}
              </tr>`);
            } else {
              // Lignes suivantes du même domaine : pas de cellule Domaine (rowspan s'occupe)
              rows.push(`<tr>
                <td style="border:1px solid #cbd5e1;padding:3px;font-size:7px;font-weight:600;background:#ffffff;width:22%;color:#475569;">${sub}</td>
                ${weekCells}
              </tr>`);
            }
          }
        }
        return { headerRow: weekHeaders, bodyRows: rows.join('') };
      };

      // ⭐ Pour chaque mois, on génère 1 ou 2 pages selon le nombre de semaines.
      //    Règle : si le mois a 5 semaines (Octobre), on split en 2 pages :
      //      - Page A : Domaines I + II + III (11 lignes)
      //      - Page B : Domaines IV + V (6 lignes)
      //    Pour les autres mois (≤ 4 semaines), tout tient sur 1 page.
      const maternellePages: string[] = [];
      for (let pageIdx = 0; pageIdx < MATERNELLE_MONTHS.length; pageIdx++) {
        const monthData = MATERNELLE_MONTHS[pageIdx];
        const weeks = MATERNELLE_MONTH_WEEKS[monthData.month] || [];
        const triColorHex = triColor[monthData.trimester];
        const triLabel = TRIMESTER_LABELS[monthData.trimester];

        // ⭐ Détermine si ce mois doit être split en 2 pages (long tableau)
        const needsSplit = weeks.length >= 5;
        const subsets = needsSplit
          ? [MATERNELLE_DOMAINS.slice(0, 3), MATERNELLE_DOMAINS.slice(3)] // [I+II+III] et [IV+V]
          : [MATERNELLE_DOMAINS]; // tous les domaines sur 1 page

        for (let s = 0; s < subsets.length; s++) {
          const subset = subsets[s];
          const partLabel = needsSplit ? (s === 0 ? ' (1/2)' : ' (2/2)') : '';
          const isLastPage = (pageIdx === MATERNELLE_MONTHS.length - 1) && (s === subsets.length - 1);
          const rendered = renderDomainBlocks(subset, weeks, monthData);

          maternellePages.push(`<div style="page-break-after: ${isLastPage ? 'avoid' : 'always'};">
            <div class="header">
              ${logoHtml}
              <div class="school-info">
                <div class="school-name">${schoolDisplayName}</div>
                ${contactHtml}
              </div>
            </div>
            <div class="title-row">
              <span class="title">Planification annuelle — Maternelle</span>
              <span class="class-label">Cours : <strong>${classLabel}</strong> · Année ${yearLabel}</span>
            </div>
            <div class="month-banner" style="background:${triColorHex};color:white;padding:6px 10px;border-radius:4px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:11px;font-weight:800;">${monthData.month}${partLabel}</span>
              <span style="font-size:9px;font-weight:600;opacity:0.9;">${triLabel} — Page ${pageIdx + 1}${needsSplit ? `.${s + 1}` : ''} / ${MATERNELLE_MONTHS.length}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="border:1px solid ${triColorHex};padding:4px;font-size:8px;background:${triColorHex};color:white;text-align:center;width:10%;">Domaine</th>
                  <th style="border:1px solid ${triColorHex};padding:4px;font-size:8px;background:${triColorHex};color:white;text-align:left;width:22%;">Période d'activité</th>
                  ${rendered.headerRow}
                </tr>
              </thead>
              <tbody>${rendered.bodyRows}</tbody>
            </table>
            <div class="footer">Document généré automatiquement par Academia Helm — ${today}</div>
          </div>`);
        }
      }

      html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>${commonCss}</style></head><body>${maternellePages.join('')}</body></html>`;
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

      html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>${commonCss}
        th, td { font-size: 7px; }
      </style></head><body>
        <div class="header">
          ${logoHtml}
          <div class="school-info">
            <div class="school-name">${schoolDisplayName}</div>
            ${contactHtml}
          </div>
        </div>
        <div class="title-row">
          <span class="title">Planification annuelle</span>
          <span class="class-label">Cours : <strong>${classLabel}</strong> · Année ${yearLabel}</span>
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
        <div class="footer">Document généré automatiquement par Academia Helm — ${today}</div>
      </body></html>`;
    }

    // 6. Générer le PDF via Puppeteer
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
        margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
        headerTemplate: '<div></div>',
        footerTemplate: '<div></div>',
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
