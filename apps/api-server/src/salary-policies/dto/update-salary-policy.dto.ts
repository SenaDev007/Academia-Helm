import { PartialType } from '@nestjs/mapped-types';
import { CreateSalaryPolicyDto } from './create-salary-policy.dto';

export class UpdateSalaryPolicyDto extends PartialType(CreateSalaryPolicyDto) {}

