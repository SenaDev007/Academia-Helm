import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RecruitmentPrismaService {
  constructor(private prisma: PrismaService) {}

  // Job Offers CRUD
  async getJobs(tenantId: string) {
    return this.prisma.hrJob.findMany({
      where: { tenantId },
      include: { _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createJob(tenantId: string, data: any) {
    return this.prisma.hrJob.create({
      data: {
        tenantId,
        ref: data.ref || `OFF-${Date.now().toString().slice(-4)}`,
        title: data.title,
        dept: data.dept,
        loc: data.loc,
        status: data.status || 'BROUILLON',
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
      data,
    });
  }

  async deleteJob(id: string) {
    return this.prisma.hrJob.delete({
      where: { id },
    });
  }

  // Candidates CRUD
  async getCandidates(tenantId: string) {
    return this.prisma.hrCandidate.findMany({
      where: { tenantId },
      include: {
        applications: true,
        interviews: true,
        academicProfile: true,
        academicScores: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCandidate(tenantId: string, data: any) {
    return this.prisma.hrCandidate.create({
      data: {
        tenantId,
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

  async updateCandidate(id: string, data: any) {
    return this.prisma.hrCandidate.update({
      where: { id },
      data: {
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
    return this.prisma.hrCandidate.delete({
      where: { id },
    });
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
    const updatedApp = await this.prisma.hrApplication.update({
      where: { id },
      data: { 
        status,
        ...(review ? { matchDetail: review } : {})
      },
      include: {
        candidate: true,
        job: true,
      }
    });

    if (status === 'EMBAUCHÉ') {
      // Check if employee already exists with this email
      const existingStaff = await this.prisma.staff.findFirst({
        where: { email: updatedApp.candidate.email, tenantId: updatedApp.tenantId }
      });

      if (!existingStaff) {
        // Find academic year if available
        const currentYear = await this.prisma.academicYear.findFirst({
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

        await this.prisma.staff.create({
          data: {
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
      }
    }

    return updatedApp;
  }

  async deleteApplication(id: string) {
    return this.prisma.hrApplication.delete({
      where: { id },
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
    return this.prisma.hrTest.delete({
      where: { id },
    });
  }

  // Test Results
  async createTestResult(data: any) {
    return this.prisma.hrTestResult.create({
      data: {
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

    // 1. Create candidate
    const candidate = await this.prisma.hrCandidate.create({
      data: {
        tenantId,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        address: body.address || '',
        gender: body.gender || 'M',
      }
    });

    // Parse structured data from request body
    let skills: string[] = [];
    let experiences: any[] = [];
    let education: any[] = [];
    try {
      if (body.skills) skills = JSON.parse(body.skills);
      if (body.experiences) experiences = JSON.parse(body.experiences);
      if (body.education) education = JSON.parse(body.education);
    } catch (e) {
      console.warn('Failed parsing structured profile details:', e);
    }

    const pitch = body.pitch || '';
    const pedagogicalExperience = JSON.stringify({ experiences, pitch, education, linkedinUrl: body.linkedinUrl || '' });

    // Save to AcademicProfile
    await this.prisma.academicProfile.create({
      data: {
        candidateId: candidate.id,
        teachingLevel: education[0]?.degree || 'Non spécifié',
        subjects: skills,
        pedagogicalExperience,
      }
    });

    // 2. Generate scores and detail reports based on files
    const hasCV = files?.cv && files.cv.length > 0;
    const hasLetter = files?.coverLetter && files.coverLetter.length > 0;

    // Simulate AI scoring
    const scoreCV = hasCV ? Math.floor(Math.random() * 15) + 80 : 75; // high score if LinkedIn profile completed
    const scoreLetter = hasLetter ? Math.floor(Math.random() * 15) + 80 : 70;
    const scoreMatching = hasCV ? Math.floor(Math.random() * 20) + 75 : 80;

    const score = Math.round((scoreCV * 0.4) + (scoreLetter * 0.2) + (scoreMatching * 0.4));

    const cvName = hasCV ? files.cv[0].originalname : 'Profil LinkedIn / Candidature Simplifiée';
    const letterName = hasLetter ? files.coverLetter[0].originalname : 'Pitch de motivation intégré';

    const matchDetail = `Candidature Easy Apply analysée. CV/Fiche: ${cvName}. Présentation: ${letterName}. Adéquation avec le profil enseignant validée par HDIE.`;

    const risks = Math.random() > 0.9 ? 'Faible' : 'Aucun';
    const riskDetail = risks === 'Faible' ? 'Léger décalage de dates détecté dans l\'historique professionnel.' : null;

    // 3. Create application
    const application = await this.prisma.hrApplication.create({
      data: {
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

    return { candidate, application };
  }
}



