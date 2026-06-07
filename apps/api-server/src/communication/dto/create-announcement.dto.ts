import { IsString, IsEnum, IsOptional, IsBoolean, IsUUID, IsArray, IsObject } from 'class-validator';
import { AnnouncementType, AnnouncementTarget } from '../entities/announcement.entity';

export class CreateAnnouncementDto {
  @IsUUID()
  schoolLevelId: string;

  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsEnum(AnnouncementType)
  @IsOptional()
  type?: AnnouncementType;

  @IsEnum(AnnouncementTarget)
  @IsOptional()
  target?: AnnouncementTarget;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresAcknowledgment?: boolean;

  @IsArray()
  @IsOptional()
  attachments?: Array<{ url: string; name: string; type: string }>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

