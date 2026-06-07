import { IsString, IsEnum, IsOptional, IsUUID, IsArray } from 'class-validator';
import { MessageType } from '../entities/message.entity';

export class CreateMessageDto {
  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  content: string;

  @IsUUID()
  toUserId: string;

  @IsArray()
  @IsOptional()
  attachments?: Array<{ url: string; name: string; type: string }>;
}

