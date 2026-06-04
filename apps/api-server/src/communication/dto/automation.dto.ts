import { IsString, IsOptional, IsBoolean, IsObject, IsEnum } from 'class-validator';

export enum TriggerType {
  NEW_ENROLLMENT = 'NEW_ENROLLMENT',
  ABSENCE = 'ABSENCE',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_OVERDUE = 'PAYMENT_OVERDUE',
  GRADE_PUBLISHED = 'GRADE_PUBLISHED',
  MEETING_REMINDER = 'MEETING_REMINDER',
  BIRTHDAY = 'BIRTHDAY',
}

export class CreateAutomationDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  schoolLevelId?: string;

  @IsString()
  triggerType: string;

  @IsString()
  channelId: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAutomationDto {
  @IsOptional()
  @IsString()
  channelId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
