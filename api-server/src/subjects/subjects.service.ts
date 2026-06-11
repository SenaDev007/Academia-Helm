import { Injectable, NotFoundException } from '@nestjs/common';
import { SubjectsRepository } from './subjects.repository';
import { Subject } from './entities/subject.entity';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly subjectsRepository: SubjectsRepository) {}

  async create(createSubjectDto: CreateSubjectDto, tenantId: string, createdBy?: string): Promise<Subject> {
    return this.subjectsRepository.create({
      ...createSubjectDto,
      tenantId,
    });
  }

  async findAll(tenantId: string, level?: string, academicYearId?: string): Promise<Subject[]> {
    return this.subjectsRepository.findAll(tenantId, level, academicYearId);
  }

  async findOne(id: string, tenantId: string): Promise<Subject> {
    const subject = await this.subjectsRepository.findOne(id, tenantId);
    if (!subject) {
      throw new NotFoundException(`Subject with ID ${id} not found`);
    }
    return subject;
  }

  async update(id: string, updateSubjectDto: UpdateSubjectDto, tenantId: string): Promise<Subject> {
    await this.findOne(id, tenantId);
    return this.subjectsRepository.update(id, tenantId, updateSubjectDto);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.subjectsRepository.delete(id, tenantId);
  }
}

