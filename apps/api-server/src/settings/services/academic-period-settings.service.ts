import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AcademicPeriodType } from '@prisma/client';
import { SettingsHistoryService } from './settings-history.service';

/**
 * Service pour la gestion des périodes académiques (trimestres, semestres, séquences).
 * Une année scolaire contient N périodes ordonnées. Une seule période active à la fois.
 * Clôture = blocage modification notes/absences (à appliquer dans les modules concernés).
 */
@Injectable()
export class AcademicPeriodSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /**
   * Vérifie que [startDate, endDate] est inclus dans les dates de l'année scolaire.
   */
  async validatePeriodDates(academicYearId: string, startDate: Date, endDate: Date): Promise<void> {
    const year = await this.prisma.academicYear.findFirst({ where: { id: academicYearId } });
    if (!year) throw new NotFoundException('Année scolaire non trouvée.');
    const yearStart = new Date(year.startDate);
    const yearEnd = new Date(year.endDate);
    yearStart.setUTCHours(0, 0, 0, 0);
    yearEnd.setUTCHours(23, 59, 59, 999);
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start < yearStart || end > yearEnd) {
      throw new BadRequestException(
        `Les dates de la période doivent être comprises entre ${yearStart.toISOString().slice(0, 10)} et ${yearEnd.toISOString().slice(0, 10)}.`,
      );
    }
    if (start > end) {
      throw new BadRequestException('La date de début doit être antérieure à la date de fin.');
    }
  }

  /**
   * Une seule période active par année : désactive les autres puis active celle demandée.
   */
  private async ensureSingleActivePeriod(tenantId: string, academicYearId: string, activePeriodId: string): Promise<void> {
    await this.prisma.academicPeriod.updateMany({
      where: { tenantId, academicYearId, id: { not: activePeriodId } },
      data: { isActive: false },
    });
    await this.prisma.academicPeriod.update({
      where: { id: activePeriodId },
      data: { isActive: true },
    });
  }

  /**
   * Liste des périodes d'une année scolaire, triées par ordre.
   */
  async getByYear(tenantId: string, academicYearId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      include: {
        periods: { orderBy: { periodOrder: 'asc' } },
      },
    });
    if (!year) throw new NotFoundException('Année scolaire non trouvée.');
    return year.periods;
  }

  /**
   * Période actuelle pour une année (celle avec isActive = true). Null si aucune.
   */
  async getCurrentPeriod(tenantId: string, academicYearId: string) {
    const period = await this.prisma.academicPeriod.findFirst({
      where: { tenantId, academicYearId, isActive: true },
    });
    return period ?? null;
  }

  /**
   * Création d'une période. Les dates doivent être incluses dans l'année scolaire.
   */
  async create(
    tenantId: string,
    academicYearId: string,
    data: {
      name: string;
      type: AcademicPeriodType;
      periodOrder: number;
      startDate: Date;
      endDate: Date;
    },
    userId: string,
  ) {
    const year = await this.prisma.academicYear.findFirst({ where: { id: academicYearId, tenantId } });
    if (!year) throw new NotFoundException('Année scolaire non trouvée.');
    await this.validatePeriodDates(academicYearId, data.startDate, data.endDate);

    const existingWithOrder = await this.prisma.academicPeriod.findMany({
      where: { academicYearId, periodOrder: { gte: data.periodOrder } },
      orderBy: { periodOrder: 'desc' },
    });
    for (const p of existingWithOrder) {
      await this.prisma.academicPeriod.update({
        where: { id: p.id },
        data: { periodOrder: p.periodOrder + 1 },
      });
    }

    const period = await this.prisma.academicPeriod.create({
      data: {
        tenantId,
        academicYearId,
        name: data.name.trim(),
        type: data.type,
        periodOrder: data.periodOrder,
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: false,
        isClosed: false,
      },
    });

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'academic_period',
      'academic_period',
      { created: { old: null, new: period.name } },
      userId,
    );
    return period;
  }

  /**
   * Mise à jour d'une période. Impossible de modifier une période déjà clôturée.
   */
  async update(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      type?: AcademicPeriodType;
      periodOrder?: number;
      startDate?: Date;
      endDate?: Date;
    },
    userId: string,
  ) {
    const existing = await this.prisma.academicPeriod.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Période non trouvée.');
    if (existing.isClosed) throw new BadRequestException('Impossible de modifier une période clôturée.');

    const startDate = data.startDate ?? existing.startDate;
    const endDate = data.endDate ?? existing.endDate;
    await this.validatePeriodDates(existing.academicYearId, startDate, endDate);

    const updatePayload: Record<string, unknown> = {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.periodOrder !== undefined && { periodOrder: data.periodOrder }),
      startDate,
      endDate,
    };

    const period = await this.prisma.academicPeriod.update({
      where: { id, tenantId },
      data: updatePayload as Parameters<typeof this.prisma.academicPeriod.update>[0]['data'],
    });

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'academic_period',
      'academic_period',
      { updated: { id: period.id, name: period.name } },
      userId,
    );
    return period;
  }

  /**
   * Active une période (et désactive les autres de la même année).
   */
  async activate(tenantId: string, id: string, userId: string) {
    const period = await this.prisma.academicPeriod.findFirst({ where: { id, tenantId } });
    if (!period) throw new NotFoundException('Période non trouvée.');
    if (period.isClosed) throw new BadRequestException('Impossible d\'activer une période clôturée.');
    await this.ensureSingleActivePeriod(tenantId, period.academicYearId, id);
    const updated = await this.prisma.academicPeriod.findUnique({ where: { id } });
    await this.historyService.logSettingChange(
      tenantId,
      null,
      'academic_period',
      'academic_period',
      { activated: { id: period.id, name: period.name } },
      userId,
    );
    return updated ?? period;
  }

  /**
   * Clôture une période (blocage modification notes/absences côté modules concernés).
   */
  async close(tenantId: string, id: string, userId: string) {
    const period = await this.prisma.academicPeriod.findFirst({ where: { id, tenantId } });
    if (!period) throw new NotFoundException('Période non trouvée.');
    if (period.isClosed) throw new BadRequestException('Période déjà clôturée.');
    const updated = await this.prisma.academicPeriod.update({
      where: { id, tenantId },
      data: { isClosed: true, isActive: false },
    });
    await this.historyService.logSettingChange(
      tenantId,
      null,
      'academic_period',
      'academic_period',
      { closed: { id: period.id, name: period.name } },
      userId,
    );
    return updated;
  }

  /**
   * Crée les 3 trimestres par défaut pour une année existante qui n'en a pas encore.
   * Retourne les périodes créées. Lance une erreur si l'année a déjà des périodes.
   */
  async ensureDefaultTrimestersForYear(tenantId: string, academicYearId: string, userId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
      include: { periods: true },
    });
    if (!year) throw new NotFoundException('Année scolaire non trouvée.');
    if (year.periods.length > 0) {
      throw new BadRequestException('Cette année a déjà des périodes. Modifiez-les ou ajoutez-en manuellement.');
    }
    await this.createDefaultTrimestersForYear(tenantId, academicYearId, year.startDate, year.endDate, userId);
    return this.getByYear(tenantId, academicYearId);
  }

  /**
   * Crée par défaut les 3 trimestres pour une année scolaire (début/fin répartis en 3 parts égales).
   * Appelé automatiquement après création d'une année. Les périodes restent modifiables et activables (une seule active à la fois).
   */
  async createDefaultTrimestersForYear(
    tenantId: string,
    academicYearId: string,
    startDate: Date,
    endDate: Date,
    userId: string,
  ): Promise<void> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);
    const totalMs = end.getTime() - start.getTime();
    const thirdMs = Math.floor(totalMs / 3);

    const t1End = new Date(start.getTime() + thirdMs);
    const t2Start = new Date(start.getTime() + thirdMs);
    const t2End = new Date(start.getTime() + 2 * thirdMs);
    const t3Start = new Date(start.getTime() + 2 * thirdMs);

    const periods = [
      { name: 'Trimestre 1', order: 1, startDate: start, endDate: t1End },
      { name: 'Trimestre 2', order: 2, startDate: t2Start, endDate: t2End },
      { name: 'Trimestre 3', order: 3, startDate: t3Start, endDate: end },
    ];

    for (const p of periods) {
      await this.prisma.academicPeriod.create({
        data: {
          tenantId,
          academicYearId,
          name: p.name,
          type: 'TRIMESTER',
          periodOrder: p.order,
          startDate: p.startDate,
          endDate: p.endDate,
          isActive: false,
          isClosed: false,
        },
      });
    }

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'academic_period',
      'academic_period',
      { default_trimesters_created: { academicYearId, names: periods.map((p) => p.name) } },
      userId,
    );
  }

  /**
   * Vérifie si une période est utilisée (notes, absences, paiements, etc.).
   * Pour l'instant on n'a pas encore de FK academicPeriodId sur Grade/Absence/Payment ;
   * quand ce sera le cas, compter les usages et refuser la suppression si > 0.
   */
  async isPeriodInUse(_tenantId: string, _periodId: string): Promise<boolean> {
    return false;
  }
}
