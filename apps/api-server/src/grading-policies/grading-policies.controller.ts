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
import { GradingPoliciesService } from './grading-policies.service';
import { CreateGradingPolicyDto } from './dto/create-grading-policy.dto';
import { UpdateGradingPolicyDto } from './dto/update-grading-policy.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('grading-policies')
@UseGuards(JwtAuthGuard)
export class GradingPoliciesController {
  constructor(private readonly gradingPoliciesService: GradingPoliciesService) {}

  @Post()
  create(@Body() createPolicyDto: CreateGradingPolicyDto) {
    return this.gradingPoliciesService.create(createPolicyDto);
  }

  @Get()
  findAll() {
    return this.gradingPoliciesService.findAll();
  }

  @Get('country/:countryId')
  findByCountry(
    @Param('countryId') countryId: string,
    @Query('educationLevel') educationLevel?: string,
  ) {
    return this.gradingPoliciesService.findByCountry(countryId, educationLevel);
  }

  @Get('country/:countryId/default')
  findDefaultByCountry(
    @Param('countryId') countryId: string,
    @Query('educationLevel') educationLevel?: string,
  ) {
    return this.gradingPoliciesService.findDefaultByCountry(countryId, educationLevel);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gradingPoliciesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updatePolicyDto: UpdateGradingPolicyDto,
    @Query('countryId') countryId: string,
  ) {
    return this.gradingPoliciesService.update(id, updatePolicyDto, countryId);
  }

  @Patch(':id/set-default')
  setAsDefault(
    @Param('id') id: string,
    @Query('countryId') countryId: string,
  ) {
    return this.gradingPoliciesService.setAsDefault(id, countryId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('countryId') countryId: string,
  ) {
    return this.gradingPoliciesService.delete(id, countryId);
  }
}

