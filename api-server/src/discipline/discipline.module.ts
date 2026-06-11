import { Module } from '@nestjs/common';
import { DisciplineController } from './discipline.controller';
import { DisciplineService } from './discipline.service';
import { DisciplineRepository } from './discipline.repository';

@Module({
  imports: [],
  controllers: [DisciplineController],
  providers: [DisciplineService, DisciplineRepository],
  exports: [DisciplineService],
})
export class DisciplineModule {}

