/**
 * ============================================================================
 * EXAM SCORES SERVICE — Service pour les notes d'examens
 * ============================================================================
 */

import { BaseEntityService } from '@/lib/offline/base-entity.service';

export interface ExamScore {
  id: string;
  tenantId: string;
  examId: string;
  studentId: string;
  score: number;
  maxScore?: number;
  comment?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

class ExamScoreService extends BaseEntityService<ExamScore> {
  constructor() {
    super({
      storeName: 'exam_scores',
      entityType: 'EXAM_SCORE',
      apiPrefix: '/api/exam-scores',
      moduleName: 'ExamScores',
    });
  }
}

class ExamScoresService {
  private scoreService = new ExamScoreService();

  async getAllScores(tenantId: string) {
    return this.scoreService.getAll(tenantId);
  }

  async getScoreById(tenantId: string, id: string) {
    return this.scoreService.getById(tenantId, id);
  }

  async createScore(tenantId: string, data: Partial<ExamScore>) {
    return this.scoreService.create(tenantId, data);
  }

  async updateScore(tenantId: string, id: string, data: Partial<ExamScore>) {
    return this.scoreService.update(tenantId, id, data);
  }

  async deleteScore(tenantId: string, id: string) {
    return this.scoreService.delete(tenantId, id);
  }
}

export const examScoresService = new ExamScoresService();
