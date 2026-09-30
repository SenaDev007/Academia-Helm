import { Module } from '@nestjs/common';
import { FederisController } from './federis.controller';
import { FederisService } from './federis.service';
import { FederisSyncService } from './federis-sync.service';
// PrismaService retiré — fourni globalement par DatabaseModule (@Global)

// ⭐ Passerelle Fedapay partagée avec Academia Helm (SDK + signature webhook)
import { BillingModule } from '../billing/billing.module';
// ⭐ EmailService pour l'email automatique identifiants + domaine (pattern Helm)
import { CommunicationModule } from '../communication/communication.module';
import { FederisFedapayService } from './federis-fedapay.service';
import { FederisConnectController } from './federis-connect.controller';
import { FederisConnectService } from './federis-connect.service';
import { FederisFinanceService } from './federis-finance.service';
import { FederisRegisterService } from './federis-register.service';
import { FederisPatronatService } from './federis-patronat.service';
import { FederisPatronatController } from './federis-patronat.controller';
// ⭐ Gestion des comptes membres (coordonnateur → secrétaire, trésorier…)
import { FederisUsersService } from './federis-users.service';
import { FederisUsersController } from './federis-users.controller';
// ⭐ Bureau & Membres : CRUD de la composition du bureau institutionnel
import { FederisBureauService } from './federis-bureau.service';
import { FederisBureauController } from './federis-bureau.controller';
// ⭐ Banque d'épreuves : recensement et sécurisation des sujets (§7.7)
import { FederisQuestionBankService } from './federis-question-bank.service';
import { FederisQuestionBankController } from './federis-question-bank.controller';
// ⭐ Workflow examens : centres, salles, candidats, numéros de table, import
import { FederisExamsService } from './federis-exams.service';
import { FederisExamsController } from './federis-exams.controller';
// ⭐ Portail école : validation des demandes de rattachement patronat
import { FederisSchoolService } from './federis-school.service';
import { FederisSchoolController } from './federis-school.controller';
// ⭐ Workflow délibération → publication → notifications parents (miroir offline)
import { FederisDeliberationService } from './federis-deliberation.service';
import { FederisDeliberationController } from './federis-deliberation.controller';
// ⭐ Examens nationaux côté école : CEP/BEPC/Bac (sélection + envoi patronat)
import { FederisSchoolExamsService } from './federis-school-exams.service';
import { FederisSchoolExamsController } from './federis-school-exams.controller';
// ⭐ Export Excel de la liste officielle des candidats (2026-09-29) — même
//    pattern que les exports Helm (educmaster-excel-export.service.ts)
import { FederisCandidatesExportService } from './federis-candidates-export.service';
// ⭐ PDF officiels : bordereaux d'émargement + palmarès (Puppeteer, même
// pattern que les PDF Helm — rendu backend, aucune génération frontend)
import { FederisPdfService } from './federis-pdf.service';
import { FederisPdfController } from './federis-pdf.controller';
// ⭐ Épreuves & catalogue : création d'épreuves avec champs enrichis (pattern
// fiches pédagogiques / épreuves enseignants Helm) + catalogue année →
// examen (CEP/BEPC/BAC/CAP) → épreuves + PDF backend
import { FederisEpreuveService } from './federis-epreuve.service';
import { FederisEpreuveController } from './federis-epreuve.controller';
// ⭐ Gestion des surveillants (2026-09-29) : module « Centres, salles &
//    Surveillants » — demande aux écoles, sélection des enseignants côté
//    Helm, répartition par centre et par salle, notifications écoles ↔
//    enseignants (workflow complet patronat ↔ écoles rattachées)
import { FederisSupervisorsService } from './federis-supervisors.service';
import { FederisSupervisorsController } from './federis-supervisors.controller';
import { FederisSchoolSupervisorsController } from './federis-school-supervisors.controller';
// ⭐ Module « Notes et Moyennes » (2026-09-29) — reproduction du module
//    Examen d'Academia Helm pour les examens nationaux : saisie des notes
//    (grille primaire CEP / secondaire avec coefficients BEPC-BAC-CAP),
//    registre des notes et relevés de notes (PDF backend A4 paysage)
import { FederisGradesService } from './federis-grades.service';
import { FederisGradesController } from './federis-grades.controller';
// ⭐ Module « Matières » (2026-09-29) — catalogue des matières d'examen par
//    type (CEP/BEPC/BAC/CAP) et par série (BAC), reproduction du CRUD du
//    module Pédagogie Helm ; alimente le lancement des examens, le module
//    Épreuves (signal « épreuves à préparer ») et le module Notes et Moyennes
import { FederisSubjectsService } from './federis-subjects.service';
import { FederisSubjectsController } from './federis-subjects.controller';
// ⭐ Module « Paramètres — Règles de calcul » (2026-09-30) : seuils
//    d'admission/rahcat par type d'examen (CEP/BEPC/BAC/CAP). Défauts du
//    backend affichés dans le module Paramètres ; dès qu'une règle est
//    définie, elle devient la SOURCE DE VÉRITÉ du backend (délibération,
//    décisions des relevés, registre, PDF).
import { FederisGradingRulesService } from './federis-grading-rules.service';
// ⭐ Répertoire officiel des établissements du Bénin (2026-09-30) — base de
//    suggestions pour la création d'écoles PROVISOIRES (module Écoles
//    rattachées) et la désignation des CENTRES d'examen (module Centres).
//    Source initiale : 1 406 établissements secondaires privés (2022-2023).
import { FederisSchoolDirectoryService } from './federis-school-directory.service';
// ⭐ 2026-09-30 — exports Excel « Centres, salles & Surveillants »
import { FederisLogisticsExportService } from './federis-logistics-export.service';

@Module({
  imports: [BillingModule, CommunicationModule],
  controllers: [
    FederisController,
    FederisConnectController,
    FederisPatronatController,
    FederisUsersController,
    FederisBureauController,
    FederisQuestionBankController,
    FederisExamsController,
    FederisSchoolController,
    FederisDeliberationController,
    FederisSchoolExamsController,
    FederisPdfController,
    FederisEpreuveController,
    FederisSupervisorsController,
    FederisSchoolSupervisorsController,
    FederisGradesController,
    FederisSubjectsController,
  ],
  providers: [
    FederisService,
    FederisSyncService,
    FederisConnectService,
    FederisFinanceService,
    FederisRegisterService,
    FederisFedapayService,
    FederisPatronatService,
    FederisUsersService,
    FederisBureauService,
    FederisQuestionBankService,
    FederisExamsService,
    FederisSchoolService,
    FederisDeliberationService,
    FederisSchoolExamsService,
    // ⭐ 2026-09-29 — FIX build Railway : FederisCandidatesExportService
    //    était dans exports mais PAS dans providers → Nest plantait au
    //    démarrage avec « Nest cannot export a provider/module that is not
    //    a part of the currently processed module (FederisModule) ».
    //    Ajouté aux providers pour qu'il soit instanciable ET exportable.
    FederisCandidatesExportService,
    FederisLogisticsExportService,
    FederisPdfService,
    FederisEpreuveService,
    FederisSupervisorsService,
    FederisGradesService,
    FederisSubjectsService,
    FederisGradingRulesService,
    FederisSchoolDirectoryService,
  ],
  exports: [
    FederisService,
    FederisSyncService,
    FederisConnectService,
    FederisFinanceService,
    FederisRegisterService,
    FederisFedapayService,
    FederisPatronatService,
    FederisUsersService,
    FederisExamsService,
    FederisSchoolService,
    FederisDeliberationService,
    FederisSchoolExamsService,
    FederisCandidatesExportService,
    FederisGradesService,
    FederisSubjectsService,
    FederisGradingRulesService,
  ],
})
export class FederisModule {}
