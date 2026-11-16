/**
 * ============================================================================
 * BULK SETUP CONTROLLER — Génération en masse matricule + compte + QR + dossier
 * ============================================================================
 *
 * POST /students/bulk-setup
 * Pour tous les élèves SANS matricule d'un tenant/année scolaire :
 *   1. Génère le matricule LOCAL (MatriculeService) → student.matricule
 *   2. Génère le matricule GLOBAL + StudentIdentifier (QR code vérification)
 *   3. Crée le StudentAccount (compte financier)
 *   4. Passe l'enrollment à ADMITTED
 *   5. Initialise le dossier scolaire (StudentDossier) si non existant
 */

import { Controller, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PrismaService } from '../../database/prisma.service';
import { MatriculeService } from '../services/matricule.service';
import { StudentIdentifierService } from '../services/student-identifier.service';
import { StudentAccountService } from '../../finance/student-account.service';

@Controller('students/bulk-setup')
@UseGuards(RolesGuard)
// ⭐ 1.0.14 (demande promoteur) — SECRETAIRE/SECRETAIRE_COMPTABLE/SECRETARY
//    ajoutés : le bouton « rattrapage matricules + comptes » de l'onglet
//    Listes de classes (module Élèves) retournait 403 à la secrétaire.
@Roles('PROMOTER', 'PROMOTEUR', 'director', 'admin', 'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'PLATFORM_ADMIN', 'SECRETAIRE', 'SECRETAIRE_COMPTABLE', 'SECRETARY')
export class BulkSetupController {
  private readonly logger = new Logger(BulkSetupController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matriculeService: MatriculeService,
    private readonly studentIdentifierService: StudentIdentifierService,
    private readonly studentAccountService: StudentAccountService,
  ) {}

  @Post()
  async bulkSetup(
    @GetTenant() tenant: any,
    @Body() body: { academicYearId: string; schoolLevelId?: string },
    @CurrentUser() user: any,
  ) {
    const tenantId = tenant.id;
    const { academicYearId } = body;
    this.logger.log(`Bulk setup: tenant=${tenantId}, year=${academicYearId}`);

    // Trouver tous les élèves SANS matricule local pour cette année
    const where: any = {
      tenantId,
      academicYearId,
      status: 'ACTIVE',
      OR: [
        { matricule: null },
        { matricule: '' },
      ],
    };
    if (body.schoolLevelId) {
      where.schoolLevelId = body.schoolLevelId;
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        studentEnrollments: {
          where: { academicYearId },
          take: 1,
        },
      },
    });

    this.logger.log(`Found ${students.length} students without matricule`);

    let localMatriculeSuccess = 0;
    let globalMatriculeSuccess = 0;
    let accountSuccess = 0;
    let enrollmentUpdated = 0;
    const errors: string[] = [];

    for (const student of students) {
      const studentName = `${student.firstName} ${student.lastName}`;

      // 1. Générer le matricule LOCAL (format: CODE-E-YY-XXXXX)
      try {
        const { matricule, enrollmentYear } = await this.matriculeService.generate(
          tenantId,
          academicYearId,
        );
        await this.prisma.student.update({
          where: { id: student.id },
          data: {
            matricule,
            enrollmentYear,
            studentCode: matricule,
          },
        });
        localMatriculeSuccess++;
      } catch (e: any) {
        errors.push(`Matricule local ${studentName}: ${e.message}`);
      }

      // 2. Générer le matricule GLOBAL + StudentIdentifier (QR code vérification)
      try {
        await this.studentIdentifierService.generateGlobalMatricule(
          tenantId,
          student.id,
          'BJ',
          user?.id,
        );
        globalMatriculeSuccess++;
      } catch (e: any) {
        // Peut échouer si déjà généré — non bloquant
        if (!e.message?.includes('already has a global matricule')) {
          errors.push(`Matricule global ${studentName}: ${e.message}`);
        }
      }

      // 3. Créer le StudentAccount (compte financier)
      try {
        await this.studentAccountService.getOrCreate(tenantId, student.id, academicYearId);
        accountSuccess++;
      } catch (e: any) {
        errors.push(`Account ${studentName}: ${e.message}`);
      }

      // 4. Passer l'enrollment à ADMITTED
      try {
        await this.prisma.studentEnrollment.updateMany({
          where: { studentId: student.id, academicYearId },
          data: { status: 'ADMITTED' },
        });
        enrollmentUpdated++;
      } catch (e: any) {
        // Non bloquant
      }

      // 5. Le dossier scolaire est une vue agrégée (pas de table dédiée)
      // — il se construit automatiquement quand on consulte l'élève.
      // Pas besoin de l'initialiser ici.
    }

    const failed = students.length - localMatriculeSuccess;
    this.logger.log(
      `Bulk setup done: local(${localMatriculeSuccess}/${students.length}), global(${globalMatriculeSuccess}), ` +
      `account(${accountSuccess}), enrollment(${enrollmentUpdated})`
    );

    return {
      total: students.length,
      matriculeGenerated: localMatriculeSuccess,
      globalMatriculeGenerated: globalMatriculeSuccess,
      matriculeFailed: failed,
      accountsCreated: accountSuccess,
      accountsFailed: students.length - accountSuccess,
      enrollmentsUpdated: enrollmentUpdated,
      errors: errors.slice(0, 20),
    };
  }
}
