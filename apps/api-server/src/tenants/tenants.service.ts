import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantsRepository } from './tenants.repository';
import { Tenant } from './entities/tenant.entity';
import { CountriesService } from '../countries/countries.service';

@Injectable()
export class TenantsService {
  constructor(
    private readonly tenantsRepository: TenantsRepository,
    private readonly countriesService: CountriesService,
  ) {}

  async create(tenantData: Partial<Tenant>): Promise<Tenant> {
    // Valider que le pays existe
    if (!tenantData.countryId) {
      throw new BadRequestException('countryId is required. Every school must belong to a country.');
    }
    await this.countriesService.findOne(tenantData.countryId);
    
    return this.tenantsRepository.create(tenantData);
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findOne(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }
    return tenant;
  }

  async findBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findBySlug(slug);
    if (!tenant) {
      throw new NotFoundException(`Tenant with slug ${slug} not found`);
    }
    return tenant;
  }

  async findBySubdomain(subdomain: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findBySubdomainOrSlug(subdomain);
    if (!tenant) {
      throw new NotFoundException(`Tenant with subdomain/slug ${subdomain} not found`);
    }
    return tenant;
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantsRepository.findAll();
  }

  async update(id: string, tenantData: Partial<Tenant>): Promise<Tenant> {
    await this.findOne(id); // Check if exists
    return this.tenantsRepository.update(id, tenantData);
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id); // Check if exists
    await this.tenantsRepository.delete(id);
  }
}

