import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class TenantsRepository {
  constructor(
    @InjectRepository(Tenant)
    private readonly repository: Repository<Tenant>,
  ) {}

  async create(tenantData: Partial<Tenant>): Promise<Tenant> {
    const tenant = this.repository.create(tenantData);
    return this.repository.save(tenant);
  }

  async findOne(id: string): Promise<Tenant | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.repository.findOne({ where: { slug } });
  }

  async findBySubdomainOrSlug(subdomain: string): Promise<Tenant | null> {
    return this.repository.findOne({
      where: [
        { subdomain: subdomain },
        { slug: subdomain }
      ]
    });
  }

  async findAll(): Promise<Tenant[]> {
    return this.repository.find();
  }

  async update(id: string, tenantData: Partial<Tenant>): Promise<Tenant> {
    await this.repository.update(id, tenantData);
    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}

