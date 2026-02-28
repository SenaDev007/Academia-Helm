import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { StudentsRepository } from './students.repository';
import { Student } from './entities/student.entity';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { toDate } from '../common/helpers/date.helper';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { createPaginatedResponse } from '../common/helpers/pagination.helper';

@Injectable()
export class StudentsService {
  constructor(private readonly studentsRepository: StudentsRepository) {}

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
}
