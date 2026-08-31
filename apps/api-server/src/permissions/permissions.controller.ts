/**
 * ============================================================================
 * PERMISSIONS CONTROLLER — CRUD on the `permissions` table
 * ============================================================================
 *
 * ⭐ SECURITY: Write operations (POST/PATCH/DELETE) require PARAMETRES:write
 *    via PermissionGuard. Previously this controller was only behind JwtAuthGuard
 *    (any authenticated user could create/modify/delete permissions — security hole).
 *
 * GET operations remain open to all authenticated users (read-only).
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'write')
  create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionsService.create(createPermissionDto);
  }

  @Get()
  findAll(@Query('resource') resource?: string) {
    if (resource) {
      return this.permissionsService.findByResource(resource);
    }
    return this.permissionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'write')
  update(@Param('id') id: string, @Body() updatePermissionDto: UpdatePermissionDto) {
    return this.permissionsService.update(id, updatePermissionDto);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('PARAMETRES', 'write')
  remove(@Param('id') id: string) {
    return this.permissionsService.delete(id);
  }
}
