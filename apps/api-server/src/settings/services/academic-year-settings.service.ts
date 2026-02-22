import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';
import { AcademicPeriodSettingsService } from './academic-period-settings.service';

/** Format attendu du nom d'année : "YYYY-YYYY" (ex. 2025-2026) */
const ACADEMIC_YEAR_NAME_REGEX = /^(\d{4})-(\d{4})$/;

/**
 * Service pour la gestion des années scolaires.
 * Les dates (pré-rentrée, rentrée, fin) sont calculées automatiquement à partir du nom (calendrier type Bénin)
 * et toujours enregistrées en BDD.
 */
@Injectable()
export class AcademicYearSettingsService {
  private readonly logger = new Logger(AcademicYearSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
    private readonly academicPeriodSettingsService: AcademicPeriodSettingsService,
  ) {}

  /**
   * Extrait l'année de début du nom "YYYY-YYYY". Retourne null si le format est invalide.
   */
  private parseStartYearFromName(name: string): number | null {
    const m = String(name).trim().match(ACADEMIC_YEAR_NAME_REGEX);
    if (!m) return null;
    const start = parseInt(m[1], 10);
    const end = parseInt(m[2], 10);
    return end === start + 1 ? start : null;
  }

  /**
   * Compare deux dates au jour près (UTC pour cohérence avec la BDD et l'API).
   */
  private sameDate(a: Date | string | null, b: Date | null): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    const dA = typeof a === 'string' ? new Date(a) : a;
    const dB = b;
    if (Number.isNaN(dA.getTime()) || Number.isNaN(dB.getTime())) return false;
    return dA.getUTCFullYear() === dB.getUTCFullYear() && dA.getUTCMonth() === dB.getUTCMonth() && dA.getUTCDate() === dB.getUTCDate();
  }

  /**
   * Recalcule les dates à partir du nom et les enregistre en BDD si elles diffèrent ou sont manquantes.
   */
  private async ensureAndPersistYearDates<T extends { id: string; name: string; preEntryDate?: Date | null; officialStartDate?: Date | null; startDate: Date; endDate: Date } & Record<string, unknown>>(
    year: T,
  ): Promise<T> {
    const startYear = this.parseStartYearFromName(year.name);
    if (startYear === null) return year;

    const dates = this.buildYearDates(startYear);
    const needsUpdate =
      !this.sameDate(year.preEntryDate ?? null, dates.preEntryDate) ||
      !this.sameDate(year.officialStartDate ?? null, dates.officialStartDate) ||
      !this.sameDate(year.startDate, dates.startDate) ||
      !this.sameDate(year.endDate, dates.endDate);

    if (!needsUpdate) return year;

    await this.prisma.academicYear.update({
      where: { id: year.id },
      data: {
        preEntryDate: dates.preEntryDate,
        officialStartDate: dates.officialStartDate,
        startDate: dates.startDate,
        endDate: dates.endDate,
      },
    });

    return { ...year, preEntryDate: dates.preEntryDate, officialStartDate: dates.officialStartDate, startDate: dates.startDate, endDate: dates.endDate } as T;
  }

  /** Normalise le tenantId (string ou objet avec .id/.tenantId) pour les requêtes Prisma */
  private normalizeTenantId(tenantId: string | undefined | { id?: string; tenantId?: string }): string {
    if (typeof tenantId === 'string') return tenantId;
    if (tenantId && typeof tenantId === 'object') {
      const id = (tenantId as { id?: string; tenantId?: string }).id ?? (tenantId as { tenantId?: string }).tenantId;
      if (typeof id === 'string') return id;
    }
    throw new BadRequestException('Tenant ID invalide ou manquant');
  }

  /**
   * Récupère toutes les années scolaires d'un tenant
   */
  async getAll(tenantId: string) {
    const tid = this.normalizeTenantId(tenantId);
    const years = await this.prisma.academicYear.findMany({
      where: { tenantId: tid },
      orderBy: { startDate: 'desc' },
    });
    const withCount = await Promise.all(
      years.map(async (y) => {
        const [students, classes, grades] = await Promise.all([
          this.prisma.student.count({ where: { tenantId: tid, academicYearId: y.id } }),
          this.prisma.class.count({ where: { tenantId: tid, academicYearId: y.id } }),
          this.prisma.grade.count({ where: { tenantId: tid, academicYearId: y.id } }),
        ]);
        return this.ensureAndPersistYearDates({ ...y, _count: { students, classes, grades } } as any);
      }),
    );
    return withCount;
  }

  /**
   * Récupère l'année scolaire active.
   * Si aucune n'existe, crée et active automatiquement l'année en cours (selon la date du jour).
   */
  async getActive(tenantId: string) {
    const tid = this.normalizeTenantId(tenantId);
    let active = await this.prisma.academicYear.findFirst({
      where: { tenantId: tid, isActive: true },
    });

    if (active) {
      const [students, classes, grades] = await Promise.all([
        this.prisma.student.count({ where: { tenantId: tid, academicYearId: active.id } }),
        this.prisma.class.count({ where: { tenantId: tid, academicYearId: active.id } }),
        this.prisma.grade.count({ where: { tenantId: tid, academicYearId: active.id } }),
      ]);
      return this.ensureAndPersistYearDates({ ...active, _count: { students, classes, grades } } as any);
    }

    // Aucune année active : créer et activer automatiquement l'année en cours (dates calculées automatiquement)
    const startYear = this.getCurrentAcademicStartYear(new Date());
    const endYear = startYear + 1;
    const name = `${startYear}-${endYear}`;

    const existing = await this.prisma.academicYear.findFirst({
      where: { tenantId: tid, name },
    });

    if (existing) {
      await this.prisma.$transaction([
        this.prisma.academicYear.updateMany({
          where: { tenantId: tid, isActive: true },
          data: { isActive: false },
        }),
        this.prisma.academicYear.update({
          where: { id: existing.id },
          data: { isActive: true },
        }),
      ]);
      const activated = await this.prisma.academicYear.findFirst({
        where: { tenantId: tid, id: existing.id },
      });
      if (!activated) return activated!;
      const [s, c, g] = await Promise.all([
        this.prisma.student.count({ where: { tenantId: tid, academicYearId: activated.id } }),
        this.prisma.class.count({ where: { tenantId: tid, academicYearId: activated.id } }),
        this.prisma.grade.count({ where: { tenantId: tid, academicYearId: activated.id } }),
      ]);
      return this.ensureAndPersistYearDates({ ...activated, _count: { students: s, classes: c, grades: g } } as any);
    }

    const dates = this.buildYearDates(startYear);
    const created = await this.prisma.academicYear.create({
      data: {
        tenantId: tid,
        name,
        label: `Année scolaire ${name}`,
        preEntryDate: dates.preEntryDate,
        officialStartDate: dates.officialStartDate,
        startDate: dates.startDate,
        endDate: dates.endDate,
        isActive: true,
        isAutoGenerated: true,
        isClosed: false,
        createdBy: null,
      },
    });

    const [s, c, g] = await Promise.all([
      this.prisma.student.count({ where: { tenantId: tid, academicYearId: created.id } }),
      this.prisma.class.count({ where: { tenantId: tid, academicYearId: created.id } }),
      this.prisma.grade.count({ where: { tenantId: tid, academicYearId: created.id } }),
    ]);
    return this.ensureAndPersistYearDates({ ...created, _count: { students: s, classes: c, grades: g } } as any);
  }

  /**
   * Année de début de l'année scolaire en cours (ex. en fév. 2026 → 2025 pour 2025-2026)
   */
  private getCurrentAcademicStartYear(date: Date): number {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0 = Jan, 8 = Sept
    return month >= 8 ? year : year - 1;
  }

  /**
   * Calcule les dates officielles d'une année scolaire (calendrier type Bénin) :
   * - Pré-rentrée : 2e lundi de septembre (lundi de la 2e semaine de septembre).
   * - Rentrée : 3e lundi de septembre (lundi suivant immédiatement les 2 premières semaines).
   * - Fin d'année : dernier vendredi de juin de l'année suivante.
   */
  private buildYearDates(startYear: number) {
    const preEntryDate = this.getSecondMondayOfSeptember(startYear);
    const officialStartDate = this.getThirdMondayOfSeptember(startYear);
    const startDate = new Date(officialStartDate);
    const endDate = this.getLastFridayOfJune(startYear + 1);
    return { preEntryDate, officialStartDate, startDate, endDate };
  }

  /**
   * Récupère une année scolaire par ID.
   * Les dates sont recalculées et enregistrées en BDD si besoin (nom au format YYYY-YYYY).
   */
  async getById(tenantId: string, id: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { tenantId, id },
      include: {
        _count: {
          select: {
            students: true,
            classes: true,
            grades: true,
            payments: true,
          },
        },
      },
    });

    if (!year) {
      throw new NotFoundException('Année scolaire non trouvée.');
    }

    return this.ensureAndPersistYearDates(year);
  }

  /**
   * Crée une nouvelle année scolaire.
   * Si le nom est au format "YYYY-YYYY", les dates sont calculées automatiquement et enregistrées en BDD.
   */
  async create(
    tenantId: string,
    data: {
      name: string;
      label: string;
      preEntryDate?: Date;
      startDate?: Date;
      endDate?: Date;
      isAutoGenerated?: boolean;
    },
    userId: string,
  ) {
    const startYear = this.parseStartYearFromName(data.name);
    const dates = startYear !== null ? this.buildYearDates(startYear) : null;

    const startDate = dates ? dates.startDate : data.startDate!;
    const endDate = dates ? dates.endDate : data.endDate!;
    if (!startDate || !endDate) {
      throw new BadRequestException(
        'Indiquez un nom au format "YYYY-YYYY" (ex. 2025-2026) pour un calcul automatique des dates, ou fournissez startDate et endDate.',
      );
    }

    const overlapping = await this.prisma.academicYear.findFirst({
      where: {
        tenantId,
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        `Les dates chevauchent l'année scolaire "${overlapping.name}".`,
      );
    }

    const year = await this.prisma.academicYear.create({
      data: {
        tenantId,
        name: data.name,
        label: data.label,
        preEntryDate: dates ? dates.preEntryDate : data.preEntryDate ?? null,
        officialStartDate: dates ? dates.officialStartDate : null,
        startDate,
        endDate,
        isActive: false,
        isAutoGenerated: data.isAutoGenerated ?? false,
      },
    });

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'academic_year',
      'academic_year',
      { created: { old: null, new: year.name } },
      userId,
    );

    await this.academicPeriodSettingsService.createDefaultTrimestersForYear(tenantId, year.id, startDate, endDate, userId);

    return year;
  }

  /**
   * Met à jour une année scolaire.
   * Même logique que les périodes : payload explicite (données envoyées ou existantes), un seul prisma.update, retour de l'entité mise à jour.
   */
  async update(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      label?: string;
      preEntryDate?: Date;
      officialStartDate?: Date;
      startDate?: Date;
      endDate?: Date;
    },
    userId: string,
  ) {
    const existing = await this.prisma.academicYear.findFirst({
      where: { tenantId, id },
      include: {
        _count: { select: { students: true, classes: true, grades: true, payments: true } },
      },
    });
    if (!existing) throw new NotFoundException('Année scolaire non trouvée.');

    // Interdiction de modifier les dates si des notes/paiements existent (sécurité métier)
    if (existing._count.grades > 0 || existing._count.payments > 0) {
      if (data.startDate !== undefined || data.endDate !== undefined) {
        throw new BadRequestException(
          'Impossible de modifier les dates : des données existent (notes ou paiements).',
        );
      }
    }

    // Construire le payload comme pour les périodes : champs envoyés ou valeur existante
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      name: data.name !== undefined ? data.name : existing.name,
      label: data.label !== undefined ? data.label : existing.label,
      preEntryDate: data.preEntryDate !== undefined ? data.preEntryDate : existing.preEntryDate,
      officialStartDate: data.officialStartDate !== undefined ? data.officialStartDate : existing.officialStartDate,
      startDate: data.startDate !== undefined ? data.startDate : existing.startDate,
      endDate: data.endDate !== undefined ? data.endDate : existing.endDate,
    };

    const updated = await this.prisma.academicYear.update({
      where: { id, tenantId },
      data: updateData as Parameters<typeof this.prisma.academicYear.update>[0]['data'],
    });

    const dateKeys = ['preEntryDate', 'officialStartDate', 'startDate', 'endDate'] as const;
    const existingRecord = existing as Record<string, unknown>;
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    dateKeys.forEach((key) => {
      const oldVal = existingRecord[key];
      const newVal = updateData[key];
      const isSame =
        oldVal != null && newVal != null
          ? this.sameDate(oldVal as Date, newVal as Date)
          : oldVal === newVal;
      if (!isSame) changes[key] = { old: oldVal, new: newVal };
    });
    if (Object.keys(changes).length > 0) {
      await this.historyService.logSettingChange(
        tenantId,
        null,
        'academic_year',
        'academic_year',
        changes,
        userId,
      );
    }

    const refetched = await this.prisma.academicYear.findFirst({
      where: { tenantId, id },
      include: {
        _count: { select: { students: true, classes: true, grades: true, payments: true } },
      },
    });
    return refetched ?? updated;
  }

  /**
   * Active une année scolaire (désactive les autres)
   */
  async activate(tenantId: string, id: string, userId: string) {
    const year = await this.getById(tenantId, id);

    if (year.isActive) {
      return year;
    }

    // Transaction pour désactiver les autres et activer celle-ci
    await this.prisma.$transaction([
      this.prisma.academicYear.updateMany({
        where: { tenantId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.academicYear.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'academic_year',
      'academic_year',
      { activated: { old: false, new: true, yearName: year.name } },
      userId,
    );

    return this.getById(tenantId, id);
  }

  /**
   * Verrouille une année scolaire (empêche les modifications)
   * Note: Le verrouillage est représenté par le fait qu'il y a des données
   * et que l'année n'est plus active
   */
  async lock(tenantId: string, id: string, userId: string) {
    const year = await this.getById(tenantId, id);

    if (year.isActive) {
      throw new BadRequestException(
        'Impossible de verrouiller l\'année active. Activez une autre année d\'abord.',
      );
    }

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'academic_year',
      'academic_year',
      { locked: { old: false, new: true, yearName: year.name } },
      userId,
    );

    return { success: true, message: `Année ${year.name} verrouillée.` };
  }

  /**
   * Duplique les paramètres d'une année vers une nouvelle.
   * Si le nom est au format "YYYY-YYYY", les dates sont calculées automatiquement.
   */
  async duplicate(
    tenantId: string,
    sourceId: string,
    data: {
      name: string;
      label: string;
      startDate?: Date;
      endDate?: Date;
      preEntryDate?: Date;
      duplicateClasses?: boolean;
      duplicateFees?: boolean;
      duplicateSubjects?: boolean;
    },
    userId: string,
  ) {
    const source = await this.getById(tenantId, sourceId);

    const newYear = await this.create(
      tenantId,
      {
        name: data.name,
        label: data.label,
        startDate: data.startDate,
        endDate: data.endDate,
        preEntryDate: data.preEntryDate,
        isAutoGenerated: false,
      },
      userId,
    );

    // Dupliquer les classes si demandé
    if (data.duplicateClasses) {
      const classes = await this.prisma.class.findMany({
        where: { tenantId, academicYearId: sourceId },
      });

      for (const cls of classes) {
        await this.prisma.class.create({
          data: {
            tenantId,
            academicYearId: newYear.id,
            schoolLevelId: cls.schoolLevelId,
            name: cls.name,
            code: cls.code,
            capacity: cls.capacity,
          },
        });
      }
    }

    // Dupliquer les frais si demandé
    if (data.duplicateFees) {
      const feeDefinitions = await this.prisma.feeDefinition.findMany({
        where: { tenantId, academicYearId: sourceId },
      });

      for (const fee of feeDefinitions) {
        await this.prisma.feeDefinition.create({
          data: {
            tenantId,
            academicYearId: newYear.id,
            schoolLevelId: fee.schoolLevelId,
            name: fee.name,
            code: fee.code,
            amount: fee.amount,
            currency: fee.currency,
            dueDate: fee.dueDate,
            isRequired: fee.isRequired,
          },
        });
      }
    }

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'academic_year',
      'academic_year',
      {
        duplicated: {
          old: null,
          new: newYear.name,
          sourceYear: source.name,
          options: {
            duplicateClasses: data.duplicateClasses,
            duplicateFees: data.duplicateFees,
            duplicateSubjects: data.duplicateSubjects,
          },
        },
      },
      userId,
    );

    return newYear;
  }

  /**
   * Supprime une année scolaire (si aucune donnée)
   */
  async delete(tenantId: string, id: string, userId: string) {
    const year = await this.getById(tenantId, id);

    if (year.isActive) {
      throw new BadRequestException('Impossible de supprimer l\'année active.');
    }

    const hasData =
      year._count.students > 0 ||
      year._count.classes > 0 ||
      year._count.grades > 0 ||
      year._count.payments > 0;

    if (hasData) {
      throw new BadRequestException(
        'Impossible de supprimer cette année : des données existent. ' +
        'Veuillez d\'abord supprimer ou archiver les données associées.',
      );
    }

    await this.prisma.academicYear.delete({ where: { id } });

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'academic_year',
      'academic_year',
      { deleted: { old: year.name, new: null } },
      userId,
    );

    return { success: true, message: `Année ${year.name} supprimée.` };
  }

  /**
   * Génère automatiquement la prochaine année scolaire
   * Règle officielle :
   * - Pré-rentrée : lundi de la 2ème semaine de septembre
   * - Rentrée officielle : lundi suivant la pré-rentrée
   * - Fin d'année : dernière semaine de juin
   */
  async generateNext(tenantId: string, userId: string) {
    const currentYear = await this.getActive(tenantId);
    
    // Déterminer l'année de départ
    let startYear: number;
    if (currentYear) {
      // Année suivante basée sur l'année en cours
      const currentEndYear = new Date(currentYear.endDate).getFullYear();
      startYear = currentEndYear;
    } else {
      // Première année : utiliser l'année actuelle ou suivante selon le mois
      const now = new Date();
      startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear();
    }

    const endYear = startYear + 1;
    const name = `${startYear}-${endYear}`;

    // Vérifier si cette année existe déjà
    const existing = await this.prisma.academicYear.findFirst({
      where: { tenantId, name },
    });
    if (existing) {
      throw new BadRequestException(`L'année scolaire ${name} existe déjà.`);
    }

    const dates = this.buildYearDates(startYear);

    const year = await this.prisma.academicYear.create({
      data: {
        tenantId,
        name,
        label: `Année scolaire ${name}`,
        preEntryDate: dates.preEntryDate,
        officialStartDate: dates.officialStartDate,
        startDate: dates.startDate,
        endDate: dates.endDate,
        isAutoGenerated: true,
        isActive: false,
        isClosed: false,
        createdBy: userId,
      },
    });

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'academic_year',
      'academic_year',
      { generated: { old: null, new: name, dates: { preEntryDate: dates.preEntryDate, officialStartDate: dates.officialStartDate, startDate: dates.startDate, endDate: dates.endDate } } },
      userId,
    );

    await this.academicPeriodSettingsService.createDefaultTrimestersForYear(tenantId, year.id, dates.startDate, dates.endDate, userId);

    return year;
  }

  /**
   * Pré-rentrée : 2e lundi de septembre (UTC pour cohérence API/affichage).
   */
  private getSecondMondayOfSeptember(year: number): Date {
    const day = this.getNthMondayOfSeptemberDay(year, 2);
    return new Date(Date.UTC(year, 8, day));
  }

  /**
   * Rentrée : 3e lundi de septembre (UTC).
   */
  private getThirdMondayOfSeptember(year: number): Date {
    const day = this.getNthMondayOfSeptemberDay(year, 3);
    return new Date(Date.UTC(year, 8, day));
  }

  /**
   * Retourne le jour du mois (1-30) du N-ième lundi de septembre (n=1 → 1er lundi).
   */
  private getNthMondayOfSeptemberDay(year: number, n: number): number {
    const sept1 = new Date(Date.UTC(year, 8, 1));
    const dayOfWeek = sept1.getUTCDay();
    const daysUntilFirstMonday = dayOfWeek === 1 ? 0 : (8 - dayOfWeek) % 7;
    const firstMondayDay = 1 + daysUntilFirstMonday;
    return firstMondayDay + (n - 1) * 7;
  }

  /**
   * Fin d'année scolaire : dernier vendredi de juin, à minuit UTC (ex. 26 juin 2026).
   */
  private getLastFridayOfJune(year: number): Date {
    let day = 30;
    const june30 = new Date(Date.UTC(year, 5, 30));
    let dow = june30.getUTCDay();
    while (dow !== 5) {
      day -= 1;
      dow = (dow - 1 + 7) % 7;
    }
    return new Date(Date.UTC(year, 5, day));
  }

  /**
   * Clôture une année scolaire (lecture seule)
   */
  async close(tenantId: string, id: string, userId: string) {
    const year = await this.getById(tenantId, id);

    if (year.isClosed) {
      throw new BadRequestException(`L'année ${year.name} est déjà clôturée.`);
    }

    if (year.isActive) {
      throw new BadRequestException(
        'Impossible de clôturer l\'année active. Activez une autre année d\'abord.',
      );
    }

    const updated = await this.prisma.academicYear.update({
      where: { id },
      data: {
        isClosed: true,
        closedAt: new Date(),
        closedBy: userId,
      },
    });

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'academic_year',
      'academic_year',
      { closed: { old: false, new: true, yearName: year.name } },
      userId,
    );

    return updated;
  }

  /**
   * Récupère les statistiques d'une année
   */
  async getYearStats(tenantId: string, id: string) {
    const year = await this.getById(tenantId, id);
    
    const [studentsCount, classesCount, gradesCount, paymentsCount] = await Promise.all([
      this.prisma.student.count({ where: { tenantId, academicYearId: id } }),
      this.prisma.class.count({ where: { tenantId, academicYearId: id } }),
      this.prisma.grade.count({ where: { tenantId, academicYearId: id } }),
      this.prisma.payment.count({ where: { tenantId, academicYearId: id } }),
    ]);

    return {
      ...year,
      stats: {
        students: studentsCount,
        classes: classesCount,
        grades: gradesCount,
        payments: paymentsCount,
        canDelete: studentsCount === 0 && classesCount === 0 && gradesCount === 0 && paymentsCount === 0,
        canClose: !year.isActive && !year.isClosed,
      },
    };
  }
}
