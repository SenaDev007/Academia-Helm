import { Module } from '@nestjs/common';
import { KpiObjectivesController } from './kpi-objectives.controller';
import { KpiObjectivesService } from './kpi-objectives.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [KpiObjectivesController],
  providers: [KpiObjectivesService],
  exports: [KpiObjectivesService],
})
export class KpiObjectivesModule {}

