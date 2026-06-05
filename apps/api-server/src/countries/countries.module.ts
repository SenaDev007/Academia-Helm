import { Module } from '@nestjs/common';
import { CountriesService } from './countries.service';
import { CountriesController } from './countries.controller';
import { CountriesRepository } from './countries.repository';

@Module({
  imports: [],
  controllers: [CountriesController],
  providers: [CountriesService, CountriesRepository],
  exports: [CountriesService, CountriesRepository],
})
export class CountriesModule {}

