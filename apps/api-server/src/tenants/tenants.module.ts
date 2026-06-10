import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { TenantsRepository } from './tenants.repository';
import { CountriesModule } from '../countries/countries.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    CountriesModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService, TenantsRepository],
  exports: [
    TenantsService,
    TenantsRepository,
  ],
})
export class TenantsModule {}

