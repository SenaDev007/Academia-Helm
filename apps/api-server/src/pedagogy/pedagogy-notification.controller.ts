/**
 * ============================================================================
 * PEDAGOGY NOTIFICATION CONTROLLER — Récapitulatif automatique par email
 * ============================================================================
 *
 * Deux endpoints :
 *
 *   POST /api/pedagogy/teacher-notifications/individual
 *     Body: { teacherId, academicYearId? }
 *     → Envoie AUTOMATIQUEMENT un email récapitulatif à UN enseignant.
 *       Le système fetch toutes ses données (profil, dispo, multigrade,
 *       affectations, charge horaire) puis génère et envoie l'email.
 *
 *   POST /api/pedagogy/teacher-notifications/batch
 *     Body: { teacherIds: string[], academicYearId? }
 *     → Envoie le même type d'email à PLUSIEURS enseignants (séquentiel).
 *       Retourne un récap détaillé { sent, failed, skipped, results[] }.
 *
 * IMPORTANT : Aucune saisie utilisateur. Pas de subject, pas de message —
 * tout est généré automatiquement à partir des données DB du teacher.
 *
 * Sécurité :
 *   - JwtAuthGuard — authentification requise
 *   - @TenantId() — isolation multi-tenant
 *   - @CurrentUser() — ID utilisateur pour audit EmailLog
 *
 * Traçabilité :
 *   - Chaque envoi crée un EmailLog (category=PEDAGOGIE,
 *     subCategory=TEACHER_PROFILE_SUMMARY, recipientType=ENSEIGNANT)
 * ============================================================================
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { IsString, IsArray, IsOptional } from 'class-validator';
import { PedagogyNotificationService } from './pedagogy-notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * ⚠️ IMPORTANT : Le ValidationPipe global a `forbidNonWhitelisted: true`
 * (CDC §16.3.3). Cela signifie que toute propriété SANS décorateur
 * class-validator est REJETÉE avec l'erreur "property X should not exist".
 *
 * Donc chaque propriété du DTO doit avoir un décorateur :
 *   - @IsString() pour les string
 *   - @IsArray() pour les tableaux
 *   - @IsOptional() pour les champs facultatifs
 */
class NotifyIndividualDto {
  @IsString()
  teacherId!: string;

  /** Optionnel — si non fourni, utilise l'année scolaire active du tenant */
  @IsString()
  @IsOptional()
  academicYearId?: string;
}

class NotifyBatchDto {
  @IsArray()
  @IsString({ each: true })
  teacherIds!: string[];

  @IsString()
  @IsOptional()
  academicYearId?: string;
}

@Controller('pedagogy/teacher-notifications')
@UseGuards(JwtAuthGuard)
export class PedagogyNotificationController {
  private readonly logger = new Logger(PedagogyNotificationController.name);

  constructor(
    private readonly notificationService: PedagogyNotificationService,
  ) {}

  /**
   * Envoi individuel — bouton « Notifier » sur fiche enseignant.
   * Le système rassemble TOUTES les données pédagogiques du teacher puis
   * génère et envoie l'email automatiquement.
   */
  @Post('individual')
  @HttpCode(HttpStatus.OK)
  async notifyIndividual(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: NotifyIndividualDto,
  ) {
    this.logger.log(
      `POST /teacher-notifications/individual — teacherId=${dto.teacherId}, triggeredBy=${user?.id || 'SYSTEM'}`,
    );

    if (!dto.teacherId) {
      return {
        success: false,
        error: 'teacherId est requis',
      };
    }

    const result = await this.notificationService.notifyTeacher({
      teacherId: dto.teacherId,
      tenantId,
      academicYearId: dto.academicYearId,
      triggeredByUserId: user?.id,
    });

    return {
      success: result.success,
      result,
    };
  }

  /**
   * Envoi groupé — bouton « Notifier tous » du toolbar.
   * Retourne un récapitulatif détaillé pour affichage frontend.
   */
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  async notifyBatch(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: NotifyBatchDto,
  ) {
    this.logger.log(
      `POST /teacher-notifications/batch — ${dto.teacherIds?.length || 0} recipient(s), triggeredBy=${user?.id || 'SYSTEM'}`,
    );

    if (!dto.teacherIds || dto.teacherIds.length === 0) {
      return {
        success: false,
        error: 'Aucun destinataire fourni (teacherIds est vide)',
      };
    }

    const result = await this.notificationService.notifyTeachers({
      teacherIds: dto.teacherIds,
      tenantId,
      academicYearId: dto.academicYearId,
      triggeredByUserId: user?.id,
    });

    return {
      success: result.failed === 0,
      result,
    };
  }

  /**
   * Téléchargement PDF — bouton « Télécharger PDF » sur fiche enseignant.
   *
   * Génère le PDF récapitulatif et le retourne directement en flux binaire
   * (Content-Type: application/pdf) pour que le navigateur propose le
   * téléchargement.
   *
   * Le frontend n'a qu'à faire un window.open() ou un <a download> vers
   * cette URL — pas de parsing JSON côté client.
   */
  @Get('pdf/:teacherId')
  async downloadPdf(
    @TenantId() tenantId: string,
    @Param('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId: string,
    @Res() res: Response,
  ) {
    this.logger.log(
      `GET /teacher-notifications/pdf/${teacherId} — academicYearId=${academicYearId || 'auto'}`,
    );

    const result = await this.notificationService.generatePdfForDownload(
      teacherId,
      tenantId,
      academicYearId,
    );

    if ('error' in result) {
      // Erreur → retourner JSON avec status 400 pour que le frontend puisse
      // afficher le message d'erreur
      return res.status(400).json({ error: result.error });
    }

    // Succès → streamer le buffer PDF avec les bons en-têtes
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(result.filename)}"`,
    );
    res.setHeader('Content-Length', result.buffer.length.toString());
    res.setHeader('Cache-Control', 'no-store');

    return res.send(result.buffer);
  }
}
