import { Module } from '@nestjs/common';
import { FeeConfigurationsController } from './fee-configurations.controller';
import { FeeConfigurationsService } from './fee-configurations.service';
import { FeeConfigurationsRepository } from './fee-configurations.repository';

@Module({
  imports: [],
  controllers: [FeeConfigurationsController],
  providers: [FeeConfigurationsService, FeeConfigurationsRepository],
  exports: [FeeConfigurationsService],
})
export class FeeConfigurationsModule {}

