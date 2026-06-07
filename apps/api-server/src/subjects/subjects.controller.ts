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
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('subjects')
@UseGuards(JwtAuthGuard)
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  create(
    @Body() createSubjectDto: CreateSubjectDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.subjectsService.create(createSubjectDto, tenantId, user.id);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('level') level?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.subjectsService.findAll(tenantId, level, academicYearId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.subjectsService.findOne(id, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSubjectDto: UpdateSubjectDto,
    @TenantId() tenantId: string,
  ) {
    return this.subjectsService.update(id, updateSubjectDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.subjectsService.delete(id, tenantId);
  }
}

