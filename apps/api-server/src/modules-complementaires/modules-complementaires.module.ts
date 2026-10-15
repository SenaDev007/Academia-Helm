import { Module } from '@nestjs/common';
import { CanteenService } from './services/canteen.service';
import { TransportService } from './services/transport.service';
import { LibraryService } from './services/library.service';
import { LabService } from './services/lab.service';
import { InfirmaryService } from './services/infirmary.service';
import { ShopService } from './services/shop.service';
import { ShopReceiptService } from './services/shop-receipt.service';
import { ShopPdfService } from './services/shop-pdf.service';
import { EduCastService } from './services/educast.service';
import { QHSEService } from './services/qhse.service';
import { MedicalService } from './services/medical.service';
import { ModulesComplementairesOrionService } from './services/modules-complementaires-orion.service';
import { ModulesComplementairesController } from './modules-complementaires.controller';
// ⭐ 2026-10-15 — Modèle métier Cantine (capital, vente journalière, dispatching, bilan)
import { CanteenBusinessController } from './canteen-business.controller';

/**
 * Module pour le MODULE 9 — Modules Complémentaires
 *
 * ⭐ ShopReceiptService dépend de PuppeteerPoolService (fourni globalement
 *    par CommonModule) — pas besoin de le re-déclarer ici.
 */
@Module({
  imports: [],
  controllers: [ModulesComplementairesController, CanteenBusinessController],
  providers: [
    CanteenService,
    TransportService,
    LibraryService,
    LabService,
    InfirmaryService,
    ShopService,
    ShopReceiptService,
    ShopPdfService,
    EduCastService,
    QHSEService,
    MedicalService,
    ModulesComplementairesOrionService,
  ],
  exports: [
    CanteenService,
    TransportService,
    LibraryService,
    LabService,
    InfirmaryService,
    ShopService,
    ShopReceiptService,
    ShopPdfService,
    EduCastService,
    QHSEService,
    MedicalService,
    ModulesComplementairesOrionService,
  ],
})
export class ModulesComplementairesModule {}
