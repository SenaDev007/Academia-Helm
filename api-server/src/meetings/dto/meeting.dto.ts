import { IsString, IsOptional, IsDateString, IsBoolean, IsEnum } from 'class-validator';

export enum MeetingType {
  ADMIN = 'ADMIN',
  PEDAGOGIC = 'PEDAGOGIC',
  PARENTS = 'PARENTS',
  STAFF = 'STAFF',
}

export enum ScopeType {
  SCHOOL = 'SCHOOL',
  LEVEL = 'LEVEL',
  CLASS = 'CLASS',
  STUDENT = 'STUDENT',
}

export class CreateMeetingDto {
  @IsString()
  academicYearId: string;

  @IsEnum(MeetingType)
  meetingType: MeetingType;

  @IsEnum(ScopeType)
  scopeType: ScopeType;

  @IsOptional()
  @IsString()
  schoolLevelId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  meetingDate: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  locationOnline?: boolean;

  @IsOptional()
  @IsString()
  meetingLink?: string;
}

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  meetingDate?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  locationOnline?: boolean;

  @IsOptional()
  @IsString()
  meetingLink?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
