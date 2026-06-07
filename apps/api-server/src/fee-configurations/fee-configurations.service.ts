import { Injectable, NotFoundException } from '@nestjs/common';
import { FeeConfigurationsRepository } from './fee-configurations.repository';
import { FeeConfiguration } from './entities/fee-configuration.entity';
import { CreateFeeConfigurationDto } from './dto/create-fee-configuration.dto';
import { UpdateFeeConfigurationDto } from './dto/update-fee-configuration.dto';
import { toDate } from '../common/helpers/date.helper';

@Injectable()
export class FeeConfigurationsService {
  constructor(private readonly feeConfigurationsRepository: FeeConfigurationsRepository) {}

  async create(createFeeConfigurationDto: CreateFeeConfigurationDto, tenantId: string, createdBy?: string): Promise<FeeConfiguration> {
    const createData: any = {
      ...createFeeConfigurationDto,
      tenantId,
      createdBy,
    };
    if (createFeeConfigurationDto.dueDate) {
      createData.dueDate = toDate(createFeeConfigurationDto.dueDate as any);
    }
    return this.feeConfigurationsRepository.create(createData);
  }

  async findAll(tenantId: string, classId?: string, academicYearId?: string): Promise<FeeConfiguration[]> {
    return this.feeConfigurationsRepository.findAll(tenantId, classId, academicYearId);
  }

  async findOne(id: string, tenantId: string): Promise<FeeConfiguration> {
    const feeConfiguration = await this.feeConfigurationsRepository.findOne(id, tenantId);
    if (!feeConfiguration) {
      throw new NotFoundException(`Fee configuration with ID ${id} not found`);
    }
    return feeConfiguration;
  }

  async update(id: string, updateFeeConfigurationDto: UpdateFeeConfigurationDto, tenantId: string): Promise<FeeConfiguration> {
    await this.findOne(id, tenantId);
    const updateData: any = { ...updateFeeConfigurationDto };
    if (updateFeeConfigurationDto.dueDate !== undefined) {
      updateData.dueDate = updateFeeConfigurationDto.dueDate ? toDate(updateFeeConfigurationDto.dueDate as any) : null;
    }
    return this.feeConfigurationsRepository.update(id, tenantId, updateData);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.feeConfigurationsRepository.delete(id, tenantId);
  }
}

