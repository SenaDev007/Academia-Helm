import { IsString, IsEnum } from 'class-validator';

export enum PeriodType {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export class SelectPlanDto {
  @IsString()
  planId: string;

  @IsEnum(PeriodType)
  periodType: PeriodType;
}
