/**
 * ============================================================================
 * MEETINGS SERVICE — Service pour le module Réunions & Conseils
 * ============================================================================
 */

import { BaseEntityService } from '@/lib/offline/base-entity.service';

export interface Meeting {
  id: string;
  tenantId: string;
  title: string;
  type: string;
  date: string;
  location?: string;
  status?: string;
  agenda?: string;
  minutes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MeetingDecision {
  id: string;
  tenantId: string;
  meetingId: string;
  description: string;
  assignedTo?: string;
  dueDate?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

class MeetingEntityService extends BaseEntityService<Meeting> {
  constructor() {
    super({
      storeName: 'meetings',
      entityType: 'MEETING',
      apiPrefix: '/api/meetings',
      moduleName: 'Meetings',
    });
  }
}

class MeetingDecisionService extends BaseEntityService<MeetingDecision> {
  constructor() {
    super({
      storeName: 'meeting_decisions',
      entityType: 'MEETING_DECISION',
      apiPrefix: '/api/meeting-decisions',
      moduleName: 'MeetingDecisions',
    });
  }
}

class MeetingsService {
  private meetingService = new MeetingEntityService();
  private decisionService = new MeetingDecisionService();

  async getAllMeetings(tenantId: string) {
    return this.meetingService.getAll(tenantId);
  }

  async getMeetingById(tenantId: string, id: string) {
    return this.meetingService.getById(tenantId, id);
  }

  async createMeeting(tenantId: string, data: Partial<Meeting>) {
    return this.meetingService.create(tenantId, data);
  }

  async updateMeeting(tenantId: string, id: string, data: Partial<Meeting>) {
    return this.meetingService.update(tenantId, id, data);
  }

  async deleteMeeting(tenantId: string, id: string) {
    return this.meetingService.delete(tenantId, id);
  }

  // Decisions
  async getAllDecisions(tenantId: string, meetingId?: string) {
    return this.decisionService.getAll(tenantId, {
      filters: meetingId ? { meetingId } : undefined,
    });
  }

  async createDecision(tenantId: string, data: Partial<MeetingDecision>) {
    return this.decisionService.create(tenantId, data);
  }

  async updateDecision(tenantId: string, id: string, data: Partial<MeetingDecision>) {
    return this.decisionService.update(tenantId, id, data);
  }

  async deleteDecision(tenantId: string, id: string) {
    return this.decisionService.delete(tenantId, id);
  }
}

export const meetingsService = new MeetingsService();
