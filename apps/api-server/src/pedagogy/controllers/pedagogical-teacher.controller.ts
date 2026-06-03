/**
 * ============================================================================
 * PEDAGOGICAL TEACHER CONTROLLER - MODULE 2
 * ============================================================================
 * 
 * Controller pour l'espace pédagogique Enseignant
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PedagogicalDocumentService } from '../services/pedagogical-document.service';
import { PedagogicalWorkflowService } from '../services/pedagogical-workflow.service';
import { PedagogicalNotificationService } from '../services/pedagogical-notification.service';
import { WeeklySemainierService } from '../services/weekly-semainier.service';
import { CreatePedagogicalDocumentDto } from '../dto/create-pedagogical-document.dto';
import { UpdatePedagogicalDocumentDto } from '../dto/update-pedagogical-document.dto';

@Controller('pedagogy/teacher')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PedagogicalTeacherController {
  constructor(
    private readonly documentService: PedagogicalDocumentService,
    private readonly workflowService: PedagogicalWorkflowService,
    private readonly notificationService: PedagogicalNotificationService,
    private readonly semainierService: WeeklySemainierService,
  ) {}

  // ============================================================================
  // DOCUMENTS PÉDAGOGIQUES
  // ============================================================================

  /**
   * Crée un document pédagogique
   */
  @Post('documents')
  async createDocument(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Body() data: CreatePedagogicalDocumentDto,
  ) {
    // Vérifier que l'enseignant est bien l'utilisateur connecté
    if (data.teacherId !== user.teacherId && !user.roles?.includes('ADMIN')) {
      throw new BadRequestException('You can only create documents for yourself');
    }

    return this.documentService.createDocument(
      tenant.id,
      data.academicYearId,
      data.schoolLevelId,
      data.teacherId,
      data as any,
    );
  }

  /**
   * Récupère tous les documents de l'enseignant
   */
  @Get('documents')
  async getMyDocuments(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId: string,
    @Query('documentType') documentType?: string,
    @Query('status') status?: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    if (!user.teacherId) {
      throw new BadRequestException('User is not associated with a teacher');
    }

    return this.documentService.findTeacherDocuments(
      tenant.id,
      academicYearId,
      schoolLevelId,
      user.teacherId,
      {
        documentType,
        status,
        classId,
        subjectId,
      },
    );
  }

  /**
   * Récupère un document par ID
   */
  @Get('documents/:id')
  async getDocument(@GetTenant() tenant: any, @CurrentUser() user: any, @Param('id') id: string) {
    if (!user.teacherId) {
      throw new BadRequestException('User is not associated with a teacher');
    }

    return this.documentService.findDocumentById(id, tenant.id, user.teacherId);
  }

  /**
   * Met à jour un document (seulement si DRAFT)
   */
  @Put('documents/:id')
  async updateDocument(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: UpdatePedagogicalDocumentDto,
  ) {
    if (!user.teacherId) {
      throw new BadRequestException('User is not associated with a teacher');
    }

    return this.documentService.updateDocument(id, tenant.id, user.teacherId, data as any);
  }

  /**
   * Supprime un document (seulement si DRAFT)
   */
  @Delete('documents/:id')
  async deleteDocument(@GetTenant() tenant: any, @CurrentUser() user: any, @Param('id') id: string) {
    if (!user.teacherId) {
      throw new BadRequestException('User is not associated with a teacher');
    }

    return this.documentService.deleteDocument(id, tenant.id, user.teacherId);
  }

  /**
   * Soumet un document à la direction
   */
  @Post('documents/:id/submit')
  async submitDocument(@GetTenant() tenant: any, @CurrentUser() user: any, @Param('id') id: string) {
    if (!user.teacherId) {
      throw new BadRequestException('User is not associated with a teacher');
    }

    const document = await this.workflowService.submitDocument(id, tenant.id, user.teacherId);

    // Envoyer notification à la direction
    await this.notificationService.notifySubmission(id, tenant.id).catch((error) => {
      console.error('Failed to send submission notification:', error);
    });

    return document;
  }

  /**
   * Ajoute un commentaire à un document
   */
  @Post('documents/:id/comments')
  async addComment(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: { comment: string; section?: string },
  ) {
    if (!user.teacherId) {
      throw new BadRequestException('User is not associated with a teacher');
    }

    const comment = await this.workflowService.addComment(
      id,
      tenant.id,
      user.id,
      'TEACHER',
      data.comment,
      data.section,
    );

    // Notifier la direction
    await this.notificationService.notifyComment(id, tenant.id, comment.id, 'TEACHER').catch((error) => {
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
   * Récupère l'historique des versions d'un document
   */
  @Get('documents/:id/versions')
  async getVersions(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.workflowService.getDocumentVersions(id, tenant.id);
  }

  /**
   * Récupère les statistiques des documents
   */
  @Get('documents/stats')
  async getDocumentStats(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    if (!user.teacherId) {
      throw new BadRequestException('User is not associated with a teacher');
    }

    return this.documentService.getDocumentStats(
      tenant.id,
      academicYearId,
      schoolLevelId,
      user.teacherId,
    );
  }

  // ============================================================================
  // CAHIER DU SEMAINIER
  // ============================================================================

  /**
   * Récupère le semainier actuel de l'enseignant
   */
  @Get('semainier/current')
  async getCurrentSemainier(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId: string,
  ) {
    if (!user.teacherId) {
      throw new BadRequestException('User is not associated with a teacher');
    }

    return this.semainierService.getCurrentSemainier(
      tenant.id,
      academicYearId,
      schoolLevelId,
      user.teacherId,
    );
  }

  /**
   * Crée ou met à jour le semainier
   */
  @Post('semainier')
  async createOrUpdateSemainier(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Body() data: {
      academicYearId: string;
      schoolLevelId: string;
      assignmentId: string;
      content: string;
    },
  ) {
    if (!user.teacherId) {
      throw new BadRequestException('User is not associated with a teacher');
    }

    return this.semainierService.createOrUpdateSemainier(
      tenant.id,
      data.academicYearId,
      data.schoolLevelId,
      data.assignmentId,
      user.teacherId,
      data.content,
    );
  }

  /**
   * Ajoute une entrée quotidienne au semainier
   */
  @Post('semainier/:id/daily-entries')
  async addDailyEntry(
    @GetTenant() tenant: any,
    @Param('id') semainierId: string,
    @Body() data: {
      date: Date;
      observations?: string;
      actions?: string;
      events?: any;
    },
  ) {
    return this.semainierService.addDailyEntry(semainierId, tenant.id, data.date, data);
  }

  /**
   * Signale un incident dans le semainier
   */
  @Post('semainier/:id/incidents')
  async reportIncident(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Param('id') semainierId: string,
    @Body() data: {
      date: Date;
      type: 'ABSENCE' | 'RETARD' | 'DISCIPLINE' | 'SECURITY' | 'OTHER';
      description: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      actions?: string;
    },
  ) {
    return this.semainierService.reportIncident(semainierId, tenant.id, data.date, user.id, data);
  }

  /**
   * Soumet le semainier à la direction (en fin de semaine)
   */
  @Post('semainier/:id/submit')
  async submitSemainier(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Param('id') semainierId: string,
  ) {
    if (!user.teacherId) {
      throw new BadRequestException('User is not associated with a teacher');
    }

    const semainier = await this.semainierService.submitSemainier(
      semainierId,
      tenant.id,
      user.teacherId,
    );

    // Notifier la direction
    await this.notificationService.notifySubmission(semainier.id, tenant.id).catch((error) => {
      console.error('Failed to send semainier submission notification:', error);
    });

    return semainier;
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

