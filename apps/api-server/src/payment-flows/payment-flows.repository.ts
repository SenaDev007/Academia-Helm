import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaymentFlowType, PaymentFlowStatus, PaymentDestination } from './entities/payment-flow.entity';
import { CreatePaymentFlowDto } from './dto/create-payment-flow.dto';

@Injectable()
export class PaymentFlowsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePaymentFlowDto & { tenantId: string; destination: PaymentDestination; initiatedBy?: string; status?: PaymentFlowStatus }): Promise<any> {
    return this.prisma.paymentFlow.create({
      data: {
        ...data,
        destination: data.destination as PaymentDestination,
      },
    });
  }

  async findAll(
    tenantId: string,
    flowType?: PaymentFlowType,
    status?: PaymentFlowStatus,
    studentId?: string,
  ): Promise<any[]> {
    const where: any = { tenantId };
    if (flowType) {
      where.flowType = flowType;
    }
    if (status) {
      where.status = status;
    }
    if (studentId) {
      where.studentId = studentId;
    }
    return this.prisma.paymentFlow.findMany({
      where,
      include: { student: true, initiatedByUser: true, tenant: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.paymentFlow.findFirst({
      where: { id, tenantId },
      include: { student: true, initiatedByUser: true, tenant: true },
    });
  }

  async findByPspReference(pspReference: string): Promise<any | null> {
    return this.prisma.paymentFlow.findFirst({
      where: { pspReference },
      include: { tenant: true, student: true },
    });
  }

  async update(id: string, tenantId: string, data: any): Promise<any> {
    await this.prisma.paymentFlow.update({
      where: { id },
      data,
    });
    return this.findOne(id, tenantId);
  }

  async updateByPspReference(pspReference: string, data: any): Promise<any> {
    const flow = await this.findByPspReference(pspReference);
    if (!flow) {
      throw new Error(`Payment flow with PSP reference ${pspReference} not found`);
    }
    await this.prisma.paymentFlow.update({
      where: { id: flow.id },
      data,
    });
    return this.findOne(flow.id, flow.tenantId);
  }
}

@Injectable()
export class SchoolPaymentAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: any): Promise<any> {
    return this.prisma.schoolPaymentAccount.create({ data });
  }

  async findAll(tenantId: string): Promise<any[]> {
    return this.prisma.schoolPaymentAccount.findMany({
      where: { tenantId },
      include: { creator: true, verifiedByUser: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.schoolPaymentAccount.findFirst({
      where: { id, tenantId },
      include: { creator: true, verifiedByUser: true },
    });
  }

  async findActive(tenantId: string, psp?: string): Promise<any | null> {
    const where: any = { tenantId, isActive: true, isVerified: true };
    if (psp) {
      where.psp = psp;
    }
    return this.prisma.schoolPaymentAccount.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, tenantId: string, data: any): Promise<any> {
    await this.prisma.schoolPaymentAccount.update({
      where: { id },
      data,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.schoolPaymentAccount.delete({ where: { id } });
  }
}
