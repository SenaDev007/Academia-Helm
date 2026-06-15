import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateMeetingTemplateDto {
  @IsString()
  meetingType: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  template: string;

  @IsOptional()
  @IsObject()
  structure?: Record<string, any>;

  @IsOptional()
  @IsString()
  language?: string;
}

export class UpdateMeetingTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  template?: string;

  @IsOptional()
  @IsObject()
  structure?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
