import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { RolesRepository } from './roles.repository';
import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}

  async create(createRoleDto: CreateRoleDto, tenantId?: string | null): Promise<Role> {
    // Check if role with same name already exists
    const existing = await this.rolesRepository.findByName(
      createRoleDto.name,
      tenantId ?? createRoleDto.tenantId ?? null,
    );
    if (existing) {
      throw new ForbiddenException(`Role with name ${createRoleDto.name} already exists`);
    }

    return this.rolesRepository.create({
      ...createRoleDto,
      tenantId: tenantId ?? createRoleDto.tenantId ?? null,
    });
  }

  async findAll(tenantId?: string | null): Promise<Role[]> {
    return this.rolesRepository.findAll(tenantId);
  }

  async findOne(id: string, tenantId?: string | null): Promise<Role> {
    const role = await this.rolesRepository.findOne(id, tenantId);
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return role;
  }

  async update(id: string, updateRoleDto: UpdateRoleDto, tenantId?: string | null): Promise<Role> {
    const role = await this.findOne(id, tenantId);
    
    // Prevent modification of system roles
    if (role.isSystemRole) {
      throw new ForbiddenException('System roles cannot be modified');
    }

    // Check name uniqueness if name is being updated
    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existing = await this.rolesRepository.findByName(
        updateRoleDto.name,
        tenantId ?? role.tenantId,
      );
      if (existing && existing.id !== id) {
        throw new ForbiddenException(`Role with name ${updateRoleDto.name} already exists`);
      }
    }

    return this.rolesRepository.update(id, tenantId ?? role.tenantId, updateRoleDto);
  }

  async delete(id: string, tenantId?: string | null): Promise<void> {
    const role = await this.findOne(id, tenantId);
    
    // Prevent deletion of system roles
    if (role.isSystemRole) {
      throw new ForbiddenException('System roles cannot be deleted');
    }

    await this.rolesRepository.delete(id, tenantId ?? role.tenantId);
  }
}

