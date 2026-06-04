import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamsService } from './exams.service';
import { Exam } from './entities/exam.entity';
import { ExamsRepository } from './exams.repository';
import { AcademicTracksModule } from '../academic-tracks/academic-tracks.module';

/**
 * ExamsModule (TypeORM) — contrôleur retiré car ExamsPrismaController (ExamsGradesModule)
 * gère désormais les routes /api/exams. Le service est conservé car importé par GradesModule.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Exam]),
    AcademicTracksModule,
  ],
  controllers: [], // ExamsController retiré — conflit avec ExamsPrismaController
  providers: [ExamsService, ExamsRepository],
  exports: [ExamsService],
})
export class ExamsModule {}

