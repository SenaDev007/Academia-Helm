import { Module } from '@nestjs/common';
import { QhsController } from './qhs.controller';
import { QhsService } from './qhs.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [QhsController],
  providers: [QhsService],
  exports: [QhsService],
})
export class QhsModule {}

