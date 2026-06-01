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
        status: 'NOUVEAU',
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

  async updateApplicationStatus(id: string, status: string) {
    return this.prisma.hrApplication.update({
      where: { id },
      data: { status },
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
        score: data.score || 0,
        comments: data.comments,
      },
    });
  }
}
