import { Module } from '@nestjs/common';
import { TimetableEngineController } from './timetable-engine.controller';
import { TimetableEngineService } from './timetable-engine.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TimetableEngineController],
  providers: [TimetableEngineService],
  exports: [TimetableEngineService],
})
export class TimetableEngineModule {}
