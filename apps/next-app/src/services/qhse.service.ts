/**
 * ============================================================================
 * QHSE SERVICE — Service pour le module QHSE (Qualité, Hygiène, Sécurité, Environnement)
 * ============================================================================
 */

import { BaseEntityService } from '@/lib/offline/base-entity.service';

export interface QHSEIncident {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status?: string;
  reportedBy?: string;
  reportedAt?: string;
  location?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QHSEAudit {
  id: string;
  tenantId: string;
  title: string;
  type: string;
  status?: string;
  auditor?: string;
  scheduledDate?: string;
  completedDate?: string;
  findings?: string;
  createdAt?: string;
  updatedAt?: string;
}

class QHSEIncidentService extends BaseEntityService<QHSEIncident> {
  constructor() {
    super({
      storeName: 'qhse_incidents',
      entityType: 'QHSE_INCIDENT',
      apiPrefix: '/api/qhs/incidents',
      moduleName: 'QHSE-Incidents',
    });
  }
}

class QHSEAuditService extends BaseEntityService<QHSEAudit> {
  constructor() {
    super({
      storeName: 'qhse_audits',
      entityType: 'QHSE_AUDIT',
      apiPrefix: '/api/qhs/audits',
      moduleName: 'QHSE-Audits',
    });
  }
}

class QHSEService {
  private incidentService = new QHSEIncidentService();
  private auditService = new QHSEAuditService();

  // --- Incidents ---

  async getAllIncidents(tenantId: string) {
    return this.incidentService.getAll(tenantId);
  }

  async getIncidentById(tenantId: string, id: string) {
    return this.incidentService.getById(tenantId, id);
  }

  async createIncident(tenantId: string, data: Partial<QHSEIncident>) {
    return this.incidentService.create(tenantId, data);
  }

  async updateIncident(tenantId: string, id: string, data: Partial<QHSEIncident>) {
    return this.incidentService.update(tenantId, id, data);
  }

  async deleteIncident(tenantId: string, id: string) {
    return this.incidentService.delete(tenantId, id);
  }

  // --- Audits ---

  async getAllAudits(tenantId: string) {
    return this.auditService.getAll(tenantId);
  }

  async createAudit(tenantId: string, data: Partial<QHSEAudit>) {
    return this.auditService.create(tenantId, data);
  }

  async updateAudit(tenantId: string, id: string, data: Partial<QHSEAudit>) {
    return this.auditService.update(tenantId, id, data);
  }

  async deleteAudit(tenantId: string, id: string) {
    return this.auditService.delete(tenantId, id);
  }
}

export const qhseService = new QHSEService();
