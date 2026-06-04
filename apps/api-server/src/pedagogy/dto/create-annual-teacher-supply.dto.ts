import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsUUID } from 'class-validator';

export class CreateAnnualTeacherSupplyDto {
  @IsUUID()
  @IsNotEmpty()
  teacherId: string;

  @IsUUID()
  @IsNotEmpty()
  materialId: string;

  /** Optional — falls back to the material's schoolLevelId if not provided */
  @IsUUID()
  @IsOptional()
  schoolLevelId?: string;

  /** Optional — validated in service, omitted if Class doesn't exist */
  @IsUUID()
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
