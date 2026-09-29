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
    FederisPdfService,
    FederisEpreuveService,
    FederisSupervisorsService,
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
  ],
})
export class FederisModule {}
