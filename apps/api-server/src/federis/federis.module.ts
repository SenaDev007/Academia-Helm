import { Module } from '@nestjs/common';
import { FederisController } from './federis.controller';
import { FederisService } from './federis.service';
import { FederisSyncService } from './federis-sync.service';
// PrismaService retiré — fourni globalement par DatabaseModule (@Global)

import { FederisConnectController } from './federis-connect.controller';
import { FederisConnectService } from './federis-connect.service';
import { FederisFinanceService } from './federis-finance.service';

@Module({
  controllers: [FederisController, FederisConnectController],
  providers: [FederisService, FederisSyncService, FederisConnectService, FederisFinanceService],
  exports: [FederisService, FederisSyncService, FederisConnectService, FederisFinanceService],
})
export class FederisModule {}
