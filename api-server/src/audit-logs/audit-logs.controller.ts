import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Post()
  create(
    @Body() createAuditLogDto: CreateAuditLogDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.auditLogsService.create(createAuditLogDto, tenantId, user?.id);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('userId') userId?: string,
    @Query('resource') resource?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: any = {};
    if (userId) filters.userId = userId;
    if (resource) filters.resource = resource;
    if (action) filters.action = action;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    return this.auditLogsService.findAll(tenantId, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.auditLogsService.findOne(id, tenantId);
  }

  @Get('resource/:resource/:resourceId')
  findByResource(
    @Param('resource') resource: string,
    @Param('resourceId') resourceId: string,
    @TenantId() tenantId: string,
  ) {
    return this.auditLogsService.findByResource(resource, resourceId, tenantId);
  }
}

