/**
 * ============================================================================
 * COMMUNITY DTOs — class-validator (ValidationPipe global : whitelist +
 * forbidNonWhitelisted — CDC §16.3.3). Sans décorateurs, TOUT champ serait
 * rejeté (« property x should not exist »).
 * ============================================================================
 */

import {
  IsString, IsEmail, IsOptional, IsEnum, IsBoolean, IsInt, IsArray,
  IsUUID, MinLength, MaxLength, Min, ArrayMinSize,
} from 'class-validator';

export enum CommunityChannelType {
  TEXT = 'TEXT',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  RESTRICTED = 'RESTRICTED',
}

export enum CommunityRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
  MEMBER = 'MEMBER',
}

export enum CommunityMemberType {
  PROSPECT = 'PROSPECT',
  CLIENT = 'CLIENT',
  PARTNER = 'PARTNER',
  TEAM = 'TEAM',
}

export enum CommunityMemberStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  BANNED = 'BANNED',
}

// ═══════════════════════ AUTH ═══════════════════════

export class CommunityRegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName: string;

  @IsOptional() @IsString() @MaxLength(80)
  firstName?: string;

  @IsOptional() @IsString() @MaxLength(80)
  lastName?: string;

  @IsOptional() @IsString() @MaxLength(160)
  organization?: string;

  @IsOptional() @IsString() @MaxLength(80)
  country?: string;

  @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(64)
  inviteToken?: string;
}

export class CommunityLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

// ═══════════════════════ MESSAGES ═══════════════════════

export class CommunityPollOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  label: string;
}

export class CommunityPollInputDto {
  @IsString()
  @MinLength(3)
  @MaxLength(280)
  question: string;

  @IsOptional() @IsBoolean()
  isMulti?: boolean;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  options: string[];

  @IsOptional() @IsString()
  expiresAt?: string;
}

export class CommunityPostMessageDto {
  @IsOptional() @IsString() @MaxLength(8000)
  content?: string;

  @IsOptional() @IsString()
  replyToId?: string;

  @IsOptional() @IsString()
  attachmentUrl?: string;

  @IsOptional() @IsString()
  attachmentName?: string;

  @IsOptional() @IsInt() @Min(0)
  attachmentSize?: number;

  @IsOptional() @IsString()
  attachmentMime?: string;

  @IsOptional()
  poll?: CommunityPollInputDto;
}

export class CommunityEditMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content: string;
}

export class CommunityReactionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(12)
  emoji: string;
}

export class CommunityVoteDto {
  @IsArray()
  @IsString({ each: true })
  optionIds: string[];
}

export class CommunityPinDto {
  @IsBoolean()
  pinned: boolean;
}

// ═══════════════════════ ADMIN ═══════════════════════

export class CommunityUpdateMemberDto {
  @IsOptional() @IsEnum(CommunityRole)
  role?: string;

  @IsOptional() @IsEnum(CommunityMemberType)
  memberType?: string;

  @IsOptional() @IsEnum(CommunityMemberStatus)
  status?: string;
}

export class CommunityCreateChannelDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  slug: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional() @IsString() @MaxLength(280)
  description?: string;

  @IsOptional() @IsString() @MaxLength(8)
  icon?: string;

  @IsOptional() @IsEnum(CommunityChannelType)
  type?: string;

  @IsOptional() @IsInt() @Min(0)
  position?: number;
}

export class CommunityUpdateChannelDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80)
  name?: string;

  @IsOptional() @IsString() @MaxLength(280)
  description?: string;

  @IsOptional() @IsString() @MaxLength(8)
  icon?: string;

  @IsOptional() @IsEnum(CommunityChannelType)
  type?: string;

  @IsOptional() @IsInt() @Min(0)
  position?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class CommunitySchedulePostDto {
  @IsUUID()
  channelId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content: string;

  @IsOptional() @IsString()
  type?: string;

  @IsString()
  scheduledAt: string;
}

export class CommunityUpdateScheduledDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(8000)
  content?: string;

  @IsOptional() @IsString()
  scheduledAt?: string;

  @IsOptional() @IsString()
  status?: string;
}

export class CommunityBroadcastDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  channelIds: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content: string;

  @IsOptional() @IsString()
  type?: string;
}

export class CommunityCreateInviteDto {
  @IsOptional() @IsUUID()
  channelId?: string;

  @IsOptional() @IsEnum(CommunityMemberType)
  memberType?: string;

  @IsOptional() @IsString() @MaxLength(160)
  note?: string;

  @IsOptional() @IsInt() @Min(1)
  maxUses?: number;

  @IsOptional() @IsInt() @Min(1)
  expiresInDays?: number;
}

// ═══════════════════════ v2 : ÉCOLES, GROUPES, LIVES ═══════════════════════

export enum CommunityEventKind {
  LIVE = 'LIVE',
  FORMATION = 'FORMATION',
  ATELIER = 'ATELIER',
}

export enum CommunityEventAudience {
  GLOBAL = 'GLOBAL',
  SCHOOL = 'SCHOOL',
  GROUP = 'GROUP',
}

export enum CommunityEventGroupKind {
  ADMINS = 'ADMINS',
  TEACHERS = 'TEACHERS',
}

export enum CommunityEventStatus {
  SCHEDULED = 'SCHEDULED',
  LIVE = 'LIVE',
  ENDED = 'ENDED',
  CANCELLED = 'CANCELLED',
}

/** Création d'un live/formation/atelier avec ciblage d'audience (dispatch) */
export class CommunityCreateEventDto {
  @IsEnum(CommunityEventKind)
  kind: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsEnum(CommunityEventAudience)
  audience: string;

  /** Requis si audience = SCHOOL | GROUP */
  @IsOptional() @IsUUID()
  tenantId?: string;

  /** Requis si audience = GROUP (groupe ciblé de l'école) */
  @IsOptional() @IsEnum(CommunityEventGroupKind)
  groupKind?: string;

  @IsOptional() @IsString() @MaxLength(500)
  externalUrl?: string;

  @IsString()
  scheduledAt: string;
}

/** Mise à jour d'un événement (statut live, replay, reprogrammation) */
export class CommunityUpdateEventDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(160)
  title?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsEnum(CommunityEventStatus)
  status?: string;

  @IsOptional() @IsString() @MaxLength(500)
  externalUrl?: string;

  @IsOptional() @IsString() @MaxLength(500)
  replayUrl?: string;

  @IsOptional() @IsString()
  scheduledAt?: string;
}

/** Groupe custom au sein du canal d'une école */
export class CommunityCreateSchoolGroupDto {
  @IsUUID()
  tenantId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @IsOptional() @IsString() @MaxLength(280)
  description?: string;

  @IsOptional() @IsString() @MaxLength(8)
  icon?: string;

  /** Membres autorisés — rattachés école, par rôle */
  @IsOptional() @IsEnum(CommunityEventGroupKind)
  memberRole?: string;
}
