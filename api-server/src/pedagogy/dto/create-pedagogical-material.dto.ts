import { IsString, IsNotEmpty, IsOptional, IsIn, IsUUID, IsBoolean } from 'class-validator';

export enum MaterialCategory {
  BOOK = 'BOOK',
  TEACHER_GUIDE = 'TEACHER_GUIDE',
  OFFICIAL_DOCUMENT = 'OFFICIAL_DOCUMENT',
  DIDACTIC_SUPPORT = 'DIDACTIC_SUPPORT',
  LAB_MATERIAL = 'LAB_MATERIAL',
  OTHER = 'OTHER',
}

export class CreatePedagogicalMaterialDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['BOOK', 'TEACHER_GUIDE', 'OFFICIAL_DOCUMENT', 'DIDACTIC_SUPPORT', 'LAB_MATERIAL', 'OTHER'])
  category: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  schoolLevelId: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  /** Required by MaterialContextGuard for write operations */
  @IsUUID()
  @IsOptional()
  academicYearId?: string;
}
