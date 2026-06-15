import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateClassDto {
  @IsString()
  name: string;

  @IsString()
  level: string;

  /** Niveau scolaire — obligatoire pour encapsuler les données par niveau */
  @IsString()
  schoolLevelId: string;

  @IsString()
  @IsOptional()
  academicYearId?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsOptional()
  mainTeacherId?: string;

  @IsString()
  @IsOptional()
  roomId?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

