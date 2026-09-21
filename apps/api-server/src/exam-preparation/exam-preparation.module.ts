/**
 * ============================================================================
 * PRÉPARATION D'EXAMEN — Module (épreuves d'évaluation)
 * ============================================================================
 *
 * Module enseignant « Préparation d'examen » — pattern fiches pédagogiques :
 *  - Détection des évaluations programmées (signal par session/matière)
 *  - CRUD blocs + épreuves avec autosave
 *  - Workflow : enseignant → directeur (validation du BLOC) → secrétariat
 *  - Catalogue hiérarchisé + génération PDF professionnelle (Puppeteer)
 *
 * PrismaService est GLOBAL (DatabaseModule @Global).
 * NotificationService est GLOBAL (NotificationModule @Global).
 * PuppeteerPoolService est fourni localement (pattern PedagogyModule).
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { ExamPreparationController } from './exam-preparation.controller';
import { ExamPreparationService } from './exam-preparation.service';
import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';

@Module({
  controllers: [ExamPreparationController],
  providers: [ExamPreparationService, PuppeteerPoolService],
  exports: [ExamPreparationService],
})
export class ExamPreparationModule {}
