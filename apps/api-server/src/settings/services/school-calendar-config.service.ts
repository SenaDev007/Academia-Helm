/**
 * ============================================================================
 * SCHOOL CALENDAR CONFIG SERVICE — Configuration du calendrier scolaire
 * ============================================================================
 *
 * Rend paramétrables les règles de calcul des dates d'année scolaire et de
 * trimestres qui étaient auparavant codées en dur (calendrier type Bénin).
 *
 * Si un tenant n'a pas d'enregistrement SchoolCalendarConfig, on utilise les
 * valeurs par défaut (calendrier Bénin) — ceci assure la rétro-compatibilité
 * pour tous les tenants existants.
 *
 * Utilisé par :
 * - AcademicYearSettingsService.buildYearDates() pour calculer les dates
 *   pré-rentrée / rentrée / fin d'année
 * - AcademicPeriodSettingsService.createDefaultTrimestersForYear() pour
 *   calculer les dates des 3 trimestres
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';

/**
 * Configuration du calendrier scolaire avec valeurs par défaut (Bénin).
 * Utilisé quand un tenant n'a pas d'enregistrement SchoolCalendarConfig en base.
 */
export const DEFAULT_CALENDAR_CONFIG = {
  startMonth: 8, // Septembre (0-indexed)
  preEntryWeekNumber: 2, // 2e semaine du mois
  preEntryDayOfWeek: 1, // Lundi (0=Dim, 1=Lun, ..., 6=Sam)
  entryWeekOffset: 1, // +1 semaine entre pré-rentrée et rentrée
  endMonth: 5, // Juin
  endDayOfWeek: 5, // Vendredi (dernier du mois)
  quarter1EndMonth: 11, // Décembre
  quarter1EndDay: 31,
  quarter2EndMonth: 2, // Mars
  quarter2EndDay: 31,
  quarter3EndMonth: 5, // Juin
  quarter3EndDay: 30,
} as const;

export type CalendarConfig = typeof DEFAULT_CALENDAR_CONFIG;

export interface UpdateCalendarConfigDto {
  startMonth?: number;
  preEntryWeekNumber?: number;
  preEntryDayOfWeek?: number;
  entryWeekOffset?: number;
  endMonth?: number;
  endDayOfWeek?: number;
  quarter1EndMonth?: number;
  quarter1EndDay?: number;
  quarter2EndMonth?: number;
  quarter2EndDay?: number;
  quarter3EndMonth?: number;
  quarter3EndDay?: number;
}

@Injectable()
export class SchoolCalendarConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /**
   * Récupère la config du calendrier scolaire pour un tenant.
   * Si aucune config n'existe en base, retourne les valeurs par défaut (Bénin).
   * Ne crée PAS d'enregistrement en base — c'est volontaire pour ne pas
   * polluer la DB pour les tenants qui utilisent les valeurs par défaut.
   */
  async getForTenant(tenantId: string): Promise<CalendarConfig> {
    const config = await this.prisma.schoolCalendarConfig.findUnique({
      where: { tenantId },
    });
    if (!config) return { ...DEFAULT_CALENDAR_CONFIG };
    return {
      startMonth: config.startMonth,
      preEntryWeekNumber: config.preEntryWeekNumber,
      preEntryDayOfWeek: config.preEntryDayOfWeek,
      entryWeekOffset: config.entryWeekOffset,
      endMonth: config.endMonth,
      endDayOfWeek: config.endDayOfWeek,
      quarter1EndMonth: config.quarter1EndMonth,
      quarter1EndDay: config.quarter1EndDay,
      quarter2EndMonth: config.quarter2EndMonth,
      quarter2EndDay: config.quarter2EndDay,
      quarter3EndMonth: config.quarter3EndMonth,
      quarter3EndDay: config.quarter3EndDay,
    };
  }

  /**
   * Récupère la config complète (avec id, timestamps) pour affichage UI.
   * Retourne null si aucune config en base (l'UI peut alors afficher les
   * valeurs par défaut en lecture seule).
   */
  async getRawForTenant(tenantId: string) {
    return this.prisma.schoolCalendarConfig.findUnique({
      where: { tenantId },
    });
  }

  /**
   * Met à jour (ou crée) la config du calendrier pour un tenant.
   * Valide les plages de valeurs (mois 0-11, jour 0-6, etc.).
   */
  async upsert(
    tenantId: string,
    dto: UpdateCalendarConfigDto,
    userId: string,
  ) {
    this.validateDto(dto);

    const existing = await this.prisma.schoolCalendarConfig.findUnique({
      where: { tenantId },
    });

    let result;
    if (existing) {
      result = await this.prisma.schoolCalendarConfig.update({
        where: { tenantId },
        data: { ...prismaUpdateDefaults(), ...dto },
      });
    } else {
      result = await this.prisma.schoolCalendarConfig.create({
        data: {
          ...prismaCreateDefaults(),
          tenantId,
          ...dto,
        },
      });
    }

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'school_calendar_config',
      'school_calendar_config',
      { updated: { old: existing ?? null, new: dto } },
      userId,
    );

    return result;
  }

  /**
   * Réinitialise la config d'un tenant aux valeurs par défaut.
   * Supprime l'enregistrement en base — le système utilisera DEFAULT_CALENDAR_CONFIG.
   */
  async reset(tenantId: string, userId: string) {
    const existing = await this.prisma.schoolCalendarConfig.findUnique({
      where: { tenantId },
    });
    if (!existing) {
      return { reset: true, wasUsingDefaults: true };
    }
    await this.prisma.schoolCalendarConfig.delete({
      where: { tenantId },
    });
    await this.historyService.logSettingChange(
      tenantId,
      null,
      'school_calendar_config',
      'school_calendar_config',
      { reset: { old: existing, new: 'defaults' } },
      userId,
    );
    return { reset: true, wasUsingDefaults: false };
  }

  /**
   * Validation des plages de valeurs du DTO.
   */
  private validateDto(dto: UpdateCalendarConfigDto): void {
    const errors: string[] = [];
    if (dto.startMonth !== undefined && (dto.startMonth < 0 || dto.startMonth > 11)) {
      errors.push('startMonth doit être entre 0 et 11');
    }
    if (dto.endMonth !== undefined && (dto.endMonth < 0 || dto.endMonth > 11)) {
      errors.push('endMonth doit être entre 0 et 11');
    }
    if (dto.quarter1EndMonth !== undefined && (dto.quarter1EndMonth < 0 || dto.quarter1EndMonth > 11)) {
      errors.push('quarter1EndMonth doit être entre 0 et 11');
    }
    if (dto.quarter2EndMonth !== undefined && (dto.quarter2EndMonth < 0 || dto.quarter2EndMonth > 11)) {
      errors.push('quarter2EndMonth doit être entre 0 et 11');
    }
    if (dto.quarter3EndMonth !== undefined && (dto.quarter3EndMonth < 0 || dto.quarter3EndMonth > 11)) {
      errors.push('quarter3EndMonth doit être entre 0 et 11');
    }
    if (dto.preEntryDayOfWeek !== undefined && (dto.preEntryDayOfWeek < 0 || dto.preEntryDayOfWeek > 6)) {
      errors.push('preEntryDayOfWeek doit être entre 0 (Dim) et 6 (Sam)');
    }
    if (dto.endDayOfWeek !== undefined && (dto.endDayOfWeek < 0 || dto.endDayOfWeek > 6)) {
      errors.push('endDayOfWeek doit être entre 0 (Dim) et 6 (Sam)');
    }
    if (dto.preEntryWeekNumber !== undefined && (dto.preEntryWeekNumber < 1 || dto.preEntryWeekNumber > 5)) {
      errors.push('preEntryWeekNumber doit être entre 1 et 5');
    }
    if (dto.entryWeekOffset !== undefined && (dto.entryWeekOffset < 0 || dto.entryWeekOffset > 4)) {
      errors.push('entryWeekOffset doit être entre 0 et 4');
    }
    if (dto.quarter1EndDay !== undefined && (dto.quarter1EndDay < 1 || dto.quarter1EndDay > 31)) {
      errors.push('quarter1EndDay doit être entre 1 et 31');
    }
    if (dto.quarter2EndDay !== undefined && (dto.quarter2EndDay < 1 || dto.quarter2EndDay > 31)) {
      errors.push('quarter2EndDay doit être entre 1 et 31');
    }
    if (dto.quarter3EndDay !== undefined && (dto.quarter3EndDay < 1 || dto.quarter3EndDay > 31)) {
      errors.push('quarter3EndDay doit être entre 1 et 31');
    }
    if (errors.length > 0) {
      throw new Error(`Configuration invalide : ${errors.join('; ')}`);
    }
  }

  // ─── Méthodes utilitaires de calcul de dates basées sur la config ───

  /**
   * Calcule le N-ième jour de la semaine d'un mois donné.
   * @param year Année
   * @param month Mois (0-indexed)
   * @param weekNumber Numéro de semaine (1=première, 2=deuxième, etc.)
   * @param dayOfWeek Jour de la semaine (0=Dim, 1=Lun, ..., 6=Sam)
   */
  static getNthDayOfWeekOfMonth(
    year: number,
    month: number,
    weekNumber: number,
    dayOfWeek: number,
  ): Date {
    const firstOfMonth = new Date(Date.UTC(year, month, 1));
    const firstDayOfWeek = firstOfMonth.getUTCDay();
    const daysUntilFirstOccurrence = (dayOfWeek - firstDayOfWeek + 7) % 7;
    const dayOfNthOccurrence = 1 + daysUntilFirstOccurrence + (weekNumber - 1) * 7;
    return new Date(Date.UTC(year, month, dayOfNthOccurrence));
  }

  /**
   * Calcule le dernier jour de la semaine d'un mois donné.
   * @param year Année
   * @param month Mois (0-indexed)
   * @param dayOfWeek Jour de la semaine (0=Dim, 1=Lun, ..., 6=Sam)
   */
  static getLastDayOfWeekOfMonth(
    year: number,
    month: number,
    dayOfWeek: number,
  ): Date {
    // Dernier jour du mois
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    let currentDay = lastDay.getUTCDay();
    const offset = (currentDay - dayOfWeek + 7) % 7;
    lastDay.setUTCDate(lastDay.getUTCDate() - offset);
    return lastDay;
  }

  /**
   * Calcule les dates d'une année scolaire selon la config du tenant.
   * @param startYear L'année de début (ex: 2025 pour 2025-2026)
   * @param config La config du calendrier (utilise DEFAULT_CALENDAR_CONFIG si non fournie)
   */
  static calculateYearDates(
    startYear: number,
    config: CalendarConfig = DEFAULT_CALENDAR_CONFIG,
  ): {
    preEntryDate: Date;
    officialStartDate: Date;
    startDate: Date;
    endDate: Date;
  } {
    // Pré-rentrée : N-ième jour de la semaine du mois de début (sept par défaut)
    const preEntryDate = SchoolCalendarConfigService.getNthDayOfWeekOfMonth(
      startYear,
      config.startMonth,
      config.preEntryWeekNumber,
      config.preEntryDayOfWeek,
    );

    // Rentrée officielle : pré-rentrée + entryWeekOffset semaines
    const officialStartDate = new Date(preEntryDate);
    officialStartDate.setUTCDate(
      preEntryDate.getUTCDate() + config.entryWeekOffset * 7,
    );

    // Date de début = date de rentrée officielle
    const startDate = new Date(officialStartDate);

    // Fin : dernier jour de la semaine du mois de fin (juin par défaut) de l'année suivante
    const endDate = SchoolCalendarConfigService.getLastDayOfWeekOfMonth(
      startYear + 1,
      config.endMonth,
      config.endDayOfWeek,
    );

    return { preEntryDate, officialStartDate, startDate, endDate };
  }

  /**
   * Calcule les dates des 3 trimestres selon la config du tenant.
   * @param yearStart La date de début de l'année scolaire
   * @param yearEnd La date de fin de l'année scolaire
   * @param config La config du calendrier
   */
  static calculateQuarterDates(
    yearStart: Date,
    yearEnd: Date,
    config: CalendarConfig = DEFAULT_CALENDAR_CONFIG,
  ): Array<{ name: string; order: number; startDate: Date; endDate: Date }> {
    const startYear = yearStart.getUTCFullYear();
    const endYear = yearEnd.getUTCFullYear();

    // T1 : début de l'année → jour de fin Q1 (par défaut 31 déc de l'année de début)
    const t1End = new Date(Date.UTC(startYear, config.quarter1EndMonth, config.quarter1EndDay, 23, 59, 59, 999));
    // T2 : 1er jour après Q1 → jour de fin Q2 (par défaut 31 mars de l'année de fin)
    const t2Start = new Date(t1End);
    t2Start.setUTCDate(t2Start.getUTCDate() + 1);
    t2Start.setUTCHours(0, 0, 0, 0);
    const t2End = new Date(Date.UTC(endYear, config.quarter2EndMonth, config.quarter2EndDay, 23, 59, 59, 999));
    // T3 : 1er jour après Q2 → fin de l'année
    const t3Start = new Date(t2End);
    t3Start.setUTCDate(t3Start.getUTCDate() + 1);
    t3Start.setUTCHours(0, 0, 0, 0);

    return [
      { name: 'Trimestre 1', order: 1, startDate: new Date(yearStart), endDate: t1End },
      { name: 'Trimestre 2', order: 2, startDate: t2Start, endDate: t2End },
      { name: 'Trimestre 3', order: 3, startDate: t3Start, endDate: new Date(yearEnd) },
    ];
  }
}
