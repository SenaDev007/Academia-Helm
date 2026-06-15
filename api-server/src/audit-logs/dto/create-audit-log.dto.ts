import { IsString, IsOptional, IsUUID, IsObject } from 'class-validator';

export class CreateAuditLogDto {
  @IsString()
  action: string;

  @IsString()
  resource: string;

  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @IsOptional()
  @IsObject()
  changes?: Record<string, any>;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

