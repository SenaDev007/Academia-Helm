import { Injectable, NotFoundException } from '@nestjs/common';
import { AcademicYearsRepository } from './academic-years.repository';
import { AcademicYear } from './entities/academic-year.entity';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { toDate } from '../common/helpers/date.helper';

@Injectable()
export class AcademicYearsService {
  constructor(private readonly academicYearsRepository: AcademicYearsRepository) {}

  async create(createAcademicYearDto: CreateAcademicYearDto, tenantId: string, createdBy?: string): Promise<AcademicYear> {
    // If setting as current, unset other current years
    if (createAcademicYearDto.isCurrent) {
      const currentYear = await this.academicYearsRepository.findCurrent(tenantId);
      if (currentYear) {
        await this.academicYearsRepository.update(currentYear.id, tenantId, { isCurrent: false });
      }
    }
    return this.academicYearsRepository.create({
      ...createAcademicYearDto,
      startDate: toDate(createAcademicYearDto.startDate as any) || new Date(),
      endDate: toDate(createAcademicYearDto.endDate as any) || new Date(),
      tenantId,
      createdBy,
    });
  }

  async findAll(tenantId: string): Promise<AcademicYear[]> {
    return this.academicYearsRepository.findAll(tenantId);
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
    
    return this.academicYearsRepository.update(id, tenantId, updateData);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.academicYearsRepository.delete(id, tenantId);
  }
}

