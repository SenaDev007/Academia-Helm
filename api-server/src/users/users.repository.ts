import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(userData: any): Promise<any> {
    return this.prisma.user.create({ data: userData });
  }

  async findOne(id: string): Promise<any | null> {
    return this.prisma.user.findFirst({ where: { id } });
  }

  async findOneWithRoles(id: string): Promise<any | null> {
    const user = await this.prisma.user.findFirst({ where: { id } });
    if (!user) return null;

    // Charger les rôles via la relation Prisma (userRoles → role)
    // Le modèle User a la relation `userRoles UserRole[]`, pas `roles Role[]`
    const userWithRoles = await this.prisma.user.findFirst({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Aplatir les rôles pour faciliter l'accès (jwt.strategy attend user.roles)
    if (userWithRoles) {
      (userWithRoles as any).roles = (userWithRoles as any).userRoles?.map(
        (ur: any) => ur.role,
      )?.filter(Boolean) || [];
    }

    return userWithRoles;
  }

  async findByEmail(email: string): Promise<any | null> {
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    // Recherche insensible à la casse (évite 401 si l'email a été saisi avec une casse différente).
    return this.prisma.user.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
    });
  }

  async findByTenant(tenantId: string): Promise<any[]> {
    return this.prisma.user.findMany({ where: { tenantId } });
  }

  async update(id: string, userData: any): Promise<any> {
    await this.prisma.user.update({ where: { id }, data: userData });
    return this.findOne(id);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLogin: new Date() },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
