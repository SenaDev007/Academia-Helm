import { Injectable, NotFoundException } from '@nestjs/common';
import { AbsencesRepository } from './absences.repository';
import { Absence } from './entities/absence.entity';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { UpdateAbsenceDto } from './dto/update-absence.dto';
import { toDate } from '../common/helpers/date.helper';

@Injectable()
export class AbsencesService {
  constructor(private readonly absencesRepository: AbsencesRepository) {}

  async create(createAbsenceDto: CreateAbsenceDto, tenantId: string, createdBy?: string): Promise<Absence> {
    return this.absencesRepository.create({
      ...createAbsenceDto,
      date: toDate(createAbsenceDto.date as any) || new Date(),
      tenantId,
      createdBy,
    });
  }

  async findAll(tenantId: string, studentId?: string, classId?: string, startDate?: Date, endDate?: Date): Promise<Absence[]> {
    return this.absencesRepository.findAll(tenantId, studentId, classId, startDate, endDate);
  }

  async findOne(id: string, tenantId: string): Promise<Absence> {
    const absence = await this.absencesRepository.findOne(id, tenantId);
    if (!absence) {
      throw new NotFoundException(`Absence with ID ${id} not found`);
    }
    return absence;
  }

  async update(id: string, updateAbsenceDto: UpdateAbsenceDto, tenantId: string, justifiedBy?: string): Promise<Absence> {
    await this.findOne(id, tenantId);
    const updateData: any = { ...updateAbsenceDto, justifiedBy };
    if (updateAbsenceDto.date) {
      updateData.date = toDate(updateAbsenceDto.date as any);
    }
    return this.absencesRepository.update(id, tenantId, updateData);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.absencesRepository.delete(id, tenantId);
  }
}

