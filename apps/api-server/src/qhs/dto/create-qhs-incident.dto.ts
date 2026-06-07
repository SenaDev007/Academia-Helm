import { IsString, IsEnum, IsOptional, IsObject, IsDateString } from 'class-validator';

export enum QhsIncidentType {
  SECURITE = 'SECURITE',
  DISCIPLINE = 'DISCIPLINE',
  FINANCE = 'FINANCE',
  RH = 'RH',
  PEDAGOGIE = 'PEDAGOGIE',
  AUTRE = 'AUTRE',
}

export enum QhsIncidentGravity {
  MINEUR = 'MINEUR',
  MAJEUR = 'MAJEUR',
  CRITIQUE = 'CRITIQUE',
}

export enum QhsIncidentStatus {
  OUVERT = 'OUVERT',
  EN_COURS = 'EN_COURS',
  CLOTURE = 'CLOTURE',
}

export class CreateQhsIncidentDto {
  @IsString()
  academicYearId: string;

  @IsString()
  @IsOptional()
  schoolLevelId?: string;

  @IsEnum(QhsIncidentType)
  type: QhsIncidentType;

  @IsString()
  @IsOptional()
  sourceModule?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsEnum(QhsIncidentGravity)
  gravity: QhsIncidentGravity;

  @IsEnum(QhsIncidentStatus)
  @IsOptional()
  status?: QhsIncidentStatus;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  relatedResourceType?: string;

  @IsString()
  @IsOptional()
  relatedResourceId?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

