import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// SubjectsController REMOVED — route conflict with PedagogyModule's SubjectsPrismaController
// which uses Prisma (current) instead of TypeORM (legacy). The /subjects routes are now
// handled exclusively by SubjectsPrismaController in the PedagogyModule.
import { SubjectsService } from './subjects.service';
import { Subject } from './entities/subject.entity';
import { SubjectsRepository } from './subjects.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Subject])],
  controllers: [], // No controller — routes handled by PedagogyModule's SubjectsPrismaController
  providers: [SubjectsService, SubjectsRepository],
  exports: [SubjectsService],
})
export class SubjectsModule {}

