import { IsString, IsNumber, IsBoolean, IsObject, IsOptional, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class SalaryStructureDto {
  baseSalary: {
    min: number;
    max: number;
    currency: string;
  };
  scales: {
    category: string;
    min: number;
    max: number;
    steps: number;
  }[];
}

class SocialContributionsDto {
  employeeRate: number;
  employerRate: number;
  contributions: {
    name: string;
    employeeRate: number;
    employerRate: number;
    description: string;
  }[];
}

class LeaveRulesDto {
  annualLeave: {
    daysPerYear: number;
    accrualRate: number;
    maxAccumulation: number;
  };
  sickLeave: {
    daysPerYear: number;
    requiresMedicalCertificate: boolean;
  };
  maternityLeave: {
    days: number;
    paidPercentage: number;
  };
  paternityLeave: {
    days: number;
    paidPercentage: number;
  };
}

class BonusesDto {
  types: {
    name: string;
    calculationMethod: 'fixed' | 'percentage' | 'custom';
    value: number;
    conditions: string[];
  }[];
}

class TaxRulesDto {
  taxBrackets: {
    min: number;
    max: number;
    rate: number;
  }[];
  exemptions: {
    type: string;
    amount: number;
    description: string;
  }[];
}

export class CreateSalaryPolicyDto {
  @IsUUID()
  countryId: string;

  @IsString()
  name: string;

  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  salaryStructure: SalaryStructureDto;

  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  socialContributions: SocialContributionsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  leaveRules?: LeaveRulesDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  bonuses?: BonusesDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  taxRules?: TaxRulesDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

