import { Module } from '@nestjs/common';
import { AbsencesController } from './absences.controller';
import { AbsencesService } from './absences.service';
import { AbsencesRepository } from './absences.repository';

@Module({
  imports: [],
  controllers: [AbsencesController],
  providers: [AbsencesService, AbsencesRepository],
  exports: [AbsencesService],
})
export class AbsencesModule {}

