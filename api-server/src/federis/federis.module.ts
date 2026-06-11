import { Module } from '@nestjs/common';
import { FederisController } from './federis.controller';
import { FederisService } from './federis.service';
import { FederisSyncService } from './federis-sync.service';
import { PrismaService } from '../database/prisma.service';

import { FederisConnectController } from './federis-connect.controller';
import { FederisConnectService } from './federis-connect.service';
import { FederisFinanceService } from './federis-finance.service';

@Module({
  controllers: [FederisController, FederisConnectController],
  providers: [FederisService, FederisSyncService, FederisConnectService, FederisFinanceService, PrismaService],
  exports: [FederisService, FederisSyncService, FederisConnectService, FederisFinanceService],
})
export class FederisModule {}
