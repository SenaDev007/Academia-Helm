/**
 * ============================================================================
 * REPORT CARDS PRISMA CONTROLLER - MODULE 3
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
import { ReportCardsPrismaService } from './report-cards-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GenerateReportCardDto, PublishReportCardDto } from './dto';

@Controller('report-cards')
@UseGuards(JwtAuthGuard)
export class ReportCardsPrismaController {
  constructor(private readonly reportCardsService: ReportCardsPrismaService) {}

  @Post('generate')
  async generate(@TenantId() tenantId: string, @Body() generateDto: GenerateReportCardDto) {
    return this.reportCardsService.generateReportCard({
      ...generateDto,
      tenantId,
    });
  }

  @Post(':id/validate')
  async validate(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.reportCardsService.validateReportCard(id, tenantId, user?.id);
  }

  @Post(':id/publish')
  async publish(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: PublishReportCardDto,
  ) {
    return this.reportCardsService.publishReportCard(id, tenantId, body.filePath);
  }

  @Get('student/:studentId')
  async findByStudent(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('quarterId') quarterId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.reportCardsService.findReportCardsByStudent(studentId, tenantId, {
      academicYearId,
      schoolLevelId,
      quarterId,
      type,
      status,
    });
  }
}
