import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsEnum, IsBoolean, IsUUID } from 'class-validator';

export enum MaterialCondition {
  NEW = 'NEW',
  GOOD = 'GOOD',
  USED = 'USED',
  DAMAGED = 'DAMAGED',
}

export class CreateTeacherMaterialAssignmentDto {
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

  @IsEnum(MaterialCondition)
  conditionAtIssue: MaterialCondition;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  signed?: boolean;

  /** Required by Prisma schema — was previously only in controller inline type */
  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;
}
