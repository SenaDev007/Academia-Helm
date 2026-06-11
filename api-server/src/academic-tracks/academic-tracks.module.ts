import { Module } from '@nestjs/common';
import { AcademicTracksService } from './academic-tracks.service';
import { AcademicTracksController } from './academic-tracks.controller';
import { AcademicTracksRepository } from './academic-tracks.repository';

@Module({
  imports: [],
  controllers: [AcademicTracksController],
  providers: [AcademicTracksService, AcademicTracksRepository],
  exports: [AcademicTracksService, AcademicTracksRepository],
})
export class AcademicTracksModule {}

