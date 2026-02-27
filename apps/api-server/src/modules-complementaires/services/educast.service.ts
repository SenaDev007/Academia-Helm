import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service pour le sous-module 9.7 - EduCast (Contenu & Diffusion)
 */
@Injectable()
export class EducastService {
  constructor(private readonly prisma: PrismaService) {}

  async createContent(tenantId: string, academicYearId: string, data: any, uploadedBy: string) {
    return this.prisma.educastContent.create({
      data: {
        tenantId,
        academicYearId,
        title: data.title,
        description: data.description,
        contentType: data.contentType,
        filePath: data.filePath,
        url: data.url,
        duration: data.duration,
        fileSize: data.fileSize,
        thumbnailPath: data.thumbnailPath,
        schoolLevelId: data.schoolLevelId,
        classId: data.classId,
        isPublic: data.isPublic || false,
        isActive: true,
        uploadedBy,
      },
    });
  }

  async grantAccess(contentId: string, tenantId: string, data: any, grantedBy: string) {
    const content = await this.prisma.educastContent.findFirst({
      where: { id: contentId, tenantId },
    });
    if (!content) throw new NotFoundException(`Content with ID ${contentId} not found`);

    return this.prisma.educastAccess.create({
      data: {
        contentId,
        studentId: data.studentId,
        schoolLevelId: data.schoolLevelId,
        classId: data.classId,
        accessType: data.accessType,
        grantedBy,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
  }

  async startSession(contentId: string, studentId: string, tenantId: string, deviceType?: string) {
    const content = await this.prisma.educastContent.findFirst({
      where: { id: contentId, tenantId, isActive: true },
    });
    if (!content) throw new NotFoundException(`Content with ID ${contentId} not found`);

    // Vérifier l'accès
    const hasAccess = await this.checkAccess(contentId, studentId, tenantId);
    if (!hasAccess) {
      throw new NotFoundException('Access denied to this content');
    }

    return this.prisma.educastSession.create({
      data: {
        contentId,
        studentId,
        startTime: new Date(),
        deviceType,
        completed: false,
      },
    });
  }

  async endSession(sessionId: string, tenantId: string, progress?: number) {
    const session = await this.prisma.educastSession.findFirst({
      where: { id: sessionId },
      include: { content: true },
    });

    if (!session || session.content.tenantId !== tenantId) {
      throw new NotFoundException(`Session with ID ${sessionId} not found`);
    }

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);
    const completed = progress ? progress >= 90 : duration >= (session.content.duration || 0);

    return this.prisma.educastSession.update({
      where: { id: sessionId },
      data: {
        endTime,
        duration,
        progress,
        completed,
      },
    });
  }

  async checkAccess(contentId: string, studentId: string, tenantId: string): Promise<boolean> {
    const content = await this.prisma.educastContent.findFirst({
      where: { id: contentId, tenantId },
      include: { accesses: true, class: true, schoolLevel: true },
    });

    if (!content) return false;
    if (!content.isActive) return false;

    // Contenu public
    if (content.isPublic && !content.classId && !content.schoolLevelId) return true;

    // Vérifier les accès explicites
    const explicitAccess = content.accesses.find(
      (a) =>
        a.studentId === studentId ||
        (a.accessType === 'CLASS' && a.classId === content.classId) ||
        (a.accessType === 'LEVEL' && a.schoolLevelId === content.schoolLevelId) ||
        a.accessType === 'ALL',
    );

    return !!explicitAccess;
  }

  async findAllContents(tenantId: string, academicYearId: string, filters?: any) {
    const where: any = { tenantId, academicYearId, isActive: true };
    if (filters?.contentType) where.contentType = filters.contentType;
    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }
    if (filters?.classId) where.classId = filters.classId;

    return this.prisma.educastContent.findMany({
      where,
      include: {
        schoolLevel: true,
        class: true,
        uploader: { select: { id: true, firstName: true, lastName: true } },
        accesses: true,
        sessions: {
          where: {
            startTime: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getContentStats(tenantId: string, academicYearId: string) {
    const contents = await this.prisma.educastContent.findMany({
      where: { tenantId, academicYearId, isActive: true },
      include: {
        sessions: {
          where: {
            startTime: {
              gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            },
          },
        },
        accesses: true,
      },
    });

    const totalViews = contents.reduce((sum, c) => sum + c.sessions.length, 0);
    const completedViews = contents.reduce(
      (sum, c) => sum + c.sessions.filter((s) => s.completed).length,
      0,
    );

    return {
      totalContents: contents.length,
      totalAccesses: contents.reduce((sum, c) => sum + c.accesses.length, 0),
      totalViews,
      completedViews,
      completionRate: totalViews > 0 ? (completedViews / totalViews) * 100 : 0,
    };
  }
}

