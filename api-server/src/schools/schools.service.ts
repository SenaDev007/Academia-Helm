import { Injectable, NotFoundException } from '@nestjs/common';
import { SchoolsRepository } from './schools.repository';
import { School } from './entities/school.entity';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Injectable()
export class SchoolsService {
  constructor(private readonly schoolsRepository: SchoolsRepository) {}

  async create(createSchoolDto: CreateSchoolDto, tenantId: string, createdBy?: string): Promise<School> {
    return this.schoolsRepository.create({
      ...createSchoolDto,
      tenantId,
      createdBy,
    });
  }

  async findOne(tenantId: string): Promise<School> {
    const school = await this.schoolsRepository.findOne(tenantId);
    if (!school) {
      throw new NotFoundException(`School for tenant ${tenantId} not found`);
    }
    return school;
  }

  async update(tenantId: string, updateSchoolDto: UpdateSchoolDto): Promise<School> {
    await this.findOne(tenantId);
    return this.schoolsRepository.update(tenantId, updateSchoolDto);
  }
}

