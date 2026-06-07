import { PartialType } from '@nestjs/mapped-types';
import { CreateAdmissionDto } from './create-admission.dto';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateAdmissionDto extends PartialType(CreateAdmissionDto) {
  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MISSING_DOCUMENTS', 'INTERVIEW_REQUIRED', 'TEST_REQUIRED', 'ACCEPTED', 'REJECTED', 'WAITLISTED', 'CONVERTED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  decisionBy?: string;
}
