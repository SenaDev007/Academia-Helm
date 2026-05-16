import { PartialType } from '@nestjs/mapped-types';
import { CreateAdmissionDto } from './create-admission.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AdmissionStatus } from '@prisma/client';

export class UpdateAdmissionDto extends PartialType(CreateAdmissionDto) {
  @IsOptional()
  @IsEnum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MISSING_DOCUMENTS', 'INTERVIEW_REQUIRED', 'TEST_REQUIRED', 'ACCEPTED', 'REJECTED', 'WAITLISTED', 'CONVERTED', 'CANCELLED'])
  status?: AdmissionStatus;

  @IsOptional()
  @IsString()
  reviewComment?: string;

  @IsOptional()
  @IsString()
  decisionComment?: string;
}
