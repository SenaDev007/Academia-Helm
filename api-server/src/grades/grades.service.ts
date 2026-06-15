import { Injectable, NotFoundException } from '@nestjs/common';
import { GradesRepository } from './grades.repository';
import { Grade } from './entities/grade.entity';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { AcademicTracksService } from '../academic-tracks/academic-tracks.service';
import { ExamsService } from '../exams/exams.service';
import { SubjectsService } from '../subjects/subjects.service';

@Injectable()
export class GradesService {
  constructor(
    private readonly gradesRepository: GradesRepository,
    private readonly academicTracksService: AcademicTracksService,
    private readonly examsService: ExamsService,
    private readonly subjectsService: SubjectsService,
  ) {}

  async create(createGradeDto: CreateGradeDto, tenantId: string, createdBy?: string): Promise<Grade> {
    // Déterminer le academicTrackId en héritant de l'examen, de la matière, ou en utilisant le track par défaut
    let academicTrackId = createGradeDto.academicTrackId;

    // Si non fourni, hériter de l'examen
    if (!academicTrackId && createGradeDto.examId) {
      try {
        const exam = await this.examsService.findOne(createGradeDto.examId, tenantId);
        academicTrackId = exam.academicTrackId || undefined;
      } catch (error) {
        // Si l'examen n'existe pas, continuer avec les autres sources
      }
    }

    // Si toujours non fourni, hériter de la matière
    if (!academicTrackId && createGradeDto.subjectId) {
      try {
        const subject = await this.subjectsService.findOne(createGradeDto.subjectId, tenantId);
        academicTrackId = subject.academicTrackId || undefined;
      } catch (error) {
        // Si la matière n'existe pas, continuer
      }
    }

    // Si toujours non fourni, utiliser le track par défaut (FR)
    if (!academicTrackId) {
      const defaultTrack = await this.academicTracksService.getDefaultTrack(tenantId);
      academicTrackId = defaultTrack.id;
    } else {
      // Valider que le track existe et appartient au tenant
      await this.academicTracksService.findOne(academicTrackId, tenantId);
    }

    return this.gradesRepository.create({
      ...createGradeDto,
      academicTrackId,
      tenantId,
      createdBy,
    });
  }

  async findAll(
    tenantId: string, 
    studentId?: string, 
    subjectId?: string, 
    classId?: string, 
    quarterId?: string,
    academicTrackId?: string | null,
  ): Promise<Grade[]> {
    return this.gradesRepository.findAll(tenantId, studentId, subjectId, classId, quarterId, academicTrackId);
  }

  async findOne(id: string, tenantId: string): Promise<Grade> {
    const grade = await this.gradesRepository.findOne(id, tenantId);
    if (!grade) {
      throw new NotFoundException(`Grade with ID ${id} not found`);
    }
    return grade;
  }

  async update(id: string, updateGradeDto: UpdateGradeDto, tenantId: string): Promise<Grade> {
    await this.findOne(id, tenantId);
    return this.gradesRepository.update(id, tenantId, updateGradeDto);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.gradesRepository.delete(id, tenantId);
  }
}

