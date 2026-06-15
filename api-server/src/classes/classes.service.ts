import { Injectable, NotFoundException } from '@nestjs/common';
import { ClassesRepository } from './classes.repository';
import { Class } from './entities/class.entity';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { createPaginatedResponse } from '../common/helpers/pagination.helper';

@Injectable()
export class ClassesService {
  constructor(private readonly classesRepository: ClassesRepository) {}

  async create(createClassDto: CreateClassDto, tenantId: string, createdBy?: string): Promise<Class> {
    return this.classesRepository.create({
      ...createClassDto,
      tenantId,
      createdBy,
    });
  }

  async findAll(
    tenantId: string,
    schoolLevelId: string,
    pagination: PaginationDto,
    academicYearId?: string,
  ): Promise<PaginatedResponse<Class>> {
    const [data, total] = await Promise.all([
      this.classesRepository.findAll(tenantId, schoolLevelId, pagination, academicYearId),
      this.classesRepository.count(tenantId, schoolLevelId, academicYearId),
    ]);
    return createPaginatedResponse(data, total, pagination);
  }

  async findOne(id: string, tenantId: string, schoolLevelId: string): Promise<Class> {
    const classEntity = await this.classesRepository.findOne(id, tenantId, schoolLevelId);
    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${id} not found`);
    }
    return classEntity;
  }

  async update(
    id: string,
    updateClassDto: UpdateClassDto,
    tenantId: string,
    schoolLevelId: string,
  ): Promise<Class> {
    await this.findOne(id, tenantId, schoolLevelId);
    return this.classesRepository.update(id, tenantId, updateClassDto);
  }

  async delete(id: string, tenantId: string, schoolLevelId: string): Promise<void> {
    await this.findOne(id, tenantId, schoolLevelId);
    await this.classesRepository.delete(id, tenantId);
  }
}

