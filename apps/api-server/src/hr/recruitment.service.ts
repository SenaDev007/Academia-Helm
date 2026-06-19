import { Injectable, Logger, NotFoundException, BadRequestException, HttpException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { OpenRouterService } from '../common/services/openrouter.service';
import { ContractsPrismaService } from './contracts-prisma.service';
import { StaffMatriculeService } from './staff-matricule.service';
import { RecruitmentNotificationService } from './recruitment-notification.service';
import { prismaCreateDefaults, prismaUpdateDefaults, prismaCreateNoCreatedAt, prismaCreateNoUpdatedAt, prismaCreateIdOnly, uuid, now } from '../common/utils/prisma-helpers';
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
    private readonly notificationService: RecruitmentNotificationService,
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

  /**
   * Generate a URL-safe slug from a job title + ref combination.
   * Format: <slugified-title>-<ref-suffix>
   * Example: "professeur-maths-off-csp-00001"
   */
  private generateSlug(title: string, ref: string): string {
    const slugifiedTitle = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')      // Replace non-alphanumeric with dash
      .replace(/^-+|-+$/g, '')          // Trim leading/trailing dashes
      .slice(0, 60);                     // Limit length
    const refSuffix = ref.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${slugifiedTitle}-${refSuffix}`;
  }

  async createJob(tenantId: string, data: any) {
    // Generate sequential ref if not provided
    const ref = data.ref || await this.generateJobRef(tenantId);
    // Map frontend aliases to DB column names
    const dept = data.dept || data.department || '';
    const loc = data.loc || data.location || '';
    const missions = data.missions || data.keyMissions || null;
    const academicLevel = data.academicLevel || data.requiredEducation || null;
    const experience = data.experience || data.requiredExperience || null;
    // If status is PUBLIÉE, set publishedAt to now()
    const publishedAt = data.status === 'PUBLIÉE' ? new Date() : null;
    const slug = data.slug || this.generateSlug(data.title, ref);
    return this.prisma.hrJob.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        ref,
        slug,
        title: data.title,
        dept,
        loc,
        status: data.status || 'BROUILLON', // PUBLIÉE, FERMÉE, ARCHIVÉE, DÉSACTIVÉE
        description: data.description,
        missions,
        responsibilities: data.responsibilities,
        academicLevel,
        experience,
        skillsRequired: data.skillsRequired,
        assets: data.assets,
        salary: data.salary,
        contractType: data.contractType,
        publishedAt,
      },
    });
  }

  async updateJob(id: string, data: any) {
    // Map frontend aliases to DB column names
    const dept = data.dept || data.department;
    const loc = data.loc || data.location;
    const missions = data.missions || data.keyMissions;
    const academicLevel = data.academicLevel || data.requiredEducation;
    const experience = data.experience || data.requiredExperience;

    // If status is being changed to PUBLIÉE, update publishedAt
    // (unless explicitly provided, e.g. during republish)
    const publishedAt = data.status === 'PUBLIÉE' ? new Date() : undefined;

    // If title changes, regenerate slug from new title + current ref
    let slugUpdate: Record<string, string> = {};
    if (data.title !== undefined) {
      const current = await this.prisma.hrJob.findUnique({ where: { id }, select: { ref: true } });
      if (current) {
        slugUpdate = { slug: this.generateSlug(data.title, current.ref) };
      }
    }
    return this.prisma.hrJob.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        ...(data.title !== undefined && { title: data.title }),
        ...slugUpdate,
        ...(dept !== undefined && { dept }),
        ...(loc !== undefined && { loc }),
        ...(data.ref !== undefined && { ref: data.ref }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.description !== undefined && { description: data.description }),
        ...(missions !== undefined && { missions }),
        ...(data.responsibilities !== undefined && { responsibilities: data.responsibilities }),
        ...(academicLevel !== undefined && { academicLevel }),
        ...(experience !== undefined && { experience }),
        ...(data.skillsRequired !== undefined && { skillsRequired: data.skillsRequired }),
        ...(data.assets !== undefined && { assets: data.assets }),
        ...(data.salary !== undefined && { salary: data.salary }),
        ...(data.contractType !== undefined && { contractType: data.contractType }),
        ...(publishedAt !== undefined && { publishedAt }),
      },
    });
  }

  /**
   * Désactiver une offre d'emploi — passe le statut à DÉSACTIVÉE.
   * L'offre n'est plus visible publiquement mais n'est pas supprimée.
   * Les candidatures existantes sont préservées.
   */
  async deactivateJob(id: string) {
    const job = await this.prisma.hrJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Offre d'emploi avec l'ID ${id} non trouvée`);
    }
    if (job.status !== 'PUBLIÉE') {
      throw new BadRequestException(
        `Seule une offre publiée peut être désactivée. Statut actuel : ${job.status}`
      );
    }
    return this.prisma.hrJob.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        status: 'DÉSACTIVÉE',
      },
    });
  }

  /**
   * Republication d'une offre désactivée — repasse le statut à PUBLIÉE
   * et met à jour la date de publication à maintenant.
   */
  async republishJob(id: string) {
    const job = await this.prisma.hrJob.findUnique({ where: { id } });
    if (!job) {
      throw new NotFoundException(`Offre d'emploi avec l'ID ${id} non trouvée`);
    }
    if (job.status !== 'DÉSACTIVÉE') {
      throw new BadRequestException(
        `Seule une offre désactivée peut être republicquée. Statut actuel : ${job.status}`
      );
    }
    return this.prisma.hrJob.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        status: 'PUBLIÉE',
        publishedAt: new Date(),
      },
    });
  }

  async getJobBySlug(slug: string) {
    const job = await this.prisma.hrJob.findUnique({
      where: { slug },
      include: {
        _count: { select: { applications: true } },
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!job) {
      throw new NotFoundException(`Offre d'emploi avec le slug "${slug}" non trouvée`);
    }
    return job;
  }

  async deleteJob(id: string) {
    // 0. Capture tenantId before deletion (needed for sequence reset check)
    const jobForTenant = await this.prisma.hrJob.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    const tenantId = jobForTenant?.tenantId;

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
      const deleted = await tx.hrJob.delete({ where: { id } });
    });

    // 3. Reset job number sequence if no more jobs exist for this tenant
    if (tenantId) {
      try {
        const remaining = await this.prisma.hrJob.count({ where: { tenantId } });
        if (remaining === 0) {
          await this.prisma.jobNumberSequence.updateMany({
            where: { tenantId },
            data: { current: 0 },
          });
        }
      } catch { /* best-effort — sequence reset is non-critical */ }
    }

    // 4. Clean up files from storage (best-effort, after DB deletion)
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
    const candidates = await this.prisma.hrCandidate.findMany({
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
        testResults: true,
        academicProfile: true,
        academicScores: true,
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ─── Compute finalScore for each candidate ──────────────────────────
    // The finalScore combines document analysis (AI/heuristic) with real
    // interview and test scores. This is the score used for hiring decisions.
    return candidates.map(candidate => {
      const primaryApp = candidate.applications?.[0];
      const docScore = primaryApp?.score || 0; // AI/heuristic document analysis score

      // Average interview score (0-100)
      const interviewScores = (candidate.interviews || [])
        .map(i => i.score)
        .filter(s => s > 0);
      const avgInterviewScore = interviewScores.length > 0
        ? Math.round(interviewScores.reduce((a, b) => a + b, 0) / interviewScores.length)
        : null;

      // Average test score (0-100)
      const testScores = (candidate.testResults || [])
        .map(t => t.score)
        .filter(s => s > 0);
      const avgTestScore = testScores.length > 0
        ? Math.round(testScores.reduce((a, b) => a + b, 0) / testScores.length)
        : null;

      // Compute finalScore based on available data
      let finalScore: number;
      let scoreBreakdown: string;

      if (avgInterviewScore !== null && avgTestScore !== null) {
        // Full evaluation: doc 30% + interview 35% + test 35%
        finalScore = Math.round((docScore * 0.3) + (avgInterviewScore * 0.35) + (avgTestScore * 0.35));
        scoreBreakdown = `Documents: ${docScore}% | Entretien: ${avgInterviewScore}% | Test: ${avgTestScore}%`;
      } else if (avgInterviewScore !== null) {
        // Interview only: doc 40% + interview 60%
        finalScore = Math.round((docScore * 0.4) + (avgInterviewScore * 0.6));
        scoreBreakdown = `Documents: ${docScore}% | Entretien: ${avgInterviewScore}%`;
      } else if (avgTestScore !== null) {
        // Test only: doc 40% + test 60%
        finalScore = Math.round((docScore * 0.4) + (avgTestScore * 0.6));
        scoreBreakdown = `Documents: ${docScore}% | Test: ${avgTestScore}%`;
      } else {
        // No interview/test yet: doc score only
        finalScore = docScore;
        scoreBreakdown = `Documents: ${docScore}% (en attente entretien/test)`;
      }

      return {
        ...candidate,
        _finalScore: finalScore,
        _avgInterviewScore: avgInterviewScore,
        _avgTestScore: avgTestScore,
        _scoreBreakdown: scoreBreakdown,
      };
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
      // and follows the same flow as public applications
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

      // Return the candidate WITH its applications so the frontend
      // can properly display it in the candidature tab
      return tx.hrCandidate.findUnique({
        where: { id: candidate.id },
        include: {
          applications: {
            include: { job: true },
          },
          academicProfile: true,
          documents: true,
        },
      });
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
    // ─── Scoring: No more random scores! ─────────────────────────────────
    // When an application is created internally (not via public apply),
    // we start with 0 scores. The AI/heuristic document analysis score
    // will be set when documents are analyzed. Interview and test scores
    // are entered separately and factored into the final score.
    const scoreCV = 0;
    const scoreLetter = 0;
    const scoreMatching = 0;
    const score = 0;
    const risks = 'Aucun';

    // If the candidate already has profile data, use heuristic scoring
    if (data.candidateId) {
      try {
        const candidate = await this.prisma.hrCandidate.findUnique({
          where: { id: data.candidateId },
          include: {
            academicProfile: true,
            documents: true,
          },
        });

        if (candidate) {
          const hasCV = candidate.documents?.some(d => d.documentType === 'CV') ?? false;
          const hasApplicationLetter = candidate.documents?.some(d => d.documentType === 'APPLICATION_LETTER') ?? false;
          const hasLetter = candidate.documents?.some(d => d.documentType === 'COVER_LETTER') ?? false;
          const skills = candidate.academicProfile?.subjects ?? [];
          const cvName = hasCV ? 'CV téléchargé' : 'Non fourni';
          const applicationLetterName = hasApplicationLetter ? 'Lettre de demande d\'emploi téléchargée' : '';
          const letterName = hasLetter ? 'Lettre de motivation téléchargée' : 'Non fournie';

          // Parse experiences from pedagogicalExperience JSON
          let experiences: any[] = [];
          let education: any[] = [];
          try {
            if (candidate.academicProfile?.pedagogicalExperience) {
              const parsed = JSON.parse(candidate.academicProfile.pedagogicalExperience);
              experiences = parsed.experiences || [];
              education = parsed.education || [];
            }
          } catch {}

          const heuristic = this.generateHeuristicScores(hasCV, hasApplicationLetter, hasLetter, cvName, applicationLetterName, letterName, skills, experiences, education);
          return this.prisma.hrApplication.create({
            data: {
              ...prismaCreateDefaults(),
              tenantId,
              jobId: data.jobId,
              candidateId: data.candidateId,
              status: data.status || 'NOUVEAU',
              score: heuristic.score,
              scoreCV: heuristic.scoreCV,
              scoreLetter: heuristic.scoreLetter,
              scoreMatching: heuristic.scoreMatching,
              risks: heuristic.risks,
              riskDetail: heuristic.riskDetail,
              matchDetail: heuristic.matchDetail,
            },
          });
        }
      } catch (err: any) {
        this.logger.warn(`Could not compute heuristic scores for internal application: ${err.message}`);
      }
    }

    // Fallback: create with 0 scores and pending analysis note
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
        riskDetail: null,
        matchDetail: 'En attente d\'analyse. Le score sera calculé après analyse des documents et passage des entretiens/tests.',
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
      try {
        // ═══════════════════════════════════════════════════════════════════
        // PHASE 1: Pre-flight checks & data preparation (OUTSIDE transaction)
        // ═══════════════════════════════════════════════════════════════════
        // Any failure here does NOT kill the main transaction.

        const application = await this.prisma.hrApplication.findUnique({
          where: { id },
          include: { candidate: true, job: true },
        });
        if (!application) {
          throw new NotFoundException(`Candidature avec l'ID ${id} non trouvée`);
        }

        if (!application.candidate?.firstName || !application.candidate?.lastName) {
          throw new BadRequestException('Impossible d\'embaucher : le nom ou prénom du candidat est manquant.');
        }
        if (!application.job?.title) {
          throw new BadRequestException('Impossible d\'embaucher : le poste du candidat n\'est pas défini.');
        }

        // Check if employee already exists with this email
        const existingStaff = await this.prisma.staff.findFirst({
          where: { email: application.candidate.email, tenantId: application.tenantId }
        });

        // Find academic year if available (outside transaction — read-only)
        const currentYear = await this.prisma.academicYear.findFirst({
          where: { tenantId: application.tenantId, isActive: true }
        });

        // ─── Generate matricules (OUTSIDE the main transaction) ─────────
        // This is critical: if matricule generation fails, it must NOT
        // abort the main PostgreSQL transaction (which would cascade-fail
        // all subsequent operations).
        let globalMatricule: string | null = null;
        let tenantMatricule: string | null = null;

        if (!existingStaff) {
          try {
            const schoolCode = await this.matriculeService.getSchoolCode(application.tenantId);
            const registrationYear = new Date().getFullYear();

            // Generate global matricule by counting existing Staff records
            const year2 = registrationYear.toString().slice(-2);
            const prefix = `AH-STF-${year2}-`;
            const existingGlobal = await this.prisma.staff.findMany({
              where: { globalMatricule: { startsWith: prefix } },
              select: { globalMatricule: true },
            });
            let maxSeq = 0;
            for (const s of existingGlobal) {
              if (s.globalMatricule) {
                const seq = parseInt(s.globalMatricule.replace(prefix, ''), 10);
                if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
              }
            }
            globalMatricule = `${prefix}${String(maxSeq + 1).padStart(6, '0')}`;

            // Generate tenant matricule via StaffNumberSequence upsert (real tenantId — FK is satisfied)
            const seq = await this.prisma.staffNumberSequence.upsert({
              where: { tenantId: application.tenantId },
              create: { ...prismaCreateNoCreatedAt(), tenantId: application.tenantId, current: 1 },
              update: { current: { increment: 1 } },
            });
            const tenantPadded = String(seq.current).padStart(5, '0');
            tenantMatricule = `${schoolCode}-${year2}-${tenantPadded}`;

            this.logger.log(`Matricules generated: global=${globalMatricule}, tenant=${tenantMatricule}`);
          } catch (matErr: any) {
            this.logger.warn(`Matricule generation failed (non-blocking): ${matErr?.message || matErr}`);
            // Continue without matricules — the hire can still proceed
          }
        }

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 2: Main transaction — create Staff + Contract
        // ═══════════════════════════════════════════════════════════════════
        return await this.prisma.$transaction(async (tx) => {
          // Update application status to EMBAUCHÉ
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

          let staffRecord = existingStaff;

          if (!existingStaff) {
            // Determine roleType
            const jobTitle = (application.job.title || '').toLowerCase();
            const isTeacher = jobTitle.includes('enseignant') || jobTitle.includes('prof') || jobTitle.includes('teacher') || jobTitle.includes('instituteur');
            const roleType = isTeacher ? 'TEACHER' : 'ADMIN';

            // Parse salary (if it's a number like 400000 or "400 000 FCFA")
            let parsedSalary: Prisma.Decimal | null = null;
            if (application.job.salary) {
              const allDigits = application.job.salary.replace(/[^0-9]/g, '');
              if (allDigits) {
                const num = Number(allDigits);
                if (!isNaN(num) && isFinite(num)) {
                  parsedSalary = new Prisma.Decimal(num);
                }
              }
            }

            // Generate employee number based on school code (tenant matricule format)
            // Format: <CODE_ECOLE>-YY-XXXXX (e.g., AHACAD-26-00001)
            // Falls back to STF-YY-XXXXX if matricule generation failed
            const employeeNumber = tenantMatricule
              || `STF-${new Date().getFullYear().toString().slice(-2)}-${String(Date.now()).slice(-5)}`;

            // Build staff data — explicitly list ALL fields to avoid spreading unknown keys
            const staffData: Record<string, any> = {
              id: uuid(),
              createdAt: now(),
              updatedAt: now(),
              tenantId: application.tenantId,
              academicYearId: currentYear?.id || null,
              employeeNumber,
              globalMatricule,
              tenantMatricule,
              firstName: application.candidate.firstName,
              lastName: application.candidate.lastName,
              gender: application.candidate.gender || null,
              email: application.candidate.email || null,
              phone: application.candidate.phone || null,
              address: application.candidate.address || null,
              position: application.job.title || null,
              department: application.job.dept || null,
              roleType,
              hireDate: new Date(),
              contractType: application.job.contractType || 'CDI',
              status: 'PENDING_SIGNATURE',
              salary: parsedSalary,
            };

            this.logger.log(`Creating staff: employeeNumber=${employeeNumber}, globalMatricule=${globalMatricule}, tenantMatricule=${tenantMatricule}`);

            staffRecord = await tx.staff.create({ data: staffData });
            this.logger.log(`Staff created: id=${staffRecord.id}, employeeNumber=${staffRecord.employeeNumber}`);
          }

          // Link staffId on the application (whether newly created or existing staff)
          // This MUST happen regardless — previously it was only inside the `if (!existingStaff)` block
          if (staffRecord) {
            await tx.hrApplication.update({
              where: { id },
              data: {
                ...prismaUpdateDefaults(),
                staffId: staffRecord.id,
              },
            });
          }

          // ─── 3. Auto-create Contract (directly in the same transaction) ───
          let contract = null;
          if (staffRecord) {
            const contractType = application.job.contractType || 'CDI';
            let baseSalary = new Prisma.Decimal(0);
            if (application.job.salary) {
              const allDigits = application.job.salary.replace(/[^0-9]/g, '');
              if (allDigits) {
                const num = Number(allDigits);
                if (!isNaN(num) && isFinite(num)) {
                  baseSalary = new Prisma.Decimal(num);
                }
              }
            }

            // Deactivate any existing active/pending contracts for this staff
            try {
              await tx.contract.updateMany({
                where: { staffId: staffRecord.id, tenantId: application.tenantId, status: { in: ['ACTIVE', 'PENDING'] } },
                data: {
                  status: 'EXPIRED',
                  ...prismaUpdateDefaults(),
                },
              });
            } catch (deactErr: any) {
              this.logger.warn(`Failed to deactivate existing contracts: ${deactErr?.message}`);
              // Non-blocking: continue to create new contract
            }

            // Build contract data — explicitly list ALL fields
            const contractData: Record<string, any> = {
              id: uuid(),
              createdAt: now(),
              updatedAt: now(),
              tenantId: application.tenantId,
              staffId: staffRecord.id,
              contractType,
              startDate: new Date(),
              baseSalary,
              paymentMode: 'BANK',
              status: 'PENDING',
            };

            if (currentYear?.id) {
              contractData.academicYearId = currentYear.id;
            }

            try {
              contract = await tx.contract.create({
                data: contractData,
                include: { staff: true },
              });
              this.logger.log(`Contrat auto-créé pour ${application.candidate.firstName} ${application.candidate.lastName} — Contrat ID: ${contract.id}`);
            } catch (contractErr: any) {
              // Contract creation failure should NOT block the hire
              this.logger.error(`Échec création contrat [${contractErr?.constructor?.name}]: ${contractErr.message}`, contractErr.stack);
            }
          }

          return { ...updatedApp, staff: staffRecord, contract };
        }).then(async (hireResult) => {
          // ─── EMAIL NOTIFICATION — embauche ──────────────────────────────
          // Fire-and-forget — never blocks the hire process.
          try {
            const app = await this.prisma.hrApplication.findUnique({
              where: { id },
              select: { candidateId: true, tenantId: true, jobId: true, candidate: { select: { email: true } } },
            });
            if (app?.candidateId && app?.tenantId && app?.jobId) {
              this.notificationService
                .notifyHired({
                  candidateId: app.candidateId,
                  tenantId: app.tenantId,
                  jobId: app.jobId,
                  contractType: (hireResult as any)?.contract?.type,
                  startDate: (hireResult as any)?.contract?.startDate,
                  salary: (hireResult as any)?.contract?.baseSalary
                    ? String((hireResult as any).contract.baseSalary)
                    : undefined,
                })
                .catch((err) => {
                  this.logger.error(`EMBAUCHÉ: failed to send notification: ${err.message}`);
                });
            }
          } catch (err: any) {
            this.logger.warn(`EMBAUCHÉ: notification pre-check failed: ${err.message}`);
          }
          return hireResult;
        });
      } catch (txErr: any) {
        // If it's already an HttpException (BadRequestException, etc.), re-throw it
        if (txErr instanceof HttpException) {
          throw txErr;
        }
        // Otherwise, wrap it in a BadRequestException with full details
        this.logger.error(`EMBAUCHÉ transaction FAILED [${txErr?.constructor?.name}]: ${txErr.message}`, txErr.stack);
        throw new BadRequestException(
          `Erreur lors de l'embauche [${txErr?.constructor?.name}]: ${txErr.message?.replace(/\n/g, ' ').substring(0, 500)}`
        );
      }
    }

    // ─── 4. Non-EMBAUCHÉ — simple status update ────────────────────────────
    const updated = await this.prisma.hrApplication.update({
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

    // ─── EMAIL NOTIFICATION — rejet ──────────────────────────────────────
    // If the application was just rejected, notify the candidate.
    if (status === 'REJETÉ' && updated.candidateId && updated.tenantId && updated.jobId) {
      this.notificationService
        .notifyRejected({
          candidateId: updated.candidateId,
          tenantId: updated.tenantId,
          jobId: updated.jobId,
          reason: review,
        })
        .catch((err) => {
          this.logger.error(`REJETÉ: failed to send notification: ${err.message}`);
        });
    }

    return updated;
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
        meetingLink: data.meetingLink || null,
        phoneNumber: data.phoneNumber || null,
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

    // ─── EMAIL NOTIFICATION — entretien programmé ─────────────────────────
    // Fire-and-forget — never blocks the response.
    this.notificationService
      .getJobIdForCandidate(data.candidateId)
      .then((jobId) => {
        if (!jobId) return null;
        return this.notificationService.notifyInterviewScheduled({
          candidateId: data.candidateId,
          tenantId,
          jobId,
          interviewDate: parsedDate,
          interviewTime: data.time,
          format: data.format || 'Visioconférence',
          evaluator: data.evaluator,
          type: data.type,
          meetingLink: data.meetingLink || undefined,
          phoneNumber: data.phoneNumber || undefined,
        });
      })
      .catch((err) => {
        this.logger.error(`createInterview: failed to send notification: ${err.message}`);
      });

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
    if (data.meetingLink !== undefined) updateData.meetingLink = data.meetingLink || null;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber || null;

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

    // ─── EMAIL NOTIFICATION — résultat entretien ──────────────────────────
    // Only send if interview was just TERMINATED (status=TERMINÉ + result provided)
    if (data.status === 'TERMINÉ' && data.result && updated.candidateId && updated.tenantId) {
      this.notificationService
        .getJobIdForCandidate(updated.candidateId)
        .then((jobId) => {
          if (!jobId) return null;
          return this.notificationService.notifyInterviewResult({
            candidateId: updated.candidateId,
            tenantId: updated.tenantId,
            jobId,
            result: data.result,
            score: typeof data.score === 'number' ? data.score : undefined,
            feedback: data.feedback,
            evaluator: updated.evaluator,
            interviewDate: updated.date,
          });
        })
        .catch((err) => {
          this.logger.error(`updateInterview: failed to send result notification: ${err.message}`);
        });
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
    }).then(async (updated) => {
      // ─── EMAIL NOTIFICATION — résultat entretien ──────────────────────────
      // Déclenché après validation (status=TERMINÉ + result fourni).
      // Fire-and-forget : n'échoue jamais l'opération métier.
      // On n'envoie l'email QUE si le résultat est RÉUSSI ou ÉCHOUÉ
      // (pas pour EN_ATTENTE qui n'est pas un résultat final).
      const finalResult = (data.result || '').toUpperCase();
      const isFinalResult = finalResult === 'RÉUSSI' || finalResult === 'ÉCHOUÉ' || finalResult === 'ÉCHEC';
      if (isFinalResult && interview.candidateId && interview.tenantId) {
        try {
          const jobId = await this.notificationService.getJobIdForCandidate(interview.candidateId);
          if (jobId) {
            this.notificationService
              .notifyInterviewResult({
                candidateId: interview.candidateId,
                tenantId: interview.tenantId,
                jobId,
                result: data.result,
                score: typeof score === 'number' && !isNaN(score) ? score : undefined,
                feedback: data.feedback,
                evaluator: interview.evaluator,
                interviewDate: interview.date,
              })
              .catch((err) => {
                this.logger.error(`validateInterview: failed to send result notification: ${err.message}`);
              });
            this.logger.log(`validateInterview: interview result email queued for candidate ${interview.candidateId} (result=${data.result})`);
          } else {
            this.logger.warn(`validateInterview: no jobId found for candidate ${interview.candidateId} — skipping email notification`);
          }
        } catch (err: any) {
          this.logger.error(`validateInterview: notification pre-check failed: ${err.message}`);
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
    }).then(async (testResult) => {
      // ─── EMAIL NOTIFICATION — résultat test ──────────────────────────────
      // Notify candidate of test result (fire-and-forget).
      try {
        const candidate = await this.prisma.hrCandidate.findUnique({
          where: { id: data.candidateId },
          select: { tenantId: true },
        });
        if (candidate?.tenantId) {
          const jobId = await this.notificationService.getJobIdForCandidate(data.candidateId);
          if (jobId) {
            // Fetch test details for context
            const test = await this.prisma.hrTest.findUnique({
              where: { id: data.testId },
              select: { name: true, type: true, maxScore: true, passingScore: true },
            });
            this.notificationService
              .notifyTestResult({
                candidateId: data.candidateId,
                tenantId: candidate.tenantId,
                jobId,
                result: data.result || 'RÉUSSI',
                score,
                maxScore: test?.maxScore,
                passingScore: test?.passingScore,
                testName: test?.name,
                feedback: data.notes,
              })
              .catch((err) => {
                this.logger.error(`createTestResult: failed to send notification: ${err.message}`);
              });
          }
        }
      } catch (err: any) {
        this.logger.warn(`createTestResult: notification pre-check failed: ${err.message}`);
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
    const startTime = Date.now();

    // ─── Duplicate prevention ──────────────────────────────────────────────
    // Reject if the same email has already applied to the same job within
    // this tenant. We check HrCandidate by email + tenantId, then look for
    // an existing HrApplication linking that candidate to the same jobId.
    if (body.email && body.jobId && tenantId) {
      const existingCandidate = await this.prisma.hrCandidate.findFirst({
        where: {
          email: body.email,
          tenantId,
        },
        select: { id: true },
      });

      if (existingCandidate) {
        const existingApplication = await this.prisma.hrApplication.findFirst({
          where: {
            candidateId: existingCandidate.id,
            jobId: body.jobId,
          },
          select: { id: true },
        });

        if (existingApplication) {
          this.logger.warn(`Duplicate application blocked: email=${body.email}, jobId=${body.jobId}, tenantId=${tenantId}`);
          throw new ConflictException(
            'Vous avez déjà soumis une candidature pour cette offre. Il n\'est pas possible de postuler deux fois au même poste.'
          );
        }
      }
    }

    // Parse structured data from request body
    // ─── Robust parsing ────────────────────────────────────────────────────
    // The frontend sends these as JSON strings (FormData.append('x', JSON.stringify(...)))
    // but in some edge cases (e.g. empty array → "[]"), the validation pipe or
    // multer may pass them as already-parsed objects. We handle both cases.
    let skills: string[] = [];
    let experiences: any[] = [];
    let education: any[] = [];
    try {
      // Helper: accept string (JSON), array, or object — return parsed value or []
      const parseField = (val: any, fieldName: string): any[] => {
        if (val == null || val === '') return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          const trimmed = val.trim();
          if (!trimmed) return [];
          try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : [];
          } catch (e) {
            this.logger.warn(`Failed parsing ${fieldName}: "${trimmed.substring(0, 200)}" — ${e.message}`);
            return [];
          }
        }
        // Object (not array) — return as single-element array
        if (typeof val === 'object') return [val];
        return [];
      };

      skills = parseField(body.skills, 'skills');
      experiences = parseField(body.experiences, 'experiences');
      education = parseField(body.education, 'education');

      // ─── DEBUG LOG — trace what we received ──────────────────────────────
      // Helps diagnose if the frontend is sending the right shape or if the
      // validation pipe strips fields.
      this.logger.log(
        `applyJob structured data: skills=${JSON.stringify(skills).substring(0, 200)} (${skills.length} items), ` +
        `experiences=${JSON.stringify(experiences).substring(0, 200)} (${experiences.length} items), ` +
        `education=${JSON.stringify(education).substring(0, 200)} (${education.length} items), ` +
        `pitch=${(body.pitch || '').substring(0, 100).length} chars, ` +
        `linkedinUrl=${body.linkedinUrl || 'N/A'}`,
      );
    } catch (e) {
      this.logger.warn('Failed parsing structured profile details:', e);
    }

    const pitch = body.pitch || '';
    const linkedinUrl = body.linkedinUrl || '';
    const pedagogicalExperience = JSON.stringify({ experiences, pitch, education, linkedinUrl });

    // Generate scores and detail reports based on files
    const hasCV = files?.cv && files.cv.length > 0;
    const hasApplicationLetter = files?.applicationLetter && files.applicationLetter.length > 0;
    const hasLetter = files?.coverLetter && files.coverLetter.length > 0;

    const cvName = hasCV ? files.cv[0].originalname : 'Profil LinkedIn / Candidature Simplifiée';
    const applicationLetterName = hasApplicationLetter ? files.applicationLetter[0].originalname : '';
    const letterName = hasLetter ? files.coverLetter[0].originalname : 'Pitch de motivation intégré';

    // ─── FAST PATH: compute heuristic scores SYNCHRONOUSLY ────────────────
    // The candidate is created IMMEDIATELY with heuristic scores so the user
    // gets a sub-second response. The AI analysis (OpenRouter HDIE) runs in
    // the BACKGROUND and updates the record when complete — see
    // `scheduleAiAnalysis()` below.
    //
    // This is critical because:
    //   1. OpenRouter calls take 15-60s (LLM inference)
    //   2. Vercel function timeout is 10s (Hobby) / 60s (Pro)
    //   3. The user expects "fraction of a second" UX for button clicks
    let scoreCV: number;
    let scoreLetter: number;
    let scoreMatching: number;
    let score: number;
    let matchDetail: string;
    let risks: string;
    let riskDetail: string | null;

    ({
      scoreCV,
      scoreLetter,
      scoreMatching,
      score,
      matchDetail,
      risks,
      riskDetail,
    } = this.generateHeuristicScores(
      hasCV,
      hasApplicationLetter,
      hasLetter,
      cvName,
      applicationLetterName,
      letterName,
      skills,
      experiences,
      education,
    ));

    this.logger.log(
      `applyJob: heuristic scores computed in ${Date.now() - startTime}ms — scoreCV=${scoreCV}, scoreLetter=${scoreLetter}, scoreMatching=${scoreMatching}`,
    );

    // ─── Parallel file uploads ────────────────────────────────────────────
    // Previously: 4 sequential uploads × 2-5s each = 8-20s
    // Now: 4 parallel uploads ≈ 2-5s total
    const uploadPromises: Array<Promise<{ type: string; file: Express.Multer.File | null; path: string | null }>> = [];

    if (hasCV) {
      uploadPromises.push(
        this.storageService
          .uploadFile(files.cv[0], `candidate-docs/${tenantId}/pending/cv`)
          .then((path) => ({ type: 'cv', file: files.cv[0] as Express.Multer.File, path }))
          .catch((err) => {
            this.logger.error(`CV upload failed: ${err.message}`);
            return { type: 'cv', file: files.cv[0] as Express.Multer.File, path: null };
          }),
      );
    }

    if (hasApplicationLetter) {
      uploadPromises.push(
        this.storageService
          .uploadFile(files.applicationLetter[0], `candidate-docs/${tenantId}/pending/application-letter`)
          .then((path) => ({ type: 'applicationLetter', file: files.applicationLetter[0] as Express.Multer.File, path }))
          .catch((err) => {
            this.logger.error(`Application letter upload failed: ${err.message}`);
            return { type: 'applicationLetter', file: files.applicationLetter[0] as Express.Multer.File, path: null };
          }),
      );
    }

    if (hasLetter) {
      uploadPromises.push(
        this.storageService
          .uploadFile(files.coverLetter[0], `candidate-docs/${tenantId}/pending/cover-letter`)
          .then((path) => ({ type: 'coverLetter', file: files.coverLetter[0] as Express.Multer.File, path }))
          .catch((err) => {
            this.logger.error(`Cover letter upload failed: ${err.message}`);
            return { type: 'coverLetter', file: files.coverLetter[0] as Express.Multer.File, path: null };
          }),
      );
    }

    if (files?.recommendationLetter && files.recommendationLetter.length > 0) {
      uploadPromises.push(
        this.storageService
          .uploadFile(files.recommendationLetter[0], `candidate-docs/${tenantId}/pending/recommendation`)
          .then((path) => ({ type: 'recommendationLetter', file: files.recommendationLetter[0] as Express.Multer.File, path }))
          .catch((err) => {
            this.logger.error(`Recommendation letter upload failed: ${err.message}`);
            return { type: 'recommendationLetter', file: files.recommendationLetter[0] as Express.Multer.File, path: null };
          }),
      );
    }

    const uploadResults = await Promise.all(uploadPromises);
    const uploadMap = new Map(uploadResults.map((r) => [r.type, r]));
    const cvFile = uploadMap.get('cv')?.file ?? null;
    const cvPath = uploadMap.get('cv')?.path ?? null;
    const applicationLetterFile = uploadMap.get('applicationLetter')?.file ?? null;
    const applicationLetterPath = uploadMap.get('applicationLetter')?.path ?? null;
    const letterFile = uploadMap.get('coverLetter')?.file ?? null;
    const letterPath = uploadMap.get('coverLetter')?.path ?? null;
    const recoFile = uploadMap.get('recommendationLetter')?.file ?? null;
    const recoPath = uploadMap.get('recommendationLetter')?.path ?? null;

    this.logger.log(`applyJob: file uploads completed in ${Date.now() - startTime}ms`);

    // ─── Prisma transaction: DB writes only (fast, no external I/O) ───────
    let result: any;
    try {
      result = await this.prisma.$transaction(async (tx) => {
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

        // 2. Save to AcademicProfile (has ONLY id — no createdAt, no updatedAt)
        await tx.academicProfile.create({
          data: {
            ...prismaCreateIdOnly(),
            candidateId: candidate.id,
            teachingLevel: education[0]?.degree || 'Non spécifié',
            subjects: skills,
            pedagogicalExperience,
          }
        });

        // 3. Create application with HEURISTIC scores (AI updates later)
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

        // 4. Save document references (paths already uploaded)
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

        if (applicationLetterFile && applicationLetterPath) {
          const doc = await tx.candidateDocument.create({
            data: {
              ...prismaCreateNoUpdatedAt(),
              candidateId: candidate.id,
              documentType: 'APPLICATION_LETTER',
              fileName: applicationLetterFile.originalname,
              filePath: applicationLetterPath,
              fileSize: applicationLetterFile.size,
              mimeType: applicationLetterFile.mimetype,
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

    const totalMs = Date.now() - startTime;
    this.logger.log(
      `applyJob: candidate ${result.candidate.id} created in ${totalMs}ms — scheduling AI analysis in background`,
    );

    // ─── BACKGROUND AI ANALYSIS (fire-and-forget) ─────────────────────────
    // The candidate is already saved with heuristic scores. We now schedule
    // the AI analysis to run ASYNCHRONOUSLY — when it completes, it updates
    // the HrApplication record with AI-driven scores and saves an HrAiReport.
    //
    // We DO NOT await this — the response is sent immediately to the user.
    // Errors are logged but do NOT affect the user's submission.
    this.scheduleAiAnalysis({
      candidateId: result.candidate.id,
      applicationId: result.application.id,
      jobId: body.jobId,
      tenantId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      skills,
      experiences,
      education,
      pitch,
      hasCV,
      hasApplicationLetter,
      hasLetter,
      cvName,
      applicationLetterName,
      letterName,
    }).catch((err) => {
      this.logger.error(
        `applyJob: background AI analysis failed for candidate ${result.candidate.id}: ${err.message}`,
        err.stack,
      );
    });

    // ─── EMAIL NOTIFICATION (fire-and-forget) ─────────────────────────────
    // Send "candidature reçue" email to the candidate with a full récap of
    // the data they submitted (experiences, education, skills, pitch, docs).
    // Fire-and-forget — never blocks the HTTP response.
    const documentsSubmitted: Array<{ type: string; fileName: string }> = [];
    if (cvFile && cvPath) documentsSubmitted.push({ type: 'CV', fileName: cvFile.originalname });
    if (applicationLetterFile && applicationLetterPath)
      documentsSubmitted.push({ type: 'Lettre de demande d\'emploi', fileName: applicationLetterFile.originalname });
    if (letterFile && letterPath)
      documentsSubmitted.push({ type: 'Lettre de motivation', fileName: letterFile.originalname });
    if (recoFile && recoPath)
      documentsSubmitted.push({ type: 'Lettre de recommandation', fileName: recoFile.originalname });

    this.notificationService
      .notifyApplicationReceived({
        candidateId: result.candidate.id,
        tenantId,
        jobId: body.jobId,
        experiences,
        education,
        skills,
        pitch,
        documentsSubmitted,
      })
      .catch((err) => {
        this.logger.error(
          `applyJob: failed to send candidature-reçue email to ${body.email}: ${err.message}`,
        );
      });

    return result;
  }

  /**
   * Schedule AI analysis in the background (fire-and-forget).
   *
   * This method is NOT awaited by applyJob — the user's HTTP response is sent
   * immediately with heuristic scores. When the AI analysis completes (or fails),
   * the candidate's HrApplication record is updated with the AI-driven scores
   * and an HrAiReport is saved.
   *
   * The OpenRouter call has a 90s timeout (longer than the request, since we're
   * no longer blocking the user). On any error, the heuristic scores remain in
   * place — the candidate is not affected.
   */
  private async scheduleAiAnalysis(params: {
    candidateId: string;
    applicationId: string;
    jobId: string;
    tenantId: string;
    firstName: string;
    lastName: string;
    email: string;
    skills: string[];
    experiences: any[];
    education: any[];
    pitch: string;
    hasCV: boolean;
    hasApplicationLetter: boolean;
    hasLetter: boolean;
    cvName: string;
    applicationLetterName: string;
    letterName: string;
  }): Promise<void> {
    if (!this.openRouter.isConfigured()) {
      this.logger.log('scheduleAiAnalysis: OpenRouter not configured — skipping AI analysis');
      return;
    }

    const aiStart = Date.now();

    try {
      // Fetch job details for context
      const job = await this.prisma.hrJob.findUnique({
        where: { id: params.jobId },
        select: { title: true, dept: true, description: true, skillsRequired: true, experience: true, academicLevel: true },
      });

      const candidateProfile = [
        `Nom: ${params.firstName} ${params.lastName}`,
        `Email: ${params.email}`,
        params.skills.length > 0 ? `Compétences: ${params.skills.join(', ')}` : null,
        params.experiences.length > 0
          ? `Expériences: ${params.experiences.map(e => e.title || e.position || '').filter(Boolean).join(', ')}`
          : null,
        params.education.length > 0
          ? `Formation: ${params.education.map(e => e.degree || e.diploma || '').filter(Boolean).join(', ')}`
          : null,
        params.pitch ? `Motivation: ${params.pitch.substring(0, 300)}` : null,
        params.hasCV ? `CV fourni: ${params.cvName}` : 'CV non fourni',
        params.hasApplicationLetter ? `Lettre de demande d'emploi fournie: ${params.applicationLetterName}` : null,
        params.hasLetter ? `Lettre de motivation fournie: ${params.letterName}` : 'Lettre de motivation non fournie',
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
Tu évalues l'adéquation du candidat au poste en te basant sur les informations fournies, y compris le CV, la lettre de demande d'emploi (courrier formel de candidature) et la lettre de motivation (lettre d'argumentation personnelle).

RÈGLES DE SCORING:
- scoreCV (0-100): Qualité et pertinence du CV/Profil par rapport au poste. Si pas de CV, base-toi sur les compétences déclarées (max 70).
- scoreLetter (0-100): Qualité globale des lettres fournies (lettre de demande d'emploi ET lettre de motivation). Si une seule lettre est fournie, évalue celle-ci (max 80). Si les deux sont fournies, valorise la complétude (jusqu'à 100). Si aucune lettre mais un pitch, évalue le pitch (max 60). Si rien, max 40.
- scoreMatching (0-100): Adéquation globale du profil avec les exigences du poste.
- matchDetail: Résumé en 2-3 phrases de l'analyse d'adéquation.
- risks: "Aucun", "Faible", "Moyen", ou "Élevé" selon les incohérences détectées.
- riskDetail: Description du risque si risks !== "Aucun", sinon null.
- analysis: Analyse détaillée du profil en 3-5 phrases couvrant le CV, la lettre de demande d'emploi et la lettre de motivation.

Réponds UNIQUEMENT en JSON valide.`,
        'HDIE',
      );

      if (!aiResult.data || aiResult.isPlaceholder) {
        this.logger.warn(
          `scheduleAiAnalysis: AI returned placeholder for candidate ${params.candidateId} — keeping heuristic scores`,
        );
        return;
      }

      // ─── Update application with AI scores ────────────────────────────────
      const aiScoreCV = Math.max(0, Math.min(100, aiResult.data.scoreCV));
      const aiScoreLetter = Math.max(0, Math.min(100, aiResult.data.scoreLetter));
      const aiScoreMatching = Math.max(0, Math.min(100, aiResult.data.scoreMatching));
      const aiScore = Math.round((aiScoreCV * 0.4) + (aiScoreLetter * 0.2) + (aiScoreMatching * 0.4));
      const aiRisks = ['Aucun', 'Faible', 'Moyen', 'Élevé'].includes(aiResult.data.risks) ? aiResult.data.risks : 'Aucun';
      const aiRiskDetail = aiResult.data.riskDetail || null;
      const aiMatchDetail = aiResult.data.matchDetail || `Candidature analysée par HDIE. CV: ${params.cvName}. Présentation: ${params.letterName}.`;
      const aiReportContent = JSON.stringify(aiResult.data);

      await this.prisma.$transaction(async (tx) => {
        // Update application with AI scores
        await tx.hrApplication.update({
          where: { id: params.applicationId },
          data: {
            ...prismaUpdateDefaults(),
            score: aiScore,
            scoreCV: aiScoreCV,
            scoreLetter: aiScoreLetter,
            scoreMatching: aiScoreMatching,
            risks: aiRisks,
            riskDetail: aiRiskDetail,
            matchDetail: aiMatchDetail,
          },
        });

        // Save AI report
        try {
          await tx.hrAiReport.create({
            data: {
              id: uuid(),
              candidateId: params.candidateId,
              applicationId: params.applicationId,
              reportType: 'APPLICATION_ANALYSIS',
              content: aiReportContent,
              generatedAt: new Date(),
            }
          });
        } catch (reportErr: any) {
          this.logger.warn(`scheduleAiAnalysis: failed to save AI report: ${reportErr.message}`);
        }
      }, {
        maxWait: 5_000,
        timeout: 15_000,
      });

      this.logger.log(
        `scheduleAiAnalysis: AI analysis complete for candidate ${params.candidateId} in ${Date.now() - aiStart}ms — scoreCV=${aiScoreCV}, scoreLetter=${aiScoreLetter}, scoreMatching=${aiScoreMatching}, risks=${aiRisks}`,
      );
    } catch (aiErr: any) {
      this.logger.warn(
        `scheduleAiAnalysis: AI analysis failed for candidate ${params.candidateId} in ${Date.now() - aiStart}ms — ${aiErr.message}. Keeping heuristic scores.`,
      );
      // Heuristic scores are already in the DB — nothing to do.
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
    hasApplicationLetter: boolean,
    hasLetter: boolean,
    cvName: string,
    applicationLetterName: string,
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

    // Letter score: based on presence of lettre de demande d'emploi AND/OR lettre de motivation
    // Both letters contribute — having both signals a stronger application.
    let scoreLetter = 40; // base
    if (hasApplicationLetter) scoreLetter += 25; // lettre de demande d'emploi (required by spec)
    if (hasLetter) scoreLetter += 15; // lettre de motivation (optional)
    if (experiences.length > 0) scoreLetter += 10;
    if (education.length > 0) scoreLetter += 10;

    // Matching score: overall profile completeness
    let scoreMatching = 45; // base
    if (hasCV) scoreMatching += 15;
    if (hasApplicationLetter) scoreMatching += 8;
    if (hasLetter) scoreMatching += 5;
    if (skills.length >= 3) scoreMatching += 10;
    if (experiences.length > 0) scoreMatching += 10;
    if (education.length > 0) scoreMatching += 7;

    // Clamp to 0-100
    scoreCV = Math.min(100, scoreCV);
    scoreLetter = Math.min(100, scoreLetter);
    scoreMatching = Math.min(100, scoreMatching);

    const score = Math.round((scoreCV * 0.4) + (scoreLetter * 0.2) + (scoreMatching * 0.4));

    const docsSummary = [
      hasCV ? `CV: ${cvName}` : null,
      hasApplicationLetter ? `Lettre de demande d'emploi: ${applicationLetterName}` : null,
      hasLetter ? `Lettre de motivation: ${letterName}` : null,
    ].filter(Boolean).join('. ') || 'Aucun document fourni';

    const matchDetail = `Candidature analysée par heuristiques. ${docsSummary}. Profil avec ${skills.length} compétence(s), ${experiences.length} expérience(s), ${education.length} formation(s).`;

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

  // ============================================================================
  // RECRUITER PROFILE — Configuration du recruteur par tenant
  // ============================================================================

  /**
   * Récupère le profil de recruteur actif pour ce tenant.
   * Retourne null si aucun profil n'est configuré.
   */
  async getRecruiterProfile(tenantId: string) {
    try {
      const profile = await this.prisma.recruiterProfile.findFirst({
        where: { tenantId, isActive: true },
      });
      return profile;
    } catch (err: any) {
      this.logger.warn(`getRecruiterProfile failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Crée ou met à jour le profil de recruteur pour ce tenant (upsert).
   * Un tenant ne peut avoir qu'un seul profil actif à la fois (unique sur tenantId).
   */
  async upsertRecruiterProfile(tenantId: string, data: {
    recruiterType: string; // PROMOTER | DEDICATED_RH | DELEGATED
    staffId?: string | null;
    fullName: string;
    functionLabel?: string | null;
    email: string;
    phone?: string | null;
    signatureText?: string | null;
    signatureLogoUrl?: string | null;
    defaultInterviewFormat?: string;
    defaultInterviewDelayHr?: number;
    isActive?: boolean;
    createdBy?: string;
  }) {
    // Validation : si DEDICATED_RH ou DELEGATED, staffId est requis
    if ((data.recruiterType === 'DEDICATED_RH' || data.recruiterType === 'DELEGATED') && !data.staffId) {
      throw new BadRequestException(
        `staffId est requis pour le type de recruteur "${data.recruiterType}".`,
      );
    }

    // Validation : recruiterType doit être dans l'énumération
    if (!['PROMOTER', 'DEDICATED_RH', 'DELEGATED'].includes(data.recruiterType)) {
      throw new BadRequestException(
        `recruiterType invalide : "${data.recruiterType}". Valeurs autorisées : PROMOTER, DEDICATED_RH, DELEGATED.`,
      );
    }

    // Si staffId fourni, vérifier qu'il existe et appartient au tenant
    if (data.staffId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: data.staffId, tenantId },
        select: { id: true, firstName: true, lastName: true, email: true, position: true },
      });
      if (!staff) {
        throw new NotFoundException(`Staff avec l'ID ${data.staffId} non trouvé pour ce tenant.`);
      }
      // Auto-remplir fullName/email si vides (depuis le staff)
      if (!data.fullName) {
        data.fullName = `${staff.firstName || ''} ${staff.lastName || ''}`.trim();
      }
      if (!data.email && staff.email) {
        data.email = staff.email;
      }
    }

    // Upsert (insert or update) — basé sur tenantId unique
    const existing = await this.prisma.recruiterProfile.findFirst({
      where: { tenantId },
    });

    if (existing) {
      // Update
      const updated = await this.prisma.recruiterProfile.update({
        where: { id: existing.id },
        data: {
          ...prismaUpdateDefaults(),
          recruiterType: data.recruiterType,
          staffId: data.staffId || null,
          fullName: data.fullName,
          functionLabel: data.functionLabel || null,
          email: data.email,
          phone: data.phone || null,
          signatureText: data.signatureText || null,
          signatureLogoUrl: data.signatureLogoUrl || null,
          defaultInterviewFormat: data.defaultInterviewFormat || 'Visioconférence',
          defaultInterviewDelayHr: data.defaultInterviewDelayHr ?? 48,
          isActive: data.isActive ?? true,
        },
      });
      this.logger.log(`RecruiterProfile updated for tenant ${tenantId}: ${updated.fullName} (${updated.recruiterType})`);
      return updated;
    } else {
      // Create
      const created = await this.prisma.recruiterProfile.create({
        data: {
          ...prismaCreateDefaults(),
          tenantId,
          recruiterType: data.recruiterType,
          staffId: data.staffId || null,
          fullName: data.fullName,
          functionLabel: data.functionLabel || null,
          email: data.email,
          phone: data.phone || null,
          signatureText: data.signatureText || null,
          signatureLogoUrl: data.signatureLogoUrl || null,
          defaultInterviewFormat: data.defaultInterviewFormat || 'Visioconférence',
          defaultInterviewDelayHr: data.defaultInterviewDelayHr ?? 48,
          isActive: data.isActive ?? true,
          createdBy: data.createdBy || null,
        },
      });
      this.logger.log(`RecruiterProfile created for tenant ${tenantId}: ${created.fullName} (${created.recruiterType})`);
      return created;
    }
  }

  /**
   * Désactive le profil de recruteur (soft-delete — on garde l'historique).
   */
  async deactivateRecruiterProfile(tenantId: string) {
    const existing = await this.prisma.recruiterProfile.findFirst({
      where: { tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Aucun profil de recruteur configuré pour ce tenant.`);
    }
    return this.prisma.recruiterProfile.update({
      where: { id: existing.id },
      data: { ...prismaUpdateDefaults(), isActive: false },
    });
  }

  // ============================================================================
  // REAFFECTATION — Multi-postulation / réaffectation après embauche
  // ============================================================================

  /**
   * Réaffecte un candidat déjà embauché à un NOUVEAU poste.
   *
   * Cas d'usage :
   *   - Un staff enseignant est réaffecté à un poste administratif (ex: secrétaire comptable)
   *   - Le staff GARDE son poste existant (les deux postes coexistent)
   *   - Une nouvelle HrApplication est créée pour le nouveau poste
   *   - Un nouveau contrat (PENDING) est généré pour le nouveau poste
   *   - Le candidat est notifié (email "nouveau contrat à signer")
   *
   * Prérequis :
   *   - L'application source doit être EMBAUCHÉ (staffId non null)
   *   - Le nouveau job doit exister et appartenir au même tenant
   *   - Le staff ne doit pas avoir déjà une application EMBAUCHÉ pour ce même job
   */
  async reassignApplication(
    applicationId: string,
    tenantId: string,
    data: { newJobId: string; newContractType?: string; reason?: string; createdBy?: string },
  ) {
    // 1. Vérifier l'application source
    const sourceApp = await this.prisma.hrApplication.findFirst({
      where: { id: applicationId, tenantId },
      include: {
        candidate: true,
        job: true,
        staff: true,
      },
    });
    if (!sourceApp) {
      throw new NotFoundException(`Candidature ${applicationId} non trouvée.`);
    }
    if (sourceApp.status !== 'EMBAUCHÉ' || !sourceApp.staffId) {
      throw new BadRequestException(
        `La candidature source doit être au statut EMBAUCHÉ (statut actuel : ${sourceApp.status}). ` +
          `La réaffectation n'est possible qu'après une première embauche.`,
      );
    }

    // 2. Vérifier le nouveau job
    const newJob = await this.prisma.hrJob.findFirst({
      where: { id: data.newJobId, tenantId },
    });
    if (!newJob) {
      throw new NotFoundException(`Nouveau poste ${data.newJobId} non trouvé pour ce tenant.`);
    }

    // 3. Vérifier qu'il n'y a pas déjà une application EMBAUCHÉ pour ce job + ce staff
    const existingApp = await this.prisma.hrApplication.findFirst({
      where: {
        staffId: sourceApp.staffId,
        jobId: data.newJobId,
        status: 'EMBAUCHÉ',
      },
    });
    if (existingApp) {
      throw new BadRequestException(
        `Le staff est déjà embauché pour ce poste (${newJob.title}). ` +
          `Impossible de créer une seconde candidature EMBAUCHÉ pour le même poste.`,
      );
    }

    // 4. Créer une nouvelle HrApplication pour le nouveau poste, liée au même staffId
    const newApp = await this.prisma.hrApplication.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        jobId: data.newJobId,
        candidateId: sourceApp.candidateId,
        staffId: sourceApp.staffId, // Lien vers le staff existant
        status: 'EMBAUCHÉ', // Directement embauché (staff déjà créé)
        score: sourceApp.score,
        scoreCV: sourceApp.scoreCV,
        scoreLetter: sourceApp.scoreLetter,
        scoreMatching: sourceApp.scoreMatching,
        risks: sourceApp.risks,
        riskDetail: sourceApp.riskDetail,
        matchDetail: `Réaffecté depuis le poste "${sourceApp.job?.title || 'N/A'}" — ${data.reason || 'pas de motif fourni'}`,
      },
    });

    this.logger.log(
      `Réaffectation: nouvelle application ${newApp.id} créée pour le staff ${sourceApp.staffId} sur le poste "${newJob.title}" (depuis "${sourceApp.job?.title}")`,
    );

    // 5. Créer un nouveau contrat PENDING pour le nouveau poste
    let newContract = null;
    try {
      const contractType = data.newContractType || newJob.contractType || 'CDI';
      let baseSalary = new Prisma.Decimal(0);
      if (newJob.salary) {
        const num = parseFloat(String(newJob.salary));
        if (!isNaN(num) && isFinite(num)) {
          baseSalary = new Prisma.Decimal(num);
        }
      }
      // Use the existing staff's salary if the job doesn't specify one
      if (baseSalary.toNumber() === 0 && sourceApp.staff?.salary) {
        baseSalary = sourceApp.staff.salary;
      }

      newContract = await this.prisma.contract.create({
        data: {
          ...prismaCreateDefaults(),
          tenantId,
          staffId: sourceApp.staffId,
          type: contractType,
          status: 'PENDING',
          startDate: new Date(),
          baseSalary,
          terms: {
            position: newJob.title,
            department: newJob.dept || null,
            contractType,
            reason: data.reason || 'Réaffectation',
            sourceApplicationId: applicationId,
            newApplicationId: newApp.id,
          } as any,
        },
      });
      this.logger.log(`Nouveau contrat ${newContract.id} créé (PENDING) pour le staff ${sourceApp.staffId} sur le poste "${newJob.title}"`);
    } catch (contractErr: any) {
      this.logger.error(
        `Réaffectation: échec création contrat pour staff ${sourceApp.staffId} — ${contractErr.message}`,
        contractErr.stack,
      );
      // L'application est créée même si le contrat échoue — le recruteur pourra créer le contrat manuellement
    }

    // 6. Notification email (fire-and-forget)
    this.notificationService
      .notifyHired({
        candidateId: sourceApp.candidateId,
        tenantId,
        jobId: data.newJobId,
        contractType: newContract?.type || data.newContractType || newJob.contractType,
        startDate: newContract?.startDate || new Date(),
        salary: newContract?.baseSalary ? String(newContract.baseSalary) : undefined,
      })
      .catch((err) => {
        this.logger.error(`Réaffectation: notification email échouée — ${err.message}`);
      });

    return {
      newApplication: newApp,
      newContract,
      staffId: sourceApp.staffId,
      message: `Staff réaffecté au poste "${newJob.title}". Un nouveau contrat (PENDING) a été créé et le candidat a été notifié par email.`,
    };
  }

  /**
   * TEST — Renvoie l'email de notification de candidature à un candidat existant.
   * Endpoint temporaire pour tester l'envoi d'email. À supprimer après validation.
   */
  async testResendApplicationEmail(candidateId: string, tenantId: string) {
    this.logger.log(`testResendApplicationEmail: candidateId=${candidateId}, tenantId=${tenantId}`);

    // 1. Récupérer le candidat
    const candidate = await this.prisma.hrCandidate.findFirst({
      where: { id: candidateId, tenantId },
      include: {
        applications: {
          include: { job: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        academicProfile: true,
        documents: true,
      },
    });

    if (!candidate) {
      throw new NotFoundException(`Candidat ${candidateId} non trouvé`);
    }

    const primaryApp = candidate.applications?.[0];
    if (!primaryApp) {
      throw new NotFoundException(`Aucune candidature trouvée pour ce candidat`);
    }

    // 2. Parser les données structurées
    let skills: string[] = [];
    let experiences: any[] = [];
    let education: any[] = [];
    let pitch = '';
    if (candidate.academicProfile?.pedagogicalExperience) {
      try {
        const parsed = JSON.parse(candidate.academicProfile.pedagogicalExperience);
        experiences = parsed.experiences || [];
        education = parsed.education || [];
        pitch = parsed.pitch || '';
      } catch (e) {}
    }
    skills = candidate.academicProfile?.subjects || [];

    const documentsSubmitted = (candidate.documents || []).map(d => ({
      type: d.documentType,
      fileName: d.fileName,
    }));

    this.logger.log(`testResendApplicationEmail: sending to ${candidate.email}, job=${primaryApp.job?.title}`);

    // 3. Envoyer l'email DIRECTEMENT (sans passer par notifyApplicationReceived
    // qui catche les erreurs silencieusement). On veut voir l'erreur réelle.
    try {
      const { renderApplicationReceived } = await import('./recruitment-email-templates');
      const branding = await this.notificationService['getTenantBranding'](tenantId);
      const { subject, html } = renderApplicationReceived({
        branding,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        candidateFirstName: candidate.firstName || 'candidat(e)',
        jobTitle: primaryApp.job?.title || 'Poste non spécifié',
        experiences,
        education,
        skills,
        pitch,
        documentsSubmitted,
      });

      // Appel direct à sendEmail (sans try-catch qui avale l'erreur)
      await this.notificationService['sendEmail'](candidate.email, subject, html, {
        fromName: branding.recruiterName
          ? `${branding.recruiterName} — ${branding.schoolName}`
          : 'Academia Helm — Recrutement',
      });

      return {
        success: true,
        message: `Email envoyé à ${candidate.email}`,
        candidate: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email,
        job: primaryApp.job?.title,
      };
    } catch (err: any) {
      this.logger.error(`testResendApplicationEmail FAILED: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
        candidate: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email,
        job: primaryApp.job?.title,
      };
    }
  }

  /**
   * TEST — Renvoie l'email "Résultat entretien" pour un entretien existant.
   * Endpoint temporaire pour tester l'envoi d'email sans cliquer sur
   * "Valider l'entretien". À supprimer après validation.
   *
   * Utilise les données stockées sur l'entretien (result, score, feedback,
   * evaluator, date) — l'email reflète donc exactement l'état actuel.
   */
  async testResendInterviewResultEmail(interviewId: string, tenantId: string) {
    this.logger.log(`testResendInterviewResultEmail: interviewId=${interviewId}, tenantId=${tenantId}`);

    const interview = await this.prisma.hrInterview.findFirst({
      where: { id: interviewId, tenantId },
      include: {
        candidate: {
          include: {
            applications: {
              include: { job: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!interview) {
      throw new NotFoundException(`Entretien ${interviewId} non trouvé pour le tenant ${tenantId}`);
    }

    const candidate = interview.candidate;
    if (!candidate) {
      throw new NotFoundException(`Candidat lié à l'entretien ${interviewId} non trouvé`);
    }

    const primaryApp = candidate.applications?.[0];
    if (!primaryApp) {
      throw new NotFoundException(`Aucune candidature trouvée pour ce candidat — impossible de déterminer le poste`);
    }

    const result = interview.result || 'RÉUSSI';
    this.logger.log(
      `testResendInterviewResultEmail: sending to ${candidate.email}, job=${primaryApp.job?.title}, result=${result}`,
    );

    try {
      // Appel direct à sendEmail via la méthode privée du service de notification
      // pour voir l'erreur réelle (sans le try-catch qui avale les erreurs).
      const branding = await this.notificationService['getTenantBranding'](tenantId);
      const { renderInterviewResult } = await import('./recruitment-email-templates');
      const { subject, html } = renderInterviewResult({
        branding,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        candidateFirstName: candidate.firstName || 'candidat(e)',
        jobTitle: primaryApp.job?.title || 'Poste non spécifié',
        result,
        score: interview.score ?? undefined,
        feedback: interview.feedback || undefined,
        evaluator: interview.evaluator || undefined,
        interviewDate: interview.date,
      });

      await this.notificationService['sendEmail'](candidate.email, subject, html, {
        fromName: branding.recruiterName
          ? `${branding.recruiterName} — ${branding.schoolName}`
          : branding.schoolName || 'Academia Helm — Recrutement',
      });

      return {
        success: true,
        message: `Email de résultat d'entretien envoyé à ${candidate.email}`,
        candidate: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email,
        job: primaryApp.job?.title,
        result,
        score: interview.score,
        feedback: interview.feedback,
      };
    } catch (err: any) {
      this.logger.error(`testResendInterviewResultEmail FAILED: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
        candidate: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email,
        job: primaryApp.job?.title,
        result,
      };
    }
  }

  /**
   * TEST — Renvoie l'email "Résultat test" pour un test result existant.
   * Endpoint temporaire pour tester l'envoi d'email sans créer un nouveau
   * résultat de test. À supprimer après validation.
   *
   * Utilise les données stockées sur le test result + le test lui-même.
   */
  async testResendTestResultEmail(testResultId: string, tenantId: string) {
    this.logger.log(`testResendTestResultEmail: testResultId=${testResultId}, tenantId=${tenantId}`);

    const testResult = await this.prisma.hrTestResult.findFirst({
      where: { id: testResultId },
      include: {
        candidate: {
          include: {
            applications: {
              include: { job: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        test: true,
      },
    });

    if (!testResult) {
      throw new NotFoundException(`Résultat de test ${testResultId} non trouvé`);
    }

    // Vérifier que le test result appartient bien au tenant passé en paramètre
    if (testResult.test?.tenantId !== tenantId && testResult.candidate?.tenantId !== tenantId) {
      throw new NotFoundException(`Résultat de test ${testResultId} non trouvé pour le tenant ${tenantId}`);
    }

    const candidate = testResult.candidate;
    if (!candidate) {
      throw new NotFoundException(`Candidat lié au test result ${testResultId} non trouvé`);
    }

    const primaryApp = candidate.applications?.[0];
    if (!primaryApp) {
      throw new NotFoundException(`Aucune candidature trouvée pour ce candidat — impossible de déterminer le poste`);
    }

    this.logger.log(
      `testResendTestResultEmail: sending to ${candidate.email}, job=${primaryApp.job?.title}, test=${testResult.test?.name}`,
    );

    try {
      const branding = await this.notificationService['getTenantBranding'](tenantId);
      const { renderTestResult } = await import('./recruitment-email-templates');
      const { subject, html } = renderTestResult({
        branding,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        candidateFirstName: candidate.firstName || 'candidat(e)',
        jobTitle: primaryApp.job?.title || 'Poste non spécifié',
        result: testResult.result || 'RÉUSSI',
        score: testResult.score,
        maxScore: testResult.test?.maxScore,
        passingScore: testResult.test?.passingScore,
        testName: testResult.test?.name,
        feedback: testResult.notes || undefined,
      });

      await this.notificationService['sendEmail'](candidate.email, subject, html, {
        fromName: branding.recruiterName
          ? `${branding.recruiterName} — ${branding.schoolName}`
          : branding.schoolName || 'Academia Helm — Recrutement',
      });

      return {
        success: true,
        message: `Email de résultat de test envoyé à ${candidate.email}`,
        candidate: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email,
        job: primaryApp.job?.title,
        test: testResult.test?.name,
        result: testResult.result,
        score: testResult.score,
        feedback: testResult.notes,
      };
    } catch (err: any) {
      this.logger.error(`testResendTestResultEmail FAILED: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
        candidate: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email,
        job: primaryApp.job?.title,
        test: testResult.test?.name,
      };
    }
  }

  /**
   * TEST — Renvoie l'email "Résultat entretien" en retrouvant l'entretien le
   * plus récent d'un candidat par son email.
   *
   * Endpoint temporaire pour tester sans connaître l'interviewId.
   * À supprimer après validation.
   */
  async testResendInterviewResultByEmail(email: string, tenantId: string) {
    this.logger.log(`testResendInterviewResultByEmail: email=${email}, tenantId=${tenantId}`);

    if (!email || !tenantId) {
      throw new BadRequestException('email et tenantId sont requis');
    }

    // 1. Retrouver le candidat par email + tenant
    const candidate = await this.prisma.hrCandidate.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, tenantId },
      include: {
        applications: {
          include: { job: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        interviews: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException(`Aucun candidat trouvé pour l'email "${email}" sur ce tenant`);
    }

    const interview = candidate.interviews?.[0];
    if (!interview) {
      throw new NotFoundException(
        `Aucun entretien trouvé pour ${candidate.firstName} ${candidate.lastName} (${email})`,
      );
    }

    const primaryApp = candidate.applications?.[0];
    if (!primaryApp) {
      throw new NotFoundException(
        `Aucune candidature trouvée pour ce candidat — impossible de déterminer le poste`,
      );
    }

    const result = interview.result || 'RÉUSSI';
    this.logger.log(
      `testResendInterviewResultByEmail: found interview ${interview.id} (result=${result}), sending to ${candidate.email}`,
    );

    try {
      const branding = await this.notificationService['getTenantBranding'](tenantId);
      const { renderInterviewResult } = await import('./recruitment-email-templates');
      const { subject, html } = renderInterviewResult({
        branding,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        candidateFirstName: candidate.firstName || 'candidat(e)',
        jobTitle: primaryApp.job?.title || 'Poste non spécifié',
        result,
        score: interview.score ?? undefined,
        feedback: interview.feedback || undefined,
        evaluator: interview.evaluator || undefined,
        interviewDate: interview.date,
      });

      await this.notificationService['sendEmail'](candidate.email, subject, html, {
        fromName: branding.recruiterName
          ? `${branding.recruiterName} — ${branding.schoolName}`
          : branding.schoolName || 'Academia Helm — Recrutement',
      });

      return {
        success: true,
        message: `Email de résultat d'entretien envoyé à ${candidate.email}`,
        candidate: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email,
        candidateId: candidate.id,
        interviewId: interview.id,
        job: primaryApp.job?.title,
        result,
        score: interview.score,
        feedback: interview.feedback,
        evaluator: interview.evaluator,
        interviewDate: interview.date,
      };
    } catch (err: any) {
      this.logger.error(`testResendInterviewResultByEmail FAILED: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
        candidate: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email,
        candidateId: candidate.id,
        interviewId: interview.id,
        result,
      };
    }
  }

  /**
   * TEST — Renvoie l'email "Résultat test" en retrouvant le test result le
   * plus récent d'un candidat par son email.
   *
   * Endpoint temporaire pour tester sans connaître le testResultId.
   * À supprimer après validation.
   */
  async testResendTestResultByEmail(email: string, tenantId: string) {
    this.logger.log(`testResendTestResultByEmail: email=${email}, tenantId=${tenantId}`);

    if (!email || !tenantId) {
      throw new BadRequestException('email et tenantId sont requis');
    }

    // 1. Retrouver le candidat par email + tenant
    const candidate = await this.prisma.hrCandidate.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, tenantId },
      include: {
        applications: {
          include: { job: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        testResults: {
          include: { test: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException(`Aucun candidat trouvé pour l'email "${email}" sur ce tenant`);
    }

    const testResult = candidate.testResults?.[0];
    if (!testResult) {
      throw new NotFoundException(
        `Aucun résultat de test trouvé pour ${candidate.firstName} ${candidate.lastName} (${email})`,
      );
    }

    const primaryApp = candidate.applications?.[0];
    if (!primaryApp) {
      throw new NotFoundException(
        `Aucune candidature trouvée pour ce candidat — impossible de déterminer le poste`,
      );
    }

    this.logger.log(
      `testResendTestResultByEmail: found testResult ${testResult.id} (test=${testResult.test?.name}), sending to ${candidate.email}`,
    );

    try {
      const branding = await this.notificationService['getTenantBranding'](tenantId);
      const { renderTestResult } = await import('./recruitment-email-templates');
      const { subject, html } = renderTestResult({
        branding,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        candidateFirstName: candidate.firstName || 'candidat(e)',
        jobTitle: primaryApp.job?.title || 'Poste non spécifié',
        result: testResult.result || 'RÉUSSI',
        score: testResult.score,
        maxScore: testResult.test?.maxScore,
        passingScore: testResult.test?.passingScore,
        testName: testResult.test?.name,
        feedback: testResult.notes || undefined,
      });

      await this.notificationService['sendEmail'](candidate.email, subject, html, {
        fromName: branding.recruiterName
          ? `${branding.recruiterName} — ${branding.schoolName}`
          : branding.schoolName || 'Academia Helm — Recrutement',
      });

      return {
        success: true,
        message: `Email de résultat de test envoyé à ${candidate.email}`,
        candidate: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email,
        candidateId: candidate.id,
        testResultId: testResult.id,
        job: primaryApp.job?.title,
        test: testResult.test?.name,
        result: testResult.result,
        score: testResult.score,
        feedback: testResult.notes,
      };
    } catch (err: any) {
      this.logger.error(`testResendTestResultByEmail FAILED: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
        candidate: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email,
        candidateId: candidate.id,
        testResultId: testResult.id,
        test: testResult.test?.name,
      };
    }
  }
}

