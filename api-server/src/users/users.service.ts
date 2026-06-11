import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(userData: Partial<User>): Promise<User> {
    return this.usersRepository.create(userData);
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findOneWithRoles(id: string): Promise<User> {
    const user = await this.usersRepository.findOneWithRoles(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findByTenant(tenantId: string): Promise<User[]> {
    return this.usersRepository.findByTenant(tenantId);
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    await this.findOne(id); // Check if exists
    return this.usersRepository.update(id, userData);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepository.updateLastLogin(id);
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id); // Check if exists
    await this.usersRepository.delete(id);
  }
}

