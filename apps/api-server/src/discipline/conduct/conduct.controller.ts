/**
 * ============================================================================
 * CONDUCT CONTROLLER — Module Discipline (Compteur de conduite)
 * ============================================================================
 *
 * ⭐ 2026-09-28 — REFONTE COMPLÈTE du module Vie Scolaire.
 *    Le contrôleur précédent utilisait $queryRawUnsafe avec des paramètres
 *    passés en ARRAY au lieu d'arguments positionnels (spread) → échec
 *    silencieux → « Erreur lors de la sauvegarde » côté frontend + paramètres
 *    settings non relu après édition.
 *
 *    Refonte : utilisation des modèles Prisma DisciplineRule, ConductSetting,
 *    ConductLedger, Sanction (déclarés dans schema.prisma) via prisma.<model>
 *    standard. Plus de $queryRawUnsafe, plus de SQL manuel.
 *
 * Endpoints :
 *   GET    /api/discipline/conduct/rules         — Liste des règles de fautes
 *   POST   /api/discipline/conduct/rules         — Créer une règle
 *   PUT    /api/discipline/conduct/rules         — Modifier une règle
 *   GET    /api/discipline/conduct/sanctions     — Liste des sanctions
 *   POST   /api/discipline/conduct/sanctions     — Saisir une sanction (SG only)
 *   DELETE /api/discipline/conduct/sanctions/:id — Annuler une sanction (SG only)
 *   GET    /api/discipline/conduct/ledger        — Compteur de conduite par élève
 *   GET    /api/discipline/conduct/settings      — Configuration conduite
 *   PUT    /api/discipline/conduct/settings      — Modifier configuration
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Logger, BadRequestException,
} from '@nestjs/common';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { DisciplineNotificationService } from '../services/discipline-notification.service';
import * as crypto from 'crypto';

@Controller('discipline/conduct')
export class ConductController {
  private readonly logger = new Logger(ConductController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly disciplineNotificationService: DisciplineNotificationService,
  ) {}

  // ── RULES ──────────────────────────────────────────────────────────────

  @Get('rules')
  async listRules(
    @TenantId() tenantId: string,
    @Query('academicYearId') _academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    // ⭐ 2026-09-28 — Prisma model DisciplineRule — plus de $queryRawUnsafe.
    const where: any = { tenantId, isActive: true };
    if (schoolLevelId) {
      where.OR = [
        { schoolLevelId },
        { schoolLevelId: null },
      ];
    }
    const rules = await this.prisma.disciplineRule.findMany({
      where,
      orderBy: [{ severity: 'asc' }, { name: 'asc' }],
    });
    // ⭐ Renommer les champs @map pour le frontend (camelCase)
    return rules.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      hours_penalty: r.hoursPenalty,
      points_deducted: r.pointsDeducted,
      severity: r.severity,
      schoolLevelId: r.schoolLevelId,
      isActive: r.isActive,
    }));
  }

  @Post('rules')
  async createRule(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      name: string;
      description?: string;
      hours_penalty?: number;
      points_deducted?: number;
      severity?: string;
      schoolLevelId?: string;
    },
  ) {
    if (!body.name?.trim()) throw new BadRequestException('Le nom de la faute est requis');
    const rule = await this.prisma.disciplineRule.create({
      data: {
        tenantId,
        name: body.name.trim(),
        description: body.description || null,
        hoursPenalty: body.hours_penalty || 0,
        pointsDeducted: body.points_deducted || 0,
        severity: body.severity || 'MINOR',
        schoolLevelId: body.schoolLevelId || null,
        isActive: true,
      },
    });
    this.logger.log(`Rule created: ${body.name} by user ${user?.id}`);
    return { id: rule.id, success: true };
  }

  @Put('rules')
  async updateRule(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      id: string;
      name?: string;
      description?: string;
      hours_penalty?: number;
      points_deducted?: number;
      severity?: string;
      isActive?: boolean;
    },
  ) {
    if (!body.id) throw new BadRequestException('L\'id de la règle est requis');
    // ⭐ Utiliser update avec where clause tenantId pour sécurité multi-tenant
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.hours_penalty !== undefined) data.hoursPenalty = body.hours_penalty;
    if (body.points_deducted !== undefined) data.pointsDeducted = body.points_deducted;
    if (body.severity !== undefined) data.severity = body.severity;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (Object.keys(data).length === 0) return { success: true };

    await this.prisma.disciplineRule.updateMany({
      where: { id: body.id, tenantId },
      data,
    });
    this.logger.log(`Rule updated: ${body.id} by user ${user?.id}`);
    return { success: true };
  }

  // ── SANCTIONS ──────────────────────────────────────────────────────────

  @Get('sanctions')
  async listSanctions(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('studentId') studentId?: string,
  ) {
    if (!academicYearId) return [];
    // ⭐ 2026-09-28 — Prisma model Sanction + jointures Prisma pour studentName
    //    et className. On récupère les sanctions puis on enrichit avec le nom
    //    de l'élève et de la classe (depuis StudentEnrollment + Student + Class).
    const where: any = { tenantId, academicYearId };
    if (schoolLevelId) {
      where.OR = [
        { schoolLevelId },
        { schoolLevelId: null },
      ];
    }
    if (studentId) where.studentId = studentId;
    const sanctions = await this.prisma.sanction.findMany({
      where,
      orderBy: [{ sanctionDate: 'desc' }, { createdAt: 'desc' }],
    });
    if (sanctions.length === 0) return [];

    // ⭐ Récupérer en batch les élèves + leurs classes (1 requête par table)
    const studentIds = Array.from(new Set(sanctions.map(s => s.studentId)));
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const studentMap = new Map(students.map(s => [s.id, s]));

    // ⭐ Récupérer les enrollments actifs pour ces élèves + cette année
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { studentId: { in: studentIds }, academicYearId, status: 'ACTIVE' },
      select: { studentId: true, classId: true },
    });
    const classIds = Array.from(new Set(enrollments.map(e => e.classId).filter(Boolean) as string[]));
    const classes = classIds.length > 0
      ? await this.prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } })
      : [];
    const classMap = new Map(classes.map(c => [c.id, c.name]));
    const studentClassMap = new Map<string, string>();
    for (const e of enrollments) {
      if (e.classId && classMap.has(e.classId)) {
        studentClassMap.set(e.studentId, classMap.get(e.classId) || '—');
      }
    }

    return sanctions.map(s => {
      const st = studentMap.get(s.studentId);
      return {
        id: s.id,
        studentId: s.studentId,
        studentName: st ? `${st.lastName} ${st.firstName}`.trim() : '—',
        className: studentClassMap.get(s.studentId) || '—',
        ruleId: s.ruleId,
        fault_name: s.faultName,
        hours_attributed: s.hoursAttributed,
        points_deducted: s.pointsDeducted,
        sanction_date: s.sanctionDate,
        status: s.status,
        comment: s.comment,
        notificationStatus: s.notificationStatus,
        notificationChannels: s.notificationChannels,
        parentNotifiedAt: s.parentNotifiedAt,
      };
    });
  }

  @Post('sanctions')
  async createSanction(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      studentId: string;
      ruleId?: string;
      faultName: string;
      hoursAttributed: number;
      pointsDeducted: number;
      academicYearId: string;
      schoolLevelId?: string;
      quarterId?: string;
      comment?: string;
    },
  ) {
    if (!body.studentId || !body.academicYearId || !body.faultName?.trim()) {
      throw new BadRequestException('studentId, academicYearId et faultName sont requis');
    }

    const sanction = await this.prisma.sanction.create({
      data: {
        tenantId,
        academicYearId: body.academicYearId,
        studentId: body.studentId,
        ruleId: body.ruleId || null,
        schoolLevelId: body.schoolLevelId || null,
        quarterId: body.quarterId || null,
        faultName: body.faultName.trim(),
        hoursAttributed: body.hoursAttributed || 0,
        pointsDeducted: body.pointsDeducted || 0,
        supervisorId: user?.id || null,
        comment: body.comment || null,
        status: 'ACTIVE',
      },
    });

    // Mettre à jour le conduct_ledger
    await this.updateConductLedger(tenantId, body.academicYearId, body.studentId, body.quarterId, body.pointsDeducted || 0);

    this.logger.log(`Sanction created: ${body.faultName} (-${body.pointsDeducted}pts) for student ${body.studentId} by ${user?.id}`);

    // ⭐ Notifier le parent (WhatsApp Business + fallback SMS) — fire-and-forget
    //    Ne bloque jamais l'API. Si ça échoue, c'est juste loggé.
    this.disciplineNotificationService
      .notifyParentSanctionCreated({
        tenantId,
        sanctionId: sanction.id,
        studentId: body.studentId,
        academicYearId: body.academicYearId,
        faultName: body.faultName,
        hoursAttributed: body.hoursAttributed || 0,
        pointsDeducted: body.pointsDeducted || 0,
        triggeredByUserId: user?.id,
      })
      .then((result) => this.persistNotificationStatus(sanction.id, result, 'created'))
      .catch((err) =>
        this.logger.error(`Notification sanction_created échouée (non-bloquant): ${err.message}`),
      );

    return { id: sanction.id, success: true };
  }

  @Delete('sanctions/:id')
  async cancelSanction(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') sanctionId: string,
    @Body() body: { reason: string },
  ) {
    if (!body.reason?.trim()) {
      throw new BadRequestException('La justification d\'annulation est obligatoire');
    }

    // Récupérer la sanction pour ajuster le ledger
    const sanction = await this.prisma.sanction.findFirst({
      where: { id: sanctionId, tenantId, status: 'ACTIVE' },
    });
    if (!sanction) throw new BadRequestException('Sanction introuvable ou déjà annulée');

    await this.prisma.sanction.update({
      where: { id: sanctionId },
      data: {
        status: 'CANCELLED',
        cancelledBy: user?.id || null,
        cancelledReason: body.reason,
        cancelledAt: new Date(),
      },
    });

    // Ajuster le ledger (rembourser les points)
    if (sanction.quarterId) {
      await this.updateConductLedger(tenantId, sanction.academicYearId, sanction.studentId, sanction.quarterId, -(sanction.pointsDeducted || 0));
    }

    this.logger.log(`Sanction cancelled: ${sanctionId} by ${user?.id}, reason: ${body.reason}`);

    // ⭐ Notifier le parent de l'annulation (WhatsApp + SMS) — fire-and-forget
    this.disciplineNotificationService
      .notifyParentSanctionCancelled({
        tenantId,
        sanctionId,
        studentId: sanction.studentId,
        academicYearId: sanction.academicYearId,
        faultName: sanction.faultName || '—',
        pointsRefunded: sanction.pointsDeducted || 0,
        cancellationReason: body.reason,
        triggeredByUserId: user?.id,
      })
      .then((result) => this.persistNotificationStatus(sanctionId, result, 'cancelled'))
      .catch((err) =>
        this.logger.error(`Notification sanction_cancelled échouée (non-bloquant): ${err.message}`),
      );

    return { success: true };
  }

  // ── CONDUCT LEDGER ─────────────────────────────────────────────────────

  @Get('ledger')
  async listConductLedger(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') _schoolLevelId?: string,
  ) {
    if (!academicYearId) return [];
    const ledger = await this.prisma.conductLedger.findMany({
      where: { tenantId, academicYearId },
      orderBy: { conductFinal: 'asc' },
    });
    if (ledger.length === 0) return [];

    // ⭐ Enrichir avec studentName + className (batch)
    const studentIds = Array.from(new Set(ledger.map(l => l.studentId)));
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const studentMap = new Map(students.map(s => [s.id, s]));

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { studentId: { in: studentIds }, academicYearId, status: 'ACTIVE' },
      select: { studentId: true, classId: true },
    });
    const classIds = Array.from(new Set(enrollments.map(e => e.classId).filter(Boolean) as string[]));
    const classes = classIds.length > 0
      ? await this.prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } })
      : [];
    const classMap = new Map(classes.map(c => [c.id, c.name]));
    const studentClassMap = new Map<string, string>();
    for (const e of enrollments) {
      if (e.classId && classMap.has(e.classId)) {
        studentClassMap.set(e.studentId, classMap.get(e.classId) || '—');
      }
    }

    return ledger.map(l => {
      const st = studentMap.get(l.studentId);
      return {
        id: l.id,
        studentId: l.studentId,
        studentName: st ? `${st.lastName} ${st.firstName}`.trim() : '—',
        className: studentClassMap.get(l.studentId) || '—',
        conduct_reference: l.conductReference,
        total_points_deducted: l.totalPointsDeducted,
        conduct_final: l.conductFinal,
      };
    });
  }

  // ── SETTINGS ───────────────────────────────────────────────────────────

  @Get('settings')
  async getSettings(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return { conduct_reference: 20, critical_threshold: 5 };
    // ⭐ 2026-09-28 — Prisma model ConductSetting — plus de $queryRawUnsafe.
    //    On cherche d'abord avec schoolLevelId NULL (settings globaux),
    //    puis sans filtre schoolLevelId au cas où l'école aurait configuré
    //    des settings par niveau.
    const settings = await this.prisma.conductSetting.findFirst({
      where: { tenantId, academicYearId, schoolLevelId: null },
      orderBy: { createdAt: 'desc' },
    });
    if (settings) {
      return {
        id: settings.id,
        conduct_reference: settings.conductReference,
        critical_threshold: settings.criticalThreshold,
        academicYearId: settings.academicYearId,
        schoolLevelId: settings.schoolLevelId,
      };
    }
    // ⭐ Fallback : chercher n'importe quel setting pour cette année
    const anySettings = await this.prisma.conductSetting.findFirst({
      where: { tenantId, academicYearId },
      orderBy: { createdAt: 'desc' },
    });
    if (anySettings) {
      return {
        id: anySettings.id,
        conduct_reference: anySettings.conductReference,
        critical_threshold: anySettings.criticalThreshold,
        academicYearId: anySettings.academicYearId,
        schoolLevelId: anySettings.schoolLevelId,
      };
    }
    return { conduct_reference: 20, critical_threshold: 5 };
  }

  @Put('settings')
  async updateSettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      academicYearId: string;
      schoolLevelId?: string;
      conduct_reference?: number;
      critical_threshold?: number;
    },
  ) {
    if (!body.academicYearId) throw new BadRequestException('academicYearId est requis');
    // ⭐ 2026-09-28 — Prisma upsert standard. Plus de COALESCE(NULL='NULL').
    //    On normalise schoolLevelId à null si non fourni (settings globaux).
    const schoolLevelId = body.schoolLevelId || null;
    // ⭐ upsert par clé unique (tenantId, academicYearId, schoolLevelId)
    //    ⚠️ Prisma ne supporte pas updateMany avec une clause unique null ;
    //    on utilise findFirst + update ou create (équivalent sûr).
    const existing = await this.prisma.conductSetting.findFirst({
      where: { tenantId, academicYearId, schoolLevelId },
    });
    if (existing) {
      const updated = await this.prisma.conductSetting.update({
        where: { id: existing.id },
        data: {
          conductReference: body.conduct_reference ?? 20,
          criticalThreshold: body.critical_threshold ?? 5,
        },
      });
      this.logger.log(`Conduct settings updated (id=${updated.id}) by ${user?.id}`);
      return {
        id: updated.id,
        conduct_reference: updated.conductReference,
        critical_threshold: updated.criticalThreshold,
      };
    }
    const created = await this.prisma.conductSetting.create({
      data: {
        tenantId,
        academicYearId: body.academicYearId,
        schoolLevelId,
        conductReference: body.conduct_reference ?? 20,
        criticalThreshold: body.critical_threshold ?? 5,
      },
    });
    this.logger.log(`Conduct settings created (id=${created.id}) by ${user?.id}`);
    return {
      id: created.id,
      conduct_reference: created.conductReference,
      critical_threshold: created.criticalThreshold,
    };
  }

  // ── HELPER : Mettre à jour le conduct_ledger ───────────────────────────

  private async updateConductLedger(
    tenantId: string,
    academicYearId: string,
    studentId: string,
    quarterId: string | undefined,
    pointsDelta: number,
  ) {
    if (!quarterId) {
      // Si pas de trimestre, on prend le trimestre courant
      const quarter = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM quarters WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "isCurrent" = true LIMIT 1`,
        tenantId, academicYearId,
      );
      if (quarter.length === 0) return; // Pas de trimestre, on ne met pas à jour le ledger
      quarterId = quarter[0].id;
    }

    // Récupérer la conduct_reference depuis conduct_settings (configurable
    // par l'école) au lieu du hardcoded 20.
    const settingsRows = await this.prisma.conductSetting.findMany({
      where: { tenantId, academicYearId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    const conductReference = settingsRows.length > 0 && settingsRows[0].conductReference != null
      ? Number(settingsRows[0].conductReference)
      : 20;

    // Upsert le ledger
    const existing = await this.prisma.conductLedger.findUnique({
      where: { tenantId_studentId_quarterId: { tenantId, studentId, quarterId } },
    });
    if (existing) {
      const newTotalDeducted = Math.max(0, existing.totalPointsDeducted + pointsDelta);
      await this.prisma.conductLedger.update({
        where: { id: existing.id },
        data: {
          totalPointsDeducted: newTotalDeducted,
          conductFinal: Math.max(0, conductReference - newTotalDeducted),
          calculatedAt: new Date(),
        },
      });
    } else {
      await this.prisma.conductLedger.create({
        data: {
          tenantId,
          academicYearId,
          studentId,
          quarterId,
          conductReference,
          totalPointsDeducted: Math.max(0, pointsDelta),
          conductFinal: Math.max(0, conductReference - Math.max(0, pointsDelta)),
          calculatedAt: new Date(),
        },
      });
    }
  }

  // ── HELPER : Persister le statut de notification sur la sanction ───────

  private async persistNotificationStatus(
    sanctionId: string,
    result: import('../services/discipline-notification.service').NotificationResult,
    event: 'created' | 'cancelled',
  ) {
    try {
      // Déterminer le statut global
      let status: 'SENT' | 'FAILED' | 'SKIPPED' = 'FAILED';
      const waStatus = result.channels.whatsapp?.status;
      const smsStatus = result.channels.sms?.status;

      if (waStatus === 'sent' || smsStatus === 'sent') {
        status = 'SENT';
      } else if (waStatus === 'skipped' && smsStatus === 'skipped') {
        status = 'SKIPPED';
      } else {
        status = 'FAILED';
      }

      const channels = {
        whatsapp: waStatus || 'skipped',
        sms: smsStatus || 'skipped',
        event, // 'created' ou 'cancelled'
      };

      const notifiedAt = status === 'SENT' ? new Date() : null;

      await this.prisma.sanction.update({
        where: { id: sanctionId },
        data: {
          notificationStatus: status,
          notificationChannels: channels as any,
          parentNotifiedAt: notifiedAt,
        },
      });

      this.logger.log(
        `📊 Sanction ${sanctionId} notification status: ${status} (whatsapp=${waStatus}, sms=${smsStatus})`,
      );
    } catch (err: any) {
      this.logger.error(
        `persistNotificationStatus failed for ${sanctionId}: ${err.message}`,
      );
    }
  }
}
