/**
 * ============================================================================
 * GENERAL MODULE - MODULE GÉNÉRAL POUR AGRÉGATIONS CONTRÔLÉES
 * ============================================================================
 * 
 * RÈGLES DU MODULE GÉNÉRAL :
 * - Lecture seule
 * - Aucune écriture en base métier
 * - Aucune création ou modification de données
 * - Uniquement des agrégations issues des niveaux
 * 
 * Les données globales doivent toujours :
 * - Expliciter leur provenance (niveau par niveau)
 * - Être traçables
 * - Être reproductibles
 * 
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { GeneralService } from './general.service';
import { GeneralController } from './general.controller';
import { StudentsModule } from '../../students/students.module';
import { PaymentsModule } from '../../payments/payments.module';
import { ExpensesModule } from '../../expenses/expenses.module';
import { ExamsModule } from '../../exams/exams.module';
import { GradesModule } from '../../grades/grades.module';
import { AbsencesModule } from '../../absences/absences.module';
import { SchoolLevelsModule } from '../../school-levels/school-levels.module';
import { AuditLogsModule } from '../../audit-logs/audit-logs.module';

@Module({
  imports: [
    StudentsModule,
    PaymentsModule,
    ExpensesModule,
    ExamsModule,
    GradesModule,
    AbsencesModule,
    SchoolLevelsModule,
    AuditLogsModule,
  ],
  controllers: [GeneralController],
  providers: [GeneralService],
  exports: [GeneralService],
})
export class GeneralModule {}

