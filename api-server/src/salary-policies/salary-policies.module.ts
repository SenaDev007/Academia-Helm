import { Module } from '@nestjs/common';
import { SalaryPoliciesService } from './salary-policies.service';
import { SalaryPoliciesController } from './salary-policies.controller';
import { SalaryPoliciesRepository } from './salary-policies.repository';
import { CountriesModule } from '../countries/countries.module';

@Module({
  imports: [
    CountriesModule,
  ],
  controllers: [SalaryPoliciesController],
  providers: [SalaryPoliciesService, SalaryPoliciesRepository],
  exports: [SalaryPoliciesService, SalaryPoliciesRepository],
})
export class SalaryPoliciesModule {}

