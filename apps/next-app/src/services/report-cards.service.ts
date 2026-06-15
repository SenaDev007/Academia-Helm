/**
 * ============================================================================
 * REPORT CARDS SERVICE — Service pour les bulletins scolaires
 * ============================================================================
 */

import { BaseEntityService } from '@/lib/offline/base-entity.service';

export interface ReportCard {
  id: string;
  tenantId: string;
  studentId: string;
  classId?: string;
  academicYearId?: string;
  period?: string;
  grades?: any[];
  average?: number;
  rank?: number;
  appreciation?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'VALIDATED';
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

class ReportCardEntityService extends BaseEntityService<ReportCard> {
  constructor() {
    super({
      storeName: 'report_cards',
      entityType: 'REPORT_CARD',
      apiPrefix: '/api/report-cards',
      moduleName: 'ReportCards',
    });
  }
}

class ReportCardsService {
  private reportCardService = new ReportCardEntityService();

  async getAllReportCards(tenantId: string) {
    return this.reportCardService.getAll(tenantId);
  }

  async getReportCardById(tenantId: string, id: string) {
    return this.reportCardService.getById(tenantId, id);
  }

  async createReportCard(tenantId: string, data: Partial<ReportCard>) {
    return this.reportCardService.create(tenantId, data);
  }

  async updateReportCard(tenantId: string, id: string, data: Partial<ReportCard>) {
    return this.reportCardService.update(tenantId, id, data);
  }

  async deleteReportCard(tenantId: string, id: string) {
    return this.reportCardService.delete(tenantId, id);
  }
}

export const reportCardsService = new ReportCardsService();
