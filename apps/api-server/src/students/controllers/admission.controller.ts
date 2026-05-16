import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { AdmissionService } from '../services/admission.service';
import { CreateAdmissionDto } from '../dto/create-admission.dto';
import { UpdateAdmissionDto } from '../dto/update-admission.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/students/admissions')
@UseGuards(JwtAuthGuard)
export class AdmissionController {
  constructor(private readonly admissionService: AdmissionService) {}

  @Post()
  async create(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() createAdmissionDto: CreateAdmissionDto) {
    return this.admissionService.create(tenantId, createAdmissionDto, user?.id);
  }

  @Get()
  async findAll(@TenantId() tenantId: string, @Query() query: any) {
    return this.admissionService.findAll(tenantId, query);
  }

  @Get(':id')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.admissionService.findOne(id, tenantId);
  }

  @Patch(':id')
  async update(
    @TenantId() tenantId: string, 
    @Param('id') id: string, 
    @CurrentUser() user: any, 
    @Body() updateAdmissionDto: UpdateAdmissionDto
  ) {
    return this.admissionService.update(id, tenantId, updateAdmissionDto, user?.id);
  }

  @Post(':id/submit')
  async submit(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.admissionService.submit(id, tenantId);
  }

  @Post(':id/decide')
  async decide(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('decision') decision: 'ACCEPTED' | 'REJECTED',
    @Body('comment') comment: string,
  ) {
    return this.admissionService.decide(id, tenantId, decision, comment, user?.id);
  }

  @Post(':id/convert')
  async convert(@TenantId() tenantId: string, @Param('id') id: string, @CurrentUser() user: any) {
    return this.admissionService.convertToStudent(id, tenantId, user?.id);
  }
}
