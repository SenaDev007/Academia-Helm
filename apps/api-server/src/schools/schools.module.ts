import { Module } from '@nestjs/common';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { SchoolsRepository } from './schools.repository';

@Module({
  imports: [],
  controllers: [SchoolsController],
  providers: [SchoolsService, SchoolsRepository],
  exports: [SchoolsService],
})
export class SchoolsModule {}

