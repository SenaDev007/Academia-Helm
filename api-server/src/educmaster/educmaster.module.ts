import { Module } from '@nestjs/common';
import { EducMasterController } from './educmaster.controller';
import { EducMasterService } from './educmaster.service';
import { PrismaService } from '../database/prisma.service';

@Module({
  controllers: [EducMasterController],
  providers: [EducMasterService, PrismaService],
  exports: [EducMasterService],
})
export class EducMasterModule {}
