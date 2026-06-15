import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CountriesService } from './countries.service';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('countries')
@UseGuards(JwtAuthGuard)
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Post()
  create(@Body() createCountryDto: CreateCountryDto) {
    return this.countriesService.create(createCountryDto);
  }

  @Get()
  findAll(@Query('activeOnly') activeOnly?: string) {
    return this.countriesService.findAll(activeOnly === 'true');
  }

  @Get('default')
  findDefault() {
    return this.countriesService.findDefault();
  }

  @Get('code/:code')
  findByCode(@Param('code') code: string) {
    return this.countriesService.findByCode(code);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.countriesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCountryDto: UpdateCountryDto) {
    return this.countriesService.update(id, updateCountryDto);
  }

  @Patch(':id/set-default')
  setAsDefault(@Param('id') id: string) {
    return this.countriesService.setAsDefault(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.countriesService.delete(id);
  }
}

