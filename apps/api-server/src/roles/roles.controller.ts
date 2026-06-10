import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  create(
    @Body() createRoleDto: CreateRoleDto,
    @TenantId() tenantId: string | undefined,
  ) {
    return this.rolesService.create(createRoleDto, tenantId ?? null);
  }

  @Get()
  findAll(@TenantId() tenantId: string | undefined) {
    return this.rolesService.findAll(tenantId ?? null);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string | undefined) {
    return this.rolesService.findOne(id, tenantId ?? null);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @TenantId() tenantId: string | undefined,
  ) {
    return this.rolesService.update(id, updateRoleDto, tenantId ?? null);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @TenantId() tenantId: string | undefined) {
    return this.rolesService.delete(id, tenantId ?? null);
  }
}

