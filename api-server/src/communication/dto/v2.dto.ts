import { IsString, IsOptional, IsDateString, IsArray, IsBoolean, IsEnum, IsObject } from 'class-validator';

// ─── Announcements V2 ─────────────────────────────────────────────────────

export enum AnnouncementType {
  GENERAL = 'GENERAL',
  URGENT = 'URGENT',
  ACADEMIC = 'ACADEMIC',
  FINANCIAL = 'FINANCIAL',
  EVENT = 'EVENT',
  MAINTENANCE = 'MAINTENANCE',
}

export enum AnnouncementTarget {
  ALL = 'ALL',
  STUDENTS = 'STUDENTS',
  PARENTS = 'PARENTS',
  TEACHERS = 'TEACHERS',
  STAFF = 'STAFF',
  SPECIFIC_CLASS = 'SPECIFIC_CLASS',
}

export class CreateAnnouncementV2Dto {
  @IsEnum(AnnouncementType)
  type: AnnouncementType;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsEnum(AnnouncementTarget)
  target: AnnouncementTarget;

  @IsOptional()
  @IsString()
  schoolLevelId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsDateString()
  publishAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsString()
  priority?: string;
}

// ─── Conversations V2 ─────────────────────────────────────────────────────

export class CreateConversationV2Dto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsArray()
  @IsString({ each: true })
  participantIds: string[];

  @IsOptional()
  @IsString()
  type?: string;
}

// ─── Messages V2 ──────────────────────────────────────────────────────────

export class SendMessageV2Dto {
  @IsString()
  conversationId: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  contentFr?: string;

  @IsOptional()
  @IsString()
  contentEn?: string;

  @IsOptional()
  @IsString()
  messageType?: string;
}

// ─── Templates V2 ─────────────────────────────────────────────────────────

export class CreateTemplateV2Dto {
  @IsString()
  name: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  channelId?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Dashboard Query V2 ───────────────────────────────────────────────────

export class DashboardQueryV2Dto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  schoolLevelId?: string;

  @IsOptional()
  @IsString()
  channelId?: string;
}
