import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { GradingPoliciesRepository } from './grading-policies.repository';
import { GradingPolicy } from './entities/grading-policy.entity';
import { CreateGradingPolicyDto } from './dto/create-grading-policy.dto';
import { UpdateGradingPolicyDto } from './dto/update-grading-policy.dto';
import { CountriesService } from '../countries/countries.service';

@Injectable()
export class GradingPoliciesService {
  constructor(
    private readonly gradingPoliciesRepository: GradingPoliciesRepository,
    private readonly countriesService: CountriesService,
  ) {}

  async create(createPolicyDto: CreateGradingPolicyDto): Promise<GradingPolicy> {
    // Vérifier que le pays existe
    await this.countriesService.findOne(createPolicyDto.countryId);

    // Si on définit cette policy comme défaut, désactiver les autres
    if (createPolicyDto.isDefault) {
      const currentDefault = await this.gradingPoliciesRepository.findDefaultByCountry(
        createPolicyDto.countryId,
        createPolicyDto.educationLevel,
      );
      if (currentDefault) {
        await this.gradingPoliciesRepository.update(
          currentDefault.id,
          createPolicyDto.countryId,
          { isDefault: false },
        );
      }
    }

    return this.gradingPoliciesRepository.create(createPolicyDto);
  }

  async findAll(): Promise<GradingPolicy[]> {
    return this.gradingPoliciesRepository.findAll();
  }

  async findByCountry(countryId: string, educationLevel?: string): Promise<GradingPolicy[]> {
    await this.countriesService.findOne(countryId);
    return this.gradingPoliciesRepository.findByCountry(countryId, educationLevel);
  }

  async findDefaultByCountry(countryId: string, educationLevel?: string): Promise<GradingPolicy> {
    await this.countriesService.findOne(countryId);
    const policy = await this.gradingPoliciesRepository.findDefaultByCountry(countryId, educationLevel);
    if (!policy) {
      throw new NotFoundException(
        `No default grading policy found for country ${countryId}${educationLevel ? ` and level ${educationLevel}` : ''}`,
      );
    }
    return policy;
  }

  async findOne(id: string, countryId?: string): Promise<GradingPolicy> {
    const policy = await this.gradingPoliciesRepository.findOne(id, countryId);
    if (!policy) {
      throw new NotFoundException(`Grading policy with ID ${id} not found`);
    }
    return policy;
  }

  async update(
    id: string,
    updatePolicyDto: UpdateGradingPolicyDto,
    countryId: string,
  ): Promise<GradingPolicy> {
    const policy = await this.findOne(id, countryId);

    // Gérer le changement de policy par défaut
    if (updatePolicyDto.isDefault === true && !policy.isDefault) {
      return this.gradingPoliciesRepository.setAsDefault(id, countryId);
    }

    return this.gradingPoliciesRepository.update(id, countryId, updatePolicyDto);
  }

  async delete(id: string, countryId: string): Promise<void> {
    await this.findOne(id, countryId);
    await this.gradingPoliciesRepository.delete(id, countryId);
  }

  async setAsDefault(id: string, countryId: string): Promise<GradingPolicy> {
    await this.findOne(id, countryId);
    return this.gradingPoliciesRepository.setAsDefault(id, countryId);
  }
}

