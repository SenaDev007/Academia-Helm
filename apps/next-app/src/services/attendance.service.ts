/**
 * ============================================================================
 * ATTENDANCE SERVICE — Service pour le module Présences
 * ============================================================================
 *
 * Utilise le DualWriteService pour garantir la double-écriture
 * (IndexedDB + PostgreSQL) sur toutes les opérations.
 * ============================================================================
 */

import { BaseEntityService } from '@/lib/offline/base-entity.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  studentId: string;
  classId?: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  arrivalTime?: string;
  departureTime?: string;
  notes?: string;
  markedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class AttendanceRecordService extends BaseEntityService<AttendanceRecord> {
  constructor() {
    super({
      storeName: 'attendance_records',
      entityType: 'ATTENDANCE_RECORD',
      apiPrefix: '/api/attendance/records',
      moduleName: 'Attendance',
    });
  }
}

class AttendanceService {
  private recordService = new AttendanceRecordService();

  async getAllRecords(tenantId: string) {
    return this.recordService.getAll(tenantId);
  }

  async getRecordById(tenantId: string, id: string) {
    return this.recordService.getById(tenantId, id);
  }

  async markAttendance(tenantId: string, data: Partial<AttendanceRecord>) {
    return this.recordService.create(tenantId, data);
  }

  async updateAttendance(tenantId: string, id: string, data: Partial<AttendanceRecord>) {
    return this.recordService.update(tenantId, id, data);
  }

  async deleteAttendance(tenantId: string, id: string) {
    return this.recordService.delete(tenantId, id);
  }
}

export const attendanceService = new AttendanceService();
