/**
 * ============================================================================
 * EXAM FRAUD CONTROLLER — Workflow des fraudes aux examens (Censeur)
 * ============================================================================
 *
 * Workflow distinct du module Discipline (sanctions comportementales).
 * Géré par le CENSEUR, pas le Surveillant Général.
 *
 * Endpoints :
 *   GET    /exam-frauds                  — Liste des fraudes
 *   POST   /exam-frauds                  — Déclarer une fraude (Censeur)
 *   GET    /exam-frauds/:id              — Détail d'une fraude
 *   PUT    /exam-frauds/:id              — Mettre à jour (investigation)
 *   DELETE /exam-frauds/:id              — Annuler une déclaration
 *
 *   POST   /exam-frauds/:id/sanctions    — Appliquer une sanction pédagogique
 *   PUT    /exam-frauds/sanctions/:sid   — Modifier une sanction
 *   POST   /exam-frauds/sanctions/:sid/approve  — Valider (Directeur)
 *   POST   /exam-frauds/sanctions/:sid/execute  — Exécuter la sanction
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Logger, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../database/prisma.service';
import * as crypto from 'crypto';

@Controller('exam-frauds')
export class ExamFraudController {
  private readonly logger = new Logger(ExamFraudController.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── FRAUDS CRUD ──────────────────────────────────────────────────────

  @Get()
  async listFrauds(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('status') status?: string,
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
    @Query('severity') severity?: string,
  ) {
    if (!academicYearId) return [];
    const params: any[] = [tenantId, academicYearId];
    let extraWhere = '';

    if (status) { params.push(status); extraWhere += ` AND ef.status = $${params.length}`; }
    if (studentId) { params.push(studentId); extraWhere += ` AND ef."studentId" = $${params.length}`; }
    if (classId) { params.push(classId); extraWhere += ` AND ef."classId" = $${params.length}`; }
    if (severity) { params.push(severity); extraWhere += ` AND ef.severity = $${params.length}`; }

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT ef.*,
              st."firstName" || ' ' || st."lastName" as "studentName",
              st."matricule" as "studentMatricule",
              c.name as "className",
              s.name as "subjectName",
              e.title as "evaluationTitle",
              reporter."firstName" || ' ' || reporter."lastName" as "reportedByName"
       FROM exam_frauds ef
       JOIN students st ON st.id = ef."studentId"
       LEFT JOIN classes c ON c.id = ef."classId"
       LEFT JOIN subjects s ON s.id = ef."subjectId"
       LEFT JOIN evaluations e ON e.id = ef."evaluationId"
       LEFT JOIN users reporter ON reporter.id = ef."reportedById"
       WHERE ef."tenantId" = $1 AND ef."academicYearId" = $2
       ${extraWhere}
       ORDER BY ef."reportedAt" DESC`,
      params,
    );

    return rows.map(r => ({
      ...r,
      studentName: r.studentName || '—',
      studentMatricule: r.studentMatricule || '—',
      className: r.className || '—',
      subjectName: r.subjectName || '—',
      evaluationTitle: r.evaluationTitle || '—',
      reportedByName: r.reportedByName || '—',
    }));
  }

  @Get(':id')
  async getFraud(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT ef.*,
              st."firstName" || ' ' || st."lastName" as "studentName",
              st."matricule" as "studentMatricule",
              c.name as "className",
              s.name as "subjectName",
              e.title as "evaluationTitle"
       FROM exam_frauds ef
       JOIN students st ON st.id = ef."studentId"
       LEFT JOIN classes c ON c.id = ef."classId"
       LEFT JOIN subjects s ON s.id = ef."subjectId"
       LEFT JOIN evaluations e ON e.id = ef."evaluationId"
       WHERE ef.id = $1 AND ef."tenantId" = $2
       LIMIT 1`,
      [id, tenantId],
    );
    if (rows.length === 0) throw new NotFoundException('Fraude introuvable');
    const fraud = rows[0];

    // Charger la sanction associée
    const sanctions = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM exam_fraud_sanctions WHERE "examFraudId" = $1 AND "tenantId" = $2
       ORDER BY "decidedAt" DESC`,
      [id, tenantId],
    );
    return { ...fraud, sanctions };
  }

  @Post()
  async createFraud(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      studentId: string;
      academicYearId: string;
      evaluationId?: string;
      examId?: string;
      classId?: string;
      subjectId?: string;
      quarterId?: string;
      fraudType: string;
      description: string;
      witnesses?: string;
      evidencePhotoUrl?: string;
      severity?: string;
      incidentDate?: string;
    },
  ) {
    if (!body.studentId || !body.academicYearId || !body.fraudType || !body.description?.trim()) {
      throw new BadRequestException('studentId, academicYearId, fraudType et description sont requis');
    }

    const id = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO exam_frauds
        (id, "tenantId", "academicYearId", "studentId", "evaluationId", "examId",
         "classId", "subjectId", "quarterId", "fraudType", description, witnesses,
         "evidencePhotoUrl", severity, status, "reportedById", "reportedAt",
         "incidentDate", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'REPORTED', $15, now(),
               $16, now(), now())`,
      id, tenantId, body.academicYearId, body.studentId,
      body.evaluationId || null, body.examId || null,
      body.classId || null, body.subjectId || null, body.quarterId || null,
      body.fraudType, body.description, body.witnesses || null,
      body.evidencePhotoUrl || null, body.severity || 'MAJOR',
      user?.id || '00000000-0000-0000-0000-000000000000',
      body.incidentDate ? new Date(body.incidentDate) : null,
    );

    this.logger.log(`Fraude déclarée: ${body.fraudType} pour élève ${body.studentId} par ${user?.id}`);
    return { id, success: true };
  }

  @Put(':id')
  async updateFraud(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: {
      status?: string;
      investigationNotes?: string;
      severity?: string;
    },
  ) {
    const updates: string[] = [];
    const params: any[] = [id, tenantId];

    if (body.status) {
      params.push(body.status);
      updates.push(`status = $${params.length}`);
      if (body.status === 'INVESTIGATING') {
        updates.push(`"investigatedById" = $${params.length + 1}`, `"investigatedAt" = now()`);
        params.push(user?.id);
      }
    }
    if (body.investigationNotes !== undefined) {
      params.push(body.investigationNotes);
      updates.push(`"investigationNotes" = $${params.length}`);
    }
    if (body.severity) {
      params.push(body.severity);
      updates.push(`severity = $${params.length}`);
    }

    if (updates.length === 0) {
      throw new BadRequestException('Aucune modification fournie');
    }

    updates.push(`"updatedAt" = now()`);
    await this.prisma.$executeRawUnsafe(
      `UPDATE exam_frauds SET ${updates.join(', ')} WHERE id = $1 AND "tenantId" = $2`,
      params,
    );

    this.logger.log(`Fraude ${id} mise à jour par ${user?.id}`);
    return { success: true };
  }

  @Delete(':id')
  async cancelFraud(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    if (!body.reason?.trim()) {
      throw new BadRequestException('La justification d\'annulation est obligatoire');
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE exam_frauds SET status = 'CLOSED', "investigationNotes" = COALESCE("investigationNotes", '') || '\n\n[Annulée par ' || $3 || '] ' || $4, "updatedAt" = now()
       WHERE id = $1 AND "tenantId" = $2`,
      [id, tenantId, user?.id || 'unknown', body.reason],
    );
    this.logger.log(`Fraude ${id} annulée par ${user?.id}: ${body.reason}`);
    return { success: true };
  }

  // ─── SANCTIONS (workflow séparé) ──────────────────────────────────────

  @Post(':id/sanctions')
  async applySanction(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') fraudId: string,
    @Body() body: {
      studentId: string;
      sanctionType: 'GRADE_NULLIFIED' | 'RETAKE_EXAM' | 'ZERO' | 'WARNING' | 'PARENT_SUMMONS';
      description?: string;
      newExamDate?: string;
      nullifiedGrade?: number;
    },
  ) {
    if (!body.studentId || !body.sanctionType) {
      throw new BadRequestException('studentId et sanctionType sont requis');
    }

    // Vérifier que la fraude existe
    const fraud = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, status FROM exam_frauds WHERE id = $1 AND "tenantId" = $2`,
      [fraudId, tenantId],
    );
    if (fraud.length === 0) throw new NotFoundException('Fraude introuvable');
    if (fraud[0].status === 'CLOSED') {
      throw new BadRequestException('Impossible de sanctionner une fraude fermée');
    }

    const sanctionId = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO exam_fraud_sanctions
        (id, "tenantId", "examFraudId", "studentId", "sanctionType", description,
         "newExamDate", "nullifiedGrade", "decidedById", "decidedAt", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), 'PENDING', now(), now())`,
      sanctionId, tenantId, fraudId, body.studentId,
      body.sanctionType, body.description || null,
      body.newExamDate ? new Date(body.newExamDate) : null,
      body.nullifiedGrade ?? null,
      user?.id || '00000000-0000-0000-0000-000000000000',
    );

    // Lier la sanction à la fraude + changer le statut
    await this.prisma.$executeRawUnsafe(
      `UPDATE exam_frauds SET "sanctionId" = $3, status = 'SANCTIONED', "updatedAt" = now()
       WHERE id = $1 AND "tenantId" = $2`,
      [fraudId, tenantId, sanctionId],
    );

    this.logger.log(`Sanction ${body.sanctionType} appliquée pour fraude ${fraudId} par ${user?.id}`);
    return { id: sanctionId, success: true };
  }

  @Post('sanctions/:sid/approve')
  async approveSanction(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('sid') sanctionId: string,
  ) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE exam_fraud_sanctions
       SET status = 'APPROVED', "approvedById" = $3, "approvedAt" = now(), "updatedAt" = now()
       WHERE id = $1 AND "tenantId" = $2 AND status = 'PENDING'`,
      [sanctionId, tenantId, user?.id],
    );
    this.logger.log(`Sanction ${sanctionId} approuvée par ${user?.id}`);
    return { success: true };
  }

  @Post('sanctions/:sid/execute')
  async executeSanction(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('sid') sanctionId: string,
  ) {
    const sanction = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM exam_fraud_sanctions WHERE id = $1 AND "tenantId" = $2`,
      [sanctionId, tenantId],
    );
    if (sanction.length === 0) throw new NotFoundException('Sanction introuvable');
    if (sanction[0].status !== 'APPROVED') {
      throw new BadRequestException('La sanction doit être approuvée avant exécution');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE exam_fraud_sanctions
       SET status = 'EXECUTED', "executedAt" = now(), "updatedAt" = now()
       WHERE id = $1 AND "tenantId" = $2`,
      [sanctionId, tenantId],
    );

    // TODO: Si GRADE_NULLIFIED, appliquer la note 0 sur l'ExamScore correspondant
    // TODO: Si RETAKE_EXAM, créer une nouvelle évaluation de reprise

    this.logger.log(`Sanction ${sanctionId} exécutée par ${user?.id}`);
    return { success: true };
  }
}
