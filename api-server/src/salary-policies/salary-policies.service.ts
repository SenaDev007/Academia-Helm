import { Injectable, NotFoundException } from '@nestjs/common';
import { SalaryPoliciesRepository } from './salary-policies.repository';
import { SalaryPolicy } from './entities/salary-policy.entity';
import { CreateSalaryPolicyDto } from './dto/create-salary-policy.dto';
import { UpdateSalaryPolicyDto } from './dto/update-salary-policy.dto';
import { CountriesService } from '../countries/countries.service';

@Injectable()
export class SalaryPoliciesService {
  constructor(
    private readonly salaryPoliciesRepository: SalaryPoliciesRepository,
    private readonly countriesService: CountriesService,
  ) {}

  async create(createPolicyDto: CreateSalaryPolicyDto): Promise<SalaryPolicy> {
    // Vérifier que le pays existe
    await this.countriesService.findOne(createPolicyDto.countryId);

    // Si on définit cette policy comme défaut, désactiver les autres
    if (createPolicyDto.isDefault) {
      const currentDefault = await this.salaryPoliciesRepository.findDefaultByCountry(
        createPolicyDto.countryId,
      );
      if (currentDefault) {
        await this.salaryPoliciesRepository.update(
          currentDefault.id,
          createPolicyDto.countryId,
          { isDefault: false },
        );
      }
    }

    return this.salaryPoliciesRepository.create(createPolicyDto);
  }

  async findAll(): Promise<SalaryPolicy[]> {
    return this.salaryPoliciesRepository.findAll();
  }

  async findByCountry(countryId: string): Promise<SalaryPolicy[]> {
    await this.countriesService.findOne(countryId);
    return this.salaryPoliciesRepository.findByCountry(countryId);
  }

  async findDefaultByCountry(countryId: string): Promise<SalaryPolicy> {
    await this.countriesService.findOne(countryId);
    const policy = await this.salaryPoliciesRepository.findDefaultByCountry(countryId);
    if (!policy) {
      throw new NotFoundException(
        `No default salary policy found for country ${countryId}`,
      );
    }
    return policy;
  }

  async findOne(id: string, countryId?: string): Promise<SalaryPolicy> {
    const policy = await this.salaryPoliciesRepository.findOne(id, countryId);
    if (!policy) {
      throw new NotFoundException(`Salary policy with ID ${id} not found`);
    }
    return policy;
  }

  async update(
    id: string,
    updatePolicyDto: UpdateSalaryPolicyDto,
    countryId: string,
  ): Promise<SalaryPolicy> {
    const policy = await this.findOne(id, countryId);

    // Gérer le changement de policy par défaut
    if (updatePolicyDto.isDefault === true && !policy.isDefault) {
      return this.salaryPoliciesRepository.setAsDefault(id, countryId);
    }

    return this.salaryPoliciesRepository.update(id, countryId, updatePolicyDto);
  }

  async delete(id: string, countryId: string): Promise<void> {
    await this.findOne(id, countryId);
    await this.salaryPoliciesRepository.delete(id, countryId);
  }

  async setAsDefault(id: string, countryId: string): Promise<SalaryPolicy> {
    await this.findOne(id, countryId);
    return this.salaryPoliciesRepository.setAsDefault(id, countryId);
  }
}

