import { PartialType } from '@nestjs/mapped-types';
import { CreateSchoolLevelDto } from './create-school-level.dto';

export class UpdateSchoolLevelDto extends PartialType(CreateSchoolLevelDto) {}

