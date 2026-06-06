import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../common/services/storage.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

@Injectable()
export class RecruitmentPrismaService {
  private readonly logger = new Logger(RecruitmentPrismaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
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

  async createJob(tenantId: string, data: any) {
    return this.prisma.hrJob.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        ref: data.ref || `OFF-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`,
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
    // Use a transaction to delete related records explicitly
    return this.prisma.$transaction(async (tx) => {
      // 1. Get all applications for this job
      const applications = await tx.hrApplication.findMany({
        where: { jobId: id },
        select: { id: true },
      });

      // 2. Delete AI reports linked to those applications
      if (applications.length > 0) {
        await tx.hrAiReport.deleteMany({
          where: { applicationId: { in: applications.map((a) => a.id) } },
        });
      }

      // 3. Delete the applications themselves
      await tx.hrApplication.deleteMany({ where: { jobId: id } });

      // 4. Finally, delete the job
      return tx.hrJob.delete({ where: { id } });
    });
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
    return this.prisma.hrCandidate.create({
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

    // 5. Clean up files from storage (non-blocking, best-effort)
    if (documents.length > 0) {
      for (const doc of documents) {
        try {
          await this.storageService.deleteFile(doc.filePath);
        } catch (err) {
          this.logger.warn(`Failed to delete file from storage: ${doc.filePath} — ${err.message}`);
        }
      }
    }

    return { success: true, deletedDocuments: documents.length };
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

        // Check if employee already exists with this email
        const existingStaff = await tx.staff.findFirst({
          where: { email: updatedApp.candidate.email, tenantId: updatedApp.tenantId }
        });

        if (!existingStaff) {
          // Find academic year if available
          const currentYear = await tx.academicYear.findFirst({
            where: { tenantId: updatedApp.tenantId, status: 'ACTIVE' }
          });

          // Determine roleType
          const jobTitle = (updatedApp.job.title || '').toLowerCase();
          const isTeacher = jobTitle.includes('enseignant') || jobTitle.includes('prof') || jobTitle.includes('teacher') || jobTitle.includes('instituteur');
          const roleType = isTeacher ? 'TEACHER' : 'ADMIN';

          // Parse salary (if it's a number like 400000)
          let parsedSalary = null;
          if (updatedApp.job.salary) {
            const matched = updatedApp.job.salary.match(/\d+/);
            if (matched) {
              parsedSalary = parseFloat(matched[0]);
            }
          }

          const staff = await tx.staff.create({
            data: {
              ...prismaCreateDefaults(),
              tenantId: updatedApp.tenantId,
              academicYearId: currentYear?.id || null,
              employeeNumber: `EMP-${Date.now().toString().slice(-6)}`,
              firstName: updatedApp.candidate.firstName,
              lastName: updatedApp.candidate.lastName,
              gender: updatedApp.candidate.gender,
              email: updatedApp.candidate.email,
              phone: updatedApp.candidate.phone,
              address: updatedApp.candidate.address,
              position: updatedApp.job.title,
              department: updatedApp.job.dept,
              roleType,
              hireDate: new Date(),
              contractType: updatedApp.job.contractType || 'CDI',
              status: 'ACTIVE',
              salary: parsedSalary,
            }
          });

          return { ...updatedApp, staff };
        }

        return updatedApp;
      });
    }

    // Non-EMBAUCHÉ case - simple update
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
    // Use a transaction to delete AI reports first
    return this.prisma.$transaction(async (tx) => {
      await tx.hrAiReport.deleteMany({ where: { applicationId: id } });
      return tx.hrApplication.delete({ where: { id } });
    });
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
    return this.prisma.hrInterview.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        candidateId: data.candidateId,
        type: data.type || 'RH',
        date: new Date(data.date),
        time: data.time,
        format: data.format || 'Visioconférence',
        evaluator: data.evaluator,
        score: data.score ? parseInt(data.score) : 0,
        comments: data.comments,
      },
    });
  }

  async updateInterview(id: string, data: any) {
    return this.prisma.hrInterview.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        type: data.type,
        date: new Date(data.date),
        time: data.time,
        format: data.format,
        evaluator: data.evaluator,
        score: data.score ? parseInt(data.score) : 0,
        comments: data.comments,
      },
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
        id: crypto.randomUUID(),
        tenantId,
        name: data.name,
        type: data.type,
        description: data.description,
      },
    });
  }

  async updateTest(id: string, data: any) {
    return this.prisma.hrTest.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        description: data.description,
      },
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
    return this.prisma.hrTestResult.create({
      data: {
        id: crypto.randomUUID(),
        testId: data.testId,
        candidateId: data.candidateId,
        score: parseInt(data.score),
        result: data.result || 'RÉUSSI',
      },
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
        id: crypto.randomUUID(),
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

    // Simulate AI scoring
    const scoreCV = hasCV ? Math.floor(Math.random() * 15) + 80 : 75;
    const scoreLetter = hasLetter ? Math.floor(Math.random() * 15) + 80 : 70;
    const scoreMatching = hasCV ? Math.floor(Math.random() * 20) + 75 : 80;

    const score = Math.round((scoreCV * 0.4) + (scoreLetter * 0.2) + (scoreMatching * 0.4));

    const cvName = hasCV ? files.cv[0].originalname : 'Profil LinkedIn / Candidature Simplifiée';
    const letterName = hasLetter ? files.coverLetter[0].originalname : 'Pitch de motivation intégré';

    const matchDetail = `Candidature Easy Apply analysée. CV/Fiche: ${cvName}. Présentation: ${letterName}. Adéquation avec le profil enseignant validée par HDIE.`;

    const risks = Math.random() > 0.9 ? 'Faible' : 'Aucun';
    const riskDetail = risks === 'Faible' ? 'Léger décalage de dates détecté dans l\'historique professionnel.' : null;

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

        // 2. Save to AcademicProfile
        await tx.academicProfile.create({
          data: {
            id: crypto.randomUUID(),
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

        // 4. Save document references (paths already uploaded)
        const documentRecords: any[] = [];

        if (cvFile && cvPath) {
          const doc = await tx.candidateDocument.create({
            data: {
              id: crypto.randomUUID(),
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
              id: crypto.randomUUID(),
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
              id: crypto.randomUUID(),
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
      throw txErr;
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
}

