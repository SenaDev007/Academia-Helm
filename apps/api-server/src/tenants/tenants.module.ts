import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { Tenant } from './entities/tenant.entity';
import { TenantsRepository } from './tenants.repository';
import { CountriesModule } from '../countries/countries.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),
    CountriesModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService, TenantsRepository],
  exports: [
    TenantsService,
    TypeOrmModule.forFeature([Tenant]), // ✅ Exporter le repository pour les guards globaux
  ],
})
export class TenantsModule {}

