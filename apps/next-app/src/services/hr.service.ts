/**
 * ============================================================================
 * HR SERVICE — Service pour le module Personnel, RH & Paie
 * ============================================================================
 *
 * Utilise le DualWriteService pour garantir la double-écriture
 * (IndexedDB + PostgreSQL) sur toutes les opérations.
 * ============================================================================
 */

import { BaseEntityService, type BaseEntityConfig } from '@/lib/offline/base-entity.service';
import { dualWriteService, type DualWriteResult } from '@/lib/offline/dual-write.service';
import { offlineFetch } from '@/lib/offline/offline-fetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Staff {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
  status?: string;
  hireDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Contract {
  id: string;
  tenantId: string;
  staffId: string;
  type: string;
  startDate: string;
  endDate?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Leave {
  id: string;
  tenantId: string;
  staffId: string;
  type: string;
  startDate: string;
  endDate: string;
  status?: string;
  reason?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Services par entité
// ---------------------------------------------------------------------------

class StaffService extends BaseEntityService<Staff> {
  constructor() {
    super({
      storeName: 'staff',
      entityType: 'STAFF',
      apiPrefix: '/api/hr/staff',
      moduleName: 'HR-Staff',
    });
  }
}

class ContractService extends BaseEntityService<Contract> {
  constructor() {
    super({
      storeName: 'contracts',
      entityType: 'CONTRACT',
      apiPrefix: '/api/hr/contracts',
      moduleName: 'HR-Contracts',
    });
  }
}

class LeaveService extends BaseEntityService<Leave> {
  constructor() {
    super({
      storeName: 'leaves',
      entityType: 'LEAVE',
      apiPrefix: '/api/hr/leaves',
      moduleName: 'HR-Leaves',
    });
  }
}

// ---------------------------------------------------------------------------
// Service HR unifié
// ---------------------------------------------------------------------------

class HRService {
  private staffService = new StaffService();
  private contractService = new ContractService();
  private leaveService = new LeaveService();

  // --- Staff ---

  async getAllStaff(tenantId: string) {
    return this.staffService.getAll(tenantId);
  }

  async getStaffById(tenantId: string, id: string) {
    return this.staffService.getById(tenantId, id);
  }

  async createStaff(tenantId: string, data: Partial<Staff>) {
    return this.staffService.create(tenantId, data);
  }

  async updateStaff(tenantId: string, id: string, data: Partial<Staff>) {
    return this.staffService.update(tenantId, id, data);
  }

  async deleteStaff(tenantId: string, id: string) {
    return this.staffService.delete(tenantId, id);
  }

  // --- Contracts ---

  async getAllContracts(tenantId: string) {
    return this.contractService.getAll(tenantId);
  }

  async createContract(tenantId: string, data: Partial<Contract>) {
    return this.contractService.create(tenantId, data);
  }

  async updateContract(tenantId: string, id: string, data: Partial<Contract>) {
    return this.contractService.update(tenantId, id, data);
  }

  async deleteContract(tenantId: string, id: string) {
    return this.contractService.delete(tenantId, id);
  }

  // --- Leaves ---

  async getAllLeaves(tenantId: string) {
    return this.leaveService.getAll(tenantId);
  }

  async createLeave(tenantId: string, data: Partial<Leave>) {
    return this.leaveService.create(tenantId, data);
  }

  async updateLeave(tenantId: string, id: string, data: Partial<Leave>) {
    return this.leaveService.update(tenantId, id, data);
  }

  async deleteLeave(tenantId: string, id: string) {
    return this.leaveService.delete(tenantId, id);
  }
}

export const hrService = new HRService();
