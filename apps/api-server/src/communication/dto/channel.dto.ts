import { IsString, IsOptional, IsBoolean, IsObject, IsEnum } from 'class-validator';

export enum ChannelCode {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  WHATSAPP = 'WHATSAPP',
  PUSH = 'PUSH',
  PORTAL = 'PORTAL',
}

export class CreateChannelDto {
  @IsEnum(ChannelCode)
  code: ChannelCode;

  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}
