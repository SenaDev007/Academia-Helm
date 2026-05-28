import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from './entities/subject.entity';

@Injectable()
export class SubjectsRepository {
  constructor(
    @InjectRepository(Subject)
    private readonly repository: Repository<Subject>,
  ) {}

  async create(subjectData: Partial<Subject>): Promise<Subject> {
    const subject = this.repository.create(subjectData);
    return this.repository.save(subject);
  }

  async findOne(id: string, tenantId: string): Promise<Subject | null> {
    return this.repository.findOne({
      where: { id, tenantId },
      relations: ['academicYear', 'schoolLevel'],
    });
  }

  async findAll(tenantId: string, level?: string, academicYearId?: string): Promise<Subject[]> {
    const where: any = { tenantId };
    if (level) {
      where.schoolLevelId = level;
    }
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    return this.repository.find({
      where,
      relations: ['schoolLevel'],
      order: { code: 'ASC' },
    });
  }

  async update(id: string, tenantId: string, subjectData: Partial<Subject>): Promise<Subject> {
    await this.repository.update({ id, tenantId }, subjectData);
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.repository.delete({ id, tenantId });
  }
}

