import { Module } from '@nestjs/common';
import { AccessRequestsController } from './access-requests.controller';
import { AccessRequestsService } from './access-requests.service';
import { DatabaseModule } from '../database/database.module';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [DatabaseModule, CommunicationModule],
  controllers: [AccessRequestsController],
  providers: [AccessRequestsService],
  exports: [AccessRequestsService],
})
export class AccessRequestsModule {}
