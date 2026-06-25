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
}
