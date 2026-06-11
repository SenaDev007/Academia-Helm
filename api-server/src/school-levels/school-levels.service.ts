import { Injectable, NotFoundException } from '@nestjs/common';
import { SchoolLevelsRepository } from './school-levels.repository';
import { SchoolLevel, SchoolLevelType } from './entities/school-level.entity';
import { CreateSchoolLevelDto } from './dto/create-school-level.dto';
import { UpdateSchoolLevelDto } from './dto/update-school-level.dto';

@Injectable()
export class SchoolLevelsService {
  constructor(
    private readonly schoolLevelsRepository: SchoolLevelsRepository,
  ) {}

  async create(
    createSchoolLevelDto: CreateSchoolLevelDto,
    tenantId: string,
  ): Promise<SchoolLevel> {
    return this.schoolLevelsRepository.create({
      ...createSchoolLevelDto,
      tenantId,
    });
  }

  async findAll(tenantId: string): Promise<SchoolLevel[]> {
    return this.schoolLevelsRepository.findAll(tenantId);
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
    return this.schoolLevelsRepository.update(id, tenantId, updateSchoolLevelDto);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId); // Vérifier existence
    await this.schoolLevelsRepository.delete(id, tenantId);
  }

  /**
   * Initialiser les niveaux scolaires par défaut
   */
  async initializeDefaults(tenantId: string): Promise<SchoolLevel[]> {
    return this.schoolLevelsRepository.initializeDefaultLevels(tenantId);
  }
}

