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
import { DisciplineService } from './discipline.service';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { UpdateDisciplineDto } from './dto/update-discipline.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('discipline')
@UseGuards(JwtAuthGuard)
export class DisciplineController {
  constructor(private readonly disciplineService: DisciplineService) {}

  @Post()
  create(
    @Body() createDisciplineDto: CreateDisciplineDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.disciplineService.create(createDisciplineDto, tenantId, user.id, user.id);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('studentId') studentId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.disciplineService.findAll(
      tenantId,
      studentId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.disciplineService.findOne(id, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDisciplineDto: UpdateDisciplineDto,
    @TenantId() tenantId: string,
  ) {
    return this.disciplineService.update(id, updateDisciplineDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.disciplineService.delete(id, tenantId);
  }
}

