import { PartialType } from '@nestjs/mapped-types';
import { CreateGradingPolicyDto } from './create-grading-policy.dto';

export class UpdateGradingPolicyDto extends PartialType(CreateGradingPolicyDto) {}

