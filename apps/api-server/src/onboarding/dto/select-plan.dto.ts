import { IsString, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';

export enum PeriodType {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export class SelectPlanDto {
  @IsString()
  planId: string;

  @IsEnum(PeriodType)
  periodType: PeriodType;

  /** ⭐ Effectif estimé (élèves) — fixé au moment du choix du plan (étape 3
   *    du wizard : planCode + effectif ensemble) ; persisté pour le contrat
   *    (Article 1), l'email et la signature différée. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  estimatedStudentCount?: number;
}
