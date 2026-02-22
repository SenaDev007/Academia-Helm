import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async create(userData: Partial<User>): Promise<User> {
    const user = this.repository.create(userData);
    return this.repository.save(user);
  }

  async findOne(id: string): Promise<User | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findOneWithRoles(id: string): Promise<User | null> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) return null;

    // Charger les rôles via la table user_roles sans utiliser la relation TypeORM
    // (évite l'erreur "User__User_roles.created_at n'existe pas" sur la table de jointure)
    const roles = await this.roleRepository
      .createQueryBuilder('role')
      .innerJoin('user_roles', 'ur', 'ur."roleId" = role.id AND ur."userId" = :userId', { userId: id })
      .getMany();

    user.roles = roles;
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ where: { email } });
  }

  async findByTenant(tenantId: string): Promise<User[]> {
    return this.repository.find({ where: { tenantId } });
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    await this.repository.update(id, userData);
    return this.findOne(id);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.repository.update(id, { lastLogin: new Date() });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}

