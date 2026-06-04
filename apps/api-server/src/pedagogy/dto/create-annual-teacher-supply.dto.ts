import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsUUID } from 'class-validator';

export class CreateAnnualTeacherSupplyDto {
  @IsString()
  @IsNotEmpty()
  teacherId: string;

  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsString()
  @IsNotEmpty()
  schoolLevelId: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  /** Required by Prisma schema — was previously only in controller inline type */
  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;
}
