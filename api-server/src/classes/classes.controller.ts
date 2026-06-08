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
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { SchoolLevelId } from '../common/decorators/school-level-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('classes')
@UseGuards(JwtAuthGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  create(
    @Body() createClassDto: CreateClassDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.classesService.create(createClassDto, tenantId, user.id);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @Query() pagination: PaginationDto,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.classesService.findAll(tenantId, schoolLevelId, pagination, academicYearId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
  ) {
    return this.classesService.findOne(id, tenantId, schoolLevelId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateClassDto: UpdateClassDto,
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
  ) {
    return this.classesService.update(id, updateClassDto, tenantId, schoolLevelId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
  ) {
    return this.classesService.delete(id, tenantId, schoolLevelId);
  }
}

