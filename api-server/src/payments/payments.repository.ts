import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(paymentData: any): Promise<any> {
    return this.prisma.payment.create({ data: paymentData });
  }

  async findOne(id: string, tenantId: string, schoolLevelId: string): Promise<any | null> {
    return this.prisma.payment.findFirst({
      where: { id, tenantId, schoolLevelId },
      include: { student: true, feeConfiguration: true },
    });
  }

  async findAll(
    tenantId: string,
    schoolLevelId: string,
    pagination: { skip: number; take: number },
    studentId?: string,
    status?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any[]> {
    const where: any = { tenantId, schoolLevelId };

    if (studentId) {
      where.studentId = studentId;
    }
    if (status) {
      where.status = status;
    }
    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) {
        where.paymentDate.gte = startDate;
      }
      if (endDate) {
        where.paymentDate.lte = endDate;
      }
    }

    return this.prisma.payment.findMany({
      where,
      include: { student: true, feeConfiguration: true },
      orderBy: { paymentDate: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    });
  }

  async count(
    tenantId: string,
    schoolLevelId: string,
    studentId?: string,
    status?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<number> {
    const where: any = { tenantId, schoolLevelId };

    if (studentId) {
      where.studentId = studentId;
    }
    if (status) {
      where.status = status;
    }
    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) {
        where.paymentDate.gte = startDate;
      }
      if (endDate) {
        where.paymentDate.lte = endDate;
      }
    }

    return this.prisma.payment.count({ where });
  }

  async update(
    id: string,
    tenantId: string,
    schoolLevelId: string,
    paymentData: any,
  ): Promise<any> {
    await this.prisma.payment.updateMany({
      where: { id, tenantId, schoolLevelId },
      data: paymentData,
    });
    return this.findOne(id, tenantId, schoolLevelId);
  }

  async delete(id: string, tenantId: string, schoolLevelId: string): Promise<void> {
    await this.prisma.payment.deleteMany({
      where: { id, tenantId, schoolLevelId },
    });
  }
}
