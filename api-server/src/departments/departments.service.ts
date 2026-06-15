import { Injectable, NotFoundException } from '@nestjs/common';
import { DepartmentsRepository } from './departments.repository';
import { Department } from './entities/department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly departmentsRepository: DepartmentsRepository) {}

  async create(createDepartmentDto: CreateDepartmentDto, tenantId: string, createdBy?: string): Promise<Department> {
    return this.departmentsRepository.create({
      ...createDepartmentDto,
      tenantId,
      createdBy,
    });
  }

  async findAll(tenantId: string): Promise<Department[]> {
    return this.departmentsRepository.findAll(tenantId);
  }

  async findOne(id: string, tenantId: string): Promise<Department> {
    const department = await this.departmentsRepository.findOne(id, tenantId);
    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }
    return department;
  }

  async update(id: string, updateDepartmentDto: UpdateDepartmentDto, tenantId: string): Promise<Department> {
    await this.findOne(id, tenantId);
    return this.departmentsRepository.update(id, tenantId, updateDepartmentDto);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.departmentsRepository.delete(id, tenantId);
  }
}

