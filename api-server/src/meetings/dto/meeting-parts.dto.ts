import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, IsArray } from 'class-validator';

export enum ParticipantType {
  TEACHER = 'TEACHER',
  STAFF = 'STAFF',
  PARENT = 'PARENT',
  EXTERNAL = 'EXTERNAL',
}

export enum AttendanceStatus {
  INVITED = 'INVITED',
  CONFIRMED = 'CONFIRMED',
  DECLINED = 'DECLINED',
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  EXCUSED = 'EXCUSED',
  NOT_ATTENDED = 'NOT_ATTENDED',
}

export enum MeetingStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  HELD = 'HELD',
  CANCELLED = 'CANCELLED',
  POSTPONED = 'POSTPONED',
}

export enum AgendaItemStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COVERED = 'COVERED',
  SKIPPED = 'SKIPPED',
}

export enum DecisionStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export enum SignatureType {
  VALIDATION = 'VALIDATION',
  APPROVAL = 'APPROVAL',
  ACKNOWLEDGMENT = 'ACKNOWLEDGMENT',
}

export class AddParticipantDto {
  @IsEnum(ParticipantType)
  participantType: ParticipantType;

  @IsString()
  participantId: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  attendanceStatus?: AttendanceStatus;

  @IsOptional()
  @IsString()
  excuseReason?: string;
}

export class UpdateAttendanceDto {
  @IsEnum(AttendanceStatus)
  attendanceStatus: AttendanceStatus;

  @IsOptional()
  @IsString()
  excuseReason?: string;
}

export class AddAgendaItemDto {
  @IsString()
  topic: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  presenterId?: string;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;
}

export class UpdateAgendaItemDto {
  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  presenterId?: string;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsEnum(AgendaItemStatus)
  status?: AgendaItemStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateMinutesDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  language?: string;
}

export class CreateDecisionDto {
  @IsString()
  decisionText: string;

  @IsOptional()
  @IsString()
  responsibleId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateDecisionDto {
  @IsOptional()
  @IsString()
  decisionText?: string;

  @IsOptional()
  @IsString()
  responsibleId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(DecisionStatus)
  status?: DecisionStatus;

  @IsOptional()
  @IsString()
  completionNotes?: string;
}

export class SignMinutesDto {
  @IsOptional()
  @IsEnum(SignatureType)
  signatureType?: SignatureType;

  @IsOptional()
  @IsString()
  signatureData?: string;
}

// ─── Inline body DTOs (replacing { reason: string } etc.) ──────────────────

export class CancelMeetingDto {
  @IsString()
  reason: string;
}

export class ReorderAgendasDto {
  @IsArray()
  @IsString({ each: true })
  agendaItemIds: string[];
}

export class GenerateMinutesDto {
  @IsOptional()
  @IsString()
  templateId?: string;
}

export class CreateMinutesVersionDto {
  @IsString()
  changes: string;
}
