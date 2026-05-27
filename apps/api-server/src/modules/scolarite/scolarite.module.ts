/**
 * ============================================================================
 * SCOLARITE MODULE - MODULE SCOLARITÉ
 * ============================================================================
 * 
 * Module pour les opérations de scolarité avec :
 * - Endpoints séparés par module
 * - Services de calcul par niveau
 * - Isolation stricte par tenant + school_level
 * 
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../../students/entities/student.entity';
import { Class } from '../../classes/entities/class.entity';
import { Absence } from '../../absences/entities/absence.entity';
import { ScolariteCalculationService } from './services/scolarite-calculation.service';
import { ScolariteController } from './scolarite.controller';
import { CalculationService } from '../../common/services/calculation.service';
import { StudentsModule } from '../../students/students.module';
import { ClassesModule } from '../../classes/classes.module';
import { AbsencesModule } from '../../absences/absences.module';
import { UsersModule } from '../../users/users.module';
import { AuditLogsModule } from '../../audit-logs/audit-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Student, Class, Absence]),
    StudentsModule,
    ClassesModule,
    AbsencesModule,
    UsersModule,
    AuditLogsModule,
  ],
  controllers: [ScolariteController],
  providers: [
    ScolariteCalculationService,
    CalculationService,
  ],
  exports: [ScolariteCalculationService],
})
export class ScolariteModule {}

