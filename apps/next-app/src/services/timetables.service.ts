/**
 * ============================================================================
 * TIMETABLES SERVICE — Service pour le module Emplois du temps
 * ============================================================================
 */

import { BaseEntityService } from '@/lib/offline/base-entity.service';

export interface Timetable {
  id: string;
  tenantId: string;
  name: string;
  classId?: string;
  academicYearId?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TimetableSlot {
  id: string;
  tenantId: string;
  timetableId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectId?: string;
  teacherId?: string;
  roomId?: string;
  createdAt?: string;
  updatedAt?: string;
}

class TimetableEntityService extends BaseEntityService<Timetable> {
  constructor() {
    super({
      storeName: 'timetables',
      entityType: 'TIMETABLE',
      apiPrefix: '/api/timetables',
      moduleName: 'Timetables',
    });
  }
}

class TimetableSlotService extends BaseEntityService<TimetableSlot> {
  constructor() {
    super({
      storeName: 'timetable_slots',
      entityType: 'TIMETABLE_SLOT',
      apiPrefix: '/api/timetables/slots',
      moduleName: 'TimetableSlots',
    });
  }
}

class TimetablesService {
  private timetableService = new TimetableEntityService();
  private slotService = new TimetableSlotService();

  async getAllTimetables(tenantId: string) {
    return this.timetableService.getAll(tenantId);
  }

  async getTimetableById(tenantId: string, id: string) {
    return this.timetableService.getById(tenantId, id);
  }

  async createTimetable(tenantId: string, data: Partial<Timetable>) {
    return this.timetableService.create(tenantId, data);
  }

  async updateTimetable(tenantId: string, id: string, data: Partial<Timetable>) {
    return this.timetableService.update(tenantId, id, data);
  }

  async deleteTimetable(tenantId: string, id: string) {
    return this.timetableService.delete(tenantId, id);
  }

  // Slots
  async getAllSlots(tenantId: string, timetableId?: string) {
    return this.slotService.getAll(tenantId, {
      filters: timetableId ? { timetableId } : undefined,
    });
  }

  async createSlot(tenantId: string, data: Partial<TimetableSlot>) {
    return this.slotService.create(tenantId, data);
  }

  async updateSlot(tenantId: string, id: string, data: Partial<TimetableSlot>) {
    return this.slotService.update(tenantId, id, data);
  }

  async deleteSlot(tenantId: string, id: string) {
    return this.slotService.delete(tenantId, id);
  }
}

export const timetablesService = new TimetablesService();
