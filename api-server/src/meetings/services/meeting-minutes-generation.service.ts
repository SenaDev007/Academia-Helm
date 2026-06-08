import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MeetingMinutesTemplateService } from './meeting-minutes-template.service';
import { MeetingMinutesService } from './meeting-minutes.service';
import * as Handlebars from 'handlebars';

/**
 * Service pour la génération de comptes rendus depuis les templates
 */
@Injectable()
export class MeetingMinutesGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateService: MeetingMinutesTemplateService,
    private readonly minutesService: MeetingMinutesService,
  ) {}

  /**
   * Génère un compte rendu depuis un template pour une réunion
   */
  async generateFromTemplate(
    meetingId: string,
    tenantId: string,
    recordedBy: string,
    templateId?: string,
  ) {
    // Récupérer la réunion avec toutes ses données
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
      include: {
        academicYear: true,
        schoolLevel: true,
        class: true,
        student: true,
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        participants: {
          include: {
            inviter: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        agendas: {
          orderBy: { agendaOrder: 'asc' },
          include: {
            presenter: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        decisions: {
          orderBy: { decisionOrder: 'asc' },
          include: {
            responsible: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    // Récupérer le template (système par défaut si non spécifié)
    let template;
    if (templateId) {
      template = await this.templateService.findOne(templateId, tenantId);
    } else {
      template = await this.templateService.getSystemTemplate(meeting.meetingType);
    }

    // Préparer les données pour le template
    const templateData = this.prepareTemplateData(meeting, tenantId);

    // Rendre le template (remplacer les variables)
    const renderedContent = this.renderTemplate(template.template, templateData);

    // Créer ou mettre à jour le compte rendu
    const minutes = await this.minutesService.createOrUpdate(
      meetingId,
      tenantId,
      {
        content: this.extractContentFromRendered(renderedContent),
        language: template.language || 'FR',
      },
      recordedBy,
    );

    // Mettre à jour avec le template utilisé et le contenu rendu
    const updatedMinutes = await this.prisma.meetingMinutes.update({
      where: { meetingId },
      data: {
        templateId: template.id,
        renderedContent,
        updatedAt: new Date(),
      },
      include: {
        template: true,
        recorder: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updatedMinutes;
  }

  /**
   * Prépare les données pour le template
   */
  private prepareTemplateData(meeting: any, tenantId: string) {
    // Récupérer les informations du tenant (nom de l'établissement)
    // TODO: Récupérer depuis le service Tenant

    const participantsByStatus = {
      present: [],
      excused: [],
      absent: [],
    };

    meeting.participants.forEach((p: any) => {
      const participantData = {
        name: `${p.participantType}-${p.participantId}`, // TODO: Résoudre le nom réel
        function: p.participantType,
      };

      if (p.attendanceStatus === 'PRESENT') {
        participantsByStatus.present.push(participantData);
      } else if (p.attendanceStatus === 'EXCUSED') {
        participantsByStatus.excused.push(participantData);
      } else {
        participantsByStatus.absent.push(participantData);
      }
    });

    return {
      tenant_name: 'Établissement', // TODO: Récupérer depuis Tenant
      meeting_date: meeting.meetingDate.toLocaleDateString('fr-FR'),
      start_time: meeting.startTime || '',
      end_time: meeting.endTime || '',
      location: meeting.location || '',
      academic_year: meeting.academicYear?.name || '',
      school_level: meeting.schoolLevel?.name || '',
      class_name: meeting.class?.name || '',
      class_or_level: meeting.class?.name || meeting.schoolLevel?.name || '',
      meeting_type: meeting.meetingType,
      title: meeting.title,
      description: meeting.description || '',
      participants: participantsByStatus,
      agendas: meeting.agendas.map((a: any) => ({
        topic: a.topic,
        description: a.description || '',
        presenterName: a.presenter
          ? `${a.presenter.firstName} ${a.presenter.lastName}`
          : '',
      })),
      decisions: meeting.decisions.map((d: any) => ({
        decisionOrder: d.decisionOrder,
        decisionText: d.decisionText,
        responsibleName: d.responsible
          ? `${d.responsible.firstName} ${d.responsible.lastName}`
          : '',
        dueDate: d.dueDate ? d.dueDate.toLocaleDateString('fr-FR') : '',
        status: d.status,
      })),
      recorderName: 'Utilisateur', // TODO: Récupérer depuis User
      validatorName: '', // Sera rempli lors de la validation
      validatedAt: '', // Sera rempli lors de la validation
      recordedAt: new Date().toLocaleDateString('fr-FR'),
    };
  }

  /**
   * Rend le template en utilisant Handlebars
   * Support complet des boucles, conditions, helpers, etc.
   */
  private renderTemplate(template: string, data: any): string {
    try {
      // Compiler le template Handlebars
      const compiledTemplate = Handlebars.compile(template);

      // Enregistrer des helpers Handlebars personnalisés
      this.registerHandlebarsHelpers();

      // Rendre le template avec les données
      const rendered = compiledTemplate(data);

      return rendered;
    } catch (error) {
      console.error('Error rendering template with Handlebars:', error);
      throw new BadRequestException(`Template rendering error: ${error.message}`);
    }
  }

  /**
   * Enregistre les helpers Handlebars personnalisés
   */
  private registerHandlebarsHelpers() {
    // Helper pour formater les dates
    Handlebars.registerHelper('formatDate', (date: Date | string, format?: string) => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      if (format === 'short') {
        return d.toLocaleDateString('fr-FR');
      }
      return d.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    // Helper pour formater l'heure
    Handlebars.registerHelper('formatTime', (time: string) => {
      if (!time) return '';
      return time;
    });

    // Helper pour les conditions
    Handlebars.registerHelper('ifEquals', function (arg1: any, arg2: any, options: any) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    });

    // Helper pour les conditions multiples
    Handlebars.registerHelper('ifIn', function (elem: any, list: any[], options: any) {
      if (list.indexOf(elem) > -1) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    // Helper pour les tableaux vides
    Handlebars.registerHelper('isEmpty', function (array: any[], options: any) {
      if (!array || array.length === 0) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    // Helper pour les tableaux non vides
    Handlebars.registerHelper('isNotEmpty', function (array: any[], options: any) {
      if (array && array.length > 0) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    // Helper pour l'index dans les boucles (0-based → 1-based)
    Handlebars.registerHelper('inc', function (value: number) {
      return parseInt(String(value), 10) + 1;
    });

    // Helper pour mettre en majuscules
    Handlebars.registerHelper('uppercase', function (str: string) {
      return str ? str.toUpperCase() : '';
    });

    // Helper pour mettre en minuscules
    Handlebars.registerHelper('lowercase', function (str: string) {
      return str ? str.toLowerCase() : '';
    });

    // Helper pour capitaliser
    Handlebars.registerHelper('capitalize', function (str: string) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });
  }

  /**
   * Extrait le contenu markdown/text du contenu rendu
   */
  private extractContentFromRendered(renderedContent: string): string {
    // Pour l'instant, retourner le contenu rendu tel quel
    // TODO: Nettoyer le formatage si nécessaire
    return renderedContent;
  }

  /**
   * Crée une nouvelle version d'un compte rendu validé (historisation)
   */
  async createVersion(minutesId: string, tenantId: string, changes: string, modifiedBy: string) {
    const minutes = await this.prisma.meetingMinutes.findFirst({
      where: {
        id: minutesId,
        meeting: {
          tenantId,
        },
      },
    });

    if (!minutes) {
      throw new NotFoundException(`Minutes with ID ${minutesId} not found`);
    }

    // Récupérer la dernière version
    const lastVersion = await this.prisma.meetingMinutesVersion.findFirst({
      where: { minutesId },
      orderBy: { version: 'desc' },
    });

    const newVersionNumber = lastVersion ? lastVersion.version + 1 : minutes.version + 1;

    // Créer la nouvelle version dans l'historique
    const version = await this.prisma.meetingMinutesVersion.create({
      data: {
        minutesId: minutes.id,
        templateId: minutes.templateId,
        version: newVersionNumber,
        content: minutes.content,
        renderedContent: minutes.renderedContent,
        pdfPath: minutes.pdfPath,
        changes,
        modifiedBy,
        modifiedAt: new Date(),
      },
      include: {
        modifier: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Incrémenter la version du compte rendu principal
    await this.prisma.meetingMinutes.update({
      where: { id: minutes.id },
      data: {
        version: newVersionNumber,
        updatedAt: new Date(),
      },
    });

    return version;
  }

  /**
   * Récupère l'historique des versions d'un compte rendu
   */
  async getVersionHistory(minutesId: string, tenantId: string) {
    const minutes = await this.prisma.meetingMinutes.findFirst({
      where: {
        id: minutesId,
        meeting: {
          tenantId,
        },
      },
    });

    if (!minutes) {
      throw new NotFoundException(`Minutes with ID ${minutesId} not found`);
    }

    return this.prisma.meetingMinutesVersion.findMany({
      where: { minutesId },
      orderBy: { version: 'desc' },
      include: {
        modifier: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        validator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}

