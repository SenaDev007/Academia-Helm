import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('schools')
@UseGuards(JwtAuthGuard)
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Post()
  create(
    @Body() createSchoolDto: CreateSchoolDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.schoolsService.create(createSchoolDto, tenantId, user.id);
  }

  @Get()
  findOne(@TenantId() tenantId: string) {
    return this.schoolsService.findOne(tenantId);
  }

  @Patch()
  update(
    @Body() updateSchoolDto: UpdateSchoolDto,
    @TenantId() tenantId: string,
  ) {
    return this.schoolsService.update(tenantId, updateSchoolDto);
  }
}

