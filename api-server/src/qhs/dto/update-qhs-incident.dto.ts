import { PartialType } from '@nestjs/mapped-types';
import { CreateQhsIncidentDto } from './create-qhs-incident.dto';
import { IsString, IsOptional } from 'class-validator';

export class UpdateQhsIncidentDto extends PartialType(CreateQhsIncidentDto) {
  @IsString()
  @IsOptional()
  validatedById?: string;
}

