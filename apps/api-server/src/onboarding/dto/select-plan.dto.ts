import { IsString, IsEnum } from 'class-validator';

export class SelectPlanDto {
  @IsString()
  planId: string;

  @IsEnum(['MONTHLY', 'YEARLY'])
  periodType: 'MONTHLY' | 'YEARLY';
}
