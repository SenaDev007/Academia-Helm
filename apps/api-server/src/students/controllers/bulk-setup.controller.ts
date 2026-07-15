/**
 * ============================================================================
 * BULK SETUP CONTROLLER — Génération en masse matricule + compte + QR
 * ============================================================================
 *
 * POST /students/bulk-setup
 * Pour tous les élèves SANS matricule d'un tenant/année scolaire :
 *   1. Génère le matricule (MatriculeService)
 *   2. Crée le StudentAccount (compte financier)
 *   3. Génère le QR code (StudentIdentifier)
 *   4. Passe l'enrollment à ADMITTED
 *
 * Utilisé après un import en masse où les élèves n'ont pas ces éléments.
 */

import { Controller, Post, Body, Logger, UseGuards } from '@nestjs/common';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PrismaService } from '../../database/prisma.service';
import { MatriculeService } from '../services/matricule.service';
import { StudentAccountService } from '../../finance/student-account.service';

@Controller('students/bulk-setup')
@UseGuards(RolesGuard)
@Roles('PROMOTER', 'PROMOTEUR', 'director', 'admin', 'SUPER_DIRECTOR', 'PLATFORM_OWNER', 'PLATFORM_ADMIN')
export class BulkSetupController {
  private readonly logger = new Logger(BulkSetupController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matriculeService: MatriculeService,
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

    // Trouver tous les élèves SANS matricule pour cette année
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

    let matriculeSuccess = 0;
    let matriculeFail = 0;
    let accountSuccess = 0;
    let accountFail = 0;
    let enrollmentUpdated = 0;
    const errors: string[] = [];

    for (const student of students) {
      // 1. Générer le matricule
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
        matriculeSuccess++;
      } catch (e: any) {
        matriculeFail++;
        errors.push(`Matricule ${student.firstName} ${student.lastName}: ${e.message}`);
        // Continuer même si le matricule échoue (peut-être déjà généré par un autre processus)
      }

      // 2. Créer le StudentAccount (compte financier)
      try {
        await this.studentAccountService.getOrCreate(tenantId, student.id, academicYearId);
        accountSuccess++;
      } catch (e: any) {
        accountFail++;
        errors.push(`Account ${student.firstName} ${student.lastName}: ${e.message}`);
      }

      // 3. Passer l'enrollment à ADMITTED
      try {
        await this.prisma.studentEnrollment.updateMany({
          where: { studentId: student.id, academicYearId },
          data: { status: 'ADMITTED' },
        });
        enrollmentUpdated++;
      } catch (e: any) {
        // Non bloquant
      }
    }

    this.logger.log(`Bulk setup done: matricule(${matriculeSuccess}✅/${matriculeFail}❌), account(${accountSuccess}✅/${accountFail}❌), enrollment(${enrollmentUpdated} updated)`);

    return {
      total: students.length,
      matriculeGenerated: matriculeSuccess,
      matriculeFailed: matriculeFail,
      accountsCreated: accountSuccess,
      accountsFailed: accountFail,
      enrollmentsUpdated: enrollmentUpdated,
      errors: errors.slice(0, 20), // Limiter à 20 erreurs pour éviter une réponse trop grande
    };
  }
}
