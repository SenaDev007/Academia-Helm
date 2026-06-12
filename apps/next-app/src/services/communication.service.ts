/**
 * ============================================================================
 * COMMUNICATION SERVICE — Service pour le module Communication
 * ============================================================================
 *
 * Utilise le DualWriteService pour garantir la double-écriture
 * (IndexedDB + PostgreSQL) sur toutes les opérations.
 * ============================================================================
 */

import { BaseEntityService } from '@/lib/offline/base-entity.service';
import { dualWriteService, type DualWriteResult } from '@/lib/offline/dual-write.service';
import { offlineFetch } from '@/lib/offline/offline-fetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SMSMessage {
  id: string;
  tenantId: string;
  recipientPhone: string;
  content: string;
  status?: string;
  senderName?: string;
  sentAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmailMessage {
  id: string;
  tenantId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status?: string;
  sentAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommunicationTemplate {
  id: string;
  tenantId: string;
  name: string;
  type: 'SMS' | 'EMAIL' | 'WHATSAPP';
  content: string;
  variables?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Services par entité
// ---------------------------------------------------------------------------

class SMSService extends BaseEntityService<SMSMessage> {
  constructor() {
    super({
      storeName: 'sms_queue',
      entityType: 'SMS',
      apiPrefix: '/api/communication/sms',
      moduleName: 'Communication-SMS',
    });
  }
}

class EmailService extends BaseEntityService<EmailMessage> {
  constructor() {
    super({
      storeName: 'email_queue',
      entityType: 'EMAIL',
      apiPrefix: '/api/communication/email',
      moduleName: 'Communication-Email',
    });
  }
}

class CommunicationTemplateService extends BaseEntityService<CommunicationTemplate> {
  constructor() {
    super({
      storeName: 'communication_templates',
      entityType: 'COMMUNICATION_TEMPLATE',
      apiPrefix: '/api/communication/templates',
      moduleName: 'Communication-Templates',
    });
  }
}

// ---------------------------------------------------------------------------
// Service Communication unifié
// ---------------------------------------------------------------------------

class CommunicationService {
  private smsService = new SMSService();
  private emailService = new EmailService();
  private templateService = new CommunicationTemplateService();

  // --- SMS ---

  async getAllSMS(tenantId: string) {
    return this.smsService.getAll(tenantId);
  }

  async sendSMS(tenantId: string, data: Partial<SMSMessage>) {
    return this.smsService.create(tenantId, data);
  }

  // --- Email ---

  async getAllEmails(tenantId: string) {
    return this.emailService.getAll(tenantId);
  }

  async sendEmail(tenantId: string, data: Partial<EmailMessage>) {
    return this.emailService.create(tenantId, data);
  }

  // --- Templates ---

  async getAllTemplates(tenantId: string) {
    return this.templateService.getAll(tenantId);
  }

  async createTemplate(tenantId: string, data: Partial<CommunicationTemplate>) {
    return this.templateService.create(tenantId, data);
  }

  async updateTemplate(tenantId: string, id: string, data: Partial<CommunicationTemplate>) {
    return this.templateService.update(tenantId, id, data);
  }

  async deleteTemplate(tenantId: string, id: string) {
    return this.templateService.delete(tenantId, id);
  }
}

export const communicationService = new CommunicationService();
