/**
 * ============================================================================
 * PARENT PORTAL — EXAMENS NATIONAUX (T27 — 2026-10-01)
 * ============================================================================
 *
 * Espace parents : résultats des examens nationaux (CEP / BEPC / BAC / CAP)
 * de l'enfant — campagnes présentées par l'école, décision du jury et
 * téléchargement du relevé de notes officiel dès que le patronat l'a
 * distribué à l'école (comme les bulletins : visible dans l'interface du
 * parent, pas seulement par email).
 *
 *   GET /parent/national-exams/:studentId?academicYearId=
 *        → campagnes de l'enfant (décision, moyenne, rang, relevé distribué)
 *   GET /parent/national-exams/:studentId/releve/:candidateId/pdf?examId=
 *        → PDF officiel du relevé (garde : parent de l'élève + candidat bien
 *          l'élève + relevé DÉJÀ distribué à l'école par le patronat)
 *
 * Garde identique au reste du portail parents : résolution du guardian
 * (userId → guardians.userId / email / téléphone) + appartenance de l'élève.
 */

import {
  Controller,
  Get,
  Logger,
  Param,
  Query,
  Res,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Response } from 'express';
import { PrismaService } from '../database/prisma.service';
import { FederisDeliberationService } from '../federis/federis-deliberation.service';
import { FederisPdfService } from '../federis/federis-pdf.service';

@Controller('parent')
@UseGuards(JwtAuthGuard)
export class ParentPortalNationalExamsController {
  private readonly logger = new Logger(ParentPortalNationalExamsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliberationService: FederisDeliberationService,
    private readonly pdfService: FederisPdfService,
  ) {}

  // ── Garde d'appartenance (même pattern que ParentPortalController) ────────

  private async resolveGuardianId(tenantId: string, userId: string): Promise<string | null> {
    const byUserId: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id" FROM "guardians" WHERE "userId" = $1 AND "tenantId" = $2 LIMIT 1`,
      userId,
      tenantId,
    ).catch(() => []);
    if (byUserId && byUserId.length > 0) return byUserId[0].id;

    const directGuardian: any = await this.prisma.$queryRawUnsafe(
      `SELECT "id" FROM "guardians" WHERE "id" = $1 AND "tenantId" = $2 LIMIT 1`,
      userId,
      tenantId,
    ).catch(() => []);
    if (directGuardian && directGuardian.length > 0) return directGuardian[0].id;

    const user: any = await this.prisma.$queryRawUnsafe(
      `SELECT "email" FROM "users" WHERE "id" = $1 AND "tenantId" = $2 LIMIT 1`,
      userId,
      tenantId,
    ).catch(() => []);
    if (user?.[0]?.email) {
      const guardianByEmail: any = await this.prisma.$queryRawUnsafe(
        `SELECT "id" FROM "guardians" WHERE "email" = $1 AND "tenantId" = $2 LIMIT 1`,
        user[0].email,
        tenantId,
      ).catch(() => []);
      if (guardianByEmail?.length > 0) {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "guardians" SET "userId" = $1 WHERE "id" = $2 AND "userId" IS NULL`,
          userId,
          guardianByEmail[0].id,
        ).catch(() => {});
        return guardianByEmail[0].id;
      }
    }
    return null;
  }

  private async assertStudentBelongsToGuardian(
    tenantId: string,
    userId: string,
    studentId: string,
  ): Promise<void> {
    const guardianId = await this.resolveGuardianId(tenantId, userId);
    if (!guardianId) {
      this.logger.warn(`guardianId non résolu pour user ${userId} — vérification skipped`);
      return;
    }
    const link: any = await this.prisma.$queryRawUnsafe(
      `SELECT 1 FROM "student_guardians"
       WHERE "guardianId" = $1 AND "studentId" = $2 AND "tenantId" = $3
       LIMIT 1`,
      guardianId,
      studentId,
      tenantId,
    ).catch(() => []);
    if (!link || link.length === 0) {
      throw new ForbiddenException("Vous n'avez pas accès à cet élève");
    }
  }

  // ── GET /parent/national-exams/:studentId ────────────────────────────────

  @Get('national-exams/:studentId')
  async getChildNationalExams(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('studentId') studentId: string,
    @Query('academicYearId') _academicYearId?: string,
  ) {
    await this.assertStudentBelongsToGuardian(tenantId, user.id, studentId);

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: { id: true, firstName: true, lastName: true, matricule: true },
    });
    if (!student) throw new NotFoundException('Élève introuvable.');

    // Candidats nationaux rattachés à cet élève (metadata.studentId posée à la
    // transmission par l'école) — toutes campagnes confondues, les plus
    // récentes d'abord.
    const candidates = await this.prisma.examCandidate.findMany({
      where: { schoolTenantId: tenantId, status: { not: 'WITHDRAWN' } },
      select: {
        id: true,
        matricule: true,
        examId: true,
        createdAt: true,
        metadata: true,
        exam: {
          select: {
            id: true,
            code: true,
            name: true,
            examType: true,
            level: true,
            status: true,
            tenantId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const mine = candidates.filter(
      (c) => (c.metadata as any)?.studentId === studentId && c.exam,
    );
    if (mine.length === 0) {
      return {
        student: {
          id: student.id,
          name: `${student.firstName} ${student.lastName}`.trim(),
          matricule: student.matricule,
        },
        exams: [],
        message:
          "Aucun examen national pour cet élève pour l'instant — les résultats apparaîtront ici dès que l'école présente l'élève et que le patronat délibère.",
      };
    }

    const results = [];
    for (const candidate of mine) {
      const exam = candidate.exam;
      try {
        // Confidentialité : campagnes publiées OU relevé déjà distribué
        const dispatchCount = await this.prisma.examDocument.count({
          where: { examId: exam.id, documentType: 'RELEVE_NOTES', status: 'PUBLISHED' },
        });
        const board = await this.deliberationService.buildDeliberationBoard(exam.tenantId, exam.id);
        const row =
          [...(board.admissibles ?? []), ...(board.ajournes ?? [])].find(
            (r) => r.candidateId === candidate.id,
          ) ?? null;
        if (exam.status !== 'RESULTS_PUBLISHED' && dispatchCount === 0) continue;
        if (!row) continue;

        results.push({
          examId: exam.id,
          examCode: exam.code,
          examName: exam.name,
          examType: exam.examType,
          level: exam.level,
          academicYearLabel: board.academicYearLabel ?? null,
          publishedAt: board.deliberation?.publication?.publishedAt ?? null,
          candidateId: candidate.id,
          matricule: candidate.matricule,
          decision: row.decision,
          decisionLabel: row.decisionLabel,
          moyenne: row.moyenne,
          mention: row.mention,
          rank: row.rank,
          totalCandidates: board.stats?.totalCandidates ?? null,
          releveDispatched: row.releveDispatched,
        });
      } catch (err: any) {
        this.logger.warn(`board ${exam.code} indisponible pour le parent : ${err?.message}`);
      }
    }

    return {
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`.trim(),
        matricule: student.matricule,
      },
      exams: results,
    };
  }

  // ── GET /parent/national-exams/:studentId/releve/:candidateId/pdf ─────────

  @Get('national-exams/:studentId/releve/:candidateId/pdf')
  async downloadChildReleve(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('studentId') studentId: string,
    @Param('candidateId') candidateId: string,
    @Query('examId') examId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!examId) {
      throw new BadRequestException('Paramètre examId requis.');
    }
    await this.assertStudentBelongsToGuardian(tenantId, user.id, studentId);

    const candidate = await this.prisma.examCandidate.findFirst({
      where: { id: candidateId, examId },
      select: { id: true, schoolTenantId: true, metadata: true },
    });
    if (!candidate) throw new NotFoundException('Candidat introuvable pour cet examen.');
    if (candidate.schoolTenantId && candidate.schoolTenantId !== tenantId) {
      throw new ForbiddenException('Ce candidat n’appartient pas à votre établissement.');
    }
    if ((candidate.metadata as any)?.studentId !== studentId) {
      throw new ForbiddenException('Ce candidat ne correspond pas à cet élève.');
    }

    // Le relevé doit avoir été DISTRIBUÉ (même garde que la vue école)
    const doc = await this.prisma.examDocument.findFirst({
      where: { examId, candidateId, documentType: 'RELEVE_NOTES', status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!doc) {
      throw new ForbiddenException(
        'Le relevé de notes de ce candidat n’a pas encore été distribué par le patronat.',
      );
    }

    const { buffer, filename } = await this.pdfService.generateRelevePdfForSchool(
      tenantId,
      user.id,
      examId,
      candidateId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    return new StreamableFile(buffer);
  }
}
