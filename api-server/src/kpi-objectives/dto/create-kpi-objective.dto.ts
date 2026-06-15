import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export enum KpiObjectivePeriod {
  ANNUEL = 'ANNUEL',
  TRIMESTRIEL = 'TRIMESTRIEL',
  MENSUEL = 'MENSUEL',
}

export enum KpiObjectiveStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ACHIEVED = 'ACHIEVED',
  AT_RISK = 'AT_RISK',
  OFF_TRACK = 'OFF_TRACK',
}

export class CreateKpiObjectiveDto {
  @IsString()
  kpiId: string;

  @IsString()
  academicYearId: string;

  @IsString()
  @IsOptional()
  schoolLevelId?: string;

  @IsEnum(KpiObjectivePeriod)
  period: KpiObjectivePeriod;

  @IsNumber()
  targetValue: number;

  @IsNumber()
  @IsOptional()
  minAcceptable?: number;

  @IsNumber()
  @IsOptional()
  maxAcceptable?: number;

  @IsEnum(KpiObjectiveStatus)
  @IsOptional()
  status?: KpiObjectiveStatus;
}

