import { Module } from '@nestjs/common';
import { DisciplineController } from './discipline.controller';
import { DisciplineService } from './discipline.service';
import { DisciplineRepository } from './discipline.repository';
import { ConductController } from './conduct/conduct.controller';

@Module({
  imports: [],
  controllers: [DisciplineController, ConductController],
  providers: [DisciplineService, DisciplineRepository],
  exports: [DisciplineService],
})
export class DisciplineModule {}

