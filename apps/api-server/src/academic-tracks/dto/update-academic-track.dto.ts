import { PartialType } from '@nestjs/mapped-types';
import { CreateAcademicTrackDto } from './create-academic-track.dto';

export class UpdateAcademicTrackDto extends PartialType(CreateAcademicTrackDto) {}

