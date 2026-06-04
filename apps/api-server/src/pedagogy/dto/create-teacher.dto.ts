import { IsString, IsNotEmpty, IsOptional, IsInt, IsIn, IsDateString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTeacherDto {
  /** Optional — service auto-generates TCH-{YEAR}-{0001} if omitted */
  @IsString()
  @IsOptional()
  matricule?: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  /** Prisma stores plain String, use @IsIn for validation */
  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  @IsOptional()
  gender?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  specialization?: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  academicYearId?: string;

  @IsDateString()
  @IsOptional()
  hireDate?: string;

  /** Prisma stores plain String, use @IsIn for validation */
  @IsIn(['CDI', 'CDD', 'INTERIM', 'VACATAIRE', 'STAGIAIRE'])
  @IsOptional()
  contractType?: string;

  /** Prisma schema: Int? — must use @IsInt, not @IsNumber */
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  workingHours?: number;

  /** Prisma schema: Decimal? — number sent as string or float */
  @IsOptional()
  @Type(() => Number)
  salary?: number;

  @IsString()
  @IsOptional()
  bankDetails?: string;

  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @IsString()
  @IsOptional()
  qualifications?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  /** Required by Prisma schema (NOT NULL) */
  @IsUUID()
  @IsNotEmpty()
  schoolLevelId: string;

  /** Prisma stores plain String, use @IsIn for validation */
  @IsIn(['active', 'inactive', 'on_leave', 'archived'])
  @IsOptional()
  status?: string;
}
