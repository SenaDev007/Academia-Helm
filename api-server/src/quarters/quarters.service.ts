import { Injectable, NotFoundException } from '@nestjs/common';
import { QuartersRepository } from './quarters.repository';
import { Quarter } from './entities/quarter.entity';
import { CreateQuarterDto } from './dto/create-quarter.dto';
import { UpdateQuarterDto } from './dto/update-quarter.dto';
import { toDate } from '../common/helpers/date.helper';

@Injectable()
export class QuartersService {
  constructor(private readonly quartersRepository: QuartersRepository) {}

  async create(createQuarterDto: CreateQuarterDto, tenantId: string, createdBy?: string): Promise<Quarter> {
    // If setting as current, unset other current quarters
    if (createQuarterDto.isCurrent) {
      const currentQuarter = await this.quartersRepository.findCurrent(tenantId);
      if (currentQuarter) {
        await this.quartersRepository.update(currentQuarter.id, tenantId, { isCurrent: false });
      }
    }
    return this.quartersRepository.create({
      ...createQuarterDto,
      startDate: toDate(createQuarterDto.startDate as any) || new Date(),
      endDate: toDate(createQuarterDto.endDate as any) || new Date(),
      tenantId,
      createdBy,
    });
  }

  async findAll(tenantId: string, academicYearId?: string): Promise<Quarter[]> {
    return this.quartersRepository.findAll(tenantId, academicYearId);
  }

  async findOne(id: string, tenantId: string): Promise<Quarter> {
    const quarter = await this.quartersRepository.findOne(id, tenantId);
    if (!quarter) {
      throw new NotFoundException(`Quarter with ID ${id} not found`);
    }
    return quarter;
  }

  async findCurrent(tenantId: string): Promise<Quarter | null> {
    return this.quartersRepository.findCurrent(tenantId);
  }

  async update(id: string, updateQuarterDto: UpdateQuarterDto, tenantId: string): Promise<Quarter> {
    await this.findOne(id, tenantId);
    
    // If setting as current, unset other current quarters
    if (updateQuarterDto.isCurrent) {
      const currentQuarter = await this.quartersRepository.findCurrent(tenantId);
      if (currentQuarter && currentQuarter.id !== id) {
        await this.quartersRepository.update(currentQuarter.id, tenantId, { isCurrent: false });
      }
    }
    
    const updateData: any = { ...updateQuarterDto };
    if (updateQuarterDto.startDate) {
      updateData.startDate = toDate(updateQuarterDto.startDate as any);
    }
    if (updateQuarterDto.endDate) {
      updateData.endDate = toDate(updateQuarterDto.endDate as any);
    }
    
    return this.quartersRepository.update(id, tenantId, updateData);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.quartersRepository.delete(id, tenantId);
  }
}

