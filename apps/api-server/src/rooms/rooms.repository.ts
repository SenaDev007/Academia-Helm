import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RoomsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(roomData: any): Promise<any> {
    return this.prisma.room.create({ data: roomData });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.room.findFirst({
      where: { id, tenantId },
    });
  }

  async findAll(tenantId: string, type?: string, status?: string): Promise<any[]> {
    const where: any = { tenantId };
    if (type) {
      where.type = type;
    }
    if (status) {
      where.status = status;
    }
    return this.prisma.room.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, tenantId: string, roomData: any): Promise<any> {
    await this.prisma.room.update({
      where: { id },
      data: roomData,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.room.delete({ where: { id } });
  }
}
