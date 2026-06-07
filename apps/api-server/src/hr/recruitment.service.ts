import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { OpenRouterService } from '../common/services/openrouter.service';
import { ContractsPrismaService } from './contracts-prisma.service';
import { StaffMatriculeService } from './staff-matricule.service';
import { prismaCreateDefaults, prismaUpdateDefaults, prismaCreateNoCreatedAt, prismaCreateNoUpdatedAt, uuid } from '../common/utils/prisma-helpers';
import { Prisma } from '@prisma/client';

/**
 * Valid status transitions for the recruitment pipeline.
 * A candidate must pass through at least ENTRETIEN or TEST before being hired.
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  'NOUVEAU':     ['EN_COURS', 'REJETÉ'],
  'EN_COURS':    ['ENTRETIEN', 'TEST', 'REJETÉ'],
  'ENTRETIEN':   ['TEST', 'EMBAUCHÉ', 'REJETÉ'],
  'TEST':        ['EMBAUCHÉ', 'REJETÉ'],
  'EMBAUCHÉ':    [],   // Terminal state
  'REJETÉ':      [],   // Terminal state
};

@Injectable()
export class RecruitmentPrismaService {
  private readonly logger = new Logger(RecruitmentPrismaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly contractsService: ContractsPrismaService,
    private readonly matriculeService: StaffMatriculeService,
    private readonly openRouter: OpenRouterService,
  ) {}

  // Job Offers CRUD
  async getJobs(tenantId: string) {
    return this.prisma.hrJob.findMany({
      where: { tenantId },
      include: { _count: { select: { applications: { where: { tenantId } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get application statistics for a specific job offer (public endpoint).
   * Returns: total applicants, breakdown by country, breakdown by city.
   */
  async getJobStats(jobId: string, tenantId?: string) {
    // Get all applications for this job with candidate info, filtered by tenant if provided
    const whereClause: any = { jobId };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }
    const applications = await this.prisma.hrApplication.findMany({
      where: whereClause,
      include: {
        candidate: {
          select: { country: true, city: true },
        },
      },
    });

    const totalApplicants = applications.length;

    // Aggregate by country
    const byCountry: Record<string, number> = {};
    for (const app of applications) {
      const country = app.candidate?.country || 'Non spécifié';
      byCountry[country] = (byCountry[country] || 0) + 1;
    }

    // Aggregate by city
    const byCity: Record<string, number> = {};
    for (const app of applications) {
      const city = app.candidate?.city || 'Non spécifié';
      byCity[city] = (byCity[city] || 0) + 1;
    }

    // Sort by count descending and convert to arrays
    const countries = Object.entries(byCountry)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const cities = Object.entries(byCity)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      jobId,
      totalApplicants,
      countries,
      cities,
    };
  }

  /**
   * Generate a sequential job reference number for a tenant.
   * Format: OFF-<TENANT_CODE>-<XXXXX> (3-char tenant code + 5-digit zero-padded sequence)
   * Example: OFF-CSP-00001, OFF-DEF-00002
   */
  private async generateJobRef(tenantId: string): Promise<string> {
    // Get tenant slug prefix (3 chars, uppercase)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    const prefix = (tenant?.slug || 'AH').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'AH';

    const seq = await this.prisma.jobNumberSequence.upsert({
      where: { tenantId },
      create: { ...prismaCreateNoCreatedAt(), tenantId, current: 1 },
      update: { current: { increment: 1 } },
    });
    const padded = String(seq.current).padStart(5, '0');
    return `OFF-${prefix}-${padded}`;
  }

  async createJob(tenantId: string, data: any) {
    // Generate sequential ref if not provided
    const ref = data.ref || await this.generateJobRef(tenantId);
    return this.prisma.hrJob.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        ref,
        title: data.title,
        dept: data.dept,
        loc: data.loc,
        status: data.status || 'BROUILLON', // PUBLIÉE, FERMÉE, ARCHIVÉE
        description: data.description,
        missions: data.missions,
        responsibilities: data.responsibilities,
        academicLevel: data.academicLevel,
        experience: data.experience,
        skillsRequired: data.skillsRequired,
        salary: data.salary,
        contractType: data.contractType,
      },
    });
  }

  async updateJob(id: string, data: any) {
    return this.prisma.hrJob.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.dept !== undefined && { dept: data.dept }),
        ...(data.loc !== undefined && { loc: data.loc }),
        ...(data.ref !== undefined && { ref: data.ref }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.missions !== undefined && { missions: data.missions }),
        ...(data.responsibilities !== undefined && { responsibilities: data.responsibilities }),
        ...(data.academicLevel !== undefined && { academicLevel: data.academicLevel }),
        ...(data.experience !== undefined && { experience: data.experience }),
        ...(data.skillsRequired !== undefined && { skillsRequired: data.skillsRequired }),
        ...(data.salary !== undefined && { salary: data.salary }),
        ...(data.contractType !== undefined && { contractType: data.contractType }),
      },
    });
  }

  async deleteJob(id: string) {
    // 1. Collect candidate documents from all applications of this job (for R2 cleanup)
    let documents: Array<{ id: string; filePath: string; fileName: string }> = [];
    try {
      const applications = await this.prisma.hrApplication.findMany({
        where: { jobId: id },
        select: { candidateId: true },
      });
      if (applications.length > 0) {
        const candidateIds = applications.map((a) => a.candidateId).filter(Boolean);
        if (candidateIds.length > 0) {
          documents = await this.prisma.candidateDocument.findMany({
            where: { candidateId: { in: candidateIds } },
            select: { id: true, filePath: true, fileName: true },
          });
        }
      }
    } catch (err) {
      this.logger.warn(`Could not fetch candidate documents for job deletion cleanup: ${err.message}`);
    }

    // 2. Delete DB records in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Get all applications for this job
      const applications = await tx.hrApplication.findMany({
        where: { jobId: id },
        select: { id: true },
      });

      // Delete AI reports linked to those applications
      if (applications.length > 0) {
        await tx.hrAiReport.deleteMany({
          where: { applicationId: { in: applications.map((a) => a.id) } },
        });
      }

      // Delete the applications themselves
      await tx.hrApplication.deleteMany({ where: { jobId: id } });

      // Finally, delete the job
      await tx.hrJob.delete({ where: { id } });
    });

    // 3. Clean up files from storage (best-effort, after DB deletion)
    if (documents.length > 0) {
      for (const doc of documents) {
        try {
          await this.storageService.deleteFile(doc.filePath);
          this.logger.log(`Deleted file from storage: ${doc.filePath}`);
        } catch (err) {
          this.logger.warn(`Failed to delete file from storage: ${doc.filePath} — ${err.message}`);
        }
      }
    }

    return { success: true, deletedDocuments: documents.length };
  }

  // Candidates CRUD
  async getCandidates(tenantId: string) {
    return this.prisma.hrCandidate.findMany({
      where: { tenantId },
      include: {
        applications: {
          include: {
            job: {
              select: { id: true, title: true, ref: true, status: true },
            },
          },
        },
        interviews: true,
        academicProfile: true,
        academicScores: true,
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCandidate(tenantId: string, data: any) {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.hrCandidate.create({
        data: {
          ...prismaCreateDefaults(),
          tenantId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          address: data.address,
          country: data.country || null,
          city: data.city || null,
          gender: data.gender,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        },
      });

      // Auto-create an HrApplication if jobId is provided
      // This ensures the candidate has a trackable application status
      if (data.jobId) {
        await tx.hrApplication.create({
          data: {
            ...prismaCreateDefaults(),
            tenantId,
            candidateId: candidate.id,
            jobId: data.jobId,
            status: data.status || 'NOUVEAU',
          },
        });
      }

      return candidate;
    });
  }

  async updateCandidate(id: string, data: any) {
    return this.prisma.hrCandidate.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      },
    });
  }

  async deleteCandidate(id: string) {
    // 1. Fetch candidate's documents first (to delete files from storage later)
    let documents: Array<{ id: string; filePath: string; fileName: string }> = [];
    try {
      documents = await this.prisma.candidateDocument.findMany({
        where: { candidateId: id },
        select: { id: true, filePath: true, fileName: true },
      });
    } catch (err) {
      this.logger.warn(`Could not fetch candidate documents for cleanup: ${err.message}`);
    }

    // 2. Verify the candidate exists
    const candidate = await this.prisma.hrCandidate.findUnique({ where: { id } });
    if (!candidate) {
      throw new NotFoundException(`Candidat avec l'ID ${id} non trouvé`);
    }

    // 3. Delete related records one by one (resilient to missing tables)
    // We do NOT use a transaction because if any table is missing,
    // the whole transaction fails. Instead, we delete each relation
    // independently and catch errors gracefully.

    // Get applications for AI report deletion
    let applications: Array<{ id: string }> = [];
    try {
      applications = await this.prisma.hrApplication.findMany({
        where: { candidateId: id },
        select: { id: true },
      });
    } catch (err) {
      this.logger.warn(`Could not fetch applications for candidate ${id}: ${err.message}`);
    }

    // Delete AI reports by application
    if (applications.length > 0) {
      try {
        await this.prisma.hrAiReport.deleteMany({
          where: { applicationId: { in: applications.map((a) => a.id) } },
        });
      } catch (err) {
        this.logger.warn(`Could not delete AI reports by application: ${err.message}`);
      }
    }

    // Delete AI reports by candidate
    try {
      await this.prisma.hrAiReport.deleteMany({ where: { candidateId: id } });
    } catch (err) {
      this.logger.warn(`Could not delete AI reports by candidate: ${err.message}`);
    }

    // Delete test results
    try {
      await this.prisma.hrTestResult.deleteMany({ where: { candidateId: id } });
    } catch (err) {
      this.logger.warn(`Could not delete test results: ${err.message}`);
    }

    // Delete interviews
    try {
      await this.prisma.hrInterview.deleteMany({ where: { candidateId: id } });
    } catch (err) {
      this.logger.warn(`Could not delete interviews: ${err.message}`);
    }

    // Delete talent pool entry
    try {
      await this.prisma.hrTalentPool.deleteMany({ where: { candidateId: id } });
    } catch (err) {
      this.logger.warn(`Could not delete talent pool entry: ${err.message}`);
    }

    // Delete academic profile
    try {
      await this.prisma.academicProfile.deleteMany({ where: { candidateId: id } });
    } catch (err) {
      this.logger.warn(`Could not delete academic profile: ${err.message}`);
    }

    // Delete candidate documents (DB records)
    try {
      await this.prisma.candidateDocument.deleteMany({ where: { candidateId: id } });
    } catch (err) {
      this.logger.warn(`Could not delete candidate documents: ${err.message}`);
    }

    // Delete teaching certifications
    try {
      await this.prisma.teachingCertification.deleteMany({ where: { candidateId: id } });
    } catch (err) {
      this.logger.warn(`Could not delete teaching certifications: ${err.message}`);
    }

    // Delete academic scores
    try {
      await this.prisma.academicScore.deleteMany({ where: { candidateId: id } });
    } catch (err) {
      this.logger.warn(`Could not delete academic scores: ${err.message}`);
    }

    // Delete applications
    try {
      await this.prisma.hrApplication.deleteMany({ where: { candidateId: id } });
    } catch (err) {
      this.logger.warn(`Could not delete applications: ${err.message}`);
    }

    // 4. Finally, delete the candidate itself
    try {
      await this.prisma.hrCandidate.delete({ where: { id } });
    } catch (err) {
      this.logger.error(`Failed to delete candidate ${id}: ${err.message}`, err.stack);
      throw err;
    }

    // 5. Clean up files from storage (best-effort, after DB deletion)
    if (documents.length > 0) {
      for (const doc of documents) {
        try {
          await this.storageService.deleteFile(doc.filePath);
          this.logger.log(`Deleted file from storage: ${doc.filePath}`);
        } catch (err) {
          this.logger.warn(`Failed to delete file from storage: ${doc.filePath} — ${err.message}`);
        }
      }
    }

    return { success: true, deletedDocuments: documents.length };
  }

  // ─── Candidate Document Deletion ─────────────────────────────────────────

  /**
   * Supprime un document individuel d'un candidat (DB record + R2/S3 file)
   */
  async deleteCandidateDocument(candidateId: string, documentId: string) {
    const doc = await this.prisma.candidateDocument.findFirst({
      where: { id: documentId, candidateId },
    });
    if (!doc) {
      throw new NotFoundException(`Document non trouvé`);
    }

    // 1. Delete DB record
    await this.prisma.candidateDocument.delete({ where: { id: documentId } });

    // 2. Delete file from storage (best-effort)
    try {
      await this.storageService.deleteFile(doc.filePath);
      this.logger.log(`Deleted file from storage: ${doc.filePath}`);
    } catch (err) {
      this.logger.warn(`Failed to delete file from storage: ${doc.filePath} — ${err.message}`);
    }

    return { success: true, deletedFile: doc.fileName };
  }

  // Applications
  async getApplications(tenantId: string) {
    return this.prisma.hrApplication.findMany({
      where: { tenantId },
      include: {
        job: true,
        candidate: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createApplication(tenantId: string, data: any) {
    // Generate mock matching & fraud analysis
    const scoreCV = Math.floor(Math.random() * 20) + 75; // 75-95
    const scoreLetter = Math.floor(Math.random() * 20) + 75; // 75-95
    const scoreMatching = Math.floor(Math.random() * 20) + 75; // 75-95
    const score = Math.round((scoreCV * 0.4) + (scoreLetter * 0.1) + (scoreMatching * 0.5));
    const risks = Math.random() > 0.8 ? 'Moyen' : 'Aucun';

    return this.prisma.hrApplication.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        jobId: data.jobId,
        candidateId: data.candidateId,
        status: data.status || 'NOUVEAU',
        score,
        scoreCV,
        scoreLetter,
        scoreMatching,
        risks,
        riskDetail: risks === 'Moyen' ? 'Léger chevauchement de dates sur deux expériences.' : null,
        matchDetail: 'Adéquation correcte du profil avec les exigences.',
      },
    });
  }

  async updateApplicationStatus(id: string, status: string, review?: string) {
    // ─── 1. Validate status transition ─────────────────────────────────────
    const currentApp = await this.prisma.hrApplication.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!currentApp) {
      throw new NotFoundException(`Candidature avec l'ID ${id} non trouvée`);
    }

    const currentStatus = currentApp.status;
    const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(status)) {
      throw new BadRequestException(
        `Transition de statut invalide : ${currentStatus} → ${status}. ` +
        `Transitions autorisées depuis ${currentStatus} : [${allowedNext.join(', ') || 'aucune (état terminal)'}]`
      );
    }

    // ─── 2. EMBAUCHÉ — Create Staff + Contract ─────────────────────────────
    if (status === 'EMBAUCHÉ') {
      return this.prisma.$transaction(async (tx) => {
        // Update application status
        const updatedApp = await tx.hrApplication.update({
          where: { id },
          data: { 
            ...prismaUpdateDefaults(),
            status,
            ...(review ? { matchDetail: review } : {})
          },
          include: {
            candidate: true,
            job: true,
          }
        });

        // ─── Pre-validate required data ─────────────────────────────────
        if (!updatedApp.candidate?.firstName || !updatedApp.candidate?.lastName) {
          throw new BadRequestException('Impossible d\'embaucher : le nom ou prénom du candidat est manquant.');
        }
        if (!updatedApp.job?.title) {
          throw new BadRequestException('Impossible d\'embaucher : le poste du candidat n\'est pas défini.');
        }

        // Check if employee already exists with this email
        const existingStaff = await tx.staff.findFirst({
          where: { email: updatedApp.candidate.email, tenantId: updatedApp.tenantId }
        });

        let staffRecord = existingStaff;

        if (!existingStaff) {
          // Find academic year if available
          const currentYear = await tx.academicYear.findFirst({
            where: { tenantId: updatedApp.tenantId, status: 'ACTIVE' }
          });

          // Determine roleType
          const jobTitle = (updatedApp.job.title || '').toLowerCase();
          const isTeacher = jobTitle.includes('enseignant') || jobTitle.includes('prof') || jobTitle.includes('teacher') || jobTitle.includes('instituteur');
          const roleType = isTeacher ? 'TEACHER' : 'ADMIN';

          // Parse salary (if it's a number like 400000 or "400 000 FCFA")
          let parsedSalary: Prisma.Decimal | null = null;
          if (updatedApp.job.salary) {
            // Extract ALL digits from the salary string (handles "400 000", "400,000", etc.)
            const allDigits = updatedApp.job.salary.replace(/[^0-9]/g, '');
            if (allDigits) {
              const num = Number(allDigits);
              if (!isNaN(num) && isFinite(num)) {
                parsedSalary = new Prisma.Decimal(num);
              }
            }
          }

          // Generate sequential matricules using StaffMatriculeService
          let globalMatricule: string | null = null;
          let tenantMatricule: string | null = null;
          try {
            const schoolCode = await this.matriculeService.getSchoolCode(updatedApp.tenantId);
            const registrationYear = new Date().getFullYear();
            globalMatricule = await this.matriculeService.generateGlobalMatriculeInTransaction(tx, registrationYear);
            tenantMatricule = await this.matriculeService.generateTenantMatriculeInTransaction(tx, updatedApp.tenantId, schoolCode, registrationYear);
          } catch (err) {
            this.logger.warn(`Matricule generation failed for hire: ${err.message}`);
          }

          // Generate a tenant-based employee number (legacy field)
          // NOTE: The tenant matricule already increments the counter above,
          // so we use a timestamp-based number instead of double-incrementing.
          let employeeNumber: string;
          if (tenantMatricule) {
            // Derive from the matricule sequence already generated
            employeeNumber = `EMP-${String(Date.now()).slice(-5)}`;
          } else {
            // Fallback: matricule generation failed, use sequence directly
            const tenantSeq = await tx.staffNumberSequence.upsert({
              where: { tenantId: updatedApp.tenantId },
              create: { ...prismaCreateNoCreatedAt(), tenantId: updatedApp.tenantId, current: 1 },
              update: { current: { increment: 1 } },
            });
            employeeNumber = `EMP-${String(tenantSeq.current).padStart(5, '0')}`;
          }

          const staffData = {
            ...prismaCreateDefaults(),
            tenantId: updatedApp.tenantId,
            academicYearId: currentYear?.id || null,
            employeeNumber,
            globalMatricule,
            tenantMatricule,
            firstName: updatedApp.candidate.firstName,
            lastName: updatedApp.candidate.lastName,
            gender: updatedApp.candidate.gender || null,
            email: updatedApp.candidate.email || null,
            phone: updatedApp.candidate.phone || null,
            address: updatedApp.candidate.address || null,
            position: updatedApp.job.title || null,
            department: updatedApp.job.dept || null,
            roleType,
            hireDate: new Date(),
            contractType: updatedApp.job.contractType || 'CDI',
            status: 'ACTIVE',
            salary: parsedSalary,
          };

          // Debug: log exact data being sent to Prisma
          this.logger.log(`Creating staff with data keys: ${Object.keys(staffData).join(', ')}`);
          this.logger.debug(`Staff data: ${JSON.stringify(staffData, (key, value) => typeof value === 'bigint' ? value.toString() : value)}`);

          try {
            staffRecord = await tx.staff.create({ data: staffData });
          } catch (staffErr: any) {
            this.logger.error(`Staff creation FAILED: ${staffErr.message}`, staffErr.stack);
            throw new BadRequestException(
              `Échec création Employé : ${staffErr.message?.replace(/\n/g, ' ').substring(0, 200)}`
            );
          }

          // Link staffId on the application
          await tx.hrApplication.update({
            where: { id },
            data: { staffId: staffRecord.id },
          });
        }

        // ─── 3. Auto-create Contract (directly in the same transaction) ───
        let contract = null;
        if (staffRecord) {
          try {
            const contractType = updatedApp.job.contractType || 'CDI';
            // Extract ALL digits for baseSalary (handles "400 000", "400,000", etc.)
            let baseSalary = new Prisma.Decimal(0);
            if (updatedApp.job.salary) {
              const allDigits = updatedApp.job.salary.replace(/[^0-9]/g, '');
              if (allDigits) {
                const num = Number(allDigits);
                if (!isNaN(num) && isFinite(num)) {
                  baseSalary = new Prisma.Decimal(num);
                }
              }
            }

            // Deactivate any existing active contracts for this staff
            await tx.contract.updateMany({
              where: { staffId: staffRecord.id, tenantId: updatedApp.tenantId, status: 'ACTIVE' },
              data: { status: 'EXPIRED' },
            });

            // Create contract directly in the same transaction (avoid nested tx)
            contract = await tx.contract.create({
              data: {
                ...prismaCreateDefaults(),
                tenantId: updatedApp.tenantId,
                staffId: staffRecord.id,
                contractType,
                startDate: new Date(),
                baseSalary,
                paymentMode: 'BANK',
                status: 'DRAFT',  // DRAFT until signed — not ACTIVE yet
              },
              include: { staff: true },
            });

            this.logger.log(`Contrat auto-créé pour ${updatedApp.candidate.firstName} ${updatedApp.candidate.lastName} — Contrat ID: ${contract.id}`);
          } catch (contractErr: any) {
            // Contract creation failure should NOT block the hire
            this.logger.error(`Échec de la création auto du contrat: ${contractErr.message}`, contractErr.stack);
          }
        }

        return { ...updatedApp, staff: staffRecord, contract };
      });
    }

    // ─── 4. Non-EMBAUCHÉ — simple status update ────────────────────────────
    return this.prisma.hrApplication.update({
      where: { id },
      data: { 
        ...prismaUpdateDefaults(),
        status,
        ...(review ? { matchDetail: review } : {})
      },
      include: {
        candidate: true,
        job: true,
      }
    });
  }

  async deleteApplication(id: string) {
    // 1. Collect candidate documents for R2 cleanup
    let documents: Array<{ id: string; filePath: string; fileName: string }> = [];
    try {
      const application = await this.prisma.hrApplication.findUnique({
        where: { id },
        select: { candidateId: true },
      });
      if (application?.candidateId) {
        documents = await this.prisma.candidateDocument.findMany({
          where: { candidateId: application.candidateId },
          select: { id: true, filePath: true, fileName: true },
        });
      }
    } catch (err) {
      this.logger.warn(`Could not fetch candidate documents for application deletion cleanup: ${err.message}`);
    }

    // 2. Delete DB records in a transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.hrAiReport.deleteMany({ where: { applicationId: id } });
      await tx.hrApplication.delete({ where: { id } });
    });

    // 3. Clean up files from storage (best-effort, after DB deletion)
    if (documents.length > 0) {
      for (const doc of documents) {
        try {
          await this.storageService.deleteFile(doc.filePath);
          this.logger.log(`Deleted file from storage: ${doc.filePath}`);
        } catch (err) {
          this.logger.warn(`Failed to delete file from storage: ${doc.filePath} — ${err.message}`);
        }
      }
    }

    return { success: true, deletedDocuments: documents.length };
  }

  // Interviews
  async getInterviews(tenantId: string) {
    return this.prisma.hrInterview.findMany({
      where: { tenantId },
      include: { candidate: true },
      orderBy: { date: 'asc' },
    });
  }

  async createInterview(tenantId: string, data: any) {
    // Validate that the candidate exists and belongs to this tenant
    const candidate = await this.prisma.hrCandidate.findFirst({
      where: { id: data.candidateId, tenantId },
    });
    if (!candidate) {
      throw new NotFoundException(`Candidat non trouvé pour ce tenant (candidateId: ${data.candidateId})`);
    }

    // Parse date robustly — handle both "YYYY-MM-DD" and full ISO strings
    let parsedDate: Date;
    try {
      parsedDate = new Date(data.date);
      if (isNaN(parsedDate.getTime())) {
        throw new Error(`Invalid date: ${data.date}`);
      }
    } catch (err: any) {
      throw new BadRequestException(`Date invalide : ${data.date}. Utilisez le format YYYY-MM-DD.`);
    }

    // Parse score — handle both string and number input
    const score = data.score != null ? (typeof data.score === 'number' ? data.score : parseInt(String(data.score), 10)) : 0;
    if (isNaN(score)) {
      throw new BadRequestException(`Score invalide : ${data.score}`);
    }

    const interview = await this.prisma.hrInterview.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        candidateId: data.candidateId,
        type: data.type || 'RH',
        date: parsedDate,
        time: data.time || '',
        format: data.format || 'Visioconférence',
        evaluator: data.evaluator || '',
        score,
        comments: data.comments || null,
        status: 'PLANIFIÉ',
      },
    });

    // AUTO-ADVANCE: Move candidate's application to ENTRETIEN status
    try {
      const application = await this.prisma.hrApplication.findFirst({
        where: {
          candidateId: data.candidateId,
          tenantId,
          status: { in: ['NOUVEAU', 'EN_COURS'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (application) {
        const allowedNext = VALID_TRANSITIONS[application.status] || [];
        if (allowedNext.includes('ENTRETIEN')) {
          await this.prisma.hrApplication.update({
            where: { id: application.id },
            data: { ...prismaUpdateDefaults(), status: 'ENTRETIEN' },
          });
          this.logger.log(`Application ${application.id} auto-advanced to ENTRETIEN after interview creation`);
        }
      }
    } catch (advanceErr: any) {
      this.logger.warn(`Failed to auto-advance application to ENTRETIEN: ${advanceErr.message}`);
    }

    return interview;
  }

  async updateInterview(id: string, data: any) {
    // Build update data — only include fields that are provided
    const updateData: any = { ...prismaUpdateDefaults() };

    if (data.type !== undefined) updateData.type = data.type;
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.time !== undefined) updateData.time = data.time;
    if (data.format !== undefined) updateData.format = data.format;
    if (data.evaluator !== undefined) updateData.evaluator = data.evaluator;
    if (data.score !== undefined) {
      const s = typeof data.score === 'number' ? data.score : parseInt(String(data.score), 10);
      if (!isNaN(s)) updateData.score = s;
    }
    if (data.comments !== undefined) updateData.comments = data.comments;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.result !== undefined) updateData.result = data.result;
    if (data.feedback !== undefined) updateData.feedback = data.feedback;

    const updated = await this.prisma.hrInterview.update({
      where: { id },
      data: updateData,
      include: { candidate: { include: { applications: true } } },
    });

    // Auto-advance application status when interview is completed with RÉUSSI
    if (data.status === 'TERMINÉ' && data.result === 'RÉUSSI' && updated.candidateId) {
      try {
        const primaryApp = updated.candidate?.applications?.[0];
        if (primaryApp) {
          const currentStatus = primaryApp.status;
          // Already at or past ENTRETIEN — nothing to do
          if (currentStatus !== 'ENTRETIEN' && currentStatus !== 'TEST' && currentStatus !== 'EMBAUCHÉ') {
            // Advance through all intermediate states to ENTRETIEN
            let statusToSet = currentStatus;
            const path: string[] = [];
            while (statusToSet !== 'ENTRETIEN') {
              const next = VALID_TRANSITIONS[statusToSet];
              if (!next || next.length === 0) break;
              if (next.includes('ENTRETIEN')) {
                path.push('ENTRETIEN');
                break;
              }
              const intermediate = next.find(s => s !== 'REJETÉ');
              if (!intermediate) break;
              path.push(intermediate);
              statusToSet = intermediate;
            }
            if (path.length > 0) {
              const finalStatus = path[path.length - 1];
              await this.prisma.hrApplication.update({
                where: { id: primaryApp.id },
                data: { ...prismaUpdateDefaults(), status: finalStatus },
              });
              this.logger.log(`Auto-advanced application ${primaryApp.id} from ${currentStatus} to ${finalStatus} via [${path.join(' → ')}] after interview update`);
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed to auto-advance application after interview update: ${err.message}`);
      }
    }

    return updated;
  }

  /**
   * Validate (complete) an interview: set status=TERMINÉ, result, score, feedback.
   * When an interview is marked as RÉUSSI, auto-advance the candidate's
   * application status to ENTRETIEN. Creates an HrApplication if the candidate
   * doesn't have one yet.
   */
  async validateInterview(id: string, data: { result: string; score?: number; feedback?: string }) {
    const interview = await this.prisma.hrInterview.findUnique({
      where: { id },
      include: { candidate: { include: { applications: { include: { job: true } } } } },
    });
    if (!interview) {
      throw new NotFoundException(`Entretien ${id} non trouvé`);
    }

    const score = data.score != null
      ? (typeof data.score === 'number' ? data.score : parseInt(String(data.score), 10))
      : interview.score;

    return this.prisma.$transaction(async (tx) => {
      // Update the interview
      const updated = await tx.hrInterview.update({
        where: { id },
        data: {
          ...prismaUpdateDefaults(),
          status: 'TERMINÉ',
          result: data.result,
          score: isNaN(score) ? 0 : score,
          feedback: data.feedback || null,
        },
      });

      // If interview succeeded, advance the candidate's application status
      if (data.result === 'RÉUSSI') {
        let primaryApp = interview.candidate?.applications?.[0];

        // If no application exists, create one automatically
        if (!primaryApp && interview.candidateId) {
          // Find a job for this tenant to link the application to
          const firstJob = await tx.hrJob.findFirst({
            where: { tenantId: interview.tenantId },
          });

          if (firstJob) {
            primaryApp = await tx.hrApplication.create({
              data: {
                ...prismaCreateDefaults(),
                tenantId: interview.tenantId,
                candidateId: interview.candidateId,
                jobId: firstJob.id,
                status: 'EN_COURS',
              },
              include: { job: true },
            });
          }
        }

        if (primaryApp) {
          const currentStatus = primaryApp.status;
          // Already at or past ENTRETIEN — nothing to do
          if (currentStatus === 'ENTRETIEN' || currentStatus === 'TEST' || currentStatus === 'EMBAUCHÉ') {
            // Candidate already eligible or past this stage
          } else {
            // Advance through all intermediate states to ENTRETIEN
            // e.g. NOUVEAU → EN_COURS → ENTRETIEN
            let statusToSet = currentStatus;
            const path: string[] = [];
            while (statusToSet !== 'ENTRETIEN') {
              const next = VALID_TRANSITIONS[statusToSet];
              if (!next || next.length === 0) break; // Terminal state or unknown
              if (next.includes('ENTRETIEN')) {
                path.push('ENTRETIEN');
                break;
              }
              // Take the first non-REJETÉ transition as intermediate step
              const intermediate = next.find(s => s !== 'REJETÉ');
              if (!intermediate) break;
              path.push(intermediate);
              statusToSet = intermediate;
            }
            if (path.length > 0) {
              const finalStatus = path[path.length - 1];
              await tx.hrApplication.update({
                where: { id: primaryApp.id },
                data: { ...prismaUpdateDefaults(), status: finalStatus },
              });
              this.logger.log(`Auto-advanced application ${primaryApp.id} from ${currentStatus} to ${finalStatus} via [${path.join(' → ')}]`);
            }
          }
        }
      }

      return updated;
    });
  }

  async deleteInterview(id: string) {
    return this.prisma.hrInterview.delete({
      where: { id },
    });
  }

  // Tests CRUD
  async getTests(tenantId: string) {
    return this.prisma.hrTest.findMany({
      where: { tenantId },
      include: { results: { include: { candidate: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTest(tenantId: string, data: any) {
    return this.prisma.hrTest.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        name: data.name,
        type: data.type,
        description: data.description || null,
        duration: data.duration || null,
        instructions: data.instructions || null,
        maxScore: data.maxScore ?? 100,
        passingScore: data.passingScore ?? 50,
        status: data.status || 'ACTIF',
      },
    });
  }

  async updateTest(id: string, data: any) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.duration !== undefined) updateData.duration = data.duration || null;
    if (data.instructions !== undefined) updateData.instructions = data.instructions || null;
    if (data.maxScore !== undefined) updateData.maxScore = data.maxScore;
    if (data.passingScore !== undefined) updateData.passingScore = data.passingScore;
    if (data.status !== undefined) updateData.status = data.status;

    return this.prisma.hrTest.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteTest(id: string) {
    // Use a transaction to delete test results first
    return this.prisma.$transaction(async (tx) => {
      await tx.hrTestResult.deleteMany({ where: { testId: id } });
      return tx.hrTest.delete({ where: { id } });
    });
  }

  // Test Results
  async createTestResult(data: any) {
    const score = typeof data.score === 'number' ? data.score : parseInt(data.score, 10);
    if (isNaN(score)) {
      throw new Error('Score invalide : doit être un nombre entier');
    }

    return this.prisma.$transaction(async (tx) => {
      const resultData: any = {
        ...prismaCreateNoUpdatedAt(),  // HrTestResult has no updatedAt
        testId: data.testId,
        candidateId: data.candidateId,
        score,
        result: data.result || 'RÉUSSI',
      };
      if (data.notes) resultData.notes = data.notes;
      if (data.evaluatedAt) {
        resultData.evaluatedAt = new Date(data.evaluatedAt);
      } else {
        resultData.evaluatedAt = new Date();
      }

      const testResult = await tx.hrTestResult.create({
        data: resultData,
      });

      // Auto-advance the candidate's application status to TEST
      const candidate = await tx.hrCandidate.findUnique({
        where: { id: data.candidateId },
        include: { applications: true },
      });

      if (candidate) {
        let primaryApp = candidate.applications?.[0];

        // If no application exists, create one automatically
        if (!primaryApp) {
          const firstJob = await tx.hrJob.findFirst({
            where: { tenantId: candidate.tenantId },
          });

          if (firstJob) {
            primaryApp = await tx.hrApplication.create({
              data: {
                ...prismaCreateDefaults(),
                tenantId: candidate.tenantId,
                candidateId: candidate.id,
                jobId: firstJob.id,
                status: 'EN_COURS',
              },
            });
          }
        }

        if (primaryApp) {
          const currentStatus = primaryApp.status;
          // Already at or past TEST — nothing to do
          if (currentStatus !== 'TEST' && currentStatus !== 'EMBAUCHÉ') {
            // Advance through all intermediate states to TEST
            let statusToSet = currentStatus;
            const path: string[] = [];
            while (statusToSet !== 'TEST') {
              const next = VALID_TRANSITIONS[statusToSet];
              if (!next || next.length === 0) break;
              if (next.includes('TEST')) {
                path.push('TEST');
                break;
              }
              const intermediate = next.find(s => s !== 'REJETÉ');
              if (!intermediate) break;
              path.push(intermediate);
              statusToSet = intermediate;
            }
            if (path.length > 0) {
              const finalStatus = path[path.length - 1];
              await tx.hrApplication.update({
                where: { id: primaryApp.id },
                data: { ...prismaUpdateDefaults(), status: finalStatus },
              });
            }
          }
        }
      }

      return testResult;
    });
  }

  async updateTestResult(id: string, data: any) {
    const updateData: any = {};
    if (data.score !== undefined) {
      const score = typeof data.score === 'number' ? data.score : parseInt(data.score, 10);
      if (isNaN(score)) {
        throw new Error('Score invalide : doit être un nombre entier');
      }
      updateData.score = score;
    }
    if (data.result !== undefined) updateData.result = data.result;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.evaluatedAt !== undefined) {
      updateData.evaluatedAt = data.evaluatedAt ? new Date(data.evaluatedAt) : null;
    }

    return this.prisma.hrTestResult.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteTestResult(id: string) {
    return this.prisma.hrTestResult.delete({
      where: { id },
    });
  }

  // Talent Pool
  async getTalentPool(tenantId: string) {
    return this.prisma.hrTalentPool.findMany({
      where: { candidate: { tenantId } },
      include: { candidate: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addToTalentPool(candidateId: string, data: any) {
    return this.prisma.hrTalentPool.upsert({
      where: { candidateId },
      create: {
        ...prismaCreateNoUpdatedAt(),
        candidateId,
        category: data.category || 'Général',
        status: data.status || 'Disponible',
      },
      update: {
        category: data.category,
        status: data.status,
      },
    });
  }

  async removeFromTalentPool(id: string) {
    return this.prisma.hrTalentPool.delete({
      where: { id },
    });
  }

  async applyJob(body: any, files: any) {
    const tenantId = body.tenantId;

    // Parse structured data from request body
    let skills: string[] = [];
    let experiences: any[] = [];
    let education: any[] = [];
    try {
      if (body.skills) skills = JSON.parse(body.skills);
      if (body.experiences) experiences = JSON.parse(body.experiences);
      if (body.education) education = JSON.parse(body.education);
    } catch (e) {
      this.logger.warn('Failed parsing structured profile details:', e);
    }

    const pitch = body.pitch || '';
    const pedagogicalExperience = JSON.stringify({ experiences, pitch, education, linkedinUrl: body.linkedinUrl || '' });

    // Generate scores and detail reports based on files
    const hasCV = files?.cv && files.cv.length > 0;
    const hasLetter = files?.coverLetter && files.coverLetter.length > 0;

    // ─── AI-powered scoring via OpenRouter HDIE ────────────────────────────
    // If OpenRouter is configured, use real AI analysis. Otherwise, fall back
    // to heuristic scoring based on the presence of documents and profile data.
    const cvName = hasCV ? files.cv[0].originalname : 'Profil LinkedIn / Candidature Simplifiée';
    const letterName = hasLetter ? files.coverLetter[0].originalname : 'Pitch de motivation intégré';

    let scoreCV: number;
    let scoreLetter: number;
    let scoreMatching: number;
    let score: number;
    let matchDetail: string;
    let risks: string;
    let riskDetail: string | null;
    let aiReportContent: string | null = null;

    if (this.openRouter.isConfigured()) {
      // Real AI analysis via OpenRouter
      try {
        // Fetch job details for context
        const job = await this.prisma.hrJob.findUnique({
          where: { id: body.jobId },
          select: { title: true, dept: true, description: true, skillsRequired: true, experience: true, academicLevel: true },
        });

        const candidateProfile = [
          `Nom: ${body.firstName} ${body.lastName}`,
          `Email: ${body.email}`,
          skills.length > 0 ? `Compétences: ${skills.join(', ')}` : null,
          experiences.length > 0 ? `Expériences: ${experiences.map(e => e.title || e.position || '').filter(Boolean).join(', ')}` : null,
          education.length > 0 ? `Formation: ${education.map(e => e.degree || e.diploma || '').filter(Boolean).join(', ')}` : null,
          pitch ? `Motivation: ${pitch.substring(0, 300)}` : null,
          hasCV ? `CV fourni: ${cvName}` : 'CV non fourni',
          hasLetter ? `Lettre de motivation fournie: ${letterName}` : 'Lettre non fournie',
        ].filter(Boolean).join('\n');

        const jobContext = job
          ? `Poste: ${job.title} — Département: ${job.dept || 'N/A'}\nDescription: ${(job.description || '').substring(0, 300)}\nCompétences requises: ${job.skillsRequired || 'N/A'}\nExpérience requise: ${job.experience || 'N/A'}\nNiveau académique: ${job.academicLevel || 'N/A'}`
          : 'Poste non spécifié';

        const aiResult = await this.openRouter.structuredChat<{
          scoreCV: number;
          scoreLetter: number;
          scoreMatching: number;
          matchDetail: string;
          risks: string;
          riskDetail: string | null;
          analysis: string;
        }>(
          `Analyse ce profil de candidat pour un poste dans l'enseignement et évalue son adéquation.\n\nPROFIL DU CANDIDAT:\n${candidateProfile}\n\nPOSTE VISÉ:\n${jobContext}`,
          `Tu es le moteur HDIE (Helm Document Intelligence Engine) d'Academia Helm. Tu analyses des candidatures pour des postes dans l'enseignement.
Tu évalues l'adéquation du candidat au poste en te basant sur les informations fournies.

RÈGLES DE SCORING:
- scoreCV (0-100): Qualité et pertinence du CV/Profil par rapport au poste. Si pas de CV, base-toi sur les compétences déclarées (max 70).
- scoreLetter (0-100): Qualité et pertinence de la lettre/motivation. Si pas de lettre mais un pitch, évalue le pitch (max 75). Si rien, max 50.
- scoreMatching (0-100): Adéquation globale du profil avec les exigences du poste.
- matchDetail: Résumé en 2-3 phrases de l'analyse d'adéquation.
- risks: "Aucun", "Faible", "Moyen", ou "Élevé" selon les incohérences détectées.
- riskDetail: Description du risque si risks !== "Aucun", sinon null.
- analysis: Analyse détaillée du profil en 3-5 phrases.

Réponds UNIQUEMENT en JSON valide.`,
          'HDIE',
        );

        if (aiResult.data && !aiResult.isPlaceholder) {
          scoreCV = Math.max(0, Math.min(100, aiResult.data.scoreCV));
          scoreLetter = Math.max(0, Math.min(100, aiResult.data.scoreLetter));
          scoreMatching = Math.max(0, Math.min(100, aiResult.data.scoreMatching));
          matchDetail = aiResult.data.matchDetail || `Candidature analysée par HDIE. CV: ${cvName}. Présentation: ${letterName}.`;
          risks = ['Aucun', 'Faible', 'Moyen', 'Élevé'].includes(aiResult.data.risks) ? aiResult.data.risks : 'Aucun';
          riskDetail = aiResult.data.riskDetail || null;
          aiReportContent = JSON.stringify(aiResult.data);
          this.logger.log(`HDIE AI analysis complete: scoreCV=${scoreCV}, scoreLetter=${scoreLetter}, scoreMatching=${scoreMatching}, risks=${risks}`);
        } else {
          // AI call succeeded but JSON parsing failed — use heuristic fallback
          this.logger.warn('HDIE AI response was not valid JSON, using heuristic scores');
          ({ scoreCV, scoreLetter, scoreMatching, score, matchDetail, risks, riskDetail } = this.generateHeuristicScores(hasCV, hasLetter, cvName, letterName, skills, experiences, education));
        }
      } catch (aiErr: any) {
        // AI call failed — use heuristic fallback
        this.logger.warn(`HDIE AI analysis failed: ${aiErr.message}, using heuristic scores`);
        ({ scoreCV, scoreLetter, scoreMatching, score, matchDetail, risks, riskDetail } = this.generateHeuristicScores(hasCV, hasLetter, cvName, letterName, skills, experiences, education));
      }
    } else {
      // OpenRouter not configured — use heuristic scoring
      ({ scoreCV, scoreLetter, scoreMatching, score, matchDetail, risks, riskDetail } = this.generateHeuristicScores(hasCV, hasLetter, cvName, letterName, skills, experiences, education));
    }

    // Calculate final composite score
    score = Math.round((scoreCV * 0.4) + (scoreLetter * 0.2) + (scoreMatching * 0.4));

    // ─── Upload files OUTSIDE the transaction first ───────────────────────
    // Previously, uploads ran inside the Prisma transaction, which caused
    // transaction timeouts (P2024) or internal errors when the storage backend
    // (R2/S3/Vercel Blob) was slow or misconfigured.
    let cvPath: string | null = null;
    let letterPath: string | null = null;
    let recoPath: string | null = null;
    let cvFile: Express.Multer.File | null = null;
    let letterFile: Express.Multer.File | null = null;
    let recoFile: Express.Multer.File | null = null;

    try {
      if (hasCV) {
        cvFile = files.cv[0];
        cvPath = await this.storageService.uploadFile(
          cvFile,
          `candidate-docs/${tenantId}/pending/cv`,
        );
        this.logger.log(`CV uploaded: ${cvPath}`);
      }
      if (hasLetter) {
        letterFile = files.coverLetter[0];
        letterPath = await this.storageService.uploadFile(
          letterFile,
          `candidate-docs/${tenantId}/pending/cover-letter`,
        );
        this.logger.log(`Cover letter uploaded: ${letterPath}`);
      }
      if (files?.recommendationLetter && files.recommendationLetter.length > 0) {
        recoFile = files.recommendationLetter[0];
        recoPath = await this.storageService.uploadFile(
          recoFile,
          `candidate-docs/${tenantId}/pending/recommendation`,
        );
        this.logger.log(`Recommendation letter uploaded: ${recoPath}`);
      }
    } catch (uploadErr: any) {
      this.logger.error(`File upload failed during applyJob: ${uploadErr.message}`, uploadErr.stack);
      // Continue without files — the candidate can still be created,
      // just without the document references
    }

    // ─── Prisma transaction: DB writes only (fast, no external I/O) ───────
    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Create candidate
        const candidate = await tx.hrCandidate.create({
          data: {
            ...prismaCreateDefaults(),
            tenantId,
            firstName: body.firstName,
            lastName: body.lastName,
            email: body.email,
            phone: body.phone,
            address: body.address || '',
            country: body.country || null,
            city: body.city || null,
            gender: body.gender || 'M',
          }
        });

        // 2. Save to AcademicProfile (no updatedAt field)
        await tx.academicProfile.create({
          data: {
            ...prismaCreateNoUpdatedAt(),
            candidateId: candidate.id,
            teachingLevel: education[0]?.degree || 'Non spécifié',
            subjects: skills,
            pedagogicalExperience,
          }
        });

        // 3. Create application
        const application = await tx.hrApplication.create({
          data: {
            ...prismaCreateDefaults(),
            tenantId,
            jobId: body.jobId,
            candidateId: candidate.id,
            status: 'NOUVEAU',
            score,
            scoreCV,
            scoreLetter,
            scoreMatching,
            risks,
            riskDetail,
            matchDetail,
          }
        });

        // 4. Save AI report if available
        if (aiReportContent) {
          try {
            await tx.hrAiReport.create({
              data: {
                id: uuid(),  // HrAiReport has only id + generatedAt, no createdAt/updatedAt
                candidateId: candidate.id,
                applicationId: application.id,
                reportType: 'APPLICATION_ANALYSIS',
                content: aiReportContent,
                generatedAt: new Date(),
              }
            });
          } catch (reportErr: any) {
            this.logger.warn(`Failed to save AI report: ${reportErr.message}`);
          }
        }

        // 5. Save document references (paths already uploaded)
        const documentRecords: any[] = [];

        if (cvFile && cvPath) {
          const doc = await tx.candidateDocument.create({
            data: {
              ...prismaCreateNoUpdatedAt(),
              candidateId: candidate.id,
              documentType: 'CV',
              fileName: cvFile.originalname,
              filePath: cvPath,
              fileSize: cvFile.size,
              mimeType: cvFile.mimetype,
              category: 'EXPERIENCE',
            }
          });
          documentRecords.push(doc);
        }

        if (letterFile && letterPath) {
          const doc = await tx.candidateDocument.create({
            data: {
              ...prismaCreateNoUpdatedAt(),
              candidateId: candidate.id,
              documentType: 'COVER_LETTER',
              fileName: letterFile.originalname,
              filePath: letterPath,
              fileSize: letterFile.size,
              mimeType: letterFile.mimetype,
              category: 'EXPERIENCE',
            }
          });
          documentRecords.push(doc);
        }

        if (recoFile && recoPath) {
          const doc = await tx.candidateDocument.create({
            data: {
              ...prismaCreateNoUpdatedAt(),
              candidateId: candidate.id,
              documentType: 'RECOMMENDATION',
              fileName: recoFile.originalname,
              filePath: recoPath,
              fileSize: recoFile.size,
              mimeType: recoFile.mimetype,
              category: 'DIPLOMES',
            }
          });
          documentRecords.push(doc);
        }

        return { candidate, application, documents: documentRecords };
      }, {
        maxWait: 10_000,  // max time to acquire a connection
        timeout: 30_000,  // max time for the entire transaction
      });
    } catch (txErr: any) {
      this.logger.error(`applyJob transaction failed: ${txErr.message}`, txErr.stack);
      // Wrap with a more descriptive error for the PrismaExceptionFilter
      // to give users a clearer message instead of generic "Erreur interne du serveur"
      if (txErr.code?.startsWith?.('P')) {
        // Prisma error — let PrismaExceptionFilter handle it
        throw txErr;
      }
      // Non-Prisma error — wrap in BadRequestException with detail
      throw new BadRequestException(
        `Échec de l'enregistrement de la candidature : ${txErr.message || 'erreur inconnue'}`
      );
    }
  }

  /**
   * Télécharge un document d'un candidat.
   * - R2: télécharge le fichier depuis R2 et le sert directement (stream)
   *       On n'utilise PAS de redirect vers S3_PUBLIC_URL car le domaine
   *       peut ne pas être configuré comme custom domain R2 (ex: docs.academiahelm.com
   *       pointe vers Vercel). Le streaming via l'API garantit que le fichier
   *       est toujours accessible, quelle que soit la config DNS.
   * - S3: redirige vers une presigned URL (7 jours)
   * - Vercel Blob: redirige vers l'URL publique
   * - Local: sert le fichier depuis le disque
   */
  async downloadCandidateDocument(candidateId: string, docId: string, res: any) {
    const doc = await this.prisma.candidateDocument.findFirst({
      where: { id: docId, candidateId },
    });

    if (!doc) {
      throw new NotFoundException(`Document non trouvé`);
    }

    const storageType = this.storageService.getStorageType();

    // For R2: ALWAYS stream the file directly through the API.
    // This avoids broken redirects when S3_PUBLIC_URL doesn't point to R2.
    if (storageType === 'r2') {
      // If filePath is already a full URL (shouldn't happen for R2 keys, but handle it)
      if (doc.filePath && doc.filePath.startsWith('https://')) {
        return res.redirect(doc.filePath);
      }
      try {
        const buffer = await this.storageService.downloadFile(doc.filePath);
        res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
        res.setHeader('Content-Length', String(buffer.length));
        res.send(buffer);
        return;
      } catch (dlErr) {
        this.logger.error(`Failed to download file from R2: ${doc.filePath} — ${dlErr.message}`);
        throw new NotFoundException(`Fichier non trouvé sur le stockage`);
      }
    }

    // For S3: redirect to presigned URL (S3 public URLs are reliable)
    if (storageType === 's3') {
      if (doc.filePath && doc.filePath.startsWith('https://')) {
        return res.redirect(doc.filePath);
      }
      try {
        const url = await this.storageService.resolveFileUrl(doc.filePath);
        return res.redirect(url);
      } catch (err) {
        this.logger.warn(`Failed to resolve S3 URL for ${doc.filePath}: ${err.message}`);
        try {
          const buffer = await this.storageService.downloadFile(doc.filePath);
          res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
          res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
          res.setHeader('Content-Length', String(buffer.length));
          res.send(buffer);
          return;
        } catch (dlErr) {
          throw new NotFoundException(`Fichier non trouvé sur le stockage`);
        }
      }
    }

    // For Vercel Blob: filePath is the full public URL
    if (storageType === 'vercel-blob' && doc.filePath && doc.filePath.startsWith('https://')) {
      return res.redirect(doc.filePath);
    }

    // Local file: serve from disk
    const fs = await import('fs');
    const path = await import('path');
    const localPath = path.join(process.cwd(), 'public', doc.filePath);

    if (!fs.existsSync(localPath)) {
      throw new NotFoundException(`Fichier non trouvé sur le serveur`);
    }

    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);

    const fileStream = fs.createReadStream(localPath);
    fileStream.pipe(res);
  }

  // ─── Orphaned File Cleanup ────────────────────────────────────────────────

  /**
   * Nettoie les fichiers orphelins dans R2/S3 pour un tenant donné.
   * Compare les clés R2 sous `candidate-docs/{tenantId}/` avec les
   * enregistrements dans `hr_candidate_documents`, et supprime ceux
   * qui n'ont plus de ligne DB correspondante.
   */
  async cleanupOrphanedFiles(tenantId: string) {
    const storageType = this.storageService.getStorageType();
    if (storageType !== 'r2' && storageType !== 's3') {
      return { skipped: true, reason: `Storage type is ${storageType}, not R2/S3` };
    }

    // 1. List all files in R2 under this tenant's candidate-docs prefix
    const prefix = `candidate-docs/${tenantId}/`;
    let r2Keys: string[];
    try {
      r2Keys = await this.storageService.listByPrefix(prefix);
    } catch (err) {
      this.logger.error(`Failed to list R2 objects for cleanup: ${err.message}`);
      return { error: `Failed to list R2 objects: ${err.message}` };
    }

    if (r2Keys.length === 0) {
      return { totalR2Files: 0, orphaned: 0, deleted: 0 };
    }

    // 2. Get all known filePaths from DB
    const dbDocs = await this.prisma.candidateDocument.findMany({
      where: { filePath: { startsWith: prefix } },
      select: { filePath: true },
    });
    const dbPaths = new Set(dbDocs.map((d) => d.filePath));

    // 3. Find orphaned keys (in R2 but not in DB)
    const orphanedKeys = r2Keys.filter((key) => !dbPaths.has(key));

    if (orphanedKeys.length === 0) {
      return { totalR2Files: r2Keys.length, orphaned: 0, deleted: 0 };
    }

    // 4. Delete orphaned files (batch)
    const deletedKeys: string[] = [];
    const failedKeys: string[] = [];
    for (const key of orphanedKeys) {
      try {
        await this.storageService.deleteFile(key);
        deletedKeys.push(key);
      } catch (err) {
        this.logger.warn(`Failed to delete orphaned file: ${key} — ${err.message}`);
        failedKeys.push(key);
      }
    }

    this.logger.log(`Cleanup complete: ${deletedKeys.length} orphaned files deleted, ${failedKeys.length} failed`);

    return {
      totalR2Files: r2Keys.length,
      totalDbRecords: dbPaths.size,
      orphaned: orphanedKeys.length,
      deleted: deletedKeys.length,
      failed: failedKeys.length,
      deletedKeys,
      failedKeys,
    };
  }

  // ─── Heuristic Scoring (fallback when AI is not available) ──────────────

  /**
   * Génère des scores heuristiques basés sur les données du profil.
   * Utilisé comme fallback quand l'IA (OpenRouter) n'est pas configurée
   * ou quand l'appel IA échoue.
   */
  private generateHeuristicScores(
    hasCV: boolean,
    hasLetter: boolean,
    cvName: string,
    letterName: string,
    skills: string[],
    experiences: any[],
    education: any[],
  ): {
    scoreCV: number;
    scoreLetter: number;
    scoreMatching: number;
    score: number;
    matchDetail: string;
    risks: string;
    riskDetail: string | null;
  } {
    // CV score: based on presence and profile richness
    let scoreCV = 50; // base
    if (hasCV) scoreCV += 25;
    if (skills.length > 0) scoreCV += Math.min(15, skills.length * 3);
    if (experiences.length > 0) scoreCV += Math.min(10, experiences.length * 5);

    // Letter score: based on presence of cover letter or pitch
    let scoreLetter = 40; // base
    if (hasLetter) scoreLetter += 30;
    if (experiences.length > 0) scoreLetter += 10;
    if (education.length > 0) scoreLetter += 10;

    // Matching score: overall profile completeness
    let scoreMatching = 45; // base
    if (hasCV) scoreMatching += 15;
    if (hasLetter) scoreMatching += 10;
    if (skills.length >= 3) scoreMatching += 10;
    if (experiences.length > 0) scoreMatching += 10;
    if (education.length > 0) scoreMatching += 10;

    // Clamp to 0-100
    scoreCV = Math.min(100, scoreCV);
    scoreLetter = Math.min(100, scoreLetter);
    scoreMatching = Math.min(100, scoreMatching);

    const score = Math.round((scoreCV * 0.4) + (scoreLetter * 0.2) + (scoreMatching * 0.4));

    const matchDetail = `Candidature analysée par heuristiques. CV: ${cvName}. Présentation: ${letterName}. Profil avec ${skills.length} compétence(s), ${experiences.length} expérience(s), ${education.length} formation(s).`;

    const risks = 'Aucun';
    const riskDetail = null;

    return { scoreCV, scoreLetter, scoreMatching, score, matchDetail, risks, riskDetail };
  }

  // ─── Fix Application Statuses (retroactive correction) ──────────────────
  /**
   * Retroactively fix application statuses based on completed interviews/tests.
   * For candidates who have TERMINÉ/RÉUSSI interviews but their application
   * is still at NOUVEAU or EN_COURS, this will advance them to the correct status.
   */
  async fixApplicationStatuses(tenantId: string) {
    const results: { candidateId: string; oldStatus: string; newStatus: string; reason: string }[] = [];

    // Get all applications for this tenant
    const applications = await this.prisma.hrApplication.findMany({
      where: { tenantId },
      include: {
        candidate: {
          include: {
            interviews: true,
          },
        },
      },
    });

    for (const app of applications) {
      const currentStatus = app.status;
      // Skip terminal states
      if (currentStatus === 'EMBAUCHÉ' || currentStatus === 'REJETÉ') continue;

      const candidate = app.candidate;
      if (!candidate) continue;

      const interviews = candidate.interviews || [];
      const hasReussiInterview = interviews.some(i => i.status === 'TERMINÉ' && i.result === 'RÉUSSI');
      const hasTermineInterview = interviews.some(i => i.status === 'TERMINÉ');

      // Determine the correct status based on interview results
      let targetStatus: string | null = null;
      let reason = '';

      if (hasReussiInterview && currentStatus !== 'ENTRETIEN' && currentStatus !== 'TEST') {
        // Should be at least ENTRETIEN
        targetStatus = 'ENTRETIEN';
        reason = 'Has TERMINÉ/RÉUSSI interview';
      } else if (hasTermineInterview && currentStatus === 'NOUVEAU') {
        // At least EN_COURS if any interview was done
        targetStatus = 'EN_COURS';
        reason = 'Has TERMINÉ interview';
      }

      if (targetStatus) {
        // Advance through valid transitions
        let statusToSet = currentStatus;
        const path: string[] = [];
        while (statusToSet !== targetStatus) {
          const next = VALID_TRANSITIONS[statusToSet];
          if (!next || next.length === 0) break;
          if (next.includes(targetStatus)) {
            path.push(targetStatus);
            break;
          }
          const intermediate = next.find(s => s !== 'REJETÉ');
          if (!intermediate) break;
          path.push(intermediate);
          statusToSet = intermediate;
        }

        if (path.length > 0) {
          const finalStatus = path[path.length - 1];
          await this.prisma.hrApplication.update({
            where: { id: app.id },
            data: { ...prismaUpdateDefaults(), status: finalStatus },
          });
          results.push({
            candidateId: candidate.id,
            oldStatus: currentStatus,
            newStatus: finalStatus,
            reason,
          });
          this.logger.log(`Fixed application ${app.id}: ${currentStatus} → ${finalStatus} (${reason})`);
        }
      }
    }

    return { fixed: results.length, details: results };
  }
}

