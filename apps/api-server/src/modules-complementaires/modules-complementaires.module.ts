import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CanteenService } from './services/canteen.service';
import { TransportService } from './services/transport.service';
import { LibraryService } from './services/library.service';
import { LabService } from './services/lab.service';
import { InfirmaryService } from './services/infirmary.service';
import { ShopService } from './services/shop.service';
import { EducastService } from './services/educast.service';
import { QHSEService } from './services/qhse.service';
import { ModulesComplementairesOrionService } from './services/modules-complementaires-orion.service';
import { ModulesComplementairesController } from './modules-complementaires.controller';

/**
 * Module pour le MODULE 9 — Modules Complémentaires
 */
@Module({
  imports: [DatabaseModule],
  controllers: [ModulesComplementairesController],
  providers: [
    CanteenService,
    TransportService,
    LibraryService,
    LabService,
    InfirmaryService,
    ShopService,
    EducastService,
    QHSEService,
    ModulesComplementairesOrionService,
  ],
  exports: [
    CanteenService,
    TransportService,
    LibraryService,
    LabService,
    InfirmaryService,
    ShopService,
    EducastService,
    QHSEService,
    ModulesComplementairesOrionService,
  ],
})
export class ModulesComplementairesModule {}
