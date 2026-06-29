/**
 * ============================================================================
 * PEDAGOGY NOTIFICATION CONTROLLER — Endpoints d'envoi d'emails aux enseignants
 * ============================================================================
 *
 * Deux endpoints :
 *
 *   POST /api/pedagogy/teacher-notifications/individual
 *     Body: { teacherId, subject, message, senderName?, senderFunction? }
 *     → Envoie un email à UN enseignant (bouton « Notifier » sur fiche)
 *
 *   POST /api/pedagogy/teacher-notifications/batch
 *     Body: { teacherIds: string[], subject, message, senderName?, senderFunction? }
 *     → Envoie un email à PLUSIEURS enseignants (bouton « Notifier tous »)
 *     → Séquentiel, retourne un récap détaillé { sent, failed, skipped, results[] }
 *
 * Sécurité :
 *   - JwtAuthGuard — authentification requise
 *   - @TenantId() — extrait le tenant du JWT, isolation multi-tenant
 *   - @CurrentUser() — extrait l'ID utilisateur pour audit EmailLog
 *
 * Traçabilité :
 *   - Chaque envoi crée une entrée EmailLog (category=PEDAGOGIE,
 *     subCategory=TEACHER_NOTIFICATION) via EmailService.sendCategorized()
 *   - Le récapitulatif retourné contient le logId de chaque envoi
 * ============================================================================
 */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PedagogyNotificationService } from './pedagogy-notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class NotifyIndividualDto {
  teacherId!: string;
  subject!: string;
  message!: string;
  senderName?: string;
  senderFunction?: string;
}

class NotifyBatchDto {
  teacherIds!: string[];
  subject!: string;
  message!: string;
  senderName?: string;
  senderFunction?: string;
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
   */
  @Post('individual')
  @HttpCode(HttpStatus.OK)
  async notifyIndividual(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: NotifyIndividualDto,
  ) {
    this.logger.log(
      `POST /teacher-notifications/individual — teacherId=${dto.teacherId}, subject="${dto.subject?.substring(0, 60)}", triggeredBy=${user?.id || 'SYSTEM'}`,
    );

    if (!dto.teacherId || !dto.subject || !dto.message) {
      return {
        success: false,
        error: 'Paramètres manquants : teacherId, subject, message sont requis',
      };
    }

    const result = await this.notificationService.notifyTeacher({
      teacherId: dto.teacherId,
      tenantId,
      subject: dto.subject,
      message: dto.message,
      triggeredByUserId: user?.id,
      senderName: dto.senderName,
      senderFunction: dto.senderFunction,
    });

    return {
      success: result.success,
      result,
    };
  }

  /**
   * Envoi groupé — bouton « Notifier tous » du toolbar.
   *
   * Retourne un récapitulatif détaillé pour que le frontend puisse afficher
   * « X envoyés, Y échecs, Z ignorés » avec la liste des erreurs.
   */
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  async notifyBatch(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: NotifyBatchDto,
  ) {
    this.logger.log(
      `POST /teacher-notifications/batch — ${dto.teacherIds?.length || 0} recipient(s), subject="${dto.subject?.substring(0, 60)}", triggeredBy=${user?.id || 'SYSTEM'}`,
    );

    if (!dto.teacherIds || dto.teacherIds.length === 0) {
      return {
        success: false,
        error: 'Aucun destinataire fourni (teacherIds est vide)',
      };
    }

    if (!dto.subject || !dto.message) {
      return {
        success: false,
        error: 'Paramètres manquants : subject, message sont requis',
      };
    }

    const result = await this.notificationService.notifyTeachers({
      teacherIds: dto.teacherIds,
      tenantId,
      subject: dto.subject,
      message: dto.message,
      triggeredByUserId: user?.id,
      senderName: dto.senderName,
      senderFunction: dto.senderFunction,
    });

    return {
      success: result.failed === 0,
      result,
    };
  }
}
