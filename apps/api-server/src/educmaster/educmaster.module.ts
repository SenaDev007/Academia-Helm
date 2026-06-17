import { Module } from '@nestjs/common';
import { EducMasterController } from './educmaster.controller';
import { EducMasterService } from './educmaster.service';
// PrismaService retiré — fourni globalement par DatabaseModule (@Global)

@Module({
  controllers: [EducMasterController],
  providers: [EducMasterService],
  exports: [EducMasterService],
})
export class EducMasterModule {}
