import { Injectable, NotFoundException } from '@nestjs/common';
import { AcademicYearsRepository } from './academic-years.repository';
import { AcademicYear } from './entities/academic-year.entity';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { toDate } from '../common/helpers/date.helper';
import { CacheService } from '../common/services/cache.service';

/**
 * @deprecated Utilisez `AcademicYearSettingsService` (settings/services/)
 * à la place. Ce service legacy utilise le champ `isCurrent` qui n'existe
 * pas dans le schéma Prisma (qui utilise `isActive`). `findCurrent()`
 * retourne toujours null. conservé temporairement pour rétro-compatibilité
 * mais sera supprimé dans une future version.
 *
 * Voir : `apps/api-server/src/settings/services/academic-year-settings.service.ts`
 */
@Injectable()
export class AcademicYearsService {
  constructor(
    private readonly academicYearsRepository: AcademicYearsRepository,
    private readonly cacheService: CacheService,
  ) {}

  /** ⭐ FIX CAPACITÉ — purge le cache de liste d'un tenant (toute mutation). */
  private async invalidateYearCache(tenantId: string): Promise<void> {
    try {
      await this.cacheService.invalidate(`acy:all:${tenantId}`);
    } catch {
      // non critique
    }
  }

  async create(createAcademicYearDto: CreateAcademicYearDto, tenantId: string, createdBy?: string): Promise<AcademicYear> {
    // If setting as current, unset other current years
    if (createAcademicYearDto.isCurrent) {
      const currentYear = await this.academicYearsRepository.findCurrent(tenantId);
      if (currentYear) {
        await this.academicYearsRepository.update(currentYear.id, tenantId, { isCurrent: false });
      }
    }
    const created = await this.academicYearsRepository.create({
      ...createAcademicYearDto,
      startDate: toDate(createAcademicYearDto.startDate as any) || new Date(),
      endDate: toDate(createAcademicYearDto.endDate as any) || new Date(),
      tenantId,
      createdBy,
    });
    await this.invalidateYearCache(tenantId);
    return created;
  }

  /**
   * ⭐ FIX CAPACITÉ (estimation 20/50/100 écoles) — cache 60 s par tenant :
   * GET /academic-years fait partie du bootstrap de CHAQUE session utilisateur.
   * Les années scolaires changent une fois par an — le premier utilisateur
   * d'un tenant paie la requête, les suivants servent le cache pendant 60 s.
   */
  async findAll(tenantId: string): Promise<AcademicYear[]> {
    const cacheKey = `acy:all:${tenantId}`;
    try {
      const cached = await this.cacheService.get<AcademicYear[]>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch {
      // Cache indisponible → comportement précédent
    }
    const years = await this.academicYearsRepository.findAll(tenantId);
    try {
      await this.cacheService.set(cacheKey, years, 60 * 1000);
    } catch {
      // non critique
    }
    return years;
  }

  async findOne(id: string, tenantId: string): Promise<AcademicYear> {
    const academicYear = await this.academicYearsRepository.findOne(id, tenantId);
    if (!academicYear) {
      throw new NotFoundException(`Academic year with ID ${id} not found`);
    }
    return academicYear;
  }

  async findCurrent(tenantId: string): Promise<AcademicYear | null> {
    return this.academicYearsRepository.findCurrent(tenantId);
  }

  async update(id: string, updateAcademicYearDto: UpdateAcademicYearDto, tenantId: string): Promise<AcademicYear> {
    await this.findOne(id, tenantId);

    // If setting as current, unset other current years
    if (updateAcademicYearDto.isCurrent) {
      const currentYear = await this.academicYearsRepository.findCurrent(tenantId);
      if (currentYear && currentYear.id !== id) {
        await this.academicYearsRepository.update(currentYear.id, tenantId, { isCurrent: false });
      }
    }

    const updateData: any = { ...updateAcademicYearDto };
    if (updateAcademicYearDto.startDate) {
      updateData.startDate = toDate(updateAcademicYearDto.startDate as any);
    }
    if (updateAcademicYearDto.endDate) {
      updateData.endDate = toDate(updateAcademicYearDto.endDate as any);
    }

    const updated = await this.academicYearsRepository.update(id, tenantId, updateData);
    await this.invalidateYearCache(tenantId);
    return updated;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.academicYearsRepository.delete(id, tenantId);
    await this.invalidateYearCache(tenantId);
  }
}
