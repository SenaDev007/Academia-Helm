/**
 * ============================================================================
 * PEDAGOGY MODULE - MODULE 2
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SubjectsPrismaService } from './subjects-prisma.service';
import { SubjectsPrismaController } from './subjects-prisma.controller';
import { TeachersPrismaService } from './teachers-prisma.service';
import { TeachersPrismaController } from './teachers-prisma.controller';
import { PedagogyPrismaService } from './pedagogy-prisma.service';
import { PedagogyPrismaController } from './pedagogy-prisma.controller';
import { TimetablesPrismaService } from './timetables-prisma.service';
import { TimetablesPrismaController } from './timetables-prisma.controller';
import { LessonPlansPrismaService } from './lesson-plans-prisma.service';
import { LessonPlansPrismaController } from './lesson-plans-prisma.controller';
import { DailyLogsPrismaService } from './daily-logs-prisma.service';
import { DailyLogsPrismaController } from './daily-logs-prisma.controller';
import { ClassDiariesPrismaService } from './class-diaries-prisma.service';
import { ClassDiariesPrismaController } from './class-diaries-prisma.controller';
import { RoomsPrismaService } from './rooms-prisma.service';
import { RoomsPrismaController } from './rooms-prisma.controller';
import { AcademicStructurePrismaService } from './academic-structure-prisma.service';
import { AcademicStructurePrismaController } from './academic-structure-prisma.controller';
import { AcademicSeriesPrismaService } from './academic-series-prisma.service';
import { AcademicSeriesPrismaController } from './academic-series-prisma.controller';
import { TeacherAcademicProfilePrismaService } from './teacher-academic-profile-prisma.service';
import { TeacherAcademicProfilePrismaController } from './teacher-academic-profile-prisma.controller';
import { TeachingAssignmentPrismaService } from './teaching-assignment-prisma.service';
import { TeachingAssignmentPrismaController } from './teaching-assignment-prisma.controller';
// Module 2 - Matériel & Fournitures Pédagogiques
import { PedagogicalMaterialsPrismaService } from './pedagogical-materials-prisma.service';
import { PedagogicalMaterialsPrismaController } from './pedagogical-materials-prisma.controller';
import { MaterialMovementsPrismaService } from './material-movements-prisma.service';
import { MaterialMovementsPrismaController } from './material-movements-prisma.controller';
import { TeacherMaterialAssignmentsPrismaService } from './teacher-material-assignments-prisma.service';
import { TeacherMaterialAssignmentsPrismaController } from './teacher-material-assignments-prisma.controller';
import { MaterialStocksPrismaService } from './material-stocks-prisma.service';
import { MaterialStocksPrismaController } from './material-stocks-prisma.controller';
import { AnnualTeacherSuppliesPrismaService } from './annual-teacher-supplies-prisma.service';
import { AnnualTeacherSuppliesPrismaController } from './annual-teacher-supplies-prisma.controller';
// Module 2 - Système de Workflow Pédagogique
import { PedagogicalDocumentService } from './services/pedagogical-document.service';
import { PedagogicalWorkflowService } from './services/pedagogical-workflow.service';
import { PedagogicalNotificationService } from './services/pedagogical-notification.service';
import { WeeklySemainierService } from './services/weekly-semainier.service';
import { PedagogyOrionService } from './services/pedagogy-orion.service';
import { PedagogicalTeacherController } from './controllers/pedagogical-teacher.controller';
import { PedagogicalDirectorController } from './controllers/pedagogical-director.controller';
import { PedagogyOrionController } from './controllers/pedagogy-orion.controller';
import { PedagogyKpiService } from './pedagogy-kpi.service';
import { PedagogyControlController } from './pedagogy-control.controller';
import { OrionPedagogyAdvancedService } from './orion-pedagogy-advanced.service';
import { OrionPedagogyAdvancedController } from './orion-pedagogy-advanced.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [
    SubjectsPrismaController,
    TeachersPrismaController,
    PedagogyPrismaController,
    TimetablesPrismaController,
    LessonPlansPrismaController,
    DailyLogsPrismaController,
    ClassDiariesPrismaController,
    RoomsPrismaController,
    AcademicStructurePrismaController,
    AcademicSeriesPrismaController,
    TeacherAcademicProfilePrismaController,
    TeachingAssignmentPrismaController,
    // Module 2 - Matériel & Fournitures Pédagogiques
    PedagogicalMaterialsPrismaController,
    MaterialMovementsPrismaController,
    TeacherMaterialAssignmentsPrismaController,
    MaterialStocksPrismaController,
    AnnualTeacherSuppliesPrismaController,
    // Module 2 - Workflow Pédagogique
    PedagogicalTeacherController,
    PedagogicalDirectorController,
    PedagogyOrionController,
    PedagogyControlController,
    OrionPedagogyAdvancedController,
  ],
  providers: [
    SubjectsPrismaService,
    TeachersPrismaService,
    PedagogyPrismaService,
    TimetablesPrismaService,
    LessonPlansPrismaService,
    DailyLogsPrismaService,
    ClassDiariesPrismaService,
    RoomsPrismaService,
    AcademicStructurePrismaService,
    AcademicSeriesPrismaService,
    TeacherAcademicProfilePrismaService,
    TeachingAssignmentPrismaService,
    // Module 2 - Matériel & Fournitures Pédagogiques
    PedagogicalMaterialsPrismaService,
    MaterialMovementsPrismaService,
    TeacherMaterialAssignmentsPrismaService,
    MaterialStocksPrismaService,
    AnnualTeacherSuppliesPrismaService,
    // Module 2 - Workflow Pédagogique
    PedagogicalDocumentService,
    PedagogicalWorkflowService,
    PedagogicalNotificationService,
    WeeklySemainierService,
    PedagogyOrionService,
    PedagogyKpiService,
    OrionPedagogyAdvancedService,
  ],
  exports: [
    SubjectsPrismaService,
    TeachersPrismaService,
    PedagogyPrismaService,
    TimetablesPrismaService,
    LessonPlansPrismaService,
    DailyLogsPrismaService,
    ClassDiariesPrismaService,
    RoomsPrismaService,
    AcademicStructurePrismaService,
    AcademicSeriesPrismaService,
    TeacherAcademicProfilePrismaService,
    TeachingAssignmentPrismaService,
    // Module 2 - Matériel & Fournitures Pédagogiques
    PedagogicalMaterialsPrismaService,
    MaterialMovementsPrismaService,
    TeacherMaterialAssignmentsPrismaService,
    MaterialStocksPrismaService,
    AnnualTeacherSuppliesPrismaService,
    // Module 2 - Workflow Pédagogique
    PedagogicalDocumentService,
    PedagogicalWorkflowService,
    PedagogicalNotificationService,
    WeeklySemainierService,
    PedagogyOrionService,
    PedagogyKpiService,
    OrionPedagogyAdvancedService,
  ],
})
export class PedagogyModule {}

