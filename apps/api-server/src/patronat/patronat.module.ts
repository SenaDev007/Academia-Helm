import { Module } from '@nestjs/common';
import { PatronatController } from './patronat.controller';
import { PatronatService } from './patronat.service';
import { PrismaService } from '../database/prisma.service';

@Module({
  controllers: [PatronatController],
  providers: [PatronatService, PrismaService],
  exports: [PatronatService],
})
export class PatronatModule {}
