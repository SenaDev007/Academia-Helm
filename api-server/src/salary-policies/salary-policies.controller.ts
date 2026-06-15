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
import { SalaryPoliciesService } from './salary-policies.service';
import { CreateSalaryPolicyDto } from './dto/create-salary-policy.dto';
import { UpdateSalaryPolicyDto } from './dto/update-salary-policy.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('salary-policies')
@UseGuards(JwtAuthGuard)
export class SalaryPoliciesController {
  constructor(private readonly salaryPoliciesService: SalaryPoliciesService) {}

  @Post()
  create(@Body() createPolicyDto: CreateSalaryPolicyDto) {
    return this.salaryPoliciesService.create(createPolicyDto);
  }

  @Get()
  findAll() {
    return this.salaryPoliciesService.findAll();
  }

  @Get('country/:countryId')
  findByCountry(@Param('countryId') countryId: string) {
    return this.salaryPoliciesService.findByCountry(countryId);
  }

  @Get('country/:countryId/default')
  findDefaultByCountry(@Param('countryId') countryId: string) {
    return this.salaryPoliciesService.findDefaultByCountry(countryId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salaryPoliciesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePolicyDto: UpdateSalaryPolicyDto,
    @Query('countryId') countryId: string,
  ) {
    return this.salaryPoliciesService.update(id, updatePolicyDto, countryId);
  }

  @Patch(':id/set-default')
  setAsDefault(
    @Param('id') id: string,
    @Query('countryId') countryId: string,
  ) {
    return this.salaryPoliciesService.setAsDefault(id, countryId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('countryId') countryId: string,
  ) {
    return this.salaryPoliciesService.delete(id, countryId);
  }
}

