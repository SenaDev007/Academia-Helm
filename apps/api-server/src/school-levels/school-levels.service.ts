import { Injectable, NotFoundException } from '@nestjs/common';
import { SchoolLevelsRepository } from './school-levels.repository';
import { SchoolLevel, SchoolLevelType } from './entities/school-level.entity';
import { CreateSchoolLevelDto } from './dto/create-school-level.dto';
import { UpdateSchoolLevelDto } from './dto/update-school-level.dto';
import { CacheService } from '../common/services/cache.service';

@Injectable()
export class SchoolLevelsService {
  constructor(
    private readonly schoolLevelsRepository: SchoolLevelsRepository,
    private readonly cacheService: CacheService,
  ) {}

  /** ⭐ FIX CAPACITÉ — purge le cache de liste d'un tenant (toute mutation). */
  private async invalidateLevelCache(tenantId: string): Promise<void> {
    try {
      await this.cacheService.invalidate(`slv:all:${tenantId}`);
    } catch {
      // non critique
    }
  }

  async create(
    createSchoolLevelDto: CreateSchoolLevelDto,
    tenantId: string,
  ): Promise<SchoolLevel> {
    const created = await this.schoolLevelsRepository.create({
      ...createSchoolLevelDto,
      tenantId,
    });
    await this.invalidateLevelCache(tenantId);
    return created;
  }

  /**
   * ⭐ FIX CAPACITÉ (estimation 20/50/100 écoles) — cache 60 s par tenant :
   * GET /school-levels fait partie du bootstrap de CHAQUE session. La liste
   * des niveaux (maternelle/primaire/secondaire…) change rarement — le premier
   * utilisateur d'un tenant paie la requête, les suivants servent le cache.
   */
  async findAll(tenantId: string): Promise<SchoolLevel[]> {
    const cacheKey = `slv:all:${tenantId}`;
    try {
      const cached = await this.cacheService.get<SchoolLevel[]>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch {
      // Cache indisponible → comportement précédent
    }
    const levels = await this.schoolLevelsRepository.findAll(tenantId);
    try {
      await this.cacheService.set(cacheKey, levels, 60 * 1000);
    } catch {
      // non critique
    }
    return levels;
  }

  async findOne(id: string, tenantId: string): Promise<SchoolLevel> {
    const schoolLevel = await this.schoolLevelsRepository.findOne(id, tenantId);
    if (!schoolLevel) {
      throw new NotFoundException(`School level with ID ${id} not found`);
    }
    return schoolLevel;
  }

  async findByType(
    tenantId: string,
    type: SchoolLevelType,
  ): Promise<SchoolLevel> {
    const schoolLevel = await this.schoolLevelsRepository.findByType(
      tenantId,
      type,
    );
    if (!schoolLevel) {
      throw new NotFoundException(
        `School level with type ${type} not found for tenant`,
      );
    }
    return schoolLevel;
  }

  async update(
    id: string,
    updateSchoolLevelDto: UpdateSchoolLevelDto,
    tenantId: string,
  ): Promise<SchoolLevel> {
    await this.findOne(id, tenantId); // Vérifier existence
    const updated = await this.schoolLevelsRepository.update(id, tenantId, updateSchoolLevelDto);
    await this.invalidateLevelCache(tenantId);
    return updated;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId); // Vérifier existence
    await this.schoolLevelsRepository.delete(id, tenantId);
    await this.invalidateLevelCache(tenantId);
  }

  /**
   * Initialiser les niveaux scolaires par défaut
   */
  async initializeDefaults(tenantId: string): Promise<SchoolLevel[]> {
    const levels = await this.schoolLevelsRepository.initializeDefaultLevels(tenantId);
    await this.invalidateLevelCache(tenantId);
    return levels;
  }
}

