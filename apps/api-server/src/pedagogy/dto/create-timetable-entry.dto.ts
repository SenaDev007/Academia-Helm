import { IsString, IsNotEmpty, IsOptional, IsNumber, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTimetableEntryDto {
  @IsString()
  @IsNotEmpty()
  timetableId: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  teacherId?: string;

  @IsString()
  @IsOptional()
  roomId?: string;

  @IsNumber()
  @Type(() => Number)
  dayOfWeek: number;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  duration?: number;

  /** Required by Prisma schema */
  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;

  /** Required by Prisma schema */
  @IsUUID()
  @IsNotEmpty()
  @IsOptional() @IsString() schoolLevelId?: string;

  /** Frontend may send timeSlotId */
  @IsUUID()
  @IsOptional()
  timeSlotId?: string;

  /** ⭐ Étape couverte par la séance (ex: "Étape 1", "Étapes 1-2")
   *    Optionnel — utilisé surtout pour Lecture-Écriture au CI/CP */
  @IsString()
  @IsOptional()
  step?: string;
}

/** ⭐ DTO pour la mise à jour d'une séance (PUT /timetables/entries/:id)
 *    Tous les champs sont optionnels — on ne met à jour que ce qui est envoyé. */
export class UpdateTimetableEntryDto {
  @IsString()
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  teacherId?: string;

  @IsString()
  @IsOptional()
  roomId?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  dayOfWeek?: number;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  step?: string;
}
