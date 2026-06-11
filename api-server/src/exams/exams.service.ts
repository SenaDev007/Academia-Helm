import { Injectable, NotFoundException } from '@nestjs/common';
import { ExamsRepository } from './exams.repository';
import { Exam } from './entities/exam.entity';
import { CreateExamDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { AcademicTracksService } from '../academic-tracks/academic-tracks.service';
import { toDate } from '../common/helpers/date.helper';

@Injectable()
export class ExamsService {
  constructor(
    private readonly examsRepository: ExamsRepository,
    private readonly academicTracksService: AcademicTracksService,
  ) {}

  async create(createExamDto: CreateExamDto, tenantId: string, createdBy?: string): Promise<Exam> {
    // Si academicTrackId n'est pas fourni, utiliser le track par défaut (FR)
    let academicTrackId = createExamDto.academicTrackId;
    if (!academicTrackId) {
      const defaultTrack = await this.academicTracksService.getDefaultTrack(tenantId);
      academicTrackId = defaultTrack.id;
    } else {
      // Valider que le track existe et appartient au tenant
      await this.academicTracksService.findOne(academicTrackId, tenantId);
    }

    const createData: any = {
      ...createExamDto,
      academicTrackId,
      tenantId,
      createdBy,
    };
    if (createExamDto.examDate) {
      createData.examDate = toDate(createExamDto.examDate as any);
    }
    return this.examsRepository.create(createData);
  }

  async findAll(
    tenantId: string, 
    classId?: string, 
    subjectId?: string, 
    academicYearId?: string,
    academicTrackId?: string | null,
  ): Promise<Exam[]> {
    return this.examsRepository.findAll(tenantId, classId, subjectId, academicYearId, academicTrackId);
  }

  async findOne(id: string, tenantId: string): Promise<Exam> {
    const exam = await this.examsRepository.findOne(id, tenantId);
    if (!exam) {
      throw new NotFoundException(`Exam with ID ${id} not found`);
    }
    return exam;
  }

  async update(id: string, updateExamDto: UpdateExamDto, tenantId: string): Promise<Exam> {
    await this.findOne(id, tenantId);
    const updateData: any = { ...updateExamDto };
    if (updateExamDto.examDate !== undefined) {
      updateData.examDate = updateExamDto.examDate ? toDate(updateExamDto.examDate as any) : null;
    }
    return this.examsRepository.update(id, tenantId, updateData);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.examsRepository.delete(id, tenantId);
  }
}

