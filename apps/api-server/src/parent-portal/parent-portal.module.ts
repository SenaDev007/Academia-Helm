import { Module } from '@nestjs/common';
import { ParentPortalController } from './parent-portal.controller';
// ⭐ T27 (2026-10-01) — Examens nationaux dans l'espace parents : résultats de
//    l'enfant + téléchargement du relevé officiel (garde parent de l'élève).
//    FederisModule fournit FederisDeliberationService + FederisPdfService.
import { ParentPortalNationalExamsController } from './parent-portal-national-exams.controller';
import { FederisModule } from '../federis/federis.module';

@Module({
  imports: [FederisModule],
  controllers: [ParentPortalController, ParentPortalNationalExamsController],
})
export class ParentPortalModule {}
