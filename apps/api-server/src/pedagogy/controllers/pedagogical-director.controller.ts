/**
 * ============================================================================
 * PEDAGOGICAL DIRECTOR CONTROLLER - MODULE 2
 * ============================================================================
 * 
 * Controller pour l'espace pédagogique Direction
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PedagogicalDocumentService } from '../services/pedagogical-document.service';
import { PedagogicalWorkflowService } from '../services/pedagogical-workflow.service';
import { PedagogicalNotificationService } from '../services/pedagogical-notification.service';
import { WeeklySemainierService } from '../services/weekly-semainier.service';

@Controller('api/pedagogy/director')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('DIRECTOR', 'ADMIN')
export class PedagogicalDirectorController {
  constructor(
    private readonly documentService: PedagogicalDocumentService,
    private readonly workflowService: PedagogicalWorkflowService,
    private readonly notificationService: PedagogicalNotificationService,
    private readonly semainierService: WeeklySemainierService,
  ) {}

  // ============================================================================
  // RÉCEPTION & CONTRÔLE DES DOCUMENTS
  // ============================================================================

  /**
   * Récupère tous les documents soumis (réception)
   */
  @Get('documents/submitted')
  async getSubmittedDocuments(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('documentType') documentType?: string,
    @Query('status') status?: string,
    @Query('teacherId') teacherId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.documentService.findSubmittedDocuments(tenant.id, academicYearId, schoolLevelId, {
      documentType,
      status,
      teacherId,
      classId,
    });
  }

  /**
   * Récupère un document soumis par ID
   */
  @Get('documents/:id')
  async getDocument(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.documentService.findDocumentById(id, tenant.id);
  }

  /**
   * Valide un document (Direction)
   */
  @Post('documents/:id/approve')
  async approveDocument(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: { comments?: string; sectionComments?: any },
  ) {
    const document = await this.workflowService.approveDocument(
      id,
      tenant.id,
      user.id,
      data.comments,
      data.sectionComments,
    );

    // Notifier l'enseignant
    await this.notificationService
      .notifyValidation(id, tenant.id, 'APPROVED', data.comments)
      .catch((error) => {
        console.error('Failed to send approval notification:', error);
      });

    return document;
  }

  /**
   * Rejette un document (Direction)
   * Motif obligatoire
   */
  @Post('documents/:id/reject')
  async rejectDocument(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: { rejectionReason: string; comments?: string; sectionComments?: any },
  ) {
    if (!data.rejectionReason || data.rejectionReason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is mandatory');
    }

    const document = await this.workflowService.rejectDocument(
      id,
      tenant.id,
      user.id,
      data.rejectionReason,
      data.comments,
      data.sectionComments,
    );

    // Notifier l'enseignant
    await this.notificationService
      .notifyValidation(id, tenant.id, 'REJECTED', data.comments)
      .catch((error) => {
        console.error('Failed to send rejection notification:', error);
      });

    return document;
  }

  /**
   * Prend en compte un cahier de textes (Direction)
   * Pas de rejet pour les cahiers de textes
   */
  @Post('documents/:id/acknowledge')
  async acknowledgeDocument(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: { comments?: string },
  ) {
    const document = await this.workflowService.acknowledgeDocument(
      id,
      tenant.id,
      user.id,
      data.comments,
    );

    // Notifier l'enseignant
    await this.notificationService
      .notifyValidation(id, tenant.id, 'ACKNOWLEDGED', data.comments)
      .catch((error) => {
        console.error('Failed to send acknowledgment notification:', error);
      });

    return document;
  }

  /**
   * Ajoute un commentaire à un document (Direction)
   */
  @Post('documents/:id/comments')
  async addComment(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: { comment: string; section?: string },
  ) {
    const comment = await this.workflowService.addComment(
      id,
      tenant.id,
      user.id,
      'DIRECTOR',
      data.comment,
      data.section,
    );

    // Notifier l'enseignant
    await this.notificationService.notifyComment(id, tenant.id, comment.id, 'DIRECTOR').catch((error) => {
      console.error('Failed to send comment notification:', error);
    });

    return comment;
  }

  /**
   * Récupère les commentaires d'un document
   */
  @Get('documents/:id/comments')
  async getComments(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.workflowService.getComments(id, tenant.id);
  }

  /**
   * Récupère les reviews/validations d'un document
   */
  @Get('documents/:id/reviews')
  async getReviews(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.workflowService.getDocumentReviews(id, tenant.id);
  }

  /**
   * Récupère l'historique des versions d'un document
   */
  @Get('documents/:id/versions')
  async getVersions(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.workflowService.getDocumentVersions(id, tenant.id);
  }

  // ============================================================================
  // CAHIER DU SEMAINIER - GESTION
  // ============================================================================

  /**
   * Désigne automatiquement le semainier pour une semaine
   */
  @Post('semainier/assign/auto')
  async assignSemainierAuto(
    @GetTenant() tenant: any,
    @Body() data: {
      academicYearId: string;
      schoolLevelId: string;
      weekStartDate: Date;
      weekEndDate: Date;
    },
  ) {
    return this.semainierService.assignSemainierAuto(
      tenant.id,
      data.academicYearId,
      data.schoolLevelId,
      data.weekStartDate,
      data.weekEndDate,
    );
  }

  /**
   * Désigne manuellement le semainier pour une semaine
   */
  @Post('semainier/assign/manual')
  async assignSemainierManual(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Body() data: {
      academicYearId: string;
      schoolLevelId: string;
      weekStartDate: Date;
      weekEndDate: Date;
      teacherId: string;
      reason?: string;
    },
  ) {
    return this.semainierService.assignSemainierManual(
      tenant.id,
      data.academicYearId,
      data.schoolLevelId,
      data.weekStartDate,
      data.weekEndDate,
      data.teacherId,
      user.id,
      data.reason,
    );
  }

  /**
   * Récupère tous les semainiers soumis
   */
  @Get('semainier/submitted')
  async getSubmittedSemainiers(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('status') status?: 'SOUMIS' | 'VALIDATED',
  ) {
    return this.semainierService.findSubmittedSemainiers(tenant.id, academicYearId, schoolLevelId, status);
  }

  /**
   * Valide un semainier (Direction)
   */
  @Post('semainier/:id/validate')
  async validateSemainier(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Param('id') semainierId: string,
  ) {
    const semainier = await this.semainierService.validateSemainier(
      semainierId,
      tenant.id,
      user.id,
    );

    // Notifier l'enseignant
    // await this.notificationService.notifyValidation(...)

    return semainier;
  }

  // ============================================================================
  // STATISTIQUES & RAPPORTS
  // ============================================================================

  /**
   * Récupère les statistiques des documents
   */
  @Get('documents/stats')
  async getDocumentStats(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('teacherId') teacherId?: string,
  ) {
    return this.documentService.getDocumentStats(tenant.id, academicYearId, schoolLevelId, teacherId);
  }

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================

  /**
   * Récupère les notifications non lues
   */
  @Get('notifications')
  async getUnreadNotifications(@GetTenant() tenant: any, @CurrentUser() user: any) {
    return this.notificationService.getUnreadNotifications(user.id, tenant.id);
  }

  /**
   * Marque une notification comme lue
   */
  @Put('notifications/:id/read')
  async markNotificationAsRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationService.markNotificationAsRead(id, user.id);
  }
}

