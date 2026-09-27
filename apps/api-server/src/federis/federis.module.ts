import { Module } from '@nestjs/common';
import { FederisController } from './federis.controller';
import { FederisService } from './federis.service';
import { FederisSyncService } from './federis-sync.service';
// PrismaService retiré — fourni globalement par DatabaseModule (@Global)

import { FederisConnectController } from './federis-connect.controller';
import { FederisConnectService } from './federis-connect.service';
import { FederisFinanceService } from './federis-finance.service';
import { FederisRegisterService } from './federis-register.service';
import { FederisPatronatService } from './federis-patronat.service';
import { FederisPatronatController } from './federis-patronat.controller';
// ⭐ Gestion des comptes membres (coordonnateur → secrétaire, trésorier…)
import { FederisUsersService } from './federis-users.service';
import { FederisUsersController } from './federis-users.controller';
// ⭐ Workflow examens : centres, salles, candidats, numéros de table, import
import { FederisExamsService } from './federis-exams.service';
import { FederisExamsController } from './federis-exams.controller';
// ⭐ Portail école : validation des demandes de rattachement patronat
import { FederisSchoolService } from './federis-school.service';
import { FederisSchoolController } from './federis-school.controller';

@Module({
  controllers: [
    FederisController,
    FederisConnectController,
    FederisPatronatController,
    FederisUsersController,
    FederisExamsController,
    FederisSchoolController,
  ],
  providers: [
    FederisService,
    FederisSyncService,
    FederisConnectService,
    FederisFinanceService,
    FederisRegisterService,
    FederisPatronatService,
    FederisUsersService,
    FederisExamsService,
    FederisSchoolService,
  ],
  exports: [
    FederisService,
    FederisSyncService,
    FederisConnectService,
    FederisFinanceService,
    FederisRegisterService,
    FederisPatronatService,
    FederisUsersService,
    FederisExamsService,
    FederisSchoolService,
  ],
})
export class FederisModule {}
