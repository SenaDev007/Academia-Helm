import { Module } from '@nestjs/common';
import { BilingualStructureService } from './bilingual-structure.service';

@Module({
  providers: [BilingualStructureService],
  exports: [BilingualStructureService],
})
export class BilingualStructureModule {}
