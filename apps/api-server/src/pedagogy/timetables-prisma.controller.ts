/**
 * ============================================================================
 * TIMETABLES PRISMA CONTROLLER
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { TimetablesPrismaService } from './timetables-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CreateTimetableDto } from './dto/create-timetable.dto';
import { UpdateTimetableDto } from './dto/update-timetable.dto';
import { CreateTimetableEntryDto, UpdateTimetableEntryDto } from './dto/create-timetable-entry.dto';
import { CreateTimeSlotDto } from './dto/supplementary-dtos';
import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';

/**
 * ⭐ Formate une heure "08:15" → "8h15" (français naturel, sans zéro initial).
 *    Utilisé dans le PDF pour afficher "8h00-10h15" sur une seule ligne (pas de <br/>).
 */
function fmtTimePdf(t: string | null | undefined): string {
  if (!t || typeof t !== 'string') return '';
  const parts = t.split(':');
  if (parts.length < 2) return t;
  const h = parts[0];
  const m = parts[1];
  return `${parseInt(h, 10)}h${m}`;
}

@Controller('timetables')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TimetablesPrismaController {
  constructor(
    private readonly timetablesService: TimetablesPrismaService,
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly configService: ConfigService,
  ) {}

  @Post('time-slots')
  async createTimeSlot(
    @TenantId() tenantId: string,
    @Body() createDto: CreateTimeSlotDto,
  ) {
    return this.timetablesService.createTimeSlot({
      ...createDto,
      tenantId,
    });
  }

  @Post()
  async createTimetable(
    @TenantId() tenantId: string,
    @Body() createDto: CreateTimetableDto,
  ) {
    return this.timetablesService.createTimetable({
      ...createDto,
      tenantId,
    } as any);
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.timetablesService.findAllTimetables(tenantId, {
      academicYearId,
      schoolLevelId,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.timetablesService.getTimetable(id, tenantId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateTimetableDto,
  ) {
    return this.timetablesService.updateTimetable(id, tenantId, updateDto as any);
  }

  @Post(':id/entries')
  async createEntry(
    @Param('id') timetableId: string,
    @TenantId() tenantId: string,
    @Body() createDto: CreateTimetableEntryDto,
  ) {
    return this.timetablesService.createTimetableEntry({
      ...createDto,
      tenantId,
      timetableId,
    });
  }

  /**
   * ⭐ POST /timetables/check-conflict
   *    Dry-run : vérifie les conflits SANS créer l'entry.
   *    Utilisé par le frontend pour afficher les conflits en temps réel
   *    pendant que l'utilisateur remplit le formulaire (UX préventive).
   *
   *    Body : { classId?, teacherId?, roomId?, dayOfWeek, startTime, endTime, excludeEntryId? }
   *    Response : { hasConflict: boolean, conflicts: TimetableConflict[] }
   */
  @Post('check-conflict')
  async checkConflict(
    @TenantId() tenantId: string,
    @Body() body: {
      timetableId?: string;
      classId?: string;
      teacherId?: string;
      roomId?: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      excludeEntryId?: string;
    },
  ) {
    if (body.startTime >= body.endTime) {
      return {
        hasConflict: true,
        conflicts: [{
          type: 'CLASS' as const,
          message: 'L\'heure de fin doit être après l\'heure de début',
          conflictingEntry: {
            id: '',
            dayOfWeek: body.dayOfWeek,
            startTime: body.startTime,
            endTime: body.endTime,
          },
        }],
      };
    }

    return this.timetablesService.detectConflicts({
      tenantId,
      timetableId: body.timetableId,
      classId: body.classId,
      teacherId: body.teacherId,
      roomId: body.roomId,
      dayOfWeek: body.dayOfWeek,
      startTime: body.startTime,
      endTime: body.endTime,
      excludeEntryId: body.excludeEntryId,
    });
  }

  @Delete('entries/:id')
  async deleteEntry(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.timetablesService.deleteTimetableEntry(id, tenantId);
  }

  /**
   * ⭐ PUT /timetables/entries/:id — Met à jour une séance existante
   *    Permet à l'utilisateur de modifier une séance sans la supprimer/recréer :
   *    - Changer la matière (subjectId)
   *    - Changer la durée (et donc startTime/endTime recalculés côté frontend)
   *    - Mettre à jour l'étape (step) — "Étape 1" → "Étapes 2-3"
   *    Body: UpdateTimetableEntryDto (tous les champs optionnels)
   */
  @Put('entries/:id')
  async updateEntry(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateTimetableEntryDto,
  ) {
    return this.timetablesService.updateTimetableEntry(id, tenantId, updateDto as any);
  }

  /// ⭐ Supprime un timetable complet (entries + timetable)
  @Delete(':id')
  async deleteTimetable(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.timetablesService.deleteTimetable(id, tenantId);
  }

  /// ⭐ PDF A4 paysage — emploi du temps d'une ou plusieurs classes
  ///    Généré côté backend via Puppeteer avec en-tête école (logo + nom).
  @Get(':id/export-pdf')
  async exportTimetablePdf(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('classIds') classIds: string,
    @Res() res: any,
  ) {
    if (!id) throw new BadRequestException('Timetable ID requis');

    // 1. Récupérer le timetable + entries
    const timetable: any = await this.timetablesService.getTimetable(id, tenantId);
    const entries = timetable?.entries || [];

    // 2. Filtrer par classIds si fournis
    //    ⭐ Les classIds du frontend sont des IDs d'AcademicClass (ex: "CI", "CP").
    //    Mais les entries ont un classId qui est un physical Class.id (ex: "CI/A").
    //    On doit EXPANDRE les AcademicClass IDs → tous les physical Class IDs
    //    via Class.officialClassId, puis filtrer les entries par ces IDs étendus.
    let filteredEntries = entries;
    let pdfClassName = 'Toutes les classes';
    if (classIds) {
      const ids = classIds.split(',').filter(Boolean);
      // Étendre : récupérer tous les physical Class dont l'ID OU l'officialClassId
      // est dans les ids. Cela couvre les 2 cas :
      //   - L'ID envoyé est un physical Class.id → match direct
      //   - L'ID envoyé est un AcademicClass.id → match via officialClassId
      const physicalClasses = await this.prisma.class.findMany({
        where: {
          OR: [
            { id: { in: ids } },
            { officialClassId: { in: ids } },
          ],
        },
        select: { id: true, name: true, officialClassId: true },
      }).catch(() => []);
      const expandedIds = new Set<string>(ids);
      (physicalClasses as any[]).forEach(pc => expandedIds.add(pc.id));
      filteredEntries = entries.filter((e: any) =>
        !e.classId || expandedIds.has(e.classId) || (e.class?.officialClassId && ids.includes(e.class.officialClassId))
      );
      // ⭐ Pour le titre du PDF, on affiche UNIQUEMENT le nom de la classe officielle (AcademicClass).
      //    Les classes physiques (CI/A, CI/B, CI/C...) héritent toutes du même EDT → on ne
      //    affiche pas leurs noms, juste le nom de la classe officielle (ex: "CI").
      //    Résolution :
      //    - Si ids contient des AcademicClass IDs directs → on les utilise
      //    - Si ids contient des physical Class IDs → on récupère leur officialClassId
      //      pour trouver l'AcademicClass correspondante
      const academicClassIdsToResolve = new Set<string>();
      ids.forEach(id => academicClassIdsToResolve.add(id));
      (physicalClasses as any[]).forEach(pc => {
        if (pc.officialClassId) academicClassIdsToResolve.add(pc.officialClassId);
      });
      const academicClasses = await this.prisma.academicClass.findMany({
        where: { id: { in: Array.from(academicClassIdsToResolve) } },
        select: { id: true, name: true },
      }).catch(() => []);
      const allNames = (academicClasses as any[]).map((ac: any) => ac.name);
      if (allNames.length > 0) {
        // Déduquer par nom au cas où (ex: si on a sélectionné CI/A + CI/B → on récupère
        // 2 fois l'officialClassId "CI" → on veut juste "CI" une seule fois)
        const uniqueNames = Array.from(new Set(allNames));
        pdfClassName = uniqueNames.join(' + ');
      }
    }

    // 3. Récupérer l'identité de l'école (avec infos contact)
    const schoolInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT "schoolName", "schoolAcronym", "logoUrl",
              "address", "city", "department", "phonePrimary", "phoneSecondary",
              "whatsapp", "email", "website"
       FROM "tenant_identity_profiles"
       WHERE "tenantId" = $1 AND "isActive" = true
       ORDER BY "version" DESC LIMIT 1`,
      tenantId,
    );

    // 4. Récupérer la config (schoolDays + timeBlocks)
    const configRow: any = await this.prisma.$queryRawUnsafe(
      `SELECT "schoolDays", "timeBlocks" FROM "timetable_configs"
       WHERE "tenantId" = $1 AND "academicYearId" = $2
       ORDER BY "createdAt" DESC LIMIT 1`,
      tenantId, timetable.academicYearId,
    ).catch(() => []);

    let schoolDays = [1,2,3,4,5];
    let timeBlocks = [
      { start: '08:00', end: '10:00', type: 'BLOCK' },
      { start: '10:00', end: '10:15', type: 'BREAK' },
      { start: '10:15', end: '12:15', type: 'BLOCK' },
      { start: '12:15', end: '14:00', type: 'LUNCH' },
      { start: '14:00', end: '16:00', type: 'BLOCK' },
      { start: '16:00', end: '16:15', type: 'BREAK' },
      { start: '16:15', end: '18:00', type: 'BLOCK' },
    ];
    if (configRow && configRow.length > 0) {
      try {
        const sd = typeof configRow[0].schoolDays === 'string'
          ? JSON.parse(configRow[0].schoolDays) : configRow[0].schoolDays;
        if (Array.isArray(sd) && sd.length > 0) schoolDays = sd;
        const tb = typeof configRow[0].timeBlocks === 'string'
          ? JSON.parse(configRow[0].timeBlocks) : configRow[0].timeBlocks;
        if (Array.isArray(tb) && tb.length > 0) timeBlocks = tb;
      } catch {}
    }

    // 5. Classes names — utilise le nom déjà résolu à l'étape 2 (pdfClassName)
    //    Évite la requête SQL redondante qui retournait des noms vides quand les IDs
    //    étaient des AcademicClass IDs (table pedagogy_academic_classes, pas classes).
    const className = pdfClassName;

    // 6. Build HTML
    const DAYS_MAP: Record<number, string> = {1:'Lundi',2:'Mardi',3:'Mercredi',4:'Jeudi',5:'Vendredi',6:'Samedi',7:'Dimanche'};
    const configuredDays = schoolDays.map((d: number) => ({ value: d, label: DAYS_MAP[d] || `J${d}` }));
    const school = (schoolInfo?.[0]) || {};
    const logoUrl = school.logoUrl
      ? (school.logoUrl.startsWith('data:') || school.logoUrl.startsWith('http')
        ? school.logoUrl
        : `${this.configService.get<string>('APP_PUBLIC_URL') || 'https://api.academiahelm.com'}${school.logoUrl.startsWith('/') ? '' : '/'}${school.logoUrl}`)
      : '';
    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="logo" style="max-height:50px;max-width:150px;object-fit:contain;" />` : '';

    const daysHeader = configuredDays.map((d: any) =>
      `<th style="border:1px solid #333;padding:5px;font-size:10px;background:#1a2a6b;color:white;text-align:center;">${d.label}</th>`
    ).join('');

    const rows = timeBlocks.filter((b: any) => b.type !== 'CEREMONY').map((block: any) => {
      const isBreak = block.type !== 'BLOCK';
      const breakLabel =
        block.type === 'LUNCH' ? 'Dejeuner' :
        block.type === 'BREAK' ? 'Recreation' :
        block.type === 'RECESS' ? 'Recreation' :
        block.type === 'STUDY' ? 'Etude' :
        block.type === 'ACTIVITY' ? 'Activite' :
        block.type === 'ASSEMBLY' ? 'Assemblee' :
        block.type || '';
      if (isBreak) {
        // ⭐ Horaire en ligne : "8h00-10h15" au lieu de "08:00<br/>10:15"
        return `<tr><td style="border:1px solid #333;padding:4px;font-weight:bold;background:#fef3c7;text-align:center;font-size:9px;white-space:nowrap;">${fmtTimePdf(block.start)}-${fmtTimePdf(block.end)}</td><td colspan="${configuredDays.length}" style="border:1px solid #333;padding:4px;background:#fef3c7;text-align:center;font-size:10px;font-weight:bold;color:#92400e;">${breakLabel}</td></tr>`;
      }
      // ⭐ Récupérer les blocks CEREMONY qui tombent dans cet intervalle BLOCK
      //    (le cérémonial est rendu À L'INTÉRIEUR de la cellule BLOCK, pas comme une ligne séparée)
      const ceremonyInThisBlock = timeBlocks.filter((b: any) =>
        b.type === 'CEREMONY' && b.start >= block.start && b.end <= block.end
      );
      const cells = configuredDays.map((day: any) => {
        const cellEntries = filteredEntries.filter((e: any) =>
          e.dayOfWeek === day.value && e.startTime >= block.start && e.endTime <= block.end
        );
        // ⭐ HTML du cérémonial (si actif ce jour)
        const ceremonyHtml = ceremonyInThisBlock.map((cer: any) => {
          const cerDays = Array.isArray(cer.activeDays) ? cer.activeDays : schoolDays;
          if (!cerDays.includes(day.value)) return '';
          return `<div style="margin-bottom:2px;padding:2px 4px;background:#fff7ed;border:1px solid #fdba74;border-radius:3px;"><strong style="font-size:9px;color:#9a3412;">${fmtTimePdf(cer.start)}-${fmtTimePdf(cer.end)} · Ceremonial des couleurs</strong></div>`;
        }).join('');
        if (cellEntries.length === 0 && !ceremonyHtml) return '<td style="border:1px solid #333;padding:4px;min-height:35px;"></td>';
        return '<td style="border:1px solid #333;padding:4px;background:#eff6ff;">' + ceremonyHtml + cellEntries.map((e: any) => {
          const subj = e.subject?.name || '\u2014';
          const stepInfo = e.step ? ` · ${e.step}` : '';
          // ⭐ Calcul de la durée en minutes depuis startTime/endTime
          const [sh, sm] = (e.startTime || '').split(':').map(Number);
          const [eh, em] = (e.endTime || '').split(':').map(Number);
          const dur = (eh * 60 + em) - (sh * 60 + sm);
          const durStr = dur > 0 ? `${dur}min` : '';
          const timeStr = `${fmtTimePdf(e.startTime)}-${fmtTimePdf(e.endTime)}`;
          // ⭐ Format : "Lecture-Écriture · Étape 3" puis "45min (8h00-8h45)"
          return `<div style="margin-bottom:2px;padding:2px 4px;background:white;border-radius:3px;border:1px solid #bfdbfe;"><strong style="font-size:9px;color:#1e40af;">${subj}${stepInfo}</strong><br/><span style="font-size:8px;color:#475569;font-weight:600;">${durStr} (${timeStr})</span></div>`;
        }).join('') + '</td>';
      }).join('');
      // ⭐ Horaire en ligne : "8h00-10h15" au lieu de "08:00<br/>10:15"
      return `<tr><td style="border:1px solid #333;padding:4px;font-weight:bold;background:#e2e8f0;text-align:center;font-size:9px;white-space:nowrap;">${fmtTimePdf(block.start)}-${fmtTimePdf(block.end)}</td>${cells}</tr>`;
    }).join('');

    // ⭐ Construction de l'HTML — structure PROFESSIONNELLE conforme aux exigences :
    //    ┌──────────────────────────────────────────────────────┐
    //    │ EN-TÊTE : Logo + Nom école + Infos contact          │
    //    ├──────────────────────────────────────────────────────┤  ← ligne séparatrice
    //    │ TITRE : "EMPLOI DU TEMPS"              Classe : CI   │  ← titre SOUS l'en-tête
    //    ├──────────────────────────────────────────────────────┤
    //    │ TABLEAU : jours en colonnes, horaires en lignes      │
    //    └──────────────────────────────────────────────────────┘
    const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    // ⭐ `school`, `logoUrl`, `logoHtml` sont déjà déclarés plus haut (ligne 322-328)
    //    NE PAS les redéclarer — sinon SyntaxError: Identifier 'school' has already been declared
    // ⭐ Pour le nom école affiché : priorité au nom complet. Si vide, fallback sur acronyme.
    //    On n'affiche PAS les deux (l'utilisateur l'a explicitement demandé).
    const schoolDisplayName = school.schoolName || school.schoolAcronym || 'École';
    // ⭐ Infos contact à afficher dans l'en-tête (sous le nom de l'école)
    const contactParts: string[] = [];
    if (school.address) {
      const cityPart = school.city ? `, ${school.city}` : '';
      const deptPart = school.department ? ` (${school.department})` : '';
      contactParts.push(`${school.address}${cityPart}${deptPart}`);
    } else if (school.city) {
      contactParts.push(school.city + (school.department ? ` (${school.department})` : ''));
    }
    if (school.phonePrimary) {
      contactParts.push(`Tél: ${school.phonePrimary}`);
    }
    if (school.email) {
      contactParts.push(school.email);
    }
    const contactHtml = contactParts.length > 0
      ? `<div class="contact">${contactParts.join(' · ')}</div>`
      : '';
    // ⭐ logoHtml et logoUrl déjà déclarés plus haut — on surcharge logoHtml avec le bon class CSS
    const logoHtmlForTemplate = logoUrl ? `<img src="${logoUrl}" alt="logo" class="logo" />` : '';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>EDT - ${className}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1f2937; font-size: 10px; }
  /* ⭐ EN-TÊTE : logo + nom école + infos contact (PAS de titre EDT ici) */
  .header { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid #1a2a6b; padding-bottom: 6px; margin-bottom: 0; }
  .header .logo { width: 55px; height: 55px; object-fit: contain; flex-shrink: 0; }
  .header .school-info { flex: 1; }
  .header .school-name { font-size: 14px; color: #1a2a6b; font-weight: 800; letter-spacing: 0.3px; }
  .header .contact { font-size: 8px; color: #64748b; margin-top: 2px; }
  /* ⭐ TITRE : "EMPLOI DU TEMPS" à gauche, classe à droite — SOUS l'en-tête */
  .title-row { display: flex; align-items: baseline; justify-content: space-between; padding: 6px 0 4px 0; margin-bottom: 6px; border-bottom: 1px solid #cbd5e1; }
  .title-row .title { font-size: 16px; color: #1a2a6b; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
  .title-row .class-label { font-size: 12px; color: #1e293b; font-weight: 700; }
  .title-row .class-label strong { color: #1a2a6b; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead th { background: #1a2a6b; color: white; border: 1px solid #1a2a6b; padding: 6px 4px; font-size: 9px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 0.3px; }
  thead th.horaire-col { width: 70px; background: #0f172a; }
  tbody td { border: 1px solid #cbd5e1; padding: 3px; vertical-align: top; font-size: 9px; }
  tbody td.horaire-cell { background: #f1f5f9; font-weight: 700; text-align: center; color: #1e293b; font-size: 9px; }
  tbody td.break-cell { background: #fef3c7; color: #92400e; text-align: center; font-weight: 700; font-size: 10px; }
  tbody td.empty-cell { background: #fafafa; }
  tbody td.entry-cell { background: #eff6ff; }
  .footer { margin-top: 6px; font-size: 8px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 4px; }
</style>
</head>
<body>
  <div class="header">
    ${logoHtmlForTemplate || '<div class="logo"></div>'}
    <div class="school-info">
      <div class="school-name">${schoolDisplayName}</div>
      ${contactHtml}
    </div>
  </div>
  <div class="title-row">
    <span class="title">Emploi du temps</span>
    <span class="class-label">Classe : <strong>${className}</strong></span>
  </div>
  <table>
    <thead>
      <tr>
        <th class="horaire-col">Horaire</th>
        ${daysHeader}
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <div class="footer">Document généré automatiquement par Academia Helm — ${today}</div>
</body>
</html>`;

    // 7. Render PDF — try/catch explicite pour renvoyer une erreur claire au frontend
    //    en cas de problème Puppeteer (browser indisponible, timeout, etc.)
    let page: any;
    try {
      const acquired = await this.puppeteerPool.acquirePage();
      page = acquired.page;
    } catch (acquireErr: any) {
      throw new BadRequestException(
        `Impossible d'acquérir une page Puppeteer pour générer le PDF. ` +
        `Cause probable : Chromium non installé ou pool saturé. ` +
        `Détail : ${acquireErr?.message || acquireErr}`
      );
    }
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 300));
      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
        headerTemplate: '<div></div>',
        footerTemplate: '<div></div>',
      });
      const buffer = Buffer.from(pdfBuffer);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="emploi_du_temps_${className.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
        'Content-Length': buffer.length,
      });
      res.end(buffer);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }
}
