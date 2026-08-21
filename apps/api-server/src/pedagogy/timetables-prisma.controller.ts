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
import { CreateTimetableEntryDto } from './dto/create-timetable-entry.dto';
import { CreateTimeSlotDto } from './dto/supplementary-dtos';
import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';

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
    let filteredEntries = entries;
    if (classIds) {
      const ids = classIds.split(',').filter(Boolean);
      filteredEntries = entries.filter((e: any) => !e.classId || ids.includes(e.classId));
    }

    // 3. Récupérer l'identité de l'école
    const schoolInfo: any = await this.prisma.$queryRawUnsafe(
      `SELECT "schoolName", "schoolAcronym", "logoUrl"
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

    // 5. Classes names
    const classNames: any = classIds
      ? await this.prisma.$queryRawUnsafe(
          `SELECT "name" FROM "classes" WHERE "id" = ANY($1::text[])`,
          classIds.split(',').filter(Boolean),
        ).catch(() => [])
      : [];
    const className = Array.isArray(classNames) && classNames.length > 0
      ? classNames.map((c: any) => c.name).join(' + ')
      : 'Toutes les classes';

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

    const rows = timeBlocks.map((block: any) => {
      const isBreak = block.type !== 'BLOCK';
      const breakLabel =
        block.type === 'LUNCH' ? 'Dejeuner' :
        block.type === 'BREAK' ? 'Recreation' :
        block.type === 'RECESS' ? 'Recreation' :
        block.type === 'CEREMONY' ? 'Ceremonial des couleurs' :
        block.type === 'STUDY' ? 'Etude' :
        block.type === 'ACTIVITY' ? 'Activite' :
        block.type === 'ASSEMBLY' ? 'Assemblee' :
        block.type || '';
      if (isBreak) {
        return `<tr><td style="border:1px solid #333;padding:4px;font-weight:bold;background:#fef3c7;text-align:center;font-size:9px;">${block.start}<br/>${block.end}</td><td colspan="${configuredDays.length}" style="border:1px solid #333;padding:4px;background:#fef3c7;text-align:center;font-size:10px;font-weight:bold;color:#92400e;">${breakLabel} (${block.start} - ${block.end})</td></tr>`;
      }
      const cells = configuredDays.map((day: any) => {
        const cellEntries = filteredEntries.filter((e: any) =>
          e.dayOfWeek === day.value && e.startTime >= block.start && e.endTime <= block.end
        );
        if (cellEntries.length === 0) return '<td style="border:1px solid #333;padding:4px;min-height:35px;"></td>';
        return '<td style="border:1px solid #333;padding:4px;background:#eff6ff;">' + cellEntries.map((e: any) => {
          const subj = e.subject?.name || '\u2014';
          const teacher = e.teacher ? `${e.teacher.firstName?.[0] || ''}. ${e.teacher.lastName || ''}` : '';
          const room = e.room?.code || '';
          return `<div style="margin-bottom:2px;padding:2px 4px;background:white;border-radius:3px;border:1px solid #bfdbfe;"><strong style="font-size:9px;color:#1e40af;">${subj}</strong><br/><span style="font-size:8px;color:#666;">${teacher}${room ? ' - ' + room : ''}</span><br/><span style="font-size:7px;color:#999;">${e.startTime}-${e.endTime}</span></div>`;
        }).join('') + '</td>';
      }).join('');
      return `<tr><td style="border:1px solid #333;padding:4px;font-weight:bold;background:#e2e8f0;text-align:center;font-size:9px;">${block.start}<br/>${block.end}</td>${cells}</tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>EDT - ${className}</title><style>@page{size:A4 landscape;margin:10mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Helvetica,Arial,sans-serif;font-size:11px}.header{display:flex;align-items:center;gap:15px;border-bottom:3px solid #1a2a6b;padding-bottom:8px;margin-bottom:10px}h1{font-size:14px;color:#1a2a6b}h2{font-size:11px;color:#666;margin-top:2px}table{width:100%;border-collapse:collapse}th{border:1px solid #333;padding:4px;font-size:9px}td{border:1px solid #333;padding:2px;font-size:9px;vertical-align:top}.footer{margin-top:8px;font-size:8px;color:#999;text-align:center;border-top:1px solid #ddd;padding-top:4px}</style></head><body><div class="header">${logoHtml}<div><h1>EMPLOI DU TEMPS</h1><h2>${school.schoolName || ''}${school.schoolName ? ' - ' : ''}${className}</h2></div></div><table><thead><tr><th style="width:60px;background:#1a2a6b;color:white;">Horaire</th>${daysHeader}</tr></thead><tbody>${rows}</tbody></table><div class="footer">Document genere automatiquement par Academia Helm le ${new Date().toLocaleDateString('fr-FR')}</div></body></html>`;

    // 7. Render PDF
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise(r => setTimeout(r, 500));
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
