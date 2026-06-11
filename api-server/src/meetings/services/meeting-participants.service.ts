import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service pour la gestion des participants aux réunions
 */
@Injectable()
export class MeetingParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère tous les participants d'une réunion
   */
  async findByMeeting(meetingId: string, tenantId: string) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    return this.prisma.meetingParticipant.findMany({
      where: { meetingId },
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
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Ajoute un participant à une réunion
   */
  async addParticipant(
    meetingId: string,
    tenantId: string,
    data: {
      participantType: string; // STAFF | GUARDIAN | STUDENT
      participantId: string;
    },
    invitedBy: string,
  ) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    // Vérifier que la réunion n'est pas déjà tenue
    if (meeting.status === 'HELD') {
      throw new BadRequestException('Cannot add participants to a meeting that has already been held');
    }

    // Vérifier si le participant existe déjà
    const existing = await this.prisma.meetingParticipant.findUnique({
      where: {
        meetingId_participantType_participantId: {
          meetingId,
          participantType: data.participantType,
          participantId: data.participantId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Participant already added to this meeting');
    }

    return this.prisma.meetingParticipant.create({
      data: {
        meetingId,
        participantType: data.participantType,
        participantId: data.participantId,
        invitedBy,
        invitedAt: new Date(),
      },
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
    });
  }

  /**
   * Supprime un participant d'une réunion
   */
  async removeParticipant(
    meetingId: string,
    participantId: string,
    tenantId: string,
  ) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    // Vérifier que la réunion n'est pas déjà tenue
    if (meeting.status === 'HELD') {
      throw new BadRequestException('Cannot remove participants from a meeting that has already been held');
    }

    const participant = await this.prisma.meetingParticipant.findFirst({
      where: {
        meetingId,
        participantId,
      },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    return this.prisma.meetingParticipant.delete({
      where: { id: participant.id },
    });
  }

  /**
   * Met à jour le statut de présence d'un participant
   */
  async updateAttendance(
    meetingId: string,
    participantId: string,
    tenantId: string,
    data: {
      attendanceStatus: string; // PRESENT | ABSENT | EXCUSED | NOT_ATTENDED
      attendanceTime?: Date;
      excuseReason?: string;
    },
  ) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    const participant = await this.prisma.meetingParticipant.findFirst({
      where: {
        meetingId,
        participantId,
      },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    return this.prisma.meetingParticipant.update({
      where: { id: participant.id },
      data: {
        attendanceStatus: data.attendanceStatus,
        attendanceTime: data.attendanceTime || null,
        excuseReason: data.excuseReason || null,
        updatedAt: new Date(),
      },
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
    });
  }

  /**
   * Calcule le taux de présence pour une réunion
   */
  async calculateAttendanceRate(meetingId: string, tenantId: string) {
    // Vérifier que la réunion appartient au tenant
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    const participants = await this.prisma.meetingParticipant.findMany({
      where: { meetingId },
    });

    if (participants.length === 0) {
      return { rate: 0, total: 0, present: 0, absent: 0, excused: 0, notAttended: 0 };
    }

    const present = participants.filter((p) => p.attendanceStatus === 'PRESENT').length;
    const absent = participants.filter((p) => p.attendanceStatus === 'ABSENT').length;
    const excused = participants.filter((p) => p.attendanceStatus === 'EXCUSED').length;
    const notAttended = participants.filter((p) => p.attendanceStatus === 'NOT_ATTENDED' || !p.attendanceStatus).length;

    const rate = (present / participants.length) * 100;

    return {
      rate: Math.round(rate * 100) / 100,
      total: participants.length,
      present,
      absent,
      excused,
      notAttended,
    };
  }
}

