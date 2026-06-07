import { Injectable, NotFoundException } from '@nestjs/common';
import { TeachersRepository } from './teachers.repository';
import { Teacher } from './entities/teacher.entity';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { toDate } from '../common/helpers/date.helper';

@Injectable()
export class TeachersService {
  constructor(private readonly teachersRepository: TeachersRepository) {}

  async create(createTeacherDto: CreateTeacherDto, tenantId: string, createdBy?: string): Promise<Teacher> {
    const createData: any = {
      ...createTeacherDto,
      tenantId,
      createdBy,
    };
    if (createTeacherDto.dateOfBirth) {
      createData.dateOfBirth = toDate(createTeacherDto.dateOfBirth as any);
    }
    return this.teachersRepository.create(createData);
  }

  async findAll(tenantId: string, departmentId?: string, status?: string): Promise<Teacher[]> {
    return this.teachersRepository.findAll(tenantId, departmentId, status);
  }

  async findOne(id: string, tenantId: string): Promise<Teacher> {
    const teacher = await this.teachersRepository.findOne(id, tenantId);
    if (!teacher) {
      throw new NotFoundException(`Teacher with ID ${id} not found`);
    }
    return teacher;
  }

  async update(id: string, updateTeacherDto: UpdateTeacherDto, tenantId: string): Promise<Teacher> {
    await this.findOne(id, tenantId);
    const updateData: any = { ...updateTeacherDto };
    if (updateTeacherDto.dateOfBirth !== undefined) {
      updateData.dateOfBirth = updateTeacherDto.dateOfBirth ? toDate(updateTeacherDto.dateOfBirth as any) : null;
    }
    return this.teachersRepository.update(id, tenantId, updateData);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.teachersRepository.delete(id, tenantId);
  }
}

