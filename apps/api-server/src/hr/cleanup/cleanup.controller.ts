/**
 * ============================================================================
 * CLEANUP CONTROLLER — Endpoint temporaire pour nettoyer les données RH
 * ============================================================================
 *
 * Endpoint @Public temporaire pour supprimer toutes les données de recrutement
 * d'un tenant : candidatures, entretiens, résultats de test, embauches (staff
 * + contrats créés à partir de candidatures).
 *
 * À SUPPRIMER APRÈS USAGE.
 *
 * Usage :
 *   POST /api/hr/cleanup-recruitment?tenantId=...&confirm=DELETE
 *
 * Effet :
 *   1. Supprime toutes les HrInterview du tenant
 *   2. Supprime tous les HrTestResult du tenant
 *   3. Supprime tous les HrApplication du tenant
 *   4. Pour chaque HrCandidate qui a été embauché (lié à un Staff) :
 *      - Supprime le Contract associé au Staff
 *      - Supprime le Staff
 *   5. Supprime tous les HrCandidate du tenant
 *   6. (Optionnel) Supprime aussi les HrAiReport liés
 *
 * Sécurité :
 *   - Requiert ?confirm=DELETE dans l'URL (évite les suppressions accidentelles)
 *   - @Public mais le tenantId filtre les données
 * ============================================================================
 */

import {
  Controller,
  Post,
  Query,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';

@Controller('hr/cleanup')
export class CleanupController {
  private readonly logger = new Logger(CleanupController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Post('recruitment')
  async cleanupRecruitment(
    @Query('tenantId') tenantId: string,
    @Query('confirm') confirm: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('tenantId est requis');
    }
    if (confirm !== 'DELETE') {
      throw new BadRequestException(
        'Confirmation requise : ajoutez ?confirm=DELETE dans l\'URL',
      );
    }

    this.logger.log(`🧹 Cleanup recruitment data for tenant ${tenantId}`);

    const stats = {
      interviews: 0,
      testResults: 0,
      applications: 0,
      contracts: 0,
      staff: 0,
      candidates: 0,
      aiReports: 0,
      candidateDocuments: 0,
    };

    // 1. Récupérer tous les candidats du tenant (pour avoir leurs IDs)
    const candidates = await this.prisma.hrCandidate.findMany({
      where: { tenantId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const candidateIds = candidates.map((c) => c.id);
    this.logger.log(`Found ${candidateIds.length} candidates to clean`);

    // 2. Supprimer les HrInterview du tenant
    const deletedInterviews = await this.prisma.hrInterview.deleteMany({
      where: { tenantId },
    });
    stats.interviews = deletedInterviews.count;
    this.logger.log(`Deleted ${stats.interviews} interviews`);

    // 3. Supprimer les HrTestResult liés aux candidats du tenant
    // (HrTestResult n'a pas de tenantId direct, on filtre par candidateId)
    if (candidateIds.length > 0) {
      const deletedTestResults = await this.prisma.hrTestResult.deleteMany({
        where: { candidateId: { in: candidateIds } },
      });
      stats.testResults = deletedTestResults.count;
      this.logger.log(`Deleted ${stats.testResults} test results`);
    }

    // 4. Supprimer les HrAiReport liés aux candidats
    if (candidateIds.length > 0) {
      try {
        const deletedAiReports = await this.prisma.hrAiReport.deleteMany({
          where: { candidateId: { in: candidateIds } },
        });
        stats.aiReports = deletedAiReports.count;
        this.logger.log(`Deleted ${stats.aiReports} AI reports`);
      } catch (err: any) {
        this.logger.warn(`Failed to delete AI reports: ${err.message}`);
      }
    }

    // 5. Supprimer les HrApplication du tenant
    const deletedApplications = await this.prisma.hrApplication.deleteMany({
      where: { tenantId },
    });
    stats.applications = deletedApplications.count;
    this.logger.log(`Deleted ${stats.applications} applications`);

    // 6. Supprimer les CandidateDocument liés aux candidats
    if (candidateIds.length > 0) {
      try {
        const deletedDocs = await this.prisma.candidateDocument.deleteMany({
          where: { candidateId: { in: candidateIds } },
        });
        stats.candidateDocuments = deletedDocs.count;
        this.logger.log(`Deleted ${stats.candidateDocuments} candidate documents`);
      } catch (err: any) {
        this.logger.warn(`Failed to delete candidate documents: ${err.message}`);
      }
    }

    // 7. Récupérer les Staff qui ont été créés à partir de candidats embauchés
    // (on cherche les Staff dont l'email correspond à un HrCandidate du tenant)
    const candidateEmails = candidates.map((c) => c.email).filter(Boolean);
    let staffToDelete: string[] = [];
    if (candidateEmails.length > 0) {
      const staffs = await this.prisma.staff.findMany({
        where: {
          tenantId,
          email: { in: candidateEmails },
        },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      staffToDelete = staffs.map((s) => s.id);
      this.logger.log(
        `Found ${staffToDelete.length} staff to delete (hired from candidates): ` +
          staffs.map((s) => `${s.firstName} ${s.lastName} (${s.email})`).join(', '),
      );
    }

    // 8. Supprimer les Contracts liés à ces Staff
    if (staffToDelete.length > 0) {
      const deletedContracts = await this.prisma.contract.deleteMany({
        where: { staffId: { in: staffToDelete } },
      });
      stats.contracts = deletedContracts.count;
      this.logger.log(`Deleted ${stats.contracts} contracts`);

      // 9. Supprimer les Staff
      const deletedStaff = await this.prisma.staff.deleteMany({
        where: { id: { in: staffToDelete } },
      });
      stats.staff = deletedStaff.count;
      this.logger.log(`Deleted ${stats.staff} staff records`);
    }

    // 10. Supprimer les HrCandidate du tenant
    const deletedCandidates = await this.prisma.hrCandidate.deleteMany({
      where: { tenantId },
    });
    stats.candidates = deletedCandidates.count;
    this.logger.log(`Deleted ${stats.candidates} candidates`);

    this.logger.log(`✅ Cleanup complete for tenant ${tenantId}`, stats);

    return {
      success: true,
      message: 'Données de recrutement supprimées avec succès',
      tenantId,
      stats,
    };
  }
}
