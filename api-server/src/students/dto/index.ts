// Re-export existing
export * from './create-student.dto';
export * from './update-student.dto';
export * from './create-admission.dto';
export * from './update-admission.dto';

// New DTOs for Prisma controller endpoints
import { IsString, IsOptional, IsDateString, IsIn, IsUUID, IsBoolean } from 'class-validator';

export class CreateStudentPrismaDto {
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsUUID() academicYearId: string;
  @IsUUID() schoolLevelId: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsIn(['M', 'F']) gender?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() primaryLanguage?: string;
  @IsOptional() @IsString() npi?: string;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsString() placeOfBirth?: string;
  /** Frontend may send tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateStudentPrismaDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsIn(['M', 'F']) gender?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() primaryLanguage?: string;
  @IsOptional() @IsString() npi?: string;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsString() placeOfBirth?: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED', 'ARCHIVED']) status?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class EnrollStudentDto {
  @IsUUID() academicYearId: string;
  @IsUUID() schoolLevelId: string;
  @IsUUID() classId: string;
  @IsIn(['NEW', 'REPEAT', 'TRANSFER']) enrollmentType: string;
  @IsDateString() enrollmentDate: string;
  /** Frontend may send tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

export class ArchiveStudentDto {
  @IsOptional() @IsString() reason?: string;
}

export class CreateGuardianDto {
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsString() relationship: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateGuardianDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateGuardianRelationDto {
  @IsOptional() @IsString() relationship?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsString() tenantId?: string;
}

export class RecordAttendanceDto {
  @IsUUID() studentId: string;
  @IsUUID() academicYearId: string;
  @IsDateString() date: string;
  @IsOptional() @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']) status?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsUUID() classId?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class RecordClassAttendanceDto {
  @IsUUID() classId: string;
  @IsUUID() academicYearId: string;
  @IsDateString() date: string;
  @IsOptional() @IsIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']) defaultStatus?: string;
  @IsOptional() @IsString() tenantId?: string;
}

export class CreateDisciplineDto {
  @IsUUID() studentId: string;
  @IsUUID() academicYearId: string;
  @IsString() type: string;
  @IsString() reason: string;
  @IsOptional() @IsDateString() actionDate?: string;
  @IsOptional() @IsString() sanction?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateDisciplineDto {
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsDateString() actionDate?: string;
  @IsOptional() @IsString() sanction?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() tenantId?: string;
}

export class CreateStudentDocumentDto {
  @IsString() documentType: string;
  @IsString() fileName: string;
  @IsString() filePath: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsString() tenantId?: string;
}

export class CreateTransferRequestDto {
  @IsUUID() studentId: string;
  @IsUUID() academicYearId: string;
  @IsUUID() fromClassId: string;
  @IsUUID() toClassId: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() tenantId?: string;
}

export class DecideAdmissionDto {
  @IsIn(['ACCEPTED', 'REJECTED']) decision: string;
  @IsOptional() @IsString() comment?: string;
}
