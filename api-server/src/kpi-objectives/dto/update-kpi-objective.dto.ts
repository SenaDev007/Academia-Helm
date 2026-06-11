import { PartialType } from '@nestjs/mapped-types';
import { CreateKpiObjectiveDto } from './create-kpi-objective.dto';

export class UpdateKpiObjectiveDto extends PartialType(CreateKpiObjectiveDto) {}

