import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Class } from './entities/class.entity';

@Injectable()
export class ClassesRepository {
  constructor(
    @InjectRepository(Class)
    private readonly repository: Repository<Class>,
  ) {}

  async create(classData: Partial<Class>): Promise<Class> {
    const classEntity = this.repository.create(classData);
    return this.repository.save(classEntity);
  }

  async findOne(id: string, tenantId: string, schoolLevelId: string): Promise<Class | null> {
    return this.repository.findOne({
      where: { id, tenantId, schoolLevelId },
      relations: ['academicYear'],
    });
  }

  async findAll(
    tenantId: string,
    schoolLevelId: string,
    pagination: { skip: number; take: number },
    academicYearId?: string,
  ): Promise<Class[]> {
    const queryBuilder = this.repository
      .createQueryBuilder('class')
      .where('class.tenantId = :tenantId', { tenantId })
      .andWhere('class.schoolLevelId = :schoolLevelId', { schoolLevelId })
      .orderBy('class.name', 'ASC')
      .skip(pagination.skip)
      .take(pagination.take);

    if (academicYearId) {
      queryBuilder.andWhere('class.academicYearId = :academicYearId', { academicYearId });
      queryBuilder.leftJoinAndSelect('class.academicYear', 'academicYear');
    }

    return queryBuilder.getMany();
  }

  async count(
    tenantId: string,
    schoolLevelId: string,
    academicYearId?: string,
  ): Promise<number> {
    const where: any = { tenantId, schoolLevelId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    return this.repository.count({ where });
  }

  async update(id: string, tenantId: string, classData: Partial<Class>): Promise<Class> {
    await this.repository.update({ id, tenantId }, classData);
    const out = await this.repository.findOne({
      where: { id, tenantId },
      relations: ['academicYear'],
    });
    return out as Class;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.repository.delete({ id, tenantId });
  }
}

