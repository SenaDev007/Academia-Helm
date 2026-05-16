import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { StudentsRepository } from './students.repository';
import { Student } from './entities/student.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { toDate } from '../common/helpers/date.helper';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { createPaginatedResponse } from '../common/helpers/pagination.helper';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class StudentsService {
  constructor(
    private readonly studentsRepository: StudentsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    createStudentDto: CreateStudentDto,
    tenantId: string,
    schoolLevelId: string,
    createdBy?: string,
  ): Promise<Student> {
    const createData: any = {
      ...createStudentDto,
      tenantId,
      schoolLevelId, // OBLIGATOIRE
      createdBy,
    };
    if (createStudentDto.dateOfBirth) {
      createData.dateOfBirth = toDate(createStudentDto.dateOfBirth as any);
    }
    return this.studentsRepository.create(createData);
  }

  async findAll(
    tenantId: string,
    schoolLevelId: string,
    pagination: PaginationDto,
    academicYearId?: string,
  ): Promise<PaginatedResponse<Student>> {
    const [data, total] = await Promise.all([
      this.studentsRepository.findAll(tenantId, schoolLevelId, pagination, academicYearId),
      this.studentsRepository.count(tenantId, schoolLevelId, academicYearId),
    ]);
    return createPaginatedResponse(data, total, pagination);
  }

  async findOne(id: string, tenantId: string, schoolLevelId: string): Promise<Student> {
    const student = await this.studentsRepository.findOne(id, tenantId, schoolLevelId);
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    return student;
  }

  async update(
    id: string,
    updateStudentDto: UpdateStudentDto,
    tenantId: string,
    schoolLevelId: string,
  ): Promise<Student> {
    // Verify student belongs to tenant and school level
    await this.findOne(id, tenantId, schoolLevelId);
    const updateData: any = { ...updateStudentDto };
    if (updateStudentDto.dateOfBirth !== undefined) {
      updateData.dateOfBirth = updateStudentDto.dateOfBirth ? toDate(updateStudentDto.dateOfBirth as any) : null;
    }
    delete updateData.matricule;
    delete updateData.enrollmentYear;
    return this.studentsRepository.update(id, tenantId, schoolLevelId, updateData);
  }

  async delete(id: string, tenantId: string, schoolLevelId: string): Promise<void> {
    // Verify student belongs to tenant and school level
    await this.findOne(id, tenantId, schoolLevelId);
    await this.studentsRepository.delete(id, tenantId, schoolLevelId);
  }

  async findByUserId(tenantId: string, userId: string): Promise<Student[]> {
    return this.studentsRepository.findByUserId(tenantId, userId);
  }

  async getStatistics(tenantId: string, schoolLevelId: string, academicYearId: string) {
    const total = await this.prisma.student.count({
      where: { tenantId, schoolLevelId }
    });

    const active = await this.prisma.studentEnrollment.count({
      where: { 
        tenantId, 
        academicYearId,
        status: 'ACTIVE',
        student: { schoolLevelId }
      }
    });

    // Identification Rate (élèves avec matricule)
    const withMatricule = await this.prisma.student.count({
      where: { tenantId, schoolLevelId, NOT: { matricule: null } }
    });

    return {
      total,
      active,
      archived: total - active,
      identificationRate: total > 0 ? (withMatricule / total) * 100 : 0,
      idCardCoverage: 45, // Mock value for now
    };
  }

  async exportToEducMaster(id: string, tenantId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, tenantId },
      include: {
        studentEnrollments: {
          include: { class: true }
        }
      }
    });

    if (!student) throw new NotFoundException('Élève non trouvé');

    // Format EDUCMASTER standard
    return {
      matricule: student.matricule,
      nom: student.lastName,
      prenom: student.firstName,
      date_naissance: student.dateOfBirth,
      sexe: student.gender,
      classe: student.studentEnrollments[0]?.class?.name || 'N/A',
      etablissement: 'ACADEMIA_PARTNER_SCHOOL',
      export_date: new Date().toISOString()
    };
  }

  async generateAcademicDossier(id: string, tenantId: string, academicYearId: string) {
    // Dans une implémentation réelle, ceci générerait un PDF
    // Pour l'instant, on retourne un objet de données simulé
    return {
      status: 'PDF_GENERATED',
      url: `/api/media/dossiers/${id}.pdf`
    };
  }
}
