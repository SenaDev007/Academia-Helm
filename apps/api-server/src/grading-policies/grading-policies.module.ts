import { Module } from '@nestjs/common';
import { GradingPoliciesService } from './grading-policies.service';
import { GradingPoliciesController } from './grading-policies.controller';
import { GradingPoliciesRepository } from './grading-policies.repository';
import { CountriesModule } from '../countries/countries.module';

@Module({
  imports: [
    CountriesModule,
  ],
  controllers: [GradingPoliciesController],
  providers: [GradingPoliciesService, GradingPoliciesRepository],
  exports: [GradingPoliciesService, GradingPoliciesRepository],
})
export class GradingPoliciesModule {}

