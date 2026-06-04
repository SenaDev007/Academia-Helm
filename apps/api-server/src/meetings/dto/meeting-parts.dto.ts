import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class AddParticipantDto {
  @IsString()
  participantType: string;

  @IsString()
  participantId: string;

  @IsOptional()
  @IsString()
  attendanceStatus?: string;

  @IsOptional()
  @IsString()
  excuseReason?: string;
}

export class UpdateAttendanceDto {
  @IsString()
  attendanceStatus: string;

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
  @IsString()
  status?: string;

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
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  completionNotes?: string;
}

export class SignMinutesDto {
  @IsOptional()
  @IsString()
  signatureType?: string;

  @IsOptional()
  @IsString()
  signatureData?: string;
}
