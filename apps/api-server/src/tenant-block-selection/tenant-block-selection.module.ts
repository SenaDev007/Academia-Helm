import { Module } from '@nestjs/common';
import { TenantBlockSelectionController } from './tenant-block-selection.controller';
import { TenantBlockSelectionService } from './tenant-block-selection.service';

@Module({
  controllers: [TenantBlockSelectionController],
  providers: [TenantBlockSelectionService],
  exports: [TenantBlockSelectionService],
})
export class TenantBlockSelectionModule {}
