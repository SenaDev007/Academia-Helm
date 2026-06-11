import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QuartersService } from './quarters.service';
import { CreateQuarterDto } from './dto/create-quarter.dto';
import { UpdateQuarterDto } from './dto/update-quarter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('quarters')
@UseGuards(JwtAuthGuard)
export class QuartersController {
  constructor(private readonly quartersService: QuartersService) {}

  @Post()
  create(
    @Body() createQuarterDto: CreateQuarterDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.quartersService.create(createQuarterDto, tenantId, user.id);
  }

  @Get()
  findAll(@TenantId() tenantId: string, @Query('academicYearId') academicYearId?: string) {
    return this.quartersService.findAll(tenantId, academicYearId);
  }

  @Get('current')
  findCurrent(@TenantId() tenantId: string) {
    return this.quartersService.findCurrent(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.quartersService.findOne(id, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateQuarterDto: UpdateQuarterDto,
    @TenantId() tenantId: string,
  ) {
    return this.quartersService.update(id, updateQuarterDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.quartersService.delete(id, tenantId);
  }
}

