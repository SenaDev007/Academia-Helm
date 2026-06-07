import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsEnum, IsUUID } from 'class-validator';

export enum MaterialMovementType {
  PURCHASE = 'PURCHASE',
  ASSIGNMENT = 'ASSIGNMENT',
  RETURN = 'RETURN',
  REPLACEMENT = 'REPLACEMENT',
  DAMAGE = 'DAMAGE',
  DECOMMISSION = 'DECOMMISSION',
}

export class CreateMaterialMovementDto {
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsEnum(MaterialMovementType)
  movementType: MaterialMovementType;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  /** Required by Prisma schema — was previously only in controller inline type */
  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;

  /** Frontend may send schoolLevelId */
  @IsUUID()
  @IsOptional()
  schoolLevelId?: string;

  /** Frontend may send classId */
  @IsUUID()
  @IsOptional()
  classId?: string;
}
