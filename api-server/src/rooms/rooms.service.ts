import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRoomDto: CreateRoomDto, tenantId: string, createdBy?: string) {
    const roomCode = String(createRoomDto.roomCode || '').trim();
    const roomName = String(createRoomDto.roomName || '').trim();
    if (!roomCode || !roomName) {
      throw new BadRequestException('roomCode and roomName are required');
    }
    try {
      return await this.prisma.room.create({
        data: {
          tenantId,
          academicYearId: createRoomDto.academicYearId ?? null,
          schoolLevelId: createRoomDto.schoolLevelId ?? null,
          roomCode,
          roomName,
          roomType: createRoomDto.roomType,
          capacity: createRoomDto.capacity ?? null,
          equipment: (createRoomDto.equipment as any) ?? [],
          status: createRoomDto.status ?? 'ACTIVE',
          description: createRoomDto.description ?? null,
          createdBy: createdBy ?? null,
        },
      });
    } catch (e: any) {
      // Unique constraint (tenantId, roomCode)
      if (e?.code === 'P2002') {
        throw new BadRequestException('Ce code de salle est déjà utilisé.');
      }
      throw e;
    }
  }

  async findAll(
    tenantId: string,
    filters?: {
      roomType?: string;
      status?: string;
      search?: string;
      academicYearId?: string;
      schoolLevelId?: string;
    },
  ) {
    const where: any = { tenantId };
    const roomType = filters?.roomType?.trim();
    const status = filters?.status?.trim();
    const search = filters?.search?.trim();
    const academicYearId = filters?.academicYearId?.trim();
    const schoolLevelId = filters?.schoolLevelId?.trim();

    if (roomType) where.roomType = roomType;
    if (status) where.status = status;
    if (academicYearId) where.academicYearId = academicYearId;
    if (schoolLevelId) where.schoolLevelId = schoolLevelId;
    if (search) {
      where.OR = [
        { roomCode: { contains: search, mode: 'insensitive' } },
        { roomName: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.room.findMany({
      where,
      orderBy: [{ roomName: 'asc' }],
    });
  }

  async findOne(id: string, tenantId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, tenantId },
    });
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }
    return room;
  }

  async update(id: string, updateRoomDto: UpdateRoomDto, tenantId: string) {
    await this.findOne(id, tenantId);
    const data: any = {};
    if (updateRoomDto.roomCode !== undefined) data.roomCode = String(updateRoomDto.roomCode).trim();
    if (updateRoomDto.roomName !== undefined) data.roomName = String(updateRoomDto.roomName).trim();
    if (updateRoomDto.roomType !== undefined) data.roomType = updateRoomDto.roomType;
    if (updateRoomDto.capacity !== undefined) data.capacity = updateRoomDto.capacity ?? null;
    if (updateRoomDto.equipment !== undefined) data.equipment = (updateRoomDto.equipment as any) ?? [];
    if (updateRoomDto.status !== undefined) data.status = updateRoomDto.status;
    if (updateRoomDto.description !== undefined) data.description = updateRoomDto.description ?? null;
    if (updateRoomDto.academicYearId !== undefined) data.academicYearId = updateRoomDto.academicYearId ?? null;
    if (updateRoomDto.schoolLevelId !== undefined) data.schoolLevelId = updateRoomDto.schoolLevelId ?? null;

    try {
      return await this.prisma.room.update({
        where: { id },
        data,
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('Ce code de salle est déjà utilisé.');
      }
      throw e;
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.prisma.room.delete({ where: { id } });
  }

  async statistics(tenantId: string) {
    const [totalRooms, activeRooms, maintenanceRooms, unavailableRooms] =
      await this.prisma.$transaction([
        this.prisma.room.count({ where: { tenantId } }),
        this.prisma.room.count({ where: { tenantId, status: 'ACTIVE' } }),
        this.prisma.room.count({ where: { tenantId, status: 'MAINTENANCE' } }),
        this.prisma.room.count({ where: { tenantId, status: 'UNAVAILABLE' } }),
      ]);
    return {
      totalRooms,
      activeRooms,
      maintenanceRooms,
      unavailableRooms,
    };
  }
}

