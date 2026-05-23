/**
 * ============================================================================
 * TRANSFERS PRISMA CONTROLLER
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TransfersPrismaService } from './transfers-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransfersPrismaController {
  constructor(private readonly transfersService: TransfersPrismaService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: any,
  ) {
    return this.transfersService.createTransferRequest({
      ...createDto,
      tenantId,
    });
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('status') status?: string,
  ) {
    return this.transfersService.getAllTransfers(tenantId, {
      academicYearId,
      schoolLevelId,
      status,
    });
  }

  @Get('student/:studentId')
  async getStudentTransfers(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
  ) {
    return this.transfersService.getStudentTransfers(studentId, tenantId);
  }

  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { approvedBy: string },
  ) {
    return this.transfersService.approveTransfer(id, tenantId, body.approvedBy);
  }

  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { reason?: string },
  ) {
    return this.transfersService.rejectTransfer(id, tenantId, body.reason);
  }
}

