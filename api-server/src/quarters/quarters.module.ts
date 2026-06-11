import { Module } from '@nestjs/common';
import { QuartersController } from './quarters.controller';
import { QuartersService } from './quarters.service';
import { QuartersRepository } from './quarters.repository';

@Module({
  imports: [],
  controllers: [QuartersController],
  providers: [QuartersService, QuartersRepository],
  exports: [QuartersService],
})
export class QuartersModule {}

