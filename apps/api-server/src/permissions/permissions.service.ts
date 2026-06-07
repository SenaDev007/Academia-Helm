import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';
import { Permission } from './entities/permission.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  async create(createPermissionDto: CreatePermissionDto): Promise<Permission> {
    // Check if permission with same name already exists
    const existing = await this.permissionsRepository.findByName(createPermissionDto.name);
    if (existing) {
      throw new ForbiddenException(`Permission with name ${createPermissionDto.name} already exists`);
    }

    return this.permissionsRepository.create(createPermissionDto);
  }

  async findAll(): Promise<Permission[]> {
    return this.permissionsRepository.findAll();
  }

  async findOne(id: string): Promise<Permission> {
    const permission = await this.permissionsRepository.findOne(id);
    if (!permission) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }
    return permission;
  }

  async findByResource(resource: string): Promise<Permission[]> {
    return this.permissionsRepository.findByResource(resource);
  }

  async update(id: string, updatePermissionDto: UpdatePermissionDto): Promise<Permission> {
    const permission = await this.findOne(id);

    // Check name uniqueness if name is being updated
    if (updatePermissionDto.name && updatePermissionDto.name !== permission.name) {
      const existing = await this.permissionsRepository.findByName(updatePermissionDto.name);
      if (existing && existing.id !== id) {
        throw new ForbiddenException(`Permission with name ${updatePermissionDto.name} already exists`);
      }
    }

    return this.permissionsRepository.update(id, updatePermissionDto);
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id);
    await this.permissionsRepository.delete(id);
  }
}

