import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ModulesRepository } from './modules.repository';
import { Module as ModuleEntity, ModuleType, ModuleStatus } from './entities/module.entity';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { SchoolLevelsService } from '../school-levels/school-levels.service';

@Injectable()
export class ModulesService {
  constructor(
    private readonly modulesRepository: ModulesRepository,
    private readonly schoolLevelsService: SchoolLevelsService,
  ) {}

  async create(
    createModuleDto: CreateModuleDto,
    tenantId: string,
  ): Promise<ModuleEntity> {
    // Vérifier que le niveau scolaire existe
    await this.schoolLevelsService.findOne(
      createModuleDto.schoolLevelId,
      tenantId,
    );

    return this.modulesRepository.create({
      ...createModuleDto,
      tenantId,
    });
  }

  async findAll(tenantId: string, schoolLevelId?: string): Promise<ModuleEntity[]> {
    return this.modulesRepository.findAll(tenantId, schoolLevelId);
  }

  async findActive(tenantId: string, schoolLevelId?: string): Promise<ModuleEntity[]> {
    return this.modulesRepository.findActive(tenantId, schoolLevelId);
  }

  async findOne(id: string, tenantId: string): Promise<ModuleEntity> {
    const module = await this.modulesRepository.findOne(id, tenantId);
    if (!module) {
      throw new NotFoundException(`Module with ID ${id} not found`);
    }
    return module;
  }

  async findByType(
    tenantId: string,
    type: ModuleType,
    schoolLevelId?: string,
  ): Promise<ModuleEntity[]> {
    return this.modulesRepository.findByType(tenantId, type, schoolLevelId);
  }

  async update(
    id: string,
    updateModuleDto: UpdateModuleDto,
    tenantId: string,
  ): Promise<ModuleEntity> {
    await this.findOne(id, tenantId); // Vérifier existence
    return this.modulesRepository.update(id, tenantId, updateModuleDto);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId); // Vérifier existence
    await this.modulesRepository.delete(id, tenantId);
  }

  /**
   * Activer/désactiver un module pour un niveau
   */
  async toggleModule(
    id: string,
    tenantId: string,
    isEnabled: boolean,
  ): Promise<ModuleEntity> {
    return this.update(id, { isEnabled }, tenantId);
  }

  /**
   * Vérifier si un module est activé
   */
  async isModuleEnabled(
    tenantId: string,
    moduleType: ModuleType,
    schoolLevelId: string,
  ): Promise<boolean> {
    return this.modulesRepository.isModuleEnabled(
      tenantId,
      moduleType,
      schoolLevelId,
    );
  }

  /**
   * Initialiser les modules par défaut pour un niveau
   */
  async initializeDefaults(
    tenantId: string,
    schoolLevelId: string,
  ): Promise<ModuleEntity[]> {
    return this.modulesRepository.initializeDefaultModules(tenantId, schoolLevelId);
  }

  /**
   * Vérifier les dépendances d'un module
   */
  async checkDependencies(
    tenantId: string,
    moduleType: ModuleType,
    schoolLevelId: string,
  ): Promise<{ satisfied: boolean; missing: ModuleType[] }> {
    const module = await this.modulesRepository.findOne(
      (await this.findByType(tenantId, moduleType, schoolLevelId))[0]?.id || '',
      tenantId,
    );

    if (!module) {
      throw new NotFoundException(`Module ${moduleType} not found`);
    }

    const missing: ModuleType[] = [];
    for (const depType of module.dependencies as ModuleType[]) {
      const isEnabled = await this.isModuleEnabled(tenantId, depType, schoolLevelId);
      if (!isEnabled) {
        missing.push(depType);
      }
    }

    return {
      satisfied: missing.length === 0,
      missing,
    };
  }
}

