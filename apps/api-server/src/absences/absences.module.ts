import { Module } from '@nestjs/common';
import { AbsencesController } from './absences.controller';
import { AbsencesService } from './absences.service';
import { AbsencesRepository } from './absences.repository';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [CommunicationModule], // ⭐ V3-4: Yeshua Connect notification bridge
  controllers: [AbsencesController],
  providers: [AbsencesService, AbsencesRepository],
  exports: [AbsencesService],
})
export class AbsencesModule {}
