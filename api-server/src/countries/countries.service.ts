import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CountriesRepository } from './countries.repository';
import { Country } from './entities/country.entity';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';

@Injectable()
export class CountriesService {
  constructor(private readonly countriesRepository: CountriesRepository) {}

  async create(createCountryDto: CreateCountryDto): Promise<Country> {
    // Vérifier si le code existe déjà
    const existing = await this.countriesRepository.findByCode(createCountryDto.code);
    if (existing) {
      throw new ForbiddenException(`Country with code ${createCountryDto.code} already exists`);
    }

    // Si on définit ce pays comme défaut, désactiver les autres
    if (createCountryDto.isDefault) {
      const currentDefault = await this.countriesRepository.findDefault();
      if (currentDefault) {
        await this.countriesRepository.update(currentDefault.id, { isDefault: false });
      }
    }

    return this.countriesRepository.create(createCountryDto);
  }

  async findAll(activeOnly: boolean = false): Promise<Country[]> {
    return this.countriesRepository.findAll(activeOnly);
  }

  async findOne(id: string): Promise<Country> {
    const country = await this.countriesRepository.findOne(id);
    if (!country) {
      throw new NotFoundException(`Country with ID ${id} not found`);
    }
    return country;
  }

  async findByCode(code: string): Promise<Country> {
    const country = await this.countriesRepository.findByCode(code);
    if (!country) {
      throw new NotFoundException(`Country with code ${code} not found`);
    }
    return country;
  }

  async findDefault(): Promise<Country> {
    const country = await this.countriesRepository.findDefault();
    if (!country) {
      throw new NotFoundException('No default country found');
    }
    return country;
  }

  async update(id: string, updateCountryDto: UpdateCountryDto): Promise<Country> {
    const country = await this.findOne(id);

    // Vérifier l'unicité du code si modifié
    if (updateCountryDto.code && updateCountryDto.code !== country.code) {
      const existing = await this.countriesRepository.findByCode(updateCountryDto.code);
      if (existing && existing.id !== id) {
        throw new ForbiddenException(`Country with code ${updateCountryDto.code} already exists`);
      }
    }

    // Gérer le changement de pays par défaut
    if (updateCountryDto.isDefault === true && !country.isDefault) {
      await this.countriesRepository.setAsDefault(id);
      return this.findOne(id);
    }

    return this.countriesRepository.update(id, updateCountryDto);
  }

  async delete(id: string): Promise<void> {
    const country = await this.findOne(id);
    
    // Empêcher la suppression du pays par défaut
    if (country.isDefault) {
      throw new ForbiddenException('Cannot delete the default country');
    }

    await this.countriesRepository.delete(id);
  }

  async setAsDefault(id: string): Promise<Country> {
    await this.findOne(id); // Vérifier que le pays existe
    return this.countriesRepository.setAsDefault(id);
  }
}

