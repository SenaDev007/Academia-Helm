import { IsString, IsOptional, IsBoolean, IsDateString, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum MessageType {
  INFO = 'INFO',
  ALERT = 'ALERT',
  NOTIFICATION = 'NOTIFICATION',
  REMINDER = 'REMINDER',
}

export enum MessageStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export class MessageTargetDto {
  @IsString()
  targetType: string;

  @IsString()
  targetId: string;
}

export class CreateMessageDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  schoolLevelId?: string;

  @IsOptional()
  @IsString()
  channelId?: string;

  @IsOptional()
  @IsString()
  senderUserId?: string;

  @IsOptional()
  @IsString()
  subject?: string;

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

  @IsOptional()
  @IsBoolean()
  isScheduled?: boolean;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageTargetDto)
  targets?: MessageTargetDto[];
}

export class UpdateMessageDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  contentFr?: string;

  @IsOptional()
  @IsString()
  contentEn?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class AddRecipientsDto {
  @IsArray()
  @ValidateNested({ each: true })
  recipients: Array<{ recipientId: string; recipientType: string }>;
}

export class AddTargetsDto {
  @IsArray()
  @ValidateNested({ each: true })
  targets: Array<{ targetType: string; targetId: string }>;
}
