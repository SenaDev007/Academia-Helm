import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { Student } from './entities/student.entity';
import { StudentsRepository } from './students.repository';
import { DatabaseModule } from '../database/database.module';
import { TenantsModule } from '../tenants/tenants.module'; // ✅ Import pour TenantValidationGuard
import { AuditLogsModule } from '../audit-logs/audit-logs.module'; // ✅ Import pour AuditLogInterceptor
import { UsersModule } from '../users/users.module'; // ✅ Import pour PermissionsGuard
import { ModulesModule } from '../modules/modules.module'; // ✅ Import pour ModuleAccessGuard
import { OrionModule } from '../orion/orion.module';
import { StudentsPrismaService } from './students-prisma.service';
import { StudentsPrismaController } from './students-prisma.controller';
import { GuardiansPrismaService } from './guardians-prisma.service';
import { GuardiansPrismaController } from './guardians-prisma.controller';
import { AttendancePrismaService } from './attendance-prisma.service';
import { AttendancePrismaController } from './attendance-prisma.controller';
import { DisciplinePrismaService } from './discipline-prisma.service';
import { DisciplinePrismaController } from './discipline-prisma.controller';
import { DocumentsPrismaService } from './documents-prisma.service';
import { DocumentsPrismaController, GeneratedDocumentsController } from './documents-prisma.controller';
import { TransfersPrismaService } from './transfers-prisma.service';
import { TransfersPrismaController } from './transfers-prisma.controller';
// Module 1 - Matricule Global & Cartes Scolaires
import { StudentIdentifierService } from './services/student-identifier.service';
import { StudentIdCardService } from './services/student-id-card.service';
import { StudentsOrionService } from './services/students-orion.service';
import { StudentIdentifierController } from './controllers/student-identifier.controller';
import { StudentIdCardController } from './controllers/student-id-card.controller';
import { StudentsOrionController } from './controllers/students-orion.controller';
// Module 1 - Vérification Publique & Dossier Scolaire
import { PublicVerificationService } from './services/public-verification.service';
import { StudentDossierService } from './services/student-dossier.service';
import { PublicVerificationController } from './controllers/public-verification.controller';
import { StudentDossierController } from './controllers/student-dossier.controller';
// Module 1 - Cycle de vie (pre-register, admit, re-enroll, transfer, change-class, history, export EDUCMASTER)
import { StudentsLifecycleService } from './services/students-lifecycle.service';
import { StudentsLifecycleController } from './controllers/students-lifecycle.controller';
import { EducmasterExcelExportService } from './services/educmaster-excel-export.service';
import { MatriculeService } from './services/matricule.service';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Student]),
    DatabaseModule, // Pour PrismaService
    TenantsModule, // ✅ Import pour que TenantValidationGuard puisse résoudre TenantRepository
    AuditLogsModule, // ✅ Import pour que AuditLogInterceptor puisse résoudre AuditLogRepository
    UsersModule, // ✅ Import pour que PermissionsGuard puisse résoudre UserRepository
    ModulesModule, // ✅ Import pour que ModuleAccessGuard puisse résoudre ModulesService
    OrionModule, // Pour intégration ORION sur le cycle de vie élèves
    FinanceModule, // Comptes élèves : création auto StudentAccount à l'admission/réinscription
  ],
  controllers: [
    StudentsController,
    StudentsLifecycleController,
    StudentsPrismaController,
    GuardiansPrismaController,
    AttendancePrismaController,
    DisciplinePrismaController,
    DocumentsPrismaController,
    GeneratedDocumentsController,
    TransfersPrismaController,
    // Module 1 - Matricule Global & Cartes Scolaires
    StudentIdentifierController,
    StudentIdCardController,
    StudentsOrionController,
    // Module 1 - Vérification Publique & Dossier Scolaire
    PublicVerificationController,
    StudentDossierController,
  ],
  providers: [
    StudentsService,
    StudentsRepository,
    StudentsPrismaService,
    GuardiansPrismaService,
    AttendancePrismaService,
    DisciplinePrismaService,
    DocumentsPrismaService,
    TransfersPrismaService,
    // Module 1 - Matricule Global & Cartes Scolaires
    StudentIdentifierService,
    StudentIdCardService,
    StudentsOrionService,
    // Module 1 - Vérification Publique & Dossier Scolaire
    PublicVerificationService,
    StudentDossierService,
    StudentsLifecycleService,
    EducmasterExcelExportService,
    MatriculeService,
  ],
  exports: [
    StudentsService,
    StudentsPrismaService,
    GuardiansPrismaService,
    AttendancePrismaService,
    DisciplinePrismaService,
    DocumentsPrismaService,
    TransfersPrismaService,
    // Module 1 - Matricule Global & Cartes Scolaires
    StudentIdentifierService,
    StudentIdCardService,
    StudentsOrionService,
    // Module 1 - Vérification Publique & Dossier Scolaire
    PublicVerificationService,
    StudentDossierService,
    StudentsLifecycleService,
    EducmasterExcelExportService,
    MatriculeService,
  ],
})
export class StudentsModule {}

