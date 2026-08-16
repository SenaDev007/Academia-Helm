import { Module } from '@nestjs/common';
import { DisciplineController } from './discipline.controller';
import { DisciplineService } from './discipline.service';
import { DisciplineRepository } from './discipline.repository';
import { ConductController } from './conduct/conduct.controller';
import { DisciplineNotificationService } from './services/discipline-notification.service';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [CommunicationModule],
  controllers: [DisciplineController, ConductController],
  providers: [DisciplineService, DisciplineRepository, DisciplineNotificationService],
  exports: [DisciplineService, DisciplineNotificationService],
})
export class DisciplineModule {}

