import { PartialType } from '@nestjs/mapped-types';
import { CreateLessonPlanDto } from './create-lesson-plan.dto';

export class UpdateLessonPlanDto extends PartialType(CreateLessonPlanDto) {}
